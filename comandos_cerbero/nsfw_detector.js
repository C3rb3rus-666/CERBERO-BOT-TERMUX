import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { classifyImage, mapFriendlyLabel, isNSFWPrediction } from './nsfw_classifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuImagesDir = path.join(__dirname, 'imagenes');

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch (err) {
  console.warn('[NSFW] sharp no disponible para señal anti-gore:', err.message?.slice(0, 80));
}

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
const NSFW_MAX_CONCURRENCY = Number(process.env.NSFW_MAX_CONCURRENCY || ((process.arch === 'arm' || process.arch === 'arm64') ? 1 : 2));
const NSFW_MAX_QUEUE = Number(process.env.NSFW_MAX_QUEUE || ((process.arch === 'arm' || process.arch === 'arm64') ? 4 : 12));
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
      return resolve(true);
    }
    if (_nsfwQueue.length >= NSFW_MAX_QUEUE) return resolve(false);
    _nsfwQueue.push(resolve);
  });
}

function _releaseNsfwSlot() {
  _nsfwProcessingCount = Math.max(0, _nsfwProcessingCount - 1);
  if (_nsfwQueue.length) {
    _nsfwProcessingCount++;
    const r = _nsfwQueue.shift();
    try { r(true); } catch (e) { console.error('[NSFW] Error resolviendo cola:', e); }
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
  return message.viewOnceMessage?.message
    || message.viewOnceMessageV2?.message
    || message.viewOnceMessageV2Extension?.message
    || null;
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

  // Mensajes efímeros (nivel 1)
  const ephemeral = root?.ephemeralMessage?.message;
  push(ephemeral);
  push(getViewOnceContainer(ephemeral));

  // ephemeral nivel 2: viewOnce dentro de ephemeral
  const ephemeralVo1 = root?.ephemeralMessage?.message?.viewOnceMessage?.message;
  const ephemeralVo2 = root?.ephemeralMessage?.message?.viewOnceMessageV2?.message;
  const ephemeralVo3 = root?.ephemeralMessage?.message?.viewOnceMessageV2Extension?.message;
  push(ephemeralVo1);
  push(ephemeralVo2);
  push(ephemeralVo3);

  // Mensaje citado (quoted)
  const quoted = root?.extendedTextMessage?.contextInfo?.quotedMessage
    || root?.imageMessage?.contextInfo?.quotedMessage
    || root?.videoMessage?.contextInfo?.quotedMessage;
  push(quoted);
  push(getViewOnceContainer(quoted));

  console.log(`[NSFW] collectMediaEntries: ${entries.length} entrada(s). root keys: [${Object.keys(root || {}).join(', ')}]`);
  return entries;
}

async function detectGorePixelSignal(imageBuffer) {
  if (!sharp) return { blocked: false, score: 0, bloodRatio: 0, edgeDensity: 0 };

  try {
    const { data, info } = await sharp(imageBuffer, { animated: false })
      .resize(128, 128, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    if (!pixels) return { blocked: false, score: 0, bloodRatio: 0, edgeDensity: 0 };

    const gray = new Uint8Array(pixels);
    let blood = 0;
    let edges = 0;

    for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;

      const brightBlood = r > 95 && g < 115 && b < 115 && r > g * 1.55 && r > b * 1.45 && (r - g) > 45 && (r - b) > 45;
      const darkBlood = r > 55 && r < 175 && g < 70 && b < 75 && r > g * 1.65 && r > b * 1.45;
      if (brightBlood || darkBlood) blood++;
    }

    for (let y = 1; y < info.height; y++) {
      for (let x = 1; x < info.width; x++) {
        const idx = y * info.width + x;
        const gx = Math.abs(gray[idx] - gray[idx - 1]);
        const gy = Math.abs(gray[idx] - gray[idx - info.width]);
        if (gx + gy > 85) edges++;
      }
    }

    const bloodRatio = blood / pixels;
    const edgeDensity = edges / pixels;
    const score = Math.min(0.99, Math.max(bloodRatio * 2.4, bloodRatio + edgeDensity));
    const blocked = bloodRatio > 0.36 || (bloodRatio > 0.25 && edgeDensity > 0.08);

    if (blocked) {
      console.warn(`[NSFW] Anti-gore pixel: blood=${bloodRatio.toFixed(3)} edge=${edgeDensity.toFixed(3)}`);
    }

    return { blocked, score, bloodRatio, edgeDensity };
  } catch (err) {
    console.warn('[NSFW] Anti-gore pixel error:', err.message || err);
    return { blocked: false, score: 0, bloodRatio: 0, edgeDensity: 0 };
  }
}

async function processImageEntry(entry, context, entryIndex) {
  const { sock, groupId, userId, isAdmin, deleteKey } = context;

  const slot = await _acquireNsfwSlot();
  if (!slot) {
    console.warn(`[NSFW] Cola saturada (${_nsfwQueue.length}/${NSFW_MAX_QUEUE}); imagen omitida para proteger el bot.`);
    return;
  }
  try {
    console.log(`[NSFW] (${entryIndex}/${context.totalEntries}) Analizando imagen (${entry.mediaMessage.mimetype || 'desconocido'})...`);

    const buffer = await downloadMediaMessage(entry.fullMessage, 'buffer', {}, sock);
    if (!buffer) {
      console.log('[NSFW] No se pudo descargar la imagen a procesar.');
      return;
    }

    const safety = await analyzeImageBufferForSafety(buffer);
    if (!safety?.predictions?.length) return;

    const { predictions, topLabel, topScore } = safety;
    const isNSFW = !safety.allowed;
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
      console.log(`[NSFW] ✅ Imagen segura (${topLabel}: ${(topScore * 100).toFixed(1)}%). Sin acción.`);
      const now = Date.now();
      const lastSafe = _safeNoticeTimestamps.get(userId) || 0;
      if (now - lastSafe >= SAFE_NOTICE_COOLDOWN_MS) {
        _safeNoticeTimestamps.set(userId, now);
        try {
          const scoreLines = predictions
            .slice(0, 5)
            .map(p => {
              const pct = (p.score * 100).toFixed(1);
              const bar = '█'.repeat(Math.round(p.score * 10)) + '░'.repeat(10 - Math.round(p.score * 10));
              return `  ${bar} ${pct}% — ${mapFriendlyLabel(p.label)}`;
            })
            .join('\n');

          const safeText =
            `💀 *[CERBERO-BOT* — *IMAGEN VERIFICADA]*\n` +
            `▶ src: @${userId.split('@')[0]}\n` +
            `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n` +
            `${scoreLines}\n` +
            `▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n` +
            `✅ STATUS: *CLEAN* — conf: ${(topScore * 100).toFixed(1)}%\n` +
            `🔒 MOTOR : ·0xEY3 v1.0 — [CLASSIFIED]`;

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
 * Clasifica una imagen y devuelve una decision reutilizable por otros modulos.
 * No borra mensajes ni expulsa usuarios: solo responde si la imagen es segura.
 */
export async function analyzeImageBufferForSafety(imageBuffer) {
  const [predictions, goreSignal] = await Promise.all([
    classifyImage(imageBuffer),
    detectGorePixelSignal(imageBuffer),
  ]);
  if (!predictions?.length) {
    return {
      allowed: false,
      reason: 'unclassified',
      friendlyLabel: 'No clasificada',
      topLabel: 'unknown',
      topScore: 0,
      predictions: [],
    };
  }

  const topPrediction = predictions[0];
  const topLabel = topPrediction.label;
  const topScore = topPrediction.score;
  const goreLike = goreSignal.blocked || /gore|blood|bloody|violence|violent|corpse|injur/i.test(topLabel);
  const blocked = isNSFWPrediction(topLabel, topScore) || goreLike;
  const finalPredictions = goreSignal.blocked
    ? [{ label: 'gore', score: goreSignal.score }, ...predictions]
    : predictions;

  return {
    allowed: !blocked,
    reason: goreLike ? 'gore' : blocked ? 'nsfw' : 'safe',
    friendlyLabel: goreSignal.blocked ? 'gore/violencia grafica' : mapFriendlyLabel(topLabel),
    topLabel: goreSignal.blocked ? 'gore' : topLabel,
    topScore: goreSignal.blocked ? goreSignal.score : topScore,
    predictions: finalPredictions,
    goreSignal,
  };
}

/**
 * Entrada publica del motor NSFW compartido.
 * Otros modulos deben usar esta funcion para reutilizar la misma cola,
 * modelos en memoria, daemon Python y limites de concurrencia del anti-NSFW.
 */
export async function scanImageBufferWithNsfwEngine(imageBuffer, source = 'modulo') {
  const slot = await _acquireNsfwSlot();
  if (!slot) {
    throw new Error(`motor NSFW saturado (${_nsfwQueue.length}/${NSFW_MAX_QUEUE})`);
  }
  try {
    console.log(`[NSFW] Motor compartido: analizando ${source}. cola=${_nsfwQueue.length}/${NSFW_MAX_QUEUE} activos=${_nsfwProcessingCount}/${NSFW_MAX_CONCURRENCY}`);
    return await analyzeImageBufferForSafety(imageBuffer);
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
