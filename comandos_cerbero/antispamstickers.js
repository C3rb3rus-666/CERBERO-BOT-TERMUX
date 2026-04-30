import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const blacklistPath = join(__dirname, '../comandos_cerbero/configuraciones/blacklist.json');

const stickerSpamMap = new Map();
const STICKER_LIMIT = 3;
const MAX_DELAY = 3000; // 3 segundos
const MAX_MESSAGE_AGE = 10000; // 10 segundos, evita ráfagas heredadas tras reinicio

async function readBlacklist() {
  try {
    if (!fsSync.existsSync(blacklistPath)) return [];
    const data = await fs.readFile(blacklistPath, 'utf-8');
    const json = JSON.parse(data);
    return Array.isArray(json.blacklist) ? json.blacklist : [];
  } catch (e) {
    console.error('Error leyendo blacklist.json:', e);
    return [];
  }
}

async function writeBlacklist(blacklist) {
  const json = { blacklist };
  try {
    await fs.writeFile(blacklistPath, JSON.stringify(json, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error guardando blacklist.json:', e);
  }
}

/**
 * Antispam de stickers: advierte y expulsa al usuario si abusa.
 * @param {object} sock - Cliente de Baileys.
 * @param {object} message - Mensaje recibido.
 * @param {boolean} isAdmin - Si el usuario es administrador.
 */
export async function handleStickerSpam(sock, message, isAdmin) {
  const groupId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;
  const now = Date.now();
  const isSticker = !!message.message?.stickerMessage;
  const isGroup = groupId.endsWith('@g.us');

  if (!isGroup || isAdmin) return;

  if (!isSticker) {
    stickerSpamMap.delete(senderId);
    return;
  }

  const messageSeconds = Number(message.messageTimestamp ?? message.message?.messageTimestamp ?? 0);
  const sentTime = messageSeconds > 0 ? messageSeconds * 1000 : now;
  const messageAge = now - sentTime;

  if (messageAge > MAX_MESSAGE_AGE) {
    // Mensaje viejo / entregado después de reinicio: no contar como ráfaga.
    stickerSpamMap.delete(senderId);
  }

  const userNumber = senderId.split('@')[0];
  let userData = stickerSpamMap.get(senderId);

  if (!userData) {
    userData = { count: 1, lastTime: sentTime, warned: false };
    stickerSpamMap.set(senderId, userData);
    return;
  }

  const timeDiff = sentTime - userData.lastTime;

  if (timeDiff > MAX_DELAY || timeDiff < 0) {
    userData.count = 1;
    userData.lastTime = sentTime;
    userData.warned = false;
    return;
  }

  userData.count += 1;
  userData.lastTime = sentTime;

  if (userData.count === STICKER_LIMIT) {
    if (!userData.warned) {
      const remainingMs = MAX_DELAY - timeDiff;
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      const warningMessage = `╔═══════════════════════╗
║ ⚠️ *[ CERBERO-BOT ]* ⚠️
╠═══════════════════════╣
║ @${userNumber}, estás enviando
║ demasiados stickers seguidos.
║ 
║ 🕒 *Espera ${remainingSeconds} segundo(s)* 
║ antes de enviar otro o serás
║ *EXPULSADO del grupo*.
╚═══════════════════════╝`;

      await sock.sendMessage(groupId, {
        text: warningMessage,
        mentions: [senderId],
      });

      userData.warned = true;
    }
    return;
  }

  if (userData.count > STICKER_LIMIT) {
    try {
      await sock.groupParticipantsUpdate(groupId, [senderId], 'remove');

      const userNumberInt = parseInt(userNumber, 10);
      if (!isNaN(userNumberInt)) {
        const blacklist = await readBlacklist();
        if (!blacklist.includes(userNumberInt)) {
          blacklist.push(userNumberInt);
          await writeBlacklist(blacklist);
          console.log(`✅ Número ${userNumberInt} añadido a blacklist.json por spam de stickers.`);
        }
      }

      const msg = `╔═══════════════════════╗
║ ⚠️ *[ CERBERO-BOT ]* ⚠️
╠═══════════════════════╣
║ @${userNumber} fue expulsado
║ por ignorar la advertencia
║ y hacer spam de stickers.
╚═══════════════════════╝`;

      await sock.sendMessage(groupId, {
        text: msg,
        mentions: [senderId],
      });

      await sock.sendMessage(groupId, {
        delete: message.key,
      });

    } catch (error) {
      console.error('❌ Error al expulsar:', error);
    } finally {
      stickerSpamMap.delete(senderId);
    }
  }
}
