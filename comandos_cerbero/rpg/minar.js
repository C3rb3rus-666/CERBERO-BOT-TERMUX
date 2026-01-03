import { maybeSaqueoMaestro } from '../gameFIle.js';

const cooldown = 600000; // 10 minutos

const handler = async (sock, message) => {
  const user = global.db.data.users[message.sender];

  // Inicializar lastmine
  if (!user.lastmine) user.lastmine = 0;

  if (new Date - user.lastmine < cooldown) {
    const remaining = msToTime(cooldown - (new Date - user.lastmine));
    return await sock.sendMessage(message.key.remoteJid, {
      text: `⛏️ *Ya minaste recientemente, espera ${remaining}*\n\n💡 *Mientras tanto usa !trabajar*`
    }, { quoted: message });
  }

  const exp = pickRandom([50, 100, 150, 200, 250]);
  const limit = pickRandom([1, 2, 3, 4, 5]);

  user.exp += exp;
  user.limit += limit;
  user.lastmine = new Date * 1;

  await sock.sendMessage(message.key.remoteJid, {
    text: `
╔═══《 *MINERÍA* 》═══╗
║ ⛏️ *Minerales extraídos*
║ 💎 *Diamantes:* ${limit}
║ ⚡ *EXP:* ${exp}
╚══════════════════════════════╝

🔥 *¡Buena excavación! Vuelve en 10 minutos*
`
  }, { quoted: message });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['minar', 'mine'];
handler.tags = ['rpg'];
handler.command = ['minar', 'mine', 'excavar'];
export default handler;

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function msToTime(duration) {
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const seconds = Math.floor((duration / 1000) % 60);
  return `${minutes}m ${seconds}s`;
}