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
    // fallback to python3 or python
    if (has('python3')) return { cmd: 'python3', args: ['-m', 'yt_dlp'] };
    if (has('python')) return { cmd: 'python', args: ['-m', 'yt_dlp'] };

    // Last resort: try invoking 'node' - unlikely to work, but keep as final fallback
    return { cmd: process.execPath, args: ['-m', 'yt_dlp'] };
}

async function runYtDlp(url, outPrefix) {
    const { cmd, args: baseArgs } = findYtDlpCommand();
    const args = baseArgs.concat([
        '-f', 'bestaudio',
        '--extract-audio',
        '--audio-format', 'mp3',
        '-o', `${outPrefix}.%(ext)s`,
        url
    ]);

    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.on('error', (err) => reject(err));
        child.on('close', (code) => {
            if (code !== 0) return reject(new Error(`yt-dlp exited with code ${code}: ${stderr.trim().split('\n').slice(-5).join(' | ')}`));
            // find produced file
            const files = fs.readdirSync(path.dirname(outPrefix));
            const base = path.basename(outPrefix);
            const matched = files.filter(f => f.startsWith(base + '.'));
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
        console.warn('ytdl-core falló, usando yt-dlp como fallback:', e.message || e);
        // Fallback to yt-dlp (extract to mp3)
        const outPrefix = path.join(tmpdir(), `cerbero_${requesterId}_${unique}`);
        const downloaded = await runYtDlp(url, outPrefix);
        // optionally convert/rename to .mp4 for compatibility
        const finalPath = downloaded; // mp3 by yt-dlp
        return finalPath;
    }
}