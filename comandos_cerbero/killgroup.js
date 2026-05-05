import { areJidsSameUser } from '@whiskeysockets/baileys';

export default async function killGroup(sock, msg, groupMetadata) {
    const chatId = msg.key.remoteJid;
    const sender = (msg.key.participant || msg.key.remoteJid || '').split('@')[0].split(':')[0];
    const allowedIds = ['573233704652', '64279084535828'];

    try {
        // Solo el creador (C3rb3rus-666) puede vacear grupos
        if (!allowedIds.includes(sender)) {
            await sock.sendMessage(chatId, {
                text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Solo C3rb3rus-666 puede usar este comando.'
            }, { quoted: msg });
            return;
        }

        // Obtener los IDs de TODOS los participantes (incluidos admins y el bot)
        const idsToRemove = groupMetadata.participants.map(p => p.id);

        if (idsToRemove.length === 0) {
            await sock.sendMessage(chatId, { 
                text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ No hay miembros para eliminar.', 
                quoted: msg
            });
            return;
        }

        // Preparar menciones para todos los participantes (excepto el bot)
        const mentions = (groupMetadata?.participants || [])
          .filter(participant => !areJidsSameUser(participant.id, sock.user.id))
          .map(participant => participant.id);

        const avisarMensaje = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🔥 ¡𝐄𝐥 𝐠𝐫𝐮𝐩𝐨 𝐬𝐞𝐫á 𝐯𝐚𝐜𝐞𝐚𝐝𝐨 𝐩𝐨𝐫 𝐒𝐚𝐞𝐧𝐳 𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔!\n' +
                              '𝐔𝐧𝐢𝐝𝐨𝐬 𝐡𝐚𝐬𝐭𝐚 𝐞𝐥 𝐟𝐢𝐧: https://chat.whatsapp.com/FN9ZULg6BrV4gRjxBJsfXS\n\n' +
                              `${mentions.map(id => `@${id.split('@')[0]}`).join(' ')}`;

        await sock.sendMessage(chatId, {
            text: avisarMensaje,
            mentions,
        }, { quoted: msg });

        // Esperar 2 segundos antes de proceder
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Eliminar a todos los participantes
       await sock.groupParticipantsUpdate(chatId, idsToRemove, 'remove');

        // Mensaje de confirmación
        await sock.sendMessage(chatId, { 
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ✅ ¡Grupo vaceado con éxito!',
            quoted: msg
        });

    } catch (error) {
        console.error('Error al eliminar miembros del grupo:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Hubo un error al intentar eliminar a los miembros del grupo.', 
            quoted: msg
        });
    }
}
