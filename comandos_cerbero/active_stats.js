import { getCountsSinceBaseline } from '../utils/messageCounter.js';
import fs from 'fs/promises';
import path from 'path';

export async function activeStats(sock, message, isAdmin, groupMetadata) {
  const chatId = message.key.remoteJid;
  if (!chatId || !chatId.endsWith('@g.us')) {
    if (message && message.key && message.key.remoteJid) {
      await sock.sendMessage(message.key.remoteJid, { text: 'Este comando debe ejecutarse en un grupo.' }, { quoted: message });
    }
    return;
  }

  if (!isAdmin) {
    await sock.sendMessage(chatId, { text: 'Solo administradores pueden usar !actividad' }, { quoted: message });
    return;
  }

  const countsSince = await getCountsSinceBaseline(chatId);
  const participants = (groupMetadata && groupMetadata.participants) ? groupMetadata.participants.map(p => (p.id || p).toString()) : [];

  // Build array of {jid, count, total, lastMessage}
  const stats = participants.map(jid => {
    const raw = countsSince[jid] || { countSinceJoin: 0, total: 0, lastMessage: '', lastTs: 0 };
    return { jid, count: raw.countSinceJoin || 0, total: raw.total || 0, lastMessage: raw.lastMessage || '', lastTs: raw.lastTs || 0 };
  });

  if (stats.length === 0) {
    await sock.sendMessage(chatId, { text: 'No se encontraron participantes para analizar.' }, { quoted: message });
    return;
  }

  // Excluir usuarios con 0 mensajes desde su ingreso y mostrar solo quienes tengan actividad
  const statsNonZero = stats.filter(s => (s.count || 0) > 0);
  if (statsNonZero.length === 0) {
    await sock.sendMessage(chatId, { text: 'No hay actividad registrada desde el ingreso de los participantes.' }, { quoted: message });
    return;
  }

  // Ordenar descendente por actividad (más activos primero)
  const sortedDesc = [...statsNonZero].sort((a, b) => (b.count - a.count) || (b.lastTs - a.lastTs));

  // Normalizar JIDs y resolver contra groupMetadata.participants para usar el JID exacto que WhatsApp reconoce
  const normalizeJid = (jid) => {
    if (!jid) return jid;
    if (typeof jid !== 'string') jid = jid.toString();
    if (jid.endsWith('@lid')) return jid.split('@')[0] + '@s.whatsapp.net';
    if (!jid.includes('@')) return jid + '@s.whatsapp.net';
    return jid;
  };

  const resolveMention = (jid) => {
    const short = (jid || '').toString().split('@')[0];
    if (groupMetadata && Array.isArray(groupMetadata.participants)) {
      const p = groupMetadata.participants.find(x => {
        const id = (x && (x.id || x).toString()) || '';
        return id.split('@')[0] === short;
      });
      if (p && p.id) return p.id;
    }
    return normalizeJid(jid);
  };

  // Resolver JIDs y preparar datos para la lista y menciones
  const resolved = sortedDesc.map(t => {
    const full = resolveMention(t.jid);
    const short = (full || '').toString().split('@')[0];
    return { ...t, resolvedJid: full, short };
  });
  const mentionsAll = resolved.map(r => r.resolvedJid).filter(Boolean);

  const findName = (jid) => {
    const short = (jid || '').toString().split('@')[0];
    if (!groupMetadata || !Array.isArray(groupMetadata.participants)) return short;
    const p = groupMetadata.participants.find(x => {
      const id = (x && (x.id || x).toString()) || '';
      return id.split('@')[0] === short;
    });
    if (!p) return short;
    return (p.notify || p.notifyName || p.name || p.pushname || (p.id && p.id.split('@')[0]) || short).toString();
  };

  const buildList = (arr) => arr.map((x, i) => {
    const short = x.short || (x.resolvedJid || '').toString().split('@')[0];
    return `${i + 1}. @${short} (${x.count})`;
  }).join('\n');

  const listDisplay = buildList(resolved);

  // Construir lista de inactivos (sin mostrar contador)
  const inactive = stats.filter(s => (s.count || 0) === 0);
  const resolvedInactive = inactive.map(i => {
    const full = resolveMention(i.jid);
    const short = (full || '').toString().split('@')[0];
    return { jid: i.jid, resolvedJid: full, short };
  }).filter(x => x && x.resolvedJid);

  const inactiveDisplay = resolvedInactive.map((r, i) => `${i + 1}. @${r.short}`).join('\n');

  const text = `📊 Los más activos (${resolved.length})\n\n` +
    `${listDisplay || 'N/A'}\n\n` +
    `❄️ Inactivos:\n${inactiveDisplay || 'N/A'}`;

  const mentions = Array.from(new Set([...mentionsAll, ...resolvedInactive.map(r => r.resolvedJid)]));

  // Leer config de always_tag y añadir esas menciones si pertenecen al grupo
  try {
    const cfgPath = path.resolve('./config/always_tag.json');
    const raw = await fs.readFile(cfgPath, 'utf8');
    const cfg = JSON.parse(raw || '[]');
    if (Array.isArray(cfg) && cfg.length) {
      // filtrar solo participantes existentes
      const toAdd = cfg.map(x => (x || '').toString()).filter(x => !!x);
      const participantIds = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants.map(p => (p.id || p).toString()) : [];
      const valid = toAdd.map(x => {
        // normalizar similar a resolveMention
        const short = x.split('@')[0];
        const p = participantIds.find(id => id.split('@')[0] === short);
        return p || null;
      }).filter(Boolean);
      for (const v of valid) mentions.push(v);
    }
  } catch (e) {}

  await sock.sendMessage(chatId, { text, mentions }, { quoted: message });
}

export default activeStats;
