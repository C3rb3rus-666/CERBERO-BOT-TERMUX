/**
 * anti_status_tag.js
 * Detecta cuando un miembro etiqueta al grupo en su estado de WhatsApp.
 *
 * Comportamiento:
 * - Elimina la notificación/mensaje de etiqueta dentro del grupo
 * - Envía una advertencia pública en el grupo mencionando al infractor
 * - Envía una advertencia pública en el grupo mencionando al infractor
 * - NO expulsa al miembro
 *
 * Cómo funciona:
 * - Cuando alguien etiqueta un grupo en su estado, WhatsApp genera un
 *   mensaje con remoteJid = "status@broadcast" y contextInfo.groupMentions.
 * - Baileys también emite el evento en el grupo como groupMentionMessage.
 * - El bot borra ese mensaje del grupo y advierte.
 *
 * Comandos:
 *   !antistatustag on  → activa en el grupo actual
 *   !antistatustag off → desactiva en el grupo actual
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.resolve(__dirname, '../config/anti_status_tag.json');

// Creador del bot (no puede ser expulsado)
const CREATOR_IDS = ['573233704652', '64279084535828'];
function isCreator(jid) {
    const clean = (jid || '').split('@')[0].split(':')[0];
    return CREATOR_IDS.includes(clean);
}

// ─── Persistencia ────────────────────────────────────────────────────────────
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    } catch (_) {}
    return {}; // { [groupJid]: true/false }
}

function saveConfig(cfg) {
    try { fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2)); } catch (_) {}
}

// ─── Comando !antistatustag on/off ───────────────────────────────────────────
export async function handleAntiStatusTagCmd(sock, msg, isAdmin) {
    const chatId = msg.key.remoteJid;
    const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
    const arg = text.split(/\s+/)[1]?.toLowerCase();

    if (!isAdmin) {
        await sock.sendMessage(chatId, { text: '🚫 Solo los admins pueden configurar esta función.' }, { quoted: msg });
        return;
    }

    if (!['on', 'off'].includes(arg)) {
        await sock.sendMessage(chatId, {
            text: `📌 *Anti Status Tag*\n\nCuando un miembro etiqueta este grupo en su estado, el bot elimina la notificación del grupo y lo avisa públicamente en el grupo.\n\n• *!antistatustag on* — activar\n• *!antistatustag off* — desactivar`
        }, { quoted: msg });
        return;
    }

    const cfg = loadConfig();
    cfg[chatId] = arg === 'on';
    saveConfig(cfg);

    const estado = arg === 'on' ? '🟢 Activado' : '🔴 Desactivado';
    await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🏷️ *Anti Status Tag ${estado}*\n\n${arg === 'on'
            ? 'Si alguien etiqueta este grupo en su estado, la notificación será eliminada y el miembro será avisado públicamente en el grupo.'
            : 'Ya no se eliminarán etiquetas de estado en este grupo.'}`
    }, { quoted: msg });
}

// ─── Detector de etiquetas en estado ─────────────────────────────────────────
/**
 * Llamar desde el listener messages.upsert del index.js
 * cuando remoteJid === 'status@broadcast'
 *
 * @param {object} sock - instancia Baileys
 * @param {object} msg  - mensaje recibido
 */
export async function checkStatusTag(sock, msg) {
    // Este handler ya no se usa — la detección real ocurre en checkGroupMentionedMessage
    // WhatsApp NO incluye groupMentions en status@broadcast; la notificación llega
    // directamente al grupo como groupMentionedMessage.
}

/**
 * Detecta groupMentionedMessage que llega al grupo cuando alguien etiqueta
 * ese grupo en su estado de WhatsApp.
 *
 * Llamar desde messages.upsert cuando remoteJid termina en @g.us.
 *
 * @param {object} sock - instancia Baileys
 * @param {object} msg  - mensaje recibido
 */
export async function checkGroupMentionedMessage(sock, msg) {
    try {
        if (msg.key.fromMe) return;

        const msgContent = msg.message || {};

        // WhatsApp envía la notificación de etiqueta de estado como groupMentionedMessage
        // (a veces también dentro de ephemeralMessage o viewOnceMessage)
        const inner = msgContent.groupMentionedMessage
            || msgContent.ephemeralMessage?.message?.groupMentionedMessage
            || msgContent.viewOnceMessage?.message?.groupMentionedMessage
            || null;

        if (!inner) return; // no es una etiqueta de estado

        const groupJid = msg.key.remoteJid; // el grupo que fue etiquetado
        const senderJid = msg.key.participant || msg.key.remoteJid;

        console.log(`[ANTI_STATUS_TAG] 🏷️ groupMentionedMessage detectado en ${groupJid} de ${senderJid}`);

        const cfg = loadConfig();
        if (!cfg[groupJid]) return; // anti_status_tag no activo en este grupo

        // 1️⃣ Borrar el mensaje de notificación del grupo
        try {
            await sock.sendMessage(groupJid, { delete: msg.key });
            console.log('[ANTI_STATUS_TAG] 🗑️ mensaje borrado del grupo');
        } catch (e) {
            console.log('[ANTI_STATUS_TAG] ⚠️ delete falló:', e?.message);
        }

        // 2️⃣ Advertencia pública en el grupo
        if (!isCreator(senderJid)) {
            const senderNum = senderJid.split('@')[0];
            await sock.sendMessage(groupJid, {
                text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🏷️⚠️ @${senderNum} etiquetó este grupo en su estado.\nPor favor evita hacerlo.`,
                mentions: [senderJid]
            });
        }

        console.log(`[ANTI_STATUS_TAG] ✅ procesado: ${senderJid} en ${groupJid}`);
    } catch (err) {
        console.error('[ANTI_STATUS_TAG] error:', err?.message || err);
    }
}
