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
  const menuText = `CERBERO-BOT DEVELOPER\nv4.2.10 (Build 78)\n\nNombre: Carlos Sánchez (C3rb3rus-666)\nRol: Full-Stack Developer & Bot Creator\nExperiencia: 12 años\nEspecialidad: Node.js, Python, WhatsApp Bots, C++, Java\n\nTecnologías: Node.js, Baileys, Python (IA local), Google Gemini, FFmpeg, Canvas, Axios, TensorFlow.js\n\nVersión: v4.2.10 (Build 78)\nEstado: Online\nComandos: 50+ disponibles\n\nContacto & Redes:\n- GitHub: https://github.com/C3rb3rus-666\n- Repo: https://github.com/C3rb3rus-666/cerbero-bot\n- Telegram: https://t.me/C3rb3rus_666\n- Instagram: https://instagram.com/c3rb3rus_666\n- WhatsApp: https://wa.me/573233704652 ( +57 323 370 4652 )\n\nProyectos:\n- Cerbero-Bot (WhatsApp bot)\n- IA Local\n- Music Bot\n- RPG System\n`.trim();

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
      { buttonId: '!menu', buttonText: { displayText: 'Ver Menú' }, type: 1 },
      { buttonId: '!ping', buttonText: { displayText: 'Ping' }, type: 1 },
      { buttonId: '!help', buttonText: { displayText: 'Ayuda' }, type: 1 }
    ],
    footer: 'Desarrollado por C3rb3rus-666 | v4.2.10'
  }, { quoted: msg });
}
