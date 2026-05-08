import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { scanImageBufferWithNsfwEngine } from './nsfw_detector.js';
import { detectQrBuffer } from './qrkill.js';

const CONFIG_PATH = path.resolve(process.cwd(), 'comandos_cerbero', 'presentaciones_config.json');
const TEMP_DIR = path.resolve(os.tmpdir(), 'cerbero_presentaciones');
const POLL_OPTIONS = ['le doy', 'no le doy', 'que asco'];
const IS_ARM_RUNTIME = process.arch === 'arm' || process.arch === 'arm64';
const FORCE_NATIVE_ANALYSIS = /^(1|true|yes|on)$/i.test(process.env.PRESENTACIONES_FORCE_NATIVE || '');
const ARM_SAFE_MODE = /^(1|true|yes|on)$/i.test(process.env.PRESENTACIONES_ARM_SAFE_MODE || '') || (IS_ARM_RUNTIME && !FORCE_NATIVE_ANALYSIS);
const NSFW_ANALYSIS_TIMEOUT_MS = Number(process.env.PRESENTACIONES_NSFW_TIMEOUT_MS || 60_000);
const CLIP_ANALYSIS_TIMEOUT_MS = Number(process.env.PRESENTACIONES_CLIP_TIMEOUT_MS || 45_000);
const CLIP_ENABLED = /^(1|true|yes|on)$/i.test(process.env.PRESENTACIONES_CLIP || '') && !ARM_SAFE_MODE;
const MAX_IMAGE_BYTES = Number(process.env.PRESENTACIONES_MAX_IMAGE_BYTES || (ARM_SAFE_MODE ? 6 : 14) * 1024 * 1024);

let sharp = null;
if (!ARM_SAFE_MODE) {
  try {
    sharp = (await import('sharp')).default;
  } catch (err) {
    console.warn('[PRESENTACION] sharp no disponible para anti-meme:', err.message?.slice(0, 80));
  }
} else {
  console.warn('[PRESENTACION] Modo seguro ARM activo: sin sharp/CLIP local en presentaciones.');
}

let clipModelPromise = null;
let presentationQueue = Promise.resolve();

const ACCEPT_LABELS = [
  'a casual selfie photo of a real person',
  'a portrait photo of a real person',
  'a mirror selfie of a real person',
  'a full body photo of a real person',
  'a group photo of real people',
  'a person posing for a profile picture',
];

const REJECT_LABELS = [
  'a funny internet meme with text',
  'a screenshot of a chat conversation',
  'a screenshot of a social media post',
  'a cartoon drawing or illustration',
  'an anime cartoon character',
  'a sticker or emoji image',
  'a logo or graphic design',
  'a video game screenshot',
  'a landscape photo with no person',
  'a pet or animal photo',
  'a food photo',
  'a photo of an object with no person',
  'a poster advertisement',
  'a text document or quote image',
  'an AI generated artwork',
  'a bloody gore or violent injury image',
];

const VISUAL_LABELS = [...ACCEPT_LABELS, ...REJECT_LABELS];
const ACCEPT_SET = new Set(ACCEPT_LABELS);
const REJECT_SET = new Set(REJECT_LABELS);

function loadConfig() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!parsed.enabled_groups) parsed.enabled_groups = {};
    return parsed;
  } catch (_) {
    return { enabled_groups: {} };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function normalizeNumber(jid = '') {
  return jid.toString().split('@')[0].split(':')[0].replace(/\D/g, '');
}

function getTextFromMessage(msg) {
  return msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    '';
}

function getViewOnceContainer(message) {
  return message?.viewOnceMessage?.message
    || message?.viewOnceMessageV2?.message
    || message?.viewOnceMessageV2Extension?.message
    || null;
}

function getPrivateImageContainer(msg) {
  const root = msg.message || {};
  const candidates = [
    root,
    getViewOnceContainer(root),
    root.ephemeralMessage?.message,
    getViewOnceContainer(root.ephemeralMessage?.message),
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.imageMessage) return candidate;
    if (candidate.documentMessage?.mimetype?.startsWith('image/')) return candidate;
  }
  return null;
}

function getMediaInfoFromContainer(container) {
  if (container?.imageMessage) {
    return { kind: 'image', mediaMessage: container.imageMessage };
  }
  if (container?.documentMessage?.mimetype?.startsWith('image/')) {
    return { kind: 'document', mediaMessage: container.documentMessage };
  }
  return { kind: 'unknown', mediaMessage: null };
}

function buildMediaMessage(msg, container) {
  return { key: msg.key, message: container };
}

function numberFromWaValue(value) {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value?.toNumber === 'function') {
    const n = value.toNumber();
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value?.low === 'number') return value.low;
  return 0;
}

function analyzeMediaMetadata(mediaInfo, bufferLength = 0) {
  const mediaMessage = mediaInfo?.mediaMessage || {};
  const mimetype = (mediaMessage.mimetype || '').toLowerCase();
  const width = Number(mediaMessage.width || 0);
  const height = Number(mediaMessage.height || 0);
  const bytes = numberFromWaValue(mediaMessage.fileLength || mediaMessage.length) || bufferLength;
  const format = mimetype.split('/')[1] || 'unknown';
  const flags = [];

  if (bytes > MAX_IMAGE_BYTES) flags.push(`imagen demasiado pesada (${(bytes / 1024 / 1024).toFixed(1)}MB)`);
  if (ARM_SAFE_MODE && mediaInfo?.kind === 'document') flags.push('imagen enviada como documento');
  if (mimetype === 'image/webp' && bytes < 180 * 1024) flags.push('sticker o meme webp');

  if (width && height) {
    if (width < 260 || height < 260) flags.push('imagen muy pequena');
    const ratio = Math.max(width / height, height / width);
    if (ratio > 2.4) flags.push('formato raro/captura');
  }

  return {
    width,
    height,
    format,
    bytes,
    skinRatio: 0,
    edgeDensity: 0,
    bloodRatio: 0,
    flags,
  };
}

function precheckPresentationMedia(mediaInfo) {
  const layout = analyzeMediaMetadata(mediaInfo);
  const hardBlock = layout.flags.some(flag => (
    flag.includes('demasiado pesada') ||
    flag.includes('documento') ||
    flag.includes('sticker') ||
    flag.includes('pequena') ||
    flag.includes('captura')
  ));
  return { allowed: !hardBlock, layout };
}

function enqueuePresentation(task) {
  const run = presentationQueue.catch(() => {}).then(task);
  presentationQueue = run.catch(() => {});
  return run;
}

async function findActiveGroupsForSender(sock, senderJid) {
  const config = loadConfig();
  const activeGroupIds = Object.entries(config.enabled_groups || {})
    .filter(([, value]) => value?.activo)
    .map(([groupId]) => groupId);

  if (!activeGroupIds.length) return [];

  const senderNumber = normalizeNumber(senderJid);
  const matches = [];

  for (const groupId of activeGroupIds) {
    try {
      const meta = await sock.groupMetadata(groupId);
      let mentionJid = senderJid;
      const isMember = (meta.participants || []).some(participant => {
        const ids = [
          participant.id,
          participant.phoneNumber,
          participant.lid,
        ].filter(Boolean);
        const matched = ids.some(id => normalizeNumber(id) === senderNumber);
        if (matched) mentionJid = participant.id || senderJid;
        return matched;
      });

      if (isMember) matches.push({ groupId, meta, mentionJid });
    } catch (err) {
      console.error(`[PRESENTACION] No se pudo leer metadata de ${groupId}:`, err.message || err);
    }
  }

  return matches;
}

function buildPresentationCaption(originalCaption, safety) {
  const intro = originalCaption?.trim()
    ? `\n\n"${originalCaption.trim().slice(0, 700)}"`
    : '';

  return (
    `📸 *PRESENTACION DE MIEMBRO*\n\n` +
    `🛡️ Filtro K3RB-0xEY3: *CLEAN* (${(safety.topScore * 100).toFixed(1)}% ${safety.friendlyLabel})` +
    intro +
    `\n\n_Bot recibido por privado y publicado en la dinamica activa._`
  );
}

function withTimeout(promise, ms, label) {
  let timer = null;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function loadClipModel() {
  if (!CLIP_ENABLED) {
    throw new Error(ARM_SAFE_MODE
      ? 'CLIP desactivado por modo seguro ARM. Usa PRESENTACIONES_FORCE_NATIVE=1 para probarlo.'
      : 'CLIP desactivado. Usa PRESENTACIONES_CLIP=1 para activarlo.');
  }
  if (!clipModelPromise) {
    clipModelPromise = import('@xenova/transformers')
      .then(({ pipeline, env: xenovaEnv }) => {
        xenovaEnv.cacheDir = path.resolve(process.cwd(), 'models_cache');
        xenovaEnv.allowLocalModels = true;
        xenovaEnv.allowRemoteModels = true;
        xenovaEnv.backends = { onnx: { wasm: { numThreads: 1 } } };
        return pipeline('zero-shot-image-classification', 'Xenova/clip-vit-base-patch32');
      })
      .catch(err => {
        clipModelPromise = null;
        throw err;
      });
  }
  return clipModelPromise;
}

async function analyzeImageLayout(buffer, mediaInfo = null) {
  const fallback = {
    width: 0,
    height: 0,
    format: 'unknown',
    skinRatio: 0,
    edgeDensity: 0,
    bloodRatio: 0,
    flags: [],
  };

  if (ARM_SAFE_MODE || !sharp) return mediaInfo ? analyzeMediaMetadata(mediaInfo, buffer?.length || 0) : fallback;

  try {
    const image = sharp(buffer, { animated: false });
    const meta = await image.metadata();
    const metadataLayout = analyzeMediaMetadata(mediaInfo, buffer?.length || 0);
    const flags = [...metadataLayout.flags];
    const width = meta.width || 0;
    const height = meta.height || 0;
    const format = meta.format || 'unknown';

    if (width && height) {
      if (width < 260 || height < 260) flags.push('imagen muy pequena');
      const ratio = Math.max(width / height, height / width);
      if (ratio > 2.4) flags.push('formato raro/captura');
    }
    if (format === 'webp' && width <= 512 && height <= 512 && buffer.length < 160 * 1024) {
      flags.push('sticker o meme webp');
    }

    const { data, info } = await sharp(buffer, { animated: false })
      .resize(160, 160, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let skin = 0;
    let blood = 0;
    let edges = 0;
    const pixels = info.width * info.height;
    const gray = new Uint8Array(pixels);

    for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
      const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;
      gray[p] = y;
      if (y > 55 && cb >= 80 && cb <= 145 && cr >= 125 && cr <= 190) skin++;
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

    const skinRatio = pixels ? skin / pixels : 0;
    const edgeDensity = pixels ? edges / pixels : 0;
    const bloodRatio = pixels ? blood / pixels : 0;
    if (edgeDensity > 0.28 && skinRatio < 0.06) flags.push('mucho texto/bordes tipo meme');
    if (bloodRatio > 0.34 || (bloodRatio > 0.24 && edgeDensity > 0.08)) {
      flags.push('posible gore/sangre');
    }

    return { width, height, format, skinRatio, edgeDensity, bloodRatio, flags };
  } catch (err) {
    console.error('[PRESENTACION] Error en analisis anti-meme:', err.message || err);
    return fallback;
  }
}

async function recognizePresentationImage(buffer) {
  const tmpPath = path.join(TEMP_DIR, `presentacion_${Date.now()}_${randomUUID()}.jpg`);
  try {
    await fs.promises.mkdir(TEMP_DIR, { recursive: true });
    const imageForClip = sharp
      ? await sharp(buffer, { animated: false }).jpeg({ quality: 90 }).toBuffer().catch(() => buffer)
      : buffer;
    await fs.promises.writeFile(tmpPath, imageForClip);
    const model = await loadClipModel();
    const predictions = await model(tmpPath, VISUAL_LABELS);
    return [...predictions].sort((a, b) => b.score - a.score);
  } finally {
    fs.promises.unlink(tmpPath).catch(() => {});
  }
}

function summarizeTopPredictions(predictions = []) {
  return predictions
    .slice(0, 3)
    .map(p => `${p.label} ${(p.score * 100).toFixed(1)}%`)
    .join(' | ');
}

async function analyzePresentationRelevance(buffer, mediaInfo) {
  const layout = await analyzeImageLayout(buffer, mediaInfo);
  let predictions = [];
  let recognitionError = null;

  if (CLIP_ENABLED) {
    try {
      predictions = await withTimeout(
        recognizePresentationImage(buffer),
        CLIP_ANALYSIS_TIMEOUT_MS,
        'CLIP presentaciones'
      );
    } catch (err) {
      recognitionError = err;
      console.error('[PRESENTACION] CLIP no disponible para reconocimiento:', err.message || err);
    }
  } else {
    recognitionError = new Error('clip_disabled');
    console.log('[PRESENTACION] CLIP anti-meme desactivado; usando heuristicas ligeras.');
  }

  const bestAccept = predictions
    .filter(p => ACCEPT_SET.has(p.label))
    .sort((a, b) => b.score - a.score)[0] || null;
  const bestReject = predictions
    .filter(p => REJECT_SET.has(p.label))
    .sort((a, b) => b.score - a.score)[0] || null;
  const top = predictions[0] || null;

  const reasons = [...layout.flags];
  if (bestReject && (!bestAccept || bestReject.score >= bestAccept.score * 1.08) && bestReject.score >= 0.16) {
    reasons.push(`parece ${bestReject.label}`);
  }
  if (top && REJECT_SET.has(top.label) && (!bestAccept || top.score >= bestAccept.score * 1.15) && top.score >= 0.20) {
    reasons.push(`clasificacion principal: ${top.label}`);
  }
  if (!recognitionError && bestAccept && bestReject && bestAccept.score < 0.13 && bestReject.score > bestAccept.score) {
    reasons.push('no parece una foto real de presentacion');
  }

  const hardLayoutBlock = layout.flags.some(flag => (
    flag.includes('sticker') ||
    flag.includes('meme') ||
    flag.includes('captura') ||
    flag.includes('pequena') ||
    flag.includes('gore') ||
    flag.includes('sangre')
  ));
  const modelBlock = reasons.some(reason => (
    reason.includes('parece') ||
    reason.includes('clasificacion principal') ||
    reason.includes('no parece')
  ));

  return {
    allowed: !(hardLayoutBlock || modelBlock),
    reasons,
    layout,
    predictions,
    recognitionError,
    bestAccept,
    bestReject,
  };
}

async function analyzePresentationSafety(sock, senderJid, buffer) {
  try {
    return await withTimeout(
      scanImageBufferWithNsfwEngine(buffer, `presentacion privada ${senderJid}`),
      NSFW_ANALYSIS_TIMEOUT_MS,
      'anti-NSFW presentaciones'
    );
  } catch (err) {
    console.error('[PRESENTACION] Error/timeout en anti-NSFW:', err.message || err);
    await sock.sendMessage(senderJid, {
      text:
        `⚠️ No pude completar el analisis de seguridad de la imagen.\n` +
        `Intenta enviarla otra vez como foto normal.`
    }).catch(() => {});
    return null;
  }
}

/**
 * Valida que una imagen de presentación no contenga códigos QR (WhatsApp, Instagram, etc).
 * Reutiliza el motor detectQrBuffer existente del bot sin duplicar código.
 * @returns {Object} { hasQr: boolean, type?: string }
 */
async function validatePresentationAntiQr(buffer, imageMessage = null) {
  try {
    // Usar el detector QR existente que reutiliza el motor global
    const qrDetection = await detectQrBuffer(buffer, imageMessage);
    
    return {
      hasQr: qrDetection.isQR,
      type: qrDetection.isQR ? 'whatsapp_qr' : null,
      cached: qrDetection.cached || false,
    };
  } catch (err) {
    console.error('[PRESENTACION] Error en validación anti-QR:', err.message || err);
    // En caso de error en QR, permitir (no bloquear)
    return { hasQr: false };
  }
}

async function sendPresentationPoll(sock, groupId, quotedMsg) {
  const pollMessage = {
    poll: {
      name: 'que opinas',
      values: POLL_OPTIONS,
      selectableCount: 1,
    },
  };

  try {
    await sock.sendMessage(groupId, pollMessage, quotedMsg ? { quoted: quotedMsg } : undefined);
  } catch (err) {
    console.error(`[PRESENTACION] Error enviando encuesta en ${groupId}:`, err.message || err);
    await sock.sendMessage(groupId, {
      text:
        `📊 *Encuesta de presentacion*\n\n` +
        `${POLL_OPTIONS.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`,
    });
  }
}

export async function manejarDMPresentacion(sock, senderJid, msg) {
  const imageContainer = getPrivateImageContainer(msg);
  const text = getTextFromMessage(msg).trim();

  if (!imageContainer) {
    if (/presentaci[oó]n|presentarme|me\s+presento/i.test(text)) {
      await sock.sendMessage(senderJid, {
        text:
          `📸 Para presentarte, enviame una foto por privado.\n\n` +
          `Si hay una dinamica de *presentaciones* activa en tu grupo, la reviso con anti-NSFW y la publico alla.`,
      });
      return true;
    }
    return false;
  }

  return enqueuePresentation(() => manejarDMPresentacionImagen(sock, senderJid, msg, imageContainer, text));
}

async function manejarDMPresentacionImagen(sock, senderJid, msg, imageContainer, text) {
  const destinations = await findActiveGroupsForSender(sock, senderJid);
  if (!destinations.length) {
    await sock.sendMessage(senderJid, {
      text:
        `⚠️ No encontre una dinamica de *presentaciones* activa en algun grupo donde estes.\n` +
        `Pidele a un admin que use *!presentaciones activar* en el grupo.`,
    });
    return true;
  }

  const mediaInfo = getMediaInfoFromContainer(imageContainer);
  const mediaPrecheck = precheckPresentationMedia(mediaInfo);
  if (!mediaPrecheck.allowed) {
    const why = mediaPrecheck.layout.flags.slice(0, 3).join(', ') || 'formato no apto';
    await sock.sendMessage(senderJid, {
      text:
        `🚫 No pude aceptar esa imagen para presentacion.\n` +
        `▸ Motivo: ${why}\n\n` +
        `Envia una foto normal, no como documento/sticker, y que no sea demasiado pesada.`
    }).catch(() => {});
    console.log(`[PRESENTACION] Precheck bloqueado ${senderJid}: ${why}`);
    return true;
  }

  let buffer;
  try {
    buffer = await downloadMediaMessage(buildMediaMessage(msg, imageContainer), 'buffer', {}, sock);
  } catch (err) {
    console.error('[PRESENTACION] Error descargando imagen privada:', err.message || err);
  }

  if (!buffer) {
    await sock.sendMessage(senderJid, {
      text: `❌ No pude descargar la imagen. Intenta enviarla de nuevo como foto normal.`,
    });
    return true;
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    await sock.sendMessage(senderJid, {
      text:
        `🚫 La imagen pesa demasiado (${(buffer.length / 1024 / 1024).toFixed(1)}MB).\n` +
        `Envia una foto normal mas liviana para evitar caidas en ARM.`
    }).catch(() => {});
    return true;
  }

  // ── Validación Anti-QR (reutiliza detectQrBuffer del bot) ──────────────────
  // Detecta QR de WhatsApp, Instagram y otros intentos de promoción
  const qrValidation = await validatePresentationAntiQr(buffer, imageContainer?.imageMessage);
  if (qrValidation.hasQr) {
    await sock.sendMessage(senderJid, {
      text:
        `🚫 No publique esa imagen porque contiene un código QR.\n` +
        `La dinamica de presentaciones no permite promociones de grupos o redes sociales.\n\n` +
        `Envia una foto tuya sin QR.`
    }).catch(() => {});
    console.log(`[PRESENTACION] Bloqueado QR de ${senderJid}: tipo=${qrValidation.type}`);
    return true;
  }

  await sock.sendMessage(senderJid, {
    text: '📸 Foto recibida. Analizando seguridad antes de publicarla...'
  }).catch(() => {});

  const safety = await analyzePresentationSafety(sock, senderJid, buffer);
  if (!safety) return true;

  if (!safety.allowed) {
    await sock.sendMessage(senderJid, {
      text:
        `🚫 Tu foto no se publico porque el filtro anti-NSFW la marco como no segura.\n` +
        `▸ Motivo: ${safety.friendlyLabel} (${(safety.topScore * 100).toFixed(1)}%)`,
    });
    console.log(`[PRESENTACION] Imagen bloqueada de ${senderJid}: ${safety.topLabel} ${(safety.topScore * 100).toFixed(1)}%`);
    return true;
  }

  const relevance = await analyzePresentationRelevance(buffer, mediaInfo);
  if (!relevance.allowed) {
    const why = relevance.reasons.length
      ? relevance.reasons.slice(0, 3).join(', ')
      : 'no parece una foto real de presentacion';
    await sock.sendMessage(senderJid, {
      text:
        `🚫 No publique esa imagen porque parece meme, captura, sticker, gore o algo ajeno a la presentacion.\n` +
        `▸ Motivo: ${why}\n\n` +
        `Manda una foto real donde se vea una persona.`
    });
    console.log(`[PRESENTACION] Imagen irrelevante de ${senderJid}: ${why}. CLIP=${summarizeTopPredictions(relevance.predictions) || 'sin datos'}`);
    return true;
  }

  const caption = buildPresentationCaption(text, safety);
  let published = 0;

  for (const { groupId } of destinations) {
    try {
      const sentImage = await sock.sendMessage(groupId, {
        image: buffer,
        caption,
      });
      await sendPresentationPoll(sock, groupId, sentImage);
      published++;
    } catch (err) {
      console.error(`[PRESENTACION] Error publicando en ${groupId}:`, err.message || err);
    }
  }

  if (published > 0) {
    await sock.sendMessage(senderJid, {
      text: `✅ Presentacion publicada en ${published} grupo(s).`,
    });
  } else {
    await sock.sendMessage(senderJid, {
      text: `❌ La foto paso el filtro, pero no pude publicarla en el grupo. Revisa si el bot tiene permisos.`,
    });
  }

  return true;
}

export async function manejarComandoPresentacion(sock, chatId, senderJid, isAdmin, args) {
  if (!chatId.endsWith('@g.us')) {
    await sock.sendMessage(chatId, { text: 'Este comando debe usarse dentro de un grupo.' });
    return;
  }

  if (!isAdmin) {
    await sock.sendMessage(chatId, { text: '⛔ Solo administradores pueden configurar las presentaciones.' });
    return;
  }

  const sub = (args[0] || '').toLowerCase();
  const config = loadConfig();
  if (!config.enabled_groups) config.enabled_groups = {};

  if (['activar', 'abrir', 'grupo', 'on'].includes(sub)) {
    config.enabled_groups[chatId] = {
      activo: true,
      updatedAt: Date.now(),
      updatedBy: senderJid,
    };
    saveConfig(config);
    await sock.sendMessage(chatId, {
      text:
        `✅ *Presentaciones activadas* en este grupo.\n\n` +
        `Los miembros pueden enviar su foto al privado del bot. CERBERO la revisa con anti-NSFW, aplica anti-meme y la publica aqui con encuesta si esta limpia.`,
    });
    return;
  }

  if (['desactivar', 'cerrar', 'off'].includes(sub)) {
    if (!config.enabled_groups[chatId]) config.enabled_groups[chatId] = {};
    config.enabled_groups[chatId].activo = false;
    config.enabled_groups[chatId].updatedAt = Date.now();
    config.enabled_groups[chatId].updatedBy = senderJid;
    saveConfig(config);
    await sock.sendMessage(chatId, { text: '🔒 Presentaciones desactivadas en este grupo.' });
    return;
  }

  if (['estado', 'info'].includes(sub)) {
    const active = config.enabled_groups?.[chatId]?.activo === true;
    await sock.sendMessage(chatId, {
      text:
        `📸 *Estado de presentaciones*\n\n` +
        `▸ Grupo : ${chatId}\n` +
        `▸ Estado: ${active ? '✅ ACTIVO' : '🔒 CERRADO'}`,
    });
    return;
  }

  await sock.sendMessage(chatId, {
    text:
      `📸 *PRESENTACIONES — comandos admin:*\n\n` +
      `!presentaciones activar    → abrir dinamica en este grupo\n` +
      `!presentaciones desactivar → cerrar dinamica\n` +
      `!presentaciones estado     → ver estado\n\n` +
      `Los miembros se presentan enviando una foto al privado del bot. Se publica con encuesta.`,
  });
}
