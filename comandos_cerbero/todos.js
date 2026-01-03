// comandos_cerbero/todos.js
import { areJidsSameUser } from '@whiskeysockets/baileys';

const forbiddenTag = '@573233704652'; // Lista de etiquetas/números prohibidos

// -- Configuración anti-abuso -------------------------------------------------
const TODOS_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutos entre usos por usuario
const DAILY_LIMIT = 6;                    // Máximo usos por usuario en 24 horas

const userLastUsed = new Map();         // userId -> timestamp
const userUsageLog = new Map();         // userId -> [timestamps]
// -----------------------------------------------------------------------------

export async function sendToAll(sock, msg, isAdmin, groupMetadata) {
  const chatId = msg.key.remoteJid;
  const messageContent = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       '';
  // Declaración defensiva para evitar ReferenceError si `participants` se usa antes de asignarse
  let participants = []; 
  
  try {
    // Verificación de permisos
    if (!isAdmin && !msg.key.fromMe) {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, { 
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐬𝐭𝐞 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 𝐬𝐨𝐥𝐨 𝐩𝐮𝐞𝐝𝐞 𝐬𝐞𝐫 𝐮𝐭𝐢𝐥𝐢𝐳𝐚𝐝𝐨 𝐩𝐨𝐫 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫𝐞𝐬.'
      },
    { quoted: msg }
    );
      return;
    }

    const participantId = msg.key.participant || msg.key.remoteJid;
    const now = Date.now();
    const groupKey = msg.key.remoteJid;

    // Control anti-abuso: cooldown por usuario
    const lastUser = userLastUsed.get(participantId) || 0;
    if (now - lastUser < TODOS_COOLDOWN_MS) {
      const remain = Math.ceil((TODOS_COOLDOWN_MS - (now - lastUser)) / 60000);
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ El comando !todos está en cooldown para ti. Intenta de nuevo en ${remain} minuto(s).`
      }, { quoted: msg });
      return;
    }

    // Control anti-abuso: límite diario por usuario
    const usages = (userUsageLog.get(participantId) || []).filter(ts => now - ts < 24*60*60*1000);
    if (usages.length >= DAILY_LIMIT) {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, {
        text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ Ya alcanzaste el límite de ${DAILY_LIMIT} usos de !todos en las últimas 24 horas.`
      }, { quoted: msg });
      return;
    }

    const customMessage = messageContent.split(' ').slice(1).join(' ');
    if (!customMessage) {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, { 
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐏𝐫𝐨𝐩𝐨𝐫𝐜𝐢𝐨𝐧𝐚 𝐮𝐧 𝐦𝐞𝐧𝐬𝐚𝐣𝐞 𝐝𝐞𝐬𝐩𝐮é𝐬 𝐝𝐞𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 𝐄𝐣𝐞𝐦𝐩𝐥𝐨: !𝐭𝐨𝐝𝐨𝐬 𝐝𝐢𝐧𝐚𝐦𝐢𝐜𝐚 '
      },
      { quoted: msg });
      return;
    }

    // Obtención de participantes (si tenemos metadata, la usamos; si no, quedará como array vacío)
    participants = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants : participants;

    // Construcción de menciones (defensiva)
    const mentions = (participants || [])
      .filter(participant => !areJidsSameUser(participant.id, sock.user.id)) // Excluir al bot
      .map(participant => participant.id);

    // Formateo del mensaje
    const formattedMessage = `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬\n` +
                             `${customMessage}\n\n` +
                             `${mentions.map(id => `@${id.split('@')[0]}`).join(' ')}`;

    // Envío del mensaje
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, { 
      text: formattedMessage,
      mentions
    },
    { quoted: msg });

    // Actualizar registros de uso (anti-abuso)
    try {
      userLastUsed.set(participantId, now);
      const arr = userUsageLog.get(participantId) || [];
      arr.push(now);
      userUsageLog.set(participantId, arr);
    } catch (e) {
      console.warn('No se pudo actualizar el registro de uso:', e);
    }

  } catch (error) {
    console.error('Error en comando todos:', error);
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐫𝐫𝐨𝐫 𝐚𝐥 𝐦𝐞𝐧𝐜𝐢𝐨𝐧𝐚𝐫 𝐚 𝐥𝐨𝐬 𝐦𝐢𝐞𝐦𝐛𝐫𝐨𝐬. 𝐕𝐞𝐫𝐢𝐟𝐢𝐜𝐚 𝐪𝐮𝐞 𝐞𝐥 𝐛𝐨𝐭 𝐬𝐞𝐚 𝐚𝐝𝐦𝐢𝐧.'
    },
    { quoted: msg });
  }
}