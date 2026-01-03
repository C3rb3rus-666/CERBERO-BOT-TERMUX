import fs from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import mime from 'mime-types';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { pipeline } from '@xenova/transformers';

let clipModel = null;

async function initClipModel() {
  if (!clipModel) {
    clipModel = await pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
  }
}

export async function handleImageRecognition(sock, msg) {
  await initClipModel();

  const type = Object.keys(msg.message || {})[0];
  console.log('📥 Tipo de mensaje detectado:', type);

  // Extraer media de distintos tipos
  let mediaMessage = null;
  let fullMessage = null;

  if (msg.message?.imageMessage || msg.message?.documentMessage || msg.message?.viewOnceMessage) {
    // Imagen normal, documento imagen o ver una vez
    mediaMessage =
      msg.message?.imageMessage ||
      msg.message?.documentMessage ||
      msg.message?.viewOnceMessage?.message?.imageMessage;
    fullMessage = { key: msg.key, message: msg.message };
  } else if (type === 'extendedTextMessage') {
    // Imagen citada (mensaje respondido)
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedImage =
      quoted?.imageMessage ||
      quoted?.documentMessage ||
      quoted?.viewOnceMessage?.message?.imageMessage;

    if (quotedImage) {
      mediaMessage = quotedImage;
      fullMessage = {
        key: {
          ...msg.key,
          id: msg.message.extendedTextMessage.contextInfo.stanzaId,
        },
        message: quoted
      };
    }
  }

  if (!mediaMessage || !fullMessage) return;

  const stream = await downloadMediaMessage(fullMessage, 'buffer');

  const ext = mime.extension(mediaMessage.mimetype || 'image/jpeg');
  const dir = './tmp';
  const fileName = `${dir}/${msg.key.id}.${ext}`;

  if (!fs.existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  await writeFile(fileName, stream);

  const labels = [
    'meme', 'persona', 'animal', 'paisaje', 'logo', 'dinero',
    'comida', 'vehículo', 'edificio', 'naturaleza', 'tecnología', 'deporte',
    'flor', 'mar', 'montaña', 'ciudad', 'retrato', 'juego',
    'instrumento musical', 'fiesta', 'moda', 'arte', 'película', 'robot',
    'espacio', 'playa', 'bosque', 'tren', 'avión', 'gato',
    'selfie', 'grupo de personas', 'mensaje de texto', 'emoji', 'sticker',
    'pantalla de móvil', 'foto de comida', 'perro', 'captura de pantalla',
    'celebración', 'cumpleaños', 'documento', 'amor', 'llanto', 'risa',
    'trabajo', 'vacaciones', 'cafetera', 'bebida','chat','codigo'
  ];

  const prediction = await clipModel(fileName, labels);
  const bestPrediction = prediction.reduce((max, curr) => curr.score > max.score ? curr : max, prediction[0]);

  console.log('📸 Mejor predicción CLIP:', bestPrediction);

  await sock.sendMessage(msg.key.remoteJid, {
    text: `𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 📊 *Predicción más probable de la imagen:*\n• ${bestPrediction.label}: ${(bestPrediction.score * 100).toFixed(2)}%`
  }, { quoted: msg });

  try {
    fs.unlinkSync(fileName);
  } catch (error) {
    console.error('❌ Error al borrar archivo temporal:', error);
  }
}
