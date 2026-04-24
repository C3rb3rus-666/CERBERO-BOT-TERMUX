import { exec } from "child_process";
import { promisify } from "util";
import { tmpdir } from "os";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

// Mapa para rastrear solicitudes activas por usuario
const activeRequests = new Map();

/**
 * Busca y descarga música desde YouTube.
 * @param {string} query - Término de búsqueda.
 * @param {string} requesterId - ID del solicitante.
 * @returns {Promise<object>} - Información del audio descargado.
 */
async function downloadMusic(query, requesterId) {
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const response = await fetch(searchUrl);
  const html = await response.text();

  const videoId = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/)?.[1];
  const titleMatch = html.match(/"title":{"runs":\[{"text":"(.*?)"}]/)?.[1];

  if (!videoId || !titleMatch) throw new Error("No se encontraron resultados");

  const sanitizedTitle = titleMatch.replace(/[^\w\s.-]/g, "_").slice(0, 50);
  const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const tempMp3Path = path.join(tmpdir(), `${sanitizedTitle}_${requesterId}_${uniqueId}.mp3`);
  const tempOggPath = path.join(tmpdir(), `${sanitizedTitle}_${requesterId}_${uniqueId}.ogg`);

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Descargar el audio como MP3
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const _cookiesPath = path.resolve('./config/youtube_cookies.txt');
  const _cookiesValid = (() => {
    try {
      if (!fs.existsSync(_cookiesPath)) return false;
      const firstLine = fs.readFileSync(_cookiesPath, 'utf8').split('\n')[0].trim();
      return firstLine === '# Netscape HTTP Cookie File' || firstLine === '# HTTP Cookie File';
    } catch (_) { return false; }
  })();
  const cookiesFlag = _cookiesValid ? `--cookies "${_cookiesPath}"` : '';
  const command = `yt-dlp --extractor-args "youtube:player_client=android" --user-agent "${UA}" --add-header "Accept-Language:es-MX,es;q=0.9" --sleep-interval 2 --max-sleep-interval 5 ${cookiesFlag} -x --audio-format mp3 --audio-quality 0 -o "${tempMp3Path}" "${videoUrl}"`;

  await execAsync(command);

  // Convertir a formato OGG (PTT de WhatsApp)
  const ffmpegCommand = `ffmpeg -i "${tempMp3Path}" -c:a libopus -b:a 128k -vn "${tempOggPath}"`;
  await execAsync(ffmpegCommand);

  return { mp3: tempMp3Path, ogg: tempOggPath, title: titleMatch };
}

/**
 * Comando para buscar y enviar música.
 * @param {object} sock - Instancia de Baileys.
 * @param {object} message - Mensaje recibido.
 * @param {string[]} args - Argumentos del comando.
 */
export async function playMusicCommand(sock, message, args) {
  const groupId = message.key.remoteJid;
  const senderId = message.key.participant || message.key.remoteJid; // JID del remitente.
  const senderMention = `@${senderId.split("@")[0]}`;
  const query = args.join(" ");

  if (!query) {

    await sock.sendMessage(groupId, {
      text: "**[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🤖 𝐄𝐣𝐞𝐦𝐩𝐥𝐨:** *!𝐜𝐩𝐥𝐚𝐲 𝐁𝐨𝐡𝐞𝐦𝐢𝐚𝐧 𝐑𝐡𝐚𝐩𝐬𝐨𝐝𝐲*",
    },{ quoted: message });
    return;
  }

  // Verificar si el usuario ya tiene una solicitud activa
  if (activeRequests.has(senderId)) {

    await sock.sendMessage(groupId, {
      text: `**[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ 𝐘𝐚 𝐭𝐢𝐞𝐧𝐞𝐬 𝐮𝐧𝐚 𝐬𝐨𝐥𝐢𝐜𝐢𝐭𝐮𝐝 𝐞𝐧 𝐜𝐮𝐫𝐬𝐨. 𝐄𝐬𝐩𝐞𝐫𝐚 𝐚 𝐪𝐮𝐞 𝐬𝐞 𝐜𝐨𝐦𝐩𝐥𝐞𝐭𝐞 𝐩𝐚𝐫𝐚 𝐡𝐚𝐜𝐞𝐫 𝐮𝐧𝐚 𝐧𝐮𝐞𝐯𝐚.**`,
      mentions: [senderId],
    },
    { quoted: message });
    return;
  }

  try {
    // Marcar la solicitud como activa
    activeRequests.set(senderId, true);

    await sock.sendMessage(groupId, {
      text: "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🔍 𝐁𝐮𝐬𝐜𝐚𝐧𝐝𝐨 𝐲 𝐝𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 𝐦ú𝐬𝐢𝐜𝐚...  𝐜𝐫𝐞𝐚𝐝𝐨 𝐩𝐨𝐫 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 (𝐂𝐚𝐫𝐥𝐨𝐬 𝐒𝐚𝐧𝐜𝐡𝐞𝐳) 𝐠𝐢𝐭𝐡𝐮𝐛.𝐜𝐨𝐦/𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔",
    },
    { quoted: message });

    const { mp3, ogg, title } = await downloadMusic(query, senderId);

    const signedTitle = `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] - ${title}`;

    // Enviar audio MP3 como audio reproducible
    await sock.sendMessage(groupId, {
      audio: { url: mp3 },
      mimetype: "audio/mpeg",
      fileName: `${signedTitle}.mp3`,
    },
    { quoted: message });

    // Enviar audio MP3 como documento
    await sock.sendMessage(groupId, {
      document: { url: mp3 },
      mimetype: "audio/mpeg",
      fileName: `${signedTitle}.mp3`,
    },
    { quoted: message });

    // Enviar audio como nota de voz
    await sock.sendMessage(groupId, {
      audio: { url: ogg },
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
    },
    { quoted: message });

    // Eliminar archivos temporales
    fs.unlinkSync(mp3);
    fs.unlinkSync(ogg);

    await sock.sendMessage(groupId, {
      text: `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🎵 𝐌ú𝐬𝐢𝐜𝐚 𝐝𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐝𝐚 𝐜𝐨𝐧 é𝐱𝐢𝐭𝐨, ${senderMention}! 𝐜𝐫𝐞𝐚𝐝𝐨 𝐩𝐨𝐫 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 (𝐂𝐚𝐫𝐥𝐨𝐬 𝐒𝐚𝐧𝐜𝐡𝐞𝐳) 𝐯𝐢𝐬𝐢𝐭𝐚 𝐦𝐢 𝐫𝐞𝐩𝐨𝐬𝐢𝐭𝐨𝐫𝐢𝐨: 𝐠𝐢𝐭𝐡𝐮𝐛.𝐜𝐨𝐦/𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔`,
      mentions: [senderId],
    },
    { quoted: message }
  );
  } catch (error) {
    console.error("Error en playMusicCommand:", error);
    const errMsg = (error && error.message) || String(error);
    let userText = "**[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] ⚠️ 𝐄𝐫𝐫𝐨𝐫 𝐚𝐥 𝐩𝐫𝐨𝐜𝐞𝐬𝐚𝐫 𝐥𝐚 𝐬𝐨𝐥𝐢𝐜𝐢𝐭𝐮𝐝.**";
    if (errMsg.includes('AGE_RESTRICTED')) {
      userText = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🔞 Ese video tiene restricción de edad en YouTube y no se puede descargar sin verificación de cuenta.';
    } else if (errMsg.includes('PRIVATE_VIDEO')) {
      userText = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🔒 Ese video es privado y no se puede descargar.';
    }
    await sock.sendMessage(groupId, { text: userText }, { quoted: message });
  } finally {
    // Marcar la solicitud como completada
    activeRequests.delete(senderId);
  }
}

