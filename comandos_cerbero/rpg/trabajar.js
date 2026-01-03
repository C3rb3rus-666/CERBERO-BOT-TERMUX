import { maybeSaqueoMaestro } from '../gameFIle.js';

const handler = async (sock, message) => {
  const user = global.db.data.users[message.sender];
  const premium = user.premium || false;

  // Inicializar lastclaim si no existe
  if (!user.lastclaim) user.lastclaim = 0;

  const time = user.lastclaim + 7200000; // 2 horas
  if (new Date - user.lastclaim < 7200000) {
    const remaining = msToTime(time - new Date());
    return await sock.sendMessage(message.key.remoteJid, {
      text: `❌ *Ya trabajaste hoy, vuelve en ${remaining}*\n\n💡 *Consejo:* Usa !aventura para ganar más rápido`
    }, { quoted: message });
  }

  // Recompensas
  const exp = premium ? pickRandom([1000, 1500, 1800, 2100, 2500]) : pickRandom([500, 600, 700, 800, 900, 1000]);
  const money = premium ? pickRandom([800, 1300, 1600, 1900, 2200]) : pickRandom([300, 500, 700, 900, 1100]);
  const limit = premium ? pickRandom([5, 8, 10, 12, 15]) : pickRandom([2, 3, 4, 5, 6]);

  // Aplicar recompensas
  user.exp += exp;
  user.money += money;
  user.limit += limit;
  user.lastclaim = new Date * 1;

  const texto = `
╔═══《 *TRABAJO DIARIO* 》═══╗
║ 👤 *Trabajador:* ${sock.getName(message.sender)}
║ 💰 *Dinero ganado:* ${money}
║ 💎 *Diamantes:* ${limit}
║ ⚡ *EXP:* ${exp}
║ 🏆 *Premium:* ${premium ? '✅' : '❌'}
╚══════════════════════════════╝

🔥 *¡Buen trabajo! Vuelve en 2 horas*
💡 *Tips para ganar más:*
• !aventura - Riesgosas pero lucrativas
• !minar - Diamantes seguros
• !robar - Alto riesgo, alta recompensa
`;

  await sock.sendMessage(message.key.remoteJid, { text: texto }, { quoted: message });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['trabajar', 'daily'];
handler.tags = ['rpg'];
handler.command = ['trabajar', 'daily', 'reclamar', 'claim'];
export default handler;

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function msToTime(duration) {
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  return `${hours}h ${minutes}m`;
}