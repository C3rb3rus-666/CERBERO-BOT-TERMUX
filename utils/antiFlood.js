/**
 * ──────────────────────────────────────────────────────────────
 *  C3RB3RUS :: ANTI-FLOOD
 *  Solo detecta spam de COMANDOS (mensajes que empiezan con !)
 *  Los mensajes normales NUNCA se cuentan ni se bloquean.
 * ──────────────────────────────────────────────────────────────
 *  Ventana de tiempo : WINDOW_MS  (6 segundos)
 *  Umbral de comandos: CMD_LIMIT  (máx. comandos ! en la ventana)
 *  Tiempo de mute    : MUTE_MS    (cuánto tiempo se ignora al usuario)
 */

const WINDOW_MS = 6_000;  // ventana de análisis
const CMD_LIMIT = 5;       // más de 5 comandos ! en 6s = flood
const MUTE_MS   = 60_000; // mute de 60s tras detectar flood

// Mapa: `${chatId}::${senderJid}` → { cmdTs: [], mutedUntil: 0 }
const floodMap = new Map();

function getKey(chatId, senderJid) {
  return `${chatId}::${senderJid}`;
}

function getEntry(chatId, senderJid) {
  const key = getKey(chatId, senderJid);
  if (!floodMap.has(key)) {
    floodMap.set(key, { cmdTs: [], mutedUntil: 0 });
  }
  return floodMap.get(key);
}

// Limpiar entradas antiguas para no acumular memoria indefinidamente
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of floodMap.entries()) {
    if (
      entry.mutedUntil < now &&
      entry.cmdTs.every(t => now - t > WINDOW_MS)
    ) {
      floodMap.delete(key);
    }
  }
}, 60_000);

/**
 * Verifica si el mensaje es flood de comandos (!).
 * Los mensajes normales siempre retornan flood=false sin contar.
 *
 * @param {string}  chatId    - JID del chat
 * @param {string}  senderJid - JID del remitente
 * @param {boolean} isCommand - true si empieza con !
 * @returns {{ flood: boolean, muted: boolean, reason: string }}
 */
export function checkFlood(chatId, senderJid, isCommand) {
  const now   = Date.now();
  const entry = getEntry(chatId, senderJid);

  // ── Si ya está muteado, rechazar directamente ──────────────────────────────
  if (entry.mutedUntil > now) {
    return { flood: true, muted: true, reason: 'MUTED' };
  }

  // Mensajes normales (no comandos !) → NUNCA son flood, ignorar completamente
  if (!isCommand) {
    return { flood: false, muted: false, reason: '' };
  }

  // ── Limpiar timestamps fuera de la ventana ─────────────────────────────────
  entry.cmdTs = entry.cmdTs.filter(t => now - t < WINDOW_MS);

  // ── Registrar el comando ───────────────────────────────────────────────────
  entry.cmdTs.push(now);

  // ── Evaluar límite ─────────────────────────────────────────────────────────
  if (entry.cmdTs.length > CMD_LIMIT) {
    entry.mutedUntil = now + MUTE_MS;
    entry.cmdTs = [];
    return {
      flood: true,
      muted: false,
      reason: `CMD_FLOOD (${CMD_LIMIT + 1}+ comandos ! en ${WINDOW_MS / 1000}s)`,
    };
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
