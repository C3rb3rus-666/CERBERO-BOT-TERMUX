export async function top5Maricones(sock, msg,groupMetadata) {
    const chatId = msg.key.remoteJid;
    // IDs del creador (número real + LID)
    const creatorIds = ['573233704652', '64279084535828'];
    const isCreator = (jid) => creatorIds.includes((jid || '').split('@')[0].split(':')[0]);

    try {
        // Obtener la metadata del grupo (participantes, etc.)
        const participants = groupMetadata.participants.map(participant => participant.id);

        // Filtrar a los participantes que no son el creador
        const filteredParticipants = participants.filter(participant => !isCreator(participant));

        // Verificar que haya al menos 5 participantes para crear el Top 5
        if (filteredParticipants.length < 5) {
            await sock.sendMessage(chatId, { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] No hay suficientes participantes en el grupo para crear un Top 5 de maricones.' });
            return;
        }

        // Seleccionar 5 participantes aleatorios
        const shuffledParticipants = filteredParticipants.sort(() => 0.5 - Math.random());
        const top5 = shuffledParticipants.slice(0, 5);

        // Crear el mensaje mencionando a los Top 5
        const messageText = `👑 [𝐂𝐄𝐑𝐁𝐄𝐑𝐎] ¡El Top 5 de Maricones en el grupo es el siguiente!\n\n` +
            top5.map((jid, index) => `${index + 1}. @${jid.split('@')[0]}`).join('\n');

        // Enviar el mensaje y mencionar a los 5 participantes
        await sock.sendMessage(chatId, { text: messageText, mentions: top5 });
    } catch (error) {
        console.error('[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Error al obtener los participantes del grupo:', error);
        await sock.sendMessage(chatId, { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Hubo un error al intentar obtener la lista de participantes del grupo.' });
    }
}
