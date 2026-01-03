import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

/**
 * Descarga un video de YouTube usando yt-dlp.
 * @param {string} url - URL del video.
 * @returns {Promise<string>} - Ruta del archivo de video.
 */
async function downloadVideo(url) {
  const tempFilePath = path.join(tmpdir(), `video_${Date.now()}.mp4`);

  // Comando para descargar el video con yt-dlp
  const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" -o "${tempFilePath}" ${url}`;

  try {
    await execAsync(command);
    return tempFilePath;
  } catch (error) {
    console.error('Error al descargar el video:', error);
    throw new Error('No se pudo descargar el video.');
  }
}

export async function youtubeCommand(sock, message, args) {
  const groupId = message.key.remoteJid;
  const sender = message.key.participant || message.key.remoteJid; // Obtener el remitente
  const url = args[0];

  // Crear mención al usuario
  const mention = `@${sender.split('@')[0]}`;

  if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
    await sock.sendMessage(groupId, { 
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]*\n${mention}, envía un enlace *válido* de YouTube.\nEjemplo: *!yt https://youtube.com/watch?v=...*`,
      mentions: [sender] // Etiquetar al remitente
    },
    { quoted: message });
    return;
  }

  try {
    // Mensaje de descarga con mención
    await sock.sendMessage(groupId, { 
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]*\n${mention}, descargando video... ⏬`,
      mentions: [sender]
    },
    { quoted: message });

    const videoFilePath = await downloadVideo(url);

    // Enviar video con mención en el caption
    await sock.sendMessage(groupId, { 
      video: { url: videoFilePath },
      mimetype: 'video/mp4',
      caption: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]*\n🎥 Video descargado  .`,
    },
    { quoted: message });

    // Eliminar el archivo temporal
    fs.unlinkSync(videoFilePath);
  } catch (error) {
    console.error('Error en youtubeCommand:', error);
    await sock.sendMessage(groupId, { 
      text: `*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]*\n${mention}, ⚠️ Error al descargar el video.`,
      mentions: [sender]
    },
    { quoted: message });
  }
}