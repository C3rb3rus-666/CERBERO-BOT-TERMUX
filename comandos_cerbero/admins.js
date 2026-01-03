/**
 * Quita privilegios de administrador a un usuario.
 * @param {Object} sock Instancia del socket de WhatsApp.
 * @param {Object} msg Objeto del mensaje recibido.
 * @param {boolean} isAdmin Indica si el usuario que ejecuta el comando es administrador.
 */
export const removeAdmin = async (sock, msg, isAdmin) => {
    const chatId = msg.key.remoteJid;

    // Verificar si el usuario que envía el comando es administrador
    if (!isAdmin) {
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] No tienes privilegios de administrador para usar este comando.',
        }, { quoted: msg });
        return;
    }

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const isReply = msg.message?.extendedTextMessage?.contextInfo?.participant;

    // Obtener el JID del usuario objetivo
    const targetJid = mentionedJids[0] || isReply;
    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Por favor, menciona a un usuario o responde a su mensaje para quitarle los privilegios de administrador.',
        }, { quoted: msg });
        return;
    }

    // Verificar si el objetivo es +573233704652
    if (targetJid.includes("573233704652")) {
        await sock.sendMessage(chatId, {
            text: "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 🚫 No puedes quitar los privilegios de administrador a este usuario.",
        }, { quoted: msg });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, [targetJid], 'demote');
        await sock.sendMessage(chatId, {
            text: `✅ Privilegios de administrador eliminados para @${targetJid.split('@')[0]}.`,
            mentions: [targetJid],
        }, { quoted: msg });
    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Hubo un error al intentar quitar los privilegios de administrador.',
        }, { quoted: msg });
    }
};

/**
 * Da privilegios de administrador a un usuario.
 * @param {Object} sock Instancia del socket de WhatsApp.
 * @param {Object} msg Objeto del mensaje recibido.
 * @param {boolean} isAdmin Indica si el usuario que ejecuta el comando es administrador.
 */
export const makeAdmin = async (sock, msg, isAdmin) => {
    const chatId = msg.key.remoteJid;

    // Verificar si el usuario que envía el comando es administrador
    if (!isAdmin) {
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] No tienes privilegios de administrador para usar este comando.',
        }, { quoted: msg });
        return;
    }

    const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const isReply = msg.message?.extendedTextMessage?.contextInfo?.participant;

    // Obtener el JID del usuario objetivo
    const targetJid = mentionedJids[0] || isReply;
    if (!targetJid) {
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Por favor, menciona a un usuario o responde a su mensaje para otorgarle privilegios de administrador.',
        }, { quoted: msg });
        return;
    }

    try {
        await sock.groupParticipantsUpdate(chatId, [targetJid], 'promote');
        await sock.sendMessage(chatId, {
            text: `✅ Privilegios de administrador otorgados a @${targetJid.split('@')[0]}.`,
            mentions: [targetJid],
        }, { quoted: msg });
    } catch (error) {
        console.error(error);
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Hubo un error al intentar otorgar los privilegios de administrador.',
        }, { quoted: msg });
    }
};
