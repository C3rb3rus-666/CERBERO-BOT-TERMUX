import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import yts from 'yt-search';
import axios from 'axios';

const execAsync = promisify(exec);
const BOT_HEADER = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬';
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Control de descargas por solicitante para evitar concurrencia
const downloadsInProgress = {};

const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  }
};

async function searchYoutube(query) {
  const res = await yts.search({ query, hl: 'es', gl: 'ES' });
  return res.videos || [];
}

/**
 * Descargar miniatura como buffer (si es posible)
 * @param {string} thumbnailUrl
 * @returns {Promise<Buffer|null>}
 */
const downloadThumbnail = async (thumbnailUrl) => {
  if (!thumbnailUrl) return null;
  try {
    const resp = await axios.get(thumbnailUrl, { responseType: 'arraybuffer', timeout: 10000 });
    return Buffer.from(resp.data);
  } catch (e) {
    console.warn('No se pudo descargar miniatura:', e && e.message ? e.message : e);
    return null;
  }
};

// Extraer ID de YouTube desde URL para construir miniatura
const getYouTubeId = (url) => {
  if (!url) return null;
  // varios patrones soportados
  const patterns = [
    /(?:v=|vi=)([A-Za-z0-9_-]{11})/, // ...?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})/, // youtu.be/ID
    /\/v\/([A-Za-z0-9_-]{11})/, // /v/ID
    /embed\/([A-Za-z0-9_-]{11})/ // embed/ID
  ];
  for (const r of patterns) {
    const m = url.match(r);
    if (m && m[1]) return m[1];
  }
  return null;
};

function _ytCookiesFlag() {
  try {
    const p = path.resolve('./config/youtube_cookies.txt');
    if (!fs.existsSync(p)) return '';
    const first = fs.readFileSync(p, 'utf8').split('\n')[0].trim();
    if (first === '# Netscape HTTP Cookie File' || first === '# HTTP Cookie File') return `--cookies "${p}"`;
  } catch (_) {}
  return '';
}

async function downloadAudio(videoUrl, outPath) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const cookiesFlag = _ytCookiesFlag();
  const cmd = `yt-dlp --user-agent "${UA}" --add-header "Accept-Language:es-MX,es;q=0.9" --sleep-interval 2 --max-sleep-interval 5 ${cookiesFlag} -x --audio-format mp3 --audio-quality 0 -o "${outPath}" "${videoUrl}"`;
  await execAsync(cmd);
}

async function downloadVideo(videoUrl, outPath) {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const cookiesFlag = _ytCookiesFlag();
  const cmd = `yt-dlp --user-agent "${UA}" --add-header "Accept-Language:es-MX,es;q=0.9" --sleep-interval 2 --max-sleep-interval 5 ${cookiesFlag} -f "bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best" -o "${outPath}" "${videoUrl}"`;
  await execAsync(cmd);
}

export const youtubeCb = async (sock, msg, args, opts = { video:false }) => {
  const chatId = msg.key.remoteJid;
  const requesterId = msg.key.participant || msg.key.remoteJid;

  if (!args || args.length === 0) {
    await sock.sendMessage(chatId, { text: `${BOT_HEADER}\nUso: !yt_cb <término>  (audio)
!yt_cbv <término>  (video)` }, { quoted: msg });
    return;
  }

  const query = args.join(' ').trim();

  const resultsFile = path.join(TEMP_DIR, `${chatId.replace(/[@:]/g,'_')}_yt_results.json`);

  // Si el usuario envía un número, intentar usar la selección previa
  if (/^[1-9]\d*$/.test(query) && fs.existsSync(resultsFile)) {
    const results = JSON.parse(fs.readFileSync(resultsFile));
    const index = parseInt(query, 10) - 1;
    if (index >= 0 && index < results.length) {
      const video = results[index];

      if (downloadsInProgress[requesterId]) {
        await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ Actualmente tienes una descarga en curso. Espera a que termine.` }, { quoted: msg });
        return;
      }

      downloadsInProgress[requesterId] = true;
      await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n📥 Descargando: *${video.title}* (${video.timestamp})\n🔗 ${video.url}` }, { quoted: msg });

      const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const outFile = opts.video ? path.join(TEMP_DIR, `yt_${uniqueId}.mp4`) : path.join(TEMP_DIR, `yt_${uniqueId}.mp3`);

      try {
          if (opts.video) {
          await downloadVideo(video.url, outFile);
          const videoBuf = fs.readFileSync(outFile);
          let thumbnailBuffer = null;
          try { thumbnailBuffer = await downloadThumbnail(video.thumbnail); } catch (e) { /* ignore */ }
          const msgObj = { video: videoBuf, mimetype: 'video/mp4' };
          if (thumbnailBuffer) msgObj.jpegThumbnail = thumbnailBuffer;
          await sock.sendMessage(chatId, msgObj, { quoted: msg });
        } else {
          await downloadAudio(video.url, outFile);
          await sock.sendMessage(chatId, { audio: fs.readFileSync(outFile), mimetype: 'audio/mpeg', fileName: `${video.title}.mp3` }, { quoted: msg });
          // enviar también como documento
          await sock.sendMessage(chatId, { document: fs.readFileSync(outFile), mimetype: 'audio/mpeg', fileName: `${video.title}.mp3` }, { quoted: msg });
        }
      } catch (err) {
        console.error('Error en descarga por selección:', err);
        // fallback remoto
        try {
          const type = opts.video ? 'mp4' : 'mp3';
          const api = `https://ruby-core.vercel.app/api/download/youtube/${type}?url=${encodeURIComponent(video.url)}`;
          const res = await axios.get(api);
          if (res?.data?.status && res?.data?.download?.url) {
            const link = res.data.download.url;
            if (opts.video) await sock.sendMessage(chatId, { video: { url: link }, mimetype: 'video/mp4' }, { quoted: msg });
            else await sock.sendMessage(chatId, { audio: { url: link }, mimetype: 'audio/mpeg' }, { quoted: msg });
          } else {
            await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ No se pudo descargar el video/audio.` }, { quoted: msg });
          }
        } catch (err2) {
          console.error('Fallback error selección:', err2);
          await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ Error al descargar.` }, { quoted: msg });
        }
      } finally {
        deleteFile(outFile);
        downloadsInProgress[requesterId] = false;
      }
      return;
    } else {
      await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ Selección inválida. Usa un número entre 1 y ${results.length}.` }, { quoted: msg });
      return;
    }
  }

  // Si es URL directa, intentar descargar
  if (/https?:\/\//.test(query)) {
    const videoUrl = query;
    await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n📥 Descargando: ${videoUrl}` }, { quoted: msg });

    const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const outFile = opts.video ? path.join(TEMP_DIR, `yt_${uniqueId}.mp4`) : path.join(TEMP_DIR, `yt_${uniqueId}.mp3`);

    try {
      if (opts.video) {
        await downloadVideo(videoUrl, outFile);
        const videoBuf = fs.readFileSync(outFile);
        let thumbnailBuffer = null;
        // intentar obtener miniatura desde URL de YouTube si es posible
        const ytId = getYouTubeId(videoUrl);
        if (ytId) {
          try { thumbnailBuffer = await downloadThumbnail(`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`); } catch(e) {}
        }
        const msgObj = { video: videoBuf, mimetype: 'video/mp4' };
        if (thumbnailBuffer) msgObj.jpegThumbnail = thumbnailBuffer;
        await sock.sendMessage(chatId, msgObj, { quoted: msg });
      } else {
        await downloadAudio(videoUrl, outFile);
        await sock.sendMessage(chatId, { audio: fs.readFileSync(outFile), mimetype: 'audio/mpeg', fileName: `${uniqueId}.mp3` }, { quoted: msg });
      }
    } catch (err) {
      console.error('Error descargando directo:', err);
      // Intentar fallback remoto (ruby-core) para audio/video
      try {
        const type = opts.video ? 'mp4' : 'mp3';
        const api = `https://ruby-core.vercel.app/api/download/youtube/${type}?url=${encodeURIComponent(videoUrl)}`;
        const res = await axios.get(api);
        if (res?.data?.status && res?.data?.download?.url) {
          const link = res.data.download.url;
          if (opts.video) {
            // intentar attach miniatura si sabemos el id
            const ytId = getYouTubeId(videoUrl);
            let thumbnailBuffer = null;
            if (ytId) {
              try { thumbnailBuffer = await downloadThumbnail(`https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`); } catch(e) {}
            }
            if (thumbnailBuffer) await sock.sendMessage(chatId, { video: { url: link }, mimetype: 'video/mp4', jpegThumbnail: thumbnailBuffer }, { quoted: msg });
            else await sock.sendMessage(chatId, { video: { url: link }, mimetype: 'video/mp4' }, { quoted: msg });
          } else await sock.sendMessage(chatId, { audio: { url: link }, mimetype: 'audio/mpeg' }, { quoted: msg });
        } else {
          await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ No se pudo descargar el video/audio.` }, { quoted: msg });
        }
      } catch (err2) {
        console.error('Fallback error:', err2);
        await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ Error al descargar.` }, { quoted: msg });
      }
    } finally {
      deleteFile(outFile);
    }
    return;
  }

  // Si no es URL, realizar búsqueda
  try {
    const videos = await searchYoutube(query);
    if (!videos.length) {
      await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ No se encontraron resultados para: ${query}` }, { quoted: msg });
      return;
    }

    const top = videos.slice(0, 3);
    const resultsFile = path.join(TEMP_DIR, `${chatId.replace(/[@:]/g,'_')}_yt_results.json`);
    fs.writeFileSync(resultsFile, JSON.stringify(top));
    setTimeout(() => deleteFile(resultsFile), 300000); // eliminar en 5 min

    for (const [i, v] of top.entries()) {
      const thumbnailBuffer = await downloadThumbnail(v.thumbnail);
      const linkPreview = {
        canonicalUrl: v.url,
        matchedText: v.url,
        title: v.title,
        description: `Duración: ${v.timestamp}`
      };
      if (thumbnailBuffer) linkPreview.jpegThumbnail = thumbnailBuffer;

      await sock.sendMessage(chatId, {
        text: `${BOT_HEADER}\n*${i+1}.* ${v.title}\n👤 ${v.author.name}\n⏱ ${v.timestamp}\n🔗 ${v.url}`,
        linkPreview
      }, { quoted: msg });
    }

    await sock.sendMessage(chatId, { text: `📩 Para descargar usa: \`!yt_cb 1\` (audio) o \`!yt_cbv 1\` (video)` }, { quoted: msg });
  } catch (err) {
    console.error('Error búsqueda YouTube:', err);
    await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n⚠️ Error: ${err.message}` }, { quoted: msg });
  }
};

export default youtubeCb;