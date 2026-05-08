import QRCodeReader from 'qrcode-reader';
import { Jimp } from "jimp";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

let sharp = null;
try {
    sharp = (await import('sharp')).default;
} catch (err) {
    console.warn('[QR] sharp no disponible, usando decodificacion JS directa:', err.message?.slice(0, 80));
}

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

function _isWhatsappQrContent(content = '') {
    return /(?:https?:\/\/)?chat\.whatsapp\.com\/[A-Za-z0-9_-]+/i.test(String(content || ''));
}

function _normalizeCacheEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        const value = Boolean(entry);
        return { hasAnyQr: value, isWhatsappQr: value, content: value ? 'chat.whatsapp.com' : '' };
    }
    return {
        hasAnyQr: Boolean(entry.hasAnyQr),
        isWhatsappQr: Boolean(entry.isWhatsappQr),
        content: entry.content || '',
    };
}

function _setQrCache(cacheKey, content) {
    if (!cacheKey) return null;
    const qrContent = content || '';
    const entry = {
        hasAnyQr: Boolean(qrContent.trim()),
        isWhatsappQr: _isWhatsappQrContent(qrContent),
        content: qrContent,
    };
    if (_qrCache.size >= QR_CACHE_MAX) _qrCache.delete(_qrCache.keys().next().value);
    _qrCache.set(cacheKey, entry);
    return entry;
}

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

function _getViewOnceContainer(message) {
    return message?.viewOnceMessage?.message
        || message?.viewOnceMessageV2?.message
        || message?.viewOnceMessageV2Extension?.message
        || null;
}

function _getQrMediaInfo(msg) {
    const candidates = [
        msg,
        _getViewOnceContainer(msg),
        msg?.ephemeralMessage?.message,
        _getViewOnceContainer(msg?.ephemeralMessage?.message),
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (candidate.imageMessage) {
            return { mediaMessage: candidate.imageMessage, mediaType: 'image' };
        }
        if (candidate.documentMessage?.mimetype?.startsWith('image/')) {
            return { mediaMessage: candidate.documentMessage, mediaType: 'document' };
        }
    }
    return null;
}

// Decodificar QR con sharp (resize rápido) + jimp + qrcode-reader
async function decodeQRCode(rawBuffer) {
    // 1. Redimensionar con sharp (nativo, 10-50× más rápido que Jimp resize)
    let resizedBuffer = rawBuffer;
    if (sharp) {
        try {
            resizedBuffer = await sharp(rawBuffer)
                .resize(QR_SCAN_SIZE, QR_SCAN_SIZE, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 90 })
                .toBuffer();
        } catch (_) {
            // Si sharp falla (formato raro), usar el buffer original
            resizedBuffer = rawBuffer;
        }
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
 * Detecta si un buffer de imagen contiene un código QR (sin efectos secundarios).
 * Reutiliza el motor decodeQRCode y caché existente.
 * @param {Buffer} imageBuffer - El contenido de la imagen a analizar
 * @param {Object} imageMessage - El objeto imageMessage de Baileys para usar en caché
 * @returns {Promise<Object>} { isQR: boolean, content?: string }
 */
export async function detectQrBuffer(imageBuffer, imageMessage = null) {
    try {
        // Usar caché si está disponible
        const cacheKey = imageMessage ? _getCacheKey(imageMessage) : null;
        if (cacheKey && _qrCache.has(cacheKey)) {
            const cached = _normalizeCacheEntry(_qrCache.get(cacheKey));
            console.log(`[QR] Caché hit (buffer detector): ${cacheKey.slice(0, 16)}...`);
            return {
                isQR: cached.hasAnyQr,
                isWhatsappQR: cached.isWhatsappQr,
                content: cached.content,
                cached: true
            };
        }

        // Decodificar QR
        let qrResult = null;
        try {
            qrResult = await decodeQRCode(imageBuffer);
        } catch (_) {
            // No contiene QR — resultado esperado para imágenes normales
            if (cacheKey) {
                _setQrCache(cacheKey, '');
            }
            return { isQR: false };
        }

        // Guardar en caché si tenemos clave
        const qrContent = qrResult?.result || '';
        const isQr = typeof qrContent === 'string' && qrContent.trim().length > 0;
        const cacheEntry = cacheKey ? _setQrCache(cacheKey, qrContent) : null;

        return {
            isQR: isQr,
            isWhatsappQR: cacheEntry?.isWhatsappQr ?? _isWhatsappQrContent(qrContent),
            content: qrContent,
        };
    } catch (err) {
        if (
            err?.message?.includes("Couldn't find enough finder patterns") ||
            err?.message?.includes('FormatError') ||
            err?.message?.includes('decode')
        ) {
            return { isQR: false }; // No es QR — silenciar error esperado
        }
        console.error(`[QR] Error en detector buffer:`, err.message || err);
        return { isQR: false }; // En caso de error, permitir (no bloquear)
    }
}

/**
 * Detecta y bloquea imágenes con códigos QR de WhatsApp.
 * @returns {boolean} true si se detectó y manejó un QR, false en caso contrario.
 */
export async function blockQr(sock, message, isAdmin, groupMetadata) {
    const { key, message: msg } = message;
    const chatId = key.remoteJid;
    const mediaInfo = _getQrMediaInfo(msg);

    let participant = message.participant || key.participant || key.remoteJid;

    if (!mediaInfo) return false;

    try {
        if (!participant) {
            console.log("[QR] No se pudo identificar al remitente. Ignorando.");
            return false;
        }

        // ─── Caché: evitar re-procesar la misma imagen ───────────────────────
        const { mediaMessage, mediaType } = mediaInfo;
        const cacheKey = _getCacheKey(mediaMessage);
        if (cacheKey && _qrCache.has(cacheKey)) {
            const cached = _normalizeCacheEntry(_qrCache.get(cacheKey));
            console.log(`[QR] Caché hit (${cached.isWhatsappQr ? 'WA-QR' : cached.hasAnyQr ? 'QR-no-WA' : 'segura'}): ${cacheKey.slice(0, 16)}...`);
            if (!cached.isWhatsappQr) return false; // solo el grupo bloquea QR de WhatsApp
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
            const cached = _normalizeCacheEntry(_qrCache.get(cacheKey));
            qrResult = { result: cached.content || 'chat.whatsapp.com' };
        } else {
            // ─── Descargar imagen ─────────────────────────────────────────────
            const stream = await downloadContentFromMessage(mediaMessage, mediaType);
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const imageBuffer = Buffer.concat(chunks);

            // ─── Decodificar QR (con resize automático vía sharp) ─────────────
            try {
                qrResult = await decodeQRCode(imageBuffer);
            } catch (_) {
                // No contiene QR — resultado esperado para imágenes normales
                if (cacheKey) {
                    _setQrCache(cacheKey, ''); // cachear como "segura"
                }
                return false;
            }

            // ─── Guardar en caché ─────────────────────────────────────────────
            if (cacheKey) {
                _setQrCache(cacheKey, qrResult?.result || '');
            }
        }

        if (_isWhatsappQrContent(qrResult?.result)) {
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
