import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, '..', 'comandos_cerbero', 'imagenes');

// Función para seleccionar una imagen aleatoria
function getRandomImage(imagesDir, preferredPrefixes = ['menu','ping']) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;

  // Buscar archivos con prefijos preferidos
  const preferred = files.filter(f => {
    const name = path.basename(f).toLowerCase();
    return preferredPrefixes.some(pref => name.startsWith(pref.toLowerCase()));
  });

  const chosen = (preferred.length > 0) ? preferred[Math.floor(Math.random() * preferred.length)] : files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, chosen);
}

export async function helpCommand(sock, msg) {
  const chatId = msg.key.remoteJid;

  // Texto explicativo conceptual
  const helpText = `
𝐂𝐄𝐑𝐁𝐄𝐑𝐎 𝐇𝐄𝐋𝐏 𝐂𝐄𝐍𝐓𝐄𝐑 
𝐒𝐘𝐒𝐓𝐄𝐌: 𝐎𝐍𝐋𝐈𝐍𝐄 | 𝐏𝐑𝐎𝐓𝐎𝐂𝐎𝐋: 𝟔𝟔𝟔

👋 *¿Qué soy?*
Soy *CERBERO*, una Inteligencia Artificial diseñada para proteger este grupo, gestionar una economía criminal y generar caos controlado
Creado por C3rb3rus-666 carlos sanchez

────────────────────────────
👤 𝐏𝐀𝐑𝐀 𝐋𝐎𝐒 𝐌𝐎𝐑𝐓𝐀𝐋𝐄𝐒 (Miembros)
Tu misión es sobrevivir, acumular riqueza y socializar.

💰 *Economía & RPG:*
El sistema se basa en dinero virtual. 
• Empieza trabajando con \`!work\` o \`!daily\`.
• Arriésgalo todo en el casino (\`!ruleta\`, \`!blackjack\`).
• Entra al bajo mundo con \`!drogas\` o \`!putas\`.
• Guarda tu fortuna en el \`!banco\` o te robarán.

❤️ *Social:*
• Puedes casarte (\`!casarme\`) o ser infiel (\`!putas\`).
• Cuidado: El sistema monitorea quién es fiel y quién es \`!cachudo\`.

*🖼️ 𝗜𝗠Á𝗚𝗘𝗡𝗘𝗦 & 𝗔𝗨𝗫𝗜𝗟𝗜𝗢*
• \`!extractor\` — Extrae la imagen de un sticker citado y la envía como imagen.

────────────────────────────
🛡️ 𝐏𝐀𝐑𝐀 𝐋𝐎𝐒 𝐆𝐔𝐀𝐑𝐃𝐈𝐀𝐍𝐄𝐒 (Admins)
Ustedes tienen las llaves de las puertas.

⚙️ *Seguridad:*
• \`!antilink\`: Expulsa automáticamente a quienes envían enlaces de otros grupos.
• \`!ban\` / \`!kick\`: Elimina usuarios molestos.
• \`!todos\`: Invoca a todo el grupo (úsalo con sabiduría).

────────────────────────────
📂 *¿Buscas la lista completa de comandos?*
Escribe: *!menu*

👨‍💻 *¿Información del Creador?*
Escribe: *!programador*

_Coded by C3rb3rus-666_ 
`.trim();

  try {
    // Log de invocación para depuración
    console.log(`[help] invoked by ${msg.key.participant || chatId} in ${chatId} at ${new Date().toISOString()}`);

    // Envío rápido de texto para garantizar respuesta inmediata
    try {
      await sock.sendMessage(chatId, { text: helpText, mentions: [msg.key.participant || chatId] }, { quoted: msg });
      console.log('[help] quick text sent');

      // Envío en segundo plano de imagen aleatoria (comportamiento similar a !menu)
      (async () => {
        try {
          // pequeño delay para que la respuesta rápida llegue primero
          await new Promise(r => setTimeout(r, 1000));

          const followImage = getRandomImage(imagesDir, ['menu','ping']);
          if (!followImage) { console.log('[help] no follow-up image found'); return; }

          const stats = fs.statSync(followImage);
          console.log(`[help] selected follow-up image: ${followImage} (${stats.size} bytes)`);

          const imgBuf = fs.readFileSync(followImage);

          try {
            await sock.sendMessage(chatId, { image: imgBuf, caption: helpText }, { quoted: msg });
            console.log('[help] follow-up image sent (buffer)');
          } catch (errBuffer) {
            console.warn('[help] send buffer failed, trying send by path:', errBuffer.message || errBuffer);
            try {
              await sock.sendMessage(chatId, { image: { url: followImage }, caption: helpText }, { quoted: msg });
              console.log('[help] follow-up image sent (path)');
            } catch (errPath) {
              console.warn('[help] follow-up image failed both buffer and path:', errPath.message || errPath);
            }
          }

        } catch (errFollow) {
          console.warn('[help] follow-up image failed (outer):', errFollow.message || errFollow);
        }
      })();

      return; // respuesta inmediata enviada, ya programado el follow-up
    } catch (errQuick) {
      console.warn('[help] quick text send failed, will attempt robust flow:', errQuick.message || errQuick);
      // Continuamos con flujo robusto: intentos con imagen y externalAdReply
    }

    // Simulamos escritura para realismo (solo si quick send falló)
    try {
      await sock.sendPresenceUpdate('composing', chatId);
    } catch (presErr) {
      console.warn('[help] sendPresenceUpdate failed:', presErr.message || presErr);
    }

    const randomImagePath = getRandomImage(imagesDir);
    if (randomImagePath) {
      const imageBuffer = fs.readFileSync(randomImagePath);

      // Intento principal: enviar con externalAdReply (thumbnail)
      try {
        await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption: helpText,
          contextInfo: {
            mentionedJid: [msg.key.participant || chatId],
            forwardingScore: 999,
            isForwarded: true,
            externalAdReply: {
              title: "🆘 AYUDA - CERBERO BOT",
              body: "Guía de supervivencia básica",
              thumbnail: imageBuffer,
              mediaType: 1,
              renderLargerThumbnail: true
            }
          }
        }, { quoted: msg });
        console.log('[help] image+externalAdReply sent');
      } catch (errSend) {
        console.warn('!help: send with externalAdReply failed, retrying without externalAdReply', errSend.message || errSend);
        // Segundo intento: enviar sólo imagen y caption (sin contextInfo)
        try {
          await sock.sendMessage(chatId, {
            image: imageBuffer,
            caption: helpText
          }, { quoted: msg });
          console.log('[help] image+caption sent');
        } catch (errSend2) {
          console.warn('!help: send image+caption failed, falling back to text', errSend2.message || errSend2);
          // Último recurso: enviar sólo texto con menciones
          await sock.sendMessage(chatId, { 
            text: helpText,
            mentions: [msg.key.participant || chatId]
          }, { quoted: msg });
          console.log('[help] fallback text sent after image failures');
        }
      }

    } else {
      // Fallback por si no encuentra la imagen
      await sock.sendMessage(chatId, { 
        text: helpText,
        mentions: [msg.key.participant || chatId]
      }, { quoted: msg });
      console.log('[help] text fallback sent (no image found)');
    }

  } catch (error) {
    console.error('Error en !help:', error);
    // Si ocurre cualquier error, intenta enviar un mensaje de texto con el error manualmente
    try {
      await sock.sendMessage(chatId, {
        text: `❌ Error al mostrar la ayuda: ${error.message}`
      }, { quoted: msg });
      console.log('[help] sent error fallback message');
    } catch (errFinal) {
      console.error('Error sending fallback error message for !help:', errFinal);
    }
  }
}