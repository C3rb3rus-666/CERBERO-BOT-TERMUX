import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, 'imagenes');
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);

// Escoge una imagen aleatoria de la carpeta que alimenta los menús.
export function getRandomMenuImagePath() {
  try {
    const files = fs.readdirSync(imagesDir).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      const fullPath = path.join(imagesDir, file);
      return imageExtensions.has(ext) && fs.statSync(fullPath).isFile();
    });

    if (files.length === 0) return null;
    const randomFile = files[Math.floor(Math.random() * files.length)];
    return path.join(imagesDir, randomFile);
  } catch (error) {
    console.error('Error leyendo imágenes de menú:', error);
    return null;
  }
}

// Envía una de esas imágenes acompañada de un breve texto explicativo.
export async function artCommand(sock, msg) {
  const chatId = msg.key.remoteJid;
  const mentionTarget = msg.key.participant || chatId;
  const imagePath = getRandomMenuImagePath();

  if (!imagePath) {
    await sock.sendMessage(chatId, {
      text: '❌ No pude cargar las imágenes de fondo del menú. Intenta más tarde.',
      mentions: [mentionTarget]
    }, { quoted: msg });
    return;
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      image: imageBuffer,
      caption: 'arte de cerbero-bot version 4.4.17 by C3rb3rus-666 sistema operativo Cerbero-OS Based on arch linux github.com/C3rb3rus-666',
      contextInfo: {
        mentionedJid: [mentionTarget],
        forwardingScore: 999,
        isForwarded: true
      }
    }, { quoted: msg });
  } catch (error) {
    console.error('Error en !art:', error);
    await sock.sendMessage(chatId, {
      text: `❌ No pude enviar la imagen del menú: ${error.message}`,
      mentions: [mentionTarget]
    }, { quoted: msg });
  }
}
