import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRandomMenuImagePath } from './art.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(process.cwd());
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const GROUP_CONFIG_DIR = path.join(__dirname, 'configuraciones');
const STATUS_TAG_CONFIG = path.join(ROOT, 'config', 'anti_status_tag.json');

const CONFIGS = {
  antilink: path.join(GROUP_CONFIG_DIR, 'antilink_config.json'),
  bienvenida: path.join(GROUP_CONFIG_DIR, 'grupo_ajustado.json'),
  vigilar: path.join(GROUP_CONFIG_DIR, 'monitor_admin_config.json'),
  autonomo: path.join(GROUP_CONFIG_DIR, 'admin_autonomo_config.json'),
  presentaciones: path.join(ROOT, 'comandos_cerbero', 'presentaciones_config.json'),
  tinder: path.join(ROOT, 'comandos_cerbero', 'tinder_config.json'),
  confesiones: path.join(ROOT, 'comandos_cerbero', 'confesiones_config.json'),
  antistatustag: STATUS_TAG_CONFIG,
  aegis: path.join(GROUP_CONFIG_DIR, 'antinumbers_config.json'),
};

function loadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function loadPackageMeta() {
  const pkg = loadJson(PACKAGE_PATH, {});
  return {
    version: pkg.version || 'desconocida',
    build: pkg.build || 'desconocido',
  };
}

function loadGroupFlag(file, groupId) {
  const cfg = loadJson(file, {});
  if (cfg?.enabled_groups && typeof cfg.enabled_groups === 'object') {
    const entry = cfg.enabled_groups[groupId];
    if (typeof entry === 'boolean') return entry;
    if (entry && typeof entry === 'object') return !!entry.activo;
  }
  if (groupId && Object.prototype.hasOwnProperty.call(cfg, groupId)) {
    const value = cfg[groupId];
    if (typeof value === 'boolean') return value;
    if (value && typeof value === 'object') return !!value.activo;
  }
  return false;
}

function formatState(enabled) {
  return enabled ? '🟢 ACTIVO' : '🔴 DESACTIVADO';
}

function formatGroupMeta(groupMetadata) {
  if (!groupMetadata) {
    return [
      '▸ Grupo   : No disponible',
      '▸ Estado  : N/A',
      '▸ Miembros: N/A',
    ];
  }

  const groupName = groupMetadata.subject || 'Grupo sin nombre';
  const isClosed = groupMetadata.announce === true;
  const participants = Array.isArray(groupMetadata.participants) ? groupMetadata.participants.length : 0;

  return [
    `▸ Grupo   : ${groupName}`,
    `▸ Estado  : ${isClosed ? '🔒 CERRADO' : '🔓 ABIERTO'}`,
    `▸ Miembros: ${participants}`,
  ];
}

function formatAegisStats() {
  const cfg = loadJson(CONFIGS.aegis, {});
  const black = Array.isArray(cfg.blacklist) ? cfg.blacklist.length : 0;
  const white = Array.isArray(cfg.whitelist) ? cfg.whitelist.length : 0;
  return `🟢 ACTIVO · 🚫${black} / ✅${white}`;
}

export function buildCerberoStatusLines({ chatId, groupMetadata }) {
  const { version, build } = loadPackageMeta();
  const groupId = chatId?.endsWith('@g.us') ? chatId : null;

  return [
    '╔══════════════════════════╗',
    '║      📡 CERBERO STATUS    ║',
    '╚══════════════════════════╝',
    `▸ Versión : v${version} · Build ${build}`,
    ...formatGroupMeta(groupMetadata),
    '',
    '🛡️ *ESTADO POR GRUPO*',
    `▪ Antilink           : ${groupId ? formatState(loadGroupFlag(CONFIGS.antilink, groupId)) : 'N/A'}`,
    `▪ Bienvenida         : ${groupId ? formatState(!!loadJson(CONFIGS.bienvenida, {})[groupId]?.welcome) : 'N/A'}`,
    `▪ Vigilar admins     : ${groupId ? formatState(loadGroupFlag(CONFIGS.vigilar, groupId)) : 'N/A'}`,
    `▪ Admin autónomo     : ${groupId ? formatState(loadGroupFlag(CONFIGS.autonomo, groupId)) : 'N/A'}`,
    `▪ Presentaciones     : ${groupId ? formatState(loadGroupFlag(CONFIGS.presentaciones, groupId)) : 'N/A'}`,
    `▪ Tinder             : ${groupId ? formatState(loadGroupFlag(CONFIGS.tinder, groupId)) : 'N/A'}`,
    `▪ Confesiones        : ${groupId ? formatState(loadGroupFlag(CONFIGS.confesiones, groupId)) : 'N/A'}`,
    `▪ Anti Status Tag    : ${groupId ? formatState(loadGroupFlag(CONFIGS.antistatustag, groupId)) : 'N/A'}`,
    '',
    '⚙️ *FUNCIONES GLOBALES*',
    '▪ QR-KILL            : 🟢 ACTIVO',
    '▪ Anti-TRABA         : 🟢 ACTIVO',
    '▪ Anti-Sticker       : 🟢 ACTIVO',
    '▪ Anti-Gore          : 🟢 ACTIVO',
    `▪ AEGIS (Región)     : ${formatAegisStats()}`,
    '▪ Anti-Flood         : 🟢 ACTIVO',
    '▪ K3RB·0xEY3 (NSFW)  : 🟢 ACTIVO',
  ];
}

export async function statusCerberoCommand(sock, msg, groupMetadata) {
  const chatId = msg.key.remoteJid;
  const mentionTarget = msg.key.participant || chatId;
  const statusLines = buildCerberoStatusLines({ chatId, groupMetadata });

  const caption = statusLines.join('\n');
  const imagePath = getRandomMenuImagePath();

  try {
    await sock.sendPresenceUpdate('composing', chatId);
    if (imagePath) {
      await sock.sendMessage(chatId, {
        image: { url: imagePath },
        caption,
        mentions: [mentionTarget],
      }, { quoted: msg });
    } else {
      await sock.sendMessage(chatId, {
        text: caption,
        mentions: [mentionTarget],
      }, { quoted: msg });
    }
  } catch (error) {
    console.error('[status_cerbero] error:', error);
    await sock.sendMessage(chatId, {
      text: `❌ No pude mostrar el estado: ${error.message}`,
      mentions: [mentionTarget],
    }, { quoted: msg });
  }
}
