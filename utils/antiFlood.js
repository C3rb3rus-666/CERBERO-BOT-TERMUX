/**
 * ──────────────────────────────────────────────────────────────
 *  C3RB3RUS :: ANTI-FLOOD
 *  Detecta y silencia a usuarios que spamean comandos o mensajes
 *  antes de que lleguen al procesador de comandos.
 * ──────────────────────────────────────────────────────────────
 *
 *  Ventana de tiempo : WINDOW_MS   (por defecto 8 segundos)
 *  Umbral de comandos: CMD_LIMIT   (máx. comandos en la ventana)
 *  Umbral de mensajes: MSG_LIMIT   (máx. mensajes en la ventana)
 *  Tiempo de mute    : MUTE_MS     (cuánto tiempo se ignora al usuario)
 *
 *  Retorna true  → mensaje es FLOOD, debe ignorarse / bloquearse
 *  Retorna false → mensaje es legítimo, procesar normalmente
 */

const WINDOW_MS  = 6_000;   // ventana de análisis (6 segundos)
const CMD_LIMIT  = 3;        // máx. comandos permitidos en la ventana (4to = flood)
const MSG_LIMIT  = 8;        // máx. mensajes permitidos en la ventana (9no = flood)
const MUTE_MS    = 60_000;   // tiempo de silencio tras detectar flood (1 minuto)

// Mapa: `${chatId}::${senderJid}` → { cmdTs: [], msgTs: [], mutedUntil: 0 }
const floodMap = new Map();

function getKey(chatId, senderJid) {
  return `${chatId}::${senderJid}`;
}

function getEntry(chatId, senderJid) {
  const key = getKey(chatId, senderJid);
  if (!floodMap.has(key)) {
    floodMap.set(key, { cmdTs: [], msgTs: [], mutedUntil: 0 });
  }
  return floodMap.get(key);
}

// Limpiar entradas antiguas para no acumular memoria indefinidamente
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of floodMap.entries()) {
    if (
      entry.mutedUntil < now &&
      entry.cmdTs.every(t => now - t > WINDOW_MS) &&
      entry.msgTs.every(t => now - t > WINDOW_MS)
    ) {
      floodMap.delete(key);
    }
  }
}, 60_000);

/**
 * Verifica si el mensaje es flood.
 *
 * @param {string}  chatId      - JID del chat (@g.us o número@s.whatsapp.net)
 * @param {string}  senderJid   - JID del remitente
 * @param {boolean} isCommand   - true si el mensaje es un comando (empieza por !)
 * @returns {{ flood: boolean, muted: boolean, reason: string }}
 */
export function checkFlood(chatId, senderJid, isCommand) {
  const now   = Date.now();
  const entry = getEntry(chatId, senderJid);

  // ── Si ya está muteado, rechazar directamente ──────────────────────────────
  if (entry.mutedUntil > now) {
    return { flood: true, muted: true, reason: 'MUTED' };
  }

  // ── Limpiar timestamps fuera de la ventana ─────────────────────────────────
  entry.cmdTs = entry.cmdTs.filter(t => now - t < WINDOW_MS);
  entry.msgTs = entry.msgTs.filter(t => now - t < WINDOW_MS);

  // ── Registrar timestamp actual ─────────────────────────────────────────────
  if (isCommand) {
    entry.cmdTs.push(now);
  } else {
    entry.msgTs.push(now);
  }

  // ── Evaluar límites ────────────────────────────────────────────────────────
  const cmdFlood = entry.cmdTs.length > CMD_LIMIT;
  const msgFlood = entry.msgTs.length > MSG_LIMIT;

  if (cmdFlood || msgFlood) {
    entry.mutedUntil = now + MUTE_MS;
    entry.cmdTs = [];
    entry.msgTs = [];
    const reason = cmdFlood ? `CMD_FLOOD (${CMD_LIMIT + 1}+ cmds en ${WINDOW_MS / 1000}s)` :
                              `MSG_FLOOD (${MSG_LIMIT + 1}+ msgs en ${WINDOW_MS / 1000}s)`;
    return { flood: true, muted: false, reason };
  }

  return { flood: false, muted: false, reason: '' };
}

/**
 * Devuelve cuántos milisegundos le quedan al usuario muteado.
 */
export function mutedTimeLeft(chatId, senderJid) {
  const entry = getEntry(chatId, senderJid);
  const remaining = entry.mutedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Levanta el mute manualmente (útil para admins).
 */
export function clearFlood(chatId, senderJid) {
  const key = getKey(chatId, senderJid);
  floodMap.delete(key);
}
