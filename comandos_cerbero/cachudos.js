/**
 * Genera un Top 5 de participantes aleatorios excluyendo al creador
 * @param {Object} sock Instancia del socket de WhatsApp
 * @param {Object} msg Mensaje recibido del grupo
 * @param {Object} groupMetadata Metadata del grupo (precalculada)
 */
export const top5Cachudos = async (sock, msg, groupMetadata) => {
    const chatId = msg.key.remoteJid;
    // IDs del creador (número real + LID)
    const creatorIds = ['573233704652', '64279084535828'];
    const isCreator = (jid) => creatorIds.includes((jid || '').split('@')[0].split(':')[0]);

    // Frases humorísticas para el Top 5
    const frases = [
        "¡Sus cachos están registrados como patrimonio cultural! 🤷‍♂️",
        "Dicen que los usan como antena de WiFi gratis. 📶🦌",
        "¡Es tan cachudo que lo confunden con un reno en Navidad! 🎅🎄",
        "No necesita casco en la moto, los cachos lo protegen. 🏍️💨",
        "¡Cuidado! Si mueve la cabeza, rompe la lámpara. 💡😂",
        "Es el único que puede hacer sombra en la noche con sus cachos. 🌒",
        "¡Sus cachos tienen GPS incorporado! 🌍🦌",
        "Dicen que lo contrataron para promocionar una marca de cuernos. 🛒🤣",
        "¡Ya le están haciendo un museo de cachos! 🏛️",
        "Con esos cachos podría armar una antena de televisión por cable. 📺😂",
        "Si sigue creciendo, podría ser la nueva torre Eiffel. 🗼",
        "¡Sus cachos tienen WiFi y señal 5G! 🚀📡",
        "Dicen que los pájaros ya hicieron nido en sus cachos. 🐦😂",
        "¡Los cachos de este están inscritos en el Libro Guinness! 🏅",
        "Si cobrara por cada cm de cuerno, sería millonario. 💰🦌",
        "Con esos cachos podría competir contra un alce profesional. 🦌🏆",
        "¡Se rumorea que construyó su casa usando sus cachos como herramientas! 🏠🔨",
        "Sus cachos son tan grandes que ya tienen nombre propio. 🤔",
        "¡Cuidado! Si entra en el metro, bloquea la puerta con sus cachos. 🚇🦌",
        "Dicen que hasta Zeus le tiene miedo a sus cachos. ⚡🦌",
        "Es el primer humano registrado con cachos de diamante. 💎🦌",
        "¡Sus cachos tienen más cobertura que un paraguas! ☂️😂",
        "No necesita subir a la montaña, sus cachos ya tocan la cima. 🏔️",
        "Dicen que es la inspiración detrás del *emoji* de ciervo. 🦌",
        "¡Con esos cachos, Santa lo está buscando para Navidad! 🎅🦌",
        "Si existiera una competencia de cachos, ya sería el campeón invicto. 🏆😂",
        "Sus cachos son tan brillantes que se ven desde el espacio. ✨🦌",
        "Dicen que hasta le hacen reverencias en el reino animal. 🦁👑",
        "Con esos cachos, ya lo contrataron como señal de tráfico. 🚧🦌"
    ];

    try {
        // Obtener la lista de participantes del grupo
        const participants = groupMetadata.participants.map(participant => participant.id);

        // Filtrar a los participantes que no son el creador
        const filteredParticipants = participants.filter(participant => !isCreator(participant));

        // Verificar que haya al menos 5 participantes para etiquetar
        if (filteredParticipants.length < 5) {
            await sock.sendMessage(chatId, {
                text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] No hay suficientes participantes en el grupo para crear un top 5 de cachudos.'
            });
            return;
        }

        // Seleccionar 5 participantes aleatorios
        const shuffledParticipants = filteredParticipants.sort(() => 0.5 - Math.random());
        const top5 = shuffledParticipants.slice(0, 5);

        // Crear el mensaje mencionando a los top 5 con frases humorísticas
        const messageText = `🦌 [𝐂𝐄𝐑𝐁𝐄𝐑𝐎] ¡Paren todo! Hemos identificado a los miembros del exclusivo *Club de los Cachudos Anónimos* 🦌\n` +
            `Aquí está el glorioso *Top 5* de los más "destacados" en el grupo: 🐒\n\n` +
            top5.map((jid, index) => {
                const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];
                return `${index + 1}. @${jid.split('@')[0]} - ${fraseAleatoria}`;
            }).join('\n');

        // Enviar el mensaje y mencionar a los 5 participantes
        await sock.sendMessage(chatId, { text: messageText, mentions: top5 });
    } catch (error) {
        console.error('Error al procesar el top 5 de cachudos:', error);
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Hubo un error al intentar generar el Top 5 de cachudos.'
        });
    }
};
