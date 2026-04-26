import { maybeSaqueoMaestro, sendImageWithCaption, parseAmount } from '../gameFIle.js';

const items = ['money', 'limit'];

const handler = async (sock, message) => {
  const args = message.text.split(' ').slice(1);
  const user = global.db.data.users[message.sender];

  if (!args[0] || !args[1]) {
    const caption = `
╔═══《 *TRANSFERENCIA* 》═══╗
║ 💰 *Tipos:* money, limit
║ 📝 *Uso:* .transferir <tipo> <cantidad> @usuario
║ 💡 *Ejemplo:* .transferir money 500 @usuario
╚══════════════════════════════╝
`;
    return await sendImageWithCaption(sock, message, caption);
  }

  const tipo = args[0].toLowerCase();
  const cantidad = parseAmount(args[1]);
  let who = message.mentionedJid[0];

  if (!items.includes(tipo)) {
    return await sendImageWithCaption(sock, message, `❌ *Tipo inválido.* Tipos disponibles: ${items.join(', ')}`);
  }

  if (isNaN(cantidad) || cantidad <= 0) {
    return await sendImageWithCaption(sock, message, `❌ *Cantidad inválida.*`);
  }

  if (!who) {
    return await sendImageWithCaption(sock, message, `❌ *Menciona al usuario destinatario.*`);
  }

  if (!(who in global.db.data.users)) {
    return await sendImageWithCaption(sock, message, `❌ *Usuario no encontrado.*`);
  }

  if (user[tipo] < cantidad) {
    return await sendImageWithCaption(sock, message, `❌ *No tienes suficiente ${tipo === 'money' ? '💰 dinero' : '💎 diamantes'}*`);
  }

  const destinatario = global.db.data.users[who];

  // Aplicar transferencia
  user[tipo] -= cantidad;
  destinatario[tipo] += cantidad;

  const caption = `
╔═══《 *TRANSFERENCIA EXITOSA* 》═══╗
║ 👤 *De:* @${message.sender.split('@')[0]}
║ 👤 *Para:* @${who.split('@')[0]}
║ 📦 *Tipo:* ${tipo === 'money' ? '💰 Dinero' : '💎 Diamantes'}
║ 💸 *Cantidad:* ${cantidad}
╚══════════════════════════════╝

🔥 *¡Transferencia completada!*
`;
  await sendImageWithCaption(sock, message, caption, { mentions: [message.sender, who], prefer: ['menu','ping'] });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['transferir', 'transfer'];
handler.tags = ['rpg'];
handler.command = ['transferir', 'transfer', 'dar'];
export default handler;