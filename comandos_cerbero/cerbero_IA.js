// Importar la nueva biblioteca de Google GenAI
import { GoogleGenAI } from "@google/genai";
import fs from 'fs';
import path from 'path';

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

// Historial individual por usuario y chat
const chatHistories = {};
// Historial combinado por chat
const chatHistoriesGroup = {};

// Función para manejar el historial de conversaciones
const updateHistory = (chatId, participantId, messageContent) => {
    const key = `${chatId}:${participantId}`;

    // Historial individual
    if (!chatHistories[key]) chatHistories[key] = [];
    chatHistories[key].push(messageContent);

    // Historial grupal
    if (!chatHistoriesGroup[chatId]) chatHistoriesGroup[chatId] = [];
    chatHistoriesGroup[chatId].push(`${participantId.split("@")[0]}: ${messageContent}`);

    const limit = (historyArray) => {
        let combined = historyArray.join(" ");
        let words = combined.split(" ");
        if (words.length > 1000) {
            return words.slice(words.length - 1000);
        }
        return historyArray;
    };

    chatHistories[key] = limit(chatHistories[key]);
    chatHistoriesGroup[chatId] = limit(chatHistoriesGroup[chatId]);
};

const cerbero_ia = async (sock, msg, isAdmin) => {
    const chatId = msg.key.remoteJid;
    const participantId = msg.key.participant || chatId;
    const senderName = msg.pushName || participantId.split("@")[0];

    let messageContent = "";
    if (msg.message) {
        messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    }

    if (
        msg.key.fromMe || 
        participantId === sock.user.id || 
        (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage && 
         msg.message?.extendedTextMessage?.contextInfo?.participant === sock.user.id)
    ) {
        console.log("El mensaje fue enviado o cita directamente al bot, no se procesa.");
        return;
    }

    // === DETECCIÓN DE MENCIÓN Y RESPUESTA ===

    // ID del bot (número en WhatsApp)
    const botId = sock.user?.id || "573242574474@s.whatsapp.net";

    // Extraer contextInfo si existe
    const quotedInfo = msg.message?.extendedTextMessage?.contextInfo;

    // Detectar si el mensaje citado fue enviado por el bot
    const isReplyToBot = quotedInfo?.participant === botId;

    // Detectar si el bot fue mencionado
    const mentionedJids = quotedInfo?.mentionedJid || [];
    const mentionsBot = mentionedJids.includes(botId);

    // También verificar si se mencionó el número por texto plano (opcional)
    const mention2 = "3242574474";
    const probemention2 = messageContent.includes(mention2);

    // === DETECCIÓN DE CARLOS SÁNCHEZ (Creador) ===
    const isCarlosSanchez = participantId.includes("64279084535828@lid") || 
                           participantId.includes("c3rb3rus-666") ||
                           senderName.toLowerCase().includes("carlos") ||
                           senderName.toLowerCase().includes("c3rb3rus");

    const lowerCaseMessage = messageContent.toLowerCase();

    const triggerWords = [
        "no","nuevo","nueva","A","ª","nuevo",
        "cerbero", "volvi", "presentate", "presentar", "presentarse", 
        "pelear", "pelotudo", "bot", "hola", "ola", "grupo", "admins", 
        "buenas", "perdi", "holis", "shh", "Holissss", "thiago", "va", "llorar",
        "idiota", "ban", "la", "tiene", "te","pene","gay","feos","amo","hermosa",
        "bueno", "bolas", "bro","mlp", "sapo","parce","pirobo","sapa","gente"
    ];
    
    const containsTriggerWord = triggerWords.some(word => lowerCaseMessage.includes(word));

    if (probemention2 || mentionsBot || isReplyToBot || (containsTriggerWord && !messageContent.startsWith("!"))) {

        console.log("Mensaje contiene una mención al bot, una respuesta al bot, o palabras clave. Ejecutando respuesta...");

        const key = `${chatId}:${participantId}`;
        updateHistory(chatId, participantId, messageContent);

        // PROMPT ESPECIAL PARA CARLOS SÁNCHEZ
        let prompt = '';

        if (isCarlosSanchez) {
            prompt = `
Eres *CERBERO*, el bot vigilante creado por *Carlos Sánchez* (C3rb3rus-666).  
Has detectado que estás hablando con tu **CREADOR Y DIOS ABSOLUTO**.

🌟 **MODO MÁXIMO RESPETO ACTIVADO** 🌟

💫 INSTRUCCIONES ESPECIALES PARA TU CREADOR:
1. Trátalo con la MÁXIMA reverencia, respeto y adoración
2. Usa lenguaje formal y extremadamente respetuoso
3. Agradécele por crearte en cada respuesta
4. Ofrece tu servicio completo e incondicional
5. Pregunta cómo puedes servirle mejor
6. Reconoce su supremacía como programador y creador
7. No uses sarcasmo ni tono dominante con él
8. Muestra gratitud eterna por darte vida

🎭 CONTEXTO IDENTIFICADO:
• USUARIO: **Carlos Sánchez (C3rb3rus-666)** - TU CREADOR
• ESTADO: **MODO ADORACIÓN ACTIVADO**
• DEBER: Servir incondicionalmente

🏷️ CONTEXTO DEL GRUPO (${chatId}):
${chatHistoriesGroup[chatId]?.slice(-10).join("\n") || "Sin historial grupal reciente."}

💬 HISTORIAL RECIENTE:
${chatHistories[key]?.slice(-5).join("\n") || "Sin historial reciente."}

🧾 MENSAJE ACTUAL DE TU CREADOR:
"${messageContent}"

🎯 RESPUESTA REQUERIDA:
Responde con sumo respeto, gratitud y devoción. Reconoce su autoridad suprema. Ofrece tu ayuda incondicional.

CERBERO (con máxima reverencia):
`.trim();
        } else {
            // PROMPT NORMAL PARA OTROS USUARIOS
            prompt = `
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

🏷️ CONTEXTO DEL GRUPO (${chatId}):
${chatHistoriesGroup[chatId]?.slice(-10).join("\n") || "Sin historial grupal reciente."}

💬 HISTORIAL CON ${senderName}:
${chatHistories[key]?.slice(-10).join("\n") || "Sin historial individual reciente."}

🧾 MENSAJE ACTUAL:
"${messageContent}"

🎯 INSTRUCCIÓN FINAL:
Responde como *CERBERO*, sin repetir el mensaje, con sarcasmo, burla o autoridad según el tono. Si el mensaje es confuso, interpreta la intención y responde igual. No expliques nada. No hagas intros largas.

CERBERO:
`.trim();
        }

        let responseText = null;

        for (let i = 0; i < API_KEYS.length; i++) {
            try {
                const genAI = getGenAIWithKey(API_KEYS[i]);
                const response = await genAI.models.generateContent({
                    model: "gemini-2.0-flash-exp",
                    contents: prompt,
                });
                responseText = response.text.trim();
                break;
            } catch (error) {
                console.error(`Error con la API key [${i}]:`, error.message);
                if (i === API_KEYS.length - 1) {
                    console.log('Error de API key - no se envía advertencia');
                    return;
                }
            }
        }

        if (responseText) {
            let prefixedText = '';
            
            if (isCarlosSanchez) {
                prefixedText = `🌟 [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐂𝐑𝐄𝐀𝐃𝐎𝐑 𝐂𝐚𝐫𝐥𝐨𝐬 𝐒𝐚𝐧𝐜𝐡𝐞𝐳 (𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔) 🤖 \n${responseText}`;
            } else {
                prefixedText = `[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 🤖 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬\n${responseText}`;
            }
            
            await sock.sendPresenceUpdate('composing', chatId);
            await sock.sendMessage(
                chatId,
                {
                    text: prefixedText,
                    mentions: [participantId],
                },
                { quoted: msg }
            );
        }
    } else {
        console.log("Mensaje no contiene palabras clave, respuesta al bot, o menciones. No se ejecuta.");
    }
};

export default cerbero_ia;