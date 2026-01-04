import * as nsfwjs from 'nsfwjs';
import * as tf from '@tensorflow/tfjs-node'; // Necesario para NSFWJS en Node.js

let model = null;

/**
 * Carga el modelo NSFWJS si no está cargado.
 */
async function loadModel() {
  if (!model) {
    console.log('[NSFW] Cargando modelo NSFWJS...');
    model = await nsfwjs.load();
    console.log('[NSFW] Modelo cargado exitosamente.');
  }
  return model;
}

/**
 * Clasifica una imagen usando NSFWJS.
 * @param {Buffer} imageBuffer - Buffer de la imagen.
 * @returns {Array} - Array de predicciones con clase y probabilidad.
 */
async function classifyImage(imageBuffer) {
  try {
    const model = await loadModel();
    const image = await tf.node.decodeImage(imageBuffer, 3); // 3 canales (RGB)
    const predictions = await model.classify(image);
    image.dispose(); // Liberar memoria
    return predictions;
  } catch (error) {
    console.error('[NSFW] Error clasificando imagen:', error);
    return null;
  }
}

/**
 * Detecta y maneja contenido NSFW en imágenes.
 * Si es NSFW, elimina el mensaje, advierte y opcionalmente expulsa.
 * @param {Object} sock - Instancia de Baileys.
 * @param {Object} msg - Mensaje de WhatsApp.
 * @param {boolean} isAdmin - Si el usuario es admin.
 * @param {Object} groupMetadata - Metadatos del grupo.
 */
export async function detectNSFW(sock, msg, isAdmin, groupMetadata) {
  if (!groupMetadata) return; // Solo en grupos

  const groupId = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;

  if (isAdmin) return; // No aplicar a admins

  const isImage =
    !!msg.message?.imageMessage ||
    (msg.message?.documentMessage &&
      msg.message.documentMessage.mimetype?.startsWith('image/'));

  if (!isImage) return; // Solo procesar imágenes

  try {
    console.log(`[NSFW] Analizando imagen de ${userId}...`);

    // Descargar la imagen
    const buffer = await sock.downloadMediaMessage(msg);
    if (!buffer) {
      console.log('[NSFW] No se pudo descargar la imagen.');
      return;
    }

    // Clasificar
    const predictions = await classifyImage(buffer);
    if (!predictions) return;

    // Verificar si es NSFW (alta probabilidad de contenido pornográfico)
    const nsfwClasses = ['Porn', 'Hentai', 'Sexy']; // Clases consideradas NSFW
    const threshold = 0.7; // Umbral de 70%

    let isNSFW = false;
    let maxClass = '';
    let maxProb = 0;

    for (const pred of predictions) {
      if (nsfwClasses.includes(pred.className) && pred.probability > threshold) {
        isNSFW = true;
        if (pred.probability > maxProb) {
          maxProb = pred.probability;
          maxClass = pred.className;
        }
      }
    }

    // Obtener la predicción principal
    const topPrediction = predictions[0];
    const topClass = topPrediction.className;
    const topProb = topPrediction.probability;

    // Enviar aviso de clasificación (para pruebas)
    await sock.sendMessage(groupId, {
      text: `🔍 [NSFW DETECTOR] Imagen clasificada como: ${topClass} (${(topProb * 100).toFixed(1)}%)`,
    });

    if (isNSFW) {
      // Eliminar el mensaje
      await sock.sendMessage(groupId, { delete: msg.key });

      // Advertir y expulsar
      await sock.groupParticipantsUpdate(groupId, [userId], 'remove');

      await sock.sendMessage(groupId, {
        text: `🚫 [NSFW DETECTOR] Contenido inapropiado detectado. Usuario @${userId.split('@')[0]} expulsado.`,
        mentions: [userId],
      });

      console.log(`[NSFW] Imagen NSFW (${maxClass}) eliminada y usuario ${userId} expulsado.`);
    } else {
      console.log(`[NSFW] Imagen segura (${topClass}: ${(topProb * 100).toFixed(1)}%).`);
    }
  } catch (error) {
    console.error('[NSFW] Error en detectNSFW:', error);
  }
}