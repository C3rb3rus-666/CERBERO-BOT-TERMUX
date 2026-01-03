import { downloadContentFromMessage } from '@whiskeysockets/baileys';

// Número de teléfono del creador del bot
const BOT_CREATOR_PHONE = '573233704652@s.whatsapp.net';


/**
 * Función principal para manejar mensajes problemáticos
 * @param {Object} sock - Instancia del socket de WhatsApp
 * @param {Object} msg - Mensaje recibido
 */
export async function deleteLongMessage(sock, msg) {
    const chatId = msg.key.remoteJid; // ID del chat
    const participant = msg.key.participant; // ID del usuario que envió el mensaje
    const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (!chatId || msg.key.fromMe) return;

    // Verificaciones adicionales
    const isLongMessage = messageContent.length > 900;


    // Verifica si el mensaje cumple con alguna condición de bloqueo
    if (
        isLongMessage ||
        messageContent.startsWith('.bomb/10/') ||
        messageContent.includes('©Perverso') ||
        messageContent.includes('©Toxico') ||
        messageContent.includes('Ops crash inesperado 😓')
    ) {
        if (participant !== BOT_CREATOR_PHONE) {
            // Expulsa al participante infractor del grupo
            await sock.groupParticipantsUpdate(chatId, [participant], 'remove');
        } else {
            // Mensaje específico si el infractor es el creador
            const creatorWarningMessage = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐍𝐨 𝐬𝐞 𝐩𝐮𝐞𝐝𝐞 𝐞𝐱𝐩𝐮𝐥𝐬𝐚𝐫 𝐚𝐥 𝐜𝐫𝐞𝐚𝐝𝐨𝐫.';
            await sock.sendMessage(chatId, { text: creatorWarningMessage });
        }

        // Enviar un "destraba" para cubrir la pantalla
        const destrabaMessage = '══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════';
        await sock.sendMessage(chatId, { text: destrabaMessage });

        // Eliminar el mensaje problemático
        await sock.sendMessage(chatId, { delete: msg.key });

        // Enviar un mensaje de advertencia final
        const warningMessage = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖   𝐀𝐧𝐭𝐢𝐭𝐫𝐚𝐛𝐚𝐬 ⚡';
        await sock.sendMessage(chatId, { text: warningMessage });
    }
}
