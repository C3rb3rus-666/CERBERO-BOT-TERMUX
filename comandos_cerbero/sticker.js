import Jimp from 'jimp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

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

    const webpBuffer = stickerBuffer;

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
  const image = await Jimp.read(inputBuffer);
  image.contain(512, 512, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
  image.background(0x00000000);
  return await image.quality(80).getBufferAsync(Jimp.MIME_WEBP);
}

async function optimizeAnimatedMedia(inputBuffer, isVideo) {
  const tempInput = path.join('/tmp', `input-${Date.now()}.${isVideo ? 'mp4' : 'gif'}`);
  const tempOutput = path.join('/tmp', `output-${Date.now()}.webp`);

  fs.writeFileSync(tempInput, inputBuffer);

  return new Promise((resolve, reject) => {
    // Convertir GIF o video a sticker animado (preservar alfa cuando exista)
    // Usar libwebp con pix_fmt yuva420p para conservar transparencia
    const cmd = `ffmpeg -i ${tempInput} -vf "fps=15,scale=512:512:flags=lanczos" -c:v libwebp -lossless 1 -pix_fmt yuva420p -loop 0 -an -vsync 0 ${tempOutput}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error('[DEBUG] ffmpeg error:', stderr || stdout || error);
        return reject(error);
      }
      try {
        const optimizedBuffer = fs.readFileSync(tempOutput);
        fs.unlinkSync(tempInput); // Eliminar archivos temporales
        fs.unlinkSync(tempOutput);
        resolve(optimizedBuffer);
      } catch (fsErr) {
        reject(fsErr);
      }
    });
  });
}
