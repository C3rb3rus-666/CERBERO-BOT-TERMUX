const MODES = new Set(['qr', 'nsfw', 'spam', 'mixto', 'all']);

function usage() {
  return [
    '🧪 Bateria de defensa en tiempo real',
    '',
    'Uso:',
    '  !bateria qr',
    '  !bateria nsfw',
    '  !bateria spam',
    '  !bateria mixto',
    '  !bateria all',
    '',
    'Objetivo: validar anti-QR, anti-NSFW y anti-spam por separado y en conjunto.',
  ].join('\n');
}

function sectionQR() {
  return [
    '1) MODULO QR',
    '- Enviar 3 imagenes con QR valido en 10s desde un usuario no admin.',
    '- Esperado: borrado inmediato + sancion segun politica de qrkill.',
    '- Esperado: NSFW y anti-spam siguen activos en paralelo (sin bloqueo mutuo).',
    '- PASS: al menos 1 accion de bloqueo QR por imagen maliciosa.',
  ].join('\n');
}

function sectionNSFW() {
  return [
    '2) MODULO NSFW',
    '- Enviar 3 imagenes NSFW reales y 3 imagenes seguras.',
    '- Esperado NSFW: elimina y aplica sancion en amenazas.',
    '- Esperado SAFE: no responder por cada imagen, solo resumen en lote.',
    '- PASS: amenazas bloqueadas y sin spam de avisos SAFE.',
  ].join('\n');
}

function sectionSpam() {
  return [
    '3) MODULO ANTI-SPAM IMG',
    '- Enviar 4+ imagenes consecutivas en menos de 3s sin texto.',
    '- Esperado: accion anti-spam (cerrado/expulsion) segun regla.',
    '- Esperado: QR/NSFW no quedan deshabilitados por esta accion.',
    '- PASS: anti-spam actua y los otros motores siguen procesando.',
  ].join('\n');
}

function sectionMixed() {
  return [
    '4) ESCENARIO MIXTO',
    '- Rfaga de imagenes con QR + NSFW + seguras desde 2 usuarios.',
    '- Esperado: ejecucion paralela sin short-circuit entre modulos.',
    '- Esperado: sin caida del bot y con bloqueos efectivos.',
    '- PASS: se observan acciones de mas de un modulo en la misma ventana.',
  ].join('\n');
}

export async function runBateriaDefensa(sock, message, args = []) {
  const chatId = message.key.remoteJid;
  const mode = String(args?.[0] || 'all').toLowerCase();

  if (!MODES.has(mode)) {
    await sock.sendMessage(chatId, { text: usage() }, { quoted: message });
    return;
  }

  const blocks = ['🛡️ CERBERO SECURITY TEST BATTERY'];

  if (mode === 'qr' || mode === 'all') blocks.push(sectionQR());
  if (mode === 'nsfw' || mode === 'all') blocks.push(sectionNSFW());
  if (mode === 'spam' || mode === 'all') blocks.push(sectionSpam());
  if (mode === 'mixto' || mode === 'all') blocks.push(sectionMixed());

  blocks.push('Comando exclusivo de auditoria del creador.');

  await sock.sendMessage(chatId, { text: blocks.join('\n\n') }, { quoted: message });
}
