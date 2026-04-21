/**
 * Genera un top 5 de participantes aleatorios etiquetados como "infieles" en un grupo de WhatsApp con un toque de humor.
 * @param {Object} sock - Instancia del socket de WhatsApp.
 * @param {Object} msg - Objeto del mensaje recibido.
 * @param {Object} groupMetadata - Metadata del grupo (precalculada).
 */
export const top5infieles = async (sock, msg, groupMetadata) => {
    const chatId = msg.key.remoteJid;
    // IDs del creador (número real + LID)
    const creatorIds = ['573233704652', '64279084535828'];
    const isCreator = (jid) => creatorIds.includes((jid || '').split('@')[0].split(':')[0]);

    // Frases posibles para los participantes del Top 5
    const frases = [
        "🔪 ¡Este deja más corazones rotos que el final de Titanic! 💔",
        "🚨 ¡Su agenda tiene más citas secretas que un espía de la CIA! 🕵️‍♂️",
        "📱 ¡Cuidado! Tiene 3 WhatsApps, 2 teléfonos y un 'modo avión' eterno. ✈️",
        "🎩 ¡Leyenda urbana! Dicen que su cacho brilla como la Torre Eiffel. ✨",
        "🔥 Lo vieron en Tinder... ¡con el perfil verificado y todo! 😂",
        "💃 Tiene más excusas que episodios de La Rosa de Guadalupe. 🌹",
        "📸 ¡Sus historias de Instagram parecen capítulos de una serie romántica! 🎬",
        "😎 ¡Dicen que su frase favorita es: 'No eres tú, soy yo (y alguien más)'! 🤷‍♂️",
        "🐾 Los cachos que tiene podrían ser declarados como patrimonio cultural. 🦌",
        "🔍 ¡Ni Sherlock Holmes podría seguirle el rastro a este crack! 🕵️",
        "😂 ¡Este está en la lista negra de los restaurantes por tantas cenas sospechosas! 🍽️",
        "⚡ ¡Sus cachos son tan altos que tienen pararrayos incorporado! 🌩️",
        "🦄 ¡Dicen que sus cachos aparecen en cuentos de hadas como referencia! 🦌✨",
        "🕶️ ¡Si esto fuera un concurso, este tendría un trofeo por acumulación! 🏆",
        "🌍 ¡Es tan infiel que ya tiene club de fans en varios continentes! 🌎",
        "📖 ¡Ya tiene biografía! Se llama *50 sombras de excusas*. 📚",
        "🎭 ¡Dicen que actúa mejor que los de Hollywood cuando lo descubren! 🎬",
        "📲 ¡Tiene más matches en Tinder que seguidores en Instagram! 😜",
        "🧙‍♂️ ¡Este hizo un hechizo para que nadie descubra sus aventuras! 🪄",
        "🏖️ ¡Cuidado! A este lo encontraron escapándose con otro en plena cuarentena. 🚷",
        "💼 ¡Tiene un trabajo falso para justificar sus escapadas nocturnas! 🕒",
        "🥷 ¡Dicen que es tan sigiloso que nadie se da cuenta de sus andanzas! 🤫",
        "🎤 ¡Podría hacer stand-up con sus mentiras y sería un éxito! 😂",
        "🦸 ¡Este tiene superpoderes: puede estar en dos lugares al mismo tiempo! 🦹",
        "💔 ¡Tiene más exes que temporadas de *Grey's Anatomy*! 😬",
        "👓 ¡Sus cachos son tan altos que ahora necesita gafas para verlos! 🤓",
        "🚘 ¡Lo vieron bajarse de 3 carros diferentes en una noche! 🚗",
        "🤔 ¡Dicen que tiene un detector para saber cuándo su pareja está ocupada! 🕵️",
        "🐍 ¡Es tan astuto que ni las serpientes lo alcanzan! 🐍",
        "👔 ¡Lo contrataron en Netflix por su habilidad para crear dramas! 🎬",
        "👑 ¡Rey o reina del engaño, pero sin corona oficial! 👑"
    ];

    try {
        // Obtener la lista de participantes del grupo.
        const participants = groupMetadata.participants.map(participant => participant.id);

        // Filtrar a los participantes que no son el creador.
        const filteredParticipants = participants.filter(participant => !isCreator(participant));

        // Verificar que haya al menos 5 participantes para etiquetar.
        if (filteredParticipants.length < 5) {
            await sock.sendMessage(chatId, { 
                text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] No hay suficientes participantes en el grupo para crear un top 5 de infieles.' 
            });
            return;
        }

        // Seleccionar 5 participantes aleatorios.
        const shuffledParticipants = filteredParticipants.sort(() => 0.5 - Math.random());
        const top5 = shuffledParticipants.slice(0, 5);

        // Crear el mensaje mencionando a los top 5.
        const messageText = `🦌🦌 [𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Atención: ¡Hemos detectado a los mayores expertos en el arte de ser infieles! 🌪️\n` +
            `Estos maestros del disimulo tienen más vidas románticas que un gato. Aquí están los 5 magníficos del engaño:\n\n` +
            top5.map((jid, index) => {
                const fraseAleatoria = frases[Math.floor(Math.random() * frases.length)];
                return `${index + 1}. @${jid.split('@')[0]} - ${fraseAleatoria}`;
            }).join('\n');

        // Enviar el mensaje y mencionar a los 5 participantes.
        await sock.sendMessage(chatId, { text: messageText, mentions: top5 });
    } catch (error) {
        console.error('Error al procesar el top 5 de infieles:', error);
        await sock.sendMessage(chatId, { 
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] Hubo un error al intentar generar el Top 5 de infieles.' 
        });
    }
};
