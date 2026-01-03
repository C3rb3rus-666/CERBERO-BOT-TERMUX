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
            𝘾𝙀𝙍𝘽𝙀𝙍𝙊-𝘽𝙊𝙏 
🤖 𝗖𝗼𝗱𝗲𝗱 𝗯𝘆 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 (𝙘𝙖𝙧𝙡𝙤𝙨 𝙨𝙖𝙣𝙘𝙝𝙚𝙯) #𝙐𝙣𝙠𝙣𝙤𝙬𝙣𝙨  

─────────────────────────────────────────── 

 🤖  [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] v4.1.1 Build 50
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

*✨ 𝗜𝗡𝗙𝗢 𝗥Á𝗣𝗜𝗗𝗔*
• !help — 🆘 Guía rápida
• !programador — 👨‍💻 Info del creador

*🙋‍♂️ 𝗖𝗢𝗠𝗔𝗡𝗗𝗢𝗦 𝗣𝗔𝗥𝗔 𝗠𝗜𝗘𝗠𝗕𝗥𝗢𝗦*
────────────────────────────
*💬 Chat & Utilidades*
• !cerbero <texto> — 🤖 Habla con Cerbero-Simi (alias: !bot, copia de SimiSimi)
• !cerbero aprende: pregunta | respuesta — 🧠 Enseña a la IA local
• !google <consulta> — 🔎 Buscar en Google
• !cplay <busqueda> — 🎶 Reproducir/descargar música

*❤️ Social*
• !parejas — 👩‍❤️‍👨 TOP parejas
• !casarme @usuario — 💍 Proponer matrimonio
• !aceptar / !rechazar — ✅ / ❌ Responder propuesta
• !mipareja — 💌 Ver tu pareja

*🎯 Juegos Rápidos*
• !impostor iniciar [palabra] — 🕵️ Inicia Impostor (alias: start)
  Ej: '!impostor iniciar pizza'
• !impostor pista <texto> — ✍️ Enviar tu pista (alias: clue)
• !impostor acusar @user — 🧾 Acusar a alguien (alias: accuse)
• !impostor adivinar <palabra> — 🎯 Solo impostor (alias: guess)
• !impostor terminar — 🔚 Finalizar partida (alias: end)
• !impostor estado — 📊 Ver estado actual

*📚 Juegos de Palabras & Minijuegos*
• !adivinapalabra — 🧠 Adivina la palabra desordenada
• !ahorcado start — 🎮 Inicia Ahorcado
• !ahorcado <letra> — 🔤 Adivina una letra
• !impostor ayuda — ❓ Muestra ayuda del juego

*🎲 𝗝𝗨𝗘𝗚𝗢𝗦 𝗥𝗣𝗚 𝗬 𝗘𝗖𝗢𝗡𝗢𝗠𝗜𝗔*
────────────────────────────
• !work / !daily — 💼 Ganancias diarias y tareas
• !banco / !depositar / !retirar — 💳 Gestión de dinero
• !donar @usuario <cantidad> — 💸 Transferir

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
• !killgroup — 💣 Elimina el grupo (uso responsable)
• !clear_log — 🧹 Limpiar registros

*📌 𝗖𝗢𝗡𝗦𝗘𝗝𝗢 𝗖𝗘𝗥𝗕𝗘𝗥𝗢*
• Usa '!cerbero <texto>' para hablar con la IA local (copia de SimiSimi).
• Puedes enseñarle usando: !cerbero aprende: pregunta | respuesta
• Para pruebas, '!impostor palabra' devuelve una palabra de ejemplo.

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