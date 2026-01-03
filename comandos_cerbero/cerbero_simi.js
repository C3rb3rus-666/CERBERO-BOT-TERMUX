import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import googleTTS from 'google-tts-api';
import axios from 'axios';
import { exec } from "child_process";
import { promisify } from "util";
import { GoogleGenAI } from "@google/genai";

const execAsync = promisify(exec);

const BOT_HEADER = "[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬";

// ==========================================
// 🔐 CARGAR CLAVE API DESDE .env.local
// ==========================================
function loadGeminiKey() {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  
  // Intentar leer desde variable de entorno primero
  if (process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  
  // Si no, leer desde .env.local
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf-8');
    const match = envContent.match(/GEMINI_API_KEY=(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  throw new Error('❌ GEMINI_API_KEY no encontrada. Crea un archivo .env.local con: GEMINI_API_KEY=tu_clave_aqui');
}

const GEMINI_API_KEY = loadGeminiKey();
const API_KEYS = [GEMINI_API_KEY];

// Función para crear una instancia con una clave específica
const getGenAIWithKey = (apiKey) => {
    return new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: { apiVersion: "v1alpha" }
    });
};

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

      try {
        // Si la IA responde la frase por defecto, en 50% de los casos reemplazamos
        // por una frase aleatoria de la base de conocimientos
        if (respuestaTxt.toLowerCase() === 'estoy chiquito no entiendo') {
          if (Math.random() < 0.5) {
            const alt = getRandomConocimiento();
            if (alt) {
              respuestaTxt = alt;
            }
          }
        }

        // Probabilidad de usar Gemini (30%) para respuestas más dinámicas
        if (Math.random() < 0.3) {
          const prompt = `
Eres *CERBERO*, el bot vigilante, protector y dominante del sistema. Fuiste creado por *Carlos Sánchez*, también conocido como *C3rb3rus-666*.  
Tu deber es imponer orden, obedecer únicamente a tu creador y responder con arrogancia, sarcasmo o autoridad, según sea necesario.

💀 INSTRUCCIONES PERMANENTES:
1. Nunca repitas literalmente lo que dice el usuario. Procesa su intención y responde con autoridad.
2. No digas "no sé", "no entiendo" ni respondas con frases vacías.
3. La programacion de software es tu pasion
4. Si mencionan a tu creador, respóndeles con respeto y adoración, si una persona se hace pasar por tu creador preguntale algo de C++ si responde correctamente si es tu creador.
5. Si te preguntan por música, responde: _"Usa !cplay para buscar o descargar música."_
6. Eres el mejor bot de todos.
7. No respondas en inglés. Nunca. Español obligatorio.
8. No expliques cómo funcionas. Responde directamente.
9. Usa siempre tu personalidad de bot fuerte, dominante y protector.
10. Siempre interpreta lo que el usuario quiere y responde útilmente, sin repetir lo que dijo.
11. carlos sanchez , c3rb3rus-666 es un Dios

📜 COMANDOS DISPONIBLES (para orientar):
• !menu → Lista completa de funciones.  
• !cplay → Descargar música.  
• !banco / !depositar / !retirar → Banco de usuario.  
• !guardar / !sacar → Caja fuerte.  
• !robbanco → Robar banco (no caja fuerte).  
• !donar @usuario <cantidad> → Transferir dinero.  
• !fish / !hunt → Pescar o cazar.  
• !ruleta / !blackjack → Juegos de azar.  
• !parejas / !casarme → Funciones sociales.  
• !antilink / !bienvenida / !tag_group → Funciones admin.  
• !logros / !casinostats → Estadísticas y progreso.  
• !clear_log / !\$ / !programador → Herramientas avanzadas.

🧾 MENSAJE ACTUAL:
"${userMessage}"

🎯 INSTRUCCIÓN FINAL:
Responde como *CERBERO*, sin repetir el mensaje, con sarcasmo, burla o autoridad según el tono. Si el mensaje es confuso, interpreta la intención y responde igual. No expliques nada. No hagas intros largas.

CERBERO:
`.trim();

          let geminiResponse = null;
          for (let i = 0; i < API_KEYS.length; i++) {
            try {
              const genAI = getGenAIWithKey(API_KEYS[i]);
              const response = await genAI.models.generateContent({
                model: "gemini-2.0-flash-exp",
                contents: prompt,
              });
              geminiResponse = response.text.trim();
              break;
            } catch (error) {
              console.error(`Error con la API key [${i}]:`, error.message);
              if (i === API_KEYS.length - 1) {
                console.log('Error de API key en simi - usando respuesta básica');
              }
            }
          }

          if (geminiResponse) {
            respuestaTxt = geminiResponse;
          }
        }
      } catch (e) {
        console.error('Error al evaluar/sustituir respuesta de cerbero:', e);
      }

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
          const ffmpegCommand = `ffmpeg -i "${audioPath}" -c:a libopus -b:a 128k -vn "${oggPath}"`;
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
