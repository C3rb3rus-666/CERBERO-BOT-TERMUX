import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyImage, mapFriendlyLabel, isNSFWPrediction } from './nsfw_classifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuImagesDir = path.join(__dirname, 'imagenes');

function getRandomMenuImage(preferredPrefixes = ['menu', 'ping']) {
  try {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const files = fs.readdirSync(menuImagesDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext) && fs.statSync(path.join(menuImagesDir, file)).isFile();
    });
    if (!files.length) return null;

    const preferred = files.filter(file => {
      const name = path.basename(file).toLowerCase();
      return preferredPrefixes.some(pref => name.startsWith(pref.toLowerCase()));
    });

    const selected = preferred.length ? preferred : files;
    const randomFile = selected[Math.floor(Math.random() * selected.length)];
    return path.join(menuImagesDir, randomFile);
  } catch (err) {
    console.error('[NSFW] No se pudo obtener imagen de menu:', err.message);
    return null;
  }
}

// Control de concurrencia para evitar sobrecarga cuando llegan muchas imágenes
let _nsfwProcessingCount = 0;
const NSFW_MAX_CONCURRENCY = 2; // ajustar según capacidad del servidor
const _nsfwQueue = [];
const OVERLAY_COOLDOWN_MS = 30 * 1000;
const _overlayTimestamps = new Map();

// Cooldown por usuario para el aviso de imagen segura (90 segundos)
const SAFE_NOTICE_COOLDOWN_MS = 90 * 1000;
const _safeNoticeTimestamps = new Map();

function _acquireNsfwSlot() {
  return new Promise((resolve) => {
    if (_nsfwProcessingCount < NSFW_MAX_CONCURRENCY) {
      _nsfwProcessingCount++;
      return resolve();
    }
    _nsfwQueue.push(resolve);
  });
}

function _releaseNsfwSlot() {
  _nsfwProcessingCount = Math.max(0, _nsfwProcessingCount - 1);
  if (_nsfwQueue.length) {
    _nsfwProcessingCount++;
    const r = _nsfwQueue.shift();
    try { r(); } catch (e) { console.error('[NSFW] Error resolviendo cola:', e); }
  }
}

function canSendOverlay(groupId) {
  const now = Date.now();
  const last = _overlayTimestamps.get(groupId) || 0;
  if (now - last < OVERLAY_COOLDOWN_MS) {
    return false;
  }
  _overlayTimestamps.set(groupId, now);
  return true;
}

function bufferToHex(input) {
  if (!input) return '';
  try {
    if (Buffer.isBuffer(input)) return input.toString('hex');
    if (Array.isArray(input)) return Buffer.from(input).toString('hex');
    if (input?.data && Array.isArray(input.data)) return Buffer.from(input.data).toString('hex');
    return String(input);
  } catch (err) {
    return '';
  }
}

function getViewOnceContainer(message) {
  if (!message) return null;
  return message.viewOnceMessage?.message || message.viewOnceMessageV2?.message || null;
}

function getMediaSignature(mediaMessage) {
  const sha = bufferToHex(mediaMessage?.fileSha256 || mediaMessage?.sha256);
  const length = mediaMessage?.fileLength || mediaMessage?.length || 0;
  return `${sha || 'no-sha'}|${mediaMessage?.mimetype || ''}|${length}`;
}

function collectMediaEntries(msg) {
  const entries = [];
  const seen = new Set();

  function push(messageContainer) {
    if (!messageContainer) return;
    const mediaMessage = messageContainer.imageMessage || messageContainer.documentMessage;
    if (!mediaMessage || !mediaMessage.mimetype?.startsWith('image')) return;
    const signature = getMediaSignature(mediaMessage);
    if (seen.has(signature)) return;
    seen.add(signature);
    entries.push({ fullMessage: { key: msg.key, message: messageContainer }, mediaMessage });
  }

  const root = msg.message;
  push(root);
  push(getViewOnceContainer(root));

  const ephemeral = root?.ephemeralMessage?.message;
  push(ephemeral);
  push(getViewOnceContainer(ephemeral));

  return entries;
}

async function processImageEntry(entry, context, entryIndex) {
  const { sock, groupId, userId, isAdmin, deleteKey } = context;

  await _acquireNsfwSlot();
  try {
    console.log(`[NSFW] (${entryIndex}/${context.totalEntries}) Analizando imagen (${entry.mediaMessage.mimetype || 'desconocido'})...`);

    const buffer = await downloadMediaMessage(entry.fullMessage, 'buffer', {}, sock);
    if (!buffer) {
      console.log('[NSFW] No se pudo descargar la imagen a procesar.');
      return;
    }

    const predictions = await classifyImage(buffer);
    if (!predictions) return;

    const topPrediction = predictions[0];
    const topLabel = topPrediction.label;
    const topScore = topPrediction.score;
    const isNSFW = isNSFWPrediction(topLabel, topScore);
    const entrySignature = getMediaSignature(entry.mediaMessage);
    if (isNSFW && context.alertedSignatures.has(entrySignature)) {
      console.log(`[NSFW] Aviso repetido omitido para ${entrySignature}`);
      return;
    }
    if (isNSFW) {
      context.alertedSignatures.add(entrySignature);
    }
    const friendlyLabel = mapFriendlyLabel(topLabel);
    const baseMessage = `🚫 Imagen eliminada: ${friendlyLabel} (${(topScore * 100).toFixed(1)}%). Usuario @${userId.split('@')[0]}`;

    if (isNSFW) {
      if (!context.messageDeleted) {
        context.messageDeleted = true;
        try {
          await sock.sendMessage(groupId, { delete: deleteKey });
        } catch (deleteError) {
          console.error('[NSFW] No se pudo borrar el mensaje:', deleteError.message || deleteError);
        }
      }

      const caption = isAdmin
        ? `${baseMessage}. Usuario es admin, no se expulsa.`
        : `${baseMessage}. Expulsado del grupo.`;

      try {
        const menuImage = getRandomMenuImage();
        const overlayAllowed = menuImage && canSendOverlay(groupId);
        if (overlayAllowed) {
          const imageBuffer = fs.readFileSync(menuImage);
          await sock.sendMessage(groupId, {
            image: imageBuffer,
            caption,
            mentions: [userId],
          }, { quoted: entry.fullMessage });
        } else {
          if (menuImage) {
            console.log('[NSFW] Overlay limitado, enviando solo texto en lugar de imagen.');
          }
          await sock.sendMessage(groupId, { text: caption, mentions: [userId] }, { quoted: entry.fullMessage });
        }
      } catch (sendErr) {
        console.error('[NSFW] Error enviando aviso con imagen:', sendErr.message || sendErr);
        try {
          await sock.sendMessage(groupId, { text: caption, mentions: [userId] }, { quoted: entry.fullMessage });
        } catch (innerErr) {
          console.error('[NSFW] Error reintentando enviar aviso:', innerErr.message || innerErr);
        }
      }

      if (!isAdmin) {
        try {
          await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
        } catch (kickErr) {
          console.error('[NSFW] Error expulsando usuario:', kickErr.message || kickErr);
        }
      }

      console.log(`[NSFW] Imagen NSFW (${topLabel}) procesada (${isAdmin ? 'admin, sin expulsión' : 'usuario expulsado'}).`);
    } else {
      // Imagen segura: notificar en el grupo (con cooldown por usuario para no spamear)
      console.log(`[NSFW] Imagen segura (${topLabel}: ${(topScore * 100).toFixed(1)}%). Sin acción.`);
      const now = Date.now();
      const lastSafe = _safeNoticeTimestamps.get(userId) || 0;
      if (now - lastSafe >= SAFE_NOTICE_COOLDOWN_MS) {
        _safeNoticeTimestamps.set(userId, now);
        try {
          // Construir desglose de scores para mostrar
          const scoreLines = predictions
            .slice(0, 5)
            .map(p => {
              const pct = (p.score * 100).toFixed(1);
              const bar = '█'.repeat(Math.round(p.score * 10)) + '░'.repeat(10 - Math.round(p.score * 10));
              return `  ${bar} ${pct}% — ${mapFriendlyLabel(p.label)}`;
            })
            .join('\n');

          const safeText =
            `🛡️ *CERBERO NSFW SCAN* — Imagen verificada\n` +
            `👤 Usuario: @${userId.split('@')[0]}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `${scoreLines}\n` +
            `━━━━━━━━━━━━━━━━━━━━\n` +
            `✅ Resultado: *SEGURA* (${(topScore * 100).toFixed(1)}% confianza)\n` +
            `🔍 Motor: nsfwjs + TensorFlow`;

          const safeImg = getRandomMenuImage();
          if (safeImg) {
            await sock.sendMessage(groupId, {
              image: fs.readFileSync(safeImg),
              caption: safeText,
              mentions: [userId],
            }, { quoted: entry.fullMessage });
          } else {
            await sock.sendMessage(groupId, {
              text: safeText,
              mentions: [userId],
            }, { quoted: entry.fullMessage });
          }
        } catch (noticeErr) {
          console.error('[NSFW] Error enviando aviso seguro:', noticeErr.message || noticeErr);
        }
      }
    }
  } catch (error) {
    console.error(`[NSFW] Error procesando imagen ${entryIndex}/${context.totalEntries}:`, error);
  } finally {
    _releaseNsfwSlot();
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

  const containsSticker = !!msg.message?.stickerMessage || !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
  if (containsSticker) {
    console.log('[NSFW] Mensaje o citado contiene sticker, omitiendo detector NSFW.');
    return;
  }

  const groupId = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;

  console.log(`[NSFW] Función detectNSFW llamada para mensaje en ${groupId}`);

  const entries = collectMediaEntries(msg);
  if (!entries.length) {
    console.log('[NSFW] El mensaje no contiene imágenes que se puedan procesar.');
    return;
  }

  console.log(`[NSFW] Se encontraron ${entries.length} imagen(es) para analizar de ${userId}.`);

  const context = {
    sock,
    groupId,
    userId,
    isAdmin,
    deleteKey: msg.key,
    messageDeleted: false,
    totalEntries: entries.length,
    alertedSignatures: new Set()
  };

  await Promise.all(entries.map((entry, index) => processImageEntry(entry, context, index + 1)));
}
