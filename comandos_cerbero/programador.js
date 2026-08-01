import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de rutas
const imagesDir = path.join(__dirname, 'imagenes');

// Función para seleccionar una imagen aleatoria (prioriza prefijos 'menu' y 'ping')
function getRandomImage(imagesDir, preferredPrefixes = ['menu','ping']) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;

  // Buscar imágenes que comiencen con prefijos preferidos (case-insensitive)
  const preferred = files.filter(f => {
    const name = path.basename(f).toLowerCase();
    return preferredPrefixes.some(pref => name.startsWith(pref.toLowerCase()));
  });

  const chosenFile = (preferred.length > 0)
    ? preferred[Math.floor(Math.random() * preferred.length)]
    : files[Math.floor(Math.random() * files.length)];

  return path.join(imagesDir, chosenFile);
}

// Función para manejar el comando !programador
export async function creador(sock, msg) {
  const menuText = `
╔══════════════════════════════════════════╗
║    👨‍💻 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓  𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑        ║
║    v4.6.0 (Build 123) — Online          ║
╚══════════════════════════════════════════╝

*🧑‍💻 𝗦𝗢𝗕𝗥𝗘 𝗘𝗟 𝗗𝗘𝗦𝗔𝗥𝗥𝗢𝗟𝗟𝗔𝗗𝗢𝗥*
─────────────────────────
• 👤 *Nombre:* Carlos Sánchez
• 🏷️ *Alias:* C3rb3rus-666
• 💼 *Rol:* Full-Stack Developer & Bot Creator
• 📅 *Experiencia:* 12 años
• 🎯 *Especialidad:* Node.js · Python · C++ · Java

*⚙️ 𝗧𝗘𝗖𝗡𝗢𝗟𝗢𝗚𝗜𝗔𝗦*
─────────────────────────
• 🟢 Node.js + Baileys v7
• 🐍 Python (IA local)
• 🤖 TensorFlow.js (NSFW/NLP)
• 🎬 FFmpeg · Canvas · Axios

*📊 𝗘𝗦𝗧𝗔𝗗𝗢 𝗗𝗘𝗟 𝗕𝗢𝗧*
─────────────────────────
• 🔋 *Estado:* Online
• 📦 *Versión:* v4.6.0 (Build 123)
• 🧩 *Comandos:* 50+ disponibles

*🔗 𝗖𝗢𝗡𝗧𝗔𝗖𝗧𝗢 & 𝗥𝗘𝗗𝗘𝗦*
─────────────────────────
• 🐙 github.com/C3rb3rus-666
• 📂 github.com/C3rb3rus-666/cerbero-bot
• ✈️ t.me/C3rb3rus_666
• 📷 instagram.com/c3rb3rus_666
• 📱 WhatsApp +57 3233704652
─────────────────────────

┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃  🤖 ¿QUIERES UN BOT COMO ESTE? ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
  Bots personalizados para grupos
  de WhatsApp con IA, juegos,
  moderación y mucho más.

  📱 +57 3233704652 (WhatsApp)
  📷 @c3rb3rus_666 (Instagram)
  ✈️ @C3rb3rus_666 (Telegram)
─────────────────────────
`.trim();

  const randomImagePath = getRandomImage(imagesDir);
  if (!randomImagePath) {
    await sock.sendMessage(msg.key.remoteJid, { text: 'No se pudo encontrar una imagen.' }, { quoted: msg });
    return;
  }

  const imageBuffer = fs.readFileSync(randomImagePath);
  await sock.sendMessage(msg.key.remoteJid, {
    image: imageBuffer,
    caption: menuText,
    buttons: [
      { buttonId: '!menu', buttonText: { displayText: '📋 Menú' }, type: 1 },
      { buttonId: '!ping', buttonText: { displayText: '📶 Ping' }, type: 1 },
      { buttonId: '!help', buttonText: { displayText: '❓ Ayuda' }, type: 1 }
    ],
    footer: '⚡ Desarrollado por C3rb3rus-666 | v4.6.0 Build 123'
  }, { quoted: msg });
}
