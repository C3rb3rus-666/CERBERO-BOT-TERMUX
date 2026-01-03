import { maybeSaqueoMaestro } from '../gameFIle.js';

const cooldown = 900000; // 15 minutos

const handler = async (sock, message) => {
  const user = global.db.data.users[message.sender];

  // Inicializar lastadventure
  if (!user.lastadventure) user.lastadventure = 0;

  if (new Date - user.lastadventure < cooldown) {
    const remaining = msToTime(cooldown - (new Date - user.lastadventure));
    return await sendImageWithCaption(sock, message, `❌ *Estás en una aventura, espera ${remaining}*\n\n💡 *Mientras tanto puedes usar !minar*`, { prefer: ['menu','ping'] });
  }

  // Lugares de aventura
  const lugares = [
    'Bosque Oscuro', 'Montaña Helada', 'Cueva de Dragones', 'Castillo Abandonado',
    'Pantano Venenoso', 'Desierto Infinito', 'Volcán Activo', 'Ruinas Antiguas'
  ];

  const lugar = lugares[Math.floor(Math.random() * lugares.length)];

  // Probabilidades
  const exito = Math.random() < 0.7; // 70% de éxito
  const recompensa = exito ? {
    exp: pickRandom([200, 300, 400, 500, 600]),
    money: pickRandom([100, 200, 300, 400, 500]),
    limit: pickRandom([1, 2, 3, 4, 5])
  } : {
    exp: pickRandom([50, 100, 150]),
    money: -pickRandom([50, 100, 150]), // Pérdida
    limit: 0
  };

  // Aplicar cambios
  user.lastadventure = new Date * 1;
  user.exp += recompensa.exp;
  user.money += recompensa.money;
  if (recompensa.limit > 0) user.limit += recompensa.limit;

  const texto = exito ?
    `╔═══《 *AVENTURA EXITOSA* 》═══╗
║ 📍 *Lugar:* ${lugar}
║ ✅ *Resultado:* ¡Éxito!
║ 💰 *Dinero ganado:* ${recompensa.money}
║ 💎 *Diamantes:* ${recompensa.limit}
║ ⚡ *EXP:* ${recompensa.exp}
╚══════════════════════════════╝

🔥 *¡Regresaste victorioso!*` :
    `╔═══《 *AVENTURA FALLIDA* 》═══╗
║ 📍 *Lugar:* ${lugar}
║ ❌ *Resultado:* Fallaste...
║ 💸 *Dinero perdido:* ${Math.abs(recompensa.money)}
║ ⚡ *EXP ganado:* ${recompensa.exp}
╚══════════════════════════════╝

😔 *Regresaste herido pero con algo de experiencia*`;

  await sendImageWithCaption(sock, message, texto, { prefer: ['menu','ping'] });

  // Verificar penalización global del Jefe Maestro
  await maybeSaqueoMaestro(sock, message);
};

handler.help = ['aventura', 'adventure'];
handler.tags = ['rpg'];
handler.command = ['aventura', 'adventure'];
export default handler;

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function msToTime(duration) {
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const seconds = Math.floor((duration / 1000) % 60);
  return `${minutes}m ${seconds}s`;
}