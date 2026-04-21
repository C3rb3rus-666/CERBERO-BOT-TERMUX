import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'configuraciones', 'monitor_admin_config.json');

// ─── Persistencia de configuración ─────────────────────────────
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { enabled_groups: {} };
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * Verifica si el monitoreo de admins está activo para un grupo.
 */
export function isMonitorEnabled(groupId) {
  const config = loadConfig();
  return !!config.enabled_groups[groupId];
}

/**
 * Comando !vigilar [activar|desactivar]
 * Toggle del monitor de cambios de admin por grupo. Solo admins.
 */
export async function toggleMonitorAdmin(sock, msg, isAdmin) {
  const chatId = msg.key.remoteJid;

  if (!isAdmin) {
    await sock.sendMessage(chatId, {
      text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🚫 Solo los administradores pueden usar este comando.'
    }, { quoted: msg });
    return;
  }

  const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const args = text.trim().split(/\s+/);
  const action = args[1]?.toLowerCase();

  if (!action || !['activar', 'desactivar'].includes(action)) {
    const config = loadConfig();
    const current = config.enabled_groups[chatId] ? '🟢 Activado' : '🔴 Desactivado';
    await sock.sendMessage(chatId, {
      text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🛡️ *Vigilancia de Admins*\n\n` +
            `Estado actual: ${current}\n\n` +
            `• \`!vigilar activar\` — Activa monitoreo\n` +
            `• \`!vigilar desactivar\` — Desactiva monitoreo\n\n` +
            `Cuando está activo, el bot notifica al grupo si alguien es promovido o degradado como admin.`
    }, { quoted: msg });
    return;
  }

  const config = loadConfig();
  const currentStatus = !!config.enabled_groups[chatId];

  if ((action === 'activar' && currentStatus) || (action === 'desactivar' && !currentStatus)) {
    await sock.sendMessage(chatId, {
      text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ La vigilancia de admins ya está ${currentStatus ? 'activada' : 'desactivada'} en este grupo.`
    }, { quoted: msg });
    return;
  }

  config.enabled_groups[chatId] = action === 'activar';
  saveConfig(config);

  const emoji = action === 'activar' ? '🟢' : '🔴';
  await sock.sendMessage(chatId, {
    text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ${emoji} Vigilancia de admins *${action === 'activar' ? 'ACTIVADA' : 'DESACTIVADA'}* en este grupo.`
  }, { quoted: msg });
}

// ─── Helpers de resolución ──────────────────────────────────────

/**
 * Resuelve un JID (puede ser LID) a su número de teléfono real
 * usando groupMetadata.participants y el campo phoneNumber.
 */
function resolveRealNumber(jid, groupMetadata) {
  if (!jid) return null;
  const clean = (jid || '').split('@')[0].split(':')[0];

  if (groupMetadata && Array.isArray(groupMetadata.participants)) {
    for (const p of groupMetadata.participants) {
      const pId = (p.id || '').split('@')[0].split(':')[0];
      const pPhone = p.phoneNumber ? p.phoneNumber.toString().split('@')[0] : null;

      if (pId === clean) return pPhone || pId;
      if (pPhone === clean) return pPhone;
    }
  }
  return clean;
}

/**
 * Resuelve nombre de contacto con fallback robusto.
 */
function resolveName(jid, sock, groupMetadata) {
  if (!jid) return 'Desconocido';
  const realNum = resolveRealNumber(jid, groupMetadata);
  const fallback = realNum || jid.split('@')[0];

  if (groupMetadata && Array.isArray(groupMetadata.participants)) {
    const clean = (jid || '').split('@')[0].split(':')[0];
    for (const p of groupMetadata.participants) {
      const pId = (p.id || '').split('@')[0].split(':')[0];
      const pPhone = p.phoneNumber ? p.phoneNumber.toString().split('@')[0] : null;

      if (pId === clean || pPhone === clean) {
        const name = p.notify || p.notifyName || p.name || p.pushname;
        if (name) return name;
      }
    }
  }

  try {
    if (sock?.store?.contacts) {
      const c = sock.store.contacts[jid];
      if (c) return c.notify || c.name || fallback;
    }
    if (sock?.contacts) {
      const c = sock.contacts[jid];
      if (c) return c.notify || c.name || fallback;
    }
  } catch { /* silenciar */ }

  return fallback;
}

/**
 * Intenta extraer el actor (quién ejecutó la acción) del update de Baileys.
 */
function findActor(update, participants) {
  const candidates = [];

  const tryAdd = (val) => {
    if (!val) return;
    if (typeof val === 'string') {
      candidates.push(val);
    } else if (typeof val === 'object') {
      if (val.id) candidates.push(val.id);
      if (val.jid) candidates.push(val.jid);
      if (val.phoneNumber) candidates.push(val.phoneNumber.toString());
    }
  };

  ['actor', 'author', 'participant', 'by', 'initiator', 'from', 'sender', 'admin', 'performer']
    .forEach(f => tryAdd(update?.[f]));

  if (Array.isArray(participants)) {
    for (const p of participants) {
      if (typeof p === 'object') {
        ['actor', 'performedBy', 'performed_by', 'by', 'removedBy', 'addedBy', 'performer', 'author']
          .forEach(f => tryAdd(p?.[f]));
      }
    }
  }

  const valid = candidates.filter(Boolean).map(c =>
    c.includes('@') ? c : `${c}@s.whatsapp.net`
  );

  return valid.length ? valid[0] : null;
}

// ─── Handler principal de eventos de grupo ───────────────────────

export async function onGroupUpdate(sock, update) {
  try {
    const { id: chatId, participants, action } = update;

    // Solo procesar si el monitoreo está activo para este grupo
    if (!isMonitorEnabled(chatId)) return;

    // Solo nos interesan promote y demote
    if (action !== 'demote' && action !== 'promote') return;

    // Obtener metadata para resolución LID→teléfono
    let groupMetadata;
    try {
      groupMetadata = await sock.groupMetadata(chatId);
    } catch {
      groupMetadata = null;
    }

    const targetRaw = Array.isArray(participants) && participants.length ? participants[0] : null;
    const targetJid = typeof targetRaw === 'string' ? targetRaw :
                      (targetRaw?.id || targetRaw?.jid || targetRaw?.phoneNumber || null);

    const actorJid = findActor(update, participants);

    // Resolver a números reales (no LIDs)
    const targetNum = resolveRealNumber(targetJid, groupMetadata);
    const actorNum = actorJid ? resolveRealNumber(actorJid, groupMetadata) : null;

    const targetName = resolveName(targetJid, sock, groupMetadata);
    const actorName = actorJid ? resolveName(actorJid, sock, groupMetadata) : null;

    // Preparar menciones (JIDs originales para que WhatsApp los resuelva)
    const mentions = [];
    if (targetJid) mentions.push(targetJid);
    if (actorJid && actorJid !== targetJid) mentions.push(actorJid);

    let text;

    if (action === 'demote') {
      if (actorJid && targetJid && actorJid !== targetJid) {
        text = `⚠️ [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🛡️ *Cambio de Admin Detectado*\n\n` +
               `👤 *${actorName}* (${actorNum}) ha *removido como admin* a:\n` +
               `🎯 *${targetName}* (${targetNum})`;
      } else if (actorJid && actorJid === targetJid) {
        text = `⚠️ [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🛡️ *Cambio de Admin Detectado*\n\n` +
               `👤 *${targetName}* (${targetNum}) ha perdido sus privilegios de admin (acción propia).`;
      } else {
        text = `⚠️ [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🛡️ *Cambio de Admin Detectado*\n\n` +
               `🎯 *${targetName}* (${targetNum}) ha sido *removido como admin*.`;
      }
    } else {
      if (actorJid && targetJid) {
        text = `✅ [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🛡️ *Nuevo Admin Detectado*\n\n` +
               `👤 *${actorName}* (${actorNum}) ha *promovido a admin* a:\n` +
               `🎯 *${targetName}* (${targetNum})`;
      } else {
        text = `✅ [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🛡️ *Nuevo Admin Detectado*\n\n` +
               `🎯 *${targetName}* (${targetNum}) ha sido *promovido a admin*.`;
      }
    }

    await sock.sendMessage(chatId, { text, mentions });

  } catch (e) {
    console.error('[MONITOR-ADMIN] Error en onGroupUpdate:', e);
  }
}

// Cuando hay participantes añadidos, establecer baseline para contadores
export async function onGroupAddBaseline(sock, update) {
  try {
    const { id, participants, action } = update;
    if (action !== 'add' && action !== 'invite') return;

    const added = Array.isArray(participants) ? participants : [];
    for (const raw of added) {
      const jid = typeof raw === 'string' ? raw : (raw?.id || raw?.jid || raw?.phoneNumber || null);
      if (!jid) continue;
      try {
        const { setBaseline } = await import('../utils/messageCounter.js');
        await setBaseline(id, jid);
      } catch { /* no bloquear */ }
    }
  } catch { /* silenciar */ }
}
  