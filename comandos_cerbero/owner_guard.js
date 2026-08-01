const OWNER_PRIMARY_ID = '573233704652';
const OWNER_ALIAS_IDS = new Set([
  OWNER_PRIMARY_ID,
  process.env.CERBERO_OWNER_LID || '64279084535828',
]);

function normalizeIdentifier(raw) {
  if (!raw) return '';
  const base = String(raw).split('@')[0].split(':')[0].trim();
  const digits = base.replace(/\D/g, '');
  return digits || base.toLowerCase();
}

function candidateSenderIds(message, sock = null) {
  const ids = new Set();
  const participant = message?.key?.participant;
  const remoteJid = message?.key?.remoteJid;
  const botJid = sock?.user?.id;

  if (participant) ids.add(normalizeIdentifier(participant));
  if (remoteJid && !remoteJid.endsWith('@g.us')) ids.add(normalizeIdentifier(remoteJid));
  if (message?.sender) ids.add(normalizeIdentifier(message.sender));
  if (botJid && message?.key?.fromMe) ids.add(normalizeIdentifier(botJid));

  return [...ids].filter(Boolean);
}

export function isOwnerMessage(message, sock = null) {
  const candidates = candidateSenderIds(message, sock);
  return candidates.some((id) => OWNER_ALIAS_IDS.has(id));
}

export async function denyIfNotOwner(sock, message) {
  const allowed = isOwnerMessage(message, sock);
  if (allowed) return false;

  await sock.sendMessage(
    message.key.remoteJid,
    { text: '[CERBERO-BOT] Comando exclusivo para C3rb3rus-666 (+573233704652).' },
    { quoted: message }
  );
  return true;
}

export function getOwnerPrimaryId() {
  return OWNER_PRIMARY_ID;
}
