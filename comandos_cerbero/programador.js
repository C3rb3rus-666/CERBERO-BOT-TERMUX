import fs from 'fs';
import path from 'path';

// Configuración de rutas
const imagesDir = path.join(process.cwd(), 'comandos_cerbero', 'imagenes');

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

// Función para manejar el comando !menu
export async function creador(sock, msg) {
    // Definimos el contenido del menú
const menuText = `
╔══════════════════════════════════════════╗
║        🤖 CERBERO-BOT DEVELOPER         ║
║     v4.2.8 Build 76                     ║
║  👨‍💻 Coded by: C3rb3rus-666             ║
║  🔗 github.com/C3rb3rus-666             ║
║  📱 WhatsApp: +573233704652             ║
║  📷 Instagram: c3rb3rus_666             ║
╚══════════════════════════════════════════╝

═══════════════════════════════════════════

⚙️  *𝐄𝐍𝐓𝐎𝐑𝐍𝐎 𝐃𝐄 𝐃𝐄𝐒𝐀𝐑𝐑𝐎𝐋𝐋𝐎* ⚙️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🖥️  Sistema       : Linux
🪟  Anfitrión      : Windows 11
💽  SSD           : Kingston NV1 1TB NVMe + Kingston A400 1TB SATA
🌐  Conexión      : Fibra Óptica CAT6 – 900 Mbps
🧩  Memoria RAM   : 64 GB DDR4 @ 3200 MHz
🧮  Procesador    : Intel® Core™ i5-12600HX (12th Gen) @ 4.60 GHz
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 | 👁‍🗨 Cerbero-Bot™
`.trim();


    // Seleccionamos una imagen aleatoria
    const randomImagePath = getRandomImage(imagesDir);
    if (!randomImagePath) {
        console.error('No se encontraron imágenes en la carpeta.');
        await sock.sendMessage(msg.key.remoteJid, { text: 'No se pudo encontrar una imagen.' });
        return;
    }

    // Leemos la imagen como un buffer
    const imageBuffer = fs.readFileSync(randomImagePath);

    // Enviamos el mensaje con la imagen, texto y botones interactivos
    await sock.sendMessage(msg.key.remoteJid, {
        image: imageBuffer,
        caption: menuText,
        buttons: [
            {
                buttonId: '!programador',
                buttonText: { displayText: '👨‍💻 Programador' },
                type: 1,
            }
        ]
    }, { quoted: msg });
    
}
