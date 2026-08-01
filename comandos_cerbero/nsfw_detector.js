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

const GORE_SAFE_OVERRIDE_SCORE = Number(process.env.GORE_SAFE_OVERRIDE_SCORE || 0.90);
const GORE_MODEL_CONFIRM_SCORE = Number(process.env.GORE_MODEL_CONFIRM_SCORE || 0.45);

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
const NSFW_HARD_MAX_QUEUE = Number(process.env.NSFW_HARD_MAX_QUEUE || 120);
const NSFW_DEBUG = /^(1|true|yes|on)$/i.test(process.env.NSFW_DEBUG || '');
const NSFW_SAFE_BATCH_NOTICE_ENABLED = !/^(0|false|no|off)$/i.test(process.env.NSFW_SAFE_BATCH_NOTICE_ENABLED || '1');
const NSFW_SAFE_BATCH_WINDOW_MS = Number(process.env.NSFW_SAFE_BATCH_WINDOW_MS || 30_000);
const _nsfwQueue = [];
const OVERLAY_COOLDOWN_MS = 30 * 1000;
const _overlayTimestamps = new Map();
const _safeBatchByGroup = new Map();

function nsfwDebugLog(...args) {
  if (NSFW_DEBUG) {
    console.log(...args);
  }
}

function queueSafeBatchNotice(sock, groupId) {
  if (!NSFW_SAFE_BATCH_NOTICE_ENABLED || !groupId) return;

  let batch = _safeBatchByGroup.get(groupId);
  if (!batch) {
    batch = { count: 0, timer: null };
    _safeBatchByGroup.set(groupId, batch);
  }

  batch.count += 1;
  if (batch.timer) return;

  batch.timer = setTimeout(async () => {
    const snapshot = _safeBatchByGroup.get(groupId);
    if (!snapshot) return;
    _safeBatchByGroup.delete(groupId);

    const text = `🛡️ Anti-NSFW: ${snapshot.count} imagen(es) seguras verificadas en cola.`;
    try {
      await sock.sendMessage(groupId, { text });
    } catch (err) {
      console.error('[NSFW] Error enviando resumen SAFE:', err.message || err);
    }
  }, NSFW_SAFE_BATCH_WINDOW_MS);

  if (typeof batch.timer?.unref === 'function') {
    batch.timer.unref();
  }
}

function _acquireNsfwSlot() {
  return new Promise((resolve) => {
    if (_nsfwProcessingCount < NSFW_MAX_CONCURRENCY) {
      _nsfwProcessingCount++;
      return resolve(true);
    }
    if (_nsfwQueue.length >= NSFW_HARD_MAX_QUEUE) return resolve(false);
    if (_nsfwQueue.length >= NSFW_MAX_QUEUE) {
      nsfwDebugLog(`[NSFW] Cola por encima del objetivo (${_nsfwQueue.length}/${NSFW_MAX_QUEUE}), en espera.`);
    }
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

  nsfwDebugLog(`[NSFW] collectMediaEntries: ${entries.length} entrada(s). root keys: [${Object.keys(root || {}).join(', ')}]`);
  return entries;
}

async function detectGorePixelSignal(imageBuffer) {
  if (!sharp) return { blocked: false, score: 0, bloodRatio: 0, edgeDensity: 0 };

  try {
    const { data, info } = await sharp(imageBuffer, { animated: false })
      .resize(96, 96, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    if (!pixels) return { blocked: false, score: 0, bloodRatio: 0, edgeDensity: 0 };

    const gray = new Uint8Array(pixels);
    let blood = 0;
    let edges = 0;
    let darkPixels = 0;
    let redPixels = 0;
    let flatRedPixels = 0;

    for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;

      const brightBlood = r > 95 && g < 115 && b < 115 && r > g * 1.55 && r > b * 1.45 && (r - g) > 45 && (r - b) > 45;
      const darkBlood = r > 55 && r < 175 && g < 70 && b < 75 && r > g * 1.65 && r > b * 1.45;
      const isBloodLike = brightBlood || darkBlood;

      if (isBloodLike) blood++;
      if (r > 90 && g < 120 && b < 120) redPixels++;
      if (gray[p] < 55) darkPixels++;

      // Rojo plano (camisa/pared/pintura uniforme): baja probabilidad de gore.
      if (isBloodLike && p > 0 && Math.abs(gray[p] - gray[p - 1]) < 8) {
        flatRedPixels++;
      }
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
    const darkRatio = darkPixels / pixels;
    const redRatio = redPixels / pixels;
    const flatRedRatio = redPixels > 0 ? (flatRedPixels / redPixels) : 0;
    const traumaScore = (bloodRatio * 1.7) + (edgeDensity * 2.2) + (darkRatio * 0.7);
    const score = Math.min(0.99, traumaScore);

    // Bloquea solo si existe patrón de trauma visual, no solo rojo dominante.
    const hasStrongTraumaPattern =
      (bloodRatio > 0.24 && edgeDensity > 0.12) ||
      (bloodRatio > 0.32 && edgeDensity > 0.10 && darkRatio > 0.10) ||
      (score > 0.86 && edgeDensity > 0.11);

    const isLikelyFlatRedNoise = redRatio > 0.22 && flatRedRatio > 0.38 && edgeDensity < 0.11;
    const blocked = hasStrongTraumaPattern && !isLikelyFlatRedNoise;

    if (blocked) {
      console.warn(`[NSFW] Anti-gore pixel: blood=${bloodRatio.toFixed(3)} edge=${edgeDensity.toFixed(3)} dark=${darkRatio.toFixed(3)} score=${score.toFixed(3)}`);
    }

    return { blocked, score, bloodRatio, edgeDensity, darkRatio, redRatio, flatRedRatio };
  } catch (err) {
    console.warn('[NSFW] Anti-gore pixel error:', err.message || err);
    return { blocked: false, score: 0, bloodRatio: 0, edgeDensity: 0 };
  }
}

async function processImageEntry(entry, context, entryIndex) {
  const { sock, groupId, userId, isAdmin, deleteKey } = context;

  const slot = await _acquireNsfwSlot();
  if (!slot) {
    console.warn(`[NSFW] Cola saturada al limite duro (${_nsfwQueue.length}/${NSFW_HARD_MAX_QUEUE}); imagen omitida por seguridad de memoria.`);
    return;
  }
  try {
    nsfwDebugLog(`[NSFW] (${entryIndex}/${context.totalEntries}) Analizando imagen (${entry.mediaMessage.mimetype || 'desconocido'})...`);

    const buffer = await downloadMediaMessage(entry.fullMessage, 'buffer', {}, sock);
    if (!buffer) {
      nsfwDebugLog('[NSFW] No se pudo descargar la imagen a procesar.');
      return;
    }

    const safety = await analyzeImageBufferForSafety(buffer);
    if (!safety?.predictions?.length) return;

    const { predictions, topLabel, topScore } = safety;
    const isNSFW = !safety.allowed;
    const entrySignature = getMediaSignature(entry.mediaMessage);
    if (isNSFW && context.alertedSignatures.has(entrySignature)) {
      nsfwDebugLog(`[NSFW] Aviso repetido omitido para ${entrySignature}`);
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

      if (!isAdmin) {
        try {
          await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
        } catch (kickErr) {
          console.error('[NSFW] Error expulsando usuario:', kickErr.message || kickErr);
        }
      }

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
            nsfwDebugLog('[NSFW] Overlay limitado, enviando solo texto en lugar de imagen.');
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

      console.log(`[NSFW] Imagen NSFW (${topLabel}) procesada (${isAdmin ? 'admin, sin expulsión' : 'usuario expulsado'}).`);
    } else {
      nsfwDebugLog(`[NSFW] ✅ Imagen segura (${topLabel}: ${(topScore * 100).toFixed(1)}%). Sin acción.`);
      queueSafeBatchNotice(sock, groupId);
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
  const normalizedTop = (topLabel || '').toLowerCase();
  const safeLabels = new Set(['neutral', 'drawing', 'safe', 'sfw_fallback']);
  const strongSafeByModel = safeLabels.has(normalizedTop) && topScore >= GORE_SAFE_OVERRIDE_SCORE;
  const modelNsfwEvidence = predictions.some((p) => {
    const label = (p?.label || '').toLowerCase();
    if (!label || safeLabels.has(label)) return false;
    return (p?.score || 0) >= GORE_MODEL_CONFIRM_SCORE;
  });

  // Compuerta híbrida JS + ML/Python:
  // no bloquea por rojo aislado si el consenso ML indica imagen claramente segura.
  const goreLike =
    /gore|blood|bloody|violence|violent|corpse|injur/i.test(normalizedTop) ||
    (goreSignal.blocked && (modelNsfwEvidence || !strongSafeByModel));

  if (goreSignal.blocked && strongSafeByModel && !modelNsfwEvidence) {
    console.log(`[NSFW] Gore JS suprimido por consenso ML seguro (${normalizedTop}:${(topScore * 100).toFixed(1)}%).`);
  }

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
    throw new Error(`motor NSFW saturado (${_nsfwQueue.length}/${NSFW_HARD_MAX_QUEUE})`);
  }
  try {
    nsfwDebugLog(`[NSFW] Motor compartido: analizando ${source}. cola=${_nsfwQueue.length}/${NSFW_MAX_QUEUE} activos=${_nsfwProcessingCount}/${NSFW_MAX_CONCURRENCY}`);
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
  nsfwDebugLog('[NSFW] detectNSFW function called');
  if (!groupMetadata) {
    nsfwDebugLog('[NSFW] No groupMetadata, skipping');
    return; // Solo en grupos
  }

  const containsSticker = !!msg.message?.stickerMessage || !!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
  if (containsSticker) {
    nsfwDebugLog('[NSFW] Mensaje o citado contiene sticker, omitiendo detector NSFW.');
    return;
  }

  const groupId = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;

  nsfwDebugLog(`[NSFW] Funcion detectNSFW llamada para mensaje en ${groupId}`);

  const entries = collectMediaEntries(msg);
  if (!entries.length) {
    nsfwDebugLog('[NSFW] El mensaje no contiene imagenes que se puedan procesar.');
    return;
  }

  nsfwDebugLog(`[NSFW] Se encontraron ${entries.length} imagen(es) para analizar de ${userId}.`);

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
