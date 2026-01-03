import QRCodeReader from 'qrcode-reader';
import { Jimp } from "jimp";
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const userMessageTracker = new Map(); // Rastrea mensajes de cada usuario
const messageQueue = [];
let isProcessingQueue = false;

// Procesamiento de mensajes en cola
const enqueueMessage = (action) => {
    messageQueue.push(action);
    if (!isProcessingQueue) processQueue();
};

const processQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (messageQueue.length > 0) {
        const action = messageQueue.shift();
        try {
            await action();
        } catch (err) {
            console.error(`[CERBERO-ES6] Error al procesar mensaje en cola:`, err);
        }
    }

    isProcessingQueue = false;
};

// Decodificar el código QR desde el buffer
async function decodeQRCode(buffer) {
    const image = await Jimp.read(buffer);

    /* Escalar la imagen si es demasiado grande
    if (image.bitmap.width > 1000 || image.bitmap.height > 1000) {
        image.resize(1000, Jimp.AUTO);
    }*/

    const qr = new QRCodeReader();
    return new Promise((resolve, reject) => {
        qr.callback = (err, value) => {
            if (err) {
                return reject(err);
            }
            resolve(value);
        };
        qr.decode(image.bitmap);
    });
}

export async function blockQr(sock, message, isAdmin, groupMetadata) {
    const { key, message: msg } = message;
    const chatId = key.remoteJid;
    const isImage = msg?.imageMessage;

    let participant = message.participant || key.participant || key.remoteJid;

    if (!isImage) return;

    try {
        if (!participant) {
            console.log("[CERBERO-ES6] No se pudo identificar al remitente. Ignorando mensaje.");
            return;
        }

        // Registrar el mensaje en el rastreador
        if (!userMessageTracker.has(participant)) {
            userMessageTracker.set(participant, { messages: [], warned: false });
        }
        const userInfo = userMessageTracker.get(participant);
        userInfo.messages.push(key);

        // Descargar la imagen
        const stream = await downloadContentFromMessage(msg.imageMessage, 'image');
        const buffer = [];
        for await (const chunk of stream) {
            buffer.push(chunk);
        }
        const imageBuffer = Buffer.concat(buffer);

        // Decodificar el código QR desde el buffer
        const qrResult = await decodeQRCode(imageBuffer);

        if (qrResult?.result.includes('chat.whatsapp.com')) {
            console.log(`Código QR detectado en el mensaje de ${participant}: ${qrResult.result}`);

            // Si el usuario ya fue advertido, ignorar
            if (userInfo.warned) return;

            // Expulsar primero si no es administrador
            if (!isAdmin) {
                console.log(`Expulsando al usuario ${participant} por enviar un código QR sospechoso.`);
                await sock.groupParticipantsUpdate(chatId, [participant], 'remove');
                await sock.sendMessage(chatId, {
                    text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐥 𝐮𝐬𝐮𝐚𝐫𝐢𝐨 @${participant.split('@')[0]} 𝐟𝐮𝐞 𝐞𝐱𝐩𝐮𝐥𝐬𝐚𝐝𝐨 𝐩𝐨𝐫 𝐞𝐧𝐯𝐢𝐚𝐫 𝐮𝐧 𝐜ó𝐝𝐢𝐠𝐨 𝐐𝐑 𝐬𝐨𝐬𝐩𝐞𝐜𝐡𝐨𝐬𝐨.`,
                    mentions: [participant],
                });
            } else {
                console.log(`[CERBERO-ES6] Código QR enviado por administrador: ${participant}`);
                await sock.sendMessage(chatId, {
                    text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐥 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫 @${participant.split('@')[0]} 𝐞𝐧𝐯𝐢ó 𝐮𝐧 𝐜ó𝐝𝐢𝐠𝐨 𝐐𝐑. 𝐋𝐚 𝐢𝐦𝐚𝐠𝐞𝐧 𝐟𝐮𝐞 𝐞𝐥𝐢𝐦𝐢𝐧𝐚𝐝𝐚.`,
                    mentions: [participant],
                });
            }

            // Marcar al usuario como advertido
            userInfo.warned = true;

            // Luego eliminar todos los mensajes del usuario
            for (const messageKey of userInfo.messages) {
                enqueueMessage(async () => {
                    await sock.sendMessage(chatId, { delete: messageKey });
                    console.log(`[CERBERO-ES6] Mensaje eliminado: ${messageKey.id}`);
                });
            }

            // Limpiar rastreo del usuario
            userMessageTracker.delete(participant);
        }
    } catch (err) {
        console.error(`[CERBERO-ES6] Error procesando la imagen del mensaje:`, err);
    }
}
