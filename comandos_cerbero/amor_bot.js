import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import { GoogleGenAI } from '@google/genai';

// ==========================================
// 💝 AMOR BOT — Mensajes lindos diarios
// Usa Google Gemini SDK (@google/genai) para generar mensajes románticos

//busqueda de yokary en el grupo para enviar los mensajes romanticos
// ==========================================

const CONFIG_PATH = path.resolve(process.cwd(), 'comandos_cerbero', 'amor_config.json');

// Cargar API key de Gemini
function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const match = fs.readFileSync(envPath, 'utf-8').match(/GEMINI_API_KEY=(.+)/);
    if (match?.[1]) return match[1].trim();
  }
  return 'AIzaSyD2hnvT_1dgYj4hvrg31ovjyRQjYlm_928';
}

// Modelos Gemini en orden de preferencia
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
];

// Esperar los segundos que la API indica en retryDelay
function parseRetryDelay(err) {
  try {
    const body = typeof err === 'string' ? JSON.parse(err) : err;
    const retry = body?.error?.details?.find(d => d['@type']?.includes('RetryInfo'));
    if (retry?.retryDelay) {
      const secs = parseFloat(retry.retryDelay.replace('s', ''));
      return isNaN(secs) ? 35_000 : Math.ceil(secs + 2) * 1000;
    }
  } catch (_) {}
  return 35_000; // fallback 35s
}

// Llamar Gemini con fallback entre modelos + retry automático en 429 (SDK oficial)
async function callOpenRouter(prompt) {
  const apiKey = loadGeminiKey();
  const ai = new GoogleGenAI({ apiKey });

  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt });
        const text = response.text?.trim();
        if (text) {
          console.log(`[AMOR-BOT] ✅ Mensaje generado con Gemini (${model})`);
          return text;
        }
        console.warn(`[AMOR-BOT] ⚠️ ${model} sin contenido`);
        break;
      } catch (e) {
        const raw = e.message || '';
        // 429 → esperar el delay sugerido y reintentar una vez
        if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
          if (attempt === 0) {
            let parsed;
            try { parsed = JSON.parse(raw); } catch (_) { parsed = null; }
            const delay = parseRetryDelay(parsed);
            console.warn(`[AMOR-BOT] ⏳ ${model} 429 — esperando ${delay/1000}s...`);
            await new Promise(r => setTimeout(r, delay));
            continue; // reintentar
          }
        }
        // 404 u otro error → pasar al siguiente modelo
        console.error(`[AMOR-BOT] ❌ Error con ${model}:`, raw.slice(0, 120));
        break;
      }
    }
  }

  console.error('[AMOR-BOT] ❌ Todos los modelos Gemini fallaron');
  return null;
}

// ⚙️ CONFIGURACIÓN AUTOMÁTICA HARDCODED
const OBJETIVO_NUMERO = '573209382631';  // +57 320 9382631
const OBJETIVO_NOMBRE = 'mi reina';          // nombre para personalizar

// 🕒 3 ENVIOS DIARIOS AUTOMÁTICOS
const HORARIOS = [
  { hora: '09:00', momento: 'mañana' },  // Buenos días
  { hora: '14:00', momento: 'tarde' },   // Mensaje de tarde
  { hora: '20:00', momento: 'noche' }    // Buenas noches
];

// Cargar configuración (auto-crea con objetivo hardcoded)
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaultConfig = {
      target: `${OBJETIVO_NUMERO}@s.whatsapp.net`,
      active: true,
      nombre: OBJETIVO_NOMBRE,
      mensajesEnviados: 0,
      lastSent: {  // última fecha de envío por momento
        mañana: null,
        tarde: null,
        noche: null
      }
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!config.target || config.target !== `${OBJETIVO_NUMERO}@s.whatsapp.net`) {
      config.target = `${OBJETIVO_NUMERO}@s.whatsapp.net`;
      config.nombre = OBJETIVO_NOMBRE;
      saveConfig(config);
    }
    // Asegurar que existe lastSent
    if (!config.lastSent) {
      config.lastSent = { mañana: null, tarde: null, noche: null };
      saveConfig(config);
    }
    return config;
  } catch {
    const defaultConfig = {
      target: `${OBJETIVO_NUMERO}@s.whatsapp.net`,
      active: true,
      nombre: OBJETIVO_NOMBRE,
      mensajesEnviados: 0,
      lastSent: { mañana: null, tarde: null, noche: null }
    };
    saveConfig(defaultConfig);
    return defaultConfig;
  }
}

// Guardar configuración
function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// Generar mensaje romántico profundo según el momento del día
async function generarMensajeLindo(nombre, contador, momento) {
  let contexto = '';
  let tipoMensaje = '';
  
  if (momento === 'mañana') {
    contexto = 'Buenos días. Es la mañana y quieres que ella sepa que piensas en ella al despertar.';
    tipoMensaje = 'un mensaje de buenos días romántico expresando cuánto la piensas';
  } else if (momento === 'tarde') {
    contexto = 'Es la tarde. Quieres recordarle que sigue siendo importante para ti durante el día.';
    tipoMensaje = 'un mensaje de tarde dulce sobre lo especial que es para ti';
  } else if (momento === 'noche') {
    contexto = 'Es la noche. Quieres desearle buenas noches de forma romántica y que piense en ti antes de dormir.';
    tipoMensaje = 'un mensaje de buenas noches profundo expresando tus sentimientos';
  }

  const prompt = `Eres Carlos, un chico profundamente enamorado de una chica muy especial.
Llevas ${Math.floor(contador / 3)} días enviándole mensajes diarios (mañana, tarde y noche).

${contexto}

Quieres enviarle ${tipoMensaje}.

REGLAS ESTRICTAS:
- Máximo 2-3 líneas (35-55 palabras)
- Sincero y profundo, pero natural
- Expresa cuánto la piensas y lo importante que es para ti
- Romántico pero genuino, no cursi
- Puedes usar: "pienso mucho en ti", "eres importante para mí", "significas mucho"
- Sin emojis excesivos (máximo 1-2)
- En español
- NO uses "mi vida", "mi cielo" (aún no llegan a ese nivel)
- ${momento === 'mañana' ? 'Incluye saludo de buenos días' : momento === 'noche' ? 'Incluye deseo de buenas noches' : 'Mensaje casual de tarde'}

Escribe SOLO el mensaje, sin introducción ni explicación:`;

  return await callOpenRouter(prompt);
}

// Enviar mensaje (reutilizable para cron y catch-up)
async function enviarMensaje(sock, momento) {
  const config = loadConfig();
  
  try {
    console.log(`[AMOR-BOT] 💝 Generando mensaje de ${momento}...`);
    
    config.mensajesEnviados = (config.mensajesEnviados || 0) + 1;
    const mensaje = await generarMensajeLindo(config.nombre, config.mensajesEnviados, momento);
    
    if (!mensaje) {
      console.error(`[AMOR-BOT] ❌ No se pudo generar mensaje de ${momento}`);
      config.mensajesEnviados--;
      return false;
    }

    await sock.sendMessage(config.target, { text: mensaje });
    
    // 🔍 COPIA A CARLOS para verificar que funciona
    const CARLOS = '573233704652@s.whatsapp.net';
    await sock.sendMessage(CARLOS, { 
      text: `📋 COPIA (${momento}):\n\n${mensaje}\n\n✅ Enviado a +${config.target.split('@')[0]}` 
    });
    
    // Registrar fecha de envío
    config.lastSent[momento] = new Date().toISOString();
    saveConfig(config);
    
    console.log(`[AMOR-BOT] ✅ Mensaje #${config.mensajesEnviados} (${momento}) enviado`);
    return true;
    
  } catch (error) {
    console.error(`[AMOR-BOT] ❌ Error enviando mensaje de ${momento}:`, error);
    return false;
  }
}

// Verificar y recuperar mensajes perdidos del día
async function verificarMensajesPerdidos(sock) {
  const config = loadConfig();
  const ahora = new Date();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  const fechaHoy = ahora.toISOString().split('T')[0];
  
  for (const { hora, momento } of HORARIOS) {
    const [h, m] = hora.split(':').map(Number);
    const horaProgramada = h * 60 + m;
    
    // Si ya pasó la hora programada
    if (horaActual >= horaProgramada) {
      const lastSent = config.lastSent?.[momento];
      const fechaUltimoEnvio = lastSent ? lastSent.split('T')[0] : null;
      
      // Si no se envió hoy, enviar ahora (catch-up)
      if (fechaUltimoEnvio !== fechaHoy) {
        console.log(`[AMOR-BOT] 🔄 Recuperando mensaje perdido de ${momento} (${hora})`);
        await enviarMensaje(sock, momento);
        // Esperar 2 segundos entre mensajes si hay varios perdidos
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

// Enviar mensajes programados (3 diarios: mañana, tarde, noche)
let cronJobs = [];

export async function iniciarMensajesDiarios(sock) {
  const config = loadConfig();
  
  if (!config.target) {
    console.log('[AMOR-BOT] ❌ Sin objetivo configurado');
    return;
  }

  // 🔄 PASO 1: Verificar si hay mensajes perdidos del día (catch-up)
  console.log('[AMOR-BOT] 🔍 Verificando mensajes pendientes del día...');
  await verificarMensajesPerdidos(sock);

  // Limpiar cron jobs previos
  cronJobs.forEach(job => job.stop());
  cronJobs = [];

  // 🕐 PASO 2: Crear 3 cron jobs (mañana, tarde, noche)
  HORARIOS.forEach(({ hora, momento }) => {
    const [h, m] = hora.split(':');
    
    const job = cron.schedule(`${m} ${h} * * *`, async () => {
      await enviarMensaje(sock, momento);
    }, {
      scheduled: true,
      timezone: 'America/Bogota'
    });

    cronJobs.push(job);
  });

  console.log(`[AMOR-BOT] 💝 Sistema activo - 3 mensajes diarios:`);
  HORARIOS.forEach(({ hora, momento }) => {
    console.log(`  • ${momento.toUpperCase()}: ${hora}`);
  });
  console.log(`[AMOR-BOT] 🎯 Objetivo: ${config.nombre} (${config.target.split('@')[0]})`);
  console.log(`[AMOR-BOT] 📊 Mensajes enviados: ${config.mensajesEnviados || 0}`);
}

// ⛔ COMANDO DE PRUEBA TEMPORAL — Solo para verificar funcionamiento
export const amorCommand = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const senderId = msg.key.participant || chatId;
  
  console.log(`[AMOR-BOT] 🔍 Comando recibido de: ${senderId}`);
  
  // Extraer número real (manejar LIDs de WhatsApp)
  let senderNum = senderId.split('@')[0].split(':')[0];
  
  // Si es un LID, obtener número real desde metadata del grupo
  if (senderId.includes('@lid')) {
    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const participant = groupMetadata.participants.find(p => p.id === senderId);
      if (participant?.phoneNumber) {
        senderNum = participant.phoneNumber.toString().split('@')[0].split(':')[0];
        console.log(`[AMOR-BOT] 🔍 LID detectado, número real: ${senderNum}`);
      }
    } catch (e) {
      console.error(`[AMOR-BOT] ❌ Error obteniendo metadata: ${e.message}`);
    }
  }
  
  // Solo Carlos
  const CARLOS_NUM = '573233704652';
  console.log(`[AMOR-BOT] 🔍 Número extraído: ${senderNum}, esperado: ${CARLOS_NUM}`);
  
  if (senderNum !== CARLOS_NUM) {
    console.log(`[AMOR-BOT] ⛔ Acceso denegado a: ${senderNum}`);
    return;
  }

  console.log(`[AMOR-BOT] ✅ Acceso permitido a Carlos`);
  const subCmd = args[0]?.toLowerCase();
  console.log(`[AMOR-BOT] 📝 Subcomando: ${subCmd || '(ninguno)'}`);
  
  // !amor test — enviar mensaje de prueba AHORA
  if (subCmd === 'test') {
    await sock.sendMessage(chatId, { text: '⏳ Generando y enviando mensaje de prueba...' }, { quoted: msg });
    
    try {
      const exito = await enviarMensaje(sock, 'mañana');
      
      if (exito) {
        await sock.sendMessage(chatId, { 
          text: '✅ Mensaje de prueba enviado correctamente a +57 320 9382631' 
        }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { 
          text: '❌ Error al enviar. Revisa los logs del bot.' 
        }, { quoted: msg });
      }
    } catch (e) {
      await sock.sendMessage(chatId, { 
        text: `❌ Error: ${e.message}` 
      }, { quoted: msg });
    }
    return;
  }

  // !amor now — enviar mensaje según hora actual
  if (subCmd === 'now') {
    const ahora = new Date();
    const horaActual = ahora.getHours();
    
    console.log(`[AMOR-BOT] 🕐 !amor now ejecutado - hora: ${horaActual}:${ahora.getMinutes()}`);
    
    let momento;
    if (horaActual >= 5 && horaActual < 12) {
      momento = 'mañana';
    } else if (horaActual >= 12 && horaActual < 19) {
      momento = 'tarde';
    } else {
      momento = 'noche';
    }
    
    console.log(`[AMOR-BOT] 📝 Momento detectado: ${momento}`);
    
    await sock.sendMessage(chatId, { 
      text: `⏳ Enviando mensaje de ${momento} (hora actual: ${horaActual}:${ahora.getMinutes().toString().padStart(2,'0')})...` 
    }, { quoted: msg });
    
    try {
      const exito = await enviarMensaje(sock, momento);
      
      if (exito) {
        await sock.sendMessage(chatId, { 
          text: `✅ Mensaje de ${momento} enviado` 
        }, { quoted: msg });
      } else {
        await sock.sendMessage(chatId, { 
          text: '❌ Error al enviar' 
        }, { quoted: msg });
      }
    } catch (e) {
      console.error('[AMOR-BOT] ❌ Error en !amor now:', e);
      await sock.sendMessage(chatId, { 
        text: `❌ Error: ${e.message}` 
      }, { quoted: msg });
    }
    return;
  }

  // !amor status — ver estado
  if (subCmd === 'status' || !subCmd) {
    const config = loadConfig();
    const ahora = new Date();
    const horaActual = `${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2,'0')}`;
    
    let proximoEnvio = 'Ninguno programado';
    for (const {hora, momento} of HORARIOS) {
      const [h,m] = hora.split(':').map(Number);
      const horaNum = ahora.getHours() * 60 + ahora.getMinutes();
      const horaProg = h * 60 + m;
      if (horaNum < horaProg) {
        proximoEnvio = `${momento} a las ${hora}`;
        break;
      }
    }
    
    await sock.sendMessage(chatId, { 
      text: `💝 AMOR BOT\n\n` +
            `Estado: ✅ ACTIVO\n` +
            `Objetivo: ${config.nombre} (+${config.target.split('@')[0]})\n` +
            `Mensajes enviados: ${config.mensajesEnviados}\n` +
            `Hora actual: ${horaActual}\n` +
            `Próximo envío: ${proximoEnvio}\n\n` +
            `Horarios automáticos:\n` +
            `• Mañana: 09:00\n` +
            `• Tarde: 14:00\n` +
            `• Noche: 20:00\n\n` +
            `Comandos:\n` +
            `!amor test — mensaje de prueba\n` +
            `!amor now — enviar según hora actual\n` +
            `!amor status — ver estado`
    }, { quoted: msg });
    return;
  }

  // Comando no reconocido
  return;
};
