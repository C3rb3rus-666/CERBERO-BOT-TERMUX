// youtubeDownloader.js
// Utilidad para descargar audio de YouTube — ESM
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

function findYtDlpCommand() {
    // Prefer system binary 'yt-dlp', then 'yt_dlp', else fallback to 'python3 -m yt_dlp' or 'python -m yt_dlp'
    const has = (cmd) => {
        try { return require('child_process').execSync(`command -v ${cmd} 2>/dev/null`).toString().trim().length > 0; } catch(e){ return false; }
    }

    if (has('yt-dlp')) return { cmd: 'yt-dlp', args: [] };
    if (has('yt_dlp')) return { cmd: 'yt_dlp', args: [] };
    // prefer python3 or python as module runner for yt_dlp
    if (has('python3')) return { cmd: 'python3', args: ['-m', 'yt_dlp'] };
    if (has('python')) return { cmd: 'python', args: ['-m', 'yt_dlp'] };

    // No suitable command found — return null to let caller handle gracefully
    return null;
}

async function runYtDlp(url, outPrefix) {
    const found = findYtDlpCommand();
    console.log('[youtubeDownloader] findYtDlpCommand ->', found);
    if (!found || !found.cmd) {
        return Promise.reject(new Error('yt-dlp no encontrado: instala yt-dlp (pip install -U yt-dlp) o añade el binario a PATH. Ejecuta ./install.sh para asistencia.'));
    }
    const { cmd, args: baseArgs } = found;
    const args = (baseArgs || []).concat([
        '-f', 'bestaudio',
        '--extract-audio',
        '--audio-format', 'mp3',
        '-o', `${outPrefix}.%(ext)s`,
        url
    ]);

    return new Promise((resolve, reject) => {
        console.log('[youtubeDownloader] executing:', cmd, args.join(' '));
        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); console.error('[yt-dlp stderr]', chunk.toString()); });
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            if (code !== 0) return reject(new Error(`yt-dlp exited with code ${code}: ${stderr.trim().split('\n').slice(-5).join(' | ')}`));
            // find produced file
            const files = fs.readdirSync(path.dirname(outPrefix));
            const base = path.basename(outPrefix);
            const matched = files.filter(f => f.startsWith(base + '.'));
            console.log('[youtubeDownloader] files in tmp:', matched);
            if (matched.length === 0) return reject(new Error('yt-dlp no produjo archivo de salida')); 
            resolve(path.join(path.dirname(outPrefix), matched[0]));
        });
    });
}

export async function downloadAudioFromYoutube(url, requesterId = 'anon') {
    const unique = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const outPath = path.join(tmpdir(), `cerbero_${requesterId}_${unique}.mp4`);

    // Intentar ytdl-core primero
    try {
        console.log('[youtubeDownloader] intentando ytdl-core para:', url);
        const stream = ytdl(url, { filter: 'audioonly', quality: 'highestaudio' });
        const write = fs.createWriteStream(outPath);

        await new Promise((resolve, reject) => {
            stream.pipe(write);
            write.on('finish', resolve);
            write.on('error', reject);
            stream.on('error', reject);
        });

        return outPath;
    } catch (e) {
        console.warn('ytdl-core falló, usando yt-dlp como fallback:', e && (e.message || e));
        // Fallback to yt-dlp (extract to mp3)
        const outPrefix = path.join(tmpdir(), `cerbero_${requesterId}_${unique}`);
        console.log('[youtubeDownloader] runYtDlp outPrefix:', outPrefix);
        try {
            const downloaded = await runYtDlp(url, outPrefix);
            console.log('[youtubeDownloader] downloaded file from yt-dlp:', downloaded);
            // optionally convert/rename to .mp4 for compatibility
            const finalPath = downloaded; // mp3 by yt-dlp
            return finalPath;
        } catch (err) {
            console.error('[youtubeDownloader] runYtDlp failed:', err && (err.message || err));
            // Re-throw with actionable instructions for the operator
            throw new Error(`yt-dlp fallback falló: ${err && (err.message || err)}\nInstala yt-dlp con: 'python3 -m pip install -U yt-dlp' o coloca el binario 'yt-dlp' en PATH. Ejecuta './install.sh' si deseas que el instalador lo intente automáticamente.`);
        }
    }
}