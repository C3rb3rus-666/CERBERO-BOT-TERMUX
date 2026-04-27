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
const MENSAJES = buildMessagePool('main');

function buildMessagePool(botType) {
  const pools = {
    main: {
      subjects: [
        'Pienso en ti',
        'Siempre imagino tu sonrisa',
        'Tu recuerdo aparece',
        'Siento algo especial',
        'Me sorprende cuánto',
        'Te tengo presente',
        'Tu nombre suena como una melodía',
        'Tu esencia me inspira',
        'Hay algo en ti que ilumina mi día',
        'Cada vez que pienso en ti, mi pecho se abre',
        'Me gusta imaginarte con calma',
        'Te guardo en un rincón muy tierno de mi mente',
        'Tu sonrisa se queda en mi pensamiento',
        'Tu presencia imaginada me llena de paz',
        'Tu forma de ser me inspira',
      ],
      verbs: [
        'y eso me hace querer',
        'y me invita a soñar',
        'y me inspira a cuidar',
        'y me recuerda lo valioso que eres',
        'y me anima a agradecer',
        'y me provoca una sonrisa suave',
        'y me empuja a escribirte estas palabras',
        'y me da ganas de ser mejor',
        'y me hace sentir en paz',
        'y me impulsa a valorarte más',
        'y me regala un momento dulce',
        'y me lleva a pensar en ti con ternura',
        'y me recuerda cuánto importas',
      ],
      objects: [
        'con la sencillez de un pensamiento verdadero',
        'desde el centro del corazón',
        'como un susurro amable',
        'como un gesto de ternura',
        'con todo el respeto que mereces',
        'con cariño sereno',
        'sin prisa, solo con sinceridad',
        'como un detalle pequeño y real',
        'con una calma muy dulce',
        'como un abrazo de palabras',
        'con una emoción tranquila',
        'como una brisa suave',
        'como un recuerdo bonito',
        'con una intención honesta',
        'como un regalo sencillo',
      ],
      closings: [
        'sin buscar razón',
        'desde el corazón',
        'con calma',
        'de verdad',
        'sin prisa',
        'en silencio',
        'sin que lo notes',
        'con sinceridad',
        'como nunca antes',
        'de una manera honesta',
        'como una caricia en el pensamiento',
        'sin esperar nada a cambio',
        'como una luz muy suave',
        'con la certeza de que importas',
        'desde un lugar muy tierno',
        'con suavidad',
        'con todo mi respeto',
        'como una promesa tranquila',
      ],
      templates: [
        '{subject} {verb} {object} {closing}',
        '{subject}, {verb} {object} {closing}',
        '{subject} {verb} {object}, {closing}',
        '{subject} {verb} {object} {closing} ❤️',
        '{subject}, {verb} {object}, {closing} 🌟',
        'A veces {subject} {verb} {object} {closing}',
        'Confieso que {subject} {verb} {object} {closing}',
        '{subject} {verb} {object} {closing} ✨',
      ],
    },
    termux: {
      subjects: [
        'Me alegra saber que existes',
        'Tu recuerdo hace mi día más suave',
        'Apareces en mis pensamientos de un modo bonito',
        'Tu presencia imaginada es un regalo',
        'Me gusta cómo me inspiras sin palabras',
        'Pienso en ti con una sonrisa tranquila',
        'Tu forma de ser me hace sentir bien',
        'Hay algo en ti que me calma y me alegra',
        'Siento que tu energía me acompaña',
        'Tu imagen en mi mente es luz suave',
        'Me pregunto cómo te hace sentir este mensaje',
        'Me parece hermoso recordar tu voz',
        'Tu forma de hablar se queda en mi memoria',
        'Tu mirada se siente cercana incluso lejos',
        'Tu presencia imaginada es una calma',
      ],
      verbs: [
        'y me llena el alma',
        'y me hace querer cuidarte',
        'y me invita a ser más atento',
        'y me recuerda lo especial que eres',
        'y me da una calma linda',
        'y me hace escribirte este mensaje',
        'y termina por alegrar mi corazón',
        'y me provoca una emoción bonita',
        'y me inspira a agradecerte',
        'y me anima a valorar cada instante',
        'y me hace sentirte cerca',
        'y me da ganas de ser más detallista',
        'y me hace apreciar cada gesto tuyo',
      ],
      objects: [
        'con sencillez y cariño',
        'sin grandes palabras',
        'como un abrazo suave',
        'desde un lugar honesto',
        'con dulzura tranquila',
        'como una promesa de respeto',
        'en lo profundo del pecho',
        'como un gesto verdadero',
        'en el hueco de un pensamiento tierno',
        'como una nota de afecto',
        'sin presión, solo cuidado',
        'como un detalle que no pesa',
        'con una ternura real',
        'con una emoción clara',
        'con una intención bonita',
      ],
      closings: [
        'todo el tiempo',
        'cada vez que respiro',
        'sin buscar nada',
        'como algo natural',
        'con calma y verdad',
        'aunque estemos lejos',
        'sin prisa, con ternura',
        'de forma muy sincera',
        'como algo que crece',
        'como una luz tranquila',
        'con todo mi respeto',
        'porque te mereces lo mejor',
        'dejando que fluya',
        'mientras sigues en mi pensamiento',
        'como un gesto hermoso',
        'con suavidad y cuidado',
        'con una paz muy dulce',
        'como algo que no olvido',
      ],
      templates: [
        '{subject} {verb} {object} {closing}',
        '{subject}, {verb} {object} {closing}',
        '{subject} {verb} {object}, {closing}',
        '{subject} {verb} {object} {closing} 🌹',
        '{subject}, {verb} {object}, {closing} ✨',
        'Siento que {subject} {verb} {object} {closing}',
        'Confieso que {subject} {verb} {object} {closing}',
        '{subject} perdura mientras {verb} {object} {closing}',
      ],
    },
  };

  const selected = pools[botType] || pools.main;
  const pool = new Set();
  const maxPhrases = 200000;

  for (const template of selected.templates) {
    for (const subject of selected.subjects) {
      for (const verb of selected.verbs) {
        for (const object of selected.objects) {
          for (const closing of selected.closings) {
            if (pool.size >= maxPhrases) break;
            pool.add(
              template
                .replace('{subject}', subject)
                .replace('{verb}', verb)
                .replace('{object}', object)
                .replace('{closing}', closing)
                .replace(/\s+/g, ' ')
                .trim()
            );
          }
          if (pool.size >= maxPhrases) break;
        }
        if (pool.size >= maxPhrases) break;
      }
      if (pool.size >= maxPhrases) break;
    }
    if (pool.size >= maxPhrases) break;
  }

  const array = Array.from(pool);
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}



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

  console.log('[AMOR-BOT][MAIN] 🔍 Iniciando programación sin recuperar envíos pasados');

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
