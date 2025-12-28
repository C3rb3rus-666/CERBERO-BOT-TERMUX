// music_cplay2.js
// Comando !cplay2: búsqueda en YouTube con vista previa y selección interactiva
import yts from 'yt-search';
import { downloadAudioFromYoutube } from '../utils/youtubeDownloader.js';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec as _exec } from 'child_process';
const exec = promisify(_exec);

// Sesiones por usuario: { videos: [...], downloads: number }
const userSessions = new Map();

// Nuevo comando: !cprueba (antes cplay2)
export async function handleCpruebaCommand(sock, message, args) {
    const chatId = message.key.remoteJid;
    const userId = message.key.participant || message.key.remoteJid;

    if (!args || args.length === 0) {
        await sock.sendMessage(chatId, { text: 'Uso: !cprueba <término de búsqueda>' }, { quoted: message });
        return;
    }

    const searchTerm = args.join(' ');
    let results;
    try {
        results = await yts(searchTerm);
    } catch (e) {
        await sock.sendMessage(chatId, { text: 'Error buscando en YouTube.' }, { quoted: message });
        return;
    }

    const videos = (results?.videos || []).slice(0, 5);
    if (!videos.length) {
        await sock.sendMessage(chatId, { text: 'No se encontraron resultados en YouTube.' }, { quoted: message });
        return;
    }

    // Guardar sesión para selección posterior
    userSessions.set(userId, { videos, downloads: 0 });

    // Enviar vistas previas en mensajes separados (mínimo 4 mensajes si hay disponibles)
    const previews = videos.slice(0, 4);
    for (let i = 0; i < previews.length; i++) {
        const v = previews[i];
        const previewText = `🎧 Previsualización ${i + 1}/${videos.length}\n${v.title}\nDuración: ${v.timestamp} — Vistas: ${v.views}\n${v.url}`;
        try {
            await sock.sendMessage(chatId, { text: previewText, mentions: [userId] }, { quoted: message });
            // pequeño delay entre mensajes para evitar rate-limit
            await new Promise(r => setTimeout(r, 300));
        } catch (e) {
            // ignorar fallo de preview, continuar
        }
    }

    // Si hay un 5º resultado, mencionar que existe
    if (videos.length > 4) {
        await sock.sendMessage(chatId, { text: `Hay más resultados disponibles. Para descargar, usa: !cplayd <n> (ej: !cplayd 1)` }, { quoted: message });
    } else {
        await sock.sendMessage(chatId, { text: `Selecciona la pista a descargar con: !cplayd <n> (ej: !cplayd 1 - ${videos.length})` }, { quoted: message });
    }
}

// Manejador de selección: !cplayd <n> o respuesta numérica
export async function handleCplaydSelection(sock, message, selParam = null) {
    const chatId = message.key.remoteJid;
    const userId = message.key.participant || message.key.remoteJid;

    // Determinar selección
    let sel = null;
    if (typeof selParam === 'number' && !isNaN(selParam)) {
        sel = selParam;
    } else {
        const selRaw =
            message.message?.buttonsResponseMessage?.selectedButtonId ||
            message.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const m = (selRaw || '').toString().trim().match(/(\d+)/);
        sel = m ? parseInt(m[1], 10) : NaN;
    }

    if (isNaN(sel) || sel < 1) return;
    const session = userSessions.get(userId);
    if (!session) return;
    const videos = session.videos;
    if (!videos || !videos[sel - 1]) {
        await sock.sendMessage(chatId, { text: 'Selección inválida.' }, { quoted: message });
        return;
    }

    console.log('[music_cplay2] userId, sel, session:', userId, sel, { downloads: session.downloads, videos: session.videos.length });

    if (session.downloads >= 5) {
        await sock.sendMessage(chatId, { text: 'Has alcanzado el límite de 5 descargas simultáneas.' }, { quoted: message });
        return;
    }

    const video = videos[sel - 1];
    session.downloads++;
    userSessions.set(userId, session);

    try {
        await sock.sendMessage(chatId, { text: `Descargando: ${video.title}` }, { quoted: message });

        console.log('[music_cplay2] descargar url:', video.url);
        const filePath = await downloadAudioFromYoutube(video.url, userId);
        console.log('[music_cplay2] downloadAudioFromYoutube returned:', filePath);

        // Determinar extensión y nombres temporales
        const ext = path.extname(filePath).toLowerCase();
        const baseName = path.basename(filePath, ext);
        const dir = path.dirname(filePath);
        const mp3Path = ext === '.mp3' ? filePath : path.join(dir, `${baseName}.mp3`);
        const oggPath = path.join(dir, `${baseName}.ogg`);

        // Si el archivo no está en mp3 y ffmpeg está disponible, convertir a mp3
        try {
            if (ext !== '.mp3') {
                console.log('[music_cplay2] converting to mp3:', filePath, '->', mp3Path);
                await exec(`ffmpeg -y -i "${filePath}" -vn -c:a libmp3lame -q:a 2 "${mp3Path}"`);
            }
        } catch (e) {
            console.error('[music_cplay2] ffmpeg mp3 conversion failed:', e && (e.message || e));
            // si falla la conversión a mp3, seguir intentando con el archivo original
        }

        // Crear OGG (PTT) a partir del mp3 (preferible para notas de voz)
        try {
            console.log('[music_cplay2] creating ogg (ptt):', mp3Path, '->', oggPath);
            await exec(`ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 128k -vn "${oggPath}"`);
        } catch (e) {
            // si falla, intentar convertir desde el original
            console.error('[music_cplay2] ffmpeg ogg creation failed from mp3, trying original file:', e && (e.message || e));
            try { await exec(`ffmpeg -y -i "${filePath}" -c:a libopus -b:a 128k -vn "${oggPath}"`); } catch (ee) { console.error('[music_cplay2] ffmpeg ogg creation failed from original:', ee && (ee.message || ee)); }
        }

        const signedTitle = `[CERBERO-BOT] - ${video.title}`.slice(0,200);

        // Enviar MP3 como audio reproducible si existe
        if (fs.existsSync(mp3Path)) {
            await sock.sendMessage(chatId, {
                audio: { url: mp3Path },
                mimetype: 'audio/mpeg',
                fileName: `${signedTitle}.mp3`,
            }, { quoted: message });

            await sock.sendMessage(chatId, {
                document: { url: mp3Path },
                mimetype: 'audio/mpeg',
                fileName: `${signedTitle}.mp3`,
            }, { quoted: message });
        } else {
            // fallback: enviar el archivo original
            await sock.sendMessage(chatId, { document: { url: filePath }, fileName: `${signedTitle}${ext}` }, { quoted: message });
        }

        // Enviar nota de voz si OGG creado
        if (fs.existsSync(oggPath)) {
            await sock.sendMessage(chatId, {
                audio: { url: oggPath },
                mimetype: 'audio/ogg; codecs=opus',
                ptt: true,
            }, { quoted: message });
        }

        // Limpiar archivos temporales
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
        try { if (fs.existsSync(mp3Path) && mp3Path !== filePath) fs.unlinkSync(mp3Path); } catch (e) {}
        try { if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath); } catch (e) {}
    } catch (e) {
        console.error('Error en descarga cplayd:', e && (e.message || e));
        await sock.sendMessage(chatId, { text: 'Error al descargar el audio.' }, { quoted: message });
    } finally {
        session.downloads--;
        if (session.downloads <= 0) userSessions.delete(userId);
        else userSessions.set(userId, session);
    }
}

// Backwards compatibility: exportar nombres antiguos redirigiendo a los nuevos
export const handleCplay2Command = handleCpruebaCommand;
export const handleCplay2Selection = handleCplaydSelection;

