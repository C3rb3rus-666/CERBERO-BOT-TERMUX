import { sendImageWithCaption } from '../gameFIle.js';

const handler = async (sock, message) => {
  let who;
  if (message.key.remoteJid.endsWith('@g.us')) who = message.mentionedJid[0] ? message.mentionedJid[0] : message.sender;
  else who = message.sender;
  const name = sock.getName(who);

  // Inicializar datos si no existen
  if (!global.db.data.users[who]) global.db.data.users[who] = {};
  if (typeof global.db.data.users[who].limit !== 'number') global.db.data.users[who].limit = 10;
  if (typeof global.db.data.users[who].money !== 'number') global.db.data.users[who].money = 100;
  if (typeof global.db.data.users[who].exp !== 'number') global.db.data.users[who].exp = 0;
  if (typeof global.db.data.users[who].level !== 'number') global.db.data.users[who].level = 1;

  const caption = `
╔═══《 *CARTERA DE CERBERO* 》═══╗
║ 👤 *Usuario:* ${name}
║ 💎 *Diamantes:* ${global.db.data.users[who].limit}
║ 💰 *Dinero:* ${global.db.data.users[who].money}
║ ⚡ *EXP:* ${global.db.data.users[who].exp}
║ 🏆 *Nivel:* ${global.db.data.users[who].level}
╚══════════════════════════════╝

🔥 *Comandos para ganar más:*
❏ *!trabajar* - Gana dinero diario
❏ *!minar* - Mina diamantes
❏ *!aventura* - Embárcate en aventuras
❏ *!tienda* - Compra items útiles
❏ *!robar* - Intenta robar a otros (riesgoso)
❏ *!lideres* - Ver ranking global
`;
  await sendImageWithCaption(sock, message, caption);
};

handler.help = ['cartera', 'bolsillo'];
handler.tags = ['rpg'];
handler.command = ['cartera', 'bolsillo', 'balance', 'bal'];
export default handler;