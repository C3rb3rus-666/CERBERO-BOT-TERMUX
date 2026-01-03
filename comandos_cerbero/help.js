import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, '..', 'comandos_cerbero', 'imagenes');

// Función para seleccionar una imagen aleatoria
function getRandomImage(imagesDir) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
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
    // Simulamos escritura para realismo
    await sock.sendPresenceUpdate('composing', chatId);

    const randomImagePath = getRandomImage(imagesDir);
    if (randomImagePath) {
      const imageBuffer = fs.readFileSync(randomImagePath);
      
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
    } else {
      // Fallback por si no encuentra la imagen
      await sock.sendMessage(chatId, { 
        text: helpText,
        mentions: [msg.key.participant || chatId]
      }, { quoted: msg });
    }

  } catch (error) {
    console.error('Error en !help:', error);
    await sock.sendMessage(chatId, {
      text: `❌ Error al mostrar la ayuda: ${error.message}`
    }, { quoted: msg });
  }
}