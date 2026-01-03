export async function listarPeruanos(sock, msg, groupMetadata) {
    try {
      const groupId = msg.key.remoteJid;
  
      // Verificar que es un grupo
      if (!groupId.endsWith('@g.us')) {
        await sock.sendMessage(groupId, { text: 'Este comando solo funciona en grupos.' });
        return;
      }
  
      // Filtrar participantes con números de Perú (+51)
      const peruanos = groupMetadata.participants.filter(participant =>
        participant.id.startsWith('51')
      );
  
      if (peruanos.length === 0) {
        await sock.sendMessage(groupId, { text: 'No se encontraron peruanos en este grupo.' });
        return;
      }
  
      // Seleccionar hasta 10 peruanos
      const topPeruanos = peruanos.slice(0, 10);
      const mentions = topPeruanos.map(p => p.id); // Obtener los JIDs de los seleccionados
  
      // Crear el mensaje
      const texto = `🦧 *Top 10 monos peruanos de Infinity* 🦧\n` +
                    `${mentions.map((jid, index) => `${index + 1}. @${jid.split('@')[0]}`).join('\n')}`;
  
      // Enviar el mensaje con menciones
      await sock.sendMessage(groupId, {
        text: texto,
        mentions: mentions, // Etiquetar solo al Top 10
      });
    } catch (error) {
      console.error('❌ [!] Error en el comando !peruanos:', error);
    }
  }
  