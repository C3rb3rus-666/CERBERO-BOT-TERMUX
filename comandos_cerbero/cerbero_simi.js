import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import googleTTS from 'google-tts-api';
import axios from 'axios';
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const BOT_HEADER = "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬";

// IA inteligente → cerbero_IA.js (!cerbero)
// Este módulo solo usa el diccionario local conocimientos.json + voz

// Ruta al archivo de conocimientos y cache local
const conocimientosPath = path.resolve(process.cwd(), 'comandos_cerbero', 'conocimientos.json');
let conocimientosCache = null;

function loadConocimientos() {
  if (conocimientosCache) return conocimientosCache;
  try {
    const raw = fs.readFileSync(conocimientosPath, 'utf-8');
    const json = JSON.parse(raw);
    const phrases = [];
    Object.values(json).forEach(arr => {
      if (Array.isArray(arr)) phrases.push(...arr);
    });
    conocimientosCache = phrases.filter(Boolean);
  } catch (e) {
    console.error('Error cargando conocimientos:', e);
    conocimientosCache = [];
  }
  return conocimientosCache;
}

function getRandomConocimiento() {
  const arr = loadConocimientos();
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
} 

// Función para interactuar con la IA local cerbero_simi.py
export const cerberoSimiBot = async (sock, msg) => {
  const chatId = msg.key.remoteJid;
  const userJid = msg.key.participant || msg.key.remoteJid;
  const userMessage = msg.message.conversation || msg.message.extendedTextMessage?.text;

  console.log(`[cerberoSimi] Invoked by ${userJid} in ${chatId}. message: ${userMessage ? userMessage.slice(0,64) : '<no-text>'}`);

  if (!userMessage) {
    await sock.sendMessage(chatId, { text: `${BOT_HEADER} Por favor, envía un mensaje de texto.` });
    return;
  }

  // Ejecutar el script Python como subproceso
  return new Promise((resolve) => {
    const py = spawn('python3', [
      './comandos_cerbero/cerbero_simi.py',
      userMessage
    ]);
    let respuesta = '';
    py.stdout.on('data', (data) => {
      respuesta += data.toString();
    });
    py.stderr.on('data', (data) => {
      console.error('Error cerbero_simi.py:', data.toString());
    });
    py.on('close', async () => {
      let respuestaTxt = respuesta.trim();

      // Si Python no supo responder, usar frase aleatoria del diccionario
      const noSabeFrases = ['estoy chiquito', 'no sé qué significa', 'error 404', 'enséñame'];
      if (!respuestaTxt || noSabeFrases.some(f => respuestaTxt.toLowerCase().includes(f))) {
        const alt = getRandomConocimiento();
        if (alt) respuestaTxt = alt;
      }

      if (!respuestaTxt) { resolve(); return; }

      const shortResponseLog = respuestaTxt.replace(/\s+/g, ' ').trim();
      console.log(`[IA] Cerbero-Simi responde en ${chatId} a ${userJid.split("@")[0]}: ${shortResponseLog}`);
      const formattedResponse = `${BOT_HEADER}\n@${userJid.split("@")[0]} ${respuestaTxt}`;
      await sock.sendMessage(
        chatId,
        {
          text: formattedResponse,
          mentions: [userJid],
        },
        { quoted: msg }
      );

      // Decidir aleatoriamente si enviar voz (50% de probabilidad)
      const sendVoice = Math.random() < 0.5;

      if (sendVoice) {
        // Generar y enviar audio de la respuesta
        let audioPath = null;
        let oggPath = null;
        try {
          const url = googleTTS.getAudioUrl(respuestaTxt, { lang: 'es', slow: false });
          const response = await axios.get(url, { responseType: 'arraybuffer' });
          const audioBuffer = Buffer.from(response.data);
          audioPath = path.join(tmpdir(), `cerbero_simi_${Date.now()}.mp3`);
          fs.writeFileSync(audioPath, audioBuffer);
          oggPath = path.join(tmpdir(), `cerbero_simi_${Date.now()}.ogg`);
          // Efecto voz robótica: vibrato mecánico + eco corto + ligero pitch bajo
          const ffmpegCommand = `ffmpeg -i "${audioPath}" -af "vibrato=f=20:d=0.9,aecho=0.85:0.7:8:0.3,asetrate=44100*0.88,aresample=44100" -c:a libopus -b:a 128k -vn "${oggPath}"`;
          await execAsync(ffmpegCommand);
          await sock.sendMessage(chatId, {
            audio: fs.readFileSync(oggPath),
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          }, { quoted: msg });
        } catch (error) {
          console.error('Error generando o enviando audio:', error);
        } finally {
          // Limpiar archivos temporales siempre
          if (audioPath && fs.existsSync(audioPath)) {
            try { fs.unlinkSync(audioPath); } catch (e) { console.error('Error eliminando audioPath:', e); }
          }
          if (oggPath && fs.existsSync(oggPath)) {
            try { fs.unlinkSync(oggPath); } catch (e) { console.error('Error eliminando oggPath:', e); }
          }
        }
      }

      resolve();
    });
  });
};
