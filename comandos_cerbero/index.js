import { createSticker } from './sticker.js';
import { toggleAntilink } from './antilink.js';  
import { handleAntiStatusTagCmd } from './anti_status_tag.js';
import { readLog } from './read_log.js';
import { banUser } from './ban.js';
import { sendToAll } from './todos.js';
import { tagGroupSilently } from './todos_2.js';
import { menuCommand } from './menu.js';
import { artCommand } from './art.js';
import { creador } from './programador.js';
import { handleParejasCommand } from './parejas.js';
import { 
  proposeMarriage, 
  acceptMarriage, 
  rejectMarriage, 
  divorceMarriage, 
  checkRelationship 
} from './matrimonio.js';
import { helpCommand } from './help.js'
import { removeAdmin, makeAdmin } from './admins.js';
import { top5Cachudos } from './cachudos.js';
import { ping } from './ping.js';
import { top5infieles } from './infieles.js';
import { top5pajeros } from './pajeros.js';
import { toggleWelcome } from './welcome.js';
import { playMusicCommand } from './music.js';
import { handleCpruebaCommand, handleCplaydSelection, handleCplay2Selection } from './music_cplay2.js';
import { toggleGroupPrivacy } from './group_config.js';
import { top5Maricones } from './maricones.js';
import { cerberoSimiBot } from "./cerbero_simi.js";
import { youtubeCommand } from './youtube.js';
import youtubeCb from './yt_cb.js';
import tiktokCb from './tiktok_cb.js';
import instagramCb from './instagram_cb.js';
import { doxCommand } from './dox.js';
import { tagAdmins } from './tag_admins.js';
import { buscarMusica } from './yt_search.js';
import { extractStickerImage } from './extractorwebp.js';
import { joinGroup } from './joingroup.js';
import killGroup from './killgroup.js';
import { clearOldLinkLogs } from './clearl_log.js';
import { executePythonOrShell } from './interprete.js';
import { buscarNumerosEnGrupo } from './busqueda.js';
import { buscarGoogle } from './google.js';
import { handleHackTheBox } from './hackthebox.js';
import { handlePinterest } from './pinterest.js';
import { commandTopPlayers } from './top_player.js';
import { activeStats } from './active_stats.js';
import { maybeSaqueoMaestro } from './gameFIle.js';
import { nuevosCommand } from './nuevos_fixed.js';
import { lidMapCommand } from './lidmap.js';
import { toggleMonitorAdmin } from './monitor_evento.js';
import { toggleAdminAutonomo } from './admin_autonomo.js';
import { handleBuscaminas } from './buscaminas.js';
// juego RPG y Economía
import {
  commandDaily,
  commandWork,
  commandRob,
  commandHunt,
  commandBuy,
  commandInventory,
  commandLevel,
  commandSell,
  commandProfile,
  commandBanco,
  commandDepositar,
  commandRetirar,
  commandInvertir,
  // Nuevos comandos de casino
  commandRuleta,
  commandBlackjack,
  commandPedir,
  commandPlantar,
  commandDoblar,
  commandSplit,
  commandRendirse,
  commandSeguro,
  commandNoSeguro,
  commandCasinoStats,
  commandLogros,
  commandFish,
  commandDonar,
  commandRobBanco,
  commandCajaFuerte,
  commandGuardar,
  commandSacar,
  commandAdivinaPalabra,
  commandPutas,
  commandDrogas,
  commandPurgarSistema 
} from './gameFIle.js';

// Nuevos comandos RPG avanzado
import { default as balanceCommand } from './rpg/balance.js';
import { default as trabajarCommand } from './rpg/trabajar.js';
import { default as aventuraCommand } from './rpg/aventura.js';
import { default as minarCommand } from './rpg/minar.js';
import { default as tiendaCommand } from './rpg/tienda.js';
import { default as robarCommand } from './rpg/robar.js';
import { default as transferirCommand } from './rpg/transferir.js';
import { default as lideresCommand } from './rpg/lideres.js';
import { default as perfilCommand } from './rpg/perfil.js';

// Función auxiliar para delays realistas
// humanDelay mejorado (reemplaza tu versión actual)
async function humanDelay(sock, message, minSeconds = 2, maxSeconds = 6, opts = {}) {
  // opts: { usePresence: true|false, presenceProbability: 0.6, maxActiveMessages: 3 }
  const { usePresence = true, presenceProbability = 0.6, maxActiveMessages = 3 } = opts || {};

  const chatId = message?.key?.remoteJid;
  if (!chatId) return;

  // No usar presencia en chats privados (según tu configuración)
  const isGroup = chatId.endsWith('@g.us');
  // Si no es grupo, solo aplicar delay simple sin presencia
  if (!isGroup) {
    const ms = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;
    await new Promise(r => setTimeout(r, ms));
    return;
  }

  // Delay aleatorio principal (en ms)
  const mainDelay = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) * 1000;

  // Antes de "escribir", chequeo básico para evitar spam de presencia:
  // opcional: si el grupo es extremadamente activo (muchos mensajes), evita presencia.
  // Aquí se asume que no tienes contador de actividad; dejamos una probabilidad simple.
  const sendPresence = usePresence && (Math.random() < presenceProbability);

  if (sendPresence) {
    // Mandar composing con jitter previo pequeño
    try {
      // pequeño jitter previo (100-500ms)
      await new Promise(r => setTimeout(r, 100 + Math.floor(Math.random() * 400)));
      await sock.sendPresenceUpdate('composing', chatId);

      // Espera una fracción del mainDelay simulando escritura
      // Por ejemplo, entre 30% y 80% del tiempo total
      const writingPortion = Math.floor(mainDelay * (0.3 + Math.random() * 0.5));
      await new Promise(r => setTimeout(r, writingPortion));

      // Pausa breve antes de pausar presencia
      await sock.sendPresenceUpdate('paused', chatId);

      // Completar el resto del delay (si queda)
      const remaining = mainDelay - writingPortion;
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));
    } catch (e) {
      // si falla presencia, caer en sleep simple para no romper flujo
      await new Promise(r => setTimeout(r, mainDelay));
    }
  } else {
    // Si no vamos a enviar presencia, simplemente esperar el tiempo principal
    await new Promise(r => setTimeout(r, mainDelay));
  }

  // Pequeño micro-jitter final para evitar patrones fijos
  await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 200)));
}

export async function commandsCerbero(sock, message, isAdmin, groupMetadata) {
  // Chequear evento global del Jefe Maestro en TODOS los comandos
  try {
    const triggered = await maybeSaqueoMaestro(sock, message);
    if (triggered) return; // si ocurrió, no procesamos más el comando
  } catch (e) {
    console.error('Error chequeando saqueo maestro (global):', e);
  }
  const text =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption || 
    '';

  const plainText = text.trim();
  // Soportar selección numérica de cplay/cplayd (respuestas sin '!')
  // detectar selección mediante botones de Baileys
  const btnSel = message.message?.buttonsResponseMessage?.selectedButtonId || message.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
  if (btnSel && /^[1-9]$/.test(btnSel.toString())) {
    try {
      await handleCplaydSelection(sock, message);
    } catch (e) {
      console.error('Error handling cplayd selection (button):', e);
    }
    return;
  }

  if (/^[1-9]$/.test(plainText)) {
    try {
      await handleCplaydSelection(sock, message);
    } catch (e) {
      console.error('Error handling cplayd selection:', e);
    }
    return;
  }

  // Detectar si es una respuesta o mención al bot y procesar con IA local
  const quotedInfo = message.message?.extendedTextMessage?.contextInfo;
  const quotedText =
    quotedInfo?.quotedMessage?.conversation ||
    quotedInfo?.quotedMessage?.extendedTextMessage?.text ||
    '';
  const referencedBotMessage =
    quotedInfo?.participant === sock.user?.id ||
    quotedText.includes('CERBERO-BOT');
  const isReplyToBot = Boolean(quotedInfo?.quotedMessage && referencedBotMessage);
  const mentionedJids = quotedInfo?.mentionedJid || [];
  const isMentioned = mentionedJids.includes(sock.user?.id);
  const botNumber = sock.user?.id?.split('@')?.[0] || '';
  const isMentionByText = text.includes(botNumber) || text.includes(`@${botNumber}`);

  // ─────────────────────────────────────────────────────────────────────
  // 💡 NOTA: Las respuestas a menciones/replies se manejan en index.js
  //    principal vía cerbero_ia. Este bloque estaba duplicando respuestas.
  //    Si necesitas reactivar cerberoSimiBot aquí, descomenta el bloque.
  // ─────────────────────────────────────────────────────────────────────
  // if (isReplyToBot || ((isMentioned || isMentionByText) && !text.startsWith('!'))) {
  //   try {
  //     await cerberoSimiBot(sock, message);
  //   } catch (e) {
  //     console.error('Error en IA local para respuesta:', e);
  //   }
  //   return;
  // }

  if (!text.startsWith('!')) return;

  const [command, ...args] = text.slice(1).trim().split(/\s+/);
  console.log(`Comando recibido: ${command} | Args: ${args}`);

  switch (command.toLowerCase()) {
    case 'ping':
      await humanDelay(sock, message, 1, 3);
      await ping(sock, message);
      break;
    
    case 'sticker':
      await humanDelay(sock, message, 2, 5);
      await createSticker(sock, message, args);
      break;
    
    case 'antilink':
      await humanDelay(sock, message, 1, 3);
      await toggleAntilink(sock, message, isAdmin, args);
      break;

    case 'antistatustag':
      await handleAntiStatusTagCmd(sock, message, isAdmin);
      break;

    case 'vigilar':
      await humanDelay(sock, message, 1, 3);
      await toggleMonitorAdmin(sock, message, isAdmin);
      break;
    
    case 'leerlog':
      await humanDelay(sock, message, 3, 7);
      await readLog(sock, message, isAdmin);
      break;
    
    case 'todos':
      await humanDelay(sock, message, 2, 6);
      await sendToAll(sock, message, isAdmin, groupMetadata);
      break;
    
    case 'kick':
    case 'ban':
      await humanDelay(sock, message, 2, 4);
      await banUser(sock, message, isAdmin, groupMetadata);
      break;
    
    case 'tag_group':
      await humanDelay(sock, message, 2, 5);
      await tagGroupSilently(sock, message, isAdmin, groupMetadata);
      break;
    case 'help':
    case 'ayuda':
    case 'guia':
      await humanDelay(sock, message, 2, 5);
      await helpCommand(sock, message);
      break;
    case 'menu':
      await humanDelay(sock, message, 2, 5);
      await menuCommand(sock, message);
      break;

    case 'arte':
    case 'art':
      await humanDelay(sock, message, 1, 3);
      await artCommand(sock, message);
      break;
    case 'creador':
    case 'programador':
      await humanDelay(sock, message, 1, 3);
      await creador(sock, message);
      break;
    
    case 'parejas':
      await humanDelay(sock, message, 3, 6);
      await handleParejasCommand(sock, message, groupMetadata);
      break;

    // 'impostor' command removed for safety
    
    case 'promote':
      await humanDelay(sock, message, 1, 3);
      await makeAdmin(sock, message, isAdmin);
      break;
    
    case 'demote':
      await humanDelay(sock, message, 1, 3);
      await removeAdmin(sock, message, isAdmin);
      break;
    
    case 'casarme':
    case 'casemonos':
      await humanDelay(sock, message, 2, 4);
      await proposeMarriage(sock, message, groupMetadata);
      break;
    
    case 'aceptar':
      await humanDelay(sock, message, 1, 3);
      await acceptMarriage(sock, message);
      break;
    
    case 'rechazar':
      await humanDelay(sock, message, 1, 3);
      await rejectMarriage(sock, message);
      break;
    
    case 'divorcio':
    case 'divorciarse':
      await humanDelay(sock, message, 2, 4);
      await divorceMarriage(sock, message);
      break;
    
    case 'pareja':
    case 'mipareja':
      await humanDelay(sock, message, 2, 4);
      await checkRelationship(sock, message, args);
      break;
    
    case 'cachudos':
      await humanDelay(sock, message, 2, 5);
      await top5Cachudos(sock, message, groupMetadata);
      break;
    
    case 'pajeros':
      await humanDelay(sock, message, 2, 5);
      await top5pajeros(sock, message, groupMetadata);
      break;
    
    case 'infieles':
      await humanDelay(sock, message, 2, 5);
      await top5infieles(sock, message, groupMetadata);
      break;
    
    case 'bienvenida':
      await humanDelay(sock, message, 1, 3);
      if (!isAdmin) {
        await sock.sendMessage(message.key.remoteJid, { 
          text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 ⚠️ 𝐒𝐨𝐥𝐨 𝐥𝐨𝐬 𝐚𝐝𝐦𝐢𝐧𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐫𝐞𝐬 𝐩𝐮𝐞𝐝𝐞𝐧 𝐮𝐬𝐚𝐫 𝐞𝐬𝐭𝐞 𝐜𝐨𝐦𝐚𝐧𝐝𝐨.' 
        }, { quoted: message });
        return;
      } else {
        const chatId = message.key.remoteJid;
        const action = args[0]?.toLowerCase();
        
        if (action === 'activar') {
          const response = toggleWelcome(chatId, true);
          await sock.sendMessage(chatId, { text: `✅ ${response}` }, { quoted: message });
        } else if (action === 'desactivar') {
          const response = toggleWelcome(chatId, false);
          await sock.sendMessage(chatId, { text: `✅ ${response}` }, { quoted: message });
        } else {
          await sock.sendMessage(chatId, {
            text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬 ⚙️ 𝐔𝐬𝐨 𝐝𝐞𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨:\n- `!bienvenida activar`: Activa la bienvenida\n- `!bienvenida desactivar`: Desactiva la bienvenida',
          }, { quoted: message });
        }
      }
      break;

    case 'actividad':
    case 'actividad':
    case 'activos':
      await humanDelay(sock, message, 1, 3);
      await activeStats(sock, message, isAdmin, groupMetadata);
      break;

    case 'nuevos':
      await humanDelay(sock, message, 1, 3);
      await nuevosCommand(sock, message, isAdmin, groupMetadata);
      break;
    
    case 'cplay':
      await humanDelay(sock, message, 3, 7);
      // Si el usuario usa '!cplay <n>' y existe una sesión de cplay2, usarla como selección
      if (args[0] && /^[1-5]$/.test(args[0])) {
        try {
          await handleCplaydSelection(sock, message, parseInt(args[0], 10));
          break;
        } catch (e) {
          console.error('Error handling cplay numeric selection:', e);
        }
      }
      await playMusicCommand(sock, message, args);
      break;
    case 'cplay2':
      // Compat: redirigir a nuevo comando
      await humanDelay(sock, message, 3, 7);
      await handleCpruebaCommand(sock, message, args);
      break;
    case 'cplayd':
      await humanDelay(sock, message, 2, 4);
      if (args[0] && /^[1-9]$/.test(args[0])) {
        // Número → descargar de la sesión activa
        await handleCplaydSelection(sock, message, parseInt(args[0], 10));
      } else if (args.length > 0) {
        // Texto → buscar y mostrar previews (igual que !cprueba)
        await handleCpruebaCommand(sock, message, args);
      } else {
        // Sin args → intentar selección por respuesta
        await handleCplaydSelection(sock, message);
      }
      break;
    
    case 'grupo':
      await humanDelay(sock, message, 1, 3);
      await toggleGroupPrivacy(sock, message, isAdmin, groupMetadata);
      break;

    case 'autonomo':
      await humanDelay(sock, message, 1, 2);
      await toggleAdminAutonomo(sock, message, isAdmin);
      break;
    
    case 'maricones':
      await humanDelay(sock, message, 2, 5);
      await top5Maricones(sock, message, groupMetadata);
      break;
    
    // comando 'peruanos' eliminado (por solicitud).
    
    case 'simi':
      await humanDelay(sock, message, 2, 4);
      await cerberoSimiBot(sock, message);
      break;

    case 'cerbero':
    case 'bot':
      await humanDelay(sock, message, 1, 3);
        // Uso: !cerbero <texto>  — invoca a Cerbero-Simi (IA local en Python)
        const query = args.join(' ').trim();
        if (!query) {
            await sock.sendMessage(message.key.remoteJid, { text: '🤖 *Cerbero-Simi IA local*\n' +
              'Puedes conversar o enseñarle cosas usando la sintaxis sencilla:\n' +
              'Ejemplo para aprender: !cerbero aprende: quien es el jefe | Soy yo, obviamente\n' +
              'Ejemplo para preguntar: !cerbero ¿Qué es una red neuronal?' }, { quoted: message });
          break;
        }
        // clonar el mensaje y sustituir su contenido por el query para que Cerbero procese correctamente
        const fakeMsg = JSON.parse(JSON.stringify(message));
        fakeMsg.message = { conversation: query };
        try {
          await cerberoSimiBot(sock, fakeMsg);
        } catch (err) {
          console.error('Error invocando cerberoSimiBot:', err && err.message ? err.message : err);
          await sock.sendMessage(message.key.remoteJid, { text: '❌ Error al procesar la solicitud con Cerbero-Simi.' }, { quoted: message });
        }
        break;
    
    case 'cerbero_yt':
      await humanDelay(sock, message, 3, 8);
      await youtubeCommand(sock, message, args);
      break;

    case 'yt_cb':
      await humanDelay(sock, message, 3, 8);
      // si es número, reutilizar archivo de resultados (si existe)
      if (/^[1-9]$/.test(args[0])) {
        // construir un mensaje falso con solo el número como texto para que la función lo maneje
        const fakeMsg = JSON.parse(JSON.stringify(message));
        fakeMsg.message = { conversation: args[0] };
        // delegar a yt_cb viendo búsqueda previa
        await youtubeCb(sock, fakeMsg, [args[0]], { video: false });
      } else {
        await youtubeCb(sock, message, args, { video: false });
      }
      break;

    case 'yt_cbv':
      await humanDelay(sock, message, 3, 8);
      if (/^[1-9]$/.test(args[0])) {
        const fakeMsg = JSON.parse(JSON.stringify(message));
        fakeMsg.message = { conversation: args[0] };
        await youtubeCb(sock, fakeMsg, [args[0]], { video: true });
      } else {
        await youtubeCb(sock, message, args, { video: true });
      }
      break;

    case 'tt_cb':
    case 'tiktok_cb':
      await humanDelay(sock, message, 3, 6);
      await tiktokCb(sock, message, args);
      break;

    case 'ig_cb':
      await humanDelay(sock, message, 3, 6);
      await instagramCb(sock, message, args);
      break;
    
    case 'admins':
      await humanDelay(sock, message, 1, 3);
      await tagAdmins(sock, message, isAdmin, args);
      break;
    
    case 'cerbero_search':
      await humanDelay(sock, message, 3, 7);
      await buscarMusica(sock, message, args);
      break;
    
    case 'extractor':
      await humanDelay(sock, message, 2, 5);
      await extractStickerImage(sock, message);
      break;
    
    case 'bot_join':
      await humanDelay(sock, message, 2, 4);
      await joinGroup(sock, message);
      break;
    
    case 'killgroup':
      await humanDelay(sock, message, 2, 4);
      await killGroup(sock, message, groupMetadata);  
      break;

    case 'lidmap':
      await lidMapCommand(sock, message, groupMetadata);
      break;
    
    case 'clear_log':
      await humanDelay(sock, message, 2, 5);
      await clearOldLinkLogs(sock, message, isAdmin);
      break;
    
    case '$':
      await humanDelay(sock, message, 2, 6);
      const shellCommand = args.join(' ');
      await executePythonOrShell(sock, message, shellCommand);
      break;
    
  /*  case 'buscar':
      await humanDelay(sock, message, 3, 7);
      await buscarNumerosEnGrupo(sock, message, args);
      break; 
      busqueda de numerros desactivada
      */
    
    case 'google':
      await humanDelay(sock, message, 4, 10);
      await buscarGoogle(sock, message, args);
      break;

    case 'pin':
    case 'pinterest':
      await humanDelay(sock, message, 3, 8);
      await handlePinterest(sock, message);
      break;

    case 'htb':
    case 'hackthebox': {
      await humanDelay(sock, message, 2, 5);
      const htbReply = await handleHackTheBox(sock, message);
      if (htbReply) await sock.sendMessage(chatId, { text: htbReply }, { quoted: message });
      break;
    }
      
    // Comandos de RPG y Economía
    case 'daily':
      await humanDelay(sock, message, 1, 3);
      await commandDaily(sock, message);
      break;
    
    case 'work':
      await humanDelay(sock, message, 2, 5);
      await commandWork(sock, message);
      break;
    
    case 'rob':
      await humanDelay(sock, message, 3, 7);
      await commandRob(sock, message);
      break;
    
    case 'hunt':
      await humanDelay(sock, message, 2, 5);
      await commandHunt(sock, message);
      break;
    
    case 'buy':
      await humanDelay(sock, message, 2, 4);
      await commandBuy(sock, message, args);
      break;
    
    case 'inventory':
      await humanDelay(sock, message, 2, 4);
      await commandInventory(sock, message);
      break;
    
    case 'level':
      await humanDelay(sock, message, 1, 3);
      await commandLevel(sock, message);
      break;
    
    case 'sell':
      await humanDelay(sock, message, 2, 4);
      await commandSell(sock, message);
      break;
    
    case 'profile':
      await humanDelay(sock, message, 2, 5);
      await commandProfile(sock, message);
      break;
    
    // Nuevos comandos RPG avanzado
    case 'cartera':
    case 'bolsillo':
    case 'balance':
    case 'bal':
      await humanDelay(sock, message, 1, 3);
      await balanceCommand(sock, message);
      break;
    
    case 'trabajar':
    case 'daily':
    case 'claim':
    case 'reclamar':
      await humanDelay(sock, message, 2, 5);
      await trabajarCommand(sock, message);
      break;
    
    case 'aventura':
    case 'adventure':
      await humanDelay(sock, message, 3, 7);
      await aventuraCommand(sock, message);
      break;
    
    case 'minar':
    case 'mine':
    case 'excavar':
      await humanDelay(sock, message, 2, 5);
      await minarCommand(sock, message);
      break;
    
    case 'tienda':
    case 'shop':
    case 'comprar':
      await humanDelay(sock, message, 2, 4);
      await tiendaCommand(sock, message, args);
      break;
    
    case 'robar':
    case 'rob':
      await humanDelay(sock, message, 3, 7);
      await robarCommand(sock, message);
      break;
    
    case 'transferir':
    case 'transfer':
    case 'dar':
      await humanDelay(sock, message, 2, 4);
      await transferirCommand(sock, message, args);
      break;
    
    case 'lideres':
    case 'leaderboard':
    case 'lb':
    case 'ranking':
      await humanDelay(sock, message, 2, 5);
      await lideresCommand(sock, message, args);
      break;
    
    case 'perfil':
    case 'stats':
      await humanDelay(sock, message, 2, 5);
      await perfilCommand(sock, message);
      break;

    case 'banco':
      await humanDelay(sock, message, 1, 3);
      await commandBanco(sock, message);
      break;
    
    case 'depositar':
      await humanDelay(sock, message, 2, 4);
      await commandDepositar(sock, message, args);
      break;
    
    case 'retirar':
      await humanDelay(sock, message, 2, 4);
      await commandRetirar(sock, message, args);
      break;
    
    case 'invertir':
      await humanDelay(sock, message, 2, 5);
      await commandInvertir(sock, message, args);
      break;
    
    case 'fish':
    case 'pescar':
      await humanDelay(sock, message, 2, 6);
      await commandFish(sock, message);
      break;
    
    // Comandos de casino
    case 'ruleta':
      await humanDelay(sock, message, 4, 8);
      if (!args[0] || isNaN(args[0])) {
        await sock.sendMessage(message.key.remoteJid, {
          text: "⚠️ Uso: `!ruleta <cantidad>` (ejemplo: !ruleta 500)"
        }, { quoted: message });
        return;
      }
      await commandRuleta(sock, message, args[0]);
      break;
    
    case 'blackjack':
      await humanDelay(sock, message, 3, 7);
      await commandBlackjack(sock, message, args[0]);
      break;
    
    case 'pedir':
      await humanDelay(sock, message, 1, 3);
      await commandPedir(sock, message);
      break;
    
    case 'plantar':
      await humanDelay(sock, message, 1, 3);
      await commandPlantar(sock, message);
      break;

    case 'doblar':
      await humanDelay(sock, message, 1, 3);
      await commandDoblar(sock, message);
      break;

    case 'split':
      await humanDelay(sock, message, 1, 3);
      await commandSplit(sock, message);
      break;

    case 'rendirse':
      await humanDelay(sock, message, 1, 3);
      await commandRendirse(sock, message);
      break;

    case 'seguro':
      await humanDelay(sock, message, 1, 3);
      await commandSeguro(sock, message);
      break;

    case 'noseguro':
      await humanDelay(sock, message, 1, 3);
      await commandNoSeguro(sock, message);
      break;

    case 'casinostats':
      await humanDelay(sock, message, 2, 4);
      await commandCasinoStats(sock, message);
      break;
    
    case 'logros':
      await humanDelay(sock, message, 2, 5);
      await commandLogros(sock, message);
      break;
    
    case 'donar':
      await humanDelay(sock, message, 2, 4);
      await commandDonar(sock, message, args);
      break;
    
    case 'robbanco':
      await humanDelay(sock, message, 3, 6);
      await commandRobBanco(sock, message, args);
      break;
    
    case 'caja':
    case 'cajafuerte':
      await humanDelay(sock, message, 1, 3);
      await commandCajaFuerte(sock, message);
      break;
    
    case 'guardar':
      await humanDelay(sock, message, 2, 4);
      await commandGuardar(sock, message, args);
      break;
    
    case 'sacar':
      await humanDelay(sock, message, 2, 4);
      await commandSacar(sock, message, args);
      break;
    
    case 'adivinapalabra':
      await humanDelay(sock, message, 2, 5);
      await commandAdivinaPalabra(sock, message, args);
      break;

    case 'minas':
    case 'buscaminas':
      await humanDelay(sock, message, 1, 3);
      await handleBuscaminas(sock, message);
      break;
    
    case 'putas':
    case 'stalin':
    case 'lujuria':
      await humanDelay(sock, message, 2, 5);
      await commandPutas(sock, message);
      break;

    case 'dox':
      await humanDelay(sock, message, 1, 3);
      await doxCommand(sock, message, isAdmin, groupMetadata);
      break;
    
    case 'top':
    case 'top5':
    case 'topricos':
      await humanDelay(sock, message, 2, 5);
      await commandTopPlayers(sock, message);
      break;
    
    case 'drogas':
    case 'narco':
    case 'trafico':
      await humanDelay(sock, message, 3, 6);
      await commandDrogas(sock, message, args);
      break;
    
    case 'purga':
    case 'purgarsistema':
    case 'saquear':
      await humanDelay(sock, message, 3, 7);
      await commandPurgarSistema(sock, message);
      break;

default:
      await humanDelay(sock, message, 1, 2);
      await sock.sendMessage(message.key.remoteJid, {
        text: '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬\n❌ 𝐂𝐨𝐦𝐚𝐧𝐝𝐨 𝐧𝐨 𝐫𝐞𝐜𝐨𝐧𝐨𝐜𝐢𝐝𝐨.\n\n💡 ¿𝐄𝐬𝐭á𝐬 𝐩𝐞𝐫𝐝𝐢𝐝𝐨?\n• 𝐔𝐬𝐚 `!𝐡𝐞𝐥𝐩` 𝐩𝐚𝐫𝐚 𝐥𝐞𝐞𝐫 𝐥𝐚 𝐠𝐮í𝐚 𝐝𝐞 𝐢𝐧𝐢𝐜𝐢𝐨.\n• 𝐔𝐬𝐚 `!𝐦𝐞𝐧𝐮` 𝐩𝐚𝐫𝐚 𝐯𝐞𝐫 𝐭𝐨𝐝𝐨𝐬 𝐥𝐨𝐬 𝐜𝐨𝐦𝐚𝐧𝐝𝐨𝐬.',
      }, { quoted: message });
      break;
  }
}



