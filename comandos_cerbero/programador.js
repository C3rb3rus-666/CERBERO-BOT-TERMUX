import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de rutas
const imagesDir = path.join(__dirname, 'imagenes');

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

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de rutas
const imagesDir = path.join(__dirname, 'imagenes');

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

// Función para manejar el comando !programador
export async function creador(sock, msg) {
    // Información del desarrollador
    const menuText = `
╔══════════════════════════════════════════╗
║        👨‍💻 CERBERO-BOT DEVELOPER         ║
║          v4.2.10 (Build 78)             ║
║     🤖 Sistema Operativo Online         ║
╚══════════════════════════════════════════╝

═══════════════════════════════════════════

*👤 𝗜𝗡𝗙𝗢𝗥𝗠𝗔𝗖𝗜𝗢𝗡 𝗗𝗘𝗟 𝗗𝗘𝗦𝗔𝗥𝗥𝗢𝗟𝗟𝗔𝗗𝗢𝗥*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👨‍💻 *Nombre:* Carlos Sánchez (C3rb3rus-666)
🎯 *Rol:* Full-Stack Developer & Bot Creator
📅 *Experiencia:* 12+ años en desarrollo
💻 *Especialidad:* Node.js, Python, WhatsApp Bots, C++/C, JAVA
🌟 *Proyecto:* Cerbero-Bot (WhatsApp Automation)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🛠️ 𝗧𝗘𝗖𝗡𝗢𝗟𝗢𝗚𝗜𝗔𝗦 𝗨𝗧𝗜𝗟𝗜𝗭𝗔𝗗𝗔𝗦*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Runtime:* Node.js v20.19.6
• *Framework:* Baileys (WhatsApp Web API)
• *IA Local:* Python + Transformers
• *IA Cloud:* Google Gemini API
• *Base de Datos:* JSON Files + File System
• *Multimedia:* FFmpeg + Canvas
• *Web Scraping:* Axios + Puppeteer
• *Machine Learning:* TensorFlow.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📈 𝗘𝗦𝗧𝗔𝗗𝗜𝗦𝗧𝗜𝗖𝗔𝗦 𝗗𝗘𝗟 𝗕𝗢𝗧*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Versión:* v4.2.10 (Build 78)
• *Estado:* 🟢 Online y Funcionando
• *Comandos:* 50+ comandos disponibles
• *Grupos:* Soporte multi-grupo
• *IA:* Respuestas inteligentes
• *Multimedia:* Stickers, Música, Videos
• *Seguridad:* Anti-spam, Anti-link, Anti-traba
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📞 𝗖𝗢𝗡𝗧𝗔𝗖𝗧𝗢 𝗬 𝗥𝗘𝗗𝗘𝗦*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *WhatsApp:* +57 323 370 4652
📷 *Instagram:* @c3rb3rus_666
💻 *GitHub:* github.com/C3rb3rus-666
🌐 *Portfolio:* Próximamente...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🎮 𝗣𝗥𝗢𝗬𝗘𝗖𝗧𝗢𝗦 𝗗𝗘𝗟 𝗗𝗘𝗦𝗔𝗥𝗥𝗢𝗟𝗟𝗔𝗗𝗢𝗥*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 🤖 *Cerbero-Bot:* Bot WhatsApp avanzado
• 🧠 *IA Local:* Sistema de aprendizaje automático
• 🎵 *Music Bot:* Descarga y reproducción de música
• 🎮 *RPG System:* Sistema de juegos integrado
• 🔒 *Security Modules:* Protección anti-spam/traba
• 📊 *Analytics:* Sistema de estadísticas y logs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💡 𝗔𝗖𝗘𝗥𝗖𝗔 𝗗𝗘 𝗠𝗜*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_"La programación no es solo código, es arte digital que da vida a las ideas"_

*"Cada línea de código es una oportunidad para crear algo extraordinario"*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*#𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 | 👁‍🗨 Cerbero-Bot™*
`.trim();
• *Framework:* Baileys (WhatsApp Web API)
• *IA Local:* Python + Transformers
• *Base de Datos:* JSON Files + File System
• *Multimedia:* FFmpeg + Canvas
• *Web Scraping:* Axios + Puppeteer
• *Machine Learning:* TensorFlow.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📈 𝗘𝗦𝗧𝗔𝗗𝗜𝗦𝗧𝗜𝗖𝗔𝗦 𝗗𝗘𝗟 𝗕𝗢𝗧*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• *Versión:* v4.2.10 (Build 78)
• *Estado:* 🟢 Online y Funcionando
• *Comandos:* 50+ comandos disponibles
• *Grupos:* Soporte multi-grupo
• *IA:* Respuestas integradas
• *Multimedia:* Stickers, Música, Videos
• *Seguridad:* Anti-spam, Anti-link, Anti-traba
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*📞 𝗖𝗢𝗡𝗧𝗔𝗖𝗧𝗢 𝗬 𝗥𝗘𝗗𝗘𝗦*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 *WhatsApp:* +573233704652
📷 *Instagram:* @c3rb3rus_666
💻 *GitHub:* github.com/C3rb3rus-666
💻 *Telegram:* t.me/C3rb3rus_666 
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*🎮 𝗣𝗥𝗢𝗬𝗘𝗖𝗧𝗢𝗦 𝗗𝗘𝗟 𝗗𝗘𝗦𝗔𝗥𝗥𝗢𝗟𝗟𝗔𝗗𝗢𝗥*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 🤖 *Cerbero-Bot:* Bot WhatsApp avanzado
• 🧠 *IA Local:* Sistema de aprendizaje automático
• 🎵 *Music Bot:* Descarga y reproducción de música
• 🎮 *RPG System:* Sistema de juegos integrado
• 🔒 *Security Modules:* Protección anti-spam/traba
• 📊 *Analytics:* Sistema de estadísticas y logs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*💡 𝗔𝗖𝗘𝗥𝗖𝗔 𝗗𝗘 𝗠𝗜*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_"La programación no es solo código, es arte digital que da vida a las ideas"_

*"Cada línea de código es una oportunidad para crear algo extraordinario"*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*#𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 | 👁‍🗨 Cerbero-Bot™*
`.trim();


    // Seleccionamos una imagen aleatoria
    const randomImagePath = getRandomImage(imagesDir);
    if (!randomImagePath) {
        console.error('No se encontraron imágenes en la carpeta.');
        await sock.sendMessage(msg.key.remoteJid, { text: 'No se pudo encontrar una imagen.' });
        return;
    }

    // Leemos la imagen como un buffer
    const imageBuffer = fs.readFileSync(randomImagePath);

    // Enviamos el mensaje con la imagen, texto y botones interactivos
    await sock.sendMessage(msg.key.remoteJid, {
        image: imageBuffer,
        caption: menuText,
        buttons: [
            {
                buttonId: '!menu',
                buttonText: { displayText: '📋 Ver Menú Principal' },
                type: 1,
            },
            {
                buttonId: '!ping',
                buttonText: { displayText: '📊 Ver Estadísticas' },
                type: 1,
            },
            {
                buttonId: '!help',
                buttonText: { displayText: '🆘 Ayuda & Comandos' },
                type: 1,
            }
        ],
        footer: '👨‍💻 Desarrollado por C3rb3rus-666 | Cerbero-Bot v4.2.10'
    }, { quoted: msg });

}