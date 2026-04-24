// youtubeDownloader.js
// Utilidad para descargar audio de YouTube — ESM
import ytdl from 'ytdl-core';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Archivo de cookies exportado del navegador (formato Netscape/cookies.txt)
// Para generarlo: instala la extensión "Get cookies.txt LOCALLY" en Chrome/Firefox,
// abre youtube.com logueado y exporta las cookies a este archivo.
const COOKIES_FILE = path.resolve(__dirname, '..', 'config', 'youtube_cookies.txt');

function findYtDlpCommand() {
    // Preferir rutas absolutas conocidas donde el binario funciona correctamente
    const knownPaths = [
        '/usr/local/bin/yt-dlp',  // symlink a venv (prioritario)
        path.join(process.env.HOME || '', '.cerbero-venv', 'bin', 'yt-dlp'),
        path.join(process.env.HOME || '', '.local', 'bin', 'yt-dlp'),
    ];
    for (const p of knownPaths) {
        if (fs.existsSync(p)) return { cmd: p, args: [] };
    }

    const has = (cmd) => {
        try { return require('child_process').execSync(`command -v ${cmd} 2>/dev/null`).toString().trim().length > 0; } catch(e){ return false; }
    }

    if (has('yt_dlp')) return { cmd: 'yt_dlp', args: [] };
    // prefer python3 or python as module runner for yt_dlp
    if (has('python3')) return { cmd: 'python3', args: ['-m', 'yt_dlp'] };
    if (has('python')) return { cmd: 'python', args: ['-m', 'yt_dlp'] };
    // Check for python3 in common locations if not in PATH
    const commonPython3Paths = ['/usr/bin/python3', '/usr/local/bin/python3', '/bin/python3'];
    for (const p of commonPython3Paths) {
        if (fs.existsSync(p)) return { cmd: p, args: ['-m', 'yt_dlp'] };
    }

    // No suitable command found — return null to let caller handle gracefully
    return null;
}

async function installYtDlp() {
    console.log('[youtubeDownloader] intentando instalar yt-dlp automáticamente...');
    return new Promise((resolve, reject) => {
        const installCmd = spawn('python3', ['-m', 'pip', 'install', '--upgrade', 'yt-dlp'], { stdio: 'inherit' });
        installCmd.on('close', (code) => {
            if (code === 0) {
                console.log('[youtubeDownloader] yt-dlp instalado exitosamente.');
                resolve();
            } else {
                reject(new Error('Fallo al instalar yt-dlp. Instálalo manualmente con: python3 -m pip install --upgrade yt-dlp'));
            }
        });
        installCmd.on('error', reject);
    });
}

async function runYtDlp(url, outPrefix) {
    let found = findYtDlpCommand();
    console.log('[youtubeDownloader] findYtDlpCommand ->', found);
    if (!found || !found.cmd) {
        console.log('[youtubeDownloader] yt-dlp no encontrado, intentando instalar...');
        try {
            await installYtDlp();
            found = findYtDlpCommand();
            if (!found || !found.cmd) {
                return Promise.reject(new Error('yt-dlp no encontrado incluso después de instalación. Instálalo manualmente con: python3 -m pip install --upgrade yt-dlp'));
            }
        } catch (installErr) {
            return Promise.reject(new Error(`Fallo en instalación automática: ${installErr.message}. Instala yt-dlp manualmente.`));
        }
    }
    const { cmd, args: baseArgs } = found;
    // Agregar cookies si el archivo existe y tiene contenido real
    const cookiesArgs = [];
    try {
        const cookiesStat = fs.statSync(COOKIES_FILE);
        if (cookiesStat.size > 100) cookiesArgs.push('--cookies', COOKIES_FILE);
    } catch (_) {}
    // User-Agent de Chrome real para que las peticiones parezcan un navegador legítimo
    // Esto reduce el riesgo de que YouTube detecte y bloquee la cuenta
    const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const args = (baseArgs || []).concat([
        '--js-runtimes', 'nodejs',
        ...cookiesArgs,
        '--user-agent', USER_AGENT,
        '--add-header', `Accept-Language:es-MX,es;q=0.9,en;q=0.8`,
        '--sleep-interval', '2',      // esperar 2s entre peticiones (menos agresivo)
        '--max-sleep-interval', '5',  // hasta 5s aleatorio
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
        const ytdlErr = (e && e.message) || String(e);
        console.warn('ytdl-core falló, usando yt-dlp como fallback:', ytdlErr);
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
            const msg = (err && err.message) || String(err);
            // Errores con mensaje claro al usuario
            if (msg.includes('Sign in to confirm your age') || msg.includes('age-restricted')) {
                throw new Error('AGE_RESTRICTED');
            }
            if (msg.includes('Private video') || msg.includes('This video is private')) {
                throw new Error('PRIVATE_VIDEO');
            }
            throw new Error(`yt-dlp fallback falló: ${msg}`);
        }
    }
}