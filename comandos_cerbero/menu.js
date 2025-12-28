import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const menuImagePath = path.join(__dirname, '..', 'comandos_cerbero', 'imagenes', 'bot.jpg');
const antilinkConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'antilink_config.json');
const welcomeConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'grupo_ajustado.json');

export async function menuCommand(sock, msg) {
  const chatId = msg.key.remoteJid;

  // Leer estados de los módulos
  let estados = {
    antilink: '🔴 Desconocido',
    bienvenida: '🔴 Desconocido',
    qrKill: '🟢 Activado (Global)',
    antiTraba: '🟢 Activado (Global)',
    antiSticker: '🟢 Activado (Global)',
    antiGore: '🟢 Activado (Global)'
  };

  try {
    // Estado del antilink
    const antilinkConfig = JSON.parse(fs.readFileSync(antilinkConfigPath, 'utf8'));
    estados.antilink = antilinkConfig.enabled_groups[chatId] ? '🟢 Activado' : '🔴 Desactivado';

    // Estado de la bienvenida
    const welcomeConfig = JSON.parse(fs.readFileSync(welcomeConfigPath, 'utf8'));
    estados.bienvenida = welcomeConfig[chatId]?.welcome ? '🟢 Activado' : '🔴 Desactivado';

  } catch (error) {
    console.error('Error leyendo configuraciones:', error);
  }

  const menuText = `
            𝘾𝙀𝙍𝘽𝙀𝙍𝙊-𝘽𝙊𝙏 
🤖 𝗖𝗼𝗱𝗲𝗱 𝗯𝘆 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 (𝙘𝙖𝙧𝙡𝙤𝙨 𝙨𝙖𝙣𝙘𝙝𝙚𝙯) #𝙐𝙣𝙠𝙣𝙤𝙬𝙣𝙨  

─────────────────────────────────────────── 

 🤖  [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] v4.2.3 Build 65
 👨‍💻  Coded by: 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 
 🔗  github.com/C3rb3rus-666   
 📱  WhatsApp: +573233704652   
 📷  Instagram: c3rb3rus_666   

═══════════════════════════════════════════

*📊 𝗘𝗦𝗧𝗔𝗗𝗢𝗦 𝗔𝗖𝗧𝗨𝗔𝗟𝗘𝗦*
• Antilink: ${estados.antilink} (!antilink)
• Bienvenida: ${estados.bienvenida} (!bienvenida)
• QR-KILL: ${estados.qrKill}
• Anti-TRABA: ${estados.antiTraba}
• Anti-Sticker: ${estados.antiSticker}
• Anti-Gore: ${estados.antiGore}
───────────────────────────────────────────

*✨ RESUMEN RÁPIDO (DESTACADOS)*
• Versión: **v4.2.3 (Build 65)** — ¡misiones, contador persistente y mejoras!
• \`safeSendMessage\` — protección contra DMs y envíos masivos (wrapper en \`index.js\`)
• Scheduler mensual: backups y reseteo de contadores (día 30)
• Añadido \`config/always_tag.json\` para usuarios que siempre se mencionan

---

*🔧 UTILIDADES* (básicas / ayuda)
• \`!ping\` — ✅ Latencia / salud del bot
• \`!help\` — 🆘 Guía rápida
• \`!menu\` — 📋 Muestra este menú
• \`!google <consulta>\` — 🔎 Buscar en Google
• \`!cerbero <texto>\` — 🤖 Chat con IA local (alias: \`!bot\`)

---

*🎵 MULTIMEDIA & REPRODUCCIÓN*
• \`!cplay <busqueda>\` — 🎶 Reproducir/descargar música
• \`!cplay2 <busqueda>\` — 🎬 Búsqueda YouTube con preview y selección de descarga
• \`!youtube / !yt_search\` — 🔍 Búsqueda y enlaces

---

*📊 ESTADÍSTICAS & CONTADORES*
• \`!actividad\` — 📈 Lista de usuarios activos/inactivos (menciones correctas)
• Contadores persistentes: \`utils/messageCounter.js\` (flush periódico y backups)

---

*❤️ SOCIAL* (parejas, roles)
• \`!parejas\` — 👩‍❤️‍👨 TOP parejas
• \`!casarme @usuario\` — 💍 Proponer matrimonio
• \`!aceptar\` / \`!rechazar\` — ✅ Responder propuesta
• \`!mipareja\` — 💌 Ver tu pareja

---

*🎮 JUEGOS & MISIONES*
• Misiones diarias: objetivos, notificaciones, recompensas (XP / dinero)
• Comandos de minijuegos: \`!adivinapalabra\`, \`!ahorcado\`
• \`!impostor\` eliminado por seguridad

---

*🏦 ECONOMÍA (RPG)*
• \`!work\` / \`!daily\` — 💼 Ganancias / tareas
• \`!banco\` / \`!depositar\` / \`!retirar\` — 💳 Gestión de fondos
• \`!donar @usuario <cantidad>\` — 💸 Transferir dinero a otros

---

*🛡️ ADMIN (privado / críticos)*
• \`!ban\` / \`!kick\` — ❌ Expulsar usuarios
• \`!promote\` / \`!demote\` — 🔼/🔽 Cambiar roles
• \`!antilink [activar|desactivar]\` — 🚫 Protección de enlaces
• \`!bienvenida [activar|desactivar]\` — 🙌 Mensajes de bienvenida
• \`!todos\` / \`!tag_group\` — 🔔 Etiquetar a todos (respeta \`config/always_tag.json\`)
• \`!clear_log\` — 🧹 Limpiar registros

---


`.trim();

  try {
    if (!fs.existsSync(menuImagePath)) {
      throw new Error('❌ No se encontró la imagen del menú (bot.jpg)');
    }

    const imageBuffer = fs.readFileSync(menuImagePath);
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, {
      image: imageBuffer,
      caption: menuText,
      detectLinks: true,
      contextInfo: {
        mentionedJid: [msg.key.participant || chatId],
        forwardingScore: 999,
        isForwarded: true
      }
    }, { quoted: msg });

  } catch (error) {
    console.error('Error en !menu:', error);
    await sock.sendMessage(chatId, {
      text: `❌ Error al mostrar el menú: ${error.message}`,
      mentions: [msg.key.participant || chatId]
    }, { quoted: msg });
  }
}