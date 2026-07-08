// utils/imageUtil.js
// ─────────────────────────────────────────────────────────────────────────────
// 🖼️ UTILIDAD DE IMÁGENES — CERBERO-BOT-TERMUX TERMUX ARM64
// ─────────────────────────────────────────────────────────────────────────────
// 100% jimp — puro JavaScript, CERO binarios nativos, CERO node-gyp.
// Garantizado en ARM64/AArch64 (Termux). No requiere libvips, cairo ni nada.
// ─────────────────────────────────────────────────────────────────────────────

import { Jimp } from 'jimp';

/**
 * Redimensiona y optimiza una imagen para usarla como sticker.
 * Output: PNG 512x512 con fondo transparente / contenido ajustado.
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer>} PNG 512x512
 */
export async function optimizeImageForSticker(inputBuffer) {
  const image = await Jimp.read(inputBuffer);
  image.contain({ w: 512, h: 512 });
  return image.getBuffer('image/png');
}

/**
 * Convierte cualquier formato (WebP, JPEG, etc.) a PNG.
 * Usado para extraer imágenes de stickers WebP.
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer>} PNG buffer
 */
export async function convertToPng(inputBuffer) {
  const image = await Jimp.read(inputBuffer);
  return image.getBuffer('image/png');
}

/**
 * Redimensiona una imagen a las dimensiones dadas.
 * @param {Buffer} inputBuffer
 * @param {number} width
 * @param {number} height
 * @param {'cover'|'contain'|'fill'} fit
 * @returns {Promise<Buffer>}
 */
export async function resizeImage(inputBuffer, width, height, fit = 'cover') {
  const image = await Jimp.read(inputBuffer);
  if (fit === 'contain') {
    image.contain({ w: width, h: height });
  } else if (fit === 'cover') {
    image.cover({ w: width, h: height });
  } else {
    image.resize({ w: width, h: height });
  }
  return image.getBuffer(image.mime);
}

/**
 * Devuelve info básica de una imagen (ancho, alto, formato MIME).
 * @param {Buffer} inputBuffer
 * @returns {Promise<{width: number, height: number, format: string}>}
 */
export async function getImageInfo(inputBuffer) {
  const image = await Jimp.read(inputBuffer);
  return {
    width:  image.bitmap.width,
    height: image.bitmap.height,
    format: image.mime.split('/')[1], // 'png', 'jpeg', 'webp', etc.
  };
}

/**
 * Redimensiona a WxH y devuelve píxeles en escala de grises como Uint8Array.
 * Usado por el detector de cartoons en nsfw_classifier.
 * @param {Buffer} inputBuffer
 * @param {number} width
 * @param {number} height
 * @returns {Promise<Uint8Array>} Un byte por píxel (0-255)
 */
export async function toGreyscaleRaw(inputBuffer, width, height) {
  const image = await Jimp.read(inputBuffer);
  image.resize({ w: width, h: height });
  image.greyscale();
  const rgba = new Uint8Array(image.bitmap.data); // RGBA, 4 bytes por píxel
  // Canal R = valor de gris (R === G === B tras greyscale)
  const grey = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4];
  return grey;
}

/**
 * Redimensiona a WxH y devuelve píxeles RGB sin alpha como Uint8Array.
 * Usado por el detector de tono de piel YCbCr en nsfw_classifier.
 * @param {Buffer} inputBuffer
 * @param {number} width
 * @param {number} height
 * @returns {Promise<{data: Uint8Array}>}
 */
export async function toRgbRaw(inputBuffer, width, height) {
  const image = await Jimp.read(inputBuffer);
  image.resize({ w: width, h: height });
  const rgba = new Uint8Array(image.bitmap.data); // RGBA
  // Convertir RGBA → RGB (eliminar canal alpha)
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  let j = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    rgb[j++] = rgba[i];     // R
    rgb[j++] = rgba[i + 1]; // G
    rgb[j++] = rgba[i + 2]; // B
    // omitir rgba[i + 3] (alpha)
  }
  return { data: rgb };
}
