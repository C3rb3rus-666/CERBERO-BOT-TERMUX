import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, '..', 'comandos_cerbero', 'imagenes');
const antilinkConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'antilink_config.json');
const welcomeConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'grupo_ajustado.json');

// Función para seleccionar una imagen aleatoria
function getRandomImage(imagesDir) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
}

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

╔══════════════════════════════════════════╗
║       🤖 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 𝐯𝟒.𝟐.�     ║
║     Build 73 - Sistema Online           ║
║  👨‍💻 Coded by: C3rb3rus-666             ║
║  🔗 github.com/C3rb3rus-666             ║
║  📱 WhatsApp: +573233704652             ║
║  📷 Instagram: c3rb3rus_666             ║
╚══════════════════════════════════════════╝

═══════════════════════════════════════════

*📊 𝗘𝗦𝗧𝗔𝗗𝗢𝗦 𝗔𝗖𝗧𝗨𝗔𝗟𝗘𝗦*
• Antilink: ${estados.antilink} (!antilink)
• Bienvenida: ${estados.bienvenida} (!bienvenida)
• QR-KILL: ${estados.qrKill}
• Anti-TRABA: ${estados.antiTraba}
• Anti-Sticker: ${estados.antiSticker}
• Anti-Gore: ${estados.antiGore}
─────────────────────────

𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎𝐍 𝐃𝐄𝐋 𝐂𝐑𝐄𝐀𝐃𝐎𝐑 

────────────────────────────
• !programador - !creador 👨‍💻 Info del creador

𝐂𝐎𝐌𝐀𝐍𝐃𝐎𝐒 𝐃𝐄𝐋 𝐂𝐑𝐄𝐀𝐃𝐎𝐑

────────────────────────────
• !saquear — 🧨 Saquear (Solo C3rb3rus-666- ECONOMY JUEGO)
• !killgroup — 💣 Elimina el grupo (solo C3rb3rus-666)
• !$ Interprete de ordenes del bot 



*🙋‍♂️ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 𝗣𝗔𝗥𝗔 𝗠𝗜𝗘𝗠𝗕𝗥𝗢𝗦*
────────────────────────────
*💬 Chat & Utilidades*

• !cerbero <texto> — 🤖 Habla con Cerbero-Simi (alias: !bot, copia de SimiSimi)
• !cerbero aprende: pregunta | respuesta — 🧠 Enseña a la IA local
• !google <consulta> — 🔎 Buscar en Google
• !cplay <busqueda> — 🎶 Reproducir/descargar música
• !ayuda - !help — 🆘 Guía rápida
• !cerbero_yt <link> — ▶️ Descarga videos youtube
• !ping — 📶 Latencia/estado del bot
• !cplay2 <busqueda>- descarga de musica con vista previa resultados 
  • !cplayd <seleccion> descarga de resultados  de cplay2
• !simi <texto> — 🤖 Habla con SimiSimi (IA en línea)
• !sticker- crea stickers desde imágenes 

𝐒𝐨𝐜𝐢𝐚𝐥 ❤️
────────────────────────────
• !parejas — 👩‍❤️‍👨 TOP parejas
• !casarme @usuario — 💍 Proponer matrimonio
• !aceptar / !rechazar — ✅ / ❌ Responder propuesta
• !mipareja — 💌 Ver tu pareja
• !cachudos — 🔥 TOP venados del grupo
• !divorciarse / !divorcio — 💔 Romper matrimonio de !casarme
• !mipareja — 💌 Ver tu pareja  de !casarme
• !extractor - responde a un sticker para extraer la imagen 
• !infieles - 👀 TOP infieles del grupo

*📚 Juegos de Palabras & Minijuegos*
────────────────────────────
• !adivinapalabra — 🧠 Adivina la palabra desordenada
• !ahorcado start — 🎮 Inicia Ahorcado
• !ahorcado <letra> — 🔤 Adivina una letra


*🎲 𝗝𝗨𝗘𝗚𝗢𝗦 𝗥𝗣𝗚 𝗬 𝗘𝗖𝗢𝗡𝗢𝗠𝗜𝗔* (RPG)
────────────────────────────
• !profile — 👤 Ver tu perfil (dinero, nivel, inventario)
• !work / !daily — 💼 Ganancias diarias y tareas
• !banco — 🏦 Banco del juego (almacena dinero)
  • !depositar <cantidad> — 💳 Depositar en banco
  • !retirar <cantidad> — 💸 Retirar del banco
• !guardar <item|cantidad> — 💾 Guardar recursos en caja/almacén
• !sacar <item|cantidad> — 🔓 Sacar recursos de la caja/almacén
• !pescar / !fish — 🎣 Pescar (gana dinero/items)
• !rob @usuario <cantidad> — 🗡️ Robar a otro jugador (riesgo, cooldown)
• !robbanco — 🏛️ Intentar robar el banco (alto riesgo, requisitos)
• !saquear — 🧨 Saquear (Solo C3rb3rus-666)
• !purgarsistema — ⚠️ Acción crítica relacionada con economía (Owner only / uso responsable)
• !buy / !sell / !inventory — 🛒 Compra/venta e inventario
• !donar @usuario <cantidad> — 💸 Transferir dinero a otro
• !top / !topricos — 🏆 Top jugadores
• !drogas <cantidad> — 💊 Simula un mercado (riesgos)
  • !narco - alternativa al comando !drogas
• !purga — 🔒 Comando crítico (solo owner)
• !caja - 📦 Abrir caja fuerte del juego
• !invertir <negocio> — 📈 Invertir en bolsa (riesgo)
• !logros — 🏅 Ver logros desbloqueados
• !maricones — 🌈 TOP maricones del grupo
• !pajeros — 🍆 TOP pajeros del grupo

  *🎰 𝗖𝗔𝗦𝗜𝗡𝗢 & 𝗟𝗢𝗚𝗥𝗢𝗦*
────────────────────────────
• !ruleta <cantidad> — 🎰 Juega a la ruleta
• !blackjack <apuesta> — 🃏 Blackjack
• !pedir / !plantar — 🀄️ Acciones del casino
• !casinostats — 📈 Estadísticas

*🔫 𝗖𝗔𝗭𝗔 𝗬 𝗣𝗘𝗦𝗖𝗔*
────────────────────────────
• !hunt — 🦌 Cazar (gana XP / items)
• !fish — 🐟 Pescar (requiere caña)

*🔥 𝗣𝗹𝗮𝗰𝗲𝗿 𝗣𝗿𝗼𝗯𝗶𝗯𝗶𝗱𝗼*
────────────────────────────
• !putas / !stalin / !lujuria — 🔞 Premium (gasta dinero)

*🛡️ 𝗔𝗗𝗠𝗜𝗡𝗦 𝗘𝗫𝗖𝗟𝗨𝗦𝗜𝗩𝗢𝗦*
────────────────────────────
• !ban / !kick — ❌ Expulsar usuarios
• !promote / !demote — 🔼/🔽 Cambiar roles
• !antilink [activar|desactivar] — 🚫 Enlaces
• !bienvenida [activar|desactivar] — 🙌 Mensajes de bienvenida
• !todos / !tag_group — 🔔 Etiquetar a todos
• !clear_log — 🧹 Limpiar registros
• !bot_join <link> — 🔗 Invitar bot al grup
• !leerlog   visualizar links bloqueados
• !actividad — ver los fantasmas y los mas activos del grupo
• !admins - llamar a los administradores del grupo
• !grupo <abrir / cerrar> — 🌐 Cambiar configuración de grupo
• !nuevos - etiqueta los nuevos miembros del grupo con un mensaje personalizado

*📌 𝗖𝗢𝗡𝗦𝗘𝗝𝗢 𝗖𝗘𝗥𝗕𝗘𝗥𝗢*
• Usa '!cerbero <texto>' para hablar con la IA local (copia de SimiSimi).
• Puedes enseñarle usando: !cerbero aprende: pregunta | respuesta

*🔧 𝗠Á𝗦 𝗢𝗣𝗖𝗜𝗢𝗡𝗘𝗦*
• !top / !topricos — 🏆 Top jugadores
• !drogas <cantidad> — 💊 Simula un mercado (riesgos)
• !purga — 🔒 Comando crítico (solo owner)



`.trim();

  try {
    const randomImagePath = getRandomImage(imagesDir);
    if (!randomImagePath) {
      throw new Error('❌ No se encontraron imágenes en la carpeta');
    }

    const imageBuffer = fs.readFileSync(randomImagePath);
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