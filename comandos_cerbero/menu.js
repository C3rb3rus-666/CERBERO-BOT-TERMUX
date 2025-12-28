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

*🔧 GENERAL / UTILIDADES*
• \`!ping\` — ✅ Latencia / salud del bot
• \`!help\` / \`!ayuda\` / \`!guia\` — 🆘 Guía rápida
• \`!menu\` — 📋 Muestra este menú
• \`!google <consulta>\` — 🔎 Buscar en Google
• \`!buscar <texto>\` — 🔎 Buscar interno (alias de buscador)
• \`!$\` — 💰 Mostrar saldo rápido (alias: \`!\$\`)

---

*🤖 IA & BÚSQUEDAS*
• \`!cerbero <texto>\` — 🤖 Chat con IA local (alias: \`!bot\`)
• \`!simi <texto>\` — 🤖 Chat Simi
• \`!cerbero_search <consulta>\` — 🔎 Búsqueda avanzada (cerbero search)
• \`!cerbero_yt <url|consulta>\` — 📺 Buscar/extraer YouTube

---

*🎵 MULTIMEDIA & REPRODUCCIÓN*
• \`!cplay <busqueda>\` — 🎶 Reproducir/descargar música
• \`!cplay2 <busqueda>\` — 🎬 Búsqueda YouTube con preview y selección de descarga
• \`!cplayd <id>\` — 📥 Descargar desde preview (cplayd)
• \`!cprueba\` — 🧪 Pruebas de cplay
• \`!youtube / !yt_search\` — 🔍 Búsqueda y enlaces
• \`!extractor <media>\` — 🛠️ Extraer contenido (extractor)
• \`!sticker\` — 🏷️ Crear sticker desde imagen/video

---

*📊 ESTADÍSTICAS, RANKS & CONTADORES*
• \`!actividad\` — 📈 Lista de usuarios activos/inactivos (menciones correctas)
• \`!activos\` — 👥 Mostrar usuarios activos
• \`!level\` — 📚 Nivel / experiencia
• \`!top\` / \`!top5\` / \`!topricos\` — 🏆 Rankings
• Contadores persistentes: \`utils/messageCounter.js\` (flush periódico y backups)

---

*❤️ SOCIAL & PAREJAS*
• \`!parejas\` — 👩‍❤️‍👨 TOP parejas
• \`!pareja @usuario\` — 💞 Ver/gestionar pareja individual
• \`!casarme @usuario\` — 💍 Proponer matrimonio
• \`!casemonos\` — 💒 Confirmar matrimonio (alias)
• \`!aceptar\` / \`!rechazar\` — ✅ Responder propuesta
• \`!mipareja\` — 💌 Ver tu pareja
• \`!divorcio\` / \`!divorciarse\` — 💔 Romper matrimonio
• \`!estadoamor\` — ❤️ Estado de pareja

---

*🎮 JUEGOS, MINIJUEGOS & MISIONES*
• Misiones diarias: objetivos, notificaciones, recompensas (XP / dinero)
• Comandos de minijuegos: \`!adivinapalabra\`, \`!ahorcado\`
• \`!impostor\` — (eliminado por seguridad en algunos grupos)
• \`!nuevos\` — 👀 Mostrar usuarios recientes

---

*🏦 ECONOMÍA (RPG) & FINANZAS*
• \`!work\` / \`!daily\` — 💼 Ganancias / tareas
• \`!rob\` — 💣 Robar a otros (riesgo)
• \`!hunt\` / \`!fish\` (\`!pescar\`) — 🦌/🐟 Actividades con recompensas
• \`!buy\` / \`!sell\` / \`!inventory\` / \`!profile\` — Comercio y perfil
• \`!banco\` / \`!depositar\` / \`!retirar\` / \`!invertir\` — Gestión bancaria/inversiones
• \`!guardar\` / \`!sacar\` — 💾 Guardar / retirar recursos (caja/almacen)
• \`!donar @usuario <cantidad>\`, \`!robbanco\`, \`!caja\` / \`!cajafuerte\` — Transferencias y acciones avanzadas

---

*🎰 CASINO & COMPETICIONES*
• \`!ruleta\` / \`!blackjack\` / \`!pedir\` / \`!plantar\` — Juegos de azar
• \`!casinostats\` — 📈 Estadísticas del casino
• \`!logros\` — 🎖️ Mostrar logros

---

*🧩 ROLEPLAY, HUMOR & TOPICOS*
• \`!cachudos\` / \`!pajeros\` / \`!maricones\` — 😂 Comandos de humor/social
• \`!infieles\` — 🕵️‍♂️ Búsqueda de infidelidades (juego)
• Temas de rol: \`!drogas\` / \`!narco\` / \`!trafico\` — contenido simulado

---

*🛡️ ADMIN (privado / críticos)*
• \`!admins\` — 🧑‍💼 Lista de administradores del bot
• \`!ban\` / \`!kick\` — ❌ Expulsar usuarios
• \`!promote\` / \`!demote\` — 🔼/🔽 Cambiar roles
• \`!antilink [activar|desactivar]\` — 🚫 Protección de enlaces
• \`!bienvenida [activar|desactivar]\` — 🙌 Mensajes de bienvenida
• \`!todos\` / \`!tag_group\` — 🔔 Etiquetar a todos (respeta \`config/always_tag.json\`)
• \`!bot_join\` — ➕ Forzar que el bot se una a un grupo (Owner)
• \`!grupo\` — ⚙️ Configuración de grupo / info
• \`!leerlog\` — 📑 Leer registros
• \`!guardar\` / \`!sacar\` — 💾 Guardar/recuperar backups locales
• \`!killgroup\` — 💣 Eliminar grupo (uso responsable)
• \`!clear_log\` — 🧹 Limpiar registros
• \`!purga\` / \`!purgarsistema\` / \`!saquear\` — ⚠️ Comandos críticos (Owner only)

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