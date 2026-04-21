/**
 * !lidmap — Comando diagnóstico para ver la estructura real de participantes.
 * Muestra todos los campos que WhatsApp expone por cada miembro del grupo,
 * permitiendo ver si el LID viene acompañado del número de teléfono.
 * 
 * Solo C3rb3rus-666 puede ejecutarlo.
 */

export async function lidMapCommand(sock, msg, groupMetadata) {
    const chatId = msg.key.remoteJid;
    const sender = (msg.key.participant || msg.key.remoteJid || '').split('@')[0].split(':')[0];
    const allowedIds = ['573233704652', '64279084535828'];

    if (!allowedIds.includes(sender)) {
        await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Solo C3rb3rus-666 puede usar este comando.'
        }, { quoted: msg });
        return;
    }

    if (!groupMetadata || !groupMetadata.participants) {
        await sock.sendMessage(chatId, { text: '❌ No hay metadata del grupo.' }, { quoted: msg });
        return;
    }

    const participants = groupMetadata.participants;
    
    // Log completo en consola para inspección detallada
    console.log('\n[LIDMAP] ========== DUMP COMPLETO DE PARTICIPANTES ==========');
    console.log(`[LIDMAP] Grupo: ${groupMetadata.subject} (${chatId})`);
    console.log(`[LIDMAP] Total participantes: ${participants.length}`);
    
    const lines = [];
    lines.push(`🔍 *LID MAP — ${groupMetadata.subject}*`);
    lines.push(`👥 Total: ${participants.length} miembros\n`);

    for (const p of participants) {
        const id = p.id || '???';
        const isLid = id.endsWith('@lid');
        const shortId = id.split('@')[0].split(':')[0];
        
        // Buscar todos los campos que podrían contener el número real
        const phoneNumber = p.phoneNumber || p.phone || p.number || null;
        const notify = p.notify || p.notifyName || p.pushname || p.name || null;
        const admin = p.admin || null;
        
        let line = `• ${shortId}`;
        if (isLid) line += ' 🆔(LID)';
        else line += ' 📱(PN)';
        if (phoneNumber) line += ` → 📞 ${phoneNumber}`;
        if (notify) line += ` | ${notify}`;
        if (admin) line += ` [${admin}]`;
        
        lines.push(line);

        // Log detallado en consola con TODOS los campos del objeto
        console.log(`[LIDMAP] --- Participante ---`);
        console.log(`[LIDMAP] Campos: ${JSON.stringify(p, null, 2)}`);
    }

    // Enviar resumen al chat (recortar si es muy largo)
    let text = lines.join('\n');
    if (text.length > 4000) {
        text = text.substring(0, 3900) + '\n\n... (ver consola para el dump completo)';
    }

    await sock.sendMessage(chatId, { text }, { quoted: msg });
    console.log('[LIDMAP] ========== FIN DUMP ==========\n');
}
