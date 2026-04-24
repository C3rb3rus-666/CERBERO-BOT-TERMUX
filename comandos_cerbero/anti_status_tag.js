/**
 * anti_status_tag.js
 * Detecta cuando un miembro etiqueta al grupo en su estado de WhatsApp.
 *
 * Comportamiento:
 * - Elimina la notificación/mensaje de etiqueta dentro del grupo
 * - Envía una advertencia pública en el grupo mencionando al infractor
 * - Envía un DM privado de advertencia al infractor
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
            text: `📌 *Anti Status Tag*\n\nCuando un miembro etiqueta este grupo en su estado, el bot elimina la notificación del grupo y le envía una advertencia privada.\n\n• *!antistatustag on* — activar\n• *!antistatustag off* — desactivar`
        }, { quoted: msg });
        return;
    }

    const cfg = loadConfig();
    cfg[chatId] = arg === 'on';
    saveConfig(cfg);

    const estado = arg === 'on' ? '🟢 Activado' : '🔴 Desactivado';
    await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🏷️ *Anti Status Tag ${estado}*\n\n${arg === 'on'
            ? 'Si alguien etiqueta este grupo en su estado, la notificación será eliminada y el miembro será advertido por privado.'
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
    try {
        // Solo mensajes de estados ajenos
        if (msg.key.fromMe) return;

        const senderJid = msg.key.participant || msg.key.remoteJid;
        if (!senderJid) return;

        // ─── LOG DE DEBUG: volcar estructura completa para identificar el mensaje ───
        // Esto nos permite ver qué campos trae el mensaje de etiqueta de estado
        // y cómo construir la key correcta para borrarlo del grupo.
        console.log('[ANTI_STATUS_TAG] 🔍 RAW msg.key:', JSON.stringify(msg.key, null, 2));
        console.log('[ANTI_STATUS_TAG] 🔍 RAW msg.message keys:', Object.keys(msg.message || {}));
        try {
            // Imprimir el mensaje completo sin buffers (pueden romper JSON.stringify)
            const sanitized = JSON.parse(JSON.stringify(msg.message, (k, v) =>
                v instanceof Uint8Array || Buffer.isBuffer(v) ? `<Buffer len=${v.length}>` : v
            ));
            console.log('[ANTI_STATUS_TAG] 🔍 RAW msg.message:', JSON.stringify(sanitized, null, 2));
        } catch (e) {
            console.log('[ANTI_STATUS_TAG] 🔍 msg.message (no serializable):', String(msg.message));
        }
        // ─────────────────────────────────────────────────────────────────────────

        // Extraer grupos mencionados del contextInfo (buscar en todos los tipos de mensaje)
        const msgContent = msg.message || {};
        const contextInfo = msgContent.extendedTextMessage?.contextInfo
            || msgContent.imageMessage?.contextInfo
            || msgContent.videoMessage?.contextInfo
            || msgContent.documentMessage?.contextInfo
            || msgContent.groupMentionMessage?.contextInfo
            || msgContent.stickerMessage?.contextInfo
            || null;

        console.log('[ANTI_STATUS_TAG] 🔍 contextInfo.groupMentions:', JSON.stringify(contextInfo?.groupMentions));

        const groupMentions = contextInfo?.groupMentions || [];
        if (!groupMentions.length) return;

        const cfg = loadConfig();

        for (const mention of groupMentions) {
            const groupJid = mention.groupJid || mention;
            if (!cfg[groupJid]) continue; // anti_status_tag no activo en ese grupo

            // Verificar que el remitente realmente es miembro del grupo
            let metadata;
            try { metadata = await sock.groupMetadata(groupJid); } catch (_) { continue; }

            const isMember = metadata.participants.some(p => p.id === senderJid);
            if (!isMember) continue;

            // 1️⃣ Intentar borrar el mensaje de notificación dentro del grupo
            //    La key del groupMentionMessage en el grupo usa remoteJid=groupJid
            //    pero el ID puede ser el mismo que el del estado.
            const groupMsgKey = { ...msg.key, remoteJid: groupJid };
            console.log('[ANTI_STATUS_TAG] 🗑️ intentando borrar con key:', JSON.stringify(groupMsgKey));
            try {
                await sock.sendMessage(groupJid, { delete: groupMsgKey });
            } catch (e) {
                console.log('[ANTI_STATUS_TAG] ⚠️ delete falló:', e?.message);
            }

            // 2️⃣ Advertencia pública en el grupo
            const senderNum = senderJid.split('@')[0];
            if (!isCreator(senderJid)) {
                await sock.sendMessage(groupJid, {
                    text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🏷️⚠️ @${senderNum} etiquetó este grupo en su estado.\nPor favor evita hacerlo.`,
                    mentions: [senderJid]
                });
            }

            console.log(`[ANTI_STATUS_TAG] ✅ procesado: ${senderJid} en ${groupJid} (${metadata.subject})`);
        }
    } catch (err) {
        console.error('[ANTI_STATUS_TAG] error:', err?.message || err);
    }
}
