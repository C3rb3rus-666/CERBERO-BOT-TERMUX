// nsfw_classifier.js — Pipeline anti-NSFW de 3 capas + Gemini judge
// Coded by C3rb3rus-666

import { pipeline, env as xenovaEnv } from '@xenova/transformers';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const _require   = createRequire(import.meta.url);

// Apuntar Xenova a caché local — sin red en arranques sucesivos
xenovaEnv.cacheDir         = path.join(__dirname, '..', 'models_cache');
xenovaEnv.allowLocalModels  = true;
xenovaEnv.allowRemoteModels = true;   // permite re-descarga si se borra el cache
xenovaEnv.backends          = { onnx: { wasm: { numThreads: 1 } } };

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
  _jimp = _require('jimp');
} catch (err) {
  console.warn('[NSFW] jimp no disponible (pHash desactivado):', err.message);
}

// Google Gemini Vision — juez supremo para casos borderline extremos
let _gemini = null;
try {
  const { GoogleGenerativeAI } = _require('@google/generative-ai');
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
  if (apiKey) {
    const client = new GoogleGenerativeAI(apiKey);
    _gemini = client.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('[NSFW] Gemini Vision disponible como juez supremo.');
  } else {
    console.warn('[NSFW] GEMINI_API_KEY no configurada, juez Gemini desactivado.');
  }
} catch (err) {
  console.warn('[NSFW] @google/generative-ai no disponible:', err.message);
}

// ─── Etiquetas globales ───────────────────────────────────────────────────────
const SAFE_LABELS = new Set(['neutral', 'drawing', 'safe', 'sfw_fallback']);
const NSFW_LABELS = new Set(['porn', 'pornography', 'sexy', 'hentai', 'nsfw_fallback']);

const THRESHOLDS = {
  porn:          0.78,
  pornography:   0.78,
  hentai:        0.80,
  sexy:          0.93,   // alto: evita cosplay, bikinis, playa, arte
  nsfw_fallback: 0.85
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

// ─── Juez Gemini Vision (sólo para borderline extremo) ───────────────────────
async function juzgarConGemini(imageBuffer) {
  if (!_gemini) return null;
  try {
    const base64 = imageBuffer.toString('base64');
    const prompt = [
      'Analyze this image ONLY for content moderation. Answer with ONE word: NSFW or SAFE.',
      'NSFW = explicit nudity, pornography, graphic sexual content.',
      'SAFE = everything else: drawings, cartoons, clothed people, memes, nature, food, etc.',
      'Do NOT explain. Only reply: NSFW or SAFE'
    ].join(' ');
    const result = await _gemini.generateContent([
      { inlineData: { mimeType: 'image/jpeg', data: base64 } },
      prompt
    ]);
    const text = result.response.text().trim().toUpperCase();
    const isNsfw = text.startsWith('NSFW');
    console.log(`[NSFW] Gemini judge: ${text} → ${isNsfw ? 'NSFW' : 'SAFE'}`);
    return isNsfw
      ? [{ label: 'porn', score: 0.95 }]
      : [{ label: 'neutral', score: 0.95 }];
  } catch (err) {
    console.error('[NSFW] Gemini error:', err.message);
    return null;
  }
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

// ─── CAPA 1: Pre-filtro por tamaño/formato ───────────────────────────────────
async function preFiltro(imageBuffer) {
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
  try {
    const cl = await loadXenovaClassifier();
    if (!cl) return null;
    const raw = await cl(imageBuffer);
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
  }
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
  // ── Capa 1: Caché ──────────────────────────────────────────────────────────
  const hash = getImageHash(imageBuffer);
  const cached = cacheGet(hash);
  if (cached) {
    console.log(`[NSFW] Cache hit ${hash.slice(0,8)} → ${cached[0]?.label}`);
    return cached;
  }

  // ── pHash blacklist (bloqueo instantáneo de reenvíos NSFW conocidos) ─────────
  const pHash = await getPerceptualHash(imageBuffer);
  if (pHash && isInPHashBlacklist(pHash)) {
    console.log(`[NSFW] pHash blacklist hit: ${pHash} → NSFW instantáneo.`);
    const result = [{ label: 'porn', score: 0.99 }];
    cacheSet(hash, result);
    return result;
  }

  // ── Capa 1: Pre-filtro tamaño/formato ─────────────────────────────────────
  if (await preFiltro(imageBuffer) === 'skip') {
    const safe = [{ label: 'neutral', score: 1 }];
    cacheSet(hash, safe);
    return safe;
  }

  // ── Capa 2A: Cartoon detector ──────────────────────────────────────────────
  const cartoon = await detectarCartoon(imageBuffer);
  if (cartoon.isDrawing && cartoon.confidence > 0.70) {
    console.log(`[NSFW] Cartoon confirmado (${cartoon.confidence.toFixed(2)}), seguro.`);
    const safe = [{ label: 'drawing', score: cartoon.confidence }];
    cacheSet(hash, safe);
    return safe;
  }

  // ── Capa 2B: YCbCr skin ────────────────────────────────────────────────────
  const skin = await skinToneYCbCr(imageBuffer);

  // Dibujo + poca piel real → definitivamente seguro
  if (cartoon.isDrawing && skin.skinRatio < 0.20) {
    const safe = [{ label: 'drawing', score: 0.85 }];
    cacheSet(hash, safe);
    return safe;
  }

  // YCbCr es solo una SEÑAL para los modelos ML, NUNCA actuía solo.
  // Fotos normales con cara/brazos visibles alcanzan 35%+ de piel YCbCr
  // y disparan falsos positivos si se usan como único criterio.
  // Se pasa skin como contexto informativo a la capa ML.
  console.log(`[NSFW] YCbCr señal: skinRatio=${skin.skinRatio.toFixed(3)}, pasando a ML...`);

  // ── Capa 3: ML dual — Xenova (ONNX) primero, nsfwjs si borderline ──────────
  // Xenova usa ONNX runtime (~2-3x más rápido que TF.js puro sin AVX)
  const predsXenova = await clasificarConXenova(imageBuffer);
  let result;

  if (predsXenova) {
    const xSafe = predsXenova.filter(p => SAFE_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
    const xNsfw = predsXenova.filter(p => NSFW_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);

    // Xenova concluyentemente seguro → listo, sin activar nsfwjs
    if (xSafe > 0.72 && xNsfw < 0.70) {
      console.log(`[NSFW] Xenova: seguro (safe=${xSafe.toFixed(2)})`);
      result = [predsXenova[0]];
      cacheSet(hash, result);
      return result;
    }

    // Xenova concluyentemente NSFW → actuar sin nsfwjs
    if (xNsfw > 0.90 && xSafe < 0.20) {
      console.log(`[NSFW] Xenova: NSFW claro (${xNsfw.toFixed(2)})`);
      const top = predsXenova.filter(p => NSFW_LABELS.has(p.label)).sort((a, b) => b.score - a.score)[0];
      result = [top];
      cacheSet(hash, result);
      return result;
    }

    // Borderline → activar nsfwjs como árbitro (ya pre-cargado en warmup)
    console.log(`[NSFW] Borderline Xenova (safe=${xSafe.toFixed(2)} nsfw=${xNsfw.toFixed(2)}), activando nsfwjs...`);
    const predsNsfwjs = await clasificarConNsfwjs(imageBuffer);

    if (predsNsfwjs) {
      const fused = fusionarPredicciones(predsXenova, predsNsfwjs);
      const fSafe = fused.filter(p => SAFE_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);
      const fNsfw = fused.filter(p => NSFW_LABELS.has(p.label)).reduce((m, p) => Math.max(m, p.score), 0);

      if (fSafe > 0.35 && fNsfw < 0.90) {
        result = [{ label: 'neutral', score: fSafe }];
      } else if (fNsfw >= 0.90) {
        if (pHash) addToNsfwBlacklist(pHash);
        console.log(`[NSFW] Fusión confirmó NSFW, pHash añadido a blacklist.`);
        result = fused;
      } else {
        // Aún borderline: Gemini como juez supremo
        console.log(`[NSFW] Aún borderline después de fusión, invocando Gemini...`);
        const geminiResult = await juzgarConGemini(imageBuffer);
        if (geminiResult) {
          const isGeminiNsfw = NSFW_LABELS.has(geminiResult[0]?.label);
          if (isGeminiNsfw && pHash) addToNsfwBlacklist(pHash);
          result = geminiResult;
        } else {
          result = [{ label: 'neutral', score: 0.5 }];
        }
      }
    } else {
      // nsfwjs no disponible → Gemini directo
      const geminiResult = await juzgarConGemini(imageBuffer);
      result = geminiResult || [{ label: 'neutral', score: 0.5 }];
    }
  } else {
    // Xenova no disponible → nsfwjs como único modelo
    console.warn('[NSFW] Xenova no disponible, usando nsfwjs directo...');
    const predsNsfwjs = await clasificarConNsfwjs(imageBuffer);
    if (predsNsfwjs) {
      result = [predsNsfwjs[0]];
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
    loadXenovaClassifier(),
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
