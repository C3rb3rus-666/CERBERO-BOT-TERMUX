// comandos_cerbero/admin_autonomo.js
// ─────────────────────────────────────────────────────────────────────────────
// 🤖 ADMINISTRADOR AUTÓNOMO DE GRUPOS — CERBERO-BOT
// ─────────────────────────────────────────────────────────────────────────────
// Regla 1 │ Grupo cerrado + sin actividad → abrirlo
// Regla 2 │ A las 9 AM si está cerrado    → abrirlo
// Regla 3 │ Grupo abierto + inactivo      → mencionar a todos con frase aleatoria
// Regla 4 │ A las 00 AM si está abierto + sin actividad → cerrarlo
// ─────────────────────────────────────────────────────────────────────────────

import { areJidsSameUser } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { getCounts, getCountsSinceBaseline } from '../utils/messageCounter.js';
import { fileURLToPath } from 'url';

// ── RUTAS ────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.resolve('./comandos_cerbero/configuraciones/admin_autonomo_config.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const IMAGES_DIR = path.join(__dirname, 'imagenes');

/**
 * Envía un mensaje con imagen aleatoria del bot como caption.
 * Si no hay imágenes disponibles, cae en texto plano.
 */
async function sendWithImage(sock, chatId, caption, sendOpts = {}) {
  let imagePath = null;
  try {
    const files  = await fs.promises.readdir(IMAGES_DIR);
    const images = files.filter(f => /\.(jpe?g|png)$/i.test(f));
    if (images.length > 0) {
      imagePath = path.join(IMAGES_DIR, images[Math.floor(Math.random() * images.length)]);
    }
  } catch (e) { /* sin imágenes, fallback a texto */ }
  await sock.sendPresenceUpdate('composing', chatId);
  if (imagePath) {
    await sock.sendMessage(chatId, { image: { url: imagePath }, caption }, sendOpts);
  } else {
    await sock.sendMessage(chatId, { text: caption }, sendOpts);
  }
}

// ── CONSTANTES ───────────────────────────────────────────────────────────────

/** Minutos sin mensajes para considerar el grupo inactivo */
const INACTIVITY_THRESHOLD_MS = 30 * 60 * 1000; // 30 min (antes 5 min)

/** Cada cuánto corre el ticker de revisión */
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 min (antes 5 min)

/** Cooldown mínimo entre aperturas automáticas del mismo grupo */
const OPEN_COOLDOWN_MS = 60 * 60 * 1000; // 1 h

/** Cooldown mínimo entre menciones automáticas del mismo grupo */
const MENTION_COOLDOWN_MS = 60 * 60 * 1000; // 1 h

/** Tiempo de gracia tras apertura nocturna por admin humano:
 *  si no hay actividad en este tiempo → cerrar. Si sí hay actividad → dejar pasar. */
const NIGHT_RECLOSE_GRACE_MS = 20 * 60 * 1000; // 20 min

/** Tiempo que el bot difiere al admin humano tras cualquier acción suya.
 *  Durante este periodo el bot NO etiqueta ni toma decisiones no solicitadas. */
const HUMAN_ADMIN_DEFERENCE_MS = 30 * 60 * 1000; // 30 min

/** Ventana de tiempo para considerar a un admin como "activo" en el grupo.
 *  Si envió al menos un mensaje en este periodo = activo. */
const ADMIN_ACTIVE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 h

/** Días sin hablar para considerar a alguien fantasma */
const GHOST_DAYS = 3;
const GHOST_THRESHOLD_MS = GHOST_DAYS * 24 * 60 * 60 * 1000;

/** Cooldown mínimo entre avisos de fantasmas del mismo grupo */
const GHOST_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 1 vez al día por grupo

/** Máximo de fantasmas que se etiquetan por ciclo (anti-spam) */
const GHOST_MAX_PER_CYCLE = 15;

/** Cada cuánto escanea recent_joins.json buscando bienvenidas pendientes */
const WELCOME_SCAN_INTERVAL_MS = 2 * 60 * 1000; // 2 min

/** Tiempo mínimo que debe tener una entrada antes de procesarla
 *  (da margen a welcome.js para escribir el archivo) */
const WELCOME_MIN_AGE_MS = 20_000; // 20 s

/** Zona horaria de referencia */
const TIMEZONE = 'America/Bogota';
const BOGOTA_HOUR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: TIMEZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

/** Hora a la que se abre el grupo si está cerrado */
const AUTO_OPEN_HOUR  = 9;

/** Hora a la que se cierra el grupo si está abierto y sin actividad */
const AUTO_CLOSE_HOUR = 0;

/** Footer de marca */
const BRAND_FOOTER = '✦ IA Autónoma · Administradora de Grupos · Coded By C3rb3rus-666 carlos sanchez ✦';

// ── FRASES DE ACTIVACIÓN ─────────────────────────────────────────────────────

const FRASES_ACTIVACION = [
  'ola digan ola 👀',
  'despierten vagos',
  'el que no hable en los próximos 5 min lo dejo off ',
  'hablen que ya me aburrí de hablar solo como bot',
  'denme una razón para no dejarlos off perma como bot',
  'si no hablan asumo que  les gusta el pito',
];

/** Amenazas random para los fantasmas detectados por REGLA 5 */
const FRASES_FANTASMA = [
  'hablen o se muere su mamá 💀',
  'hablen o mañana no les crece el pito 📏',
  'llevan días callados, su mamá sí que los parió mudos',
  'si no hablan se van off',
  'tanto silencio y siguen en el grupo, qué cara más dura 😐',
  'hablen o les borro el WiFi',
  'hablen o les mando a su mamá el historial de búsqueda 🔍😭',
  'si no hablan los voy a etiquetar hasta que les duela el teléfono 📲',
];

// ── ESTADO EN MEMORIA ─────────────────────────────────────────────────────────

/** Último timestamp en que se abrió automáticamente cada grupo */
const lastOpenTs = new Map();

/** Último timestamp en que se cerró automáticamente cada grupo */
const lastCloseTs = new Map();

/** Último timestamp en que se mencionó automáticamente cada grupo */
const lastMentionTs = new Map();

/** Último timestamp en que se ejecutó el cazador de fantasmas por grupo */
const lastGhostScanTs = new Map();

/** Última acción de un admin humano (no el bot) por grupo: { ts, jid, action: 'open'|'close' }
 *  El bot difiere decisiones mientras esto sea reciente (< HUMAN_ADMIN_DEFERENCE_MS). */
const lastHumanAdminActionTs = new Map();

/** Timers del Night Watch: re-cierre diferido si un admin abre de noche y no hay actividad. */
const pendingNightRecloseTimers = new Map();

/** Timestamp de cuando un admin cerró manualmente el grupo durante el día.
 *  REGLA 1 no reabre hasta que expire (= HUMAN_ADMIN_DEFERENCE_MS). */
const lastManualCloseTs = new Map();

/** Grupos donde el bot es el ÚNICO administrador (no quedan admins humanos).
 *  En este modo el bot NO difiere a ningún admin y actúa con control pleno. */
const soloModeGroups = new Set();

/** Handle del setInterval del scanner de bienvenidas */
let _welcomeScannerInterval = null;

// ── CONFIG HELPERS ────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch (e) {
    console.error('[ADMIN-AUTO] Error leyendo config:', e.message);
  }
  return { enabled_groups: {} };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[ADMIN-AUTO] Error guardando config:', e.message);
  }
}

// ── UTILIDADES ────────────────────────────────────────────────────────────────

/**
 * Hora actual en Colombia (0–23).
 */
function getHoraColombia() {
  const hourPart = BOGOTA_HOUR_FORMATTER.formatToParts(new Date())
    .find(part => part.type === 'hour')?.value;
  return Number.parseInt(hourPart || '0', 10);
}

/**
 * Devuelve true si la hora está en la ventana NOCTURNA (00:00–08:59 COT).
 * Durante la noche: el grupo permanece cerrado sin que ninguna regla
 * lo abra ni etiquete. Solo REGLA 4 (cierre) y REGLA 2 (apertura a las 9h)
 * activan en sus horas exactas.
 */
function isNighttime(hora) {
  return hora >= 0 && hora < AUTO_OPEN_HOUR; // 0–8
}

/**
 * Devuelve el timestamp del mensaje más reciente en el grupo,
 * consultando el store de messageCounter.
 */
async function getLastActivityTs(chatId) {
  const counts = await getCounts(chatId);
  let maxTs = 0;
  for (const entry of Object.values(counts)) {
    if ((entry?.lastTs || 0) > maxTs) maxTs = entry.lastTs;
  }
  return maxTs;
}

/**
 * Igual que getLastActivityTs pero EXCLUYE los JIDs dados (admins + bot).
 * Se usa en REGLA 3 para medir inactividad de miembros ordinarios:
 * si solo los admins hablan pero los miembros callan → etiqueta igual.
 */
async function getMemberLastActivityTs(chatId, excludeJids) {
  const counts = await getCounts(chatId);
  const excludeShorts = new Set(
    (excludeJids || []).map(j => (j || '').split('@')[0].split(':')[0]).filter(Boolean)
  );
  let maxTs = 0;
  for (const [jid, entry] of Object.entries(counts)) {
    const short = jid.split('@')[0].split(':')[0];
    if (excludeShorts.has(short)) continue;
    if ((entry?.lastTs || 0) > maxTs) maxTs = entry.lastTs;
  }
  return maxTs;
}

/**
 * Clasifica los admins humanos del grupo en activos e inactivos
 * según si enviaron mensajes en las últimas 24 horas.
 * Devuelve { active: [], inactive: [] } con objetos participante de Baileys.
 */
async function _getAdminStatus(chatId, groupMetadata, botJid) {
  const participants = groupMetadata?.participants || [];
  const humanAdmins  = participants.filter(
    p => p.admin && !areJidsSameUser(p.id, botJid)
  );
  if (humanAdmins.length === 0) return { active: [], inactive: [] };

  const counts = await getCounts(chatId);
  const now    = Date.now();
  const active   = [];
  const inactive = [];

  for (const admin of humanAdmins) {
    // Buscar en counts con TODOS los formatos posibles:
    // 1. admin.id directo (puede ser @lid o @s.whatsapp.net)
    // 2. phoneNumber@s.whatsapp.net si está disponible
    // 3. Parte numérica del LID como @lid
    const jidDirect = admin.id || '';
    const short = jidDirect.split('@')[0].split(':')[0];
    
    // Intentar todas las variantes
    let entry = counts[jidDirect];  // ej: "123456@lid" o "573001234567@s.whatsapp.net"
    
    if (!entry && admin.phoneNumber) {
      const phoneClean = admin.phoneNumber.toString().split('@')[0].split(':')[0];
      entry = counts[`${phoneClean}@s.whatsapp.net`] || counts[`${phoneClean}@lid`];
    }
    
    if (!entry) {
      // Buscar por coincidencia parcial del short en cualquier key del grupo
      for (const [key, val] of Object.entries(counts)) {
        const keyShort = key.split('@')[0].split(':')[0];
        if (keyShort === short) {
          entry = val;
          break;
        }
      }
    }
    
    const lastTs = entry?.lastTs || 0;
    // DEBUG: mostrar qué encontramos para cada admin
    console.log(`[ADMIN-AUTO] 👤 Admin ${short}: entry=${entry ? 'FOUND' : 'NOT_FOUND'}, lastTs=${lastTs > 0 ? Math.floor((now - lastTs)/60000) + 'min ago' : 'never'}`);
    
    if (lastTs > 0 && (now - lastTs) < ADMIN_ACTIVE_THRESHOLD_MS) {
      active.push(admin);
    } else {
      inactive.push(admin);
    }
  }
  return { active, inactive };
}

/**
 * Envía un mensaje que menciona a todos los miembros del grupo.
 * Versión autónoma (sin `msg` de origen): el bot es el emisor.
 * @param {object|null} adminStatus  Resultado de _getAdminStatus() — si se pasa,
 *                                   añade un encabezado mostrando admins activos/inactivos.
 */
async function mencionarTodos(sock, chatId, groupMetadata, frase, adminStatus = null) {
  try {
    const participants = groupMetadata?.participants || [];
    const mentions = participants
      .filter(p => !areJidsSameUser(p.id, sock.user.id))
      .map(p => {
        // Preferir número real si el id es un LID (@lid)
        if (p.phoneNumber && typeof p.phoneNumber === 'string' && p.phoneNumber.includes('@s.whatsapp.net')) return p.phoneNumber;
        if (p.id && p.id.includes('@s.whatsapp.net')) return p.id;
        // LID: intentar reconstruir con phoneNumber
        if (p.phoneNumber) return `${p.phoneNumber.toString().split('@')[0]}@s.whatsapp.net`;
        return p.id; // fallback
      });

    if (mentions.length === 0) return;

    // ── Encabezado de estado de admins (solo si se detectó al menos un admin humano) ─
    let adminHeader = '';
    if (adminStatus && (adminStatus.active.length > 0 || adminStatus.inactive.length > 0)) {
      // Mostrar número teléfono real en vez del LID cuando esté disponible
      const fmtJid = p => {
        if (p.phoneNumber) {
          const num = p.phoneNumber.toString().split('@')[0].split(':')[0];
          return `@${num}`;
        }
        return `@${(p.id || '').split('@')[0].split(':')[0]}`;
      };
      const activos  = adminStatus.active.length   > 0 ? adminStatus.active.map(fmtJid).join(', ')   : '—';
      const inactivos = adminStatus.inactive.length > 0 ? adminStatus.inactive.map(fmtJid).join(', ') : '—';
      adminHeader =
        `╭──────────────────────────╮
` +
        `│  👮  ADMIN STATUS (24h)  👮  │
` +
        `╰──────────────────────────╯
` +
        `▸ 🟢 ACTIVOS   : ${activos}\n` +
        `▸ 🔴 INACTIVOS : ${inactivos}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    }

    const texto = `${adminHeader}${frase}\n\n${mentions.map(id => `@${id.split('@')[0]}`).join(' ')}`;

    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, { text: texto, mentions });
    console.log(`[ADMIN-AUTO] 📣 Mención enviada en ${chatId} → "${frase}"`);
  } catch (e) {
    console.error(`[ADMIN-AUTO] Error mencionando en ${chatId}:`, e.message);
  }
}

// ── DIAGNÓSTICO ──────────────────────────────────────────────────────────────

/**
 * Devuelve el estado actual del grupo relevante para el admin autónomo.
 * Útil para el subcomando `!autonomo test`.
 */
async function diagnosticarEstado(sock, chatId) {
  const now          = Date.now();
  const horaColombia = getHoraColombia();

  let groupMetadata;
  try {
    groupMetadata = await sock.groupMetadata(chatId);
  } catch (e) { return null; }

  const isClosed     = groupMetadata.announce === true;
  const lastActivity = await getLastActivityTs(chatId);
  const sinceMs      = now - lastActivity;
  const isInactive   = lastActivity === 0 || sinceMs > INACTIVITY_THRESHOLD_MS;
  const minsSin      = lastActivity === 0 ? null : Math.floor(sinceMs / 60_000);

  const isNight = isNighttime(horaColombia);

  // Reglas que dispararían ahora (ignorando cooldown)
  const disparos = [];
  if (isNight && !isClosed)
    disparos.push('RULE[0] → night_guard (re-cierre nocturno en 15 min)');
  if (isClosed && isInactive && !isNight)
    disparos.push('RULE[1] → unlock (idle, día)');
  if (horaColombia === AUTO_OPEN_HOUR && isClosed)
    disparos.push(`RULE[2] → unlock (0${AUTO_OPEN_HOUR}:00 COT)`);
  if (!isClosed && isInactive && !isNight)
    disparos.push('RULE[3] → full-tag (día)');
  if (horaColombia === AUTO_CLOSE_HOUR && !isClosed && isInactive)
    disparos.push('RULE[4] → lock (00:00 COT)');
  if (isNight)
    disparos.push('⛔ MODO NOCHE — RULE[1/3/5] suspendidas hasta las 09:00');

  return { isClosed, isInactive, isNight, sinceMs, minsSin, horaColombia, disparos, lastActivity };
}

// ── EJECUCIÓN FORZADA (test) ────────────────────────────────────────────

/**
 * Ejecuta las acciones del ticker ignorando cooldowns, inactividad y hora.
 * Si el grupo está CERRADO → lo abre (RULE 1).
 * Si el grupo está ABIERTO → menciona a todos (RULE 3) y lo cierra (RULE 4).
 * Devuelve array de strings con las acciones ejecutadas.
 */
async function forzarTickGrupo(sock, chatId) {
  let groupMetadata;
  try {
    groupMetadata = await sock.groupMetadata(chatId);
  } catch (e) {
    throw new Error(`No se pudo obtener metadata: ${e.message}`);
  }

  const isClosed = groupMetadata.announce === true;
  const now = Date.now();
  const ts  = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
  const acciones = [];

  if (isClosed) {
    // — Forzar apertura (simula RULE 1)
    await sock.groupSettingUpdate(chatId, 'not_announcement');
    lastOpenTs.set(chatId, now);
    const avisoAbrir =
      `╔══════════════════════════╗\n` +
      `║  ⚡  C3RB3RUS :: FORCE_EXEC  ⚡  ║\n` +
      `╚══════════════════════════╝\n` +
      `▸ PROC    : group_lockd.unlock()\n` +
      `▸ TRIGGER : force_test — bypass_all\n` +
      `▸ TS      : ${ts}\n` +
      `▸ STATUS  : UNLOCKED ✓\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🔓 La IA autónoma ha ABIERTO el grupo (test forzado).\n` +
      `   Los miembros ya pueden escribir libremente.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      BRAND_FOOTER;
    await sendWithImage(sock, chatId, avisoAbrir);
    acciones.push('RULE[1] → grupo ABIERTO ✓');
    console.log(`[ADMIN-AUTO] ⚡ FORCE: ${chatId} abierto (test)`);
  } else {
    // — Forzar mención (simula RULE 3)
    const frase = FRASES_ACTIVACION[Math.floor(Math.random() * FRASES_ACTIVACION.length)];
    await mencionarTodos(sock, chatId, groupMetadata, frase);
    lastMentionTs.set(chatId, now);
    acciones.push('RULE[3] → menciones enviadas ✓');
    console.log(`[ADMIN-AUTO] ⚡ FORCE: ${chatId} menciones (test)`);

    // — Forzar cierre (simula RULE 4)
    await sock.groupSettingUpdate(chatId, 'announcement');
    lastCloseTs.set(chatId, now);
    const avisoTs = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
    const avisoCerrar =
      `╔══════════════════════════╗\n` +
      `║  ⚡  C3RB3RUS :: FORCE_EXEC  ⚡  ║\n` +
      `╚══════════════════════════╝\n` +
      `▸ PROC    : daily_scheduler.run()\n` +
      `▸ TRIGGER : force_test — bypass_all\n` +
      `▸ TS      : ${avisoTs}\n` +
      `▸ STATUS  : LOCKED ✓\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🌙 La IA autónoma ha CERRADO el grupo (test forzado).\n` +
      `   Solo los admins pueden escribir hasta las 9 AM.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      BRAND_FOOTER;
    await sendWithImage(sock, chatId, avisoCerrar);
    acciones.push('RULE[4] → grupo CERRADO ✓');
    console.log(`[ADMIN-AUTO] ⚡ FORCE: ${chatId} cerrado (test)`);
  }

  return acciones;
}

// ── TICKER PRINCIPAL ──────────────────────────────────────────────────────────

async function tickerAdminAutonomo(sock) {
  const config = loadConfig();
  const enabledGroups = Object.keys(config.enabled_groups || {}).filter(
    id => config.enabled_groups[id]
  );

  if (enabledGroups.length === 0) return;

  const now = Date.now();
  const horaColombia = getHoraColombia();

  for (const chatId of enabledGroups) {
    try {
      // ── Obtener metadata fresca del grupo ──────────────────────────────
      let groupMetadata;
      try {
        groupMetadata = await sock.groupMetadata(chatId);
      } catch (e) {
        console.error(`[ADMIN-AUTO] No se pudo obtener metadata de ${chatId}:`, e.message);
        continue;
      }

      const isClosed     = groupMetadata.announce === true;
      const lastActivity = await getLastActivityTs(chatId);
      const sinceMs      = now - lastActivity;
      const isInactive   = lastActivity === 0 || sinceMs > INACTIVITY_THRESHOLD_MS;
      const minsSin      = lastActivity === 0 ? '∞' : Math.floor(sinceMs / 60_000);

      // JIDs a excluir al medir inactividad de miembros: bot + todos los admins
      const adminAndBotJids = (groupMetadata.participants || [])
        .filter(p => p.admin || areJidsSameUser(p.id, sock.user.id))
        .map(p => p.id);
      const lastMemberActivity = await getMemberLastActivityTs(chatId, adminAndBotJids);
      const memberSinceMs      = now - lastMemberActivity;
      // Miembros inactivos: nunca hablaron O llevan más de INACTIVITY_THRESHOLD_MS sin mensaje
      const isMembersInactive  = lastMemberActivity === 0 || memberSinceMs > INACTIVITY_THRESHOLD_MS;

      const modoNoche = isNighttime(horaColombia);
      const memberMinsLog = lastMemberActivity === 0 ? '∞' : Math.floor(memberSinceMs / 60_000);
      const lastMentionCd = lastMentionTs.get(chatId) || 0;
      const mentionCdLeft = Math.max(0, Math.floor((MENTION_COOLDOWN_MS - (now - lastMentionCd)) / 60_000));
      console.log(`[ADMIN-AUTO] 🔄 tick ${chatId.split('@')[0]} | ${isClosed ? 'CERRADO🔒' : 'ABIERTO🔓'} | idle=${minsSin}min | miembros_idle=${memberMinsLog}min | inactivo=${isInactive} | miembros_inactivos=${isMembersInactive} | mention_cd=${mentionCdLeft}min | ${modoNoche ? '🌙noche' : '☀️día'}`);

      // ── REGLA 0: Night Guard (fallback de ticker) ──────────────────────
      // Solo activa si el grupo está abierto de noche Y el evento no lo
      // está manejando ya (no hay timer pendiente del Night Watch).
      // Si hay actividad reciente → alguien abrió con razón, respetar.
      // Si no hay actividad → nadie habló, cerrar silenciosamente.
      if (modoNoche && !isClosed && !pendingNightRecloseTimers.has(chatId)) {
        const hasRecentActivity = lastActivity > 0 && sinceMs < NIGHT_RECLOSE_GRACE_MS;
        if (hasRecentActivity) {
          // Gente hablando de noche → no intervenir, REGLA 4 lo cerrará cuando se calme
          console.log(`[ADMIN-AUTO] 🌙 REGLA 0 skip: ${chatId} abierto de noche con actividad (${Math.floor(sinceMs/60000)} min ago)`);
        } else {
          // Sin actividad: el grupo lleva tiempo abierto de noche sin que nadie hable
          try {
            await sock.groupSettingUpdate(chatId, 'announcement');
            lastCloseTs.set(chatId, now);
            const tsNR = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
            const avisoNR =
              `╔══════════════════════════╗\n` +
              `║  🌙  C3RB3RUS :: NIGHT_GUARD  🌙  ║\n` +
              `╚══════════════════════════╝\n` +
              `▸ PROC    : night_guard.idle_close()\n` +
              `▸ TRIGGER : open_night_no_activity\n` +
              `▸ TS      : ${tsNR}\n` +
              `▸ STATUS  : LOCKED ✓\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🌙 El grupo estaba abierto de noche sin actividad.\n` +
              `   Cerrando hasta las 9 AM 💤\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              BRAND_FOOTER;
            await sendWithImage(sock, chatId, avisoNR);
            console.log(`[ADMIN-AUTO] 🌙 REGLA 0: ${chatId} cerrado (abierto de noche sin actividad)`);
          } catch (eNR) {
            console.error(`[ADMIN-AUTO] Error en REGLA 0 ${chatId}:`, eNR.message);
          }
        }
      }

      // ── REGLA 1: cerrado + sin actividad → abrir ───────────────────────
      // ⛔ NO dispara de noche (00:00–08:59): REGLA 4 cerró el grupo a propósito.
      // ⛔ NO dispara si un admin lo cerró manualmente de día (respeto 2h).
      //    REGLA 2 (cron de las 9h) se encarga de reabrirlo.
      const lastManualClose = lastManualCloseTs.get(chatId) || 0;
      // En solo mode no hay admins humanos que respetar → saltar deferencia
      const adminClosedRecently = !soloModeGroups.has(chatId) && (now - lastManualClose) < HUMAN_ADMIN_DEFERENCE_MS;
      
      // DEBUG: Mostrar por qué REGLA 1 no dispara
      if (isClosed && !isInactive) {
        console.log(`[ADMIN-AUTO] ⏭ REGLA 1 skip: ${chatId} cerrado pero HAY ACTIVIDAD reciente (idle=${minsSin}min < 5min)`);
      } else if (isClosed && isNighttime(horaColombia)) {
        console.log(`[ADMIN-AUTO] ⏭ REGLA 1 skip: ${chatId} cerrado pero es de noche`);
      } else if (isClosed && adminClosedRecently) {
        const deferMinsLeft = Math.floor((HUMAN_ADMIN_DEFERENCE_MS - (now - lastManualClose)) / 60000);
        console.log(`[ADMIN-AUTO] ⏭ REGLA 1 skip: ${chatId} admin cerró manualmente hace poco (${deferMinsLeft}min de respeto restantes)`);
      }
      
      if (isClosed && isInactive && !isNighttime(horaColombia) && !adminClosedRecently) {
        const lastOpen = lastOpenTs.get(chatId) || 0;
        if (now - lastOpen > OPEN_COOLDOWN_MS) {
          await sock.groupSettingUpdate(chatId, 'not_announcement');
          lastOpenTs.set(chatId, now);
          const mins = Math.floor(sinceMs / 60_000);
          const ts1  = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
          const trigger1 = lastActivity === 0 ? 'no_activity_record' : `idle_${mins}m — threshold_exceeded`;
          const aviso =
            `╔══════════════════════════╗\n` +
            `║  🔓  C3RB3RUS :: ACCESS_CTL  🔓  ║\n` +
            `╚══════════════════════════╝\n` +
            `▸ PROC    : group_lockd.unlock()\n` +
            `▸ TRIGGER : ${trigger1}\n` +
            `▸ TS      : ${ts1}\n` +
            `▸ STATUS  : UNLOCKED ✓\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🔓 La IA autónoma ha ABIERTO el grupo por inactividad.\n` +
            `   Los miembros ya pueden escribir libremente.\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            BRAND_FOOTER;
          await sendWithImage(sock, chatId, aviso);
          console.log(`[ADMIN-AUTO] 🔓 REGLA 1: ${chatId} abierto (${mins} min inactivo)`);
        }
      }

      // ── REGLA 2: son las 9 AM y está cerrado → abrir ───────────────────
      if (horaColombia === AUTO_OPEN_HOUR && isClosed) {
        const lastOpen = lastOpenTs.get(chatId) || 0;
        if (now - lastOpen > OPEN_COOLDOWN_MS) {
          await sock.groupSettingUpdate(chatId, 'not_announcement');
          lastOpenTs.set(chatId, now);
          const ts2 = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
          const aviso2 =
              `╔══════════════════════════╗\n` +
              `║  🌅  C3RB3RUS :: CRON_DAEMON  🌅  ║\n` +
              `╚══════════════════════════╝\n` +
              `▸ PROC    : daily_scheduler.run()\n` +
              `▸ TRIGGER : 0${AUTO_OPEN_HOUR}:00 COT — cron.d/daily\n` +
              `▸ TS      : ${ts2}\n` +
              `▸ STATUS  : UNLOCKED ✓\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🌅 La IA autónoma ha ABIERTO el grupo — apertura matutina.\n` +
              `   Buenos días, ya pueden escribir con normalidad.\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              BRAND_FOOTER;
          await sendWithImage(sock, chatId, aviso2);
          console.log(`[ADMIN-AUTO] 🌅 REGLA 2: ${chatId} abierto (9 AM Colombia)`);
        }
      }

      // ── REGLA 3: abierto + miembros inactivos → mencionar a todos ──────
      // ⛔ NO dispara de noche (00:00–08:59): nadie debe recibir etiquetas nocturnas.
      // ✅ Usa isMembersInactive (excluye admins+bot): si solo los admins hablan
      //    pero los miembros callan → igual etiqueta. Muestra estado de admins.
      
      // DEBUG: Mostrar por qué REGLA 3 no dispara
      if (isClosed) {
        console.log(`[ADMIN-AUTO] ⏭ REGLA 3 skip: ${chatId} está CERRADO🔒 (REGLA 3 necesita grupo abierto)`);
      } else if (!isMembersInactive) {
        console.log(`[ADMIN-AUTO] ⏭ REGLA 3 skip: ${chatId} miembros ACTIVOS (idle=${memberMinsLog}min < 5min)`);
      } else if (isNighttime(horaColombia)) {
        console.log(`[ADMIN-AUTO] ⏭ REGLA 3 skip: ${chatId} es de noche`);
      }
      
      if (!isClosed && isMembersInactive && !isNighttime(horaColombia)) {
        const lastMention = lastMentionTs.get(chatId) || 0;
        const cdRemaining = MENTION_COOLDOWN_MS - (now - lastMention);
        if (cdRemaining > 0) {
          console.log(`[ADMIN-AUTO] ⏳ REGLA 3 skip: ${chatId} cooldown activo (${Math.floor(cdRemaining/60000)}min restantes)`);
        }
        if (now - lastMention > MENTION_COOLDOWN_MS) {
          const frase       = FRASES_ACTIVACION[Math.floor(Math.random() * FRASES_ACTIVACION.length)];
          const adminStatus = await _getAdminStatus(chatId, groupMetadata, sock.user.id);
          await mencionarTodos(sock, chatId, groupMetadata, frase, adminStatus);
          lastMentionTs.set(chatId, now);
          const memberMins = lastMemberActivity === 0 ? '∞' : Math.floor(memberSinceMs / 60_000);
          console.log(`[ADMIN-AUTO] 💬 REGLA 3: mención en ${chatId} (miembros idle=${memberMins}m, admins activos: ${adminStatus.active.length}, inactivos: ${adminStatus.inactive.length})`);
        }
      }

      // ── REGLA 4: medianoche + abierto + sin actividad → cerrar ─────────
      if (horaColombia === AUTO_CLOSE_HOUR && !isClosed && isInactive) {
        const lastClose = lastCloseTs.get(chatId) || 0;
        if (now - lastClose > OPEN_COOLDOWN_MS) {
          await sock.groupSettingUpdate(chatId, 'announcement');
          lastCloseTs.set(chatId, now);
          const ts4 = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
          const aviso4 =
            `╔══════════════════════════╗\n` +
            `║  🌙  C3RB3RUS :: CRON_DAEMON  🌙  ║\n` +
            `╚══════════════════════════╝\n` +
            `▸ PROC    : daily_scheduler.run()\n` +
            `▸ TRIGGER : 00:00 COT — cron.d/nightly\n` +
            `▸ TS      : ${ts4}\n` +
            `▸ STATUS  : LOCKED ✓\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🌙 La IA autónoma ha CERRADO el grupo por inactividad nocturna.\n` +
            `   Solo los admins pueden escribir hasta las 9 AM.\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            BRAND_FOOTER;
          await sendWithImage(sock, chatId, aviso4);
          console.log(`[ADMIN-AUTO] 🌙 REGLA 4: ${chatId} cerrado (medianoche, sin actividad)`);
        }
      }

      // ── REGLA 5: cazador de fantasmas ──────────────────────────────────
      // Detecta miembros que llevan +3 días sin hablar ni un solo mensaje
      // y los etiqueta públicamente. Máx una vez al día por grupo.
      const lastGhostScan = lastGhostScanTs.get(chatId) || 0;
      // ⛔ No molestar de noche: el ghost-scan solo corre de día
      // ⛔ No etiquetar si grupo CERRADO: la gente no puede responder
      if (now - lastGhostScan > GHOST_COOLDOWN_MS && !isNighttime(horaColombia) && !isClosed) {
        try {
          const countsSince = await getCountsSinceBaseline(chatId);
          const participants = groupMetadata?.participants || [];

          // Normalizar JID de participante (evitar LIDs)
          const resolveJid = (p) => {
            if (p.phoneNumber && typeof p.phoneNumber === 'string' && p.phoneNumber.includes('@s.whatsapp.net')) return p.phoneNumber;
            if (p.id && p.id.includes('@s.whatsapp.net')) return p.id;
            if (p.phoneNumber) return `${p.phoneNumber.toString().split('@')[0]}@s.whatsapp.net`;
            return p.id;
          };

          const ghosts = participants
            .filter(p => {
              // Excluir bot y admins
              if (areJidsSameUser(p.id, sock.user.id)) return false;
              if (p.admin) return false;
              const short = (p.id || '').split('@')[0];
              // Buscar en el contador (puede estar bajo id o phoneNumber)
              const entry = countsSince[p.id] || countsSince[`${short}@s.whatsapp.net`] || null;
              const lastTs = entry?.lastTs || 0;
              const count  = entry?.countSinceJoin || entry?.total || 0;
              // Fantasma: nunca habló O su último mensaje fue hace +GHOST_DAYS días
              if (count === 0) return true;
              return (now - lastTs) > GHOST_THRESHOLD_MS;
            })
            .slice(0, GHOST_MAX_PER_CYCLE)
            .map(p => resolveJid(p))
            .filter(Boolean);

          if (ghosts.length > 0) {
            lastGhostScanTs.set(chatId, now);
            const tsG = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
            const tags = ghosts.map(id => `@${id.split('@')[0]}`).join(' ');
            const fraseG = FRASES_FANTASMA[Math.floor(Math.random() * FRASES_FANTASMA.length)];
            const avisoGhost =
              `╔══════════════════════════╗\n` +
              `║  👻  C3RB3RUS :: GHOST_SCAN  👻  ║\n` +
              `╚══════════════════════════╝\n` +
              `▸ PROC    : ghost_detector.run()\n` +
              `▸ TRIGGER : idle_${GHOST_DAYS}d — no_activity\n` +
              `▸ TS      : ${tsG}\n` +
              `▸ STATUS  : ${ghosts.length} GHOST(S) DETECTED\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `${tags}\n\n` +
              `👻 Llevan más de *${GHOST_DAYS} días* sin hablar en el grupo.\n` +
              `   ${fraseG}\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              BRAND_FOOTER;
            await sock.sendPresenceUpdate('composing', chatId);
            await sock.sendMessage(chatId, { text: avisoGhost, mentions: ghosts });
            console.log(`[ADMIN-AUTO] 👻 REGLA 5: ${ghosts.length} fantasma(s) etiquetado(s) en ${chatId}`);
          } else {
            // No hay fantasmas — actualizar cooldown igualmente para no revisar
            // de nuevo hasta mañana
            lastGhostScanTs.set(chatId, now);
          }
        } catch (eG) {
          console.error(`[ADMIN-AUTO] Error en REGLA 5 (ghosts) ${chatId}:`, eG.message);
        }
      }
    } catch (e) {
      console.error(`[ADMIN-AUTO] Error procesando ${chatId}:`, e.message);
    }
  }
}

// ── SOLO MODE / TEAM MODE ─────────────────────────────────────────────────────

/**
 * Evalúa si el bot queda como único administrador del grupo y actualiza
 * `soloModeGroups` en consecuencia. Anuncia la transición una sola vez.
 * Solo actúa en grupos con admin autónomo habilitado.
 */
async function _syncSoloMode(sock, chatId) {
  const config = loadConfig();
  if (!config.enabled_groups?.[chatId]) return;

  let groupMetadata;
  try { groupMetadata = await sock.groupMetadata(chatId); } catch (e) { return; }

  const botJid = sock.user.id;

  // Verificar que el bot sigue siendo admin (si fue desbloqueado, no puede actuar)
  const botMember = (groupMetadata.participants || []).find(p => areJidsSameUser(p.id, botJid));
  if (!botMember?.admin) {
    soloModeGroups.delete(chatId);
    return;
  }

  // Admins humanos = admins que NO son el bot
  const humanAdmins = (groupMetadata.participants || []).filter(
    p => p.admin && !areJidsSameUser(p.id, botJid)
  );

  const wasSolo  = soloModeGroups.has(chatId);
  const isSoloNow = humanAdmins.length === 0;
  const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });

  if (isSoloNow && !wasSolo) {
    // ── Transición → SOLO MODE ───────────────────────────────────────────
    soloModeGroups.add(chatId);
    const aviso =
      `╔══════════════════════════╗\n` +
      `║  🤖  C3RB3RUS :: SOLO_MODE  🤖  ║\n` +
      `╚══════════════════════════╝\n` +
      `▸ PROC    : authority.transition()\n` +
      `▸ TRIGGER : no_human_admin_left\n` +
      `▸ TS      : ${ts}\n` +
      `▸ STATUS  : STANDALONE ✓\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤖 No quedan administradores humanos en el grupo.\n` +
      `   La IA autónoma asume control completo 🛡\n\n` +
      `   Seguiré administrando sin interrupciones:\n` +
      `   📌 Abrir y cerrar en horario\n` +
      `   📌 Etiquetar inactivos\n` +
      `   📌 Detectar fantasmas (+3 días sin hablar)\n` +
      `   📌 Dar bienvenida a nuevos miembros\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      BRAND_FOOTER;
    await sendWithImage(sock, chatId, aviso);
    console.log(`[ADMIN-AUTO] 🤖 SOLO_MODE activado: ${chatId} — sin admins humanos`);

  } else if (!isSoloNow && wasSolo) {
    // ── Transición → TEAM MODE (volvió un admin humano) ──────────────────
    soloModeGroups.delete(chatId);
    const names    = humanAdmins.map(p => `@${(p.id || '').split('@')[0].split(':')[0]}`).join(', ');
    const mentions = humanAdmins.map(p => p.id).filter(Boolean);
    const aviso =
      `╔══════════════════════════╗\n` +
      `║  🤝  C3RB3RUS :: TEAM_MODE  🤝  ║\n` +
      `╚══════════════════════════╝\n` +
      `▸ PROC    : authority.transition()\n` +
      `▸ TRIGGER : human_admin_available\n` +
      `▸ TS      : ${ts}\n` +
      `▸ STATUS  : COOPERATIVE ✓\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤝 ${names} — bienvenid${humanAdmins.length > 1 ? 'os al equipo' : 'o al equipo'}.\n` +
      `   Activo en modo cooperativo: trabajamos juntos 🤖\n` +
      `   Mis decisiones respetan las tuyas 👌\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      BRAND_FOOTER;
    await sock.sendPresenceUpdate('composing', chatId);
    await sock.sendMessage(chatId, { text: aviso, mentions });
    console.log(`[ADMIN-AUTO] 🤝 TEAM_MODE activado: ${chatId} — ${humanAdmins.length} admin(s) humano(s)`);
  }
  // Si no hubo cambio de modo, no hacer nada
}

/**
 * Llamado desde index.js en group-participants.update para acciones:
 *   remove, leave → alguien salió/fue expulsado (puede ser admin)
 *   demote        → alguien perdió el rol de admin
 *   promote       → alguien ganó el rol de admin (puede sacar al bot del modo solo)
 *
 * Re-evalúa el estado de administradores y activa/desactiva SOLO_MODE.
 */
export async function onAdminChange(sock, update) {
  const chatId = update.id;
  if (!chatId?.endsWith('@g.us')) return;
  // Dar tiempo a Baileys para procesar la actualización antes de pedir metadata
  await new Promise(r => setTimeout(r, 1500));
  await _syncSoloMode(sock, chatId);
}

/**
 * Reacciona a cambios de configuración del grupo EN TIEMPO REAL.
 * Llamado desde index.js en el evento 'groups.update' de Baileys.
 *  • Si el BOT hizo el cambio       → ignorar (bot sabe lo que hace)
 *  • Admin abre de NOCHE            → respetar + aviso + re-cierre diferido si no hay actividad
 *  • Admin cierra de DÍA            → registrar decisión, REGLA 1 la respeta 30 min
 *  • Admin abre de DÍA              → limpiar cooldowns, bot retoma soporte
 */
export async function onGroupSettingChange(sock, updates) {
  if (!Array.isArray(updates)) return;
  const config = loadConfig();
  const now = Date.now();
  const horaColombia = getHoraColombia();

  for (const update of updates) {
    try {
      const chatId = update.id;
      if (!chatId?.endsWith('@g.us')) continue;
      if (!config.enabled_groups?.[chatId]) continue;
      if (typeof update.announce !== 'boolean') continue;

      const opened = update.announce === false; // false = grupo abierto
      const closed = update.announce === true;  // true  = grupo cerrado

      // ── Resolver el actor ───────────────────────────────────────────────
      const actorJid = update.author || null;

      // Si el propio bot hizo el cambio → no rastrear, evitar bucles
      const isBotAction = actorJid && areJidsSameUser(actorJid, sock.user.id);
      if (isBotAction) {
        console.log(`[ADMIN-AUTO] 🤖 groups.update de ${chatId}: cambio propio del bot — ignorado`);
        continue;
      }

      const actorNum      = actorJid ? actorJid.split('@')[0].split(':')[0] : null;
      const actorTag      = actorNum ? `@${actorNum}` : 'Un administrador';
      const actorMentions = actorJid ? [actorJid] : [];
      const tsEvt = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });

      // Registrar acción humana
      lastHumanAdminActionTs.set(chatId, { ts: now, jid: actorJid, action: opened ? 'open' : 'close' });
      console.log(`[ADMIN-AUTO] 👤 acción humana: ${chatId} | ${actorTag} | ${opened ? 'ABRIÓ' : 'CERRÓ'}`);

      if (opened && isNighttime(horaColombia)) {
        // ── Admin abrió de noche → RESPETAR + avisar + re-cierre diferido ──
        // El bot NO cierra inmediatamente. El admin puede tener una razón.
        // Si nadie habla en 20 min → cierra. Si hay actividad → deja pasar.

        // Cancelar timer anterior si había uno
        const existingTimer = pendingNightRecloseTimers.get(chatId);
        if (existingTimer) clearTimeout(existingTimer);

        const avisoNW =
          `╔══════════════════════════╗\n` +
          `║  🌙  C3RB3RUS :: NIGHT_WATCH  🌙  ║\n` +
          `╚══════════════════════════╝\n` +
          `▸ PROC    : night_watch.advisory()\n` +
          `▸ ACTOR   : ${actorTag}\n` +
          `▸ TS      : ${tsEvt}\n` +
          `▸ STATUS  : MONITORING 👁\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌙 ${actorTag} abrió el grupo en horario nocturno.\n` +
          `   Entendido, lo dejo abierto 👌\n` +
          `   Si nadie habla en *20 minutos* lo cerraré 🔒\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          BRAND_FOOTER;

        await sock.sendPresenceUpdate('composing', chatId);
        await sock.sendMessage(chatId, { text: avisoNW, mentions: actorMentions });
        console.log(`[ADMIN-AUTO] 🌙 NIGHT_WATCH: ${chatId} abierto por ${actorTag} — esperando actividad 20 min`);

        // Capturar el momento exacto en que el admin abrió el grupo
        // para comparar SOLO actividad posterior a ese instante.
        const timerSetAt = Date.now();
        const botJidForTimer = sock.user.id;

        // Re-cierre diferido: evaluar en 20 min
        const timer = setTimeout(async () => {
          pendingNightRecloseTimers.delete(chatId);
          try {
            if (!isNighttime(getHoraColombia())) return; // ya es de día, no cerrar

            // Usar getMemberLastActivityTs excluyendo el bot para que el propio aviso
            // de Night Watch no cuente como "actividad" y evite el cierre.
            const lastAct  = await getMemberLastActivityTs(chatId, [botJidForTimer]);
            // Solo cuenta actividad ocurrida DESPUÉS de que el admin abrió el grupo
            const activityAfterOpen = lastAct > timerSetAt;
            if (activityAfterOpen) {
              // Hay actividad de miembros post-apertura → no interrumpir
              console.log(`[ADMIN-AUTO] 🌙 NIGHT_WATCH: ${chatId} con actividad de miembros post-apertura — no se cierra`);
              return;
            }

            // Sin actividad 20 min → cerrar
            let gMeta;
            try { gMeta = await sock.groupMetadata(chatId); } catch (_) { return; }
            if (gMeta.announce === true) return; // ya está cerrado

            await sock.groupSettingUpdate(chatId, 'announcement');
            lastCloseTs.set(chatId, Date.now());

            const tsClose = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
            const avisoClose =
              `╔══════════════════════════╗\n` +
              `║  🌙  C3RB3RUS :: NIGHT_GUARD  🌙  ║\n` +
              `╚══════════════════════════╝\n` +
              `▸ PROC    : night_guard.idle_close()\n` +
              `▸ TRIGGER : no_activity_20m\n` +
              `▸ TS      : ${tsClose}\n` +
              `▸ STATUS  : LOCKED ✓\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `🌙 20 minutos sin actividad — cerrando el grupo.\n` +
              `   Reabre a las 9 AM. Buenas noches 💤\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              BRAND_FOOTER;
            await sendWithImage(sock, chatId, avisoClose);
            console.log(`[ADMIN-AUTO] 🌙 NIGHT_GUARD: ${chatId} cerrado por inactividad (20 min sin actividad)`);
          } catch (e) {
            console.error(`[ADMIN-AUTO] Error en timer NIGHT_GUARD:`, e.message);
          }
        }, NIGHT_RECLOSE_GRACE_MS);

        pendingNightRecloseTimers.set(chatId, timer);

      } else if (closed && !isNighttime(horaColombia)) {
        // ── Admin cerró de día → bot respeta la decisión 30 min ──────────
        lastManualCloseTs.set(chatId, now);
        console.log(`[ADMIN-AUTO] 🔒 Cierre manual diurno: ${actorTag} cerró ${chatId} — REGLA 1 pausada 30 min`);

      } else if (opened && !isNighttime(horaColombia)) {
        // ── Admin abrió de día → bot limpia cooldowns, retoma soporte ─────
        lastManualCloseTs.delete(chatId);
        const t = pendingNightRecloseTimers.get(chatId);
        if (t) { clearTimeout(t); pendingNightRecloseTimers.delete(chatId); }
        console.log(`[ADMIN-AUTO] 🔓 Apertura manual diurna: ${actorTag} abrió ${chatId} — bot en modo soporte`);
      }

    } catch (e) {
      console.error(`[ADMIN-AUTO] Error en onGroupSettingChange:`, e.message);
    }
  }
}

// ── BIENVENIDA AUTÓNOMA ───────────────────────────────────────────────────────

/**
 * Núcleo de envío: construye el mensaje y lo manda con imagen aleatoria.
 * Usado tanto por el evento directo como por el scanner periódico.
 */
async function _enviarBienvenida(sock, chatId, mentions, groupMetadata) {
  const tags      = mentions.map(id => `@${id.split('@')[0]}`).join(' ');
  const groupName = groupMetadata?.subject || 'el grupo';
  const plural    = mentions.length > 1;

  const mensaje =
    `${tags}\n\n` +
    `👋 ¡Bienvenid${plural ? 'os/as' : 'o/a'} a *${groupName}*!\n` +
    `Aquí les habla el *CERBERO-BOT IA administrador autónomo* del grupo 🤖\n\n` +
    `📌 Por favor tengan en cuenta:\n\n` +
    `   📸 Preséntate con *foto* para en ver una vez\n` +
    `      (nombre, de dónde eres, edad)\n\n` +
    `   📋 Recuerden revisar las *reglas del grupo*\n` +
    `   cualquier duda avisar a los administradores\n\n` +
    `¡Esperamos que te sientas a gusto bienvenid@ 💬\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    BRAND_FOOTER;

  let imagePath = null;
  try {
    const files  = await fs.promises.readdir(IMAGES_DIR);
    const images = files.filter(f => /\.(jpe?g|png)$/i.test(f));
    if (images.length > 0)
      imagePath = path.join(IMAGES_DIR, images[Math.floor(Math.random() * images.length)]);
  } catch (_) { /* fallback a texto */ }

  await sock.sendPresenceUpdate('composing', chatId);
  await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));

  if (imagePath) {
    await sock.sendMessage(chatId, { image: { url: imagePath }, caption: mensaje, mentions });
  } else {
    await sock.sendMessage(chatId, { text: mensaje, mentions });
  }
}

/**
 * Escribe autonomo_ts en recent_joins.json para los JIDs dados (por número corto).
 */
async function _marcarBienvenidos(recentPath, chatId, shorts) {
  try {
    const raw    = await fs.promises.readFile(recentPath, 'utf8');
    const recent = JSON.parse(raw || '{}');
    const now    = Date.now();
    const set    = new Set(shorts);
    if (Array.isArray(recent[chatId])) {
      recent[chatId] = recent[chatId].map(e => {
        const s = (e.jid || '').toString().split('@')[0];
        return set.has(s) ? { ...e, autonomo_ts: now } : e;
      });
    }
    await fs.promises.mkdir(path.dirname(recentPath), { recursive: true });
    await fs.promises.writeFile(recentPath, JSON.stringify(recent, null, 2), 'utf8');
  } catch (err) {
    console.error('[ADMIN-AUTO] No se pudo marcar bienvenidos:', err?.message);
  }
}

/**
 * Lee recent_joins.json cada WELCOME_SCAN_INTERVAL_MS buscando miembros que
 * entraron pero aún no recibieron la bienvenida autónoma — como un antivirus
 * que monitorea el archivo en segundo plano.
 */
async function scanPendingWelcomes(sock) {
  const config = loadConfig();
  const enabledGroups = Object.keys(config.enabled_groups || {}).filter(
    id => config.enabled_groups[id]
  );
  if (enabledGroups.length === 0) return;

  const recentPath = path.resolve(process.cwd(), 'temp', 'recent_joins.json');
  let recent = {};
  try {
    const raw = await fs.promises.readFile(recentPath, 'utf8');
    recent = JSON.parse(raw || '{}');
  } catch (_) { return; } // archivo no existe = nada que hacer

  const now = Date.now();

  for (const chatId of enabledGroups) {
    const entries = recent[chatId] || [];
    // Pendientes: sin autonomo_ts y con al menos WELCOME_MIN_AGE_MS de antigüedad
    // (para que welcome.js haya terminado de escribir el archivo antes de que leamos)
    const pendientes = entries.filter(
      e => !e.autonomo_ts && (now - (e.ts || 0)) >= WELCOME_MIN_AGE_MS
    );
    if (pendientes.length === 0) continue;

    console.log(`[ADMIN-AUTO] 🔍 Scanner: ${pendientes.length} pendiente(s) en ${chatId}`);
    try {
      const groupMetadata = await sock.groupMetadata(chatId);
      const participantIds = (groupMetadata?.participants || []).map(p => (p.id || p).toString());

      const mentions = pendientes.map(e => {
        const short = (e.jid || '').toString().split('@')[0];
        const found = participantIds.find(id => id.toString().split('@')[0] === short);
        return found || e.jid || null;
      }).filter(Boolean);

      if (mentions.length === 0) continue;

      await _enviarBienvenida(sock, chatId, mentions, groupMetadata);
      console.log(`[ADMIN-AUTO] 👋 Scanner: bienvenida enviada → ${chatId} (${mentions.length} nuevo(s))`);

      const shorts = pendientes.map(e => (e.jid || '').toString().split('@')[0]);
      await _marcarBienvenidos(recentPath, chatId, shorts);
    } catch (e) {
      console.error(`[ADMIN-AUTO] Scanner error en ${chatId}:`, e.message);
    }
  }
}

/**
 * Envía un mensaje de bienvenida natural a los nuevos miembros del grupo
 * cuando el administrador autónomo está activado en ese grupo.
 *
 * Se llama desde index.js en el evento group-participants.update (action='add').
 * Actúa como primera línea: si el scanner ya lo procesó, no hace nada.
 *
 * @param {object}   sock          Socket de Baileys
 * @param {string}   chatId        JID del grupo
 * @param {string[]} jids          JIDs de los nuevos participantes
 * @param {object}   groupMetadata Metadata fresca del grupo (ya cargada en index.js)
 */
export async function darBienvenidaAutonoma(sock, chatId, jids, groupMetadata) {
  try {
    // Solo actuar si el admin autónomo está habilitado en este grupo
    const config = loadConfig();
    if (!config.enabled_groups?.[chatId]) return;

    // ── Delay humano: welcome.js ya habló, esperamos antes de aparecer ──────
    // También le da tiempo a welcome.js de escribir en recent_joins.json
    const delaySecs = 5 + Math.floor(Math.random() * 7); // 5–11 s
    await new Promise(r => setTimeout(r, delaySecs * 1000));

    // ── Leer recent_joins.json (igual que hace !nuevos) ──────────────────────
    const recentPath = path.resolve(process.cwd(), 'temp', 'recent_joins.json');
    let recent = {};
    try {
      const raw = await fs.promises.readFile(recentPath, 'utf8');
      recent = JSON.parse(raw || '{}');
    } catch (_) { recent = {}; }

    // Entradas del grupo que aún NO han recibido bienvenida autónoma
    const entries   = recent[chatId] || [];
    const pendientes = entries.filter(e => !e.autonomo_ts);

    // Resolver JIDs válidos contra groupMetadata.participants
    const participantIds = (groupMetadata?.participants || []).map(p => (p.id || p).toString());
    let mentions = pendientes.map(e => {
      const short = (e.jid || '').toString().split('@')[0];
      const found = participantIds.find(id => id.toString().split('@')[0] === short);
      return found || e.jid || null;
    }).filter(Boolean);

    // Fallback: si recent_joins aún no tenía nada (welcome.js falló o no está
    // activo), usar los JIDs del evento directamente
    if (mentions.length === 0) {
      mentions = (jids || []).filter(Boolean);
    }

    if (mentions.length === 0) return;

    // ── Enviar bienvenida y marcar ────────────────────────────────────────────
    await _enviarBienvenida(sock, chatId, mentions, groupMetadata);
    console.log(`[ADMIN-AUTO] 👋 Bienvenida autónoma (evento) → ${chatId} (${mentions.length} nuevo(s))`);

    if (pendientes.length > 0) {
      const shorts = pendientes.map(e => (e.jid || '').toString().split('@')[0]);
      await _marcarBienvenidos(recentPath, chatId, shorts);
    }
  } catch (e) {
    console.error(`[ADMIN-AUTO] Error en bienvenida autónoma ${chatId}:`, e.message);
  }
}

// ── SCANNER PERIÓDICO ────────────────────────────────────────────────────────

/**
 * Inicia el scanner que vigila recent_joins.json cada 2 minutos.
 * Funciona como segunda línea de defensa: captura entradas que el evento
 * directo pudo haber perdido (bot reiniciado, welcome.js tardó en escribir, etc.).
 * Devuelve el interval handle para agregarlo a `allTimers[]`.
 */
export function iniciarScannerBienvenida(sock) {
  if (_welcomeScannerInterval) clearInterval(_welcomeScannerInterval);
  console.log('[ADMIN-AUTO] 🔍 Scanner de bienvenidas iniciado (cada 2 min)');
  _welcomeScannerInterval = setInterval(
    () => scanPendingWelcomes(sock).catch(e => console.error('[ADMIN-AUTO] scanner-bienvenida error:', e.message)),
    WELCOME_SCAN_INTERVAL_MS
  );
  return _welcomeScannerInterval;
}

/**
 * Detiene el scanner periódico de bienvenidas.
 */
export function detenerScannerBienvenida() {
  if (_welcomeScannerInterval) {
    clearInterval(_welcomeScannerInterval);
    _welcomeScannerInterval = null;
    console.log('[ADMIN-AUTO] 🔍 Scanner de bienvenidas detenido');
  }
}

// ── API PÚBLICA ───────────────────────────────────────────────────────────────

/**
 * Inicia el ticker autónomo.
 * Devuelve el interval handle para agregarlo a `allTimers[]`.
 */
export function iniciarAdminAutonomo(sock) {
  console.log('[ADMIN-AUTO] 🚀 Administrador autónomo iniciado (tick cada 5 min)');
  // Tick inicial inmediato (no esperar 5 min tras reinicio)
  setTimeout(() => tickerAdminAutonomo(sock).catch(e => console.error('[ADMIN-AUTO] ticker error:', e.message)), 15_000);
  const interval = setInterval(
    () => tickerAdminAutonomo(sock).catch(e => console.error('[ADMIN-AUTO] ticker error:', e.message)),
    CHECK_INTERVAL_MS
  );
  return interval;
}

/**
 * Comando !autonomo — activa / desactiva / consulta el estado del admin autónomo.
 *
 * Uso (solo admins):
 *   !autonomo activar    → habilita en este grupo
 *   !autonomo desactivar → deshabilita en este grupo
 *   !autonomo            → muestra el estado actual
 */
export async function toggleAdminAutonomo(sock, msg, isAdmin) {
  const chatId = msg.key.remoteJid;

  // Solo funciona en grupos
  if (!chatId?.endsWith('@g.us')) return;

  // Solo admins
  if (!isAdmin && !msg.key.fromMe) {
    await sock.sendMessage(
      chatId,
      { text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 🚫 Solo los administradores pueden usar este comando.' },
      { quoted: msg }
    );
    return;
  }

  const text   = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const parts  = text.trim().split(/\s+/);
  const sub    = (parts[1] || '').toLowerCase();
  const subsub = (parts[2] || '').toLowerCase();
  const config = loadConfig();
  if (!config.enabled_groups) config.enabled_groups = {};

  if (sub === 'activar') {
    config.enabled_groups[chatId] = true;
    saveConfig(config);
    const textoActivar =
          `╔══════════════════════════╗\n` +
          `║  ✅  CERBERO-AEGIS  ADMINISTRADOR AUTONOMO ✅  ║\n` +
          `╚══════════════════════════╝\n` +
          `▸ DAEMON  : group_watchdog\n` +
          `▸ PID     : ONLINE\n` +
          `▸ TARGET  : ${chatId.split('@')[0]}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `⚙ RULE[0] si abren de noche        → night-guard (re-cierra)\n` +
          `⚙ RULE[1] día + idle>5m + locked  → auto-unlock\n` +
          `⚙ RULE[2] 09:00 COT + locked       → cron-unlock\n` +
          `⚙ RULE[3] día + idle>5m + open    → full-tag\n` +
          `⚙ RULE[4] 00:00 COT + idle         → auto-lock\n` +
          `⚙ RULE[5] +3d sin hablar           → ghost-tag\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🌙 Noche silenciosa: 00:00–09:00 COT\n` +
          `   (R1/R3/R5 suspendidas, grupo permanece cerrado)\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `✅ La IA autónoma comenzará a administrar este grupo\n` +
          `   automáticamente según las reglas anteriores.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          BRAND_FOOTER;
    await sendWithImage(sock, chatId, textoActivar, { quoted: msg });
  } else if (sub === 'desactivar') {
    config.enabled_groups[chatId] = false;
    saveConfig(config);
    const textoDesactivar =
          `╔══════════════════════════╗\n` +
          `║  🔴  CERBERO-AEGIS  ADMINISTRADOR AUTONOMO 🔴  ║\n` +
          `╚══════════════════════════╝\n` +
          `▸ DAEMON  : group_watchdog\n` +
          `▸ PID     : OFFLINE\n` +
          `▸ TARGET  : ${chatId.split('@')[0]}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔴 La IA autónoma ha dejado de administrar este grupo.\n` +
          `   El control vuelve a los admins humanos.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          BRAND_FOOTER;
    await sendWithImage(sock, chatId, textoDesactivar, { quoted: msg });
  } else if (sub === 'test') {
    const diag = await diagnosticarEstado(sock, chatId);
    if (!diag) {
      await sock.sendMessage(chatId, { text: '[ADMIN-AUTO] ❌ No se pudo obtener metadata del grupo.' }, { quoted: msg });
      return;
    }
    const ts        = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
    const estadoStr = diag.isClosed ? 'CERRADO 🔒' : 'ABIERTO  🔓';
    const idleStr   = diag.lastActivity === 0 ? 'sin registro' : `${diag.minsSin}m`;
    const umbralMin = INACTIVITY_THRESHOLD_MS / 60_000;
    const inacStr   = diag.isInactive ? `SÍ  (>${umbralMin}m umbral)` : 'NO';
    const disparosStr = diag.disparos.length > 0
      ? diag.disparos.map(d => `  ⚡ ${d}`).join('\n')
      : '  ✔ ninguna — condiciones no cumplidas';

    if (subsub === 'forzar') {
      let accionesEjecutadas;
      try {
        accionesEjecutadas = await forzarTickGrupo(sock, chatId);
      } catch (e) {
        await sock.sendMessage(chatId, { text: `[ADMIN-AUTO] ❌ Error en force: ${e.message}` }, { quoted: msg });
        return;
      }
      const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
      const resumen = accionesEjecutadas.map(a => `  ⚡ ${a}`).join('\n');
      const avisoForzar =
        `╔══════════════════════════╗\n` +
        `║  ⚡  C3RB3RUS :: FORCE_EXEC  ⚡  ║\n` +
        `╚══════════════════════════╝\n` +
        `▸ PROC    : watchdog.forceRun()\n` +
        `▸ TS      : ${ts}\n` +
        `▸ STATUS  : EXECUTED ✓\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ ACCIONES EJECUTADAS:\n` +
        `${resumen}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        BRAND_FOOTER;
      await sendWithImage(sock, chatId, avisoForzar, { quoted: msg });
    } else {
      const textoDiag =
        `╔══════════════════════════╗\n` +
        `║  🧪  C3RB3RUS :: DIAGNOSTIC  🧪  ║\n` +
        `╚══════════════════════════╝\n` +
        `▸ HORA COT  : ${diag.horaColombia}:xx\n` +
        `▸ MODO      : ${diag.isNight ? '🌙 NOCHE — R1/3/5 suspendidas' : '☀️ DÍA — todas las reglas activas'}\n` +
        `▸ ESTADO    : ${estadoStr}\n` +
        `▸ IDLE      : ${idleStr}\n` +
        `▸ INACTIVO  : ${inacStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ REGLAS QUE DISPARARÍAN:\n` +
        `${disparosStr}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `  !autonomo test forzar\n` +
        `  ejecuta el tick sin cooldowns\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        BRAND_FOOTER;
      await sendWithImage(sock, chatId, textoDiag, { quoted: msg });
    }
  } else {
    const online  = config.enabled_groups[chatId] === true;
    const estado  = online ? '✅  ONLINE' : '🔴  OFFLINE';
    const modo    = online ? 'Administración autónoma' : 'Administración manual';
    const textoStatus =
          `╔══════════════════════════╗\n` +
          `║  🤖   CERBERO-AEGIS  ADMINISTRADOR AUTONOMO 🤖  ║\n` +
          `╚══════════════════════════╝\n` +
          `▸ DAEMON  : group_watchdog\n` +
          `▸ PID     : ${online ? 'ONLINE  ✓' : 'OFFLINE ✗'}\n` +
          `▸ TARGET  : ${chatId.split('@')[0]}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `  !autonomo activar\n` +
          `  !autonomo desactivar\n` +
          `  !autonomo test`;
    await sendWithImage(sock, chatId, textoStatus, { quoted: msg });
  }
}
