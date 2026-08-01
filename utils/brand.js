// utils/brand.js
// ─────────────────────────────────────────────────────────────────────────────
// 📱 IDENTIDAD CERBERO-BOT-TERMUX TERMUX ARM64
// ─────────────────────────────────────────────────────────────────────────────
// Módulo central de branding. Todos los comandos importan desde aquí.
// Al ser el proyecto EXCLUSIVO de Termux/AArch64, el branding es siempre TERMUX.
// ─────────────────────────────────────────────────────────────────────────────

/** ¿Estamos en Termux? Siempre true en este proyecto, o detección por env var */
export const IS_TERMUX = true;

/**
 * Tag corto del bot que aparece al inicio de cada aviso.
 * Formato bold para WhatsApp.
 */
export const BOT_TAG = '*[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓 𝐓𝐄𝐑𝐌𝐔𝐗 📱]*';

/** Versión y build del bot */
export const BOT_VERSION = 'v4.6.0-TERMUX · Build 123';

/** Footer de firma — aparece al final de cada notificación importante */
export const BRAND_FOOTER = '✦ CERBERO-BOT-TERMUX TERMUX ARM64 · AArch64 · by C3rb3rus-666 ✦';

/** Línea de contacto del creador */
export const BRAND_CONTACT = '_¿Quieres un bot como este? 📱 +573233704652 · ✈️ @C3rb3rus_666_';

/** Separador visual estándar */
export const SEP = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

/**
 * Genera un bloque de encabezado de notificación listo para WhatsApp.
 * @param {string} emoji  Emoji del tipo de aviso, ej: '🚨', '✅', '🌙'
 * @param {string} titulo Título del proceso, ej: 'ANTILINK', 'BIENVENIDA'
 */
export function makeHeader(emoji, titulo) {
  return (
    `╔══════════════════════════╗\n` +
    `║ ${emoji}  ${BOT_TAG} ${emoji}\n` +
    `║ 📱 ARM64 · ${titulo}\n` +
    `╚══════════════════════════╝`
  );
}
