import chalk from 'chalk';

export async function toggleGroupPrivacy(sock, msg, isAdmin, groupMetadata) {
  try {
    if (!isAdmin) {
      console.log(chalk.red.bold('❌ El usuario no es administrador. Acción denegada.'));
      await sock.sendMessage(msg.key.remoteJid, {
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 🚫 𝐒𝐨𝐥𝐨 𝐥𝐨𝐬 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫𝐞𝐬 𝐩𝐮𝐞𝐝𝐞𝐧 𝐮𝐬𝐚𝐫 𝐞𝐬𝐭𝐞 𝐜𝐨𝐦𝐚𝐧𝐝𝐨.',
      },
      { quoted: msg });
      return;
    }

    const chatId = msg.key.remoteJid;
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const args = text.trim().split(/\s+/);
    const action = args[1]?.toLowerCase(); // El segundo argumento es el comando ("abrir" o "cerrar")

    if (!['abrir', 'cerrar'].includes(action)) {
      console.log(chalk.yellow.bold('⚠️ Comando inválido. Solo se permiten "abrir" o "cerrar".'));
      await sock.sendMessage(chatId, {
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 ⚠️ 𝐂𝐨𝐦𝐚𝐧𝐝𝐨 𝐢𝐧𝐯á𝐥𝐢𝐝𝐨. 𝐔𝐬𝐚 :\n- `!grupo abrir`: Permitir que todos envíen mensajes.\n- `!grupo cerrar`: Solo admins pueden enviar mensajes.',
      },
      { quoted: msg });
      return;
    }

    if (action === 'abrir') {
      // Permitir mensajes de todos
      await sock.groupSettingUpdate(chatId, 'not_announcement');
      console.log(chalk.green.bold(`✅ El grupo ${groupMetadata.subject} ahora está abierto.`));
      await sock.sendMessage(chatId, { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 ✅ 𝐄𝐥 𝐠𝐫𝐮𝐩𝐨 𝐞𝐬𝐭á 𝐚𝐛𝐢𝐞𝐫𝐭𝐨 𝐩𝐚𝐫𝐚 𝐭𝐨𝐝𝐨𝐬 𝐥𝐨𝐬 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐧𝐭𝐞𝐬.' },{ quoted: msg });
    } else if (action === 'cerrar') {
      // Solo admins pueden enviar mensajes
      await sock.groupSettingUpdate(chatId, 'announcement');
      console.log(chalk.green.bold(`✅ El grupo ${groupMetadata.subject} ahora está cerrado.`));
      await sock.sendMessage(chatId, { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 🔒✅ 𝐄𝐥 𝐠𝐫𝐮𝐩𝐨 𝐞𝐬𝐭á 𝐜𝐞𝐫𝐫𝐚𝐝𝐨. 𝐒𝐨𝐥𝐨 𝐥𝐨𝐬 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫𝐞𝐬 𝐩𝐮𝐞𝐝𝐞𝐧 𝐞𝐧𝐯𝐢𝐚𝐫 𝐦𝐞𝐧𝐬𝐚𝐣𝐞𝐬.' },{ quoted: msg });
    }
  } catch (error) {
    console.error(chalk.red.bold('❌ Error al cambiar la configuración del grupo:'), error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Ocurrió un error al intentar cambiar la configuración del grupo.',
    },
    { quoted: msg });
  }
}
