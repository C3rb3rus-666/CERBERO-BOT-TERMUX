// Archivo: tag_admins.js
export async function tagAdmins(sock, message, isAdmin, args) {
    try {
      const chatId = message.key.remoteJid; // ID del grupo
  
      // Verificar si el usuario es administrador
      if (!isAdmin) {
        await sock.sendMessage(chatId, { 
          text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ❌ Solo los administradores pueden usar este comando.' 
        },
        { quoted: message });
        return;
      }
  
      // Obtener metadata del grupo
      const groupMetadata = await sock.groupMetadata(chatId);
  
      // Filtrar administradores
      const adminIds = groupMetadata.participants
        .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
        .map(admin => admin.id);
  
      if (adminIds.length === 0) {
        await sock.sendMessage(chatId, { text: '⚠️ No se encontraron administradores en este grupo.' },{ quoted: message });
        return;
      }
  
      // Construir el mensaje base
      const mensajeBase = args.length > 0 ? args.join(' ') : '🔔 Atención, administradores del grupo:';
      const mensajeFinal = `${mensajeBase}\n\n${adminIds.map(id => `@${id.split('@')[0]}`).join('\n')}`;
  
      // Enviar el mensaje con menciones dinámicas
      await sock.sendMessage(chatId, {
        text: mensajeFinal,
        mentions: adminIds, // Menciones automáticas
      },
      { quoted: message }
     );
  
      console.log('✅ Administradores etiquetados con éxito.');
    } catch (error) {
      console.error('❌ Error al etiquetar administradores:', error);
    }
  }
  