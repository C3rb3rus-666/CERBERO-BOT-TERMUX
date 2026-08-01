import { downloadContentFromMessage } from '@whiskeysockets/baileys';
// Import dinámico de wa-sticker-formatter (se carga solo cuando se necesita)
// import Sticker from 'wa-sticker-formatter';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch (err) {
  console.warn('[STICKER] sharp no disponible, se usará fallback Jimp:', err.message?.slice(0, 80));
}

const _require = createRequire(import.meta.url);
let _jimp = null;
try {
  const jimpLib = _require('jimp');
  _jimp = jimpLib.Jimp ? jimpLib.Jimp : jimpLib;
} catch (err) {
  console.warn('[STICKER] jimp no disponible para fallback:', err.message?.slice(0, 80));
}

export async function createSticker(sock, message) {
  try {
    const senderId = message.key.participant || message.key.remoteJid; // ID del remitente
    const senderNumber = senderId.split('@')[0]; // Extraer número sin @s.whatsapp.net

    const messageContent = message.message;
    let mediaMessage = null;
    let isGif = false;
    let isVideo = false;

    // Detectar si el mensaje es una respuesta a otro mensaje con multimedia
    if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quotedMessage = messageContent.extendedTextMessage.contextInfo.quotedMessage;

      if (quotedMessage.imageMessage) {
        mediaMessage = quotedMessage.imageMessage;
      } else if (quotedMessage.videoMessage) {
        mediaMessage = quotedMessage.videoMessage;
        isGif = mediaMessage.gifPlayback || false; // Detectar si es un GIF
        isVideo = !isGif; // Si no es GIF, es un video normal
      }
    }

    // Detectar si el mensaje contiene un GIF, imagen o video directamente
    if (!mediaMessage) {
      if (messageContent.imageMessage) {
        mediaMessage = messageContent.imageMessage;
      } else if (messageContent.videoMessage) {
        mediaMessage = messageContent.videoMessage;
        isGif = mediaMessage.gifPlayback || false;
        isVideo = !isGif; // Si no es GIF, es un video normal
      }
    }

    // Validar que tengamos un archivo multimedia
    if (!mediaMessage) {
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderNumber}, asegúrate de enviar un **GIF**, **video** o **imagen válida** con el comando \`!sticker\`.`,
        mentions: [senderId]
      }, { quoted: message });
      return;
    }

    // Descargar el contenido multimedia
    const stream = await downloadContentFromMessage(
      mediaMessage,
      isGif || isVideo ? 'video' : 'image'
    );

    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    // Procesar el archivo según su tipo
    let stickerBuffer;
    if (isGif || isVideo) {
      // Optimizar GIF o video para sticker animado
      stickerBuffer = await optimizeAnimatedMedia(buffer, isVideo);
    } else {
      // Procesar imagen estática (incluyendo imágenes de "ver una vez")
      stickerBuffer = await optimizeImage(buffer);
    }

    // Crear el sticker (compatibilidad con distintas versiones de wa-sticker-formatter)
    let webpBuffer;
    try {
      const wsModule = await import('wa-sticker-formatter');
      const ws = wsModule?.default ?? wsModule;
      console.log('[DEBUG] wa-sticker-formatter export keys:', Object.keys(wsModule || {}));
      console.log('[DEBUG] ws type:', typeof ws, 'isFunction:', typeof ws === 'function');
      console.log('[DEBUG] ws keys:', ws && typeof ws === 'object' ? Object.keys(ws) : []);
      const options = {
        pack: 'CERBERO-BOT',
        author: 'Bot Creado por Carlos Sanchez #Unknowns website : https://github.com/C3rb3rus-666/',
        quality: 70, // Reducir calidad
        type: isGif || isVideo ? 'full' : 'default', // Sticker animado o estático
      };

      if (typeof ws === 'function') {
        // Exportación por defecto es la clase/constructor
        const instance = new ws(stickerBuffer, options);
        if (typeof instance.build === 'function' && typeof instance.get === 'function') {
          await instance.build();
          webpBuffer = await instance.get();
        } else if (typeof instance.toBuffer === 'function') {
          webpBuffer = await instance.toBuffer();
        } else {
          webpBuffer = instance;
        }
      } else if (typeof ws.Sticker === 'function') {
        const instance = new ws.Sticker(stickerBuffer, options);
        if (typeof instance.build === 'function' && typeof instance.get === 'function') {
          await instance.build();
          webpBuffer = await instance.get();
        } else if (typeof instance.toBuffer === 'function') {
          webpBuffer = await instance.toBuffer();
        } else {
          webpBuffer = instance;
        }
      } else if (typeof ws.createSticker === 'function') {
        const result = await ws.createSticker(stickerBuffer, options);
        if (Buffer.isBuffer(result)) webpBuffer = result;
        else if (result?.toBuffer) webpBuffer = await result.toBuffer();
        else webpBuffer = Buffer.from(result);
      } else {
        throw new Error('Formato de exportación de wa-sticker-formatter no soportado');
      }
    } catch (e) {
      console.error('Error al usar wa-sticker-formatter:', e);
      throw e;
    }

    // Normalizar y depurar el buffer resultante
    try {
      console.log('[DEBUG] Resultado de wa-sticker-formatter:', {
        type: typeof webpBuffer,
        isBuffer: Buffer.isBuffer(webpBuffer),
        hasLength: webpBuffer && typeof webpBuffer.length === 'number'
      });

      // Normalizar objetos { data: Buffer } o { buffer: Buffer }
      if (webpBuffer && !Buffer.isBuffer(webpBuffer)) {
        if (webpBuffer.data && Buffer.isBuffer(webpBuffer.data)) {
          webpBuffer = webpBuffer.data;
        } else if (webpBuffer.buffer && Buffer.isBuffer(webpBuffer.buffer)) {
          webpBuffer = webpBuffer.buffer;
        } else if (typeof webpBuffer === 'string') {
          // A veces la librería puede devolver base64
          try {
            webpBuffer = Buffer.from(webpBuffer, 'base64');
          } catch (err) {
            console.warn('[DEBUG] No se pudo convertir string a buffer:', err);
          }
        }
      }

      if (!webpBuffer || !Buffer.isBuffer(webpBuffer)) {
        console.error('[ERROR] webpBuffer no es un Buffer válido:', webpBuffer);
        await sock.sendMessage(message.key.remoteJid, {
          text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderNumber}, no se pudo procesar el sticker correctamente. Intenta con otra imagen o GIF.`,
          mentions: [senderId]
        }, { quoted: message });
        return;
      }

      console.log('[DEBUG] webpBuffer size:', webpBuffer.length);

      // Verificar que el sticker no supere el límite de 512 KB
      if (webpBuffer.length > 512 * 1024) {
        await sock.sendMessage(message.key.remoteJid, {
          text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderNumber}, 𝐞𝐥 𝐬𝐭𝐢𝐜𝐤𝐞𝐫 𝐟𝐢𝐧𝐚𝐥 𝐞𝐱𝐜𝐞𝐝𝐞 𝐞𝐥 𝐥í𝐦𝐢𝐭𝐞 𝐝𝐞 𝟓𝟏𝟐 𝐊𝐁. 𝐔𝐬𝐚 𝐮𝐧 𝐆𝐈𝐅 𝐨 𝐯𝐢𝐝𝐞𝐨 𝐦á𝐬 𝐥𝐢𝐠𝐞𝐫𝐨.`,
          mentions: [senderId],
        }, { quoted: message });
        return;
      }

      // Enviar el sticker optimizado y confirmar
      try {
        await sock.sendMessage(message.key.remoteJid, { sticker: webpBuffer }, { quoted: message });
        console.log('[INFO] Sticker enviado correctamente a', message.key.remoteJid);
      } catch (err) {
        console.error('[ERROR] fallo al enviar sticker:', err);
        // Fallback: enviar como archivo si falla
        try {
          await sock.sendMessage(message.key.remoteJid, { document: webpBuffer, fileName: 'sticker.webp', mimetype: 'image/webp' }, { quoted: message });
          console.log('[INFO] Sticker enviado como documento (fallback)');
        } catch (err2) {
          console.error('[ERROR] fallback también falló:', err2);
          await sock.sendMessage(message.key.remoteJid, {
            text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderNumber}, ocurrió un error al enviar el sticker.`,
            mentions: [senderId],
          }, { quoted: message });
        }
      }

    } catch (e) {
      console.error('[ERROR] Normalización/Envío falló:', e);
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderNumber}, error interno creando el sticker.`,
        mentions: [senderId],
      }, { quoted: message });
    }

  } catch (error) {
    console.error("Error al crear el sticker:", error);
    const senderId = message.key.participant || message.key.remoteJid;
    await sock.sendMessage(message.key.remoteJid, {
      text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderId.split('@')[0]}, 𝐞𝐫𝐫𝐨𝐫 𝐚𝐥 𝐜𝐫𝐞𝐚𝐫 𝐞𝐥 𝐬𝐭𝐢𝐜𝐤𝐞𝐫. 𝐀𝐬𝐞𝐠ú𝐫𝐚𝐭𝐞 𝐝𝐞 𝐞𝐧𝐯𝐢𝐚𝐫 𝐮𝐧 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐯á𝐥𝐢𝐝𝐨.`,
      mentions: [senderId],
    }, { quoted: message });
  }
}

async function optimizeImage(inputBuffer) {
  // Procesar imagen estática (incluye view-once) con pipeline resiliente en ARM.
  if (sharp) {
    return sharp(inputBuffer)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ force: true, quality: 100 })
      .toBuffer();
  }

  if (_jimp) {
    const image = await _jimp.read(inputBuffer);
    image.contain(512, 512);
    if (typeof image.getBufferAsync === 'function') {
      return image.getBufferAsync('image/png');
    }
    return new Promise((resolve, reject) => {
      image.getBuffer('image/png', (err, out) => {
        if (err) return reject(err);
        resolve(out);
      });
    });
  }

  throw new Error('No hay backend de imagen disponible (sharp/jimp) para crear sticker.');
}

async function optimizeAnimatedMedia(inputBuffer, isVideo) {
  const tempInput = path.join('/tmp', `input-${Date.now()}.${isVideo ? 'mp4' : 'gif'}`);
  const tempOutput = path.join('/tmp', `output-${Date.now()}.webp`);

  fs.writeFileSync(tempInput, inputBuffer);

  return new Promise((resolve, reject) => {
    // Convertir GIF o video a sticker animado (preservar alfa cuando exista)
    // Usar libwebp con pix_fmt yuva420p para conservar transparencia
    const cmd = `ffmpeg -y -i "${tempInput}" -vf "fps=15,scale=512:512:flags=lanczos" -c:v libwebp -lossless 1 -pix_fmt yuva420p -loop 0 -an -vsync 0 "${tempOutput}"`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[DEBUG] ffmpeg error:', stderr || stdout || error);
        return reject(error);
      }
      try {
        const optimizedBuffer = fs.readFileSync(tempOutput);
        try { fs.unlinkSync(tempInput); } catch (_) {}
        try { fs.unlinkSync(tempOutput); } catch (_) {}
        resolve(optimizedBuffer);
      } catch (fsErr) {
        reject(fsErr);
      }
    });
  });
}



/*import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { Sticker } from 'wa-sticker-formatter';

/**
 * Función para crear stickers estáticos y animados (GIFs o videos).
 * @param {Object} sock - Instancia del socket de WhatsApp.
 * @param {Object} message - Mensaje recibido.
 */
/*
export async function createSticker(sock, message) {
  try {
    const messageContent = message.message;
    let mediaMessage = null;

    // Detectar si hay imagen, video o GIF en el mensaje
    if (messageContent.imageMessage) {
      mediaMessage = messageContent.imageMessage;
    } else if (messageContent.videoMessage) {
      mediaMessage = messageContent.videoMessage;
    } else if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
      // Si el mensaje es texto pero cita una imagen
      mediaMessage = messageContent.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
    } else if (messageContent.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage) {
      // Si el mensaje es texto pero cita un video o GIF
      mediaMessage = messageContent.extendedTextMessage.contextInfo.quotedMessage.videoMessage;
    }

    if (!mediaMessage) {
      await sock.sendMessage(message.key.remoteJid, {
        text: "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 ❌ *𝐄𝐧𝐯í𝐚 𝐮𝐧𝐚 𝐢𝐦𝐚𝐠𝐞𝐧, 𝐯𝐢𝐝𝐞𝐨 𝐨 𝐆𝐈𝐅 𝐜𝐨𝐧 𝐞𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 `!𝐬𝐭𝐢𝐜𝐤𝐞𝐫`, 𝐨 𝐫𝐞𝐬𝐩𝐨𝐧𝐝𝐞 𝐚 𝐮𝐧 𝐦𝐞𝐝𝐢𝐚 𝐜𝐨𝐧 `!𝐬𝐭𝐢𝐜𝐤𝐞𝐫`.",
        quoted: message,
      });
      return;
    }

    // Descargar el contenido multimedia (imagen, video o GIF)
    const stream = await downloadContentFromMessage(mediaMessage, mediaMessage.mimetype?.startsWith('image') ? 'image' : 'video');
    let buffer = Buffer.from([]);

    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    if (buffer.length === 0) {
      await sock.sendMessage(message.key.remoteJid, {
        text: "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 ❌ 𝐍𝐨 𝐬𝐞 𝐩𝐮𝐝𝐨 𝐝𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐫 𝐞𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨. 𝐈𝐧𝐭𝐞𝐧𝐭𝐚 𝐝𝐞 𝐧𝐮𝐞𝐯𝐨.",
        quoted: message,
      });
      return;
    }

    // Crear el sticker (compatibilidad con distintas versiones de wa-sticker-formatter)
    let webpBuffer;
    try {
      const wsModule = await import('wa-sticker-formatter');
      const ws = wsModule?.default ?? wsModule;
      const options = {
        pack: 'CERBERO-BOT',      // Nombre del pack
        author: 'Bot Creado por Carlos Sanchez #Unknowns', // Nombre del autor
        categories: ['C3rb3rus-666 and S43nz'], // Categorías (opcional)
        quality: 100,             // Calidad del sticker
        type: mediaMessage.mimetype?.startsWith('image') ? 'default' : 'full', // Tipo de sticker
        animated: mediaMessage.mimetype?.startsWith('video') || mediaMessage?.gifPlayback || false, // Animado si es GIF o video
      };

      if (typeof ws === 'function') {
        const instance = new ws(buffer, options);
        webpBuffer = instance?.toBuffer ? await instance.toBuffer() : instance;
      } else if (typeof ws.Sticker === 'function') {
        const instance = new ws.Sticker(buffer, options);
        webpBuffer = await instance.toBuffer();
      } else if (typeof ws.createSticker === 'function') {
        const result = await ws.createSticker(buffer, options);
        if (Buffer.isBuffer(result)) webpBuffer = result;
        else if (result?.toBuffer) webpBuffer = await result.toBuffer();
        else webpBuffer = Buffer.from(result);
      } else {
        throw new Error('Formato de exportación de wa-sticker-formatter no soportado');
      }
    } catch (e) {
      console.error('Error al usar wa-sticker-formatter:', e);
      throw e;
    }



  } catch (error) {
    console.error("Error al crear el sticker:", error);
    await sock.sendMessage(message.key.remoteJid, {
      text: "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 ❌ 𝐄𝐫𝐫𝐨𝐫 𝐚𝐥 𝐜𝐫𝐞𝐚𝐫 𝐞𝐥 𝐬𝐭𝐢𝐜𝐤𝐞𝐫. 𝐀𝐬𝐞𝐠ú𝐫𝐚𝐭𝐞 𝐝𝐞 𝐞𝐧𝐯𝐢𝐚𝐫 𝐮𝐧 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐯á𝐥𝐢𝐝𝐨.",
      quoted: message,
    });
  }
}

*/