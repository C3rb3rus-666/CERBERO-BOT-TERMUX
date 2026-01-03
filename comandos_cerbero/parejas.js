// Utilidad para barajar un array usando el algoritmo de Fisher-Yates
export const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Utilidad para elegir un elemento al azar de un array
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Command handler para el comando `!parejas`
 * @param {Object} sock Instancia del socket de WhatsApp
 * @param {Object} msg Objeto del mensaje que contiene el comando
 */
export const handleParejasCommand = async (sock, msg,groupMetadata) => {
    const chatId = msg.key.remoteJid;

    // Obtiene la lista de participantes del grupo
    const participants = groupMetadata.participants;

    if (participants.length < 2) {
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐧𝐨 𝐡𝐚𝐲 𝐬𝐮𝐟𝐢𝐜𝐢𝐞𝐧𝐭𝐞𝐬 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐧𝐭𝐞𝐬 𝐞𝐧 𝐞𝐥 𝐠𝐫𝐮𝐩𝐨.',
        });
        return;
    }

    // Baraja los participantes
    const shuffledParticipants = shuffle(participants);

    // Forma las parejas
    const pairs = [];
    for (let i = 0; i < shuffledParticipants.length - 1 && pairs.length < 3; i += 2) {
        pairs.push({
            first: shuffledParticipants[i],
            second: shuffledParticipants[i + 1],
        });
    }

    // Genera el mensaje de las parejas con plantillas más divertidas
    const introTemplates = [
        '🎉 ¡Atención, almas curiosas! Hora de mezclar risas y coincidencias...',
        '😎 ¿Listos para un poco de diversión? Veamos quién aparece junto a quién...',
        '🎊 ¡Sorteo de parejas activado! Que comiencen los piropos y las risas...',
        '✨ Momentito romántico y divertido: revisen sus menciones...'
    ];

    const pairTemplates = [
        '💥 Pareja {i}: @{a} y @{b} — ¡Qué combo más explosivo! 😜',
        '😂 Pareja {i}: @{a} + @{b} — Cachos asegurados.',
        '🌟 Pareja {i}: @{a} & @{b} — Alguno de los dos tiene pene y no lo sabe.',
        '🍸 Pareja {i}: @{a} y @{b} — Por lo menos alguno de los dos tiene hueco',
        '🎭 Pareja {i}: @{a} y @{b} — Actúen su mejor escena romántica.'
    ];

    const closingTemplates = [
        '📢 ¿Quieres otra ronda? Usa *!parejas* y lo revivimos.',
        '😉 Si te quedaste sin match, etiqueta a tu favorito y verás magia.',
        '🎈 ¡Listo! Que comiencen las buenas vibras en el grupo.'
    ];

    // Intro aleatorio
    const intro = randomItem(introTemplates);

    let pairsLines = [];
    if (pairs.length > 0) {
        pairsLines = pairs.map((pair, index) => {
            const aName = pair.first.id.split('@')[0];
            const bName = pair.second.id.split('@')[0];
            // Selección aleatoria de plantilla para cada pareja
            const template = randomItem(pairTemplates);
            return template.replace('{i}', index + 1).replace('{a}', aName).replace('{b}', bName);
        });
    }

    // Prepara los mentions y maneja si hay un participante sin pareja (número impar)
    const mentions = pairs.flatMap((pair) => [pair.first.id, pair.second.id]);
    if (shuffledParticipants.length % 2 === 1 && pairs.length * 2 < shuffledParticipants.length) {
        const lastPerson = shuffledParticipants[shuffledParticipants.length - 1];
        const lastName = lastPerson.id.split('@')[0];
        pairsLines.push(`🙃 Sin pareja por jodidamente FEO: @${lastName} — etiqueta a alguien y formamos otro match!`);
        mentions.push(lastPerson.id);
    }

    // Cierre aleatorio
    const closing = randomItem(closingTemplates);

    const pairsMessage =
        pairsLines.length > 0
            ? `${intro}\n\n${pairsLines.join('\n\n')}\n\n${closing}`
            : '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐍𝐨 𝐡𝐚𝐲 𝐬𝐮𝐟𝐢𝐜𝐢𝐞𝐧𝐭𝐞𝐬 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐧𝐭𝐞𝐬 𝐩𝐚𝐫𝐚 𝐟𝐨𝐫𝐦𝐚𝐫 𝐩𝐚𝐫𝐞𝐣𝐚𝐬.';

    await sock.sendMessage(chatId, { text: pairsMessage, mentions });
    console.log(`Comando !parejas ejecutado en el grupo ${chatId}`);
};
