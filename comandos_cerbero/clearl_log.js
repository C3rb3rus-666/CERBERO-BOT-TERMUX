import fs from 'fs';
import path from 'path';

const deletedLinksPath = path.join(process.cwd(), 'comandos_cerbero/configuraciones/deleted_links.json');

async function clearOldLinkLogs(sock, message, isAdmin) {
  if (!isAdmin) {
    await sock.sendMessage(message.key.remoteJid, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Solo los administradores pueden ejecutar este comando.*'
    }, { quoted: message });
    return;
  }

  const args = message.message?.conversation?.split(' ');
  const days = args.length > 1 ? parseInt(args[1]) : 7; // Por defecto, borra registros de más de 7 días

  if (isNaN(days) || days <= 0) {
    await sock.sendMessage(message.key.remoteJid, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Ingresa un número válido de días. Ejemplo: !clearlogs 10*'
    }, { quoted: message });
    return;
  }

  try {
    if (!fs.existsSync(deletedLinksPath)) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ✅ No hay registros para limpiar.*'
      }, { quoted: message });
      return;
    }

    const currentLogs = JSON.parse(fs.readFileSync(deletedLinksPath, 'utf8'));
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const filteredLogs = currentLogs.filter(log => new Date(log.fecha) >= cutoffDate);

    fs.writeFileSync(deletedLinksPath, JSON.stringify(filteredLogs, null, 2));

    await sock.sendMessage(message.key.remoteJid, {
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ✅ Se eliminaron los registros anteriores a ${days} días.*`
    }, { quoted: message });
  } catch (error) {
    console.error('Error al limpiar registros:', error);
    await sock.sendMessage(message.key.remoteJid, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Ocurrió un error al limpiar los registros.*'
    }, { quoted: message });
  }
}

export { clearOldLinkLogs };
