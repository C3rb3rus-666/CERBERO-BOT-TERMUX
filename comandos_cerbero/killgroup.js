import { areJidsSameUser } from '@whiskeysockets/baileys';

export default async function killGroup(sock, msg, groupMetadata) {
    const chatId = msg.key.remoteJid;
    const creatorNumber = '573233704652@s.whatsapp.net'; // Tu número de creador
    const sender = msg.key.participant;

    try {
        // Verificar si el remitente es el creador del bot
        if (!areJidsSameUser(sender, creatorNumber)) {
            await sock.sendMessage(chatId, {
                text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Este comando solo puede ser utilizado por C𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔.'},{ quoted: msg });
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

        // Mensaje previo antes de la eliminación
        await sock.sendMessage(chatId, { 
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🔥 ¡𝐄𝐥 𝐠𝐫𝐮𝐩𝐨 𝐬𝐞𝐫á 𝐯𝐚𝐜𝐞𝐚𝐝𝐨 𝐩𝐨𝐫 𝐒𝟒𝟑𝐧𝐳 𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔! 𝐮𝐧𝐚𝐧𝐬𝐞 𝐚𝐥 𝐧𝐮𝐞𝐯𝐨 𝐠𝐫𝐮𝐩𝐨 : https://chat.whatsapp.com/Eq1TUv1UMcNCfzv0Iw7NeJ '},
            { quoted: msg });

        // Esperar 3 segundos antes de proceder
        await new Promise(resolve => setTimeout(resolve, 4000));

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
