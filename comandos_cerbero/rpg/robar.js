import { maybeSaqueoMaestro, sendImageWithCaption } from '../gameFIle.js';

const cooldown = 7200000; // 2 horas

const handler = async (sock, message) => {
  const user = global.db.data.users[message.sender];
  const CREADOR = "573233704652@s.whatsapp.net"; // Jefe Maestro
  const isCreator = message.sender === CREADOR;

  // Inicializar lastrob
  if (!user.lastrob) user.lastrob = 0;

  if (new Date - user.lastrob < cooldown) {
    const remaining = msToTime(cooldown - (new Date - user.lastrob));
    return await sendImageWithCaption(sock, message, `⏰ *Ya robaste recientemente, espera ${remaining}*\n\n💡 *Mientras tanto usa .trabajar*`);
  }

  let who;
  if (message.isGroup) {
    who = message.mentionedJid[0] || (message.quoted ? message.quoted.sender : false);
  } else {
    return await sendImageWithCaption(sock, message, `❌ *Este comando solo funciona en grupos*`);
  }

  if (!who) return await sendImageWithCaption(sock, message, `❌ *Menciona a alguien para robarle*\n💡 *Ejemplo:* .robar @usuario`);
  if (!(who in global.db.data.users)) return await sendImageWithCaption(sock, message, `❌ *Usuario no encontrado en la base de datos*`);

  const victim = global.db.data.users[who];

  // 🔥 CASTIGO DEL JEFE MAESTRO si intentas robar al creador
  if (who === CREADOR && !isCreator) {
    user.money = 0;
    user.limit = 0;
    user.exp = 0;
    user.level = 1;

    const caption = `
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓ ░▒▒▓▓▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▒▒░ ▓
▓ ░▒▓ [💀] 𝐈𝐍𝐓𝐄𝐍𝐓𝐎 𝐃𝐄 𝐇𝐀𝐂𝐊𝐄𝐎 𝐀𝐋 𝐉𝐄𝐅𝐄 [💀] ▓▒░ ▓
▓ ▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒ ▓

▄︻デ══━💢 *¡CONTRAMEDIDA ACTIVADA!* 💢━══デ︻▄

@${message.sender.split('@')[0]} intentó robar al arquitecto del sistema...

╔════════════════════════════╗
  🔥 *𝐂𝐎𝐍𝐒𝐄𝐂𝐔𝐄𝐍𝐂𝐈𝐀𝐒* 🔥
  ▪ Todos tus fondos: ELIMINADOS
  ▪ Diamantes: CERO
  ▪ Nivel: RESETEADO A 1
  ▪ XP: CERO
╚════════════════════════════╝

*"No desafíes al que controla la matriz."*  
**- C3rb3rus-666**
`;
    return await sendImageWithCaption(sock, message, caption, { mentions: [message.sender] });
  }

  // 👁️ Si el CREADOR usa el comando: da recompensa al objetivo
  if (isCreator && who !== CREADOR) {
    const recompensa = 1000000; // 1 millón
    victim.money += recompensa;

    const caption = `
🎁 *ENCUENTRO CON EL JEFE MAESTRO* 🎁

@${who.split('@')[0]} ha sido bendecido por el Arquitecto del Sistema...

╔════════════════════════════╗
  💰 *𝐁𝐎𝐍𝐎 𝐃𝐄 𝐏𝐎𝐃𝐄𝐑 𝐎𝐁𝐒𝐂𝐔𝐑𝐎* 💰
  ▪ Recompensa: +${recompensa} monedas
  ▪ Fuente: C3rb3rus-666
╚════════════════════════════╝

*"El sistema te observa... y te recompensa."*
`;
    return await sendImageWithCaption(sock, message, caption, { mentions: [who] });
  }

  if (victim.money < 100) return await sendImageWithCaption(sock, message, `😔 *@${who.split('@')[0]}* no tiene suficiente dinero para robar`, { mentions: [who] });

  // Probabilidad de éxito: 60%
  const exito = Math.random() < 0.6;
  const cantidad = Math.floor(Math.random() * Math.min(victim.money, 500)) + 50;

  user.lastrob = new Date * 1;

  if (exito) {
    // Robo exitoso
    victim.money -= cantidad;
    user.money += cantidad;

    const caption = `
╔═══《 *ROBO EXITOSO* 》═══╗
║ 👤 *Víctima:* @${who.split('@')[0]}
║ 💰 *Robaste:* ${cantidad} monedas
║ ✅ *Resultado:* ¡Escapaste limpio!
╚══════════════════════════════╝

🔥 *¡Buen trabajo ladrón!*
`;
    await sendImageWithCaption(sock, message, caption, { mentions: [who] });
  } else {
    // Robo fallido - pierdes dinero
    const perdida = Math.floor(cantidad * 0.5);
    user.money = Math.max(0, user.money - perdida);

    const caption = `
╔═══《 *ROBO FALLIDO* 》═══╗
║ 👤 *Víctima:* @${who.split('@')[0]}
║ 💸 *Perdiste:* ${perdida} monedas
║ ❌ *Resultado:* ¡Te atraparon!
╚══════════════════════════════╝

😔 *Mejor suerte la próxima vez...*
`;
    await sendImageWithCaption(sock, message, caption, { mentions: [who] });
  }

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['robar', 'rob'];
handler.tags = ['rpg'];
handler.command = ['robar', 'rob'];
export default handler;

function msToTime(duration) {
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  return `${hours}h ${minutes}m`;
}