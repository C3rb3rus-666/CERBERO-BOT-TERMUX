import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { scanImageBufferWithNsfwEngine } from './nsfw_detector.js';
import { detectQrBuffer } from './qrkill.js';

const TEMP_DIR = path.resolve(os.tmpdir(), 'cerbero_presentaciones');
const DYNAMICS = {
  presentaciones: {
    key: 'presentaciones',
    label: 'presentaciones',
    configPath: path.resolve(process.cwd(), 'comandos_cerbero', 'presentaciones_config.json'),
    pollTitle: 'que opinas',
    pollOptions: ['le doy', 'no le doy', 'que asco'],
    captionTitle: '📸 *PRESENTACION DE MIEMBRO*',
    publishedName: 'Presentacion',
    activeTitle: 'Presentaciones activadas',
    inactiveText: 'Presentaciones desactivadas en este grupo.',
    statusTitle: 'Estado de presentaciones',
    adminTitle: 'PRESENTACIONES',
    commandName: 'presentaciones',
    introText: 'Los miembros pueden enviar su foto al privado del bot. CERBERO la revisa con anti-NSFW, aplica anti-meme y la publica aqui con encuesta si esta limpia.',
    dmHint: 'Si hay una dinamica de *presentaciones* activa en tu grupo, la reviso con anti-NSFW y la publico alla.',
  },
  tinder: {
    key: 'tinder',
    label: 'tinder',
    configPath: path.resolve(process.cwd(), 'comandos_cerbero', 'tinder_config.json'),
    pollTitle: 'TINDER 😈😈',
    pollOptions: ['MATCH😍', 'NEXT'],
    captionTitle: '💘 *TINDER — PERFIL DEL GRUPO*',
    publishedName: 'Perfil Tinder',
    activeTitle: 'Tinder activado',
    inactiveText: 'Tinder desactivado en este grupo.',
    statusTitle: 'Estado de Tinder',
    adminTitle: 'TINDER',
    commandName: 'tinder',
    introText: 'Los miembros pueden enviar su foto al privado del bot. CERBERO la revisa con anti-NSFW, aplica anti-meme y la publica aqui con encuesta MATCH/NEXT.',
    dmHint: 'Si hay una dinamica de *Tinder* activa en tu grupo, la reviso con anti-NSFW y la publico alla con encuesta MATCH/NEXT.',
  },
};
const IS_ARM_RUNTIME = process.arch === 'arm' || process.arch === 'arm64';
const FORCE_NATIVE_ANALYSIS = /^(1|true|yes|on)$/i.test(process.env.PRESENTACIONES_FORCE_NATIVE || '');
const ARM_SAFE_MODE = /^(1|true|yes|on)$/i.test(process.env.PRESENTACIONES_ARM_SAFE_MODE || '') || (IS_ARM_RUNTIME && !FORCE_NATIVE_ANALYSIS);
const NSFW_ANALYSIS_TIMEOUT_MS = Number(process.env.PRESENTACIONES_NSFW_TIMEOUT_MS || 60_000);
const CLIP_ANALYSIS_TIMEOUT_MS = Number(process.env.PRESENTACIONES_CLIP_TIMEOUT_MS || 45_000);
const CLIP_ENABLED = /^(1|true|yes|on)$/i.test(process.env.PRESENTACIONES_CLIP || '') && !ARM_SAFE_MODE;
const MAX_IMAGE_BYTES = Number(process.env.PRESENTACIONES_MAX_IMAGE_BYTES || (ARM_SAFE_MODE ? 6 : 14) * 1024 * 1024);
const PRESENTATION_MAX_PENDING = Number(process.env.PRESENTACIONES_MAX_PENDING || (ARM_SAFE_MODE ? 2 : 5));
const PRESENTATION_FLOOD_WINDOW_MS = Number(process.env.PRESENTACIONES_FLOOD_WINDOW_MS || 60_000);
const PRESENTATION_MAX_IMAGES_PER_WINDOW = Number(process.env.PRESENTACIONES_MAX_IMAGES_PER_WINDOW || 2);
const PRESENTATION_GROUP_SEND_DELAY_MS = Number(process.env.PRESENTACIONES_GROUP_SEND_DELAY_MS || 900);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
let presentationPendingCount = 0;
let jimpPromise = null;
const presentationFloodMap = new Map();

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

function loadConfig(dynamic = DYNAMICS.presentaciones) {
  try {
    const parsed = JSON.parse(fs.readFileSync(dynamic.configPath, 'utf-8'));
    if (!parsed.enabled_groups) parsed.enabled_groups = {};
    return parsed;
  } catch (_) {
    return { enabled_groups: {} };
  }
}

function saveConfig(config, dynamic = DYNAMICS.presentaciones) {
  fs.writeFileSync(dynamic.configPath, JSON.stringify(config, null, 2));
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

function checkPresentationImageFlood(senderJid) {
  const now = Date.now();
  const entry = presentationFloodMap.get(senderJid) || { hits: [], warnedAt: 0 };
  entry.hits = entry.hits.filter(ts => now - ts < PRESENTATION_FLOOD_WINDOW_MS);
  entry.hits.push(now);
  presentationFloodMap.set(senderJid, entry);

  if (entry.hits.length > PRESENTATION_MAX_IMAGES_PER_WINDOW) {
    const mutedSeconds = Math.ceil((PRESENTATION_FLOOD_WINDOW_MS - (now - entry.hits[0])) / 1000);
    return { blocked: true, mutedSeconds, count: entry.hits.length };
  }

  return { blocked: false, count: entry.hits.length };
}

function enqueuePresentation(task) {
  if (presentationPendingCount >= PRESENTATION_MAX_PENDING) return null;
  presentationPendingCount++;
  const run = presentationQueue
    .catch(() => {})
    .then(task)
    .finally(() => {
      presentationPendingCount = Math.max(0, presentationPendingCount - 1);
    });
  presentationQueue = run.catch(() => {});
  return run;
}

async function loadJimp() {
  if (!jimpPromise) {
    jimpPromise = import('jimp')
      .then(mod => mod.Jimp || mod.default || mod)
      .catch(err => {
        jimpPromise = null;
        throw err;
      });
  }
  return jimpPromise;
}

async function findActiveGroupsForSender(sock, senderJid, dynamic = DYNAMICS.presentaciones) {
  const config = loadConfig(dynamic);
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
      console.error(`[${dynamic.key.toUpperCase()}] No se pudo leer metadata de ${groupId}:`, err.message || err);
    }
  }

  return matches;
}

function buildPresentationCaption(originalCaption, safety, dynamic = DYNAMICS.presentaciones) {
  const intro = originalCaption?.trim()
    ? `\n\n"${originalCaption.trim().slice(0, 700)}"`
    : '';

  return (
    `${dynamic.captionTitle}\n\n` +
    `🛡️ Filtro K3RB-0xEY3: *CLEAN* (${(safety.topScore * 100).toFixed(1)}% ${safety.friendlyLabel})` +
    intro +
    `\n\n_Bot recibido por privado y publicado en la dinamica ${dynamic.label} activa._`
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

/**
 * Detecta heurísticamente si una imagen es un meme, poster IA, o no-humana.
 * Se usa cuando CLIP está desactivado (ARM_SAFE_MODE).
 * Analiza:
 * - Distribución de colores (imágenes IA tienen paletas artificiales)
 * - Presencia de texto (memes)
 * - Uniformidad de zonas (fake faces tienen patrones IA)
 * - Frecuencia de componentes (noise artificial)
 */
async function detectMemeFallbackJs(buffer, mediaInfo = null, originalCaption = '') {
  const flags = [];
  const metadata = analyzeMediaMetadata(mediaInfo, buffer?.length || 0);
  const caption = String(originalCaption || '').toLowerCase();

  if (caption && /\b(meme|shitpost|jaja|jajaj|haha|xd|lol|bait|sticker|s[ií]ganme|seguirme|follow|instagram|insta|ig|tiktok|telegram|canal)\b/i.test(caption)) {
    flags.push('caption_tipo_meme_o_promo');
  }

  if (metadata.width && metadata.height) {
    const ratio = Math.max(metadata.width / metadata.height, metadata.height / metadata.width);
    if (ratio > 1.85) flags.push('formato_panoramico_tipo_meme');
    if (metadata.bytes && metadata.bytes < 90 * 1024 && metadata.width >= 500 && metadata.height >= 500) {
      flags.push('imagen_muy_comprimida_tipo_meme');
    }
  }

  try {
    const JimpLib = await loadJimp();
    const image = await JimpLib.read(buffer);
    const { width, height, data } = image.bitmap;
    const totalPixels = width * height;
    if (!totalPixels) return { isAIOrMeme: false, confidence: 0, flags };

    const targetSamples = 12000;
    const step = Math.max(1, Math.floor(totalPixels / targetSamples));
    const xStep = Math.max(1, Math.round(Math.sqrt(step)));
    const yStep = xStep;

    let samples = 0;
    let skin = 0;
    let bw = 0;
    let saturated = 0;
    let edge = 0;
    let flat = 0;
    const buckets = new Set();

    for (let y = 0; y < height; y += yStep) {
      for (let x = 0; x < width; x += xStep) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
        const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;

        samples++;
        buckets.add(`${r >> 5},${g >> 5},${b >> 5}`);
        if (lum < 35 || lum > 220) bw++;
        if (max > 0 && (max - min) / max > 0.55) saturated++;
        if (max - min < 12) flat++;
        if (lum > 55 && cb >= 80 && cb <= 145 && cr >= 125 && cr <= 190) skin++;

        if (x + xStep < width) {
          const right = (y * width + Math.min(width - 1, x + xStep)) * 4;
          const rLum = 0.299 * data[right] + 0.587 * data[right + 1] + 0.114 * data[right + 2];
          if (Math.abs(lum - rLum) > 80) edge++;
        }
        if (y + yStep < height) {
          const down = (Math.min(height - 1, y + yStep) * width + x) * 4;
          const dLum = 0.299 * data[down] + 0.587 * data[down + 1] + 0.114 * data[down + 2];
          if (Math.abs(lum - dLum) > 80) edge++;
        }
      }
    }

    const skinRatio = samples ? skin / samples : 0;
    const bwRatio = samples ? bw / samples : 0;
    const edgeDensity = samples ? edge / (samples * 2) : 0;
    const saturatedRatio = samples ? saturated / samples : 0;
    const flatRatio = samples ? flat / samples : 0;
    const colorBucketRatio = samples ? buckets.size / samples : 1;

    if (edgeDensity > 0.24 && bwRatio > 0.30 && skinRatio < 0.06) flags.push('texto_alto_contraste_tipo_meme');
    if (skinRatio < 0.012 && edgeDensity > 0.075 && (bwRatio > 0.12 || colorBucketRatio < 0.16 || flatRatio > 0.30)) {
      flags.push('pantalla_texto_o_objeto_sin_persona');
    }
    if (skinRatio < 0.010 && (edgeDensity > 0.20 || saturatedRatio > 0.55)) flags.push('sin_presencia_humana_probable');
    if (skinRatio < 0.04 && colorBucketRatio < 0.055 && edgeDensity > 0.14) flags.push('paleta_plana_ilustracion_o_meme');
    if (flatRatio > 0.48 && skinRatio < 0.06 && edgeDensity > 0.12) flags.push('zonas_planas_tipo_cartel');

    const strongMemeSignal = flags.some(flag => (
      flag.includes('caption') ||
      flag.includes('texto_alto_contraste') ||
      flag.includes('pantalla_texto') ||
      flag.includes('sin_presencia_humana')
    ));
    const benignHumanSignal = skinRatio >= 0.08 && !strongMemeSignal;
    const confidence = Math.min(0.25 + flags.length * 0.18, 0.88);
    const isAIOrMeme = !benignHumanSignal && flags.length >= 2 && strongMemeSignal;
    console.log(`[PRESENTACION] Meme fallback JS: skin=${skinRatio.toFixed(3)} edge=${edgeDensity.toFixed(3)} bw=${bwRatio.toFixed(3)} flags=${flags.join(',') || 'none'}`);
    return { isAIOrMeme, confidence: isAIOrMeme ? confidence : 0, flags };
  } catch (err) {
    console.warn('[PRESENTACION] Fallback JS anti-meme no disponible:', err.message || err);
    return { isAIOrMeme: flags.length >= 2, confidence: flags.length >= 2 ? 0.7 : 0, flags };
  }
}

async function detectAIOrMemeHeuristic(buffer, mediaInfo = null, originalCaption = '') {
  try {
    if (!sharp) return detectMemeFallbackJs(buffer, mediaInfo, originalCaption);

    const flags = [];
    const { data, info } = await sharp(buffer, { animated: false })
      .resize(256, 256, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    let colorEntropy = 0;
    let colorCount = new Set();
    let edgePixels = 0;
    let highFreqPixels = 0;
    let uniformRegions = 0;
    let skinPixels = 0;

    // Analizar distribución de colores (IA suele tener paletas repetitivas)
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const rgb = `${r},${g},${b}`;
      colorCount.add(rgb);
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = -0.169 * r - 0.331 * g + 0.5 * b + 128;
      const cr = 0.5 * r - 0.419 * g - 0.081 * b + 128;
      if (y > 55 && cb >= 80 && cb <= 145 && cr >= 125 && cr <= 190) skinPixels++;
    }
    const skinRatio = pixels ? skinPixels / pixels : 0;
    const uniqueColors = colorCount.size;
    const expectedColors = Math.min(Math.sqrt(pixels) * 50, 500000);
    if (skinRatio < 0.05 && uniqueColors < expectedColors * 0.22) {
      flags.push('paleta_artificial_baja_variedad');
    }

    // Detectar presencia de texto (bordes rectos = meme)
    const gray = new Uint8Array(pixels);
    for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const idx = y * info.width + x;
        const gx = Math.abs(gray[idx] - gray[idx - 1]);
        const gy = Math.abs(gray[idx] - gray[idx - info.width]);
        const edge = gx + gy;
        if (edge > 80) edgePixels++;
        if (edge > 150) highFreqPixels++;
      }
    }

    const edgeDensity = pixels ? edgePixels / pixels : 0;
    const highFreqDensity = pixels ? highFreqPixels / pixels : 0;
    if (edgeDensity > 0.38 && highFreqDensity > 0.15 && skinRatio < 0.08) {
      flags.push('mucho_texto_como_meme');
    }
    if (skinRatio < 0.012 && edgeDensity > 0.12 && (highFreqDensity > 0.035 || uniqueColors < expectedColors * 0.28)) {
      flags.push('pantalla_texto_o_objeto_sin_persona');
    }

    // Detectar uniformidad anómala (fake faces IA tienen regiones demasiado suaves)
    for (let y = 2; y < info.height - 2; y += 3) {
      for (let x = 2; x < info.width - 2; x += 3) {
        const idx = y * info.width + x;
        const maxLocal = Math.max(
          gray[idx], gray[idx + 1], gray[idx - 1],
          gray[idx + info.width], gray[idx - info.width]
        );
        const minLocal = Math.min(
          gray[idx], gray[idx + 1], gray[idx - 1],
          gray[idx + info.width], gray[idx - info.width]
        );
        if (maxLocal - minLocal < 15) uniformRegions++;
      }
    }

    const uniformityRatio = (info.width - 4) * (info.height - 4) / 9 > 0 
      ? uniformRegions / ((info.width - 4) * (info.height - 4) / 9)
      : 0;
    if (uniformityRatio > 0.55 && skinRatio < 0.06) {
      flags.push('demasiado_uniforme_como_generado_IA');
    }

    // Calcular confianza
    const strongMemeSignal = flags.some(flag => flag.includes('texto') || flag.includes('meme') || flag.includes('pantalla'));
    const confidence = flags.length > 0 ? Math.min(0.30 + (flags.length * 0.20), 0.90) : 0;
    const isAIOrMeme = flags.length >= 2 && (strongMemeSignal || skinRatio < 0.025);
    
    console.log(`[PRESENTACION] AI/Meme heuristic: skin=${skinRatio.toFixed(3)} flags=${flags.join(',') || 'none'} confidence=${confidence.toFixed(2)}`);
    
    return { isAIOrMeme, confidence, flags };
  } catch (err) {
    console.error('[PRESENTACION] Error en heurística AI/meme:', err.message || err);
    return { isAIOrMeme: false, confidence: 0, flags: [] };
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

async function analyzePresentationRelevance(buffer, mediaInfo, originalCaption = '') {
  const layout = await analyzeImageLayout(buffer, mediaInfo);
  let predictions = [];
  let recognitionError = null;
  let aiOrMemeDetection = null;

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
    // Cuando CLIP está desactivado, usar heurística mejorada para detectar AI/memes
    recognitionError = new Error('clip_disabled');
    console.log('[PRESENTACION] CLIP desactivado; activando heuristica AI/meme robusta.');
    aiOrMemeDetection = await detectAIOrMemeHeuristic(buffer, mediaInfo, originalCaption);
  }

  const bestAccept = predictions
    .filter(p => ACCEPT_SET.has(p.label))
    .sort((a, b) => b.score - a.score)[0] || null;
  const bestReject = predictions
    .filter(p => REJECT_SET.has(p.label))
    .sort((a, b) => b.score - a.score)[0] || null;
  const top = predictions[0] || null;

  const reasons = [...layout.flags];
  
  // Agregar razones de rechazo por CLIP si está disponible
  if (bestReject && (!bestAccept || bestReject.score >= bestAccept.score * 1.08) && bestReject.score >= 0.16) {
    reasons.push(`parece ${bestReject.label}`);
  }
  if (top && REJECT_SET.has(top.label) && (!bestAccept || top.score >= bestAccept.score * 1.15) && top.score >= 0.20) {
    reasons.push(`clasificacion principal: ${top.label}`);
  }
  if (!recognitionError && bestAccept && bestReject && bestAccept.score < 0.13 && bestReject.score > bestAccept.score) {
    reasons.push('no parece una foto real de presentacion');
  }

  // Agregar razones de rechazo por heurística AI/meme
  if (aiOrMemeDetection && aiOrMemeDetection.isAIOrMeme) {
    reasons.push(`posible meme o generado por IA (${(aiOrMemeDetection.confidence * 100).toFixed(0)}%): ${aiOrMemeDetection.flags.join(', ')}`);
  }

  const hardLayoutBlock = layout.flags.some(flag => (
    flag.includes('sticker') ||
    flag.includes('meme') ||
    flag.includes('captura') ||
    flag.includes('pequena') ||
    flag.includes('gore') ||
    flag.includes('sangre')
  ));
  
  const aiOrMemeBlock = aiOrMemeDetection?.isAIOrMeme ?? false;
  
  const modelBlock = reasons.some(reason => (
    reason.includes('parece') ||
    reason.includes('clasificacion principal') ||
    reason.includes('no parece')
  ));

  return {
    allowed: !(hardLayoutBlock || modelBlock || aiOrMemeBlock),
    reasons,
    layout,
    predictions,
    recognitionError,
    bestAccept,
    bestReject,
    aiOrMemeDetection,
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
        `🚫 Imagen rechazada por seguridad.\n` +
        `Intenta mas tarde con una foto normal.`
    }).catch(() => {});
    return null;
  }
}

function evaluatePresentationSafety(safety) {
  if (!safety) return { allowed: false, override: false, reason: 'sin resultado' };
  if (safety.allowed) return { allowed: true, override: false, reason: 'motor limpio' };

  const predictions = Array.isArray(safety.predictions) ? safety.predictions : [];
  const maxScore = (labels) => predictions
    .filter(p => labels.includes((p.label || '').toLowerCase()))
    .reduce((max, p) => Math.max(max, Number(p.score) || 0), 0);

  const label = (safety.topLabel || '').toLowerCase();
  const topScore = Number(safety.topScore) || 0;
  const pornScore = maxScore(['porn', 'pornography']);
  const hentaiScore = maxScore(['hentai']);
  const goreScore = maxScore(['gore']);

  if (safety.reason === 'gore' || label === 'gore' || goreScore >= 0.55) {
    return { allowed: false, override: false, reason: 'gore' };
  }
  if (pornScore >= 0.72 || hentaiScore >= 0.70 || ['porn', 'pornography', 'hentai'].includes(label)) {
    return { allowed: false, override: false, reason: 'contenido explicito' };
  }

  // Presentaciones acepta fotos fitness/torso normal. El motor general puede marcar
  // pectorales o playa como "sexy" por piel visible; eso no equivale a porno.
  if (['sexy', 'nsfw_fallback'].includes(label) && topScore < 0.97) {
    return {
      allowed: true,
      override: true,
      reason: `fitness/torso permitido (${label} ${(topScore * 100).toFixed(1)}%)`,
    };
  }

  return { allowed: false, override: false, reason: safety.friendlyLabel || label || 'nsfw' };
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

async function sendPresentationPoll(sock, groupId, quotedMsg, dynamic = DYNAMICS.presentaciones) {
  const pollMessage = {
    poll: {
      name: dynamic.pollTitle,
      values: dynamic.pollOptions,
      selectableCount: 1,
    },
  };

  try {
    await sock.sendMessage(groupId, pollMessage, quotedMsg ? { quoted: quotedMsg } : undefined);
  } catch (err) {
    console.error(`[${dynamic.key.toUpperCase()}] Error enviando encuesta en ${groupId}:`, err.message || err);
    await sock.sendMessage(groupId, {
      text:
        `📊 *Encuesta ${dynamic.label}*\n\n` +
        `${dynamic.pollOptions.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}`,
    });
  }
}

async function manejarDMFotoDinamica(sock, senderJid, msg, dynamic = DYNAMICS.presentaciones, opts = {}) {
  const imageContainer = getPrivateImageContainer(msg);
  const text = getTextFromMessage(msg).trim();

  if (!imageContainer) {
    const asksForDynamic = dynamic.key === 'tinder'
      ? /tinder|match|next|perfil/i.test(text)
      : /presentaci[oó]n|presentarme|me\s+presento/i.test(text);
    if (asksForDynamic) {
      await sock.sendMessage(senderJid, {
        text:
          `📸 Enviame una foto por privado.\n\n` +
          dynamic.dmHint,
      });
      return true;
    }
    return false;
  }

  const flood = checkPresentationImageFlood(senderJid);
  if (flood.blocked) {
    await sock.sendMessage(senderJid, {
      text:
        `🚫 Imagen rechazada por proteccion anti-flood.\n` +
        `Intenta mas tarde.`
    }).catch(() => {});
    console.warn(`[PRESENTACION] Flood privado bloqueado ${senderJid}: ${flood.count} imagenes/${PRESENTATION_FLOOD_WINDOW_MS}ms`);
    return true;
  }

  let precomputedDestinations = null;
  if (opts.silentNoDestinations) {
    precomputedDestinations = await findActiveGroupsForSender(sock, senderJid, dynamic);
    if (!precomputedDestinations.length) return false;
  }

  const queued = enqueuePresentation(() => manejarDMPresentacionImagen(sock, senderJid, msg, imageContainer, text, dynamic, {
    ...opts,
    precomputedDestinations,
  }));
  if (!queued) {
    await sock.sendMessage(senderJid, {
      text:
        `🚫 Imagen rechazada por proteccion anti-flood.\n` +
        `Intenta mas tarde.`
    }).catch(() => {});
    console.warn(`[PRESENTACION] Cola saturada: pending=${presentationPendingCount}/${PRESENTATION_MAX_PENDING}`);
  }
  return true;
}

export async function manejarDMPresentacion(sock, senderJid, msg, opts = {}) {
  return manejarDMFotoDinamica(sock, senderJid, msg, DYNAMICS.presentaciones, opts);
}

export async function manejarDMTinder(sock, senderJid, msg, opts = {}) {
  return manejarDMFotoDinamica(sock, senderJid, msg, DYNAMICS.tinder, opts);
}

async function manejarDMPresentacionImagen(sock, senderJid, msg, imageContainer, text, dynamic = DYNAMICS.presentaciones, opts = {}) {
  const destinations = opts.precomputedDestinations || await findActiveGroupsForSender(sock, senderJid, dynamic);
  if (!destinations.length) {
    if (opts.silentNoDestinations) return false;
    await sock.sendMessage(senderJid, {
      text:
        `⚠️ No encontre una dinamica de *${dynamic.label}* activa en algun grupo donde estes.\n` +
        `Pidele a un admin que use *!${dynamic.commandName} activar* en el grupo.`,
    });
    return true;
  }

  const mediaInfo = getMediaInfoFromContainer(imageContainer);
  const mediaPrecheck = precheckPresentationMedia(mediaInfo);
  if (!mediaPrecheck.allowed) {
    const why = mediaPrecheck.layout.flags.slice(0, 3).join(', ') || 'formato no apto';
    await sock.sendMessage(senderJid, {
      text:
        `🚫 No pude aceptar esa imagen para ${dynamic.label}.\n` +
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
  const qrValidation = await validatePresentationAntiQr(buffer, mediaInfo.mediaMessage);
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
  const presentationSafety = evaluatePresentationSafety(safety);

  if (!presentationSafety.allowed) {
    await sock.sendMessage(senderJid, {
      text:
        `🚫 Tu foto no se publico porque el filtro anti-NSFW la marco como no segura.\n` +
        `▸ Motivo: ${safety.friendlyLabel} (${(safety.topScore * 100).toFixed(1)}%)`,
    });
    console.log(`[PRESENTACION] Imagen bloqueada de ${senderJid}: ${safety.topLabel} ${(safety.topScore * 100).toFixed(1)}%`);
    return true;
  }
  if (presentationSafety.override) {
    console.log(`[PRESENTACION] Override anti-NSFW benigno para ${senderJid}: ${presentationSafety.reason}`);
  }

  const relevance = await analyzePresentationRelevance(buffer, mediaInfo, text);
  if (!relevance.allowed) {
    const why = relevance.reasons.length
      ? relevance.reasons.slice(0, 3).join(', ')
      : `no parece una foto real para ${dynamic.label}`;
    await sock.sendMessage(senderJid, {
      text:
        `🚫 No publique esa imagen porque parece meme, captura, sticker, gore o algo ajeno a ${dynamic.label}.\n` +
        `▸ Motivo: ${why}\n\n` +
        `Manda una foto real donde se vea una persona.`
    });
    console.log(`[PRESENTACION] Imagen irrelevante de ${senderJid}: ${why}. CLIP=${summarizeTopPredictions(relevance.predictions) || 'sin datos'}`);
    return true;
  }

  const captionSafety = presentationSafety.override
    ? { ...safety, friendlyLabel: 'foto fitness/torso permitida' }
    : safety;
  const caption = buildPresentationCaption(text, captionSafety, dynamic);
  let published = 0;

  for (let index = 0; index < destinations.length; index++) {
    const { groupId } = destinations[index];
    try {
      const sentImage = await sock.sendMessage(groupId, {
        image: buffer,
        caption,
        viewOnce: true,
      });
      await sendPresentationPoll(sock, groupId, sentImage, dynamic);
      published++;
    } catch (err) {
      console.error(`[PRESENTACION] Error publicando en ${groupId}:`, err.message || err);
    }
    if (index < destinations.length - 1) {
      await sleep(PRESENTATION_GROUP_SEND_DELAY_MS);
    }
  }

  if (published > 0) {
    await sock.sendMessage(senderJid, {
      text: `✅ ${dynamic.publishedName} publicado en ${published} grupo(s).`,
    });
  } else {
    await sock.sendMessage(senderJid, {
      text: `❌ La foto paso el filtro, pero no pude publicarla en el grupo. Revisa si el bot tiene permisos.`,
    });
  }

  return true;
}

async function manejarComandoFotoDinamica(sock, chatId, senderJid, isAdmin, args, dynamic = DYNAMICS.presentaciones) {
  if (!chatId.endsWith('@g.us')) {
    await sock.sendMessage(chatId, { text: 'Este comando debe usarse dentro de un grupo.' });
    return;
  }

  if (!isAdmin) {
    await sock.sendMessage(chatId, { text: `⛔ Solo administradores pueden configurar ${dynamic.label}.` });
    return;
  }

  const sub = (args[0] || '').toLowerCase();
  const config = loadConfig(dynamic);
  if (!config.enabled_groups) config.enabled_groups = {};

  if (['activar', 'abrir', 'grupo', 'on'].includes(sub)) {
    config.enabled_groups[chatId] = {
      activo: true,
      updatedAt: Date.now(),
      updatedBy: senderJid,
    };
    saveConfig(config, dynamic);
    await sock.sendMessage(chatId, {
      text:
        `✅ *${dynamic.activeTitle}* en este grupo.\n\n` +
        dynamic.introText,
    });
    return;
  }

  if (['desactivar', 'cerrar', 'off'].includes(sub)) {
    if (!config.enabled_groups[chatId]) config.enabled_groups[chatId] = {};
    config.enabled_groups[chatId].activo = false;
    config.enabled_groups[chatId].updatedAt = Date.now();
    config.enabled_groups[chatId].updatedBy = senderJid;
    saveConfig(config, dynamic);
    await sock.sendMessage(chatId, { text: `🔒 ${dynamic.inactiveText}` });
    return;
  }

  if (['estado', 'info'].includes(sub)) {
    const active = config.enabled_groups?.[chatId]?.activo === true;
    await sock.sendMessage(chatId, {
      text:
        `📸 *${dynamic.statusTitle}*\n\n` +
        `▸ Grupo : ${chatId}\n` +
        `▸ Estado: ${active ? '✅ ACTIVO' : '🔒 CERRADO'}`,
    });
    return;
  }

  await sock.sendMessage(chatId, {
    text:
      `📸 *${dynamic.adminTitle} — comandos admin:*\n\n` +
      `!${dynamic.commandName} activar    → abrir dinamica en este grupo\n` +
      `!${dynamic.commandName} desactivar → cerrar dinamica\n` +
      `!${dynamic.commandName} estado     → ver estado\n\n` +
      dynamic.introText,
  });
}

export async function manejarComandoPresentacion(sock, chatId, senderJid, isAdmin, args) {
  return manejarComandoFotoDinamica(sock, chatId, senderJid, isAdmin, args, DYNAMICS.presentaciones);
}

export async function manejarComandoTinder(sock, chatId, senderJid, isAdmin, args) {
  return manejarComandoFotoDinamica(sock, chatId, senderJid, isAdmin, args, DYNAMICS.tinder);
}
