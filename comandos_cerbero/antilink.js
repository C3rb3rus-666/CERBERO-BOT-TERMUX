import fs from 'fs/promises';
import fsSync from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '../comandos_cerbero/configuraciones/antilink_config.json');
const allowedLinksPath = join(__dirname, '../comandos_cerbero/configuraciones/allowed_links.json');
const deletedLinksPath = join(__dirname, '../comandos_cerbero/configuraciones/deleted_links.json');

let config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const allowedLinks = JSON.parse(await fs.readFile(allowedLinksPath, 'utf8')).links_permitidos || [];

async function readDeletedLinks() {
  try {
    if (!fsSync.existsSync(deletedLinksPath)) return [];
    const data = await fs.readFile(deletedLinksPath, 'utf-8');
    const json = JSON.parse(data);
    return Array.isArray(json) ? json : [];
  } catch (e) {
    console.error('Error leyendo deleted_links.json:', e);
    return [];
  }
}

async function writeDeletedLinks(deletedLinks) {
  try {
    await fs.writeFile(deletedLinksPath, JSON.stringify(deletedLinks, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error guardando deleted_links.json:', e);
  }
}

function isWhatsAppLink(link) {
  return link.includes('chat.whatsapp.com');
}

async function antilink(sock, message, groupMetadata, isAdmin) {
  const chatId = message.key.remoteJid;
  if (!chatId.endsWith('@g.us')) return;
  if (!config.enabled_groups[chatId]) return;

  const messageContent =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    '';

  const linkRegex = /(?:https?:\/\/|www\.|chat\.whatsapp\.com\/|bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|adf\.ly|shorte\.st|bc\.vc|tr\.im|v\.gd|qr\.ae|click\.ru|clck\.ru|u\.to|j\.mp|soo\.gd|s2r\.co|viralurl\.com|vur\.me|short\.to|ity\.im|q\.gs|vzturl\.com|lem\.de|flic\.kr|picz\.us|g\.co|url\.ie|rb\.gy)[^\s]+/gi;

  const foundLinks = [...new Set(messageContent.match(linkRegex) || [])];

  if (foundLinks.length === 0) return;

  const isAllowed = foundLinks.some(link =>
    allowedLinks.some(allowed => link.includes(allowed))
  );
  if (isAllowed) return;

  const participant = message.key.participant;
  if (!participant) return;

  // Acciones contra el enlace
  await sock.groupSettingUpdate(chatId, 'announcement');
  await sock.sendMessage(chatId, { delete: message.key });

  if (!isAdmin) {
    await sock.groupParticipantsUpdate(chatId, [participant], 'remove');
  }

  // Registrar en logs
  const deletedLogs = await readDeletedLinks();
  const now = new Date().toISOString();

  deletedLogs.push({
    fecha: now,
    remitente: participant,
    links: foundLinks,
    grupo: {
      id: chatId,
      nombre: groupMetadata?.subject || 'Grupo desconocido',
    },
  });

  await writeDeletedLinks(deletedLogs);

  // Mensaje de alerta
  const whatsappLinkDetected = foundLinks.some(isWhatsAppLink);
  const tex = whatsappLinkDetected
    ? `╔═══════════════════════╗
║  🚨 *[ 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 ]* 🚨
╠═══════════════════════╣
║ ⛔ *ENLACE DE GRUPO WHATSAPP*  
║    de @${participant.split('@')[0]}  
║
║ 🔒 *Grupo cerrado* por seguridad  
║ 🗑️ *Mensaje eliminado* automáticamente  
║ 📝 *Registro guardado en logs del bot*  
╠═══════════════════════╣
║    *Coded by c3rb3rus-666*  
╚═══════════════════════╝`
    : `╔═══════════════════════╗
║  🚨 *[ 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 ]* 🚨
╠═══════════════════════╣
║ ⛔ *Enlace NO permitido* detectado  
║    de @${participant.split('@')[0]}  
║
║ 🔒 *Grupo cerrado* por seguridad  
║ 🗑️ *Mensaje eliminado* automáticamente  
║ 📝 *Registro guardado en logs del bot*  
╠═══════════════════════╣
║    *Coded by c3rb3rus-666*  
╚═══════════════════════╝`;

  // Seleccionar imagen aleatoria
  const imagesDir = join(__dirname, 'imagenes');
  let imagePath = null;
  try {
    const files = await fs.readdir(imagesDir);
    const images = files.filter(file => file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg'));
    if (images.length > 0) {
      const randomImage = images[Math.floor(Math.random() * images.length)];
      imagePath = join(imagesDir, randomImage);
    }
  } catch (e) {
    console.error('Error leyendo imágenes:', e);
  }

  await sock.sendPresenceUpdate('composing', chatId);
  if (imagePath) {
    await sock.sendMessage(chatId, {
      image: { url: imagePath },
      caption: tex,
      mentions: [participant],
    });
  } else {
    await sock.sendMessage(chatId, {
      text: tex,
      mentions: [participant],
    });
  }
}

async function toggleAntilink(sock, message, isAdmin, args) {
  const chatId = message.key.remoteJid;

  if (!isAdmin) {
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      text: '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]* ❌ *Solo administradores pueden modificar el antilink.*',
    }, { quoted: message });
    return;
  }

  const action = args[0]?.toLowerCase();
  const currentStatus = config.enabled_groups[chatId] || false;

  if (!action || !['activar', 'desactivar'].includes(action)) {
    const statusText = currentStatus ? 'ACTIVADO' : 'DESACTIVADO';
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]* ⚠️ *Estado actual del antilink:* ${statusText}\n\n` +
            '*Uso correcto:*\n' +
            '• `!antilink activar` - Activa protección\n' +
            '• `!antilink desactivar` - Desactiva protección',
    }, { quoted: message });
    return;
  }

  // Verificar si ya está en el estado solicitado
  if ((action === 'activar' && currentStatus) || (action === 'desactivar' && !currentStatus)) {
    const statusText = currentStatus ? 'ya estaba ACTIVADO' : 'ya estaba DESACTIVADO';
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]* ℹ️ El sistema antilink ${statusText} en este grupo.`,
    }, { quoted: message });
    return;
  }

  // Cambiar estado
  config.enabled_groups[chatId] = action === 'activar';
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));

  const newStatus = config.enabled_groups[chatId] ? 'ACTIVADO' : 'DESACTIVADO';
  await sock.sendPresenceUpdate('composing', chatId);
  await sock.sendMessage(chatId, {
    text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]* ✅ *Antilink ${newStatus} correctamente* en este grupo.`,
  }, { quoted: message });
}

export { antilink, toggleAntilink };
