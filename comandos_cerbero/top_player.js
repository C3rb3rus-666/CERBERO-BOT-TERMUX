import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, 'imagenes');

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

export async function commandTopPlayers(sock, msg) {
  if (!fs.existsSync(DB_PATH)) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ No se encontró la base de datos del juego.'
    }, { quoted: msg });
  }

  const gameData = JSON.parse(fs.readFileSync(DB_PATH));

  // Calcular total de cada jugador
  const players = Object.entries(gameData).map(([jid, data]) => {
    const efectivo = parseInt(data.money) || 0;
    const banco = parseInt(data.bank) || 0;
    const caja = parseInt(data.safe) || 0;

    return {
      jid,
      total: efectivo + banco + caja,
      efectivo,
      banco,
      caja,
      xp: data.xp || 0,
      nivel: data.level || 1
    };
  });

  // Ordenar por total (descendente)
  const top = players.sort((a, b) => b.total - a.total).slice(0, 5);

  if (top.length === 0) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: '⚠️ No hay jugadores registrados aún.'
    }, { quoted: msg });
  }

  // Formar mensaje de TOP
  const mensaje = `
🏆 *TOP 5 RICOS DEL SISTEMA* 💰

${top.map((p, i) => {
  const num = i + 1;
  const tag = `@${p.jid.split('@')[0]}`;
  return `*${num}. ${tag}*  
   💵 Total: $${p.total}
   ├─ Efectivo: $${p.efectivo}
   ├─ Banco: $${p.banco}
   └─ Caja fuerte: $${p.caja}
   📈 Nivel: ${p.nivel} | XP: ${p.xp}
`;
}).join('\n')}
`.trim();

  // Enviar mensaje
  try {
    const randomImagePath = getRandomImage(imagesDir);
    if (!randomImagePath) {
      throw new Error('❌ No se encontraron imágenes en la carpeta');
    }

    const imageBuffer = fs.readFileSync(randomImagePath);
    await sock.sendPresenceUpdate('composing', msg.key.remoteJid);
    await sock.sendMessage(msg.key.remoteJid, {
      image: imageBuffer,
      caption: mensaje,
      mentions: top.map(p => p.jid)
    }, { quoted: msg });

  } catch (error) {
    console.error('Error en !topricos:', error);
    await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ Error al mostrar el top: ${error.message}`,
      mentions: top.map(p => p.jid)
    }, { quoted: msg });
  }
}