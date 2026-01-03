import pkg from '@whiskeysockets/baileys';
const { WAConnection } = pkg;
// joinGroup actualizado: soporta senderId en formato @lid y lo resuelve usando sock.onWhatsApp
export async function joinGroup(sock, message) {
  const senderIdRaw = message.key.participant || message.key.remoteJid;

  // Lista de JIDs permitidos (números reales @s.whatsapp.net)
  const allowedNumbers = new Set([
    '573233704652@s.whatsapp.net', // Creador original (número real)
    '50361779733@s.whatsapp.net',  // El Salvador
    '573180734103@s.whatsapp.net', // Colombia
    '51922472370@s.whatsapp.net'   // Perú
  ]);

  // Lista de LIDs permitidos (si quieres admitir LID directo)
  const allowedLids = new Set([
    '64279084535828@lid' // aquí pones el LID del creador que mencionaste
  ]);

  // Función auxiliar: intenta resolver un JID (puede ser @lid) a un JID normal usando onWhatsApp
  async function resolveJidIfPossible(sock, jid) {
    try {
      // Si ya es @s.whatsapp.net, devolvemos tal cual
      if (jid && jid.includes('@s.whatsapp.net')) return jid;

      // Si es @lid o cualquier otro formato, intentamos onWhatsApp
      const result = await sock.onWhatsApp(jid);
      if (result && result.length > 0 && result[0].jid) {
        return result[0].jid; // ej: "573233704652@s.whatsapp.net"
      }
    } catch (err) {
      console.error('⚠️ Error resolviendo JID con onWhatsApp:', err?.message || err);
    }
    // Si no pudo resolverse, devolver el jid original para que las comprobaciones puedan comparar LID
    return jid;
  }

  try {
    // Resolver JID (por ejemplo 64279...@lid -> 5732...@s.whatsapp.net)
    const resolvedSenderJid = await resolveJidIfPossible(sock, senderIdRaw);
    // Normalizar para comparar
    const resolvedSenderNormalized = String(resolvedSenderJid).toLowerCase();

    console.log('[joinGroup] sender raw:', senderIdRaw, '-> resolved:', resolvedSenderJid);

    // Permiso: true si coincide con allowedNumbers (JID resuelto) o con allowedLids (raw)
    const allowedByNumber = allowedNumbers.has(resolvedSenderNormalized);
    const allowedByLid = allowedLids.has(String(senderIdRaw).toLowerCase());

    if (!allowedByNumber && !allowedByLid) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** No tienes permiso para usar este comando. Solo usuarios autorizados pueden ejecutarlo.',
      }, { quoted: message });
      return;
    }

    // Obtener el texto del mensaje y extraer el enlace/código
    const text = message.message?.extendedTextMessage?.text || message.message?.conversation || '';
    const parts = text.trim().split(/\s+/);
    const possible = parts[1] || parts[0] || '';
    // extraer código del invite (acepta tanto enlace completo como solo el código)
    let inviteCode = null;
    if (!possible) {
      inviteCode = null;
    } else if (possible.includes('chat.whatsapp.com')) {
      inviteCode = possible.split('/').pop();
    } else {
      // si el usuario puso solo el código directamente (sin URL)
      inviteCode = possible;
    }

    if (!inviteCode) {
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** Por favor, proporciona un enlace o código de invitación válido.\nEjemplo: `!unirse https://chat.whatsapp.com/ABC123456789` o `!unirse ABC123456789`.',
      }, { quoted: message });
      return;
    }

    try {
      // Aceptar invitación (usa el método que tengas disponible en la versión de Baileys)
      // En versiones comunes: sock.groupAcceptInvite(inviteCode)
      const groupId = await sock.groupAcceptInvite(inviteCode);
      console.log('[joinGroup] unido al grupo:', groupId);

      await sock.sendMessage(message.key.remoteJid, {
        text: `✅ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** Me he unido al grupo correctamente: ${groupId}`,
      }, { quoted: message });
    } catch (errJoin) {
      console.error('❌ Error al unirse al grupo:', errJoin);
      await sock.sendMessage(message.key.remoteJid, {
        text: '❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** No pude unirme al grupo. Verifica que el enlace sea válido, que el código sea correcto y que el grupo acepte nuevos miembros.',
      }, { quoted: message });
    }
  } catch (err) {
    console.error('❌ joinGroup fallo inesperado:', err);
    await sock.sendMessage(message.key.remoteJid, {
      text: '❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** Ocurrió un error al procesar tu solicitud.',
    }, { quoted: message });
  }
}
