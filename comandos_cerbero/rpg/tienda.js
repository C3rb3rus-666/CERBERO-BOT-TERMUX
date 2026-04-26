import { maybeSaqueoMaestro, sendImageWithCaption, parseAmount } from '../gameFIle.js';

const precios = {
  diamante: { precio: 350, tipo: 'exp', emoji: '💎' },
  dinero: { precio: 500, tipo: 'limit', emoji: '💰' },
  exp: { precio: 1000, tipo: 'money', emoji: '⚡' }
};

const handler = async (sock, message) => {
  const args = message.text.split(' ').slice(1);
  const user = global.db.data.users[message.sender];

  if (!args[0]) {
    const caption = `
╔═══《 *TIENDA DE CERBERO* 》═══╗
║ 💎 *Diamante* - 350 EXP
║ 💰 *Dinero* - 500 Diamantes  
║ ⚡ *EXP* - 1000 Dinero
╚══════════════════════════════╝

🔥 *Uso:* .tienda <item> <cantidad>
💡 *Ejemplo:* .tienda diamante 5
`;
    return await sendImageWithCaption(sock, message, caption, { prefer: ['menu','ping'] });
  }

  const item = args[0].toLowerCase();
  let cantidad = args[1] ? parseAmount(args[1]) : 1;
  cantidad = Math.max(1, cantidad);

  if (!precios[item]) {
    return await sendImageWithCaption(sock, message, `❌ *Item no encontrado.* Items disponibles: ${Object.keys(precios).join(', ')}`, { prefer: ['menu','ping'] });
  }

  const precioItem = precios[item];
  const costoTotal = precioItem.precio * cantidad;

  if (user[precioItem.tipo] < costoTotal) {
    return await sendImageWithCaption(sock, message, `❌ *No tienes suficiente ${precioItem.emoji}*\n💡 *Necesitas:* ${costoTotal} ${precioItem.emoji}`, { prefer: ['menu','ping'] });
  }

  // Aplicar compra
  user[precioItem.tipo] -= costoTotal;
  user[item] += cantidad;

  const caption = `
╔═══《 *COMPRA EXITOSA* 》═══╗
║ 🛒 *Item:* ${item} ${precioItem.emoji}
║ 📦 *Cantidad:* ${cantidad}
║ 💸 *Pagaste:* ${costoTotal} ${precioItem.emoji}
║ ✅ *Recibiste:* ${cantidad} ${precioItem.emoji}
╚══════════════════════════════╝

🔥 *¡Compra realizada con éxito!*
`;
  await sendImageWithCaption(sock, message, caption, { prefer: ['menu','ping'] });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['tienda', 'shop'];
handler.tags = ['rpg'];
handler.command = ['tienda', 'shop', 'comprar'];
export default handler;