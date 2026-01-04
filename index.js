import pino from 'pino';
import chalk from 'chalk';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, delay } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import readline from 'readline'; 
import fs from 'fs'; 

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
import { onGroupUpdate } from './comandos_cerbero/monitor_evento.js' 
import { antiSpamMedia } from './comandos_cerbero/anti_spamimg.js';
import * as autobanVideo from './comandos_cerbero/autobanvideo.js';
import { verificarLealtad } from './comandos_cerbero/lealtad.js';
import { guardarEstadoRecuperacion, cargarEstadoRecuperacion, limpiarDeviceLists, validarCreds, ReconnectThrottler, limpiarAllTimers } from './utils/recovery.js';
import { incrementCount } from './utils/messageCounter.js';
import { initResetScheduler } from './utils/resetScheduler.js';

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
      logger: logger,
      printQRInTerminal: false,
      browser: ["Windows", "Chrome", "10.15.7"], 
      connectTimeoutMs: 60000, 
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000, 
      emitOwnEvents: true,
      fireInitQueries: true, 
      shouldIgnoreJid: jid => !jid.endsWith('@g.us'),
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



    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;
      const msg = messages[0];
      if (!msg?.key?.remoteJid || !msg?.message) return;

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

        // Bloquear y reportar mensajes privados
        if (!isGroup && !msg.key.fromMe) {
            try {
                await sock.sendMessage(chatId, { text: 'Lo siento, no acepto mensajes privados. Serás bloqueado y reportado por seguridad.' });
                await sock.blockContact(senderJid);
                await sock.reportContact(senderJid, 'spam');
                console.log(paint.warn(`[BLOCK] Usuario ${senderJid} bloqueado y reportado por mensaje privado.`));
            } catch (error) {
                console.error(paint.warn(`[ERROR] No se pudo bloquear/reportar a ${senderJid}:`), error.message);
            }
            return;
        }

        if (isGroup) {
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
          try { await incrementCount(chatId, senderJid, text || logDisplay || ''); } catch (e) { /* no bloquear logging */ }
            const time = new Date().toLocaleTimeString('es-CO', { hour12: false });
            const tag = isGroup ? paint.sys('GRUP') : paint.warn('PRIV');
            
            // ✅ NOMBRE DEL GRUPO COMPLETO (SIN SUBSTRING)
            const source = isGroup ? groupName : 'ENCRYPTED'.padEnd(15);

            // Resolver short JID y nombre legible del remitente (similar a !actividad)
            const resolveParticipantDisplay = (jid) => {
              const short = (jid || '').toString().split('@')[0];
              if (isGroup && groupMetadata && Array.isArray(groupMetadata.participants)) {
                const p = groupMetadata.participants.find(x => {
                  const id = (x && (x.id || x).toString()) || '';
                  return id.split('@')[0] === short;
                });
                if (p) {
                  const display = (p.notify || p.notifyName || p.name || p.pushname || (p.id && p.id.split('@')[0]) || short).toString();
                  return { short, display };
                }
              }
              // fallback a pushName o short
              return { short, display: (msg.pushName && msg.pushName.trim()) || short };
            };

            const senderInfo = resolveParticipantDisplay(senderJid);
            const senderDisplay = senderInfo.display;
            const senderShort = senderInfo.short;

            console.log(
              paint.dim(`${time}`) + ' ' + 
              paint.dim('|') + ' ' + 
              tag + ' ' +
              paint.dim('|') + ' ' +
              paint.sys(source) + ' ' + 
              paint.dim('>>') + ' ' +
              paint.usr('@' + senderShort) + (senderDisplay ? ' (' + senderDisplay + ')' : '') + ' ' +
              paint.txt(': ') + 
              logDisplay
            );
        }
        // =======================================================

        if (!text && !['imageMessage', 'stickerMessage', 'videoMessage', 'audioMessage'].includes(msgType)) return;

        const isCommand = text.startsWith('!');
        const [command, ...args] = isCommand ? text.slice(1).trim().split(/\s+/) : [''];

        if (isCommand) {
            console.log(paint.dim('┌──────────────────────────────────────────────────┐'));
            console.log(paint.dim('│ ') + paint.bgTitle(' ⚡ COMMAND DETECTED ⚡ ') + paint.dim('                         │'));
            console.log(paint.dim('├──────────────────────────────────────────────────┤'));
            console.log(paint.dim('│ ') + paint.warn('OWNER:') + ' C3RB3RUS-666' + paint.dim('                               │'));
            console.log(paint.dim('│ ') + paint.sys('INPUT:') + ' ' + paint.txt(`!${command}`) + paint.dim('                                     ').substring(0, 35 - command.length) + paint.dim('│'));
            console.log(paint.dim('│ ') + paint.sys('ORIGIN:') + ' ' + paint.txt(groupName.substring(0, 25)) + paint.dim('                                ').substring(0, 25 - groupName.length) + paint.dim('    │'));
            console.log(paint.dim('└──────────────────────────────────────────────────┘'));
            
            await commandsCerbero(sock, msg, isAdmin, groupMetadata);
        }

        // El trigger automático para Cerbero-AI y Simi fue DESACTIVADO por petición.
        // Ahora ofrecemos un trigger abierto: cualquier mensaje (no comando) puede invocar la IA
        // respetando un cooldown por chat y añadiendo un retraso antes de ejecutar la llamada.
        // Además, solo responde en un porcentaje configurable de veces para evitar acoso intensivo.
        if (text && !isCommand && !msg.key.fromMe) {
            try {
                const cooldownMs = CERBERO_COOLDOWN_MS;
                const delayMs = CERBERO_DELAY_MS;
                const responseProb = CERBERO_RESPONSE_PROBABILITY;
                const now = Date.now();
                const last = lastCerberoTrigger.get(chatId) || 0;
                if (Math.random() < responseProb && now - last > cooldownMs) {
                    lastCerberoTrigger.set(chatId, now);
                    setTimeout(async () => {
                        try {
                            await cerberoSimiBot(sock, msg);
                        } catch (err) {
                            console.error('cerbero trigger error', err);
                        }
                    }, delayMs);
                }
            } catch (e) {
                console.error('Error en trigger abierto cerbero:', e);
            }
        }

        if (isGroup && !msg.key.fromMe) {
          if (text) {
              await antilink(sock, msg, groupMetadata, isAdmin);
              await deleteLongMessage(sock, msg);
              if (text.startsWith('#') || text.startsWith('.')) {
                await sock.sendMessage(msg.key.remoteJid, { text: `❌ *Syntax Error.* Protocol requires: \`!\`` }, { quoted: msg });
                return;
              }
          }
          await autobanVideo.handler(sock, msg, groupMetadata);
          const isImage = !!msg.message?.imageMessage || (msg.message?.documentMessage && msg.message.documentMessage.mimetype?.startsWith('image/'));
          if (isImage) {
            await antiSpamMedia(sock, msg, isAdmin, groupMetadata);
            await blockQr(sock, msg, isAdmin, groupMetadata);
          }
          if (msg.message?.stickerMessage) await handleStickerSpam(sock, msg);
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
             // ✅ NOMBRE COMPLETO SIN CORTES
             console.log(`${paint.dim(time)} ${paint.join('[+] ENTITY JOINED')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(participants[0].split('@')[0])}`);
             
             await humanDelayWelcome(sock, update.id, 5, 10);
             await welcomeHandler(sock, update);

        } else if (action === 'remove') {
             console.log(`${paint.dim(time)} ${paint.leave('[-] ENTITY LEFT  ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(participants[0].split('@')[0])}`);

        } else if (action === 'promote') {
             console.log(`${paint.dim(time)} ${paint.promote('[↑] PROMOTED     ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(participants[0].split('@')[0])}`);

        } else if (action === 'demote') {
             console.log(`${paint.dim(time)} ${paint.demote('[↓] DEMOTED      ')} ${paint.dim('|')} ${paint.sys(groupName)} ${paint.dim('>>')} ${paint.txt(participants[0].split('@')[0])}`);
             await onGroupUpdate(sock, update); 
        }

      } catch (error) {
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
