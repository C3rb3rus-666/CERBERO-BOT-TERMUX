/**
 * anti_status_tag.js
 * Detecta cuando un miembro etiqueta al grupo en su estado de WhatsApp
 * y expulsa automáticamente al infractor si la función está activa.
 *
 * Cómo funciona:
 * - Cuando alguien etiqueta un grupo en su estado, WhatsApp envía un mensaje
 *   con remoteJid = "status@broadcast" que contiene en contextInfo.groupMentions
 *   los JIDs de los grupos mencionados.
 * - El bot verifica si el remitente pertenece a alguno de sus grupos con
 *   anti_status_tag activo y lo expulsa.
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
            text: `📌 *Anti Status Tag*\n\nImpide que los miembros etiqueten este grupo en sus estados y los expulsa automáticamente.\n\n• *!antistatustag on* — activar\n• *!antistatustag off* — desactivar`
        }, { quoted: msg });
        return;
    }

    const cfg = loadConfig();
    cfg[chatId] = arg === 'on';
    saveConfig(cfg);

    const estado = arg === 'on' ? '🟢 Activado' : '🔴 Desactivado';
    await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🏷️ *Anti Status Tag ${estado}*\n\n${arg === 'on'
            ? 'Si alguien etiqueta este grupo en su estado, recibirá una advertencia pública y un DM para que la elimine.'
            : 'Ya no se monitorizarán etiquetas en estados.'}`
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

        // Extraer grupos mencionados del contextInfo
        const contextInfo = msg.message?.extendedTextMessage?.contextInfo
            || msg.message?.imageMessage?.contextInfo
            || msg.message?.videoMessage?.contextInfo
            || msg.message?.documentMessage?.contextInfo
            || null;

        // groupMentions es un array de { groupJid, subject } en versiones nuevas de WA
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

            const num = senderJid.split('@')[0];
            const groupName = metadata.subject || groupJid;

            // ⚠️ Advertencia pública en el grupo
            await sock.sendMessage(groupJid, {
                text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🏷️⚠️ @${num} etiquetó este grupo en su estado de WhatsApp.\n\n`
                    + `Por favor elimina la etiqueta de tu estado. Si vuelves a hacerlo podrás ser expulsado.`,
                mentions: [senderJid]
            });

            // 📩 Advertencia privada al usuario
            try {
                await sock.sendMessage(senderJid, {
                    text: `⚠️ *Advertencia del grupo "${groupName}"*\n\n`
                        + `Etiquetaste ese grupo en tu estado de WhatsApp. Esto no está permitido.\n`
                        + `Por favor *elimina la etiqueta de tu estado* para evitar ser expulsado.`
                });
            } catch (_) {
                // Si no se puede enviar DM (privacidad del usuario) se ignora
            }

            console.log(`[ANTI_STATUS_TAG] advertido ${senderJid} en ${groupJid} por etiquetar en estado`);
        }
    } catch (err) {
        console.error('[ANTI_STATUS_TAG] error:', err?.message || err);
    }
}
