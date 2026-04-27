import pino from 'pino';
import chalk from 'chalk';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, delay, downloadMediaMessage, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import readline from 'readline'; 
import fs from 'fs';
import path from 'path';

// ==========================================
// 📦 IMPORTACIÓN DE MÓDULOS
// ==========================================
import { antilink } from './comandos_cerbero/antilink.js';
import { deleteLongMessage } from './comandos_cerbero/antitraba.js';
import { commandsCerbero } from './comandos_cerbero/index.js';
import { welcomeHandler } from './comandos_cerbero/welcome.js';
import { blockQr } from './comandos_cerbero/qrkill.js';
import { handleStickerSpam } from './comandos_cerbero/antispamstickers.js';
import { simsimiBot } from "./comandos_cerbero/simi.js";
import { cerberoSimiBot } from './comandos_cerbero/cerbero_simi.js';
import { onGroupUpdate, onGroupAddBaseline } from './comandos_cerbero/monitor_evento.js' 
import { antiSpamMedia } from './comandos_cerbero/anti_spamimg.js';
import { detectNSFW } from './comandos_cerbero/nsfw_detector.js';
import { warmupModels as warmupNSFW } from './comandos_cerbero/nsfw_classifier.js';
import { verificarParticipanteNuevo, iniciarEscaneoPeriodicoRegion } from './comandos_cerbero/anti_numbers.js';
import { iniciarAdminAutonomo, toggleAdminAutonomo, darBienvenidaAutonoma, iniciarScannerBienvenida, onGroupSettingChange, onAdminChange } from './comandos_cerbero/admin_autonomo.js';
// cerbero_ia desactivada — autorespuesta reemplazada por cerbero_simi local
import * as autobanVideo from './comandos_cerbero/autobanvideo.js';
import { verificarLealtad } from './comandos_cerbero/lealtad.js';
import { amorCommand, iniciarMensajesDiarios } from './comandos_cerbero/amor_bot.js';
import { manejarDMConf, manejarComandoConf } from './comandos_cerbero/confesiones.js';
import { guardarEstadoRecuperacion, cargarEstadoRecuperacion, limpiarDeviceLists, validarCreds, ReconnectThrottler, limpiarAllTimers } from './utils/recovery.js';
import { incrementCount } from './utils/messageCounter.js';
import { initResetScheduler } from './utils/resetScheduler.js';
import { checkFlood, mutedTimeLeft } from './utils/antiFlood.js';
import { checkStatusTag, checkGroupMentionedMessage } from './comandos_cerbero/anti_status_tag.js';

// ==========================================
// 💀 THEME: C3RB3RUS-666 (DARK MODE EXTENDED)
// ==========================================
const hex = {
    blood: '#ff0033',    // Rojo Sangre
    darkRed: '#590012',  // Rojo Oscuro
    cyan: '#00f2ff',     // Cyan Hacker
    darkBlue: '#004a80', // Azul Oscuro
    gold: '#ffae00',     // Naranja
    green: '#39ff14',    // Verde Neon
    grey: '#4a4a4a',     
    white: '#e0e0e0'     
};

const paint = {
    title: chalk.hex(hex.blood).bold,
    sys: chalk.hex(hex.cyan).bold,
    txt: chalk.hex(hex.white),
    dim: chalk.hex(hex.grey),
    warn: chalk.hex(hex.gold).bold,
    usr: chalk.hex(hex.blood), 
    bgTitle: chalk.bgHex(hex.blood).black.bold,
    bgSys: chalk.bgHex(hex.darkBlue).white.bold,
    
    // 👇 ETIQUETAS DE MEDIOS
    mediaTag: chalk.bgHex(hex.darkBlue).hex(hex.blood).bold, 
    
    // 👇 ETIQUETAS DE EVENTOS DE GRUPO
    join: chalk.hex(hex.green).bold,   // [+] Entró
    leave: chalk.hex(hex.blood).bold,  // [-] Salió
    promote: chalk.hex(hex.cyan).bold, // [↑] Admin
    demote: chalk.hex(hex.gold).bold   // [↓] No Admin
};

// ==========================================
// 🛠️ CONFIGURACIÓN DEL LOGGER
// ==========================================
const logger = pino({ level: 'info' });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));


let reconnectDelay = 100;
let bannerInterval;
const reconnectThrottler = new ReconnectThrottler(1000, 15000);
let allTimers = [];
let lastMessageTimestamp = Date.now(); // watchdog: último mensaje recibido
let watchdogTimer = null;             // timer del watchdog de silencio

// Variable global para mensajes procesados
const processedMessages = new Set();
const lastCerberoTrigger = new Map(); // mapa para evitar spam por chat (cooldown por chat)
// Configuración para el trigger abierto de Cerbero-AI
const CERBERO_COOLDOWN_MS = 60 * 1000; // 1 minuto por chat (ajustable)
const CERBERO_DELAY_MS = 5000; // 5 segundos de retraso antes de invocar la IA (ajustable)
const CERBERO_RESPONSE_PROBABILITY = 0.3; // 30% de probabilidad de respuesta (ajustable)


async function humanDelayWelcome(sock, groupId, minSeconds = 5, maxSeconds = 10) {
  const delayTime = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
  await sock.sendPresenceUpdate('composing', groupId);
  await new Promise(resolve => setTimeout(resolve, delayTime));
  await sock.sendPresenceUpdate('paused', groupId);
}

// ==========================================
// 🐕 BANNER ARTE
// ==========================================
const ascii_art = `
         ....''''..                     .',,,'.
      .:dkkk0KXNNX0d;.               .;d0XNWNK0Oxc,.
     .c0XKx;.':xXWMWN0d;.       .':ldKWMWXko;',:d0KOc.
     '::,.      'o0WWWMWKx:.  .'cOXWWWWW0l.      .,cl'
                  .:xXWWWXd.  ,oOWMMWXx:.
     ...             .cddc'   ..:ddl:'            .'
     ;dc.   ..:loooc'                .;coddol,.   'ko.
     cx,  .ckXWWWMMWXk,    .    .   :0NWWMWWWNO,   lx'
    .;;. .cXWWWMMMWWWNx.  :c. .;c, .dNWWMMWWWWWk.  .'
        .;dOkdllldOXXo.   lo. .'oc  .dXKkoc:;;cc;.
        ...        .;,.  ;d;   .:x; .::.         .'
     .,.              .,lc'      'cl;.            .,.
   .,dx;             .lo.          .ol.           .d0l.
  'dXNd.             .o,            ':.            cXWO,
.;kNMWx.           .':ol,.       .,clll;..          ;0MWKc
.:ONWWMNk,.    .,:lx0NWMWNO:.  .;cONWWMWXOdc;.   ';l0WWWWO'
 ;0WWWWWWN0xoox0NWWMMWMMWWMNKkOXWWMWWMMMWWMWWXOxkKWWWWWWNx'
 .dWWWMMWWWWWMMMMMMWWMMMMWWWWWWWWWWMWWWMMMWMMMMMMMMMMWWN0l.
  ;0WWWWMMWMMWWMMMMMMMMMMWWWMMMWWWWMMWWMMMMMMMWMMMWWMWNOo'
   ,xXWWWWMMMMMMMMMMWWMMMWMMMMMMWWWMMMWWMWWWWWMMMMMWXOo;.
     .:loodxxxxxOKXNWN0xdxxxxxOKXKKOdodxkOOOOOOkkxdl;.. 
               .:ONWWX0koc:;,;clllodxOOxl:.
                 .l0WWMWWWWWNNWWWWMWNK0d;.
                   .;dOXNWWWWWWWWWWKx:.
                       .,,,;:::;;,,'   
`;

const creditos = `
      [𝐂𝐄𝐑𝐁𝐄𝐑𝐎] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 
      github: github.com/c3rb3rus-666
      WhatsApp:+57 323 3704652 
`;

function showBanner() {
    console.clear();
    console.log(paint.title(ascii_art));
    console.log(paint.sys(creditos));
    console.log(paint.dim('───────────────────────────────────────────────────────'));
}

async function connectToWhatsApp() {
  try {
    // 🚀 LIMPIEZA PREVENTIVA
    limpiarAllTimers(allTimers);
    limpiarDeviceLists();
    
    if (!validarCreds()) {
      console.log(paint.warn(' ⚠️ Credenciales corruptas detectadas. Haciendo backup en sessions/creds.bak.json ...'));
      try {
        if (fs.existsSync('./sessions/creds.json')) {
          fs.copyFileSync('./sessions/creds.json', './sessions/creds.bak.json');
          console.log(paint.dim(' ✅ Backup creado: sessions/creds.bak.json'));
        }
      } catch (e) {
        console.error(paint.warn(' [WARN] No se pudo crear backup de credenciales:'), e.message);
      }
    }

    const estadoRecuperacion = cargarEstadoRecuperacion();
    const { state, saveCreds } = await useMultiFileAuthState('./sessions');

    let waVersion = [2, 3000, 1];
    try {
      const fetched = await fetchLatestBaileysVersion();
      waVersion = fetched.version;
      console.log(paint.sys(` [NET] WA Web version: ${waVersion.join('.')} ${fetched.isLatest ? '' : '(fallback cached)'}`));
    } catch (e) {
      console.error(paint.warn(' [WARN] No se pudo obtener la versión de WhatsApp Web. Usando fallback.'));
      if (state?.creds?.version) {
        waVersion = state.creds.version;
        console.log(paint.dim(` [INFO] Usando versión guardada: ${waVersion.join('.')}`));
      }
    }

    // Wrapper para saveCreds que añade logging y escribe una copia legible (debug)
    const saveCredsWithLog = async (creds) => {
      try {
        await saveCreds(creds);
        console.log(paint.dim(' ✅ Credenciales actualizadas en disco.'));
        try {
          // escribir una copia legible para depuración
          fs.writeFileSync('./sessions/last_creds.json', JSON.stringify(creds, null, 2));
        } catch (e) {
          console.error(paint.warn(' [WARN] No se pudo escribir sessions/last_creds.json:'), e.message);
        }
      } catch (e) {
        console.error(paint.warn(' [ERROR] saveCreds falló:'), e.message);
      }
    };
    
    let usePairingCode = false;
    let phoneNumber = '';
    const sessionExists = fs.existsSync('./sessions/creds.json');

    if (bannerInterval) clearInterval(bannerInterval);
    showBanner();

    if (!sessionExists && !state.creds.registered) {
        console.log(paint.bgSys(' ≡ INITIALIZING PROTOCOL 666 ≡ '));
        console.log(paint.dim(' ┌──────────────────────────────────────┐ '));
        console.log(paint.dim(' │ ') + paint.sys('[1]') + paint.txt(' SCAN QR CODE (TERMINAL)') + paint.dim('          │ '));
        console.log(paint.dim(' │ ') + paint.sys('[2]') + paint.txt(' PAIRING CODE (NO GUI)') + paint.dim('            │ '));
        console.log(paint.dim(' └──────────────────────────────────────┘ '));
        
        const selection = await question(paint.title('\n 💀 C3rb3rus@root:~$ '));
        
        if (selection.trim() === '2') {
            usePairingCode = true;
            phoneNumber = await question(paint.title(' 💀 Target Number (Ej: 573001234567): '));
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        }
    } else {
        console.log(paint.sys(' [SYSTEM] ') + paint.txt('C3rb3rus Identity Found. Decrypting Session...'));
    }

    const sock = makeWASocket({
      auth: state,
      version: waVersion,
      logger: logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'), // formato recomendado por Baileys para pairing code
      connectTimeoutMs: 60000, 
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000, 
      emitOwnEvents: true,
      fireInitQueries: true, 
      shouldIgnoreJid: jid => false, // no ignorar nada — status@broadcast se necesita para anti_status_tag
      markOnlineOnConnect: true, 
      syncFullHistory: true,
      generateHighQualityLinkPreview: true,
    });

    // Iniciar scheduler mensual que resetea contadores el día 30
    try { initResetScheduler(); } catch (e) {}

    if (usePairingCode && !sock.authState.creds.registered) {
        console.log(paint.sys(` [NET] Connecting to WhatsApp Servers... Please Wait.`));
        setTimeout(async () => {
            if (phoneNumber) {
                try {
                    console.log(paint.sys(` [NET] Requesting Pairing Code for: ${phoneNumber}...`));
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(paint.dim('\n┌──────────────────────────────────────────┐'));
                    console.log(paint.dim('│      ') + paint.bgTitle(' 🔑 ACCESS CODE GRANTED 🔑 ') + paint.dim('       │'));
                    console.log(paint.dim('├──────────────────────────────────────────┤'));
                    console.log(paint.dim('│         ') + paint.title(code?.match(/.{1,4}/g)?.join('-') || code) + paint.dim('          │'));
                    console.log(paint.dim('└──────────────────────────────────────────┘\n'));
                } catch (err) {
                    console.error(paint.warn(' [ERROR] No se pudo generar el código.'));
                }
            }
        }, 5000);
    }

    sock.ev.on('presence.update', () => {});

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr && !usePairingCode && !sessionExists) {
          showBanner();
          console.log(paint.warn(' [!] NEW KEY GENERATED. SCAN NOW. '));
          qrcode.generate(qr, { small: true });
          try {
            // Guardar string del QR para depuración o escaneo fuera de la terminal
            fs.writeFileSync('./qr.txt', qr);
            console.log(paint.dim(' ✅ QR guardado en ./qr.txt'));
          } catch (e) {
            console.error(paint.warn(' [WARN] No se pudo guardar qr.txt:'), e.message);
          }
        }
      
      if (connection === 'close') {
        if (bannerInterval) clearInterval(bannerInterval);
        handleConnectionClose(lastDisconnect);
      } else if (connection === 'open') {
        showBanner();
        console.log(paint.sys(' █ SYSTEM ONLINE █ '));
        console.log(paint.dim(' Monitoring traffic for C3rb3rus-666...\n'));
        reconnectDelay = 100;
        // Iniciar escáner periódico de región (cada 5 min)
        try { const t = iniciarEscaneoPeriodicoRegion(sock); if (t) allTimers.push(t); } catch(e) { console.error('[REGION] Error iniciando escáner:', e.message); }
        // Iniciar administrador autónomo de grupos (cada 5 min)
        try { const t = iniciarAdminAutonomo(sock); if (t) allTimers.push(t); } catch(e) { console.error('[ADMIN-AUTO] Error iniciando admin autónomo:', e.message); }
        // Scanner de bienvenidas pendientes (cada 2 min — lee recent_joins.json)
        try { const t = iniciarScannerBienvenida(sock); if (t) allTimers.push(t); } catch(e) { console.error('[ADMIN-AUTO] Error iniciando scanner bienvenidas:', e.message); }
        // Pre-calentar modelos ML anti-NSFW (evita lag en la primera imagen)
        warmupNSFW().catch(e => console.error('[NSFW] warmup error:', e.message));
        // Iniciar mensajes románticos diarios (si están configurados)
        iniciarMensajesDiarios(sock).catch(e => console.error('[AMOR-BOT] Error iniciando:', e.message));

        if (bannerInterval) clearInterval(bannerInterval);
        bannerInterval = setInterval(() => {
            showBanner(); 
            console.log(paint.sys(' █ SYSTEM ONLINE █ '));
            console.log(paint.dim(' Monitoring traffic for C3rb3rus-666... [AUTO-REFRESH]\n'));
        }, 40000); 
      }
    });

    // Envolver saveCreds para logging y debug
    sock.ev.on('creds.update', async (creds) => {
      await saveCredsWithLog(creds);
    });

    // ── STREAM ERROR HANDLER ──────────────────────────────────────────────────
    // Baileys a veces emite stream:error sin disparar connection.update:close
    // ("ghost connection"). Capturamos el error del WS subyacente y forzamos
    // reconexión limpia.
    try {
      sock.ws?.on('error', (err) => {
        console.warn(paint.warn(` [WATCHDOG] WebSocket error: ${err?.message || err} — forzando reconexión`));
        lastMessageTimestamp = Date.now(); // evitar que el watchdog se dispare también
        handleConnectionClose({ error: { output: { statusCode: 428 } } });
      });
    } catch(e) {}

    // ── WATCHDOG DE SILENCIO ──────────────────────────────────────────────────
    // Si pasan más de 8 minutos sin recibir ningún mensaje (ni de grupo ni DM),
    // asumimos ghost connection y reconectamos automáticamente.
    const WATCHDOG_TIMEOUT_MS = 8 * 60 * 1000; // 8 minutos
    if (watchdogTimer) clearInterval(watchdogTimer);
    watchdogTimer = setInterval(() => {
      const silencioMs = Date.now() - lastMessageTimestamp;
      if (silencioMs > WATCHDOG_TIMEOUT_MS) {
        console.warn(paint.warn(` [WATCHDOG] ${Math.round(silencioMs/60000)} min sin mensajes — posible ghost connection. Reconectando...`));
        lastMessageTimestamp = Date.now(); // reset para no disparar en bucle mientras reconecta
        handleConnectionClose({ error: { output: { statusCode: 428 } } });
      }
    }, 60 * 1000); // revisar cada minuto
    allTimers.push(watchdogTimer);



    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      lastMessageTimestamp = Date.now(); // watchdog: resetear contador de silencio
      const msg0 = messages[0];
      const jid0 = msg0?.key?.remoteJid || '';
      if (!jid0.endsWith('@g.us')) {
        console.log(`[RAW DM] type=${type} jid=${jid0} fromMe=${msg0?.key?.fromMe} hasMsg=${!!msg0?.message}`);
      }
      // Aceptar 'notify' y 'append' para no perder DMs
      if (type !== 'notify' && type !== 'append') return;
      const msg = messages[0];
      if (!msg?.key?.remoteJid || !msg?.message) return;

      // Mensajes de estado → ya no se procesan aquí (groupMentionedMessage llega al grupo)
      if (msg.key.remoteJid === 'status@broadcast') {
        return;
      }

      const messageId = msg.key.id;
      if (processedMessages.has(messageId)) return;
      processedMessages.add(messageId);
      if (processedMessages.size > 1000) processedMessages.delete(processedMessages.values().next().value);

      try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        let groupMetadata = null;
        let isAdmin = false;
        let groupName = 'DIRECT_UPLINK';

        const senderJid = msg.key.participant || msg.key.remoteJid;

        // Mensajes privados: revisar si es una confesión anónima
        // Solo procesar eventos 'notify' para DMs (no 'append' que incluye mensajes propios del bot)
        if (!isGroup && !msg.key.fromMe && type === 'notify') {
          const textDM = msg.message?.conversation ||
                         msg.message?.extendedTextMessage?.text || '';
          // Ignorar DMs sin texto (stickers, audios, imágenes sin caption, notificaciones vacías)
          if (!textDM.trim()) {
            console.log(`[DM RECV] ⏭️ ${senderJid} → mensaje sin texto, ignorado`);
            return;
          }
          console.log(`[DM RECV] 📩 ${senderJid} → "${textDM?.slice(0,80)}"`);
          await manejarDMConf(sock, senderJid, textDM);
          return;
        }
        // Ignorar DMs propios (fromMe) o append de DMs silenciosamente
        if (!isGroup && (msg.key.fromMe || type === 'append')) return;

        if (isGroup) {
          // Detectar etiqueta de grupo en estado (groupMentionedMessage llega al grupo)
          await checkGroupMentionedMessage(sock, msg);

          try {
            groupMetadata = await sock.groupMetadata(chatId);
            groupName = groupMetadata.subject || 'UNKNOWN_NET';
            const participant = groupMetadata.participants.find(p => p.id === senderJid);
            isAdmin = !!(participant && participant.admin);

            const esSeguro = await verificarLealtad(sock, chatId, groupMetadata);
            if (!esSeguro) return; 

          } catch (error) {}
        }

        // =======================================================
        // 👁️ C3RB3RUS PACKET INTERCEPTOR (LOGS COMPLETOS)
        // =======================================================
        const msgType = Object.keys(msg.message)[0];
        let text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || 
                   msg.message?.videoMessage?.caption || "";

        const quotedInfo = msg.message?.extendedTextMessage?.contextInfo;
        const quotedText =
          quotedInfo?.quotedMessage?.conversation ||
          quotedInfo?.quotedMessage?.extendedTextMessage?.text ||
          '';
        const referencedBotMessage =
          quotedInfo?.participant === sock.user?.id ||
          quotedText.includes('CERBERO-BOT');
        const isReplyToBot = Boolean(quotedInfo?.quotedMessage && referencedBotMessage);
        const isFromBot = Boolean(msg.key.fromMe);

        let logDisplay = text; 
        
        if (!text) {
            if (msgType === 'imageMessage') logDisplay = paint.mediaTag(' [📸 IMAGEN] ') + paint.dim(' Size: ' + (msg.message.imageMessage.fileLength || 'Unknown'));
            else if (msgType === 'stickerMessage') logDisplay = paint.mediaTag(' [👾 STICKER] ');
            else if (msgType === 'audioMessage') {
                const isPtt = msg.message.audioMessage.ptt; 
                logDisplay = isPtt ? paint.mediaTag(' [🎤 VOICE NOTE] ') : paint.mediaTag(' [🔊 AUDIO FILE] ');
            }
            else if (msgType === 'videoMessage') logDisplay = paint.mediaTag(' [🎥 VIDEO] ');
            else if (msgType === 'documentMessage') logDisplay = paint.mediaTag(' [📂 ARCHIVO] ') + paint.dim(msg.message.documentMessage.fileName || 'Doc');
            else if (msgType === 'viewOnceMessage' || msgType === 'viewOnceMessageV2') logDisplay = paint.mediaTag(' [💣 VIEW ONCE] ');
        } else {
            if (msgType === 'imageMessage') logDisplay = paint.mediaTag(' [📸 IMG] ') + text;
            if (msgType === 'videoMessage') logDisplay = paint.mediaTag(' [🎥 VID] ') + text;
        }

        if (logDisplay) {
            const senderNum = (senderJid || '').toString().split('@')[0];
          // Incrementar contador de mensajes por participante (persistente)
          // Solo mensajes humanos — los del bot no cuentan como actividad del grupo
          if (!isFromBot) {
            try { await incrementCount(chatId, senderJid, text || logDisplay || ''); } catch (e) { /* no bloquear logging */ }
          }
            const time = new Date().toLocaleTimeString('es-CO', { hour12: false });
            const tag = isGroup ? paint.sys('GRUP') : paint.warn('PRIV');
            
            // ✅ NOMBRE DEL GRUPO COMPLETO (SIN SUBSTRING)
            const source = isGroup ? groupName : 'ENCRYPTED'.padEnd(15);
            const replyMarker = isReplyToBot ? paint.bgTitle(' RESPUESTA-BOT ') : '';
            const botMarker = isFromBot ? paint.bgSys(' CERBERO ') : '';
            const sourceWithMarker = paint.sys(source) + (replyMarker || botMarker ? ` ${replyMarker || botMarker}` : '');

            // Resolver short JID y nombre legible del remitente (similar a !actividad)
            const resolveParticipantDisplay = (jid) => {
              const short = (jid || '').toString().split('@')[0];
              if (isGroup && groupMetadata && Array.isArray(groupMetadata.participants)) {
                const p = groupMetadata.participants.find(x => {
                  const id = (x && (x.id || x).toString()) || '';
                  return id.split('@')[0] === short;
                });
                if (p) {
                  // Resolver número real si viene como LID
                  const phoneNum = p.phoneNumber ? p.phoneNumber.toString().split('@')[0] : null;
                  const realShort = phoneNum || short;
                  const display = (p.notify || p.notifyName || p.name || p.pushname || realShort).toString();
                  return { short: realShort, display };
                }
              }
              // fallback a pushName o short
              return { short, display: (msg.pushName && msg.pushName.trim()) || short };
            };

            const senderInfo = resolveParticipantDisplay(senderJid);
            const senderDisplay = senderInfo.display;
            const senderShort = senderInfo.short;

            // ── ID completo del grupo ──
            const groupIdShort = isGroup
              ? paint.dim('[') + chalk.hex('#555').bold(chatId) + paint.dim(']')
              : paint.dim('[') + chalk.hex('#555').bold('DM') + paint.dim(']');

            // ── Nombre del remitente: mostrar nombre si es distinto del número ──
            const senderLabel = (senderDisplay && senderDisplay !== senderShort)
              ? paint.usr('@' + senderShort) + chalk.hex('#666')(` ${senderDisplay}`)
              : paint.usr('@' + senderShort);

            // ── Marcadores de rol/contexto ──
            const roleMarker = isReplyToBot ? chalk.bgHex('#003355').hex('#00f2ff').bold(' ↩ BOT ') :
                               isFromBot    ? chalk.bgHex('#220033').hex('#b026ff').bold(' ⚙ SYS ') : '';

            console.log(
              paint.dim(time) +
              paint.dim(' │ ') +
              (isGroup ? chalk.hex('#00f2ff').bold('GRP') : chalk.hex('#ffae00').bold('DM ')) +
              paint.dim(' │ ') +
              groupIdShort + ' ' +
              chalk.hex('#e0e0e0').bold(source) +
              (roleMarker ? ' ' + roleMarker : '') +
              paint.dim(' ▸ ') +
              senderLabel +
              paint.dim(' : ') +
              chalk.hex('#e0e0e0')(logDisplay)
            );
        }
        // =======================================================

        if (!text && !['imageMessage', 'stickerMessage', 'videoMessage', 'audioMessage',
            'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'].includes(msgType)) return;

        const isCommand = text.startsWith('!');
        const [command, ...args] = isCommand ? text.slice(1).trim().split(/\s+/) : [''];

        // ── ANTI-FLOOD: interceptar antes del procesador de comandos ────────────
        // Excluir: mensajes propios, mensajes que empiezan con . o # (no son comandos válidos),
        // y mensajes sin texto real
        if (!msg.key.fromMe && isGroup && text && !text.startsWith('.') && !text.startsWith('#')) {
          const { flood, muted, reason } = checkFlood(chatId, senderJid, isCommand);
          if (flood) {
            console.log(`[FLOOD] 🚫 ATAQUE DETECTADO — ${senderJid} en ${chatId} → ${reason}`);
            if (!muted) {
              // Primera detección: avisar con imagen aleatoria, cerrar grupo y expulsar al infractor
              try {
                // 1. Anunciar en el grupo con imagen aleatoria del bot
                const _floodImgDir = path.join(process.cwd(), 'comandos_cerbero', 'imagenes');
                const _floodImgExts = ['.jpg', '.jpeg', '.png', '.webp'];
                let _floodImgBuf = null;
                try {
                  const _floodFiles = fs.readdirSync(_floodImgDir)
                    .filter(f => _floodImgExts.includes(path.extname(f).toLowerCase()));
                  if (_floodFiles.length) {
                    const _chosen = _floodFiles[Math.floor(Math.random() * _floodFiles.length)];
                    _floodImgBuf = fs.readFileSync(path.join(_floodImgDir, _chosen));
                  }
                } catch (_) {}

                const _floodCaption =
                  `🚨 *[C3RB3RUS :: FLOOD DETECTED]*\n\n` +
                  `@${senderJid.split('@')[0]} ha sido detectado realizando un ataque de flood.\n\n` +
                  `▸ Acción: *expulsado + grupo cerrado temporalmente*\n` +
                  `▸ Razón: ${reason}`;

                if (_floodImgBuf) {
                  await sock.sendMessage(chatId, {
                    image: _floodImgBuf,
                    caption: _floodCaption,
                    mentions: [senderJid],
                  });
                } else {
                  await sock.sendMessage(chatId, {
                    text: _floodCaption,
                    mentions: [senderJid],
                  });
                }
              } catch (_) {}

              // 2. Cerrar el grupo (solo admins pueden enviar)
              try {
                await sock.groupSettingUpdate(chatId, 'announcement');
                console.log(`[FLOOD] 🔒 Grupo ${chatId} cerrado (solo admins).`);
              } catch (e) {
                console.error('[FLOOD] No se pudo cerrar el grupo:', e.message);
              }

              // 3. Expulsar al infractor (no expulsar si es admin)
              try {
                const floodMeta = await sock.groupMetadata(chatId);
                const floodPart = floodMeta.participants.find(p => p.id === senderJid);
                if (floodPart && !floodPart.admin) {
                  await sock.groupParticipantsUpdate(chatId, [senderJid], 'remove');
                  console.log(`[FLOOD] 👢 ${senderJid} expulsado.`);
                } else {
                  console.log(`[FLOOD] ⚠️ ${senderJid} es admin — no se expulsa.`);
                }
              } catch (e) {
                console.error('[FLOOD] No se pudo expulsar al infractor:', e.message);
              }

              // 4. Reabrir el grupo automáticamente tras 2 minutos
              setTimeout(async () => {
                try {
                  await sock.groupSettingUpdate(chatId, 'not_announcement');
                  await sock.sendMessage(chatId, {
                    text: `✅ *[C3RB3RUS]* Grupo reabierto. El ataque de flood fue neutralizado.`,
                  });
                  console.log(`[FLOOD] 🔓 Grupo ${chatId} reabierto.`);
                } catch (_) {}
              }, 2 * 60 * 1000);
            }
            return;
          }
        }
        // ─────────────────────────────────────────────────────────────────────
        // ─────────────────────────────────────────────────────────────────────

        if (isCommand) {
          // Resolver número real del sender para el log de comandos
          const cmdSenderInfo = (() => {
            const short = (senderJid || '').split('@')[0];
            if (isGroup && groupMetadata && Array.isArray(groupMetadata.participants)) {
              const p = groupMetadata.participants.find(x => (x.id || '').split('@')[0] === short);
              if (p) {
                const phoneNum = p.phoneNumber ? p.phoneNumber.toString().split('@')[0] : null;
                const realNum = phoneNum || short;
                const name = p.notify || p.notifyName || p.name || msg.pushName || realNum;
                return { num: realNum, name };
              }
            }
            return { num: short, name: (msg.pushName && msg.pushName.trim()) || short };
          })();

          const time = new Date().toLocaleTimeString('es-CO', { hour12: false });
          console.log('');
          console.log(
            chalk.bgHex('#1a0033').hex('#b026ff').bold(' ⚡ CMD ') + ' ' +
            chalk.hex('#b026ff')('┄'.repeat(38))
          );
          console.log(
            paint.dim('  ├ ⏱  ') + chalk.hex('#aaa')(time) +
            paint.dim('  ·  ') +
            chalk.hex('#555').bold(chatId) + ' ' +
            chalk.hex('#e0e0e0').bold(groupName)
          );
          console.log(
            paint.dim('  ├ 👤 ') + paint.usr('@' + cmdSenderInfo.num) +
            chalk.hex('#666')(` ${cmdSenderInfo.name}`)
          );
          console.log(
            paint.dim('  └ 💀 ') + chalk.hex('#ff2d6b').bold(`!${command}`) +
            (args.length ? chalk.hex('#888')(` ${args.join(' ')}`) : '')
          );
          console.log('');
            
            // Comando especial !amor (privado para Carlos)
            if (command === 'amor') {
                await amorCommand(sock, msg, args);
                return;
            }

            // Dinámica de confesiones anónimas
            if (command === 'confesiones') {
                await manejarComandoConf(sock, chatId, senderJid, isAdmin, args);
                return;
            }
            
            await commandsCerbero(sock, msg, isAdmin, groupMetadata);
        }

        // Autorespuesta local (cerbero_simi) solo cuando lo mencionan o responden directamente.
        // La participación espontánea y la IA de Gemini se desactivan aquí.
        if (text && !isCommand && !msg.key.fromMe) {
            try {
                const botId  = sock.user?.id || '';
                const botNum = botId.split('@')[0].split(':')[0];
                const quotedInfo   = msg.message?.extendedTextMessage?.contextInfo;
                const isReplyToBot = quotedInfo?.participant === botId ||
                                     (quotedInfo?.participant || '').split(':')[0] === botNum;
                const mentionedJids = [
                    ...(quotedInfo?.mentionedJid || []),
                    ...(msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []),
                ];
                const mentionsBot   = mentionedJids.some(j => j === botId || j.split(':')[0] === botNum);
                const mentionsByText = text.includes(botNum) || text.toLowerCase().includes('cerbero');
                const isDirectTrigger = isReplyToBot || mentionsBot || mentionsByText;

                if (isDirectTrigger) {
                    await cerberoSimiBot(sock, msg);
                }
            } catch (e) {
                console.error('Error en autorespuesta local:', e);
            }
        }

        if (isGroup && !msg.key.fromMe) {
          if (text && !text.startsWith('!')) {
              await antilink(sock, msg, groupMetadata, isAdmin);
              await deleteLongMessage(sock, msg);
              if (text.startsWith('#') || text.startsWith('.')) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ *Syntax Error.* Protocol requires: \`!\`` }, { quoted: msg });
                return;
              }
          }
          await autobanVideo.handler(sock, msg, groupMetadata);
          // Detectar imagen: normal, documento-imagen, viewOnce (cualquier nivel de anidamiento)
          const _rawMsg = msg.message || {};
          const _viewOnceInner = _rawMsg.viewOnceMessage?.message
            || _rawMsg.viewOnceMessageV2?.message
            || _rawMsg.viewOnceMessageV2Extension?.message
            || _rawMsg.ephemeralMessage?.message?.viewOnceMessage?.message
            || _rawMsg.ephemeralMessage?.message?.viewOnceMessageV2?.message
            || _rawMsg.ephemeralMessage?.message?.viewOnceMessageV2Extension?.message;
          const _isViewOnceImage = !!_viewOnceInner?.imageMessage || !!_viewOnceInner?.videoMessage;
          const isImage = !!_rawMsg.imageMessage
            || (_rawMsg.documentMessage && _rawMsg.documentMessage.mimetype?.startsWith('image/'))
            || _isViewOnceImage;
          if (isImage) {
            const imgType = _rawMsg.imageMessage ? 'normal' : _isViewOnceImage ? 'view-once' : 'document';
            console.log(`[NSFW] 🖼️ Imagen detectada (${imgType}) de ${msg.key.participant || msg.key.remoteJid}`);
            await antiSpamMedia(sock, msg, isAdmin, groupMetadata);
            // Anti-QR primero (más ligero y específico).
            // Si detecta QR, ya borró el mensaje y expulsó → saltar NSFW para no duplicar recursos.
            const wasQr = await blockQr(sock, msg, isAdmin, groupMetadata);
            if (!wasQr) {
              await detectNSFW(sock, msg, isAdmin, groupMetadata);
            }
          }
          if (msg.message?.stickerMessage) {
            await handleStickerSpam(sock, msg);
          }
        }
      } catch (error) {
        // Ignorar
      }
    });

    // ==========================================
    // 📊 MONITOR DE EVENTOS DE GRUPO (FULL NAME)
    // ==========================================
    sock.ev.on('group-participants.update', async (update) => {
      try {
        // DEBUG: registrar el payload recibido (recortado para evitar volcar demasiado)
        try {
          const s = JSON.stringify(update);
          console.log(paint.dim('[EVENT] group-participants.update payload:') + ' ' + (s.length > 700 ? s.slice(0,700) + '... (truncated)' : s));
        } catch (e) {
          console.log('[EVENT] group-participants.update (unable to stringify payload)', e);
        }

        const chatId = update.id;
        let participants = update.participants;
        const action = update.action;

        // Normalizar participantes a JIDs WhatsApp válidos (prefiere phoneNumber cuando exista)
        if (Array.isArray(participants) && participants.length) {
          try {
            participants = participants.map(p => {
              if (!p) return p;
              if (typeof p === 'string') return p;
              if (p.phoneNumber && typeof p.phoneNumber === 'string' && p.phoneNumber.includes('@s.whatsapp.net')) return p.phoneNumber;
              if (p.id && typeof p.id === 'string') {
                if (p.id.includes('@s.whatsapp.net')) return p.id;
                if (p.id.endsWith('@lid')) {
                  const num = p.id.split('@')[0];
                  if (p.phoneNumber && p.phoneNumber.includes('@s.whatsapp.net')) return p.phoneNumber;
                  return `${num}@s.whatsapp.net`;
                }
                return p.id;
              }
              if (p.jid && typeof p.jid === 'string') return p.jid;
              return String(p);
            });
            // actualizamos el payload para que otros handlers reciban los JIDs normalizados
            update.participants = participants;
          } catch (e) {
            console.error('Error normalizando participants payload:', e);
          }
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const groupName = groupMetadata.subject || 'UNKNOWN_NET';
        const time = new Date().toLocaleTimeString('es-CO', { hour12: false });

        if (action === 'add') {
             // Resolver número real del participante
             const addTarget = participants[0];
             const addClean = (addTarget || '').split('@')[0].split(':')[0];
             const addReal = groupMetadata.participants?.find(p => (p.id||'').split('@')[0].split(':')[0] === addClean);
             const addNum = addReal?.phoneNumber ? addReal.phoneNumber.toString().split('@')[0] : addClean;
             console.log(`${paint.dim(time)} ${paint.join('[+] ENTITY JOINED')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(addNum)}`);
             
             await humanDelayWelcome(sock, update.id, 5, 10);
             await welcomeHandler(sock, update);
             await onGroupAddBaseline(sock, update);
             // Bienvenida autónoma (si el grupo tiene admin autónomo activado)
             darBienvenidaAutonoma(sock, chatId, participants, groupMetadata)
               .catch(e => console.error('[ADMIN-AUTO] bienvenida error:', e.message));
             // Verificar región del nuevo participante
             try {
               for (const pJid of participants) {
                 await verificarParticipanteNuevo(sock, chatId, pJid);
               }
             } catch(e) { console.error('[REGION] Error en verificación de nuevo miembro:', e.message); }

        } else if (action === 'remove') {
             const rmTarget = participants[0];
             const rmClean = (rmTarget || '').split('@')[0].split(':')[0];
             const rmReal = groupMetadata.participants?.find(p => (p.id||'').split('@')[0].split(':')[0] === rmClean);
             const rmNum = rmReal?.phoneNumber ? rmReal.phoneNumber.toString().split('@')[0] : rmClean;
             console.log(`${paint.dim(time)} ${paint.leave('[-] ENTITY LEFT  ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(rmNum)}`);
             // Reevaluar modo solo: puede que quien salió era el único admin humano
             onAdminChange(sock, update).catch(e => console.error('[ADMIN-AUTO] onAdminChange error:', e.message));

        } else if (action === 'promote') {
             // Resolver número real del participante
             const promoTarget = participants[0];
             const promoClean = (promoTarget || '').split('@')[0].split(':')[0];
             const promoReal = groupMetadata.participants?.find(p => (p.id||'').split('@')[0].split(':')[0] === promoClean);
             const promoNum = promoReal?.phoneNumber ? promoReal.phoneNumber.toString().split('@')[0] : promoClean;
             console.log(`${paint.dim(time)} ${paint.promote('[↑] PROMOTED     ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(promoNum)}`);
             await onGroupUpdate(sock, update);
             // Reevaluar modo solo: un nuevo admin humano puede activar TEAM MODE
             onAdminChange(sock, update).catch(e => console.error('[ADMIN-AUTO] onAdminChange error:', e.message));

        } else if (action === 'demote') {
             // Resolver número real del participante
             const demoTarget = participants[0];
             const demoClean = (demoTarget || '').split('@')[0].split(':')[0];
             const demoReal = groupMetadata.participants?.find(p => (p.id||'').split('@')[0].split(':')[0] === demoClean);
             const demoNum = demoReal?.phoneNumber ? demoReal.phoneNumber.toString().split('@')[0] : demoClean;
             console.log(`${paint.dim(time)} ${paint.demote('[↓] DEMOTED      ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(demoNum)}`);
             await onGroupUpdate(sock, update);
             // Reevaluar modo solo: el admin destituido puede haber sido el último humano
             onAdminChange(sock, update).catch(e => console.error('[ADMIN-AUTO] onAdminChange error:', e.message));
        } else if (action === 'leave') {
             // Salida voluntaria — igual que remove, puede ser un admin humano
             const leaveTarget = participants[0];
             const leaveClean = (leaveTarget || '').split('@')[0].split(':')[0];
             console.log(`${paint.dim(time)} ${paint.leave('[←] ENTITY LEFT  ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(leaveClean)}`);
             onAdminChange(sock, update).catch(e => console.error('[ADMIN-AUTO] onAdminChange error:', e.message));
        }

      } catch (error) {
      }
    });

    // ── ADMIN AUTÓNOMO: detectar cambios de configuración del grupo en tiempo real ──
    // Reacciona inmediatamente cuando algún admin abre/cierra el grupo manualmente.
    sock.ev.on('groups.update', async (updates) => {
      try {
        await onGroupSettingChange(sock, updates);
      } catch (e) {
        console.error('[GROUPS.UPDATE] Error en onGroupSettingChange:', e.message);
      }
    });

  } catch (err) {
    console.log(paint.bgTitle(' CRITICAL FAILURE '));
    console.log(paint.usr(' Rebooting System...'));
    
    // Guardar estado antes de reconectar
    guardarEstadoRecuperacion({
      ultimaConexion: Date.now(),
      processedMessages: Array.from(processedMessages).slice(-100)
    });
    
    limpiarAllTimers(allTimers);
    
    // Reconectar con throttling
    if (reconnectThrottler.shouldReconnect()) {
      const delay = reconnectThrottler.getNextDelay();
      console.log(paint.dim(`  ⏳ Esperando ${delay}ms antes de reconectar...`));
      setTimeout(connectToWhatsApp, delay);
    }
  }
}

function handleConnectionClose(lastDisconnect) {
  if (bannerInterval) {
    clearInterval(bannerInterval);
    bannerInterval = null;
  }

  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

  console.log(paint.warn(` [!] CONNECTION DROPPED: CODE ${statusCode} `));

  if (shouldReconnect) {
      console.log(paint.sys(` [AUTO] Re-establishing Link to C3rb3rus Server...`));
      
      // Guardar estado inmediatamente
      guardarEstadoRecuperacion({
        ultimaConexion: Date.now(),
        processedMessages: Array.from(processedMessages).slice(-100)
      });
      
      if (reconnectThrottler.shouldReconnect()) {
        const nextDelay = reconnectThrottler.getNextDelay();
        setTimeout(connectToWhatsApp, Math.min(nextDelay, 3000));
      }
  } else {
      console.log(paint.bgTitle(' SESSION TERMINATED '));
      console.log(paint.dim(' Delete "sessions" folder to reset credentials.'));
      reconnectThrottler.reset();
      process.exit(1);
  }
}

connectToWhatsApp();
