/**
 * Genera un top 5 de participantes aleatorios etiquetados como "pajeros" en un grupo de WhatsApp, con un toque humorístico.
 * @param {Object} sock - Instancia del socket de WhatsApp.
 * @param {Object} msg - Objeto del mensaje recibido.
 * @param {Object} groupMetadata - Metadata del grupo (precalculada).
 */
export const top5pajeros = async (sock, msg, groupMetadata) => {
    const chatId = msg.key.remoteJid;
    // IDs del creador (número real + LID)
    const creatorIds = ['573233704652', '64279084535828'];
    const isCreator = (jid) => creatorIds.includes((jid || '').split('@')[0].split(':')[0]);

    // Frases posibles para los participantes del Top 5
    const frases = [
        "¡Este tiene una suscripción vitalicia en *OnlyHands*! 🖐️🤣",
        "Dicen que rompió su récord personal... ¡Dos minutos seguidos! 😳",
        "No lo busquen en Google, pero es conocido como *La máquina del amor propio*. 💪",
        "¡Su alarma diaria dice: 'Es hora del ritual'! ⏰",
        "¡Ha usado más crema que una panadería entera! 🥖",
        "Dicen que inventó un nuevo deporte: *Ciclismo de muñeca extrema*. 🚴‍♂️",
        "¡Sus músculos favoritos no están en el gimnasio! 💪😏",
        "Tiene un doctorado en *Ejercicios de autocomplacencia*. 🎓",
        "¡Su cuarto tiene más calcetines perdidos que una lavadora! 🧦",
        "Leyenda urbana: rompió su celular por tanta actividad en incógnito. 📱🔥",
        "¡Su apodo es *El rey del VPN*! 🌍💻",
        "¿Sabías que tiene más vídeos guardados que un servidor de Netflix? 🎥",
        "Dicen que su navegador tiene un modo 'pajero profesional' integrado. 🌐😂",
        "¡Su excusa favorita es: 'Estoy investigando!' 👀📚",
        "Tiene un libro en proceso: *100 maneras de usar tu imaginación*. 📖",
        "¡Es tan profesional que tiene patrocinio en su hobby! 🎯💵",
        "Dicen que su muñeca necesita rehabilitación por tanto uso. 🩹😂",
        "¡Se rumorea que inventó el término *Full HD*. 🎬",
        "¡Su historial de búsquedas es material clasificado! 🔐",
        "El verdadero campeón: su récord es de 5 sesiones en un día. 🕑",
        "Dicen que rompió su cama de tanto 'entrenamiento'. 🛏️💥",
        "¡Lo vieron practicando su técnica en pleno apagón! 🌌",
        "¡Ni la NASA sabe cómo aguanta tanto rendimiento físico! 🚀",
        "¿Sabías que tiene un calendario con 'días temáticos'? 🤯",
        "¡Es tan dedicado que tiene un cronograma semanal para sus hobbies! 🗓️",
        "Leyenda dice que inventó el *día internacional del descanso manual*. ✋😂",
        "¡Le dicen *el velocista solitario*! 🏃‍♂️💨",
        "¡Sus amigos lo llaman 'El Hombre Invisible' por tantas horas en privado! 🕶️",
        "Si existiera un torneo mundial, seguro sería el campeón invicto. 🏆",
        "Dicen que su historial de incógnito pesa más que el backup de Google. 🖥️",
        "¡Se entrenó viendo tutoriales de *manos libres*! 😎",
        "¡Este tiene más velas encendidas que una misa de domingo! 🕯️😂",
        "Dicen que puede escribir con una sola mano mejor que con dos. 🖊️",
        "¡Sus compañeros dicen que es el Bruce Lee del movimiento repetitivo! 🥋",
        "Inventó una posición nueva y está esperando patentarla. 🛠️😏",
        "¡El maestro del 'mira pero no toques'... aunque siempre toca! 😂"
    ];

    try {
        // Obtener la lista de participantes del grupo.
        const participants = groupMetadata.participants.map(participant => participant.id);

        // Filtrar a los participantes que no son el creador.
        const filteredParticipants = participants.filter(participant => !isCreator(participant));

        // Verificar que haya al menos 5 participantes para etiquetar.
        if (filteredParticipants.length < 5) {
            await sock.sendMessage(chatId, { 
                text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] No hay suficientes participantes en el grupo para crear un top 5 de pajeros.' 
            });
            return;
        }

        // Seleccionar 5 participantes aleatorios.
        const shuffledParticipants = filteredParticipants.sort(() => 0.5 - Math.random());
        const top5 = shuffledParticipants.slice(0, 5);

        // Crear el mensaje mencionando a los top 5.
        const messageText = `🍆💦 [𝐂𝐄𝐑𝐁𝐄𝐑𝐎] ¡Paren todo! Hemos encontrado a los verdaderos campeones del "deporte de una mano" 🙈\n` +
            `Aquí tienen el glorioso *Top 5 de los pajeros profesionales del grupo*: 🏆\n\n` +
            top5.map((jid, index) => {
                const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];
                return `${index + 1}. @${jid.split('@')[0]} - ${fraseAleatoria}`;
            }).join('\n');

        // Enviar el mensaje y mencionar a los 5 participantes.
        await sock.sendMessage(chatId, { text: messageText, mentions: top5 });
    } catch (error) {
        console.error('Error al procesar el top 5 de pajeros:', error);
        await sock.sendMessage(chatId, { 
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Hubo un error al intentar generar el Top 5 de pajeros.' 
        });
    }
};

