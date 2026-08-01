import fs from 'fs/promises';
import { denyIfNotOwner } from './owner_guard.js';

const LOG_PATH = './comandos_cerbero/configuraciones/deleted_links.json';

export async function readLog(sock, message) {
  try {
    const denied = await denyIfNotOwner(sock, message);
    if (denied) return;

    // Leer el archivo de logs
    const data = await fs.readFile(LOG_PATH, 'utf-8');
    const logs = JSON.parse(data);

    if (!logs.length) {
      await sock.sendMessage(
        message.key.remoteJid,
        { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐍𝐨 𝐡𝐚𝐲 𝐥𝐨𝐠𝐬 𝐝𝐢𝐬𝐩𝐨𝐧𝐢𝐛𝐥𝐞𝐬.' },
        { quoted: message }
      );
      return;
    }

    // Enviar cada log en un mensaje separado
    for (const log of logs) {
      const logMessage = `📆 *Fecha:* ${new Date(log.fecha).toLocaleString()}\n` +
        `👤 *Remitente:* ${log.remitente.nombre} (${log.remitente.numero})\n` +
        `📌 *Grupo:* ${log.grupo.nombre} (${log.grupo.id})\n` +
        `🔗 *Links:* ${log.links.join(', ') || 'Ninguno'}\n` +
        '──────────────────────\n';

      await sock.sendMessage(message.key.remoteJid, { text: logMessage }, { quoted: message });

      // Espera 1 segundo entre mensajes para evitar bloqueos de spam
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error('Error al leer logs:', error);
    await sock.sendMessage(
      message.key.remoteJid,
      { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐄𝐫𝐫𝐨𝐫 𝐚𝐥 𝐥𝐞𝐞𝐫 𝐥𝐨𝐬 𝐫𝐞𝐠𝐢𝐬𝐭𝐫𝐨𝐬.' },
      { quoted: message }
    );
  }
}
