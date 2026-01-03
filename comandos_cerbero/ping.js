import os from 'os';
import { performance } from 'perf_hooks';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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


export const ping = async (sock, msg) => {
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

        // Detectar arquitectura
        const arch = os.arch();
        const isArm = arch === 'arm' || arch === 'arm64' || arch === 'aarch64';

        // Variables de telemetría
        let cpuLoad, cpuTemp, totalRam, usedRam, gpuTemp, fanSpeed, uptime, specs, osDisplay, message;

        uptime = formatUptime(process.uptime());

        if (isArm) {
            // Simulación de Samsung Galaxy S24 Ultra (Snapdragon 8 Gen 3)
            cpuLoad = (Math.random() * (28 - 6) + 6).toFixed(1);
            cpuTemp = Math.floor(Math.random() * (60 - 38) + 38);
            totalRam = 12;
            usedRam = (Math.random() * (7 - 3) + 3).toFixed(2);
            gpuTemp = Math.floor(Math.random() * (55 - 38) + 38);
            fanSpeed = '—'; // No hay ventiladores en móviles
            specs = {
                model: "Samsung Galaxy S24 Ultra (SM-S928U)",
                board: "Qualcomm Snapdragon 8 Gen 3 (SM8650-AB)",
                cpu: "Kryo 8-Core (1x3.39GHz + 5x3.1GHz + 2x2.2GHz)",
                gpu: "Adreno 750",
                vram: "— (GPU integrada)",
                ram: "12 GB LPDDR5X @ 8533 MHz",
                config: "Single Channel",
                storage: "1TB UFS 4.0",
                display: "6.8\" Dynamic AMOLED 2X 3120x1440 120Hz"
            };
            osDisplay = `Cerbero-OS android ARM64 ${os.release()})`;
        } else {
            // Simulación de laptop workstation
                            cpuLoad = (Math.random() * (35 - 8) + 8).toFixed(1);
                            cpuTemp = Math.floor(Math.random() * (85 - 55) + 55);
                            totalRam = 64;
                            usedRam = (Math.random() * (20 - 14) + 14).toFixed(2);
                            gpuTemp = Math.floor(Math.random() * (78 - 60) + 60);
                            fanSpeed = Math.floor(Math.random() * (5200 - 3500) + 3500);
                            specs = {
                                model: "MSI Titan GT77 HX (Custom Workstation)",
                                board: "Intel® HM670 Express Chipset",
                                cpu: "Intel® Core™ i5-12600HX (12C/16T) @ 4.60 GHz",
                                gpu: "NVIDIA® GeForce RTX™ 3080 Ti Laptop GPU",
                                vram: "16GB GDDR6 (Max-P 175W TGP)",
                                ram: "64 GB Samsung DDR4 @ 3200 MHz",
                                config: "4x16GB SO-DIMM (Quad Slot)",
                                storage: "1TB Kingston NV1 (OS) + 1TB Kingston A400 (Data)",
                                display: "17.3\" 4K UHD 120Hz Mini-LED"
                            };
                            osDisplay = `${os.platform().toUpperCase()} Kernel ${os.release()}`;
                            if (os.platform() === 'linux' && os.arch() === 'x64') {
                                osDisplay = `Linux Kernel ${os.release()}`;
                            }
                        }

                        // Construir mensaje sin indentación extra para evitar líneas desordenadas
                        const messageLines = [
'╔═══[ *𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 𝐃𝐈𝐀𝐆𝐍𝐎𝐒𝐓𝐈𝐂𝐒* ]═══╗',
'║',
`║ 🤖 *[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] v4.2.7 Build 74*`,
`║ ⏱️ *Uptime:* ${uptime}`,
'║',
'╠══ [ *📡 SENSORS & COOLING* ] ══',
`║ 📶 *Ping:* ${latency} ms`,
`║ 📉 *CPU:* ${cpuLoad}% @ ${cpuTemp}°C`,
`║ 🌪️ *Fans:* ${fanSpeed} ${(isArm ? '(Fanless/Passive)' : 'RPM (CoolerBoost)')}`,
`║ 🌡️ *GPU:* ${gpuTemp}°C (High Perf)`,
`║ 🧠 *RAM:* ${usedRam}/${totalRam} GB`,
'║',
`╠══ [ *${isArm ? '📱 ANDROID FLAGSHIP' : '💻 DTR WORKSTATION'}* ] ══`,
`║ ${isArm ? '📱' : '💻'} *Chassis:* ${specs.model}`,
`║ 💠 *Chipset:* ${specs.board}`,
'║',
'║ 🧮 *Processor:*',
`║ └─ ${specs.cpu}`,
'║',
'║ 🎮 *Graphics Unit:*',
`║ └─ ${specs.gpu}`,
`║ └─ ${specs.vram}`,
'║',
'║ 🧩 *Memory:*',
`║ └─ ${specs.ram}`,
`║ └─ ${specs.config}`,
'║',
'║ 💽 *Storage:**',
`║ └─ ${specs.storage}`,
'║',
'║ 🖥️ *Display:*',
`║ └─ ${specs.display}`,
'║',
'║ 🖥️ *Operating System:*',
`║ └─ ${osDisplay}`,
'║',
'╚════════════════════════════╝',
`║ 🤖 *[𝐂𝐄𝐑�𝐁𝐑𝐎-𝐁𝐎𝐓] v4.2.10 Build 78*`
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