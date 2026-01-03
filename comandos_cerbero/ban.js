import pkg from '@whiskeysockets/baileys';
const { getGroupMetadata } = pkg;

/**
 * banUser - Expulsa a un usuario de un grupo.
 * Reglas:
 *  - Solo admins pueden usar el comando (se asume que isAdmin ya viene calculado).
 *  - Target por: reply > mención > número estricto en args[0] (solo dígitos con opcional +).
 *  - No expulsa al bot ni a administradores (admin o superadmin).
 *  - Registra auditoría en consola y avisa en el grupo.
 */
export async function banUser(sock, message, isAdmin, groupMetadata) {
  const groupId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid;

  // Requisito: solo admins pueden ejecutar
  if (!isAdmin) {
    await sock.sendMessage(groupId, {
      text: '[CERBERO-BOT] ⚠️ Sólo los administradores pueden usar este comando.'
    }, { quoted: message });
    return;
  }

  // Recuperar texto y args de forma segura
  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    message.message?.videoMessage?.caption ||
    '';

  if (!text.startsWith('!ban') && !text.startsWith('!kick')) return; // Acepta !ban o !kick

  const args = text.slice(text.indexOf(' ') + 1).trim().split(/\s+/).filter(Boolean);

  // 1) Prioridad RESPUESTA (reply)
  let targetJid = null;
  if (message.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    targetJid = message.message.extendedTextMessage.contextInfo.participant;
  }

  // 2) Si no hay reply, buscar mención (mentionedJid)
  if (!targetJid && message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
  }

  // 3) Si no hay reply ni mención, permitir número explícito en args[0]
  // Solo aceptar si args[0] existe y es exactamente un número con 7-15 dígitos, opcional +.
  if (!targetJid && args.length > 0) {
    const maybe = args[0].replace(/\s+/g, '');
    if (/^\+?\d{7,15}$/.test(maybe)) {
      // Normalizar: quitar + y añadir dominio
      const normalized = maybe.replace(/^\+/, '');
      targetJid = `${normalized}@s.whatsapp.net`;
    }
  }

  if (!targetJid) {
    await sock.sendMessage(groupId, {
      text: '[CERBERO-BOT] ❗ Indica el objetivo respondiendo al mensaje del infractor o mencionándolo. También podés usar: `!ban +573001234567`'
    }, { quoted: message });
    return;
  }

  // Evitar banear al propio bot
  const botJid = (sock.user && sock.user.id) ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
  if (targetJid === botJid) {
    await sock.sendMessage(groupId, { text: '[CERBERO-BOT] 🤖 No puedo banearme a mí mismo.' }, { quoted: message });
    return;
  }

  // Asegurarnos de tener metadata actualizada (si no se pasó, la pedimos)
  try {
    if (!groupMetadata || !groupMetadata.participants) {
      groupMetadata = await getGroupMetadata(groupId, sock);
    }
  } catch (err) {
    // Si falla obtener metadata, se continúa pero con advertencia
    console.warn('[CERBERO-BOT] ⚠️ Error al obtener metadata del grupo:', err);
  }

  // Validar que target exista en participants
  const targetParticipant = groupMetadata?.participants?.find(p => p.id === targetJid);

  if (!targetParticipant) {
    await sock.sendMessage(groupId, {
      text: `[CERBERO-BOT] ❌ No encontré al usuario ${targetJid.split('@')[0]} en este grupo.`
    }, { quoted: message });
    return;
  }

  // Detectar si el objetivo es admin (tolerante a distintos formatos)
  const adminValue = targetParticipant.admin;
  const isTargetAdmin = (
    adminValue === 'admin' ||
    adminValue === 'superadmin' ||
    adminValue === true ||
    adminValue === 'owner' // por si acaso en alguna variante
  );

  if (isTargetAdmin) {
    await sock.sendMessage(groupId, {
      text: '[CERBERO-BOT] ❌ No puedo banear a un administrador del grupo.'
    }, { quoted: message });
    return;
  }

  // Auditoría: log en consola y aviso en el grupo antes de actuar
  const whoRequested = senderId.split('@')[0];
  const whoTarget = targetJid.split('@')[0];
  console.log('================== CERBERO-AUDIT ==================');
  console.log('ACTION: banUser');
  console.log('GROUP:', groupId);
  console.log('REQUESTED_BY:', whoRequested);
  console.log('TARGET:', whoTarget);
  console.log('TIMESTAMP:', new Date().toISOString());
  console.log('=================================================');

  await sock.sendMessage(groupId, {
    text: `[CERBERO-BOT] ⚠️ El administrador @${whoRequested} ha solicitado banear a @${whoTarget}. Procediendo a expulsión...`,
    mentions: [senderId, targetJid]
  }, { quoted: message });

  // Ejecutar la expulsión
  try {
    await sock.groupParticipantsUpdate(groupId, [targetJid], 'remove');

    await sock.sendMessage(groupId, {
      text: `[CERBERO-BOT] ✅ Usuario @${whoTarget} ha sido expulsado del grupo.`,
      mentions: [targetJid]
    });
    console.log(`[CERBERO-BOT] ✅ Expulsado ${whoTarget} (solicitado por ${whoRequested})`);
  } catch (error) {
    console.error('[CERBERO-BOT] Error al expulsar:', error);
    await sock.sendMessage(groupId, {
      text: '[CERBERO-BOT] ⚠️ Ocurrió un error al intentar expulsar al usuario. Revisa los logs.'
    }, { quoted: message });
  }
}
