import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

// ==========================================
// 💝 AMOR BOT — Mensajes lindos diarios
// 100% local · sin Gemini · sin saludos de hora
// MAIN (Linux): slots 09:00 · 14:00 · 20:00
// Pool exclusivo distinto al de TERMUX
// ==========================================

const CONFIG_PATH = path.resolve(process.cwd(), 'comandos_cerbero', 'amor_config.json');

// ──────────────────────────────────────────
// 📚 MENSAJES LOCALES — Pool MAIN (Linux)
// ──────────────────────────────────────────
const MENSAJES = [
  'Pienso mucho en ti, más de lo que crees 💙',
  'Hay algo en ti que me tiene completamente atrapado.',
  'No sé exactamente qué es, pero pensar en ti me cambia el día.',
  'Eres de esas personas que uno no olvida fácilmente.',
  'Solo quería que supieras que estás en mis pensamientos.',
  'Me alegra haberte conocido, en serio.',
  'Eres importante para mí, aunque a veces no lo diga.',
  'Pienso en ti y automáticamente todo se siente mejor.',
  'No hace falta decir mucho — solo que significas mucho.',
  'Hay días que simplemente necesito mandarte un mensaje para sentirme bien.',
  'Ojalá supieras cuánto pienso en ti sin decirlo.',
  'Te valoro más de lo que imaginas.',
  'Eres algo especial en mi vida, eso no cambia.',
  'Solo pasaba a recordarte que eres muy importante para mí.',
  'Me gusta saber que existes en mi mundo 💙',
  'Pocas cosas me hacen sentir tan bien como pensar en ti.',
  'No te lo digo suficiente, pero te pienso muchísimo.',
  'Eres de esas personas que hacen que todo valga la pena.',
  'Hoy, como todos los días, mis pensamientos vuelven a ti.',
  'Contigo todo se siente diferente, de la mejor manera.',
  'Gracias por existir y por ser como eres.',
  'Me alegras sin hacer nada, solo siendo tú.',
  'No te imaginas el impacto que tienes en mí.',
  'Eres genuinamente especial, no lo olvides.',
];

// Índice rotativo para no repetir
function siguienteMensaje(config) {
  const idx = (config.msgIndex || 0) % MENSAJES.length;
  config.msgIndex = idx + 1;
  return MENSAJES[idx];
}

// ⚙️ CONFIGURACIÓN
const OBJETIVO_NUMERO = '573209382631';
const OBJETIVO_NOMBRE = 'mi reina';

const HORARIOS = [
  { hora: '09:00' },
  { hora: '14:00' },
  { hora: '20:00' },
];

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const d = { target: `${OBJETIVO_NUMERO}@s.whatsapp.net`, active: true, nombre: OBJETIVO_NOMBRE, mensajesEnviados: 0, msgIndex: 0, lastSent: {} };
    saveConfig(d); return d;
  }
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!c.target) { c.target = `${OBJETIVO_NUMERO}@s.whatsapp.net`; c.nombre = OBJETIVO_NOMBRE; }
    if (c.msgIndex === undefined) c.msgIndex = 0;
    if (!c.lastSent) c.lastSent = {};
    saveConfig(c); return c;
  } catch {
    const d = { target: `${OBJETIVO_NUMERO}@s.whatsapp.net`, active: true, nombre: OBJETIVO_NOMBRE, mensajesEnviados: 0, msgIndex: 0, lastSent: {} };
    saveConfig(d); return d;
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ──────────────────────────────────────────
// 📤 ENVÍO
// ──────────────────────────────────────────
async function enviarMensaje(sock, slot) {
  const config = loadConfig();
  try {
    const mensaje = siguienteMensaje(config);
    config.mensajesEnviados = (config.mensajesEnviados || 0) + 1;
    config.lastSent[slot] = new Date().toISOString();
    saveConfig(config);

    await sock.sendMessage(config.target, { text: mensaje });

    const CARLOS = '573233704652@s.whatsapp.net';
    await sock.sendMessage(CARLOS, { text: `�� AMOR-BOT [MAIN] slot ${slot}:\n\n${mensaje}` });

    console.log(`[AMOR-BOT][MAIN] ✅ #${config.mensajesEnviados} enviado (slot ${slot})`);
    return true;
  } catch (e) {
    console.error(`[AMOR-BOT][MAIN] ❌ Error slot ${slot}:`, e.message);
    return false;
  }
}

async function verificarPerdidos(sock) {
  const config = loadConfig();
  const ahora = new Date();
  const hoy = ahora.toISOString().split('T')[0];
  const minActual = ahora.getHours() * 60 + ahora.getMinutes();
  for (const { hora } of HORARIOS) {
    const [h, m] = hora.split(':').map(Number);
    if (minActual >= h * 60 + m) {
      const ultimo = config.lastSent?.[hora];
      if (!ultimo || !ultimo.startsWith(hoy)) {
        console.log(`[AMOR-BOT][MAIN] 🔄 Recuperando slot perdido ${hora}`);
        await enviarMensaje(sock, hora);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  }
}

// ──────────────────────────────────────────
// 🕒 CRON
// ──────────────────────────────────────────
let cronJobs = [];

export async function iniciarMensajesDiarios(sock) {
  const config = loadConfig();
  if (!config.target) { console.log('[AMOR-BOT][MAIN] ❌ Sin objetivo'); return; }

  console.log('[AMOR-BOT][MAIN] 🔍 Verificando pendientes...');
  await verificarPerdidos(sock);

  cronJobs.forEach(j => j.stop());
  cronJobs = [];

  for (const { hora } of HORARIOS) {
    const [h, m] = hora.split(':');
    const job = cron.schedule(`${m} ${h} * * *`, () => enviarMensaje(sock, hora), {
      scheduled: true, timezone: 'America/Bogota',
    });
    cronJobs.push(job);
  }

  console.log(`[AMOR-BOT][MAIN] 💝 Activo — slots: ${HORARIOS.map(x => x.hora).join(' · ')}`);
  console.log(`[AMOR-BOT][MAIN] 🎯 ${config.nombre} | enviados: ${config.mensajesEnviados}`);
}

// ──────────────────────────────────────────
// 🎮 COMANDOS
// ──────────────────────────────────────────
export const amorCommand = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const senderId = msg.key.participant || chatId;
  let senderNum = senderId.split('@')[0].split(':')[0];

  if (senderId.includes('@lid')) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const p = meta.participants.find(x => x.id === senderId);
      if (p?.phoneNumber) senderNum = p.phoneNumber.toString().split('@')[0].split(':')[0];
    } catch (_) {}
  }

  if (senderNum !== '573233704652') return;

  const sub = args[0]?.toLowerCase();

  if (sub === 'test' || sub === 'now') {
    await sock.sendMessage(chatId, { text: '⏳ Enviando...' }, { quoted: msg });
    const ok = await enviarMensaje(sock, 'manual');
    await sock.sendMessage(chatId, { text: ok ? '✅ Enviado' : '❌ Error' }, { quoted: msg });
    return;
  }

  // !amor status (default)
  const config = loadConfig();
  const ahora = new Date();
  const horaStr = `${ahora.getHours()}:${ahora.getMinutes().toString().padStart(2, '0')}`;
  let proximo = 'Ninguno hoy';
  for (const { hora } of HORARIOS) {
    const [h, m] = hora.split(':').map(Number);
    if (ahora.getHours() * 60 + ahora.getMinutes() < h * 60 + m) { proximo = hora; break; }
  }

  await sock.sendMessage(chatId, {
    text: `💝 AMOR BOT [MAIN]\n\n` +
          `Estado: ✅ ACTIVO\n` +
          `Objetivo: ${config.nombre} (+${config.target.split('@')[0]})\n` +
          `Mensajes enviados: ${config.mensajesEnviados}\n` +
          `Pool: ${MENSAJES.length} mensajes · índice ${config.msgIndex % MENSAJES.length}\n` +
          `Hora actual: ${horaStr}\n` +
          `Próximo slot: ${proximo}\n\n` +
          `Slots: ${HORARIOS.map(x => x.hora).join(' · ')}\n\n` +
          `!amor test · !amor now · !amor status`
  }, { quoted: msg });
};
