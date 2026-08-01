// nsfw_classifier.js — Pipeline anti-NSFW: 6 señales pixel (JS+Python) + consenso dual ML
// Coded by C3rb3rus-666

import { pipeline, env as xenovaEnv } from '@xenova/transformers';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// sharp y canvas son dependencias nativas — cargar de forma dinámica para no crashear en ARM/Termux
let sharp = null;
let _canvasLib = null;
try { sharp = (await import('sharp')).default; } catch (e) { console.warn('[NSFW] sharp no disponible (ARM/Termux):', e.message?.slice(0,60)); }
try { _canvasLib = await import('canvas'); } catch (e) { console.warn('[NSFW] canvas no disponible (ARM/Termux):', e.message?.slice(0,60)); }
const createCanvas = _canvasLib?.createCanvas || null;
const loadImage    = _canvasLib?.loadImage    || null;

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const _require   = createRequire(import.meta.url);

// Apuntar Xenova a caché local — sin red en arranques sucesivos
xenovaEnv.cacheDir         = path.join(__dirname, '..', 'models_cache');
xenovaEnv.allowLocalModels  = true;
xenovaEnv.allowRemoteModels = true;   // permite re-descarga si se borra el cache
xenovaEnv.backends          = { onnx: { wasm: { numThreads: 1 } } };

const XENOVA_TMP_DIR = path.join(os.tmpdir(), 'cerbero_nsfw_xenova');
const IS_ARM_RUNTIME = process.arch === 'arm' || process.arch === 'arm64';
const FORCE_XENOVA = /^(1|true|yes|on)$/i.test(process.env.NSFW_FORCE_XENOVA || '');
const DISABLE_XENOVA = /^(1|true|yes|on)$/i.test(process.env.NSFW_DISABLE_XENOVA || '');
let _xenovaArmWarned = false;

// ─ tfjs-node requiere AVX/AVX2 en x64. Esta CPU solo tiene SSE4.2.
// Cargar tfjs-node causaría SIGILL (crash del proceso). Se usa backend JS puro.
// Para activar: verificar primero con `grep avx /proc/cpuinfo`
// try {
//   _require('@tensorflow/tfjs-node');
//   console.log('[NSFW] Backend tfjs-node activado.');
// } catch (err) {
//   console.warn('[NSFW] tfjs-node no disponible, usando JS puro:', err.message);
// }
console.log('[NSFW] Backend: JS puro (CPU sin AVX — tfjs-node desactivado).');

// nsfwjs via CJS para evitar ERR_UNSUPPORTED_DIR_IMPORT
let _nsfwjsLib = null;
try {
  _nsfwjsLib = _require('nsfwjs');
} catch (err) {
  console.warn('[NSFW] nsfwjs no disponible:', err.message);
}

// jimp para pHash perceptual (blacklist de imágenes NSFW conocidas)
let _jimp = null;
try {
  const jimpLib = _require('jimp');
  _jimp = jimpLib.Jimp ? jimpLib.Jimp : jimpLib;
} catch (err) {
  console.warn('[NSFW] jimp no disponible (pHash desactivado):', err.message);
}


// ─── Etiquetas globales ───────────────────────────────────────────────────────
const SAFE_LABELS = new Set(['neutral', 'drawing', 'safe', 'sfw_fallback']);
const NSFW_LABELS = new Set(['porn', 'pornography', 'sexy', 'hentai', 'nsfw_fallback']);

const THRESHOLDS = {
  porn:          0.72,  // bajado: mejor recall en pornografía real
  pornography:   0.72,
  hentai:        0.70,  // bajado: hentai/anime NSFW es común en grupos
  sexy:          0.88,  // bajado levemente: reduce falsos negativos
  nsfw_fallback: 0.78   // bajado: YCbCr + fallback más agresivo
};

// ─── Blacklist pHash perceptual ──────────────────────────────────────────────────────
// jimp genera un hash perceptual de 8 caracteres hex. Dos hashes con
// distancia de Hamming ≤ 5 se consideran visualmente idénticos.
// Permite bloquear reenvíos de imágenes NSFW aunque tengan
// recorte, reescalado o recompresión ligera.
const _nsfwPHashBlacklist = new Set();
const PHASH_DISTANCE_THRESHOLD = 5; // 0 = idéntico, 64 = máximo diferente

async function getPerceptualHash(imageBuffer) {
  if (!_jimp) return null;
  try {
    const img = await _jimp.read(imageBuffer);
    // Jimp genera un hash de 8 hex chars (64 bits)
    return img.hash();
  } catch (err) {
    console.warn('[NSFW] pHash error:', err.message);
    return null;
  }
}

function hammingDistance(a, b) {
  // Comparación bit a bit de dos strings hex de jimp
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // Contar bits '1' (popcount)
    dist += xor.toString(2).split('1').length - 1;
  }
  return dist;
}

function isInPHashBlacklist(hash) {
  if (!hash) return false;
  for (const knownHash of _nsfwPHashBlacklist) {
    if (hammingDistance(hash, knownHash) <= PHASH_DISTANCE_THRESHOLD) return true;
  }
  return false;
}

export function addToNsfwBlacklist(imageHash) {
  if (imageHash) _nsfwPHashBlacklist.add(imageHash);
}

// ─── Caché MD5 (evita re-clasificar la misma imagen) ─────────────────────────
const _resultCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getImageHash(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function cacheGet(hash) {
  const entry = _resultCache.get(hash);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { _resultCache.delete(hash); return null; }
  return entry.result;
}

function cacheSet(hash, result) {
  if (_resultCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of _resultCache)
      if (now - v.ts > CACHE_TTL_MS) _resultCache.delete(k);
  }
  _resultCache.set(hash, { result, ts: Date.now() });
}

// ─── Singletons de modelos ML (carga lazy) ───────────────────────────────────
// Modelo Xenova: Falconsai/nsfw_image_detection (público, sin auth)
// Si falla, _xenovaFailed = true para NO reintentar la red en cada imagen
let _xenovaModel  = null;
let _xenovaFailed = false;
let _nsfwjsModel  = null;

async function loadXenovaClassifier() {
  if (_xenovaModel)  return _xenovaModel;
  if (_xenovaFailed) return null;           // ya falló antes, no reintentar
  if (DISABLE_XENOVA) {
    if (!_xenovaArmWarned) {
      console.warn('[NSFW] Xenova desactivado por configuración (NSFW_DISABLE_XENOVA=1).');
      _xenovaArmWarned = true;
    }
    _xenovaFailed = true;
    return null;
  }
  try {
    console.log('[NSFW] Cargando Xenova (AdamCodd/vit-base-nsfw-detector) desde caché local...');
    _xenovaModel = await pipeline(
      'image-classification',
      'AdamCodd/vit-base-nsfw-detector'
    );
    console.log('[NSFW] ✅ Xenova listo.');
  } catch (err) {
    console.warn(`[NSFW] Xenova no disponible (${err.message}) — se usará solo nsfwjs.`);
    _xenovaModel  = null;
    _xenovaFailed = true;   // bloquea reintentos de red
  }
  return _xenovaModel;
}

async function loadNsfwjsModel() {
  if (_nsfwjsModel) return _nsfwjsModel;
  if (!_nsfwjsLib) {
    console.warn('[NSFW] nsfwjs no cargado, omitiendo.');
    return null;
  }
  try {
    console.log('[NSFW] Cargando nsfwjs...');
    _nsfwjsModel = await _nsfwjsLib.load();
    console.log('[NSFW] ✅ nsfwjs listo.');
  } catch (err) {
    console.error('[NSFW] nsfwjs no disponible:', err.message);
    _nsfwjsModel = null;
  }
  return _nsfwjsModel;
}

async function prepareXenovaImageInput(imageBuffer) {
  await fs.promises.mkdir(XENOVA_TMP_DIR, { recursive: true });
  const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
  const tmpPath = path.join(XENOVA_TMP_DIR, `nsfw_${Date.now()}_${id}.jpg`);
  let normalized = imageBuffer;

  if (sharp) {
    try {
      normalized = await sharp(imageBuffer, { animated: false })
        .resize(768, 768, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();
    } catch (err) {
      console.warn('[NSFW] No se pudo normalizar imagen para Xenova, usando buffer original:', err.message);
    }
  }

  await fs.promises.writeFile(tmpPath, normalized);
  return tmpPath;
}

// ─── CAPA 1: Pre-filtro por tamaño/formato ───────────────────────────────────
async function preFiltro(imageBuffer) {
  if (!sharp) return 'continue'; // ARM/Termux: sin sharp
  try {
    const meta = await sharp(imageBuffer).metadata();
    const { width = 0, height = 0, format } = meta;
    // Stickers WebP pequeños (<100KB y ≤512px)
    if (format === 'webp' && width <= 512 && height <= 512 && imageBuffer.length < 100 * 1024) {
      console.log('[NSFW] Pre-filtro: WebP pequeño (sticker), omitido.');
      return 'skip';
    }
    // Miniaturas irrelevantes
    if (width < 80 || height < 80) {
      console.log(`[NSFW] Pre-filtro: imagen muy pequeña (${width}x${height}), omitida.`);
      return 'skip';
    }
    return 'continue';
  } catch (err) {
    console.warn('[NSFW] Pre-filtro error:', err.message);
    return 'continue';
  }
}

// ─── CAPA 2A: Detector cartoon/dibujo (sin ML) ───────────────────────────────
// Dibujos tienen alta proporción de píxeles extremos (blanco/negro puro)
// y varianza bimodal de luminosidad. Muy rápido (128x128 en escala de grises).
async function detectarCartoon(imageBuffer) {
  if (!sharp) return { isDrawing: false, confidence: 0 };
  try {
    const resized = await sharp(imageBuffer)
      .resize(128, 128, { fit: 'cover' })
      .greyscale().raw().toBuffer();
    const pixels = new Uint8Array(resized);
    const len = pixels.length;
    let sum = 0, sumSq = 0, extremeCount = 0;
    for (let i = 0; i < len; i++) {
      const v = pixels[i];
      sum += v;
      sumSq += v * v;
      if (v < 30 || v > 225) extremeCount++;
    }
    const mean = sum / len;
    const variance = (sumSq / len) - (mean * mean);
    const extremeRatio = extremeCount / len;
    // Cartoon: >45% píxeles extremos + varianza bimodal alta
    const isDrawing = extremeRatio > 0.40 && variance > 1500;
    const confidence = Math.min(1, extremeRatio * 1.5 + (variance > 1500 ? 0.2 : 0));
    console.log(`[NSFW] Cartoon: extreme=${extremeRatio.toFixed(2)} var=${variance.toFixed(0)} isDrawing=${isDrawing}`);
    return { isDrawing, confidence };
  } catch (err) {
    console.warn('[NSFW] Cartoon detector error:', err.message);
    return { isDrawing: false, confidence: 0 };
  }
}

// ─── CAPA 2B: Detección de piel con YCbCr BT.601 ────────────────────────────
// YCbCr es mucho más preciso que RGB para piel real entre diferentes etnias.
// Criterio: Y > 80 && 85 ≤ Cb ≤ 135 && 135 ≤ Cr ≤ 180
// Analiza a 96x96 para máxima velocidad.
async function skinToneYCbCr(imageBuffer) {
  if (!sharp) return { skinRatio: 0, score: 0, label: 'sfw_fallback' };
  try {
    const { data } = await sharp(imageBuffer)
      .resize(96, 96, { fit: 'cover' })
      .removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data);
    let skinPixels = 0;
    const total = pixels.length / 3;
    for (let i = 0; i < pixels.length; i += 3) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const Y  =  0.299 * r + 0.587 * g + 0.114 * b;
      const Cb = -0.169 * r - 0.331 * g + 0.500 * b + 128;
      const Cr =  0.500 * r - 0.419 * g - 0.081 * b + 128;
      if (Y > 80 && Cb >= 85 && Cb <= 135 && Cr >= 135 && Cr <= 180) skinPixels++;
    }
    const skinRatio = total === 0 ? 0 : skinPixels / total;
    // Score: ratio * 2.5 → 40%+ piel = score 1.0
    const score = Math.min(1, skinRatio * 2.5);
    const label = score > 0.72 ? 'nsfw_fallback' : 'sfw_fallback';
    console.log(`[NSFW] YCbCr: skinRatio=${skinRatio.toFixed(3)} score=${score.toFixed(3)} → ${label}`);
    return { skinRatio, score, label };
  } catch (err) {
    console.error('[NSFW] YCbCr error:', err.message);
    return { skinRatio: 0, score: 0, label: 'sfw_fallback' };
  }
}

// ─── CAPA 3A: Clasificador nsfwjs ────────────────────────────────────────────
async function clasificarConNsfwjs(imageBuffer) {
  if (!loadImage || !createCanvas) return null; // ARM/Termux: sin canvas
  try {
    const model = await loadNsfwjsModel();
    if (!model) return null;
    // Imagen original sin alterar — nsfwjs hace su propio resize interno con MobileNet
    // No pre-procesamos: cualquier recorte o recompresión reduce exactitud
    const img = await loadImage(imageBuffer);
    const canvas = createCanvas(img.width, img.height);
    canvas.getContext('2d').drawImage(img, 0, 0);
    const preds = await model.classify(canvas);
    return preds.map(p => ({ label: p.className.toLowerCase(), score: p.probability }));
  } catch (err) {
    console.error('[NSFW] nsfwjs error:', err.message);
    return null;
  }
}

// ─── CAPA 3B: Clasificador Xenova (juez borderline) ──────────────────────────
async function clasificarConXenova(imageBuffer) {
  let tmpPath = null;
  try {
    const cl = await loadXenovaClassifier();
    if (!cl) return null;
    tmpPath = await prepareXenovaImageInput(imageBuffer);
    const raw = await cl(tmpPath);
    // AdamCodd usa etiquetas "nsfw" / "normal" — normalizar a vocabulario interno
    return (raw || []).map(p => {
      const l = (p.label || '').toLowerCase();
      const label = l === 'nsfw'   ? 'porn'    :
                    l === 'normal' ? 'neutral' : l;
      return { label, score: p.score };
    });
  } catch (err) {
    console.error('[NSFW] Xenova error:', err.message);
    return null;
  } finally {
    if (tmpPath) fs.promises.unlink(tmpPath).catch(() => {});
  }
}

// ─── SEÑAL 3: Densidad de bordes en zonas de piel (Sobel simplificado) ─────────
// Piel sin textura/bordes = superficie lisa expuesta (desnudo probable).
// Piel con muchos bordes = ropa con patrón, pelo, objetos → falso positivo.
// Opera a 96x96 en dos passes con sharp (RGB para piel, greyscale para Sobel).
async function analizarBordesEnPiel(imageBuffer) {
  if (!sharp) return { meanEdge: 1.0, smoothSkin: false, textureSkin: false, skinCount: 0 };
  try {
    const SIZE = 96;
    const [{ data: rgbData }, greyRaw] = await Promise.all([
      sharp(imageBuffer).resize(SIZE, SIZE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(imageBuffer).resize(SIZE, SIZE, { fit: 'cover' }).greyscale().raw().toBuffer()
    ]);
    const rgb  = new Uint8Array(rgbData);
    const grey = new Uint8Array(greyRaw);
    let skinCount = 0, skinEdgeSum = 0;
    for (let y = 1; y < SIZE - 1; y++) {
      for (let x = 1; x < SIZE - 1; x++) {
        const i = (y * SIZE + x) * 3;
        const Y  =  0.299 * rgb[i] + 0.587 * rgb[i+1] + 0.114 * rgb[i+2];
        const Cb = -0.169 * rgb[i] - 0.331 * rgb[i+1] + 0.500 * rgb[i+2] + 128;
        const Cr =  0.500 * rgb[i] - 0.419 * rgb[i+1] - 0.081 * rgb[i+2] + 128;
        if (!(Y > 80 && Cb >= 85 && Cb <= 135 && Cr >= 135 && Cr <= 180)) continue;
        skinCount++;
        // Operador Sobel 3x3
        const gi = y * SIZE + x;
        const gx = -grey[gi-SIZE-1] + grey[gi-SIZE+1] - 2*grey[gi-1] + 2*grey[gi+1] - grey[gi+SIZE-1] + grey[gi+SIZE+1];
        const gy = -grey[gi-SIZE-1] - 2*grey[gi-SIZE] - grey[gi-SIZE+1] + grey[gi+SIZE-1] + 2*grey[gi+SIZE] + grey[gi+SIZE+1];
        skinEdgeSum += Math.sqrt(gx*gx + gy*gy);
      }
    }
    if (skinCount < 40) return { meanEdge: 1.0, smoothSkin: false, skinCount };
    const meanEdge  = skinEdgeSum / (skinCount * 255);
    // < 0.10 = piel lisa (desnudo probable) | > 0.22 = textura/ropa
    const smoothSkin = meanEdge < 0.10;
    const textureSkin = meanEdge > 0.22;   // señal de NO desnudo
    console.log(`[NSFW] Bordes-piel: meanEdge=${meanEdge.toFixed(3)} smooth=${smoothSkin} texture=${textureSkin}`);
    return { meanEdge, smoothSkin, textureSkin, skinCount };
  } catch (err) {
    console.warn('[NSFW] BordesEnPiel error:', err.message);
    return { meanEdge: 1.0, smoothSkin: false, textureSkin: false, skinCount: 0 };
  }
}

// ─── SEÑAL 4: Concentración de piel en zona central (3x3 grid) ─────────────────
// Contenido explícito tiende a tener piel concentrada en el tercio central
// (torso, pelvis). Fotos inocentes (playa, retrato) tienen piel en bordes (cara,
// manos, hombros). Esto corta muchos falsos positivos de fotos de playa.
async function analizarConcentracionPiel(imageBuffer) {
  if (!sharp) return { centerRatio: 0, borderAvg: 0, concentrated: false };
  try {
    const SIZE = 96;
    const T = Math.floor(SIZE / 3);
    const { data } = await sharp(imageBuffer)
      .resize(SIZE, SIZE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data);
    // Contar piel en 9 celdas de la cuadrícula 3x3
    const cells = Array.from({ length: 9 }, () => ({ skin: 0, total: 0 }));
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const col  = Math.min(2, Math.floor(x / T));
        const row  = Math.min(2, Math.floor(y / T));
        const cell = cells[row * 3 + col];
        cell.total++;
        const i = (y * SIZE + x) * 3;
        const Y  =  0.299 * pixels[i] + 0.587 * pixels[i+1] + 0.114 * pixels[i+2];
        const Cb = -0.169 * pixels[i] - 0.331 * pixels[i+1] + 0.500 * pixels[i+2] + 128;
        const Cr =  0.500 * pixels[i] - 0.419 * pixels[i+1] - 0.081 * pixels[i+2] + 128;
        if (Y > 80 && Cb >= 85 && Cb <= 135 && Cr >= 135 && Cr <= 180) cell.skin++;
      }
    }
    const ratios = cells.map(c => c.total > 0 ? c.skin / c.total : 0);
    const centerRatio = ratios[4];                       // celda [1,1] = centro
    const borderAvg   = (ratios.reduce((s,v) => s+v, 0) - centerRatio) / 8;
    // Concentrada si el centro tiene >2x más piel que el promedio de bordes y >30%
    const concentrated = centerRatio > 0.30 && centerRatio > borderAvg * 2.0;
    console.log(`[NSFW] Zona-central: center=${centerRatio.toFixed(2)} borderAvg=${borderAvg.toFixed(2)} concentrated=${concentrated}`);
    return { centerRatio, borderAvg, concentrated };
  } catch (err) {
    console.warn('[NSFW] ConcentracionPiel error:', err.message);
    return { centerRatio: 0, borderAvg: 0, concentrated: false };
  }
}

// ─── SEÑAL 5: Saturación anime (HSV) ────────────────────────────────────────────
// Anime y hentai usan cel-shading: colores muy saturados y uniformes (baja varianza).
// Fotos reales tienen saturación más heterogénea. Complementa el detector cartoon.
async function analizarSaturacionAnime(imageBuffer) {
  if (!sharp) return { meanSat: 0, varSat: 1, flatRatio: 0, animeStyle: false };
  try {
    const SIZE = 64;
    const { data } = await sharp(imageBuffer)
      .resize(SIZE, SIZE, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixels = new Uint8Array(data);
    const total = SIZE * SIZE;
    let satSum = 0, satSumSq = 0, flatZones = 0;
    for (let i = 0; i < pixels.length; i += 3) {
      const r = pixels[i]/255, g = pixels[i+1]/255, b = pixels[i+2]/255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max; // saturación HSV
      satSum   += sat;
      satSumSq += sat * sat;
      // Zona plana: diferencia r/g/b < 0.05 → cel-shading
      if ((max - min) < 0.05) flatZones++;
    }
    const meanSat  = satSum / total;
    const varSat   = Math.max(0, (satSumSq / total) - (meanSat * meanSat));
    const flatRatio = flatZones / total;
    // Anime: alta saturación + baja varianza + muchas zonas planas
    const animeStyle = meanSat > 0.48 && varSat < 0.065 && flatRatio > 0.30;
    console.log(`[NSFW] Sat-anime: mean=${meanSat.toFixed(3)} var=${varSat.toFixed(3)} flat=${flatRatio.toFixed(2)} anime=${animeStyle}`);
    return { meanSat, varSat, flatRatio, animeStyle };
  } catch (err) {
    console.warn('[NSFW] SaturacionAnime error:', err.message);
    return { meanSat: 0, varSat: 1, flatRatio: 0, animeStyle: false };
  }
}

// ─── Sistema de puntuación de señales de píxeles ──────────────────────────────
// Cada señal analítica aporta puntos de "sospecha" (0-5 total).
// Los puntos ajustan dinámicamente los umbrales del consenso ML:
//   0-1:   ultra conservador (imagen parece inocente)
//   1-2:   normal
//   2-3.5: evidencia moderada → umbral ML más bajo
//   3.5+:  evidencia fuerte → umbral ML mucho más bajo
function calcularScoreSospecha({ skin, cartoon, saturacion, bordes, zona }) {
  let score = 0;
  const razones = [];

  // Piel real + alta cantidad
  if (!cartoon.isDrawing && skin.skinRatio > 0.50) {
    score += 1.5; razones.push(`piel_alta(${skin.skinRatio.toFixed(2)})`);
  } else if (!cartoon.isDrawing && skin.skinRatio > 0.35) {
    score += 0.8; razones.push(`piel_media(${skin.skinRatio.toFixed(2)})`);
  }

  // Piel lisa (poca textura) → superficie expuesta probable
  if (bordes.smoothSkin && skin.skinRatio > 0.25) {
    score += 1.5; razones.push(`piel_lisa`);
  }
  // Piel con textura → ropa/pelo, restar puntos (señal negativa)
  if (bordes.textureSkin) {
    score -= 1.0; razones.push(`textura_ropa(-)`);
  }

  // Piel concentrada en zona central
  if (zona.concentrated) {
    score += 1.0; razones.push(`zona_central`);
  }

  // Señal anime/hentai: cartoon + saturación de anime
  if (cartoon.isDrawing && saturacion.animeStyle) {
    score += 1.5; razones.push(`hentai_palette`);
  } else if (cartoon.isDrawing && saturacion.meanSat > 0.55) {
    score += 0.8; razones.push(`anime_sat`);
  }

  score = Math.max(0, Math.min(5, score));
  console.log(`[NSFW] Score sospecha: ${score.toFixed(2)} [${razones.join(', ')}]`);
  return score;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DAEMON PYTHON PERSISTENTE ────────────────────────────────────────────────
// Proceso Python que vive toda la sesión del bot.
// Elimina overhead de spawn (~500ms) → cada imagen cuesta ~5-50ms.
// Usa ThreadPoolExecutor(workers=cpu_count) → todas las imágenes en paralelo.
// Protocolo: JSON-lines en stdin/stdout.
// ═══════════════════════════════════════════════════════════════════════════════

let   _daemon      = null;         // ChildProcess del daemon
let   _daemonReady = false;        // true cuando el daemon envió {"status":"ready"}
let   _daemonBuf   = '';           // buffer de líneas parciales de stdout
const _pending     = new Map();    // id → { resolve, timeoutHandle, tmpPath }
const DAEMON_TIMEOUT_MS = 12000;   // timeout por imagen

// Busca el ejecutable Python priorizando el venv del proyecto
function _pyCmd() {
  const venvPy = path.join(__dirname, '..', '.venv', 'bin', 'python');
  return fs.existsSync(venvPy) ? venvPy : 'python3';
}

// Enviar línea JSON al daemon
function _daemonWrite(obj) {
  try {
    if (_daemon?.stdin?.writable) {
      _daemon.stdin.write(JSON.stringify(obj) + '\n');
      return true;
    }
  } catch (_) {}
  return false;
}

// Resolver un pending (limpiar tmp + resolver promesa)
function _resolvePending(id, result) {
  const item = _pending.get(id);
  if (!item) return;
  clearTimeout(item.timeoutHandle);
  _pending.delete(id);
  if (item.tmpPath) fs.promises.unlink(item.tmpPath).catch(() => {});
  const contrib = result.suspect_score_contribution ?? result.contribution ?? 0;
  item.resolve({ contribution: contrib, signals: result.signals || [], raw: result });
}

// Procesar una línea de stdout del daemon
function _daemonOnLine(line) {
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch (_) { return; }

  if (msg.status === 'ready') {
    _daemonReady = true;
    console.log(`[NSFW-DAEMON] ✅ Listo — ${msg.workers} workers | cv2=${msg.has_cv2} scipy=${msg.has_scipy} pid=${msg.pid}`);
    // Enviar peticiones que llegaron antes de que el daemon estuviera listo
    for (const [id, item] of _pending) {
      if (item.queued) { item.queued = false; _daemonWrite({ id, path: item.tmpPath }); }
    }
    return;
  }
  if (msg.id) _resolvePending(msg.id, msg);
}

// Iniciar daemon (llamado una vez al cargar el módulo)
function _startDaemon() {
  if (_daemon) return;
  const script = path.join(__dirname, 'nsfw_daemon.py');
  if (!fs.existsSync(script)) {
    console.warn('[NSFW-DAEMON] nsfw_daemon.py no encontrado — usando subprocess por imagen.');
    return;
  }
  try {
    _daemon = spawn(_pyCmd(), [script], { stdio: ['pipe', 'pipe', 'pipe'] });
    _daemon.stderr.on('data', d => {
      const s = d.toString().trim();
      if (s) console.log('[NSFW-DAEMON]', s);
    });
    _daemon.stdout.on('data', chunk => {
      _daemonBuf += chunk.toString();
      let nl;
      while ((nl = _daemonBuf.indexOf('\n')) !== -1) {
        const line = _daemonBuf.slice(0, nl).trim();
        _daemonBuf = _daemonBuf.slice(nl + 1);
        _daemonOnLine(line);
      }
    });
    _daemon.on('exit', (code) => {
      console.warn(`[NSFW-DAEMON] Proceso terminó (code=${code}) — se reiniciará en la próxima imagen.`);
      _daemon = null; _daemonReady = false;
      // Resolver todas las peticiones pendientes con error
      for (const [id] of _pending) _resolvePending(id, { contribution: 0, signals: [], error: 'daemon_exit' });
    });
    _daemon.on('error', (err) => {
      console.warn('[NSFW-DAEMON] Error de spawn:', err.message);
      _daemon = null; _daemonReady = false;
    });
    console.log('[NSFW-DAEMON] 🚀 Iniciando daemon Python...');
  } catch (err) {
    console.warn('[NSFW-DAEMON] No se pudo iniciar:', err.message);
    _daemon = null;
  }
}

// Iniciar daemon al cargar el módulo (calentamiento anticipado)
try { _startDaemon(); } catch (e) { console.warn('[NSFW-DAEMON] Init error:', e.message); }

// ─── Señal 6: Motor Python — vía daemon persistente (o subprocess fallback) ───
async function analizarConPython(imageBuffer) {
  // Si el daemon no está disponible, intentar reiniciarlo
  if (!_daemon) { try { _startDaemon(); } catch (_) {} }

  return new Promise(async (resolve) => {
    const reqId   = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    let   tmpPath = null;
    try {
      tmpPath = path.join(os.tmpdir(), `cnsfw_${reqId}.jpg`);
      await fs.promises.writeFile(tmpPath, imageBuffer);
    } catch (err) {
      return resolve({ contribution: 0, signals: [], error: 'write_tmp_failed' });
    }

    // ── Ruta rápida: daemon persistente ──────────────────────────────────────
    if (_daemon) {
      const timeoutHandle = setTimeout(() => {
        console.warn(`[NSFW-DAEMON] Timeout (${DAEMON_TIMEOUT_MS}ms) para ${reqId}`);
        _resolvePending(reqId, { contribution: 0, signals: [], error: 'timeout' });
      }, DAEMON_TIMEOUT_MS);

      _pending.set(reqId, { resolve, timeoutHandle, tmpPath, queued: !_daemonReady });

      if (_daemonReady) {
        _daemonWrite({ id: reqId, path: tmpPath });
      }
      // Si no está listo aún, la petición queda en cola y se envía cuando llegue "ready"
      return;
    }

    // ── Fallback: subprocess clásico (si el daemon no pudo iniciarse) ─────────
    console.warn('[NSFW-PY] Daemon no disponible, usando subprocess por imagen...');
    const venvPy  = path.join(__dirname, '..', '.venv', 'bin', 'python');
    const script  = path.join(__dirname, 'nsfw_py_signals.py');
    const pyCmd   = fs.existsSync(venvPy) ? venvPy : 'python3';
    const globalTimeout = setTimeout(() => {
      resolve({ contribution: 0, signals: [], error: 'timeout_subprocess' });
    }, DAEMON_TIMEOUT_MS);

    if (!fs.existsSync(script)) {
      clearTimeout(globalTimeout);
      if (tmpPath) fs.promises.unlink(tmpPath).catch(() => {});
      return resolve({ contribution: 0, signals: [], error: 'script_not_found' });
    }
    let output = '';
    const proc = spawn(pyCmd, [script, tmpPath]);
    proc.stdout.on('data', d => { output += d.toString(); });
    proc.stderr.on('data', d => { console.warn('[NSFW-PY-FB]', d.toString().trim()); });
    proc.on('close', async () => {
      clearTimeout(globalTimeout);
      if (tmpPath) fs.promises.unlink(tmpPath).catch(() => {});
      try {
        const r = JSON.parse(output.trim());
        const contrib = r.suspect_score_contribution || 0;
        if (contrib > 0) console.log(`[NSFW-PY-FB] contrib=${contrib} signals=[${(r.signals||[]).join(', ')}]`);
        resolve({ contribution: contrib, signals: r.signals || [], raw: r });
      } catch { resolve({ contribution: 0, signals: [], error: 'parse_error' }); }
    });
    proc.on('error', (err) => {
      clearTimeout(globalTimeout);
      if (tmpPath) fs.promises.unlink(tmpPath).catch(() => {});
      resolve({ contribution: 0, signals: [], error: err.message });
    });
  });
}

// ─── Voting ponderado: nsfwjs 60% + Xenova 40% ───────────────────────────────
function fusionarPredicciones(predsA, predsB) {
  const merged = new Map();
  const add = (preds, w) => (preds || []).forEach(p => {
    const k = p.label.toLowerCase();
    merged.set(k, (merged.get(k) || 0) + p.score * w);
  });
  add(predsA, 0.60);
  add(predsB, 0.40);
  return Array.from(merged.entries())
    .map(([label, score]) => ({ label, score }))
    .sort((a, b) => b.score - a.score);
}

export async function classifyImage(imageBuffer) {
  // ── Caché ──────────────────────────────────────────────────────────────────
  const hash = getImageHash(imageBuffer);
  const cached = cacheGet(hash);
  if (cached) {
    console.log(`[NSFW] Cache hit ${hash.slice(0,8)} → ${cached[0]?.label}`);
    return cached;
  }

  // ── pHash blacklist — bloqueo instantáneo de reenvíos NSFW conocidos ───────
  const pHash = await getPerceptualHash(imageBuffer);
  if (pHash && isInPHashBlacklist(pHash)) {
    console.log(`[NSFW] pHash blacklist hit: ${pHash} → NSFW instantáneo.`);
    const result = [{ label: 'porn', score: 0.99 }];
    cacheSet(hash, result);
    return result;
  }

  // ── Pre-filtro tamaño/formato ──────────────────────────────────────────────
  if (await preFiltro(imageBuffer) === 'skip') {
    const safe = [{ label: 'neutral', score: 1 }];
    cacheSet(hash, safe);
    return safe;
  }

  // ── FASE 1: 6 señales en PARALELO (5 JS puras + 1 motor Python) ───────────
  // JS   : cartoon, YCbCr, Sobel bordes, concentración zona, saturación anime
  // Python: LBP, GLCM, blob, entropy, DCT, face detection, Gabor, local variance (v2.0)
  // Todas corren en paralelo para minimizar latencia total.
  const [cartoon, skin, bordes, zona, saturacion, pySignals] = await Promise.all([
    detectarCartoon(imageBuffer),          // señal 1: dibujo vs foto real
    skinToneYCbCr(imageBuffer),            // señal 2: cantidad de piel YCbCr BT.601
    analizarBordesEnPiel(imageBuffer),     // señal 3: textura en zonas de piel (Sobel)
    analizarConcentracionPiel(imageBuffer),// señal 4: piel en zona central vs bordes
    analizarSaturacionAnime(imageBuffer),  // señal 5: paleta HSV tipo anime/cel-shading
    analizarConPython(imageBuffer),        // señal 6: LBP + GLCM + blob + entropy (Python)
  ]);

  if (cartoon.isDrawing) {
    console.log(`[NSFW] Cartoon detectado (conf=${cartoon.confidence.toFixed(2)}), pasa por ML igual.`);
  }

  // ── FASE 2: Score acumulado JS + Python ────────────────────────────────────
  // JS (0-5) + Python (0-3.5 v2.0: LBP+GLCM+blob+entropy+DCT+face+Gabor+localvar)
  //   0-1:   ultra conservador → Xenova > 0.90 Y nsfwjs > 0.70
  //   1-2:   normal            → Xenova > 0.75 Y nsfwjs > 0.55
  //   2-3.5: evidencia media   → Xenova > 0.60 Y nsfwjs > 0.45
  //   3.5+:  evidencia fuerte  → Xenova > 0.50 Y nsfwjs > 0.38
  const suspectScore = calcularScoreSospecha({ skin, cartoon, saturacion, bordes, zona })
                     + (pySignals.contribution || 0);

  let thX, thN;
  if (suspectScore >= 3.5) {
    thX = 0.50; thN = 0.38;
    console.log(`[NSFW] Score fuerte (${suspectScore.toFixed(2)}) → umbrales agresivos (X>${thX} N>${thN})`);
  } else if (suspectScore >= 2.0) {
    thX = 0.60; thN = 0.45;
    console.log(`[NSFW] Score moderado (${suspectScore.toFixed(2)}) → umbrales medios (X>${thX} N>${thN})`);
  } else if (suspectScore >= 1.0) {
    thX = 0.75; thN = 0.55;
    console.log(`[NSFW] Score bajo (${suspectScore.toFixed(2)}) → umbrales normales (X>${thX} N>${thN})`);
  } else {
    thX = 0.90; thN = 0.70;
    console.log(`[NSFW] Score mínimo (${suspectScore.toFixed(2)}) → umbrales conservadores (X>${thX} N>${thN})`);
  }

  // Señal negativa: piel con textura (ropa/pelo) → aumentar umbrales
  if (bordes.textureSkin && suspectScore < 2.0) {
    thX = Math.min(0.93, thX + 0.10);
    thN = Math.min(0.78, thN + 0.10);
    console.log(`[NSFW] Textura detectada → umbrales +0.10 (X>${thX.toFixed(2)} N>${thN.toFixed(2)})`);
  }

  // ── FASE 3: ML dual con umbrales dinámicos ─────────────────────────────────
  const predsXenova = await clasificarConXenova(imageBuffer);
  let result;

  if (predsXenova) {
    const xSafe = predsXenova.filter(p => SAFE_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
    const xNsfw = predsXenova.filter(p => NSFW_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
    console.log(`[NSFW] Xenova: safe=${xSafe.toFixed(2)} nsfw=${xNsfw.toFixed(2)}`);

    // Fast-safe: Xenova muy seguro + score pixel bajo → no gastar nsfwjs
    if (xSafe > 0.72 && xNsfw < 0.30 && suspectScore < 1.5) {
      console.log(`[NSFW] Xenova+pixel: seguro claro → SAFE`);
      result = [predsXenova[0]];
      cacheSet(hash, result);
      return result;
    }

    // Activar nsfwjs para consenso (en todos los demás casos)
    console.log(`[NSFW] Activando nsfwjs para consenso...`);
    const predsNsfwjs = await clasificarConNsfwjs(imageBuffer);

    if (predsNsfwjs) {
      const nSafe = predsNsfwjs.filter(p => SAFE_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
      const nNsfw = predsNsfwjs.filter(p => NSFW_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
      console.log(`[NSFW] nsfwjs: safe=${nSafe.toFixed(2)} nsfw=${nNsfw.toFixed(2)}`);

      if (xNsfw >= thX && nNsfw >= thN) {
        // Consenso NSFW con umbrales dinámicos ✓
        const fused = fusionarPredicciones(predsXenova, predsNsfwjs);
        if (pHash) addToNsfwBlacklist(pHash);
        console.log(`[NSFW] ✓ NSFW (X=${xNsfw.toFixed(2)}≥${thX} N=${nNsfw.toFixed(2)}≥${thN} score=${suspectScore.toFixed(2)})`);
        result = fused;
      } else if (xNsfw < (thX - 0.25) && nNsfw < (thN - 0.20)) {
        // Ambos bastante por debajo → seguro
        console.log(`[NSFW] ✓ SAFE claro (X=${xNsfw.toFixed(2)} N=${nNsfw.toFixed(2)})`);
        result = [{ label: 'neutral', score: Math.max(xSafe, nSafe) }];
      } else {
        // Discrepancia → beneficio de la duda → SAFE
        console.log(`[NSFW] Discrepancia sin consenso → SAFE (X=${xNsfw.toFixed(2)} N=${nNsfw.toFixed(2)})`);
        result = [{ label: 'neutral', score: Math.max(xSafe, nSafe) }];
      }
    } else {
      // nsfwjs no disponible → solo Xenova, umbral elevado + score pixel como apoyo
      const xOnlyTh = Math.min(0.93, thX + 0.15);
      if (xNsfw >= xOnlyTh && suspectScore >= 1.5) {
        const top = predsXenova.filter(p => NSFW_LABELS.has(p.label)).sort((a, b) => b.score - a.score)[0];
        console.log(`[NSFW] Solo Xenova + score pixel (${suspectScore.toFixed(2)}) → NSFW`);
        result = [top];
      } else {
        console.log(`[NSFW] Solo Xenova sin respaldo → SAFE conservador`);
        result = [predsXenova[0]];
      }
    }
  } else {
    // Xenova no disponible → nsfwjs con score de píxeles como apoyo
    console.warn('[NSFW] Xenova no disponible, usando nsfwjs con score pixel...');
    const predsNsfwjs = await clasificarConNsfwjs(imageBuffer);
    if (predsNsfwjs) {
      const nNsfw = predsNsfwjs.filter(p => NSFW_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
      const nsfwOnlyTh = suspectScore >= 2.0 ? 0.78 : 0.90;
      result = nNsfw >= nsfwOnlyTh
        ? [predsNsfwjs[0]]
        : [{ label: 'neutral', score: 1 - nNsfw }];
    } else {
      console.warn('[NSFW] Ambos modelos ML no disponibles. Fail-safe: imagen segura.');
      result = [{ label: 'neutral', score: 0.5 }];
    }
  }

  cacheSet(hash, result);
  return result;
}


// ─── Pre-calentamiento de modelos al arrancar ─────────────────────────────────
// Llamar en index.js al conectar (connection === 'open')
// Evita que la primera imagen tarde 5-10s esperando carga de modelo
export async function warmupModels() {
  console.log('[NSFW] 🔥 Pre-calentando modelos ML en paralelo...');
  const t0 = Date.now();
  const [xenovaOk, nsfwjsOk] = await Promise.allSettled([
    DISABLE_XENOVA ? Promise.resolve(null) : loadXenovaClassifier(),
    loadNsfwjsModel()
  ]);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[NSFW] ✅ Modelos listos en ${elapsed}s — Xenova: ${xenovaOk.status} · nsfwjs: ${nsfwjsOk.status}`);
}

export function mapFriendlyLabel(label) {
  const map = {
    porn:          'pornografía',
    pornography:   'pornografía',
    sexy:          'contenido sexualizado',
    hentai:        'hentai/anime NSFW',
    neutral:       'contenido neutral',
    drawing:       'ilustración/dibujo',
    nsfw_fallback: 'contenido sexual (análisis rápido)',
    sfw_fallback:  'imagen segura'
  };
  return map[(label || '').toLowerCase()] || label || 'contenido analizado';
}

export function isNSFWPrediction(label, score = 0) {
  if (!label) return false;
  const normalized = label.toLowerCase();
  if (SAFE_LABELS.has(normalized)) return false;
  const threshold = THRESHOLDS[normalized] ?? 0.88;
  return score >= threshold;
}
