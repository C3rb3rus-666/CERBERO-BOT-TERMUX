import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'admin_messages_log.json');
const KEYWORDS = [
    'ban', 'baneo', 'baneado', 'banear', 'baneen',
    'expulsión', 'expulsion', 'expulsar', 'expulsen', 'expulsado',
    'kick', 'kickear', 'kickeado', 'kicked',
    'echado', 'echar', 'echen', 'fuera', 'sacar', 'saquen',
    'remove', 'removed', 'eliminar', 'eliminado', 'delete', 'deleted',
    '!ban', 'lobby', '.ban', '-ban', 
    '!kick', '.kick', '-kick',
    '!expulsar', '/expulsar', '.expulsar',
    '!remove', '/remove', '.remove', '-remove' , 'salida' , 'banamex'
  ];
  

function loadLogs() {
  if (!fs.existsSync(LOG_FILE_PATH)) {
    fs.writeFileSync(LOG_FILE_PATH, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(LOG_FILE_PATH, 'utf-8'));
}

function saveLog(messageData) {
  const logs = loadLogs();
  logs.push(messageData);
  fs.writeFileSync(LOG_FILE_PATH, JSON.stringify(logs, null, 2));
}

export async function monitorAdminMessages(sock, message, isAdmin) {
  const senderId = message.key.participant || message.key.remoteJid;


  if (!isAdmin) return;

  const messageContent = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
  const lowerCaseMessage = messageContent.toLowerCase();

  if (!KEYWORDS.some(keyword => lowerCaseMessage.includes(keyword))) return;

  // Obtener información del mensaje al que se respondió
  const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const repliedTo = {
    message: quotedMessage?.conversation || quotedMessage?.extendedTextMessage?.text || null,
    sender: quotedMessage ? message.message.extendedTextMessage.contextInfo.participant : null,
  };

  const messageData = {
    date: new Date().toISOString(),
    sender: senderId,
    message: messageContent,
    repliedTo: repliedTo, // Ahora incluye mensaje y remitente original
  };

  saveLog(messageData);

  await sock.sendMessage(message.key.remoteJid, {
    text: `⚠️ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderId.split('@')[0]}, tu mensaje ha sido registrado para análisis.`,
    mentions: [senderId],
  }, { quoted: message });
}