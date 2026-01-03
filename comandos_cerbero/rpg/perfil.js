import { maybeSaqueoMaestro } from '../gameFIle.js';

const handler = async (sock, message) => {
  let who;
  if (message.isGroup) who = message.mentionedJid[0] ? message.mentionedJid[0] : message.sender;
  else who = message.sender;

  const user = global.db.data.users[who];
  const name = who.split('@')[0]; // Usar el número como nombre

  // Inicializar datos si no existen
  if (!user) global.db.data.users[who] = {};
  if (typeof user.exp !== 'number') user.exp = 0;
  if (typeof user.money !== 'number') user.money = 100;
  if (typeof user.limit !== 'number') user.limit = 10;
  if (typeof user.level !== 'number') user.level = 1;
  if (!user.registered) user.registered = false;

  // Calcular nivel basado en EXP
  const level = Math.floor(user.exp / 1000) + 1;
  user.level = level;

  // Estadísticas
  const totalUsers = Object.keys(global.db.data.users).length;
  const rank = Object.values(global.db.data.users)
    .sort((a, b) => (b.exp || 0) - (a.exp || 0))
    .findIndex(u => u === user) + 1;

  const texto = `
╔═══《 *PERFIL DE CERBERO* 》═══╗
║ 👤 *Nombre:* ${name}
║ 🆔 *Número:* ${who.split('@')[0]}
║ 📊 *Ranking:* #${rank} de ${totalUsers}
║ 🏆 *Nivel:* ${level}
║ ⚡ *EXP:* ${user.exp}
║ 💰 *Dinero:* ${user.money}
║ 💎 *Diamantes:* ${user.limit}
║ ✅ *Registrado:* ${user.registered ? 'Sí' : 'No'}
║ 🏅 *Premium:* ${user.premium ? 'Sí' : 'No'}
╚══════════════════════════════╝

🔥 *Estadísticas del Jugador*
💡 *Sigue ganando EXP para subir de nivel!*
`;

  await sock.sendMessage(message.key.remoteJid, { text: texto });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['perfil', 'profile'];
handler.tags = ['rpg'];
handler.command = ['perfil', 'profile', 'stats'];
export default handler;