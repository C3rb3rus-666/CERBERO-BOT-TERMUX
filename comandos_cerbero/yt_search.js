
import { search } from "yt-search";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";

const execAsync = promisify(exec);

const BOT_HEADER = "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬";
const TEMP_DIR = path.join(process.cwd(), "temp");
const downloadsInProgress = {}; // Control de descargas activas

// Crear la carpeta temp si no existe
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑 Archivo eliminado: ${filePath}`);
  }
};

/**
 * Descargar música desde YouTube.
 * @param {string} videoUrl - URL del video de YouTube.
 * @param {string} requesterId - ID del solicitante.
 * @returns {Promise<{ mp3: string, ogg: string, title: string }>} - Información del audio descargado.
 */
async function downloadMusic(videoUrl, requesterId) {
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempMp3Path = path.join(TEMP_DIR, `audio_${requesterId}_${uniqueId}.mp3`);
  const tempOggPath = path.join(TEMP_DIR, `audio_${requesterId}_${uniqueId}.ogg`);

  // Descargar el audio como MP3
  const command = `yt-dlp -x --audio-format mp3 --audio-quality 0 -o "${tempMp3Path}" "${videoUrl}"`;
  await execAsync(command);

  // Convertir a formato OGG (PTT de WhatsApp)
  const ffmpegCommand = `ffmpeg -i "${tempMp3Path}" -c:a libopus -b:a 128k -vn "${tempOggPath}"`;
  await execAsync(ffmpegCommand);

  // Obtener el título del video
  const infoCommand = `yt-dlp --get-title "${videoUrl}"`;
  const { stdout: title } = await execAsync(infoCommand);

  return { mp3: tempMp3Path, ogg: tempOggPath, title: title.trim() };
}

/**
 * Descargar miniatura como buffer.
 * @param {string} thumbnailUrl - URL de la miniatura.
 * @returns {Promise<Buffer|null>} - Buffer de la miniatura.
 */
const downloadThumbnail = async (thumbnailUrl) => {
  try {
    const response = await axios.get(thumbnailUrl, { responseType: "arraybuffer" });
    return Buffer.from(response.data, "binary");
  } catch (error) {
    console.error("Error al descargar la miniatura:", error);
    return null;
  }
};

export const buscarMusica = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const requesterId = msg.key.participant || msg.key.remoteJid;

  if (downloadsInProgress[requesterId]) {
    // Si ya hay una descarga en progreso, notificamos al usuario
    await sock.sendMessage(chatId, {
      text: `${BOT_HEADER}\n❌ Actualmente hay una descarga en proceso. Por favor, espera a que termine antes de intentar nuevamente.`
    },{ quoted: msg });
    return;
  }

  const resultsFile = path.join(TEMP_DIR, `${chatId}_results.json`);
  
  if (args.length === 0) {
    await sock.sendMessage(chatId, { 
      text: `${BOT_HEADER}\n🔍 Escribe un término de búsqueda o un número para descargar.\n📌 Para buscar: *!yt_search eminem*\n📩 Para descargar: *!yt_search 1*`
    },{ quoted: msg });
    return;
  }

  const query = args.join(" ");

  // 🔹 Si el argumento es un número, intenta descargarlo
  if (!isNaN(query) && fs.existsSync(resultsFile)) {
    const results = JSON.parse(fs.readFileSync(resultsFile));
    const index = parseInt(query, 10) - 1;

    if (index >= 0 && index < results.length) {
      const video = results[index];

      downloadsInProgress[requesterId] = true; // Marcar como descarga en proceso

      await sock.sendMessage(chatId, { 
        text: `${BOT_HEADER}\n📥 Descargando: *${video.title}* (${video.timestamp})\n🔗 ${video.url}`
      },{ quoted: msg });

      try {
        // Descargar el audio
        const { mp3, ogg, title } = await downloadMusic(video.url, requesterId);

        // Enviar el archivo MP3
        await sock.sendMessage(chatId, {
          audio: fs.readFileSync(mp3),
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          caption: `${BOT_HEADER}\n✅ Descarga completada: *${title}*`
        },{ quoted: msg });

        // Enviar el archivo OGG (nota de voz)
        await sock.sendMessage(chatId, {
          audio: fs.readFileSync(ogg),
          mimetype: "audio/ogg; codecs=opus",
          ptt: true,
        },{ quoted: msg });
        await sock.sendMessage(chatId, {
          document: fs.readFileSync(mp3),
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
          caption: `${BOT_HEADER}\n✅ Descarga completada: *${title}*`
        },{ quoted: msg });

        // Eliminar archivos temporales
        deleteFile(mp3);
        deleteFile(ogg);

      } catch (error) {
        console.error(`Error en descarga: ${error.message}`);
        await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ Error al descargar el audio.` },{ quoted: msg });
      }

      downloadsInProgress[requesterId] = false; // Marcar como descarga completada
      return;
    } else {
      await sock.sendMessage(chatId, { 
        text: `${BOT_HEADER}\n❌ Selección inválida. Usa un número entre 1 y ${results.length}.`
      },
      { quoted: msg });
      return;
    }
  }

  // 🔹 Nueva búsqueda en YouTube
  try {
    const results = await search(query);

    if (!results.videos.length) {
      await sock.sendMessage(chatId, { 
        text: `${BOT_HEADER}\n❌ No se encontraron resultados para: ${query}`
      },
      { quoted: msg });
      return;
    }

    const topResults = results.videos.slice(0, 3); // Solo 3 resultados

    // 🔹 Guardar los resultados y programar su eliminación en 5 minutos
    fs.writeFileSync(resultsFile, JSON.stringify(topResults));
    setTimeout(() => deleteFile(resultsFile), 300000); // Eliminar en 5 minutos

    for (const [index, video] of topResults.entries()) {
      const thumbnailBuffer = await downloadThumbnail(video.thumbnail);

      await sock.sendMessage(chatId, {
        text: `${BOT_HEADER}\n🎵 *${index + 1}.* *${video.title}*\n👤 ${video.author.name}\n⏱ ${video.timestamp}\n🔗 ${video.url}`,
        linkPreview: { 
          canonicalUrl: video.url, // URL canónica
          matchedText: video.url, // Texto que coincide con el enlace
          title: video.title, // Título de la vista previa
          description: `Duración: ${video.timestamp}`, // Descripción
          jpegThumbnail: thumbnailBuffer // Miniatura como buffer
        }
      },{ quoted: msg });
    }

    await sock.sendMessage(chatId, { 
      text: `📩 Para descargar, usa los siguientes comandos segun sea el numero del resultado de busqueda:\n\`!cerbero_search 1\` o \`!cerbero_search 2\``
    },{ quoted: msg });

  } catch (error) {
    console.error("Error en búsqueda:", error);
    await sock.sendMessage(chatId, { 
      text: `${BOT_HEADER}\n⚠️ Error: ${error.message}`
    });
  }
};


/*import { search } from "yt-search";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const BOT_HEADER = "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬";
const TEMP_DIR = path.join(process.cwd(), "temp");

// Crear la carpeta temp si no existe
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`🗑 Archivo eliminado: ${filePath}`);
  }
};

export const buscarMusica = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const resultsFile = path.join(TEMP_DIR, `${chatId}_results.json`);

  if (args.length === 0) {
    await sock.sendMessage(chatId, { 
      text: `${BOT_HEADER}\n🔍 Escribe un término de búsqueda o un número para descargar.\n📌 Para buscar: *!yt_search eminem*\n📩 Para descargar: *!yt_search 1*`
    });
    return;
  }

  const query = args.join(" ");

  // 🔹 Si el argumento es un número, intenta descargarlo
  if (!isNaN(query) && fs.existsSync(resultsFile)) {
    const results = JSON.parse(fs.readFileSync(resultsFile));
    const index = parseInt(query, 10) - 1;

    if (index >= 0 && index < results.length) {
      const video = results[index];
      const outputFilePath = path.join(TEMP_DIR, `${video.videoId}.mp3`);

      await sock.sendMessage(chatId, { 
        text: `${BOT_HEADER}\n📥 Descargando: *${video.title}* (${video.timestamp})\n🔗 ${video.url}`
      });

      exec(`yt-dlp -x --audio-format mp3 -o "${outputFilePath}" ${video.url}`, async (error) => {
        if (error) {
          console.error(`Error en descarga: ${error.message}`);
          await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ Error al descargar el audio.` });
          return;
        }

        const audioBuffer = fs.readFileSync(outputFilePath);

        await sock.sendMessage(chatId, { 
          document: audioBuffer,
          mimetype: 'audio/mpeg',
          fileName: `${video.title}.mp3`,
          caption: `${BOT_HEADER}\n✅ Descarga completada: *${video.title}*`
        }).then(() => {
          // 🔹 Eliminar el archivo solo después de enviarlo con éxito
          deleteFile(outputFilePath);
        }).catch(err => console.error("Error enviando audio:", err));

      });

      return;
    } else {
      await sock.sendMessage(chatId, { 
        text: `${BOT_HEADER}\n❌ Selección inválida. Usa un número entre 1 y ${results.length}.`
      });
      return;
    }
  }

  // 🔹 Nueva búsqueda en YouTube
  try {
    const results = await search(query);

    if (!results.videos.length) {
      await sock.sendMessage(chatId, { 
        text: `${BOT_HEADER}\n❌ No se encontraron resultados para: ${query}`
      });
      return;
    }

    const topResults = results.videos.slice(0, 3); // Solo 3 resultados

    // 🔹 Guardar los resultados y programar su eliminación en 5 minutos
    fs.writeFileSync(resultsFile, JSON.stringify(topResults));
    setTimeout(() => deleteFile(resultsFile), 300000); // Eliminar en 5 minutos

    let messageText = `${BOT_HEADER}\nResultados encontrados:\n\n`;

    for (const [index, video] of topResults.entries()) {
      messageText += `🎵 *${index + 1}.* *${video.title}*\n👤 ${video.author.name}\n⏱ ${video.timestamp}\n🔗 ${video.url}\n\n`;

      // Enviar cada resultado con vista previa
      await sock.sendMessage(chatId, {
        text: `${BOT_HEADER}\n🎵 *${index + 1}.* *${video.title}*\n👤 ${video.author.name}\n⏱ ${video.timestamp}\n🔗 ${video.url}`,
        linkPreview: true // Activar vista previa de enlaces
      });
    }

    await sock.sendMessage(chatId, { 
      text: `📩 Para descargar, usa:\n\`!cerbero_search 1\` o \`!cerbero_search 2\``
    });

  } catch (error) {
    console.error("Error en búsqueda:", error);
    await sock.sendMessage(chatId, { 
      text: `${BOT_HEADER}\n⚠️ Error: ${error.message}`
    });
  }
};
*/