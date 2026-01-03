import fs from 'fs/promises';
import path from 'path';

export async function nuevosCommand(sock, msg, isAdmin, groupMetadata) {
  const chatId = msg.key.remoteJid;
  if (!chatId || !chatId.endsWith('@g.us')) {
    await sock.sendMessage(msg.key.remoteJid, { text: 'Este comando debe ejecutarse en un grupo.' }, { quoted: msg });
    return;
  }

  if (!isAdmin) {
    await sock.sendMessage(chatId, { text: 'Solo administradores pueden usar !nuevos' }, { quoted: msg });
    return;
  }

  const recentPath = path.resolve(process.cwd(), 'temp', 'recent_joins.json');
  let recent = {};
  try {
    const raw = await fs.readFile(recentPath, 'utf8');
    recent = JSON.parse(raw || '{}');
  } catch (e) {
    recent = {};
  }

  const entries = (recent[chatId] || []).slice(-20); // últimos 20 nuevos
  if (!entries || entries.length === 0) {
    await sock.sendMessage(chatId, { text: 'No se detectaron miembros nuevos recientemente.' }, { quoted: msg });
    return;
  }

  // Resolver JIDs válidos contra groupMetadata.participants
  const participantIds = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants.map(p => (p.id || p).toString()) : [];
  const valid = entries.map(e => {
    const short = (e.jid || '').toString().split('@')[0];
    const found = participantIds.find(id => id && id.toString().split('@')[0] === short);
    return found || null;
  }).filter(Boolean);

  // Requerir mensaje personalizado: '!nuevos <mensaje>' — no ejecutar si falta
  const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  // eliminar el comando del inicio si existe
  let custom = rawText || '';
  if (custom.startsWith('!')) {
    const parts = custom.split(/\s+/);
    parts.shift(); // quitar el comando
    custom = parts.join(' ').trim();
  }

  if (!custom || custom.length === 0) {
    await sock.sendMessage(chatId, { text: 'Uso: !nuevos <mensaje personalizado> — debes incluir el mensaje a enviar.' }, { quoted: msg });
    return;
  }

  const text = custom;

  // Construir mentions: preferir valid, si no hay coincidencias usar las JIDs registradas como fallback
  let mentions = Array.from(new Set(valid));
  if (mentions.length === 0) {
    const fallback = Array.from(new Set(entries.map(e => (e && e.jid) ? e.jid.toString() : null).filter(Boolean)));
    mentions = fallback;
  }

  // Construir representación visible de las menciones para que aparezcan en el texto
  const visibleMentions = mentions.map(m => `@${(m || '').toString().split('@')[0]}`).join(' ');
  const textWithMentions = text && text.length ? `${text}\n\n${visibleMentions}` : visibleMentions || text;

  await sock.sendMessage(chatId, { text: textWithMentions, mentions }, { quoted: msg });

  // Eliminar las entradas usadas de recent_joins para dejar espacio a nuevos
  try {
    const raw2 = await fs.readFile(recentPath, 'utf8');
    const recent2 = JSON.parse(raw2 || '{}');
    if (recent2[chatId] && Array.isArray(recent2[chatId])) {
      const usedShorts = new Set(mentions.map(m => (m || '').toString().split('@')[0]));
      recent2[chatId] = recent2[chatId].filter(entry => {
        const short = (entry && entry.jid) ? entry.jid.toString().split('@')[0] : '';
        return !usedShorts.has(short);
      });
      if (recent2[chatId].length === 0) delete recent2[chatId];
      await fs.writeFile(recentPath, JSON.stringify(recent2, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('[NUEVOS] No se pudo limpiar recent_joins:', e && e.message ? e.message : e);
  }
}

export default nuevosCommand;
