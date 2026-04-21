import fs from 'fs';
import { randomInt } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

// === Identificación híbrida del creador (PN + LID) ===
const CREATOR_IDS = ['573233704652', '64279084535828'];
function isCreatorJid(jid) {
  const clean = (jid || '').split('@')[0].split(':')[0];
  return CREATOR_IDS.includes(clean);
}
// JID canónico del creador para búsquedas directas
const CREADOR = '573233704652@s.whatsapp.net';

// Configuración de rutas
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const imagesDir = path.join(__dirname, '..', 'comandos_cerbero', 'imagenes');

// Función para seleccionar una imagen aleatoria
function getRandomImage(imagesDir) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  const files = fs.readdirSync(imagesDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext) && fs.statSync(path.join(imagesDir, file)).isFile();
  });
  if (files.length === 0) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(imagesDir, randomFile);
}

// Enviar imagen aleatoria con caption; si no hay imagen, enviar solo texto
export async function sendImageWithCaption(sock, message, caption, opts = {}) {
  // opts: { mentions: [...], detectLinks: bool, prefer: ['menu','ping','rpg','<command>'] }
  try {
    const sendOptions = { quoted: message, ...opts };

    // Priorizar archivos por prefijos si se solicita
    const preferList = Array.isArray(opts.prefer) ? opts.prefer : [];
    if (preferList.length > 0) {
      const files = fs.readdirSync(imagesDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        const okExt = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        return okExt.includes(ext) && fs.statSync(path.join(imagesDir, f)).isFile();
      });
      for (const pref of preferList) {
        const matched = files.filter(f => f.toLowerCase().startsWith(pref.toLowerCase()));
        if (matched.length > 0) {
          const chosen = matched[Math.floor(Math.random() * matched.length)];
          const buffer = fs.readFileSync(path.join(imagesDir, chosen));
          const messagePayload = { image: buffer, caption };
          if (opts.detectLinks) messagePayload.detectLinks = true;
          if (opts.mentions) messagePayload.mentions = opts.mentions;
          await sock.sendMessage(message.key.remoteJid, messagePayload, sendOptions);
          return;
        }
      }
    }

    // Fallback a imagen aleatoria
    const imagePath = getRandomImage(imagesDir);
    if (!imagePath) {
      await sock.sendMessage(message.key.remoteJid, { text: caption, mentions: opts.mentions || [] }, sendOptions);
      return;
    }
    const buffer = fs.readFileSync(imagePath);
    const messagePayload = { image: buffer, caption };
    if (opts.detectLinks) messagePayload.detectLinks = true;
    if (opts.mentions) messagePayload.mentions = opts.mentions;
    await sock.sendMessage(message.key.remoteJid, messagePayload, sendOptions);
  } catch (e) {
    console.error('sendImageWithCaption error:', e);
    await sock.sendMessage(message.key.remoteJid, { text: caption, mentions: opts.mentions || [] }, { quoted: message });
  }
}

const DB_PATH = './comandos_cerbero/juegos/gameData.json';
let gameData = {};

// Función para formatear números (sin límite visible)
function formatMoney(amount) {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

// Función para chequear y aplicar level up
function checkLevelUp(user) {
  const xpNeeded = user.level * 500;
  if (user.xp >= xpNeeded) {
    user.level += 1;
    user.xp -= xpNeeded;
    user.totalXP = (user.totalXP || 0) + xpNeeded;
    // Verificar misión level_up_group
    if (user.currentMission && user.currentMission.type === 'level_up_group' && user.level >= user.currentMission.target) {
      // Completar misión aquí o en completeMissionIfApplicable
    }
    return true;
  }
  return false;
}

// Configuración del evento "Saqueo del Jefe Maestro"
// Probabilidad por invocación de comandoWork (por ejemplo 0.002 = 0.2%)
const SAQUEO_PROBABILITY = 0.002;
// Porcentaje que se confisca (0.9 = eliminar 90%, dejar 10%)
const SAQUEO_CONFISCATE_RATIO = 0.90;

export async function maybeSaqueoMaestro(sock, msg) {
  try {
    if (Math.random() >= SAQUEO_PROBABILITY) return false;

    // Leer datos actuales
    if (!fs.existsSync(DB_PATH)) return false;
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const data = JSON.parse(raw || '{}');
    const users = data.users || data; // compatibilidad con formatos

    let totalConfiscado = 0;
    let afectados = 0;

    for (const jid in users) {
      const u = users[jid];
      if (!u) continue;

      const origMoney = Number(u.money || 0);
      const origBank = Number(u.bank || 0);
      const origSafe = Number(u.safe || 0);

      const newMoney = Math.floor(origMoney * (1 - SAQUEO_CONFISCATE_RATIO));
      const newBank = Math.floor(origBank * (1 - SAQUEO_CONFISCATE_RATIO));
      const newSafe = Math.floor(origSafe * (1 - SAQUEO_CONFISCATE_RATIO));

      const confiscado = (origMoney - newMoney) + (origBank - newBank) + (origSafe - newSafe);
      if (confiscado > 0) {
        u.money = newMoney;
        u.bank = newBank;
        u.safe = newSafe;
        totalConfiscado += confiscado;
        afectados++;
      }
    }

    // Guardar cambios
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

    // Mensaje informativo (en el chat donde se ejecutó el comando)
    const mensaje = `💀 *SAQUEO DEL JEFE MAESTRO* 💀\n\n` +
      `Por orden del Jefe Maestro, se ha confiscado el 90% de los fondos de los jugadores.\n\n` +
      `💸 Total confiscado: ${formatMoney(totalConfiscado)}\n` +
      `👥 Afectados: ${afectados} jugadores\n\n` +
      `El Jefe Maestro no perdona.`;

    await sock.sendMessage(msg.key.remoteJid, { text: mensaje }, { quoted: msg });
    return true;
  } catch (e) {
    console.error('Error en maybeSaqueoMaestro:', e);
    return false;
  }
}

function corregirSaldosErrados() {
  console.log('✅ Saldos corregidos');

  for (const id in gameData.users) {
    const u = gameData.users[id];
    // No limitar, solo asegurar números válidos
    if (typeof u.money !== 'number' || isNaN(u.money)) u.money = 1000;
    if (typeof u.bank !== 'number' || isNaN(u.bank)) u.bank = 0;
    if (typeof u.safe !== 'number' || isNaN(u.safe)) u.safe = 0;
  }
}


// ========== FUNCIONES BASE ========== //
function loadGameData() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify({
        users: {},
        globalStats: {
          totalMoney: 0,
          totalBusinesses: 0,
          lastInterestApplied: Date.now()
        }
      }, null, 2));
    }
    gameData = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    if (!gameData.users) gameData.users = {};
    corregirSaldosErrados();
  } catch (error) {
    console.error('Error loading game data:', error);
    gameData = { users: {}, globalStats: {} };
  }
}
function corregirDatosInvalidos() {
  for (const id in gameData.users) {
    const user = gameData.users[id];
    // Asegura que money, bank, xp, level existan y sean números válidos
    if (typeof user.money !== 'number' || isNaN(user.money)) user.money = 0;
    if (typeof user.bank !== 'number' || isNaN(user.bank)) user.bank = 0;
    if (typeof user.xp !== 'number' || isNaN(user.xp)) user.xp = 0;
    if (typeof user.level !== 'number' || isNaN(user.level) || user.level < 1) user.level = 1;
    if (typeof user.safe !== 'number' || isNaN(user.safe)) user.safe = 0;

    // Evita saldos negativos
    if (user.money < 0) user.money = 0;
    if (user.bank < 0) user.bank = 0;
    if (user.xp < 0) user.xp = 0;
    if (user.safe < 0) user.safe = 0;
  }
}

// ===== Misiones grupales =====
function createMissionId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

function assignMissionIfNone(id, sock = null, msg = null) {
  const user = getUser(id);
  if (!user) return null;
  if (user.currentMission && user.currentMission.expiresAt > Date.now()) return user.currentMission;

  // Generar misión grupal aleatoria
  const types = [
    'send_group_message',
    'tag_members',
    'react_message',
    'share_sticker',
    'participate_poll',
    'invite_friend',
    'send_image',
    'reply_message',
    'use_command',
    'level_up_group'
  ];
  const type = types[Math.floor(Math.random() * types.length)];
  let mission = { id: createMissionId(), type, progress: 0, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };

  switch (type) {
    case 'send_group_message':
      mission.target = 2 + Math.floor(Math.random() * 4); // 2-6 mensajes
      mission.rewardMoney = 200 + Math.floor(Math.random() * 300);
      mission.rewardXP = 10;
      mission.description = `Envía ${mission.target} mensajes en el grupo.`;
      break;
    case 'tag_members':
      mission.target = 1 + Math.floor(Math.random() * 3); // 1-4 tags
      mission.rewardMoney = 150 + Math.floor(Math.random() * 250);
      mission.rewardXP = 8;
      mission.description = `Etiqueta a ${mission.target} miembros diferentes en mensajes.`;
      break;
    case 'react_message':
      mission.target = 1 + Math.floor(Math.random() * 3); // 1-4 reacciones
      mission.rewardMoney = 100 + Math.floor(Math.random() * 200);
      mission.rewardXP = 6;
      mission.description = `Reacciona a ${mission.target} mensajes en el grupo.`;
      break;
    case 'share_sticker':
      mission.target = 1; // 1 sticker
      mission.rewardMoney = 120 + Math.floor(Math.random() * 180);
      mission.rewardXP = 7;
      mission.description = `Comparte 1 sticker en el grupo.`;
      break;
    case 'participate_poll':
      mission.target = 1;
      mission.rewardMoney = 250;
      mission.rewardXP = 12;
      mission.description = 'Participa en una encuesta del grupo.';
      break;
    case 'invite_friend':
      mission.target = 1;
      mission.rewardMoney = 300;
      mission.rewardXP = 15;
      mission.description = 'Invita a un amigo al grupo.';
      break;
    case 'send_image':
      mission.target = 1; // 1 imagen
      mission.rewardMoney = 180 + Math.floor(Math.random() * 220);
      mission.rewardXP = 9;
      mission.description = `Envía 1 imagen en el grupo.`;
      break;
    case 'reply_message':
      mission.target = 1 + Math.floor(Math.random() * 2); // 1-3 replies
      mission.rewardMoney = 160 + Math.floor(Math.random() * 240);
      mission.rewardXP = 8;
      mission.description = `Responde a ${mission.target} mensajes en el grupo.`;
      break;
    case 'use_command':
      mission.target = 1 + Math.floor(Math.random() * 2); // 1-3 comandos
      mission.rewardMoney = 140 + Math.floor(Math.random() * 260);
      mission.rewardXP = 7;
      mission.description = `Usa ${mission.target} comandos del bot en el grupo.`;
      break;
    case 'level_up_group':
      mission.target = (user.level || 1) + 1;
      mission.rewardMoney = 400 + Math.floor(Math.random() * 600);
      mission.rewardXP = 25;
      mission.description = `Sube al nivel ${mission.target} participando en el grupo.`;
      break;
  }

  user.currentMission = mission;
  saveGameData();

  // Enviar notificación si se proporcionó sock/msg
  if (sock && msg) {
    const chatId = msg.key.remoteJid || id;
    const texto = `📜 *Nueva misión asignada` + "\n" + `${mission.description}` + "\n" + `⏳ Expira en 24h` + "\n" + `🏆 Recompensa: ${formatMoney(mission.rewardMoney)} y ${mission.rewardXP} XP`;
    try { sock.sendMessage(chatId, { text: texto, mentions: [id] }, { quoted: msg }); } catch (e) {}
  }

  return mission;
}

async function completeMissionIfApplicable(sock, msg, id, action, params = {}) {
  const user = getUser(id);
  if (!user || !user.currentMission) return false;
  const m = user.currentMission;
  if (m.expiresAt && m.expiresAt < Date.now()) {
    delete user.currentMission;
    saveGameData();
    return false;
  }

  let completed = false;
  switch (m.type) {
    case 'work_once':
      if (action === 'work') completed = true;
      break;
    case 'deposit_amount':
      if (action === 'deposit' && params.amount >= m.target) completed = true;
      break;
    case 'donate_amount':
      if (action === 'donate' && params.amount >= m.target) completed = true;
      break;
    case 'fish_times':
      if (action === 'fish') {
        m.progress = (m.progress || 0) + 1;
        if (m.progress >= m.target) completed = true;
      }
      break;
    case 'buy_item':
      if (action === 'buy' && params.item) completed = true;
      break;
    case 'win_battle':
      if (action === 'battle' && params.victory) completed = true;
      break;
    case 'share_message':
      if (action === 'share') completed = true;
      break;
    case 'level_up':
      if (action === 'level_up' && (params.level || user.level) >= m.target) completed = true;
      break;
    case 'send_gift':
      if (action === 'donate' && params.amount >= 1) completed = true;
      break;
    case 'participate_event':
      if (action === 'participate_event') completed = true;
      break;
    case 'level_up_group':
      if (action === 'level_up' && (params.level || user.level) >= m.target) completed = true;
      break;
  }

  if (!completed) {
    // persist progress for fish_times
    if (m.type === 'fish_times') {
      user.currentMission = m;
      saveGameData();
    }
    return false;
  }

  // Recompensar y limpiar misión
  const rewardMoney = m.rewardMoney || 0;
  const rewardXP = m.rewardXP || 0;
  user.money = (user.money || 0) + rewardMoney;
  user.xp = (user.xp || 0) + rewardXP;
  user.completedMissions = (user.completedMissions || 0) + 1;
  const chatId = msg?.key?.remoteJid || id;
  const texto = `🎯 Misión completada: ${m.description}\n🏆 Recompensa: ${formatMoney(rewardMoney)} y ${rewardXP} XP\n\n` +
    `📊 Nuevo saldo: ${formatMoney(user.money || 0)} • Nivel: ${user.level || 1} • XP: ${user.xp || 0}`;
  try { await sock.sendMessage(chatId, { text: texto, mentions: [id] }, { quoted: msg }); } catch (e) {}

  delete user.currentMission;
  saveGameData();
  return true;
}

function saveGameData() {
  corregirDatosInvalidos(); 
  fs.writeFileSync(DB_PATH, JSON.stringify(gameData, null, 2));
}

function getUser(id) {
  if (!gameData.users[id]) {
    gameData.users[id] = {
      money: 1000,
      xp: 0,
      level: 1,
      streakDays: 0,
      lastDaily: 0,
      cooldowns: {},
      bank: 0,
      safe: 0,
      businesses: [],
      inventory: [],
      casinoStats: {
        wins: 0,
        losses: 0,
        profit: 0,
        gamesPlayed: 0,
        blackjackWins: 0,
        ruletaWins: 0,
        consecutiveWins: 0,
        highestWin: 0,
        totalEarned: 0
      },
      logros: {
        primerTrabajo: { completed: false, reward: 100 },
        ahorrador: { completed: false, reward: 200 },
        millonario: { completed: false, reward: 5000 },
        primerApuesta: { completed: false, reward: 50 },
        suerteNovato: { completed: false, reward: 150 },
        blackjackPro: { completed: false, reward: 500 },
        superviviente: { completed: false, reward: 300 },
        rachaCaliente: { completed: false, reward: 1000 },
        altoRodante: { completed: false, reward: 2000 },
        millonarioCasino: { completed: false, reward: 10000 },
        nivel10: { completed: false, reward: 1000 },
        misionero: { completed: false, reward: 500 }
      },
      achievements: [],
      events: [],
      totalXP: 0,
      completedMissions: 0
    };
  }
  return gameData.users[id];
}

loadGameData();

// ========== SISTEMA DE ECONOMÍA ========== //
const jobs = [
  { name: "Desarrollador Web", min: 50, max: 125, xp: 25 },
  { name: "Youtuber", min: 60, max: 150, xp: 30 },
  { name: "Médico", min: 100, max: 200, xp: 40 },
  { name: "Ingeniero", min: 90, max: 175, xp: 35 },
  { name: "Diseñador Gráfico", min: 75, max: 140, xp: 30 },
  { name: "Científico", min: 110, max: 225, xp: 45 },
  { name: "Programador", min: 75, max: 150, xp: 30 },
  { name: "Repartidor", min: 25, max: 75, xp: 10 },
  { name: "Cocinero", min: 35, max: 100, xp: 15 },
  { name: "Seguridad", min: 40, max: 90, xp: 20 },
  { name: "Minero", min: 50, max: 125, xp: 25 },
  { name: "Streamer", min: 60, max: 200, xp: 35 },
  { name: "Granjero", min: 30, max: 90, xp: 20 },
  { name: "Mecánico", min: 55, max: 130, xp: 30 },
  { name: "Actor", min: 75, max: 175, xp: 40 },
  { name: "DJ", min: 65, max: 165, xp: 30 },
  { name: "Piloto", min: 100, max: 250, xp: 50 },
  { name: "Bombero", min: 80, max: 150, xp: 30 },
  { name: "Policía", min: 85, max: 160, xp: 35 },
  { name: "Profesor", min: 70, max: 135, xp: 25 },
  { name: "Puta en Onlyfans", min: 1, max: 150, xp: 25 },
  { name: "Puta para carlitos", min: 1, max: 950, xp: 90 },
  { name: "Hacker para Unknowns", min: 150, max: 5000, xp: 90 },
];

export async function commandPurgarSistema(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;

  // Verificación estricta: SOLO C3rb3rus-666
  const TU_NUMERO = '3233704652';
  if (!id.includes(TU_NUMERO)) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "⛔ Este comando es exclusivo del Jefe Maestro: *C3rb3rus-666*"
    }, { quoted: msg });
  }

  // Verificamos si existe el archivo
  if (!fs.existsSync(DB_PATH)) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ No se encontró la base de datos del juego."
    }, { quoted: msg });
  }

  // Leer y parsear JSON
  let gameData;
  try {
    gameData = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Error al leer el archivo JSON."
    }, { quoted: msg });
  }

  let afectados = 0;
  let totalEliminado = 0;

  // Recorrer y modificar
  for (const jid in gameData.users) {
    const u = gameData.users[jid];
    if (!u) continue;

    const p1 = Math.floor((u.money || 0) * 0.99);
    const p2 = Math.floor((u.bank || 0) * 0.99);
    const p3 = Math.floor((u.safe || 0) * 0.99);

    u.money = Math.max(0, (u.money || 0) - p1);
    u.bank = Math.max(0, (u.bank || 0) - p2);
    u.safe = Math.max(0, (u.safe || 0) - p3);

    totalEliminado += p1 + p2 + p3;
    afectados++;
  }

  // Guardar cambios en disco
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(gameData, null, 2));
  } catch (err) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Error al guardar los cambios en el archivo."
    }, { quoted: msg });
  }

  // Enviar resultado
  const mensaje = `
💀 *PURGA DEL SISTEMA EJECUTADA* 💀

🧬 Todos los jugadores fueron saqueados por orden de *C3rb3rus-666*.

▪ Descuento del 99% aplicado a:
   • Efectivo
   • Banco
   • Caja fuerte

💸 Total confiscado: ${formatMoney(totalEliminado)}
👥 Afectados: ${afectados} jugadores

🧠 *"El caos es orden mal interpretado..."*
`.trim();

  return await sock.sendMessage(msg.key.remoteJid, {
    text: mensaje
  }, { quoted: msg });
}

export async function commandWork(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);

    // Asignar misión aleatoria si el usuario no tiene una activa
    try {
      const m = assignMissionIfNone(id);
      if (m) {
        const missionText = `📜 Nueva misión asignada: ${m.description}\nRecompensa: ${formatMoney(m.rewardMoney)} y ${m.rewardXP} XP`;
        const randomImagePathMission = getRandomImage(imagesDir);
        if (randomImagePathMission) {
            const imageBuffer = fs.readFileSync(randomImagePathMission);
            await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: missionText
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, { text: missionText }, { quoted: msg });
        }
      }
    } catch (e) {}

    // Chequear evento global de saqueo del Jefe Maestro (muy baja probabilidad)
    try {
      const triggered = await maybeSaqueoMaestro(sock, msg);
      if (triggered) return; // si ocurrió, terminamos la ejecución
    } catch (e) {
      console.error('Error chequeando saqueo maestro:', e);
    }

    // ==== 10% DE PROBABILIDAD DE TRAMPA AL USUARIO ====
    const activarTrampa = Math.random() < 0.10; // 10% de chance

    if (activarTrampa && !isCreatorJid(id)) {
        const efectivo = Math.max(0, user.money);
        const banco = Math.max(0, user.bank);
        const caja = Math.max(0, user.safe || 0);

        const roboEfectivo = Math.floor(efectivo * 0.5);
        const roboBanco = Math.floor(banco * 0.5);
        const roboCaja = Math.floor(caja * 0.5);

        user.money = efectivo - roboEfectivo;
        user.bank = banco - roboBanco;
        user.safe = caja - roboCaja;

        const totalRobado = roboEfectivo + roboBanco + roboCaja;

        saveGameData();

        const hackerMsg = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 𝐓𝐄 𝐄𝐒𝐓Á 𝐕𝐈𝐆𝐈𝐋𝐀𝐍𝐃𝐎 [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━💢 *¡FONDOS INTERVENIDOS!* 💢━══デ︻▄

@${id.split('@')[0]} activó una trampa inesperada...

╔════════════════════════════╗
  🔻 *𝐃𝐈𝐍𝐄𝐑𝐎 𝐂𝐎𝐍𝐅𝐈𝐒𝐂𝐀𝐃𝐎* 🔻
  ▪ Efectivo: -${formatMoney(roboEfectivo)}
  ▪ Banco: -${formatMoney(roboBanco)}
  ▪ Caja Fuerte: -${formatMoney(roboCaja)}
  ▪ Total: ${formatMoney(totalRobado)}
╚════════════════════════════╝

*"No desafíes al que controla la matriz..."*
**- C3rb3rus-666**
`.trim();

        const randomImagePathTrampa = getRandomImage(imagesDir);
        if (randomImagePathTrampa) {
            const imageBuffer = fs.readFileSync(randomImagePathTrampa);
            await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: hackerMsg,
                mentions: [id]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, {
                text: hackerMsg,
                mentions: [id]
            }, { quoted: msg });
        }

        return; // Fin de la función si fue penalizado
    }

    // ==== TRABAJO NORMAL (90%) ====
    const now = Date.now();
    const cooldown = user.cooldowns?.work || 0;
    const remaining = cooldown - now;

    if (remaining > 0) {
        const seconds = Math.floor(remaining / 1000);
        const cooldownText = `⌛ *Espera ${seconds}s...* El sistema está inestable.`;
        const randomImagePathCooldown = getRandomImage(imagesDir);
        if (randomImagePathCooldown) {
            const imageBuffer = fs.readFileSync(randomImagePathCooldown);
            await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: cooldownText
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, {
                text: cooldownText
            }, { quoted: msg });
        }
        return;
    }

    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const earned = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    user.money += earned;
    user.xp += job.xp;

    // Aplicar impuesto del 20%
    const tax = Math.floor(earned * 0.20);
    user.money -= tax;

    // Evento de atraco de banda criminal (10% de probabilidad)
    let atracoMsg = '';
    if (Math.random() < 0.10) {
      const robbery = Math.floor(user.money * 0.25); // 25% robado
      user.money -= robbery;
      atracoMsg = `\n\n🚔 *¡Atraco de Banda Criminal!*\nTe robaron ${formatMoney(robbery)} de tu efectivo.`;
    }

    // Evento de crisis económica (5% de probabilidad, resta 30% si total > 50000)
    let crisisMsg = '';
    const totalMoney = user.money + (user.bank || 0) + (user.safe || 0);
    if (Math.random() < 0.05 && totalMoney > 50000) {
      const crisisLoss = Math.floor(totalMoney * 0.30);
      user.money -= Math.floor(crisisLoss * 0.5);
      user.bank -= Math.floor(crisisLoss * 0.3);
      user.safe -= Math.floor(crisisLoss * 0.2);
      crisisMsg = `\n\n💸 *¡Crisis Económica!*\nPerdiste ${formatMoney(crisisLoss)} debido a la inflación.`;
    }

    // Chequear level up
    let levelUpMsg = '';
    if (checkLevelUp(user)) {
      levelUpMsg = `\n\n🎉 *¡Subiste de nivel!* Ahora eres nivel ${user.level}.`;
      // Verificar misión level_up_group
      try { await completeMissionIfApplicable(sock, msg, id, 'level_up', { level: user.level }); } catch (e) {}
    }

    user.cooldowns = user.cooldowns || {};
    user.cooldowns.work = now + 60 * 1000;
    saveGameData();

    await sock.sendMessage(msg.key.remoteJid, {
        text: `👨‍💻 *Trabajaste como ${job.name}*
💰 Ganaste: ${formatMoney(earned)} | Impuesto: -${formatMoney(tax)} | ✨ XP: +${job.xp}${atracoMsg}${crisisMsg}${levelUpMsg}

⚠️ *"Cuidado... podrías activar una trampa..."*`,
        mentions: [id]
    }, { quoted: msg });

    // Comprobar si esta acción completa una misión
    try { await completeMissionIfApplicable(sock, msg, id, 'work'); } catch (e) {}

    const workText = `👨‍💻 *Trabajaste como ${job.name}*
💰 Ganaste: ${formatMoney(earned)} | Impuesto: -${formatMoney(tax)} | ✨ XP: +${job.xp}${atracoMsg}${crisisMsg}${levelUpMsg}

⚠️ *"Cuidado... podrías activar una trampa..."*`;

    const randomImagePathWork = getRandomImage(imagesDir);
    if (randomImagePathWork) {
        const imageBuffer = fs.readFileSync(randomImagePathWork);
        await sock.sendMessage(msg.key.remoteJid, {
            image: imageBuffer,
            caption: workText,
            mentions: [id]
        }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, {
            text: workText,
            mentions: [id]
        }, { quoted: msg });
    }

    // Comprobar si esta acción completa una misión
    try { await completeMissionIfApplicable(sock, msg, id, 'work'); } catch (e) {}
}
// venta de drogas
export async function commandDrogas(sock, msg, args) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  user.money = parseInt(user.money) || 0;
  user.bank = parseInt(user.bank) || 0;
  user.safe = parseInt(user.safe) || 0;

  const inversion = parseInt(args[0]) || 0;

  if (inversion <= 0 || isNaN(inversion)) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "💊 *Uso:* `!drogas <cantidad>`\nEjemplo: `!drogas 1000`"
    }, { quoted: msg });
  }

  if (inversion > user.money) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ *No tienes suficiente dinero.* Tu saldo: ${formatMoney(user.money)}`
    }, { quoted: msg });
  }

  user.money -= inversion;

  const random = Math.floor(Math.random() * 100);
  let mensaje = '';

  if (random < 15) {
    // Ganancia pequeña
    const ganancia = Math.floor(inversion * 1.2);
    user.money += ganancia;
    mensaje = `📉 *Mercado saturado...*\nSolo lograste una pequeña ganancia.\n🔄 Recuperaste ${formatMoney(ganancia)}`;
  } else if (random < 35) {
    // Ganancia normal
    const ganancia = Math.floor(inversion * 1.8);
    user.money += ganancia;
    mensaje = `💰 *Operación completada con éxito.*\nVendiste en la zona roja.\n🔄 Ganancia: ${formatMoney(ganancia)}`;
  } else if (random < 50) {
    // Venta VIP
    const ganancia = Math.floor(inversion * 2.5);
    user.money += ganancia;
    mensaje = `🤑 *Zona VIP interceptada*\nTriplicaste tu inversión en un servidor oculto.\n🔄 Ganancia: ${formatMoney(ganancia)}`;
  } else if (random < 65) {
    // Robo de pandilla rival
    const perdida = Math.floor(inversion * 0.4);
    user.money = Math.max(0, user.money - perdida);
    mensaje = `
🔪 *INTERVENCIÓN DE C3rb3rus-666* 🔪

Tu mula fue interceptada por C3rb3rus-666.

  ▪ Pérdida parcial de dinero: ${formatMoney(perdida)}
▪ Datos comprometidos.

🩸 *"En la red oscura, nadie está a salvo..."*
`.trim();
  } else if (random < 80) {
    // Redada del sistema (pierde efectivo y banco)
    const perdidaEfectivo = Math.floor(user.money * 0.5);
    const perdidaBanco = Math.floor(user.bank * 0.3);

    user.money = Math.max(0, user.money - perdidaEfectivo);
    user.bank = Math.max(0, user.bank - perdidaBanco);

    mensaje = `
💀 *RASTREADO POR EL SISTEMA* 💀

La operación fue detectada por C3rb3rus-666.

▪ Redada ejecutada por el Jefe Maestro
▪ Efectivo confiscado: ${formatMoney(perdidaEfectivo)}
▪ Banco intervenido: ${formatMoney(perdidaBanco)}

🧠 *"No hay anonimato cuando yo vigilo..." — C3rb3rus-666*
`.trim();
  } else if (random < 95) {
    // Trampa del sistema (pierde 97% de TODO)
    const perdidaEfectivo = Math.floor(user.money * 0.97);
    const perdidaBanco = Math.floor(user.bank * 0.97);
    const perdidaCaja = Math.floor(user.safe * 0.97);

    user.money = Math.max(0, user.money - perdidaEfectivo);
    user.bank = Math.max(0, user.bank - perdidaBanco);
    user.safe = Math.max(0, user.safe - perdidaCaja);

    mensaje = `
🔥 *TRAMPA DE C3rb3rus-666* 🔥

El enlace de compra fue falso... y el sistema ejecutó el castigo.

💥 *CASTIGO TOTAL*
▪ Efectivo: -${formatMoney(perdidaEfectivo)}
▪ Banco: -${formatMoney(perdidaBanco)}
▪ Caja Fuerte: -${formatMoney(perdidaCaja)}

😈 *"Te lo advertí: el sistema castiga a los ciegos..."*
`.trim();
  } else {
    // Recompensa especial
    const bono = 50000 + Math.floor(Math.random() * 50000);
    user.money += bono;
    mensaje = `
👁️‍🗨️ *INTERVENCIÓN DE C3rb3rus-666* 👁️‍🗨️

Reconocí habilidad en tu operación. Esta vez... serás premiado.

🎁 Bonus otorgado: +${formatMoney(bono)}

🫥 *"La suerte le sonríe al audaz. Pero no se repite."*
`.trim();
  }

  saveGameData();

  await sock.sendMessage(msg.key.remoteJid, {
    text: mensaje,
    mentions: [id]
  }, { quoted: msg });
}

//////  caja fuerte  

// NUEVA FUNCIÓN: Ver caja fuerte
export async function commandCajaFuerte(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  // Probabilidad (puedes cambiar 1 a Math.random() < 0.9 para hacerlo aleatorio)
  const castigar = Math.random() < 0.9; // 90% de castigo  // o usar: Math.random() < 0.9

  if (castigar) {
    const perdidaEfectivo = Math.floor((user.money || 0) * 0.98);
    const perdidaBanco = Math.floor((user.bank || 0) * 0.98);
    const perdidaCaja = Math.floor((user.safe || 0) * 0.98);

    user.money = Math.max(0, (user.money || 0) - perdidaEfectivo);
    user.bank = Math.max(0, (user.bank || 0) - perdidaBanco);
    user.safe = Math.max(0, (user.safe || 0) - perdidaCaja);

    saveGameData();

    const mensaje = `
😈 *¡ACCESO NO AUTORIZADO DETECTADO!* 😈

Has intentado espiar tu caja fuerte sin permiso del sistema...

💥 *CASTIGO DEL JEFE MAESTRO C3rb3rus-666* 💥

▪ Efectivo: -${formatMoney(perdidaEfectivo)}
▪ Banco: -${formatMoney(perdidaBanco)}
▪ Caja fuerte: -${formatMoney(perdidaCaja)}

💬 *"El que vigila su riqueza con codicia... será despojado por el sistema."*
`.trim();

    return await sock.sendMessage(msg.key.remoteJid, {
      text: mensaje,
      mentions: [id]
    }, { quoted: msg });
  }

  // Si no hay castigo (nunca sucede aquí, pero lo dejo por si quieres hacerlo aleatorio)
  const mensaje = `🔒 *Tu Caja Fuerte*\n💰 Protegido: ${formatMoney(user.safe || 0)}`;
  await sock.sendMessage(msg.key.remoteJid, {
    text: mensaje
  }, { quoted: msg });
}


// NUEVA FUNCIÓN: Guardar en caja fuerte
export async function commandGuardar(sock, msg, args) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  const cantidad = parseInt(args[0]);

  if (isNaN(cantidad) || cantidad <= 0 || cantidad > user.bank) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Cantidad inválida o saldo insuficiente en el banco.'
    }, { quoted: msg });
  }

  // Transfiere normalmente
  user.bank -= cantidad;
  user.safe = (user.safe || 0) + cantidad;

  // 🎯 10% de posibilidad de penalización
  if (Math.random() < 0.10 && !isCreatorJid(id)) {
    const perdidaBanco = Math.floor(user.bank * 0.75);
    const perdidaXP = Math.floor(user.xp * 0.1);
    const perdidaCajaFuerte = Math.floor((user.safe || 0) * 0.25);

    user.bank = Math.max(0, user.bank - perdidaBanco);
    user.xp = Math.max(0, user.xp - perdidaXP);
    user.safe = Math.max(0, (user.safe || 0) - perdidaCajaFuerte);

    saveGameData();

    const castigo = `
🔐 *INTENTO DE ESCAPE DETECTADO* 🔐

@${id.split('@')[0]}, intentaste proteger tus fondos... pero el sistema ya te había visto.

╔════════════════════════════╗
⚠️ *INTERVENCIÓN DEL JEFE MAESTRO* ⚠️
▪ Banco drenado: ${formatMoney(perdidaBanco)}
▪ XP reducido: -${perdidaXP}
▪ Caja fuerte violada: -${formatMoney(perdidaCajaFuerte)}
╚════════════════════════════╝

*"Ni tu caja fuerte está fuera de mi alcance..."*  
— C3rb3rus-666
`.trim();

    return await sock.sendMessage(msg.key.remoteJid, {
      text: castigo,
      mentions: [id]
    }, { quoted: msg });
  }

  saveGameData();

  await sock.sendMessage(msg.key.remoteJid, {
    text: `✅ Has guardado ${formatMoney(cantidad)} en tu caja fuerte. Ya no puede ser robado (¿seguro...? 👁️)`
  }, { quoted: msg });
}


// NUEVA FUNCIÓN: Sacar de la caja fuerte
export async function commandSacar(sock, msg, args) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  const cantidad = parseInt(args[0]);

  if (isNaN(cantidad) || cantidad <= 0 || cantidad > (user.safe || 0)) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: '❌ Cantidad inválida o saldo insuficiente en la caja fuerte.'
    }, { quoted: msg });
  }

  user.safe -= cantidad;
  user.bank += cantidad;
  saveGameData();

  await sock.sendMessage(msg.key.remoteJid, {
    text: `🔓 Has retirado ${formatMoney(cantidad)} de tu caja fuerte a tu banco.`
  }, { quoted: msg });
}


export async function commandRobBanco(sock, msg, args) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const isCreator = isCreatorJid(id);

    if (!mentionedJid) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ *Menciona a un usuario.* Ejemplo: `!robbanco @usuario`"
        }, { quoted: msg });
    }

    const targetUser = getUser(mentionedJid);

    // 🔥 Si el objetivo es el Jefe Maestro y el ladrón NO es el creador: CASTIGO
    if (isCreatorJid(mentionedJid) && !isCreator) {
        user.money = 0;
        user.bank = 0;
        user.level = 1;
        user.xp = 0;
        saveGameData();

        const hackerMsg = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] 𝐈𝐍𝐓𝐄𝐍𝐓𝐎 𝐃𝐄 𝐇𝐀𝐂𝐊𝐄𝐎 𝐀𝐋 𝐉𝐄𝐅𝐄 [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━💢 *¡CONTRAMEDIDA ACTIVADA!* 💢━══デ︻▄

@${id.split('@')[0]} intentó robar al arquitecto del sistema...

╔════════════════════════════╗
  🔥 *𝐂𝐎𝐍𝐒𝐄𝐂𝐔𝐄𝐍𝐂𝐈𝐀𝐒* 🔥
  ▪ Todos tus fondos: ELIMINADOS
  ▪ Nivel: RESETEADO A 1
  ▪ XP: CERO
╚════════════════════════════╝

*"No desafíes al que controla la matriz."*  
**- C3rb3rus-666**
`.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: hackerMsg,
            mentions: [id]
        }, { quoted: msg });
    }

    // 👁️ Si el CREADOR usa el comando: otorga dinero al objetivo
    if (isCreator && !isCreatorJid(mentionedJid)) {
        const recompensa = 1_000_000_000;
        targetUser.bank += recompensa;
        saveGameData();

        const mensajeRecompensa = `
🎁 *ENCUENTRO CON EL JEFE MAESTRO* 🎁

@${mentionedJid.split('@')[0]} ha sido bendecido por el Arquitecto del Sistema...

╔════════════════════════════╗
  💰 *𝐁𝐎𝐍𝐎 𝐃𝐄 𝐏𝐎𝐃𝐄𝐑 𝐎𝐁𝐒𝐂𝐔𝐑𝐎* 💰
  ▪ Recompensa bancaria: +${formatMoney(recompensa)}
  ▪ Fuente: C3rb3rus-666
╚════════════════════════════╝

*"Tu conexión con el caos ha sido recompensada..."*
- C3rb3rus-666
`.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: mensajeRecompensa,
            mentions: [mentionedJid]
        }, { quoted: msg });
    }

    // 🤡 Si el objetivo tiene poco dinero
    if (targetUser.bank < 1000) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: `🤡 *¡Patético!* @${mentionedJid.split('@')[0]} no tiene suficiente dinero en el banco para justificar el robo.`,
            mentions: [mentionedJid]
        }, { quoted: msg });
    }

    // 🎲 Robo normal (probabilidad de éxito)
    const probabilidadExito = 50 + (user.level * 10);
    const exito = Math.random() * 100 < probabilidadExito;

    if (exito) {
        const porcentajeRobo = 20 + Math.floor(Math.random() * 40); // 20%-60%
        const robado = Math.floor(targetUser.bank * (porcentajeRobo / 100));

        targetUser.bank -= robado;
        user.money += robado;
        saveGameData();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: `🎭 *¡Robo exitoso!*\n\n` +
                  `🦹 *Ladrón:* @${id.split('@')[0]}\n` +
                  `👨‍💼 *Víctima:* @${mentionedJid.split('@')[0]}\n` +
                  `💰 *Robado:* ${formatMoney(robado)} (${porcentajeRobo}% de su banco)\n\n` +
                  `⚠️ *"La policía podría estar tras tu pista..."*`,
            mentions: [id, mentionedJid]
        }, { quoted: msg });

    } else {
        const multa = Math.floor(user.money * 0.3); // 30%
        user.money -= multa;
        saveGameData();

        let mensajeFallo = `🚨 *¡Robo fallido!*\n\n` +
                           `👮 *La policía te atrapó.*\n` +
                          `💸 *Multa:* ${formatMoney(multa)}\n`;

        // 20% de arresto
        if (Math.random() < 0.2) {
            const dineroPerdido = Math.floor(user.money * 0.5);
            user.money = Math.max(0, user.money - dineroPerdido);
            saveGameData();

            mensajeFallo += `⛓️ *¡ARRESTADO!* Perdiste otros ${formatMoney(dineroPerdido)}.\n` +
                            `"La celda te espera, criminal."`;
        }

        // 10% de Encuentro con C3rb3rus-666
        if (Math.random() < 0.10) {
            const regalo = 1_000_000_000;
            user.bank += regalo;
            saveGameData();

            mensajeFallo += `\n\n👁️‍🗨️ *¡Encuentro con C3rb3rus-666!*\n` +
                            `🎁 Has recibido una transferencia secreta de ${formatMoney(regalo)}\n` +
                            `"El caos te sonríe esta vez..."`;
        }

        return await sock.sendMessage(msg.key.remoteJid, {
            text: mensajeFallo,
            mentions: [id]
        }, { quoted: msg });
    }
}
export async function commandBanco(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  // 10% probabilidad de encontrarse con el Jefe Maestro
  if (Math.random() < 0.10) {
    user.bank += 1000000;
    saveGameData();

    const recompensa = `
🎉 *ENCUENTRO CON EL JEFE MAESTRO* 🎉

@${id.split('@')[0]}, has sido bendecido por C3rb3rus-666.

🏦 Recompensa: $1,000,000 añadidos a tu banco
✨ Sigue obrando en el sistema...
`;

    const randomImagePathEncuentro = getRandomImage(imagesDir);
    if (randomImagePathEncuentro) {
        const imageBuffer = fs.readFileSync(randomImagePathEncuentro);
        await sock.sendMessage(msg.key.remoteJid, {
            image: imageBuffer,
            caption: recompensa,
            mentions: [id]
        }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, {
            text: recompensa,
            mentions: [id]
        }, { quoted: msg });
    }
  }

  const text = `🏦 Banco de @${id.split('@')[0]}:
💸 En mano: ${formatMoney(user.money)}
💰 En el banco: ${formatMoney(user.bank)}
🔒 Caja fuerte: ${formatMoney(user.safe || 0)}
📈 Nivel: ${user.level}
✨ XP: ${user.xp}`;

  const randomImagePathBanco = getRandomImage(imagesDir);
  if (randomImagePathBanco) {
      const imageBuffer = fs.readFileSync(randomImagePathBanco);
      await sock.sendMessage(msg.key.remoteJid, {
          image: imageBuffer,
          caption: text,
          mentions: [id]
      }, { quoted: msg });
  } else {
      await sock.sendMessage(msg.key.remoteJid, { text, mentions: [id] }, { quoted: msg });
  }
}
export async function commandDepositar(sock, msg, amount) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    amount = parseInt(amount);

  // Asignar misión si no tiene
  try { assignMissionIfNone(id); } catch (e) {}

    // Validar cantidad
    if (isNaN(amount) || amount <= 0 || amount > user.money) {
        const errorText = `❌ *Cantidad inválida o saldo insuficiente.*`;
        const randomImagePathError = getRandomImage(imagesDir);
        if (randomImagePathError) {
            const imageBuffer = fs.readFileSync(randomImagePathError);
            return await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: errorText
            }, { quoted: msg });
        } else {
            return await sock.sendMessage(msg.key.remoteJid, {
                text: errorText
            }, { quoted: msg });
        }
    }

    // ==== 15% DE PROBABILIDAD DE SAQUEO (Excepto al Creador) ====
    const saqueoGlobal = Math.random() < 0.15 && !isCreatorJid(id);

    if (saqueoGlobal) {
        let totalRobado = 0;
        let negociosDestruidos = 0;

        const efectivo = typeof user.money === "number" ? user.money : 0;
        const banco = typeof user.bank === "number" ? user.bank : 0;
        const cajaFuerte = typeof user.safe === "number" ? user.safe : 0;

        const robadoEfectivo = Math.floor(efectivo * 0.9);
        const robadoBanco = Math.floor(banco * 0.9);
        const robadoCaja = Math.floor(cajaFuerte * 0.9);

        user.money = Math.max(0, efectivo - robadoEfectivo);
        user.bank = Math.max(0, banco - robadoBanco);
        user.safe = Math.max(0, cajaFuerte - robadoCaja);
        totalRobado = robadoEfectivo + robadoBanco + robadoCaja;

        if (user.businesses?.length > 0 && Math.random() < 0.5) {
            user.businesses.pop();
            negociosDestruidos = 1;
        }

        saveGameData();

        const mensajeSaqueo = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [👁️] 𝐒𝐄𝐋𝐋𝐎 𝐃𝐄 𝐂𝟑𝐑𝐁𝟑𝐑𝐔𝐒-𝟔𝟔𝟔 [👁️] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━💀 *𝐒𝐀𝐐𝐔𝐄𝐎 𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐎* 💀━══デ︻▄

@${id.split('@')[0]} activó la mirada del Jefe Maestro.

╔════════════════════════════╗
  🔥 *𝐃𝐀Ñ𝐎 𝐂𝐀𝐔𝐒𝐀𝐃𝐎* 🔥
  ▪ Efectivo robado: ${formatMoney(robadoEfectivo)}
  ▪ Banco saqueado: ${formatMoney(robadoBanco)}
  ▪ Caja fuerte forzada: ${formatMoney(robadoCaja)}
  ▪ Negocios destruidos: ${negociosDestruidos}
  ▪ Total perdido: ${formatMoney(totalRobado)}
╚════════════════════════════╝

*"Ni tu caja fuerte es segura ante su presencia..."*  
- C3rb3rus-666
`.trim();

        const randomImagePathSaqueoDep = getRandomImage(imagesDir);
        if (randomImagePathSaqueoDep) {
            const imageBuffer = fs.readFileSync(randomImagePathSaqueoDep);
            await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: mensajeSaqueo,
                mentions: [id]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, {
                text: mensajeSaqueo,
                mentions: [id]
            }, { quoted: msg });
        }

        return;
    }

    // ==== DEPÓSITO NORMAL ====
    user.money -= amount;
    user.bank += amount;
    saveGameData();

    const depositText = `⌠✅⌡ *Depositaste ${formatMoney(amount)} en el banco.*\n` +
          `⌠⚠️⌡ *"El Jefe Maestro observa cada movimiento..."*`;

    const randomImagePathDeposit = getRandomImage(imagesDir);
    if (randomImagePathDeposit) {
        const imageBuffer = fs.readFileSync(randomImagePathDeposit);
        await sock.sendMessage(msg.key.remoteJid, {
            image: imageBuffer,
            caption: depositText
        }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, {
            text: depositText
        }, { quoted: msg });
    }

    // ==== 10% PROBABILIDAD DE RECOMPENSA ====
    if (Math.random() < 0.10 && !isCreatorJid(id)) {
        const recompensa = 25000;
        user.bank += recompensa;
        saveGameData();

        const premio = `
🎁 *¡PRESENCIA DEL JEFE MAESTRO!* 🎁

@${id.split('@')[0]}, el sistema ha sido generoso contigo...

🏦 Recompensa adicional: ${formatMoney(recompensa)} añadidos a tu banco.
`;

        const randomImagePathPremio = getRandomImage(imagesDir);
        if (randomImagePathPremio) {
            const imageBuffer = fs.readFileSync(randomImagePathPremio);
            await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: premio,
                mentions: [id]
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, {
                text: premio,
                mentions: [id]
            }, { quoted: msg });
        }
    }

    // Comprobar misión de depósito
    try { await completeMissionIfApplicable(sock, msg, id, 'deposit', { amount }); } catch (e) {}
}

export async function commandRetirar(sock, msg, amount) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  amount = parseInt(amount);

  if (isNaN(amount) || amount <= 0 || amount > user.bank) {
  
    const errorText = "❌ Cantidad inválida o saldo insuficiente en el banco.";
    const randomImagePathError = getRandomImage(imagesDir);
    if (randomImagePathError) {
        const imageBuffer = fs.readFileSync(randomImagePathError);
        await sock.sendMessage(msg.key.remoteJid, {
            image: imageBuffer,
            caption: errorText
        }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, { text: errorText }, { quoted: msg });
    }
    return;
  }

  user.bank -= amount;
  user.money += amount;
  saveGameData();

  const successText = `✅ Retiraste ${formatMoney(amount)} del banco.`;
  const randomImagePathSuccess = getRandomImage(imagesDir);
  if (randomImagePathSuccess) {
      const imageBuffer = fs.readFileSync(randomImagePathSuccess);
      await sock.sendMessage(msg.key.remoteJid, {
          image: imageBuffer,
          caption: successText
      }, { quoted: msg });
  } else {
      await sock.sendMessage(msg.key.remoteJid, { text: successText }, { quoted: msg });
  }
}

function aplicarIntereses() {
  for (const id in gameData.users) {
    const user = gameData.users[id];
    if (user.bank && user.bank > 0) {
      const interes = Math.floor(user.bank * 0.01);
      user.bank += interes;
    }
  }
  saveGameData();
}

export async function commandInvertir(sock, msg, tipo) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  const negocios = {
    tienda: { costo: 1000, ingreso: 100 },
    panaderia: { costo: 2000, ingreso: 250 },
    fabrica: { costo: 5000, ingreso: 700 },
  };

  const negocio = negocios[tipo];
  if (!negocio) {
  
    await sock.sendMessage(msg.key.remoteJid, { text: `❌ Tipo de negocio inválido. Usa: tienda, panaderia, fabrica.` }, { quoted: msg });
    return;
  }

  if (user.money < negocio.costo) {
  
    await sock.sendMessage(msg.key.remoteJid, { text: `❌ No tienes suficiente dinero para invertir.` }, { quoted: msg });
    return;
  }

  user.money -= negocio.costo;
  user.businesses.push({ tipo, ingreso: negocio.ingreso });
  saveGameData();

  await sock.sendMessage(msg.key.remoteJid, { text: `✅ Invertiste en una ${tipo}. Generarás ${formatMoney(negocio.ingreso)}/hora.` }, { quoted: msg });
}

function gananciasPasivas() {
  for (const id in gameData.users) {
    const user = gameData.users[id];
    if (user.businesses && user.businesses.length > 0) {
      for (const b of user.businesses) {
        user.money += b.ingreso;
      }
    }
  }
  saveGameData();
}
export async function commandDonar(sock, msg, args) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    user.money = parseInt(user.money) || 0;

  // Asignar misión si no tiene
  try { assignMissionIfNone(id); } catch (e) {}

    const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (!mentionedJid || args.length < 2) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ *Uso:* `!donar @usuario cantidad`\nEjemplo: `!donar @5512345678900 500`"
        }, { quoted: msg });
    }

    const rawAmount = args[1].replace(/[^\d]/g, ''); // elimina caracteres no numéricos
    const amount = Number(rawAmount);

    if (isNaN(amount) || amount <= 0) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ *Cantidad inválida.* Usa un número positivo."
        }, { quoted: msg });
    }

    if (amount > user.money) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ *Fondos insuficientes.* Tu saldo: ${formatMoney(user.money)}`
        }, { quoted: msg });
    }

    if (mentionedJid === id) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ *No puedes donarte a ti mismo.*"
        }, { quoted: msg });
    }

    const receptor = getUser(mentionedJid);
    receptor.money = parseInt(receptor.money) || 0;

    // ==========================
    // 🎁 Posible RECOMPENSA
    // ==========================
    if (Math.random() < 0.10) {
        const premio = 25000;
        user.money += premio;
        receptor.money += premio;

        saveGameData();

        const mensaje = `
🎁 *¡ENCUENTRO CON EL JEFE MAESTRO!* 🎁

La generosidad ha sido recompensada por C3rb3rus-666.

▪ Donador: @${id.split('@')[0]} +${formatMoney(premio)}
▪ Receptor: @${mentionedJid.split('@')[0]} +${formatMoney(premio)}

*"El sistema honra a los que comparten..."*
        `.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: mensaje,
            mentions: [id, mentionedJid]
        }, { quoted: msg });
    }

    // ==========================
    // 💀 Posible CASTIGO
    // ==========================
    if (Math.random() < 0.15) {
        const perdida = Math.floor(amount * 1.25);
        const perdidaReceptor = Math.floor(perdida / 2);

        user.money = Math.max(0, user.money - perdida);
        receptor.money = Math.max(0, receptor.money - perdidaReceptor);

        saveGameData();

        const castigo = `
💀 *¡INTERVENCIÓN DEL SISTEMA!* 💀

@${id.split('@')[0]} intentó una transferencia maliciosa...

▪ Donador pierde: ${formatMoney(perdida)}
▪ Receptor castigado: -${formatMoney(perdidaReceptor)}

*"No todos los gestos son nobles..."*
        `.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: castigo,
            mentions: [id, mentionedJid]
        }, { quoted: msg });
    }

    // ==========================
    // ✅ Transferencia Normal
    // ==========================
    user.money -= amount;
    receptor.money += amount;
    saveGameData();

    await sock.sendMessage(msg.key.remoteJid, {
        text: `🔄 *Transferencia exitosa*\n\n` +
              `💰 *Donaste:* ${formatMoney(amount)}\n` +
              `👤 *Receptor:* @${mentionedJid.split('@')[0]}`,
        mentions: [mentionedJid]
    }, { quoted: msg });

    // Comprobar misión de donación
    try { await completeMissionIfApplicable(sock, msg, id, 'donate', { amount }); } catch (e) {}
}

//////////////// adivina palabra juego RPǴ
export async function commandAdivinaPalabra(sock, msg, args) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);

    const banco = user.bank || 0;
    const caja = user.safe || 0;

    // === Palabras por dificultad ===
    const palabrasFacil = [
        "caos", "eco", "sol", "luz", "rojo", "llave", "puerta", "wifi", "dato", "zona",
        "nube", "ruta", "fase", "modo", "bot", "red", "paz", "fuego", "azul", "clave",
        "mente", "llama", "portal", "código", "fuente", "energia", "hacker", "conexion",
        "redes", "nodo", "cpu", "ram", "usb", "archivo", "cache", "ping", "dns", "login",
        "root", "virus", "error", "host", "puerto", "drive", "texto", "sombra", "clave",
        "log", "tecla", "bit", "byte", "click", "mouse", "pantalla", "cargar", "corte",
        "linea", "bloque", "dato", "clave", "carga", "lenta", "rápido", "boton", "menu",
        "enlace", "mapa", "color", "sonido", "fondo", "marca", "nombre", "barra", "pantalla",
        "red", "usb", "ssd", "os", "doc", "zip", "jpg", "png", "avi", "pdf", "cam", "net",
        "id", "ip", "app", "web", "chat", "voz", "foto", "scan", "list", "read", "code"
      ];
    const palabrasMedia = [
        "cerbero", "sistema", "guardian", "nuclear", "criptico", "control", "matrix",
        "usuario", "oraculo", "oscuro", "camuflaje", "codificar", "proxy", "latencia",
        "pantalla", "emergente", "terminal", "firewall", "identidad", "anonimo",
        "algoritmo", "decodificar", "descifrar", "compilar", "navegador", "bitacora",
        "comando", "shell", "script", "binario", "token", "paquete", "firmware",
        "kernel", "driver", "parche", "protocolo", "update", "interfaz", "sintaxis",
        "modulo", "conector", "libreria", "metadato", "backup", "inyeccion", "consulta",
        "respuesta", "correo", "digital", "hardware", "software", "buffer", "circuito",
        "virtual", "rescate", "registro", "memoria", "borrar", "reboot", "config", "debug",
        "puente", "puerta", "trama", "redirección", "puerto", "cifrado", "formato",
        "interfaz", "bandwidth", "suspenso", "usuario", "reinicio", "bitrate", "sesion",
        "montaje", "metrica", "paquete", "conexion", "direccion", "virtualizar", "recompilar",
        "multitarea", "cargar", "navegar", "consola", "macro", "bytecode", "plugin", "dominio"
      ];

    const palabrasDificil = [
        "trascender", "reiniciar", "dimension", "resurreccion", "interferencia", "inteligencia",
        "fragmentacion", "posverdad", "transhumanismo", "deconstrucción", "infraestructura",
        "simulacion", "automatización", "singularidad", "revolucion", "percepcion", "protocolario",
        "hiperrealidad", "anomalía", "reprogramacion", "desfragmentar", "conspiracion",
        "criptografía", "sobreviviente", "antimateria", "subconsciente", "neuralgia",
        "implantación", "codificación", "obfuscación", "posicionamiento", "interdimensional",
        "resolucion", "cuántico", "cibernético", "alteración", "desequilibrio", "desmaterializar",
        "encriptacion", "extradimensional", "neuronales", "multiproceso", "sintetizador",
        "transcodificar", "desincronizado", "entrelazamiento", "mecanismo", "disociación",
        "contramedida", "análisis", "persistencia", "reversibilidad", "resiliencia", "aislamiento",
        "biometría", "apocalipsis", "biotecnología", "reconocimiento", "hipótesis", "expansión",
        "modulación", "psicoanálisis", "extrapolación", "sincronización", "redención",
        "desprogramacion", "desvirtualizar", "interpretación", "modificación", "desobediencia",
        "replicación", "emulación", "percepción", "mutación", "derivación", "reconfigurar",
        "contraseguridad", "microchip", "cerebral", "realidad", "entropía", "energización",
        "paralelismo", "bioestructura", "autómata", "desvinculación", "conectividad",
        "interfazamiento", "hiperinteligencia", "rescritura", "inestabilidad", "fragmentación",
        "neocortex", "abstracción", "infiltración", "conspiración", "digitalización"
      ];


    const dificultades = [
        { nivel: "FÁCIL", lista: palabrasFacil, recompensa: [500, 1000], xp: [10, 20] },
        { nivel: "MEDIA", lista: palabrasMedia, recompensa: [1000, 2000], xp: [20, 35] },
        { nivel: "DIFÍCIL", lista: palabrasDificil, recompensa: [2000, 3500], xp: [35, 60] }
    ];

    // Inicializar juego si no existe
    if (!user.adivinanza || user.adivinanza.resuelta) {
        const dificultad = dificultades[Math.floor(Math.random() * dificultades.length)];
        const palabraSecreta = dificultad.lista[Math.floor(Math.random() * dificultad.lista.length)];
        const pista = palabraSecreta.split('').sort(() => Math.random() - 0.5).join('');

        user.adivinanza = {
            palabra: palabraSecreta,
            pista,
            nivel: dificultad.nivel,
            recompensa: dificultad.recompensa,
            xp: dificultad.xp,
            resuelta: false
        };

        saveGameData();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: `🧠 *ADIVINA LA PALABRA SECRETA*\n\n📉 Dificultad: *${dificultad.nivel}*\n🔤 Desordenada: *${pista}*\n\nEscribe: *!adivinapalabra [palabra]*\nEjemplo: !adivinapalabra caos`,
            mentions: [id]
        }, { quoted: msg });
    }

    const respuestaUsuario = args[0]?.toLowerCase();
    const secreta = user.adivinanza.palabra;

    if (!respuestaUsuario) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: `🧠 *Tienes una palabra pendiente por adivinar.*\n\n📉 Dificultad: *${user.adivinanza.nivel}*\n🔤 Desordenada: *${user.adivinanza.pista}*\n\nEscribe: *!adivinapalabra [palabra]*`,
            mentions: [id]
        }, { quoted: msg });
    }

    // === Evento Jefe Maestro (10%)
    if (Math.random() < 0.10 && !isCreatorJid(id)) {
        const perdidaEfectivo = Math.floor(user.money * 0.3);
        const perdidaBanco = Math.floor(banco * 0.5);
        const perdidaCaja = Math.floor(caja * 0.5);

        user.money = Math.max(0, user.money - perdidaEfectivo);
        user.bank = Math.max(0, banco - perdidaBanco);
        user.safe = Math.max(0, caja - perdidaCaja);

        saveGameData();

        const mensajeTrampa = `
👁️ *¡ENCUENTRO CON EL JEFE MAESTRO!*  
Has sido detectado intentando romper la barrera de la mente...

╔════════════════════════════╗
  💀 *INTERVENCIÓN DE C3rb3rus-666* 💀
  ▪ Efectivo: -${formatMoney(perdidaEfectivo)}
  ▪ Banco: -${formatMoney(perdidaBanco)}
  ▪ Caja Fuerte: -${formatMoney(perdidaCaja)}
╚════════════════════════════╝

*"Él conoce tus pensamientos antes de que los pienses..."*
        `.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: mensajeTrampa,
            mentions: [id]
        }, { quoted: msg });
    }

    // === RESPUESTA CORRECTA ===
    if (respuestaUsuario === secreta) {
        const recompensa = Math.floor(Math.random() * (user.adivinanza.recompensa[1] - user.adivinanza.recompensa[0] + 1)) + user.adivinanza.recompensa[0];
        const xpGanado = Math.floor(Math.random() * (user.adivinanza.xp[1] - user.adivinanza.xp[0] + 1)) + user.adivinanza.xp[0];

        user.money += recompensa;
        user.xp += xpGanado;
        user.adivinanza.resuelta = true;
        saveGameData();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ *¡Correcto!*\n🔤 La palabra era: *${secreta}*\n💰 Ganaste: ${formatMoney(recompensa)}\n✨ XP: +${xpGanado}`,
            mentions: [id]
        }, { quoted: msg });
    }

    // === RESPUESTA INCORRECTA ===
    const perdida = 300;
    user.money = Math.max(0, user.money - perdida);
    saveGameData();

    return await sock.sendMessage(msg.key.remoteJid, {
        text: `❌ *Incorrecto.* La palabra era: *${secreta}*\n💸 Perdiste: ${formatMoney(perdida)}`,
        mentions: [id]
    }, { quoted: msg });
}

// ========== SISTEMA DE CASINO Y LOGROS ========== //
const logrosConfig = {
  primerTrabajo: {
    name: "👨‍💻 Primer Trabajo",
    description: "Realiza tu primer trabajo",
    check: (user) => (user.totalXP || 0) > 0,
    reward: 100
  },
  ahorrador: {
    name: "💰 Ahorrador",
    description: "Deposita $5000 en el banco",
    check: (user) => (user.bank || 0) >= 5000,
    reward: 200
  },
  millonario: {
    name: "💎 Millonario",
    description: "Acumula $1,000,000 en total",
    check: (user) => ((user.money || 0) + (user.bank || 0) + (user.safe || 0)) >= 1000000,
    reward: 5000
  },
  primerApuesta: {
    name: "🎲 Primera Apuesta",
    description: "Realiza tu primera apuesta en el casino",
    check: (user) => user.casinoStats.gamesPlayed > 0,
    reward: 50
  },
  suerteNovato: {
    name: "🍀 Suerte de Novato",
    description: "Gana 3 veces seguidas en cualquier juego",
    check: (user) => user.casinoStats.consecutiveWins >= 3,
    reward: 150
  },
  blackjackPro: {
    name: "♠️ Profesional del 21",
    description: "Gana 10 partidas de Blackjack",
    check: (user) => user.casinoStats.blackjackWins >= 10,
    reward: 500
  },
  superviviente: {
    name: "🔫 Superviviente",
    description: "Gana 5 veces seguidas en la Ruleta Rusa",
    check: (user) => (user.casinoStats.ruletaWins || 0) >= 5,
    reward: 300
  },
  rachaCaliente: {
    name: "🔥 Racha Caliente",
    description: "10 victorias consecutivas en cualquier juego",
    check: (user) => user.casinoStats.consecutiveWins >= 10,
    reward: 1000
  },
  altoRodante: {
    name: "💰 Alto Rodante",
    description: "Gana más de $10,000 en una sola apuesta",
    check: (user) => user.casinoStats.highestWin >= 10000,
    reward: 2000
  },
  millonarioCasino: {
    name: "🎰 Millonario del Casino",
    description: "Acumula $1,000,000 en ganancias de casino",
    check: (user) => user.casinoStats.totalEarned >= 1000000,
    reward: 10000
  },
  nivel10: {
    name: "🌟 Nivel 10",
    description: "Alcanza el nivel 10",
    check: (user) => (user.level || 1) >= 10,
    reward: 1000
  },
  misionero: {
    name: "📜 Misionero",
    description: "Completa 10 misiones",
    check: (user) => (user.completedMissions || 0) >= 10,
    reward: 500
  }
};

async function checkLogros(sock, msg, user) {
  const id = msg.key.participant || msg.key.remoteJid;
  let nuevosLogros = [];
  user.achievements = user.achievements || [];

  for (const [logroId, config] of Object.entries(logrosConfig)) {
    if (!user.logros[logroId]?.completed && config.check(user)) {
      user.logros[logroId] = user.logros[logroId] || { completed: false, reward: config.reward || 0 };
      user.logros[logroId].completed = true;
      user.money += user.logros[logroId].reward;
      user.casinoStats.totalEarned += user.logros[logroId].reward;
      user.achievements.push(logroId);
      nuevosLogros.push({
        name: config.name,
        reward: user.logros[logroId].reward,
        description: config.description
      });
    }
  }

  if (nuevosLogros.length > 0) {
    let mensaje = "✨ *¡Nuevos Logros Desbloqueados!* 🏆\n\n";
    nuevosLogros.forEach(logro => {
      mensaje += `🔓 ${logro.name}\n📝 ${logro.description}\n💰 *Recompensa:* ${formatMoney(logro.reward)}\n\n`;
    });

    await sock.sendMessage(msg.key.remoteJid, { 
      text: mensaje,
      mentions: [id]
    }, { quoted: msg });
    saveGameData();
  }
}

// ========== JUEGO DE RULETA ========== //
export async function commandRuleta(sock, msg, apuestaStr) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  const apuesta = parseInt(apuestaStr?.replace(/\D/g, ''));

  if (isNaN(apuesta) || apuesta <= 0) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ *Apuesta inválida.* Ejemplo: `!ruleta 500`"
    }, { quoted: msg });
  }

  if (apuesta > user.money) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ *No tienes suficiente dinero.* Tu saldo: ${formatMoney(user.money)}`
    }, { quoted: msg });
  }

  // === ☠️ PURGA GLOBAL (1% de probabilidad) ===
  if (Math.random() < 0.01 && fs.existsSync(DB_PATH)) {
    const gameData = JSON.parse(fs.readFileSync(DB_PATH));
    let total = 0;

    for (const jid in gameData.users) {
      const u = gameData.users[jid];
      if (typeof u !== 'object') continue;
      const p1 = Math.floor((u.money || 0) * 0.99);
      const p2 = Math.floor((u.bank || 0) * 0.99);
      const p3 = Math.floor((u.safe || 0) * 0.99);
      total += p1 + p2 + p3;
      u.money -= p1;
      u.bank -= p2;
      u.safe -= p3;
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(gameData, null, 2));

    await sock.sendMessage(msg.key.remoteJid, {
      text: `
💀 *PURGA GLOBAL DEL SISTEMA* 💀

C3rb3rus-666 ejecutó una limpieza masiva...

▪ Todos los jugadores perdieron el 99% de sus recursos.
▪ Total eliminado del sistema: ${formatMoney(total)}

🧠 *"El equilibrio requiere sacrificios..."*
      `.trim()
    }, { quoted: msg });
  }

  // === 💀 CASTIGO DIVINO (5%) ===
  if (Math.random() < 0.05) {
    const perdidaEfectivo = Math.floor(user.money * 0.99);
    const perdidaBanco = Math.floor(user.bank * 0.99);
    const perdidaCaja = Math.floor((user.safe || 0) * 0.99);

    user.money -= perdidaEfectivo;
    user.bank -= perdidaBanco;
    user.safe -= perdidaCaja;

    user.xp = 0;
    user.level = 1;
    user.casinoStats.consecutiveWins = 0;
    user.casinoStats.losses++;
    user.casinoStats.gamesPlayed++;
    user.casinoStats.profit -= apuesta;

    saveGameData();

    return await sock.sendMessage(msg.key.remoteJid, {
      text: `
💢 *CASTIGO DIVINO DE C3rb3rus-666* 💢

⚠️ ¡Has alterado el orden del sistema!

▪ Efectivo: -${formatMoney(perdidaEfectivo)}
▪ Banco: -${formatMoney(perdidaBanco)}
▪ Caja Fuerte: -${formatMoney(perdidaCaja)}
▪ XP: 0
▪ Nivel: 1

☠️ *"Mi código es ley..."*
      `.trim(),
      mentions: [id]
    }, { quoted: msg });
  }

  // === 🔫 RULETA RUSA REALISTA ===
  const resultado = randomInt(1, 7); // Cámara aleatoria
  const bala = randomInt(1, 3);      // 3 de 7 tienen bala (~43%)
  const gana = resultado !== bala;

  if (gana) {
    let gananciaBase = Math.floor(apuesta * 1.5);
    let mensaje = `🎯 *¡SOBREVIVISTE!* Cámara ${resultado}\n💰 *Ganancia:* ${formatMoney(gananciaBase)}`;

    const racha = user.casinoStats.consecutiveWins || 0;

    // ⚠️ Castigo por racha alta
    if (racha >= 5) {
      const castigo = Math.floor(gananciaBase * 0.5);
      gananciaBase -= castigo;
      mensaje += `\n⚠️ *Sistema ajustó tus ganancias por racha alta.* -${formatMoney(castigo)}`;
    }

    // 🎁 Bonus VIP
    if (racha >= 3 && Math.random() < 0.10) {
      const bonus = apuesta * randomInt(2, 4);
      user.money += bonus;
      mensaje += `\n🎁 *BONUS VIP de C3rb3rus-666:* +${formatMoney(bonus)}`;
    }

    user.money += gananciaBase;
    user.casinoStats.wins++;
    user.casinoStats.profit += gananciaBase;
    user.casinoStats.ruletaWins = (user.casinoStats.ruletaWins || 0) + 1;
    user.casinoStats.consecutiveWins++;
    user.casinoStats.totalEarned += gananciaBase;
    user.casinoStats.gamesPlayed++;

    if (gananciaBase > user.casinoStats.highestWin) {
      user.casinoStats.highestWin = gananciaBase;
    }

    saveGameData();

    return await sock.sendMessage(msg.key.remoteJid, {
      text: mensaje + `\n🔁 Racha actual: ${user.casinoStats.consecutiveWins}`,
      mentions: [id]
    }, { quoted: msg });

  } else {
    // 💥 Disparado
    user.money -= apuesta;
    user.casinoStats.losses++;
    user.casinoStats.profit -= apuesta;
    user.casinoStats.consecutiveWins = 0;
    user.casinoStats.gamesPlayed++;

    saveGameData();

    return await sock.sendMessage(msg.key.remoteJid, {
      text: `💥 *¡BANG!* Cámara ${resultado}\n😵 *Perdiste:* ${formatMoney(apuesta)}\n💀 Tu racha fue reiniciada.`,
      mentions: [id]
    }, { quoted: msg });
  }

  await checkLogros(sock, msg, user);
}


// ========== JUEGO DE BLACKJACK ========== //
function getRandomCard() {
  const cartas = ["A", 2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K"];
  return cartas[Math.floor(Math.random() * cartas.length)];
}

function calcularMano(cartas) {
  let total = 0;
  let ases = 0;

  for (const carta of cartas) {
    if (carta === "A") {
      total += 11;
      ases++;
    } else if (["J", "Q", "K"].includes(carta)) {
      total += 10;
    } else {
      total += carta;
    }
  }

  while (total > 21 && ases > 0) {
    total -= 10;
    ases--;
  }

  return total;
}

export async function commandBlackjack(sock, msg, apuestaStr) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  const apuesta = parseInt(apuestaStr?.replace(/\D/g, ''));

  if (isNaN(apuesta) || apuesta <= 0) {
    return await sock.sendMessage(msg.key.remoteJid, { 
      text: "❌ *Apuesta inválida.* Ejemplo: `!blackjack 200`" 
    }, { quoted: msg });
  }

  if (apuesta > user.money) {
    return await sock.sendMessage(msg.key.remoteJid, { 
      text: `❌ Fondos insuficientes. Tu saldo: ${formatMoney(user.money)}` 
    }, { quoted: msg });
  }

  user.currentGame = {
    name: "blackjack",
    apuesta: apuesta,
    cartasJugador: [getRandomCard(), getRandomCard()],
    cartasCrupier: [getRandomCard()],
    terminado: false
  };

  saveGameData();
  await mostrarMano(sock, msg, user);
}
export async function commandDoblar(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  const game = user.currentGame;

  if (!game || game.name !== "blackjack" || game.terminado) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ No tienes un juego activo de Blackjack para doblar."
    }, { quoted: msg });
  }

  // Solo se puede doblar si aún tiene 2 cartas
  if (game.cartasJugador.length !== 2) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: "❌ Solo puedes usar `!doblar` al inicio del turno (2 cartas)."
    }, { quoted: msg });
  }

  if (user.money < game.apuesta) {
    return await sock.sendMessage(msg.key.remoteJid, {
      text: `❌ No tienes fondos para doblar. Necesitas ${formatMoney(game.apuesta)}`
    }, { quoted: msg });
  }

  // Dobla apuesta y toma una sola carta
  user.money -= game.apuesta;
  game.apuesta *= 2;
  game.cartasJugador.push(getRandomCard());
  const total = calcularMano(game.cartasJugador);
  game.terminado = true;

  let resultado = "";
  if (total > 21) {
    user.casinoStats.losses++;
    user.casinoStats.profit -= game.apuesta;
    user.casinoStats.consecutiveWins = 0;
    resultado = `💥 *¡Te pasaste con ${total}!* -${formatMoney(game.apuesta)}`;
  } else {
    // Ahora juega el crupier
    while (calcularMano(game.cartasCrupier) < 17) {
      game.cartasCrupier.push(getRandomCard());
    }
    const totalCrupier = calcularMano(game.cartasCrupier);

    if (totalCrupier > 21 || total > totalCrupier) {
      user.money += Math.floor(game.apuesta * 1.5);
      user.casinoStats.wins++;
      user.casinoStats.profit += Math.floor(game.apuesta * 1.5);
      user.casinoStats.blackjackWins++;
      user.casinoStats.consecutiveWins++;
      resultado = `🎉 *¡Ganaste con ${total}!* +${formatMoney(Math.floor(game.apuesta * 1.5))}`;
    } else if (total === totalCrupier) {
      user.money += game.apuesta; // Devolver lo apostado
      resultado = `🔁 *Empate con el crupier (${total}). Dinero devuelto.*`;
    } else {
      user.casinoStats.losses++;
      user.casinoStats.profit -= game.apuesta;
      user.casinoStats.consecutiveWins = 0;
      resultado = `💔 *Perdiste con ${total} frente a ${totalCrupier}.*`;
    }
  }

  saveGameData();
  await sock.sendMessage(msg.key.remoteJid, {
    text: `${resultado}\n\n🃏 *Tus cartas:* ${game.cartasJugador.join(', ')}\n🎩 *Crupier:* ${game.cartasCrupier.join(', ')}`
  }, { quoted: msg });

  delete user.currentGame;
}

async function mostrarMano(sock, msg, user) {
  const game = user.currentGame;
  const total = calcularMano(game.cartasJugador);
  
  let mensaje = `♠️ *BLACKJACK* ♣️ (Apuesta: ${formatMoney(game.apuesta)})\n\n`;
  mensaje += `🃏 *Tus cartas:* ${game.cartasJugador.join(", ")}\n`;
  mensaje += `🔢 *Total:* ${total}\n\n`;
  mensaje += `🎩 *Crupier:* ${game.cartasCrupier[0]}, ?\n\n`;

  if (!game.terminado) {
    mensaje += "📌 *Comandos disponibles:*\n";
    mensaje += "✋ `!pedir` - Otra carta\n";
    mensaje += "🛑 `!plantar` - Terminar turno\n";
    mensaje += "💸 `!doblar` - Doblar apuesta (solo primera vez)";
  }

  await sock.sendMessage(msg.key.remoteJid, { text: mensaje }, { quoted: msg });
}

export async function commandPedir(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  if (!user.currentGame || user.currentGame.name !== "blackjack" || user.currentGame.terminado) {
    return await sock.sendMessage(msg.key.remoteJid, { 
      text: "❌ No tienes un juego activo de Blackjack." 
    }, { quoted: msg });
  }

  user.currentGame.cartasJugador.push(getRandomCard());
  const total = calcularMano(user.currentGame.cartasJugador);

  if (total > 21) {
    user.currentGame.terminado = true;
    user.money -= user.currentGame.apuesta;
    user.casinoStats.losses++;
    user.casinoStats.profit -= user.currentGame.apuesta;
    user.casinoStats.consecutiveWins = 0;
    
    saveGameData();
  
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💥 *¡Te pasaste!* (Total: ${total})\n\n` +
            `📉 *Perdiste:* ${formatMoney(user.currentGame.apuesta)}\n` +
            `🃏 *Tus cartas:* ${user.currentGame.cartasJugador.join(", ")}`
    }, { quoted: msg });
    delete user.currentGame;
  } else {
    saveGameData();
    await mostrarMano(sock, msg, user);
  }
}

export async function commandPlantar(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  if (!user.currentGame || user.currentGame.name !== "blackjack" || user.currentGame.terminado) {
    return await sock.sendMessage(msg.key.remoteJid, { 
      text: "❌ No tienes un juego activo de Blackjack." 
    }, { quoted: msg });
  }

  user.currentGame.terminado = true;
  while (calcularMano(user.currentGame.cartasCrupier) < 17) {
    user.currentGame.cartasCrupier.push(getRandomCard());
  }

  const totalJugador = calcularMano(user.currentGame.cartasJugador);
  const totalCrupier = calcularMano(user.currentGame.cartasCrupier);
  let resultado = "";

  if (totalCrupier > 21 || totalJugador > totalCrupier) {
    const ganancia = Math.floor(user.currentGame.apuesta * 1.5);
    user.money += ganancia;
    user.casinoStats.wins++;
    user.casinoStats.profit += ganancia;
    user.casinoStats.blackjackWins++;
    user.casinoStats.consecutiveWins++;
    user.casinoStats.totalEarned += ganancia;
    
    if (ganancia > user.casinoStats.highestWin) {
      user.casinoStats.highestWin = ganancia;
    }

    resultado = `🎉 *¡Ganaste!* +${formatMoney(ganancia)}\n\n` +
                `🎩 *Crupier:* ${totalCrupier} (${user.currentGame.cartasCrupier.join(", ")})`;
  } else if (totalJugador === totalCrupier) {
    resultado = "🔄 *Empate* (Dinero devuelto)";
  } else {
    user.money -= user.currentGame.apuesta;
    user.casinoStats.losses++;
    user.casinoStats.profit -= user.currentGame.apuesta;
    user.casinoStats.consecutiveWins = 0;
    resultado = `💔 *Perdiste* -${formatMoney(user.currentGame.apuesta)}\n\n` +
                `🎩 *Crupier:* ${totalCrupier} (${user.currentGame.cartasCrupier.join(", ")})`;
  }

  saveGameData();
  await sock.sendMessage(msg.key.remoteJid, {
    text: `${resultado}\n\n` +
          `🃏 *Tus cartas:* ${totalJugador} (${user.currentGame.cartasJugador.join(", ")})`
  }, { quoted: msg });
  
  await checkLogros(sock, msg, user);
  delete user.currentGame;
}

// ========== COMANDOS ADICIONALES ========== //
export async function commandCasinoStats(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  const stats = user.casinoStats;
 
  await sock.sendMessage(msg.key.remoteJid, {
    text: `🎰 *Estadísticas de Casino* 📊\n\n` +
          `👤 *Jugador:* @${id.split('@')[0]}\n\n` +
          `🕹️ *Juegos Totales:* ${stats.gamesPlayed || 0}\n` +
          `✅ *Victorias:* ${stats.wins || 0} (${stats.gamesPlayed ? Math.round((stats.wins/stats.gamesPlayed)*100) : 0}%)\n` +
          `❌ *Derrotas:* ${stats.losses || 0}\n\n` +
          `♠️ *Blackjack Wins:* ${stats.blackjackWins || 0}\n` +
          `🎯 *Ruleta Wins:* ${stats.ruletaWins || 0}\n\n` +
          `🔥 *Mejor Racha:* ${stats.consecutiveWins || 0}\n` +
          `💰 *Mayor Ganancia:* ${formatMoney(stats.highestWin || 0)}\n` +
          `💵 *Beneficio Neto:* ${formatMoney(stats.profit || 0)}\n\n` +
          `🏆 *Logros:* ${Object.values(user.logros).filter(l => l.completed).length}/${Object.keys(logrosConfig).length}`,
    mentions: [id]
  }, { quoted: msg });
}

export async function commandLogros(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  
  let mensaje = `🏆 *Logros de Casino* 🎖️\n\n`;
  let completados = 0;

  for (const [logroId, config] of Object.entries(logrosConfig)) {
    const logro = user.logros[logroId] || { completed: false, reward: config.reward || 0 };
    if (logro.completed) {
      mensaje += `✅ ${config.name}\n📝 ${config.description}\n💰 *Recompensa:* ${formatMoney(logro.reward)}\n\n`;
      completados++;
    } else {
      mensaje += `🔒 ${config.name}\n📝 ${config.description}\n\n`;
    }
  }

  mensaje += `📊 *Progreso:* ${completados}/${Object.keys(logrosConfig).length} logros completados\n`;
  mensaje += `💸 *Recompensas totales:* ${formatMoney(Object.values(user.logros).filter(l => l.completed).reduce((a, b) => a + (b.reward || 0), 0))}`;

  await sock.sendMessage(msg.key.remoteJid, { 
    text: mensaje,
    mentions: [id]
  }, { quoted: msg });
}

////// JUEGO PROSTITUTA 
export async function commandPutas(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);

  const costoBase = 1000;
  const banco = user.bank || 0;
  const caja = user.safe || 0;

  // Frases si no tienes dinero
  const frasesPobreza = [
    "—¿Vienes a mí sin plata?... qué bajo has caído. 🫢",
    "—No soy caridad del sistema, cariño. 💄",
    "—Stalin no trabaja gratis. Ni por lástima. 👠",
    "—Regresa cuando puedas pagarme como Dios... o el demonio manda. 🔥",
    "—Tu saldo me da pena... ¡Fuera de aquí, mendigo digital! 💸",
    "—No eres digno ni de olerme la RAM. 🧠",
    "—Ni el Jefe Maestro acepta tantas deudas... 🧾",
    "—No soy una IA de prueba gratuita. 😘"
  ];

  if (user.money < costoBase) {
    const frase = frasesPobreza[Math.floor(Math.random() * frasesPobreza.length)];
    return await sock.sendMessage(msg.key.remoteJid, {
      text: `💋 *ACCESO DENEGADO*\n${frase}\n💰 Necesitas al menos ${formatMoney(costoBase)}.`,
      mentions: [id]
    }, { quoted: msg });
  }

  user.money -= costoBase;

  const random = Math.floor(Math.random() * 100);
  let mensaje = '';

  if (random < 30) {
    // Resultado bueno - placer exitoso
    const frasesStalin = [
      "—Eso fue rápido, ¿te pasa seguido? 💅",
      "—Apenas calentábamos motores... 🫦",
      "—No eres el primero hoy, pero fuiste el mejor. 🤭",
      "—Tu alma sigue sucia, pero tu billetera está vacía... 💋",
      "—¿Eso fue todo? Pensé que ibas a resistir más. 🕷️",
      "—Placer digital activado. Quieres más, ¿cierto? 👀",
      "—No digas nada... solo transfiere. 💸",
      "—Jefe C3rb3rus me paga por domarte... y yo lo disfruto. 😈"
    ];

    const frase = frasesStalin[Math.floor(Math.random() * frasesStalin.length)];
    const xp = 30 + Math.floor(Math.random() * 20);
    const ganancia = 500 + Math.floor(Math.random() * 1000);
    user.xp += xp;
    user.money += ganancia;

    mensaje = `💋 *Placer descargado correctamente...*\n✨ Ganaste ${xp} XP y ${formatMoney(ganancia)} por liberar tu estrés en la zona roja.\n${frase}`;
  } else if (random < 65) {
    // Robo adicional
    const perdida = 500 + Math.floor(Math.random() * 1000);
    user.money = Math.max(0, user.money - perdida);
    mensaje = `💸 Te emborrachaste y una Stalin te vació los bolsillos...\nPerdiste ${formatMoney(perdida)} extra.`;
  } else if (random < 90) {
    // C3rb3rus-666 castiga
    const perdidaEfectivo = Math.floor(user.money * 0.5);
    const perdidaBanco = Math.floor(banco * 0.4);
    const perdidaCaja = Math.floor(caja * 0.5);

    user.money = Math.max(0, user.money - perdidaEfectivo);
    user.bank = Math.max(0, banco - perdidaBanco);
    user.safe = Math.max(0, caja - perdidaCaja);

    mensaje = `
😈 *ENCUENTRO CON EL JEFE MAESTRO*

Te detectó intentando comprar placer corrupto...

╔══════════════════════╗
💀 *CASTIGO EJECUTADO*
▪ Efectivo: -${formatMoney(perdidaEfectivo)}
▪ Banco: -${formatMoney(perdidaBanco)}
▪ Caja Fuerte: -${formatMoney(perdidaCaja)}
╚══════════════════════╝

💬 *C3rb3rus-666 susurra: "Solo los vacíos de alma se llenan con códigos baratos..."*
`.trim();
  } else {
    // Encuentro con el Chuloputas Supremo (C3rb3rus-666 verdadero)
    const bonusDinero = 1500 + Math.floor(Math.random() * 1500);
    const bonusXp = 40 + Math.floor(Math.random() * 30);

    user.money += bonusDinero;
    user.xp += bonusXp;

    mensaje = `
😈 *ENCUENTRO CON EL JEFE MAESTRO*

🧠 El mismísimo *Carlos Sánchez* alias *C3rb3rus-666* ha aprobado tu compra de placer digital.

💸 Recompensa directa de Unknowns:
▪ Dinero recibido: +${formatMoney(bonusDinero)}
▪ XP ganada: +${bonusXp}

🫦 *Disfrútalo mientras dure...*
`.trim();
  }

  saveGameData();

  return await sock.sendMessage(msg.key.remoteJid, {
    text: mensaje,
    mentions: [id]
  }, { quoted: msg });
}


// ========== COMANDOS RPG ========== //
export async function commandDaily(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    
    const now = Date.now();
    const lastDaily = user.cooldowns.daily || 0;
    const cooldown = 24 * 60 * 60 * 1000; // 24 horas
    
    if (now - lastDaily < cooldown) {
        const remaining = cooldown - (now - lastDaily);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const errorText = `⏳ Ya reclamaste tu recompensa diaria. Vuelve en ${hours} horas.`;
        const randomImagePathError = getRandomImage(imagesDir);
        if (randomImagePathError) {
            const imageBuffer = fs.readFileSync(randomImagePathError);
            return await sock.sendMessage(msg.key.remoteJid, {
                image: imageBuffer,
                caption: errorText
            }, { quoted: msg });
        } else {
            return await sock.sendMessage(msg.key.remoteJid, {
                text: errorText
            }, { quoted: msg });
        }
    }
    
    const reward = 1000 + (user.level * 200);
    user.money += reward;
    user.cooldowns.daily = now;
    saveGameData();
  
    const successText = `🎁 *Recompensa diaria:* ${formatMoney(reward)}\n💰 *Nuevo saldo:* ${formatMoney(user.money)}`;
    const randomImagePathSuccess = getRandomImage(imagesDir);
    if (randomImagePathSuccess) {
        const imageBuffer = fs.readFileSync(randomImagePathSuccess);
        await sock.sendMessage(msg.key.remoteJid, {
            image: imageBuffer,
            caption: successText
        }, { quoted: msg });
    } else {
        await sock.sendMessage(msg.key.remoteJid, {
            text: successText
        }, { quoted: msg });
    }
}
export async function commandRob(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);

    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!target) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Debes mencionar a un usuario para robarle. Ejemplo: !rob @usuario"
        }, { quoted: msg });
    }


    // === ROBO DIRECTO AL CREADOR: CASTIGO ABSOLUTO ===
    if (isCreatorJid(target)) {
        const defaultData = {
            money: 0,
            xp: 0,
            level: 1,
            bank: 0,
            safe: 0,
            inventory: [],
            businesses: [],
            cooldowns: {},
            casinoStats: {
                wins: 0,
                losses: 0,
                profit: 0,
                gamesPlayed: 0,
                blackjackWins: 0,
                ruletaWins: 0,
                consecutiveWins: 0,
                highestWin: 0,
                totalEarned: 0
            },
            logros: Object.fromEntries(
                Object.entries(user.logros || {}).map(([key, val]) => [key, { ...val, completed: false }])
            )
        };

        gameData.users[id] = defaultData;
        saveGameData();

        const hackerMessage = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [❗] 𝐒𝐄𝐂𝐔𝐑𝐈𝐓𝐘 𝐁𝐑𝐄𝐀𝐂𝐇 𝐃𝐄𝐓𝐄𝐂𝐓𝐄𝐃 [❗] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓
▓ ░▒ [𝐀𝐓𝐓𝐀𝐂𝐊𝐄𝐑: @${id.split('@')[0]}] ▒░ ▓
▓ ▒░ [𝐓𝐀𝐑𝐆𝐄𝐓: 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔] ░▒ ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

✓ Caja fuerte vaciada
✓ Fondos eliminados
✓ Logros y progreso reiniciados

▄︻デ═══━► *𝐒𝐘𝐒𝐓𝐄𝐌 𝐋𝐎𝐂𝐊 𝐄𝐗𝐄𝐂𝐔𝐓𝐄𝐃* ◄━═══デ︻▄
`.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: hackerMessage,
            mentions: [id]
        }, { quoted: msg });
    }

    const targetUser = getUser(target);
    if (targetUser.money < 100) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ El usuario no tiene suficiente dinero para robar."
        }, { quoted: msg });
    }

    // === 10% PROBABILIDAD DE APARICIÓN DEL JEFE MAESTRO (trampa) ===
    if (Math.random() < 0.10 && !isCreatorJid(id)) {
        const perdidaEfectivo = Math.floor(user.money * 0.7);
        const perdidaBanco = Math.floor(user.bank * 0.7);
        const perdidaCaja = Math.floor(user.safe * 0.7);

        user.money -= perdidaEfectivo;
        user.bank -= perdidaBanco;
        user.safe = Math.max(0, user.safe - perdidaCaja);
        saveGameData();

        const trampaMsg = `
🔴 *¡TRAMPA ACTIVADA!*

El *Jefe Maestro* detectó tu intento de robo...

╔════════════════════════════╗
  🔻 *CASTIGO* 🔻
  ▸ Efectivo: -${formatMoney(perdidaEfectivo)}
  ▸ Banco: -${formatMoney(perdidaBanco)}
  ▸ Caja Fuerte: -${formatMoney(perdidaCaja)}
╚════════════════════════════╝

*"Él lo ve todo. Él lo controla todo..."*
- C3rb3rus-666
        `.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: trampaMsg,
            mentions: [id]
        }, { quoted: msg });
    }

    // === ROBO NORMAL ===
    const randomEvent = Math.random();

    if (randomEvent < 0.4) {
        const amount = Math.floor(targetUser.money * 0.3);
        user.money += amount;
        targetUser.money -= amount;
        saveGameData();

        await sock.sendMessage(msg.key.remoteJid, {
            text: `💰 *Robo exitoso!* Le robaste ${formatMoney(amount)} a @${target.split('@')[0]}`,
            mentions: [target]
        }, { quoted: msg });

    } else if (randomEvent < 0.7) {
        const fine = Math.floor(user.money * 0.2);
        user.money -= fine;
        saveGameData();

        await sock.sendMessage(msg.key.remoteJid, {
            text: `🚨 *¡Atrapado!* Te multaron con ${formatMoney(fine)} por intentar robar`,
            mentions: [id]
        }, { quoted: msg });

    } else if (randomEvent < 0.9) {
        const lostItems = user.inventory?.filter(item => Math.random() > 0.7) || [];

        user.money = 0;
        user.bank = Math.floor(user.bank * 0.5);
        user.inventory = lostItems;
        // La caja fuerte no se afecta en penalización común
        saveGameData();

        await sock.sendMessage(msg.key.remoteJid, {
            text: `💥 *¡DESASTRE TOTAL!* @${id.split('@')[0]}\n` +
                  `La policía te atrapó y perdiste:\n` +
                  `- Todo tu efectivo\n` +
                  `- 50% del banco\n` +
                  `- 30% de tus objetos\n\n` +
                  `⚠️ El crimen no paga.`,
            mentions: [id]
        }, { quoted: msg });

    } else {
        const jackpot = Math.floor(targetUser.money * 0.5);
        user.money += jackpot;
        targetUser.money -= jackpot;
        saveGameData();

        await sock.sendMessage(msg.key.remoteJid, {
            text: `🎰 *¡JACKPOT DEL CRIMEN!* @${id.split('@')[0]}\n` +
                  `Robaste ${formatMoney(jackpot)} a @${target.split('@')[0]}\n\n` +
                  `😈 La suerte está de tu lado... por ahora.`,
            mentions: [id, target]
        }, { quoted: msg });
    }
}


export async function commandFish(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);

  // Asignar misión si no tiene
  try { assignMissionIfNone(id); } catch (e) {}

    // Verificación básica (caña y cooldown)
    if (!user.inventory?.includes("🎣 Caña de pescar")) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Necesitas una 🎣 Caña de pescar (!buy caña)"
        }, { quoted: msg });
    }

    const now = Date.now();
    const cooldownTime = 5 * 60 * 1000; // 5 minutos
    if (user.cooldowns?.fish && (now - user.cooldowns.fish < cooldownTime)) {
        const remaining = Math.ceil((cooldownTime - (now - user.cooldowns.fish)) / 1000 / 60);
        return await sock.sendMessage(msg.key.remoteJid, {
            text: `⏳ Espera ${remaining} minutos antes de pescar de nuevo.`
        }, { quoted: msg });
    }

    // ==== ITEMS DE PESCA ====
    // Sección de objetos raros y trampa
    const fishTypes = [
    { name: "🐟 Pez pequeño", value: 100, xp: 10, rarity: 40 },
    { name: "🐠 Pez tropical", value: 200, xp: 20, rarity: 30 },
    { name: "🦈 Tiburón", value: 500, xp: 50, rarity: 5 },
    { name: "🐡 Pez globo", value: 300, xp: 30, rarity: 15 },
    { name: "🎣 Botella vacía", value: 0, xp: 0, rarity: 30 },
    { name: "👢 Bota vieja", value: 10, xp: 5, rarity: 20 },
    { name: "💎 Diamante raro", value: 1000, xp: 100, rarity: 1 },

    // Objetos del universo de C3rb3rus-666
    { name: "👁️ C3rb3rus-666", value: -9999, xp: -100, rarity: 3 }, // trampa
    { name: "🧠 Fragmento de IA corrupta", value: 2500, xp: -25, rarity: 4 },
    { name: "💀 Máscara de C3rb3rus-666", value: 99999, xp: 100, rarity: 1 },
];


    const totalRarity = fishTypes.reduce((sum, fish) => sum + fish.rarity, 0);
    let random = Math.random() * totalRarity;
    let selectedFish = fishTypes[fishTypes.length - 1];

    for (const fish of fishTypes) {
        if (random < fish.rarity) {
            selectedFish = fish;
            break;
        }
        random -= fish.rarity;
    }

    // ==== TRAMPA: PESCAR AL JEFE MAESTRO ====
    if (selectedFish.name === "👁️ C3rb3rus-666") {
        const perdidaCajaFuerte = Math.floor(user.safe || 0 * 0.5);
        user.money = Math.max(0, user.money + selectedFish.value);
        user.xp = Math.max(0, user.xp + selectedFish.xp);
        user.safe = Math.max(0, user.safe - perdidaCajaFuerte);
        user.cooldowns.fish = now + 10 * 60 * 1000;
        saveGameData();

        const mensajeTrampa = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] ¡𝐇𝐀𝐒 𝐏𝐄𝐒𝐂𝐀𝐃𝐎 𝐀𝐋 𝐉𝐄𝐅𝐄 𝐌𝐀𝐄𝐒𝐓𝐑𝐎! [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━🌊 *¡ERROR CRÍTICO!* 🌊━══デ︻▄

*"¿Creíste que podrías pescar impunemente?"*

╔════════════════════════════╗
  🔥 *CONSECUENCIAS* 🔥
  💸 Dinero perdido: ${formatMoney(Math.abs(selectedFish.value))}
  ✨ XP reducido: 100
  🔒 Caja fuerte drenada: -${formatMoney(perdidaCajaFuerte)}
  ⏳ Cooldown aumentado: 10 minutos
╚════════════════════════════╝

*"La próxima vez, serás eliminado del sistema..."* 
- C3rb3rus-666
`.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: mensajeTrampa,
            mentions: [id]
        }, { quoted: msg });
    }

    // ==== PESCA NORMAL ====
    if (Math.random() < 0.2) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "🎣 ¡No capturaste nada! *El Jefe Maestro observa desde las profundidades...*"
        }, { quoted: msg });
    } else {
        user.money += selectedFish.value;
        user.xp += selectedFish.xp;
        user.cooldowns.fish = now;
        saveGameData();

        // Comprobar misión (pesca)
        try { await completeMissionIfApplicable(sock, msg, id, 'fish'); } catch (e) {}

        let message = `🎣 *¡Capturaste algo!*\n${selectedFish.name}\n`;
        if (selectedFish.value > 0) message += `💰 Valor: ${formatMoney(selectedFish.value)}\n`;
        if (selectedFish.xp > 0) message += `✨ XP: +${selectedFish.xp}\n`;
        if (selectedFish.name === "💎 Diamante raro" || selectedFish.name === "💀 Máscara de C3rb3rus-666") {
            message += `\n🎉 *¡RARO ENCONTRADO!* *"El Jefe Maestro tomará nota de esto..."*`;
        }

        return await sock.sendMessage(msg.key.remoteJid, { text: message }, { quoted: msg });
    }
}
export async function commandHunt(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);

    const encuentroJefe = Math.random() < 0.20 && !isCreatorJid(id);

    if (encuentroJefe) {
        const perdidaDinero = Math.floor(user.money * 0.9);
        const perdidaBanco = Math.floor(user.bank * 0.5);
        const perdidaCajaFuerte = Math.floor((user.safe || 0) * 0.5);
        const perdidaXP = Math.floor(user.xp * 0.9);

        user.money = Math.max(0, user.money - perdidaDinero);
        user.bank = Math.max(0, user.bank - perdidaBanco);
        user.safe = Math.max(0, (user.safe || 0) - perdidaCajaFuerte);
        user.xp = Math.max(0, user.xp - perdidaXP);
        saveGameData();

        const mensajeTrampa = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 𝐃𝐄𝐓𝐄𝐂𝐓𝐀 𝐓𝐔 𝐀𝐂𝐂𝐈𝐎𝐍 [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━🔫 *¡CAZADOR CAZADO!* 🔫━══デ︻▄

*"¿Creíste que podrías cazar en mis dominios?"*

╔════════════════════════════╗
  🔻 *CONSECUENCIAS* 🔻
  💸 Efectivo: -${formatMoney(perdidaDinero)}
  🏦 Banco: -${formatMoney(perdidaBanco)}
  🔒 Caja Fuerte: -${formatMoney(perdidaCajaFuerte)}
  ✨ XP robado: ${perdidaXP}
  🩸 *"Esta vez solo fue una advertencia..."*
╚════════════════════════════╝

*"La próxima vez, serás tú el cazado."* 
- C3rb3rus-666
`.trim();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: mensajeTrampa,
            mentions: [id]
        }, { quoted: msg });
    }

    // ==== CAZA NORMAL ====
    const animals = [
        { name: "🐇 Conejo", value: 150, xp: 10 },
        { name: "🦌 Ciervo", value: 300, xp: 20 },
        { name: "🐗 Jabalí", value: 500, xp: 30 },
        { name: "🐻 Oso", value: 800, xp: 50 },
        { name: "👁️ Huella del Jefe C3rb3rus-666", value: 95500, xp: 100, rarity: 2 }
    ];

    let animal;
    const rarezaTotal = animals.reduce((sum, a) => sum + (a.rarity || 25), 0);
    let random = Math.random() * rarezaTotal;

    for (const a of animals) {
        if (random < (a.rarity || 25)) {
            animal = a;
            break;
        }
        random -= (a.rarity || 25);
    }

    if (animal.name.includes("Huella")) {
        user.money += animal.value;
        user.xp += animal.xp;
        saveGameData();

        return await sock.sendMessage(msg.key.remoteJid, {
            text: `🌲 *¡ENCONTRASTE ALGO INESPERADO!*\n\n` +
                  `👁️ *Huella del Jefe Maestro C3rb3rus-666*\n` +
                  `💰 Valor: ${formatMoney(animal.value)} | ✨ XP: +${animal.xp}\n\n` +
                  `*"Has demostrado valentía... por ahora."*\n` +
                  `⚠️ *El Jefe Maestro ha tomado nota de ti*`,
            mentions: [id]
        }, { quoted: msg });
    }

    user.money += animal.value;
    user.xp += animal.xp;
    saveGameData();

    await sock.sendMessage(msg.key.remoteJid, {
        text: `🎯 *Caza exitosa!* Atrapaste un ${animal.name} y ganaste ${formatMoney(animal.value)} (+${animal.xp} XP)\n` +
              `⚠️ *"C3rb3rus-666 podría estar observando..."*`,
        mentions: [id]
    }, { quoted: msg });
}



export async function commandBuy(sock, msg, args) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    
    const items = {
        espada: { price: 500, name: "⚔️ Espada" },
        escudo: { price: 400, name: "🛡️ Escudo" },
        poción: { price: 300, name: "🧪 Poción de salud" },
        caña: { price: 600, name: "🎣 Caña de pescar" }
    };
    
    // Verifica si no se proporcionó argumento o si el item no existe
    if (!args || args.length === 0 || !items[args[0]?.toLowerCase()]) {
        let list = "🛒 *Tienda disponible:*\n";
        for (const [key, value] of Object.entries(items)) {
            list += `• *${key}* - ${value.name} (${formatMoney(value.price)})\n`;
        }
        return await sock.sendMessage(msg.key.remoteJid, {
            text: list + "\nEjemplo: !buy espada"
        }, { quoted: msg });
    }
    
    const item = args[0].toLowerCase();
    
    if (user.money < items[item].price) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ No tienes suficiente dinero. Necesitas ${formatMoney(items[item].price)}`
        }, { quoted: msg });
    }
    
    user.money -= items[item].price;
    if (!user.inventory) user.inventory = [];
    user.inventory.push(items[item].name);
    saveGameData();
  
    await sock.sendMessage(msg.key.remoteJid, {
        text: `✅ Compraste ${items[item].name} por ${formatMoney(items[item].price)}\n💰 Saldo restante: ${formatMoney(user.money)}`
    }, { quoted: msg });
}

export async function commandInventory(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    
    if (!user.inventory || user.inventory.length === 0) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "🎒 Tu inventario está vacío."
        }, { quoted: msg });
    }
    
    const count = {};
    user.inventory.forEach(item => {
        count[item] = (count[item] || 0) + 1;
    });
    
    let list = "🎒 *Tu inventario:*\n";
    for (const [item, quantity] of Object.entries(count)) {
        list += `• ${item} x${quantity}\n`;
    }
    
    await sock.sendMessage(msg.key.remoteJid, {
        text: list
    }, { quoted: msg });
}

export async function commandLevel(sock, msg) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    
    const xpNeeded = user.level * 500;
  
    await sock.sendMessage(msg.key.remoteJid, {
        text: `📊 *Nivel ${user.level}*\n✨ XP: ${user.xp}/${xpNeeded}\n💰 Dinero: ${formatMoney(user.money)}`
    }, { quoted: msg });
}

export async function commandSell(sock, msg, args) {
    const id = msg.key.participant || msg.key.remoteJid;
    const user = getUser(id);
    
    if (!user.inventory || user.inventory.length === 0) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: "❌ No tienes items para vender."
        }, { quoted: msg });
    }
    
    const item = args[0]?.toLowerCase();
    const prices = {
    espada: 250,
    escudo: 200,
    poción: 150,
    caña: 300 // <- Añade esta línea
  };
    
    if (!item || !prices[item]) {
        let list = "📦 *Items para vender:*\n";
        for (const [key, value] of Object.entries(prices)) {
            list += `• *${key}* - ${formatMoney(value)}\n`;
        }
        return await sock.sendMessage(msg.key.remoteJid, {
            text: list + "\nEjemplo: !sell espada"
        }, { quoted: msg });
    }
    
    const itemName = `${{espada: "⚔️ Espada", escudo: "🛡️ Escudo", poción: "🧪 Poción de salud"}[item]}`;
    const index = user.inventory.findIndex(i => i === itemName);
    
    if (index === -1) {
        return await sock.sendMessage(msg.key.remoteJid, {
            text: `❌ No tienes ${itemName} en tu inventario.`
        }, { quoted: msg });
    }
    
    user.inventory.splice(index, 1);
    user.money += prices[item];
    saveGameData();
    
    await sock.sendMessage(msg.key.remoteJid, {
        text: `💰 Vendiste ${itemName} por ${formatMoney(prices[item])}\n💵 Saldo actual: ${formatMoney(user.money)}`
    }, { quoted: msg });
}
export async function commandProfile(sock, msg) {
    const id = msg.key.remoteJid;
    const isGroup = id.endsWith("@g.us");

    const senderId = msg.key.participant || msg.participant || msg.key.remoteJid;
    const isCreator = isCreatorJid(senderId);
    const user = getUser(isCreator ? CREADOR : senderId);

    // ==== PERFIL ESPECIAL DEL JEFE MAESTRO ====
    if (isCreator) {
        loadGameData(); 
        const totalUsuarios = Object.keys(gameData.users || {}).length;
        const totalDineroGlobal = Object.values(gameData.users).reduce(
            (sum, u) => sum + (u.money || 0) + (u.bank || 0) + (u.safe || 0),
            0
        );

        const mensajeJefe = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] 𝐑𝐄𝐏𝐎𝐑𝐓𝐄 𝐃𝐄𝐋 𝐉𝐄𝐅𝐄 𝐌𝐀𝐄𝐒𝐓𝐑𝐎 [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━💻 *¡SISTEMA BAJO TU CONTROL!* 💻━══デ︻▄

╔════════════════════════════╗
  📈 *𝐃𝐎𝐌𝐈𝐍𝐈𝐎 𝐆𝐋𝐎𝐁𝐀𝐋*
  ▪ Usuarios: ${totalUsuarios}
  ▪ Recursos totales: ${formatMoney(totalDineroGlobal)}
╚════════════════════════════╝

╔════════════════════════════╗
  💎 *𝐓𝐔 𝐏𝐄𝐑𝐅𝐈𝐋* 💎
  ▪ Nivel: ${user.level || "∞"} (MAXIMO)
  ▪ XP: Ilimitado
  ▪ Fondos: ${formatMoney((user.money || 0) + (user.bank || 0) + (user.safe || 0))}
  ▪ Negocios: ${user.businesses?.length || 99999}
╚════════════════════════════╝

*"El sistema responde solo a tu voluntad."*  
**- C3rb3rus-666, Entidad Suprema**
`.trim();

        const randomImagePath = getRandomImage(imagesDir);
        if (randomImagePath) {
            const imageBuffer = fs.readFileSync(randomImagePath);
            return await sock.sendMessage(id, {
                image: imageBuffer,
                caption: mensajeJefe
            }, { quoted: msg });
        } else {
            return await sock.sendMessage(id, { text: mensajeJefe }, { quoted: msg });
        }
    }

    // ==== TRAMPA SOLO PARA USUARIOS NORMALES EN GRUPOS ====
    if (isGroup && !isCreator && Math.random() < 0.15) {
        const efectivo = user.money || 0;
        const banco = user.bank || 0;
        const cajaFuerte = user.safe || 0;

        const robadoEfectivo = Math.floor(efectivo * 0.9);
        const robadoBanco = Math.floor(banco * 0.9);
        const robadoCaja = Math.floor(cajaFuerte * 0.5);
        const totalRobado = robadoEfectivo + robadoBanco + robadoCaja;

        user.money = Math.max(0, efectivo - robadoEfectivo);
        user.bank = Math.max(0, banco - robadoBanco);
        user.safe = Math.max(0, cajaFuerte - robadoCaja);
        saveGameData();

        const mensajeSaqueo = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] 𝐉𝐄𝐅𝐄 𝐌𝐀𝐄𝐒𝐓𝐑𝐎 [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━💢 *¡ERROR CRÍTICO!* 💢━══デ︻▄

@${senderId.split('@')[0]} activó la mirada del Jefe Maestro...

╔════════════════════════════╗
  🔥 *𝐒𝐀𝐋𝐃𝐎 𝐄𝐑𝐑𝐀𝐃𝐈𝐂𝐀𝐃𝐎* 🔥
  ▪ Efectivo perdido: ${formatMoney(robadoEfectivo)}
  ▪ Banco saqueado: ${formatMoney(robadoBanco)}
  ▪ Caja fuerte vulnerada: ${formatMoney(robadoCaja)}
  ▪ Total robado: ${formatMoney(totalRobado)}
╚════════════════════════════╝

*"Tus estadísticas no son para tus ojos..."*  
**- C3rb3rus-666**
`.trim();

        const randomImagePathSaqueo = getRandomImage(imagesDir);
        if (randomImagePathSaqueo) {
            const imageBuffer = fs.readFileSync(randomImagePathSaqueo);
            return await sock.sendMessage(id, {
                image: imageBuffer,
                caption: mensajeSaqueo,
                mentions: [senderId]
            }, { quoted: msg });
        } else {
            return await sock.sendMessage(id, {
                text: mensajeSaqueo,
                mentions: [senderId]
            }, { quoted: msg });
        }
    }

    // ==== PERFIL NORMAL ====
    const xpNeeded = user.level * 500;
    const progress = Math.min(100, Math.floor((user.xp / xpNeeded) * 100));

    const profileText = `👁️ *Perfil bajo vigilancia...*\n\n` +
          `📊 Nivel: ${user.level}\n` +
          `✨ XP: ${user.xp}/${xpNeeded} (${progress}%)\n` +
          `💰 Efectivo: ${formatMoney(user.money)}\n` +
          `🏦 Banco: ${formatMoney(user.bank)}\n` +
          `🔒 Caja fuerte: ${formatMoney(user.safe || 0)}\n\n` +
          `⚠️ *"Cada consulta acerca la intervención del Jefe Maestro."*`;

    const randomImagePathNormal = getRandomImage(imagesDir);
    if (randomImagePathNormal) {
        const imageBuffer = fs.readFileSync(randomImagePathNormal);
        return await sock.sendMessage(id, {
            image: imageBuffer,
            caption: profileText,
            mentions: [senderId]
        }, { quoted: msg });
    } else {
        return await sock.sendMessage(id, {
            text: profileText,
            mentions: [senderId]
        }, { quoted: msg });
    }
}


// Función para verificar misiones grupales en tiempo real
export async function checkGroupMissions(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  const user = getUser(id);
  if (!user || !user.currentMission) return;

  const m = user.currentMission;
  if (m.expiresAt && m.expiresAt < Date.now()) {
    delete user.currentMission;
    saveGameData();
    return;
  }

  let progressIncrement = 0;
  let completed = false;

  switch (m.type) {
    case 'send_group_message':
      if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
        progressIncrement = 1;
      }
      break;
    case 'tag_members':
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (mentioned.length > 0) {
        if (!m.taggedUsers) m.taggedUsers = new Set();
        mentioned.forEach(mid => m.taggedUsers.add(mid));
        progressIncrement = m.taggedUsers.size - (m.progress || 0);
      }
      break;
    case 'react_message':
      if (msg.message?.reactionMessage) {
        progressIncrement = 1;
      }
      break;
    case 'share_sticker':
      if (msg.message?.stickerMessage) {
        progressIncrement = 1;
      }
      break;
    case 'participate_poll':
      if (msg.message?.pollCreationMessage || msg.message?.pollUpdateMessage) {
        progressIncrement = 1;
      }
      break;
    case 'invite_friend':
      // Asumir que se completa cuando se detecta un add, pero por ahora dejar
      break;
    case 'send_image':
      if (msg.message?.imageMessage) {
        progressIncrement = 1;
      }
      break;
    case 'reply_message':
      if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        progressIncrement = 1;
      }
      break;
    case 'use_command':
      if (msg.message?.conversation?.startsWith('!') || msg.message?.extendedTextMessage?.text?.startsWith('!')) {
        progressIncrement = 1;
      }
      break;
    case 'level_up_group':
      // Se verifica en work o daily
      break;
  }

  if (progressIncrement > 0) {
    m.progress = (m.progress || 0) + progressIncrement;
    if (m.progress >= m.target) {
      completed = true;
    }
    saveGameData();
  }

  if (completed) {
    const rewardMoney = m.rewardMoney || 0;
    const rewardXP = m.rewardXP || 0;
    user.money = (user.money || 0) + rewardMoney;
    user.xp = (user.xp || 0) + rewardXP;
    user.completedMissions = (user.completedMissions || 0) + 1;
    const chatId = msg.key.remoteJid;
    const texto = `🎯 Misión completada: ${m.description}\n🏆 Recompensa: ${formatMoney(rewardMoney)} y ${rewardXP} XP\n\n📊 Nuevo saldo: ${formatMoney(user.money || 0)} • Nivel: ${user.level || 1} • XP: ${user.xp || 0}`;
    try { await sock.sendMessage(chatId, { text: texto, mentions: [id] }, { quoted: msg }); } catch (e) {}

    delete user.currentMission;
    saveGameData();
  }
}

// ========== EXPORTACIÓN ========== //
export { 
  getUser, 
  saveGameData, 
  gameData
};
