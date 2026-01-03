import { maybeSaqueoMaestro } from '../gameFIle.js';

const handler = async (sock, message) => {
  const args = message.text.split(' ').slice(1);
  const users = Object.entries(global.db.data.users)
    .map(([key, value]) => ({
      ...value,
      jid: key,
      exp: Number(value.exp) || 0,
      money: Number(value.money) || 0,
      limit: Number(value.limit) || 0,
      level: Number(value.level) || 0
    }))
    .filter(user => user.jid && user.jid.endsWith("@s.whatsapp.net"));

  const sortedExp = [...users].sort((a, b) => b.exp - a.exp);
  const sortedMoney = [...users].sort((a, b) => b.money - a.money);
  const sortedLimit = [...users].sort((a, b) => b.limit - a.limit);

  const len = Math.min(args[0] && !isNaN(args[0]) ? Math.max(parseInt(args[0]), 10) : 10, 50);

  const getText = (list, prop, emoji, name) =>
    list.slice(0, len)
      .map(({ jid }, i) => {
        const user = list[i];
        const phone = jid?.split('@')[0] || 'Desconocido';
        return `□ ${i + 1}. @${phone}\n□ ${user[prop]} ${emoji}`;
      })
      .join('\n\n');

  const userRankExp = sortedExp.findIndex(u => u.jid === message.sender) + 1;
  const userRankMoney = sortedMoney.findIndex(u => u.jid === message.sender) + 1;
  const userRankLimit = sortedLimit.findIndex(u => u.jid === message.sender) + 1;

  const body = `
╔═══《 *LEADERBOARD CERBERO* 》═══╗
║ 🏆 *TOP ${len} JUGADORES*
╚══════════════════════════════╝

🔥 *TU POSICIÓN:*
• EXP: #${userRankExp}
• Dinero: #${userRankMoney}
• Diamantes: #${userRankLimit}

⚡ *TOP EXP:*
${getText(sortedExp, 'exp', '⚡', 'EXP')}

💰 *TOP DINERO:*
${getText(sortedMoney, 'money', '💰', 'Dinero')}

💎 *TOP DIAMANTES:*
${getText(sortedLimit, 'limit', '💎', 'Diamantes')}
`.trim();

  await sock.sendMessage(message.key.remoteJid, {
    text: body,
    mentions: body.match(/@\d+/g)?.map(m => m + '@s.whatsapp.net') || []
  });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['lideres', 'leaderboard'];
handler.tags = ['rpg'];
handler.command = ['lideres', 'leaderboard', 'lb', 'ranking'];
export default handler;