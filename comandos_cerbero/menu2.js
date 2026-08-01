import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, '..', 'comandos_cerbero', 'imagenes');
const antilinkConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'antilink_config.json');
const welcomeConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'grupo_ajustado.json');
const monitorConfigPath = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'monitor_admin_config.json');

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
    vigilar: '🔴 Desactivado',
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

    // Estado del monitor de admins
    const monitorConfig = JSON.parse(fs.readFileSync(monitorConfigPath, 'utf8'));
    estados.vigilar = monitorConfig.enabled_groups[chatId] ? '🟢 Activado' : '🔴 Desactivado';

  } catch (error) {
    console.error('Error leyendo configuraciones:', error);
  }

  const menuText = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  ⛧ 𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 ⛧      ▓
▓  _v4.6.0 · Build 123_   ▓
▓  _Coded by C3rb3rus-666_ ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

┏━━ ⚙️ *SISTEMA* ━━━━━━━━━━┓
  ▪ Antilink — ${estados.antilink}
  ▪ Bienvenida — ${estados.bienvenida}
  ▪ Vigilar — ${estados.vigilar}
  ▪ QR-KILL — ${estados.qrKill}
  ▪ Anti-TRABA — ${estados.antiTraba}
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

⛧ !programador — Info Owner
⛧ !bateria all — Batería seguridad (Owner)
⛧ !help — Guía rápida

┏━━ 💀 *COMANDOS* ━━━━━━━━┓

⚔️ *IA & BÚSQUEDA*
  ▸ !cerbero <texto>
  ▸ !cerbero aprende: P | R
  ▸ !google · !pin · !cplay
  ▸ !sticker · !extractor

💔 *SOCIAL*
  ▸ !parejas · !casarme @user
  ▸ !cachudos · !infieles
  ▸ !maricones · !pajeros

🎮 *JUEGOS*
  ▸ !impostor · !adivinapalabra
  ▸ !ahorcado · !minas nuevo

┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━ 💰 *ECONOMÍA* ━━━━━━━━┓
  ▸ !work · !daily · !banco
  ▸ !top · !drogas · !robar
  ▸ !ruleta · !blackjack
  ▸ !hunt · !fish
  ▸ !putas · !lujuria 🔞
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

┏━━ 🛡️ *ADMIN* ━━━━━━━━━━━┓
  ⚡ !ban · !kick · !promote
  ⚡ !antilink · !bienvenida
  ⚡ !vigilar · !todos · !admins
  ⚡ !grupo · !clear_log
  ⚡ !antistatustag on/off
  ⚡ !status_cerbero
┗━━━━━━━━━━━━━━━━━━━━━━━━━┛

▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
     ⛧ C3rb3rus-666 ⛧
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
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
