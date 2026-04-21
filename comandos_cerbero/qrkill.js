import QRCodeReader from 'qrcode-reader';
import { Jimp } from "jimp";
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, 'imagenes');

const userMessageTracker = new Map(); // Rastrea mensajes de cada usuario

// ─── Caché de firmas ya analizadas ──────────────────────────────────────────
// Guarda el resultado (true/false) de imágenes ya procesadas por su SHA256.
// Evita re-descargar y re-decodificar la misma imagen si la reenvían.
const _qrCache = new Map();
const QR_CACHE_MAX = 400; // máximo de entradas en caché

// Tamaño máximo al que se redimensiona antes de decodificar.
// Los QR son detectables incluso a 200px; 600px da margen para QR pequeños.
const QR_SCAN_SIZE = 600;

function _getCacheKey(imageMessage) {
    if (!imageMessage) return null;
    const sha = imageMessage.fileSha256;
    if (sha && sha.length) {
        try {
            return Buffer.isBuffer(sha) ? sha.toString('hex') : Buffer.from(sha).toString('hex');
        } catch (_) {}
    }
    // Fallback: tamaño + mimetype
    return `${imageMessage.fileLength || 0}|${imageMessage.mimetype || ''}`;
}

// Decodificar QR con sharp (resize rápido) + jimp + qrcode-reader
async function decodeQRCode(rawBuffer) {
    // 1. Redimensionar con sharp (nativo, 10-50× más rápido que Jimp resize)
    let resizedBuffer;
    try {
        resizedBuffer = await sharp(rawBuffer)
            .resize(QR_SCAN_SIZE, QR_SCAN_SIZE, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer();
    } catch (_) {
        // Si sharp falla (formato raro), usar el buffer original
        resizedBuffer = rawBuffer;
    }

    // 2. Leer con Jimp y decodificar QR
    const image = await Jimp.read(resizedBuffer);
    const qr = new QRCodeReader();
    return new Promise((resolve, reject) => {
        qr.callback = (err, value) => (err ? reject(err) : resolve(value));
        qr.decode(image.bitmap);
    });
}

/**
 * Detecta y bloquea imágenes con códigos QR de WhatsApp.
 * @returns {boolean} true si se detectó y manejó un QR, false en caso contrario.
 */
export async function blockQr(sock, message, isAdmin, groupMetadata) {
    const { key, message: msg } = message;
    const chatId = key.remoteJid;
    const isImage = msg?.imageMessage;

    let participant = message.participant || key.participant || key.remoteJid;

    if (!isImage) return false;

    try {
        if (!participant) {
            console.log("[QR] No se pudo identificar al remitente. Ignorando.");
            return false;
        }

        // ─── Caché: evitar re-procesar la misma imagen ───────────────────────
        const cacheKey = _getCacheKey(msg.imageMessage);
        if (cacheKey && _qrCache.has(cacheKey)) {
            const cached = _qrCache.get(cacheKey);
            console.log(`[QR] Caché hit (${cached ? 'QR' : 'segura'}): ${cacheKey.slice(0, 16)}...`);
            if (!cached) return false; // imagen conocida como segura, saltar
            // Si era QR conocido: actuar directamente sin re-decodificar
        }

        // ─── Registrar mensaje del usuario ───────────────────────────────────
        if (!userMessageTracker.has(participant)) {
            userMessageTracker.set(participant, { messages: [], warned: false });
        }
        const userInfo = userMessageTracker.get(participant);
        userInfo.messages.push(key);

        let qrResult = null;

        if (cacheKey && _qrCache.has(cacheKey)) {
            // Ya sabemos que es QR, no re-decodificamos
            qrResult = { result: 'chat.whatsapp.com' };
        } else {
            // ─── Descargar imagen ─────────────────────────────────────────────
            const stream = await downloadContentFromMessage(msg.imageMessage, 'image');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const imageBuffer = Buffer.concat(chunks);

            // ─── Decodificar QR (con resize automático vía sharp) ─────────────
            try {
                qrResult = await decodeQRCode(imageBuffer);
            } catch (_) {
                // No contiene QR — resultado esperado para imágenes normales
                if (cacheKey) {
                    if (_qrCache.size >= QR_CACHE_MAX) _qrCache.delete(_qrCache.keys().next().value);
                    _qrCache.set(cacheKey, false); // cachear como "segura"
                }
                return false;
            }

            // ─── Guardar en caché ─────────────────────────────────────────────
            if (cacheKey) {
                if (_qrCache.size >= QR_CACHE_MAX) _qrCache.delete(_qrCache.keys().next().value);
                _qrCache.set(cacheKey, qrResult?.result?.includes('chat.whatsapp.com') ?? false);
            }
        }

        if (qrResult?.result?.includes('chat.whatsapp.com')) {
            console.log(`[QR] Código QR de WhatsApp detectado. Enviado por: ${participant}`);

            if (userInfo.warned) return true;
            userInfo.warned = true;

            // ─── PASO 1: CERRAR el grupo INMEDIATAMENTE ───────────────────────
            // Bloquea cualquier mensaje entrante mientras se procesa el ataque.
            // Sin reapertura automática — un admin debe reabrirlo manualmente.
            try {
                await sock.groupSettingUpdate(chatId, 'announcement'); // solo admins pueden escribir
                console.log('[QR] 🔒 Grupo cerrado por ataque QR. Reapertura manual requerida.');
            } catch (lockErr) {
                console.error('[QR] Error cerrando grupo:', lockErr.message);
            }

            // ─── PASO 2: BORRAR el mensaje QR de inmediato ────────────────────
            try {
                await sock.sendMessage(chatId, { delete: key });
            } catch (delErr) {
                console.error('[QR] Error borrando mensaje QR:', delErr.message);
            }

            // ─── PASO 3: Expulsar + notificar en PARALELO ─────────────────────
            const notifText = !isAdmin
                ? `╔═══════════════════════╗\n` +
                  `║  🚨 *[ 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 ]* 🚨\n` +
                  `╠═══════════════════════╣\n` +
                  `║ ⛔ *CÓDIGO QR DE WHATSAPP*\n` +
                  `║    de @${participant.split('@')[0]}\n` +
                  `║\n` +
                  `║ 🔒 *Grupo cerrado* por seguridad\n` +
                  `║ 🗑️ *Mensaje eliminado* automáticamente\n` +
                  `║ 🚫 *Usuario expulsado* del grupo\n` +
                  `║ 📝 *Reapertura manual* requerida\n` +
                  `╠═══════════════════════╣\n` +
                  `║    *Coded by c3rb3rus-666*\n` +
                  `╚═══════════════════════╝`
                : `╔═══════════════════════╗\n` +
                  `║  🚨 *[ 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 ]* 🚨\n` +
                  `╠═══════════════════════╣\n` +
                  `║ ⚠️ *CÓDIGO QR detectado*\n` +
                  `║    de admin @${participant.split('@')[0]}\n` +
                  `║\n` +
                  `║ 🔒 *Grupo cerrado* por seguridad\n` +
                  `║ 🗑️ *Imagen eliminada* automáticamente\n` +
                  `║ 📝 *Reapertura manual* requerida\n` +
                  `╠═══════════════════════╣\n` +
                  `║    *Coded by c3rb3rus-666*\n` +
                  `╚═══════════════════════╝`;

            // Imagen aleatoria del directorio imagenes (igual que antilink)
            let imagePath = null;
            try {
                const files = fs.readdirSync(imagesDir);
                const images = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f));
                if (images.length > 0) {
                    imagePath = path.join(imagesDir, images[Math.floor(Math.random() * images.length)]);
                }
            } catch (_) {}

            const sendNotif = async () => {
                await sock.sendPresenceUpdate('composing', chatId);
                if (imagePath) {
                    await sock.sendMessage(chatId, {
                        image: { url: imagePath },
                        caption: notifText,
                        mentions: [participant],
                        quoted: { key, message: msg }
                    });
                } else {
                    await sock.sendMessage(chatId, {
                        text: notifText,
                        mentions: [participant],
                        quoted: { key, message: msg }
                    });
                }
            };

            const tasks = [
                sendNotif().catch(e => console.error('[QR] Error notificando:', e.message))
            ];
            if (!isAdmin) {
                tasks.push(
                    sock.groupParticipantsUpdate(chatId, [participant], 'remove').catch(e =>
                        console.error('[QR] Error expulsando:', e.message)
                    )
                );
            }
            await Promise.all(tasks);

            // ─── PASO 4: Borrar historial del usuario en paralelo ─────────────
            const deletePromises = userInfo.messages
                .filter(k => k.id !== key.id)
                .map(messageKey =>
                    sock.sendMessage(chatId, { delete: messageKey }).catch(e =>
                        console.error('[QR] Error borrando mensaje histórico:', e.message)
                    )
                );
            if (deletePromises.length) await Promise.all(deletePromises);

            userMessageTracker.delete(participant);
            return true;
        }

        return false;
    } catch (err) {
        if (
            err?.message?.includes("Couldn't find enough finder patterns") ||
            err?.message?.includes('FormatError') ||
            err?.message?.includes('decode')
        ) {
            return false; // No es QR — silenciar error esperado
        }
        console.error(`[QR] Error procesando imagen:`, err);
        return false;
    }
}
