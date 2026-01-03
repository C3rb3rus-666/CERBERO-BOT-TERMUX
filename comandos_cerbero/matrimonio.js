import fs from 'fs';
const DB_PATH = './comandos_cerbero/matrimonios.json';

// === Base de datos JSON ===
let matrimonios = {};
if (fs.existsSync(DB_PATH)) {
  matrimonios = JSON.parse(fs.readFileSync(DB_PATH));
}

function saveMatrimonios() {
  fs.writeFileSync(DB_PATH, JSON.stringify(matrimonios, null, 2));
}

/**
 * Propuesta de matrimonio
 */
export const proposeMarriage = async (sock, msg, groupMetadata) => {
  const chatId = msg.key.remoteJid;
  const mentionedJids = msg.message.extendedTextMessage?.contextInfo?.mentionedJid;

  if (!mentionedJids || mentionedJids.length === 0) {
    await sock.sendMessage(chatId, {
      text: '💍 Por favor, debes mencionar a un usuario. Usa: `!casemonos @usuario`.'
    }, { quoted: msg });
    return;
  }

  const proposerJid = msg.key.participant || msg.key.remoteJid;
  const mentionedJid = mentionedJids[0];

  // Verificar infidelidad
  if (matrimonios[proposerJid]?.marriedTo) {
    const parejaOficial = matrimonios[proposerJid].marriedTo;
    await sock.sendMessage(chatId, {
      text: `⚠️ ¡Infiel detectado!\n@${proposerJid.split('@')[0]} ya está casado con @${parejaOficial.split('@')[0]}.\nIntentó casarse con @${mentionedJid.split('@')[0]} 😡💔`,
      mentions: [proposerJid, parejaOficial, mentionedJid]
    }, { quoted: msg });
    return;
  }

  // Guardar propuesta
  matrimonios[proposerJid] = matrimonios[proposerJid] || {};
  matrimonios[mentionedJid] = matrimonios[mentionedJid] || {};

  matrimonios[proposerJid].proposalTo = mentionedJid;
  matrimonios[mentionedJid].proposalFrom = proposerJid;

  saveMatrimonios();

  await sock.sendMessage(chatId, {
    text: `💍 ¡@${mentionedJid.split('@')[0]}, ${msg.pushName} quiere casarse contigo!\n\nResponde con *!aceptar* o *!rechazar* para decidir su destino.`,
    mentions: [mentionedJid]
  }, { quoted: msg });
};

/**
 * Aceptar propuesta de matrimonio
 */
export const acceptMarriage = async (sock, msg) => {
  const chatId = msg.key.remoteJid;
  const accepterId = msg.key.participant || msg.key.remoteJid;

  if (!matrimonios[accepterId]?.proposalFrom) {
    await sock.sendMessage(chatId, {
      text: '💍 No tienes ninguna propuesta pendiente de matrimonio.'
    }, { quoted: msg });
    return;
  }

  const proposerId = matrimonios[accepterId].proposalFrom;

  matrimonios[proposerId].marriedTo = accepterId;
  matrimonios[accepterId].marriedTo = proposerId;

  matrimonios[proposerId].proposalTo = null;
  matrimonios[accepterId].proposalFrom = null;

  saveMatrimonios();

  await sock.sendMessage(chatId, {
    text: `🎉 ¡Felicidades! 💞 @${proposerId.split('@')[0]} y @${accepterId.split('@')[0]} ahora están casados para siempre... o hasta el próximo divorcio. 💍🎊`,
    mentions: [proposerId, accepterId]
  }, { quoted: msg });
};

/**
 * Rechazar propuesta de matrimonio
 */
export const rejectMarriage = async (sock, msg) => {
  const chatId = msg.key.remoteJid;
  const rejecterId = msg.key.participant || msg.key.remoteJid;

  if (!matrimonios[rejecterId]?.proposalFrom) {
    await sock.sendMessage(chatId, {
      text: '💍 No tienes ninguna propuesta pendiente que rechazar. ¿Será que nadie te quiere? 🫢'
    }, { quoted: msg });
    return;
  }

  const proposerId = matrimonios[rejecterId].proposalFrom;

  matrimonios[rejecterId].proposalFrom = null;
  matrimonios[proposerId].proposalTo = null;

  saveMatrimonios();

  await sock.sendMessage(chatId, {
    text: `💔 @${rejecterId.split('@')[0]} acaba de destrozar el corazón de @${proposerId.split('@')[0]}.\n\n😢 *¡Rechazado!* A buscar a otro o a otra.`,
    mentions: [rejecterId, proposerId]
  }, { quoted: msg });
};

/**
 * Divorcio
 */
export const divorceMarriage = async (sock, msg) => {
  const chatId = msg.key.remoteJid;
  const requesterId = msg.key.participant || msg.key.remoteJid;

  if (!matrimonios[requesterId]?.marriedTo) {
    await sock.sendMessage(chatId, {
      text: '💔 No estás casado con nadie... Ni modo, soltería obligada 🤷‍♂️.'
    }, { quoted: msg });
    return;
  }

  const exPartnerId = matrimonios[requesterId].marriedTo;

  matrimonios[requesterId].marriedTo = null;
  matrimonios[exPartnerId].marriedTo = null;

  saveMatrimonios();

  await sock.sendMessage(chatId, {
    text: `💔 @${requesterId.split('@')[0]} ha firmado el divorcio con @${exPartnerId.split('@')[0]}.\n\n😢 Ahora ambos vuelven a ser solteros. ¡El mercado está abierto otra vez!`,
    mentions: [requesterId, exPartnerId]
  }, { quoted: msg });
};

/**
 * Consultar estado de pareja o mostrar lista de parejas
 */
export const checkRelationship = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;

  const query = args[0]?.toLowerCase();

  if (query === 'lista' || query === 'top' || query === 'parejas') {
    // Mostrar hasta 10 parejas únicas
    const parejasUnicas = new Set();
    const parejas = [];

    for (const [user, data] of Object.entries(matrimonios)) {
      if (data.marriedTo) {
        const pareja = [user, data.marriedTo].sort().join('-');
        if (!parejasUnicas.has(pareja)) {
          parejasUnicas.add(pareja);
          parejas.push({ p1: user, p2: data.marriedTo });
        }
      }
    }

    if (parejas.length === 0) {
      await sock.sendMessage(chatId, {
        text: '😢 No hay parejas registradas. ¡Anímense a casarse!\nUsa `!casarme @usuario` para encontrar el amor.'
      }, { quoted: msg });
      return;
    }

    const top10 = parejas.slice(0, 10)
      .map((p, i) => `#${i + 1} 💍 @${p.p1.split('@')[0]} ❤️ @${p.p2.split('@')[0]}`)
      .join('\n');

    await sock.sendMessage(chatId, {
      text: `🌹 *Top de Parejas del Grupo* 🌹\n\n${top10}`,
      mentions: parejas.flatMap(p => [p.p1, p.p2])
    }, { quoted: msg });

    return;
  }

  // Estado personal
  const registro = matrimonios[userId] || {};
  let text = '';

  if (registro.marriedTo) {
    text = `💞 @${userId.split('@')[0]}, estás felizmente casado(a) con @${registro.marriedTo.split('@')[0]}.\n💍 ¡Que viva el amor!`;
  } else if (registro.proposalTo) {
    text = `💌 @${userId.split('@')[0]}, tienes una propuesta pendiente para @${registro.proposalTo.split('@')[0]}.\n💍 Esperando respuesta...`;
  } else if (registro.proposalFrom) {
    text = `💌 @${userId.split('@')[0]}, tienes una propuesta de matrimonio de @${registro.proposalFrom.split('@')[0]}.\nResponde con *!aceptar* o *!rechazar*.`;
  } else {
    text = `😢 @${userId.split('@')[0]}, estás soltero(a)... ¡pero el mundo es grande!\n💘 Usa *!casarme @usuario* para encontrar tu media naranja.`;
  }

  await sock.sendMessage(chatId, {
    text,
    mentions: [
      userId,
      registro.marriedTo,
      registro.proposalTo,
      registro.proposalFrom
    ].filter(Boolean)
  }, { quoted: msg });
};
