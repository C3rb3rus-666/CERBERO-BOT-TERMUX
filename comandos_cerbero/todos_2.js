// comandos_cerbero/tag_group.js
import { areJidsSameUser } from '@whiskeysockets/baileys';

export async function tagGroupSilently(sock, msg, isAdmin,groupMetadata) {
  const chatId = msg.key.remoteJid;
  const messageContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  
  try {
    const participants = groupMetadata.participants;
    const sender = msg.key.participant;

    // Si el remitente no es administrador, enviar un mensaje de advertencia
    if (!isAdmin && !msg.key.fromMe) {
      await sock.sendMessage(chatId, { 
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐄𝐬𝐭𝐞 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 𝐬𝐨𝐥𝐨 𝐩𝐮𝐞𝐝𝐞 𝐬𝐞𝐫 𝐮𝐭𝐢𝐥𝐢𝐳𝐚𝐝𝐨 𝐩𝐨𝐫 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫𝐞𝐬.',
        quoted: msg
      });
      return; // Salir si el usuario no tiene permisos
    }

    // Extraer el mensaje que sigue al comando para enviarlo
    const customMessage = messageContent.split(' ').slice(1).join(' ');
    if (!customMessage) {
      await sock.sendMessage(chatId, { 
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬𝐏𝐫𝐨𝐩𝐨𝐫𝐜𝐢𝐨𝐧𝐚 𝐮𝐧 𝐦𝐞𝐧𝐬𝐚𝐣𝐞 𝐝𝐞𝐬𝐩𝐮𝐞𝐬 𝐝𝐞𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨 𝐩𝐚𝐫𝐚 𝐢𝐧𝐯𝐨𝐜𝐚𝐫 𝐚 𝐥𝐨𝐬 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐧𝐭𝐞𝐬.',
        quoted: msg
      });
      return;
    }

    // Crear la lista de menciones con los IDs de todos los miembros
    const mentions = participants.map(participant => participant.id);

    // Crear el texto a enviar
    const text = `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 ${customMessage}`;

    // Enviar el mensaje sin notificar a los participantes (sin menciones visibles)
    await sock.sendMessage(chatId, { text, mentions: [] , quoted: msg });
  } catch (error) {
    console.error('Error al invocar a la etiqueta silenciosa:', error);
    await sock.sendMessage(chatId, {
      text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 𝐇𝐮𝐛𝐨 𝐮𝐧 𝐞𝐫𝐫𝐨𝐫 𝐚𝐥 𝐢𝐧𝐭𝐞𝐧𝐭𝐚𝐫 𝐡𝐚𝐜𝐞𝐫 𝐥𝐚 𝐞𝐭𝐢𝐪𝐮𝐞𝐭𝐚 𝐬𝐢𝐥𝐞𝐧𝐜𝐢𝐨𝐬𝐚.',
      quoted: msg
    });
  }
}
