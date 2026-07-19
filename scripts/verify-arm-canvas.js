import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';

const canvasPkgDir = path.dirname(
  new URL(import.meta.resolve('canvas/package.json')).pathname
);
const nativeAddonPath = path.join(canvasPkgDir, 'build', 'Release', 'canvas.node');

if (!fs.existsSync(nativeAddonPath)) {
  throw new Error(`No existe el addon nativo de canvas: ${nativeAddonPath}`);
}

const canvas = createCanvas(320, 180);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#101820';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#f2aa4c';
ctx.font = 'bold 24px Sans';
ctx.fillText('CERBERO ARM', 24, 64);
ctx.strokeStyle = '#f2aa4c';
ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

const png = canvas.toBuffer('image/png');
if (!Buffer.isBuffer(png) || png.length < 1024) {
  throw new Error('canvas genero un PNG invalido o demasiado pequeno.');
}

await loadImage(png);

console.log(`canvas_ok ${nativeAddonPath}`);
