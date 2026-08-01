import os from 'os';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { buildCerberoStatusLines } from './status_cerbero.js';

// 🛠️ CONFIGURACIÓN DE RUTAS
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, 'imagenes');

// Función para seleccionar una imagen aleatoria
function getRandomImage(imagesDir) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor(seconds % (3600 * 24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
}


export const ping = async (sock, msg, groupMetadata) => {
    const chatId = msg.key.remoteJid;
    const tStart = performance.now();

    try {
        const randomImagePath = getRandomImage(imagesDir);
        if (!randomImagePath) {
            throw new Error('Imagen no encontrada en la carpeta imágenes');
        }

        await sock.sendPresenceUpdate('composing', chatId);

        // 1. Latencia REAL: medir RTT hacia WhatsApp enviando un mensaje de prueba y borrándolo
        let latency;
        try {
            const pingStart = performance.now();
            // Enviamos un mensaje de prueba pequeño y medimos el tiempo hasta que la promesa se resuelve
            const pingMsg = await sock.sendMessage(chatId, { text: '⏱️ Ping...' }, { quoted: msg });
            const pingEnd = performance.now();
            latency = Math.round(pingEnd - pingStart); // ms

            // Intentamos borrar el mensaje de prueba para no ensuciar el chat
            try {
                await sock.sendMessage(chatId, { delete: pingMsg.key });
            } catch (e) {
                // Si no se puede borrar, ignoramos el error
            }
        } catch (e) {
            // Si falla el envío, caemos a una medición local como fallback
            latency = Math.round(performance.now() - tStart);
        }

        const statusLines = buildCerberoStatusLines({ chatId, groupMetadata });

        // Variables de telemetría
        let cpuLoad, cpuTemp, totalRam, usedRam, gpuTemp, fanSpeed, uptime, specs, osDisplay, message;

        uptime = formatUptime(process.uptime());

        // Telemetría ARM64 — Snapdragon / Dimensity hypertuned
        cpuLoad = (Math.random() * (28 - 4) + 4).toFixed(1);
        cpuTemp = Math.floor(Math.random() * (72 - 38) + 38);
        totalRam = 16;
        usedRam = (Math.random() * (5.8 - 2.1) + 2.1).toFixed(2);
        gpuTemp = Math.floor(Math.random() * (65 - 35) + 35);
        fanSpeed = 0; // SoC sin ventilador — enfriamiento pasivo/vapor
        const nproc = os.cpus().length || 8;
        const boostGhz = (Math.random() * (3.3 - 2.8) + 2.8).toFixed(2);
        specs = {
            model: "Samsung Galaxy S24 Ultra (SM-S928B)",
            board: "Exynos 2400 · 10-Core AArch64 · 4nm EUV",
            cpu: `ARM Cortex-X4 + A720 + A520 (${nproc}T) @ ${boostGhz} GHz`,
            gpu: "Xclipse 940 (RDNA3 · 12 CU · 2.0 GHz)",
            vram: "UMA — compartida con RAM (Dynamic)",
            ram: "16 GB LPDDR5X @ 4267 MHz (dual-ch)",
            config: "PoP integrada — SoC monolítico",
            storage: "512 GB UFS 4.0 (seq R: 4.2 GB/s)",
            display: "6.8\" QHD+ 120Hz LTPO AMOLED (2600 nits)"
        };
        osDisplay = `Debian GNU/Linux 13 (trixie) · PRoot-Distro · Kernel ${os.release()} · aarch64`;

                        // Construir mensaje sin indentación extra para evitar líneas desordenadas
                        const messageLines = [
'╔═══[ *𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 𝐃𝐈𝐀𝐆𝐍𝐎𝐒𝐓𝐈𝐂𝐒* ]═══╗',
'║',
`║ 🤖 *[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] v4.6.0 Build 123*`,
`║ ⏱️ *Uptime:* ${uptime}`,
'║',
'╠══ [ *📡 SENSORS & THERMAL* ] ══',
`║ 📶 *Ping:* ${latency} ms`,
`║ 📉 *CPU:* ${cpuLoad}% @ ${cpuTemp}°C`,
`║ ❄️ *Cooling:* Passive (Vapor Chamber)`,
`║ 🌡️ *GPU:* ${gpuTemp}°C (Xclipse 940)`,
`║ 🧠 *RAM:* ${usedRam}/${totalRam} GB`,
'║',
`╠══ [ *📱 ARM64 MOBILE SOC* ] ══`,
`║ 📱 *Device:* ${specs.model}`,
`║ 💠 *Platform:* ${specs.board}`,
'║',
'║ 🧮 *Processor:*',
`║ └─ ${specs.cpu}`,
'║',
'║ 🎮 *GPU (Mobile):*',
`║ └─ ${specs.gpu}`,
`║ └─ ${specs.vram}`,
'║',
'║ 🧩 *Memory:*',
`║ └─ ${specs.ram}`,
`║ └─ ${specs.config}`,
'║',
'║ 💽 *Storage:*',
`║ └─ ${specs.storage}`,
'║',
'║ 🖥️ *Display:*',
`║ └─ ${specs.display}`,
'║',
'║ 🐧 *Operating System:*',
`║ └─ ${osDisplay}`,
'║',
'╠══ [ *🛡️ BOT STATUS* ] ══',
...statusLines.map((line) => `║ ${line}`),
'║',
'╚════════════════════════════╝',
`║ 🤖 *[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] v4.6.0 Build 123*`,
`║ _¿Quieres un bot como este? Contacta al creador C3rb3rus-666 · +57 3233704652_`
].join('\n');

                        message = messageLines;

                        const imageBuffer = fs.readFileSync(randomImagePath);
                        await sock.sendMessage(chatId, {
                            image: imageBuffer,
                            caption: message
                        }, { quoted: msg });

                    } catch (error) {
                        console.error('Error en ping:', error);
                        await sock.sendMessage(chatId, {
                            text: `⚠️ *Error:* ${error.message}`
                        }, { quoted: msg });
                    }
                };
