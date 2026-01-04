import { pipeline } from '@xenova/transformers';

let classifier = null;

/**
 * Carga el clasificador NSFW si no está cargado.
 */
async function loadClassifier() {
  if (!classifier) {
    try {
      console.log('[NSFW] Cargando clasificador NSFW con Transformers...');
      classifier = await pipeline('image-classification', 'Falconsai/nsfw-image-detection');
      console.log('[NSFW] Clasificador cargado exitosamente.');
    } catch (error) {
      console.error('[NSFW] Error cargando clasificador:', error);
      return null;
    }
  }
  return classifier;
}

/**
 * Clasifica una imagen usando Transformers.
 * @param {Buffer} imageBuffer - Buffer de la imagen.
 * @returns {Array} - Array de predicciones con label y score.
 */
async function classifyImage(imageBuffer) {
  try {
    const classifier = await loadClassifier();
    if (!classifier) return null;
    console.log('[NSFW] Clasificando imagen...');
    const predictions = await classifier(imageBuffer);
    console.log('[NSFW] Clasificación completada:', predictions);
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
  console.log('[NSFW] detectNSFW function called');
  if (!groupMetadata) {
    console.log('[NSFW] No groupMetadata, skipping');
    return; // Solo en grupos
  }

  const groupId = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;

  if (isAdmin) {
    console.log('[NSFW] User is admin, skipping');
    return; // No aplicar a admins
  }

  console.log(`[NSFW] Función detectNSFW llamada para mensaje en ${groupId}`);

  const isImage =
    !!msg.message?.imageMessage ||
    (msg.message?.documentMessage &&
      msg.message.documentMessage.mimetype?.startsWith('image/'));

  if (!isImage) {
    console.log(`[NSFW] Mensaje no es imagen: ${Object.keys(msg.message || {})}`);
    return; // Solo procesar imágenes
  }

  console.log(`[NSFW] Detectada imagen, procediendo a analizar de ${userId}...`);

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

    // Obtener la predicción principal
    const topPrediction = predictions[0];
    const topLabel = topPrediction.label;
    const topScore = topPrediction.score;

    // Enviar aviso de clasificación (para pruebas)
    await sock.sendMessage(groupId, {
      text: `🔍 [NSFW DETECTOR] Imagen clasificada como: ${topLabel} (${(topScore * 100).toFixed(1)}%)`,
    });

    // Verificar si es NSFW
    const isNSFW = topLabel.toLowerCase().includes('nsfw') && topScore > 0.7;

    if (isNSFW) {
      // Eliminar el mensaje
      await sock.sendMessage(groupId, { delete: msg.key });

      // Advertir y expulsar
      await sock.groupParticipantsUpdate(groupId, [userId], 'remove');

      await sock.sendMessage(groupId, {
        text: `🚫 [NSFW DETECTOR] Contenido inapropiado detectado. Usuario @${userId.split('@')[0]} expulsado.`,
        mentions: [userId],
      });

      console.log(`[NSFW] Imagen NSFW (${topLabel}) eliminada y usuario ${userId} expulsado.`);
    } else {
      console.log(`[NSFW] Imagen segura (${topLabel}: ${(topScore * 100).toFixed(1)}%).`);
    }
  } catch (error) {
    console.error('[NSFW] Error en detectNSFW:', error);
  }
}