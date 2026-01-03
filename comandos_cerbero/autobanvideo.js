const userVideosMap = new Map();

export async function handler(sock, msg, groupMetadata) {
  try {
    const isGroup = msg.key.remoteJid.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;
    const groupId = msg.key.remoteJid;

    // Verificar si es un video (normal o como documento)
    const isVideo = 
      !!msg.message?.videoMessage ||
      (msg.message?.documentMessage && 
       msg.message.documentMessage.mimetype?.startsWith('video/'));

    if (!isGroup || !isVideo) return;

    const now = Date.now();

    // Inicializar registro para el usuario
    if (!userVideosMap.has(sender)) {
      userVideosMap.set(sender, []);
    }

    // Registrar video actual
    const videos = userVideosMap.get(sender);
    videos.push({ timestamp: now, key: msg.key });

    // Filtrar videos recientes (últimos 60 segundos)
    const recentVideos = videos.filter(v => now - v.timestamp <= 60000);
    userVideosMap.set(sender, recentVideos);

    // Actuar si supera 2 videos
    if (recentVideos.length > 2) {
      // 1. Cerrar el grupo
      await sock.groupSettingUpdate(groupId, 'announcement');

      // 2. Eliminar videos
      for (const videoMsg of recentVideos) {
        try {
          await sock.sendMessage(groupId, { delete: videoMsg.key });
        } catch (error) {
          console.error('Error eliminando video:', error);
        }
      }

      // 3. Expulsar usuario
      await sock.groupParticipantsUpdate(groupId, [sender], 'remove');

      // 4. Notificación al grupo (sin mencionar el límite)
      const alertMessage = `╔═══════════════════════╗
║  ⚠️ *[ ALERTA DE SPAM ]* ⚠️  
╠═══════════════════════╣
║ 🚫 Spam de videos detectado
║ 👤 Usuario: @${sender.split('@')[0]}
║ 🔒 Acción: Expulsado + Contenido eliminado
╚═══════════════════════╝`;

      await sock.sendMessage(groupId, {
        text: alertMessage,
        mentions: [sender]
      });

      // 5. Limpiar registro
      userVideosMap.delete(sender);

      console.log(`🛡️ Anti-spam activado | Usuario: ${sender} | Videos: ${recentVideos.length}`);
    }
  } catch (error) {
    console.error('❌ Error en protección anti-spam:', error);
  }
}