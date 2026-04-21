// comandos_cerbero/todos.js
import { areJidsSameUser } from '@whiskeysockets/baileys';

const ADMIN_ONLY_MESSAGE = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 𝐬𝐨𝐥𝐨 𝐩𝐮𝐞𝐝𝐞 𝐬𝐞𝐫 𝐮𝐭𝐢𝐥𝐢𝐳𝐚𝐝𝐨 𝐩𝐨𝐫 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫𝐞𝐬.';
const MISSING_MESSAGE_HINT = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐏𝐫𝐨𝐩𝐨𝐫𝐜𝐢𝐨𝐧𝐚 𝐮𝐧 𝐦𝐞𝐧𝐬𝐚𝐣𝐞 𝐝𝐞𝐬𝐩𝐮é𝐬 𝐝𝐞𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 𝐄𝐣𝐞𝐦𝐩𝐥𝐨: !𝐭𝐨𝐝𝐨𝐬 𝐝𝐢𝐧𝐚𝐦𝐢𝐜𝐚';

export async function sendToAll(sock, msg, isAdmin, groupMetadata) {
  const chatId = msg.key.remoteJid;
  const messageContent = msg.message?.conversation || 
                       msg.message?.extendedTextMessage?.text || 
                       '';
  let participants = [];

  try {
    if (!isAdmin && !msg.key.fromMe) {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, { text: ADMIN_ONLY_MESSAGE }, { quoted: msg });
      return;
    }

    const customMessage = messageContent.split(' ').slice(1).join(' ');
    if (!customMessage) {
      await sock.sendPresenceUpdate('composing', chatId);
      await sock.sendMessage(chatId, { text: MISSING_MESSAGE_HINT }, { quoted: msg });
      return;
    }

    participants = (groupMetadata && Array.isArray(groupMetadata.participants)) ? groupMetadata.participants : participants;
    const mentions = (participants || [])
      .filter(participant => !areJidsSameUser(participant.id, sock.user.id))
      .map(participant => participant.id);

    const formattedMessage = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬\n' +
                             `${customMessage}\n\n` +
                             `${mentions.map(id => `@${id.split('@')[0]}`).join(' ')}`;

    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, { text: formattedMessage, mentions }, { quoted: msg });
  } catch (error) {
    console.error('Error en comando todos:', error);
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐫𝐫𝐨𝐫 𝐚𝐥 𝐦𝐞𝐧𝐜𝐢𝐨𝐧𝐚𝐫 𝐚 𝐥𝐨𝐬 𝐦𝐢𝐞𝐦𝐛𝐫𝐨𝐬. 𝐕𝐞𝐫𝐢𝐟𝐢𝐜𝐚 𝐪𝐮𝐞 𝐞𝐥 𝐛𝐨𝐭 𝐬𝐞𝐚 𝐚𝐝𝐦𝐢𝐧.'
    }, { quoted: msg });
  }
}
