import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const userMediaMap = new Map();
const spamLimit = 3;
const spamTimeout = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*
 Detecta y expulsa al usuario si reenvía o envía más de 3 imágenes consecutivas en 3s sin mensajes de texto.
 */
export async function antiSpamMedia(sock, msg, isAdmin, groupMetadata) {
  if (!groupMetadata) return;

  const groupId = msg.key.remoteJid;
  const userId = msg.key.participant || msg.key.remoteJid;
  const now = Date.now();

  if (isAdmin) return;

  const isImage =
    !!msg.message?.imageMessage ||
    (msg.message?.documentMessage &&
      msg.message.documentMessage.mimetype?.startsWith('image/'));

  const isText =
    !!msg.message?.conversation || !!msg.message?.extendedTextMessage;

  if (!userMediaMap.has(userId)) {
    userMediaMap.set(userId, { timestamps: [], textActivity: false });
  }

  const userData = userMediaMap.get(userId);

  if (isText) {
    userData.textActivity = true;
    userData.timestamps = userData.timestamps.filter((t) => now - t < spamTimeout);
    return;
  }

  if (isImage) {
    console.log(`📸 Imagen detectada de ${userId}`);

    userData.timestamps = userData.timestamps.filter((t) => now - t < spamTimeout);
    userData.timestamps.push(now);

    if (userData.textActivity) {
      userData.timestamps = [];
      return;
    }

    if (userData.timestamps.length >= spamLimit) {
      try {
        await sock.groupSettingUpdate(groupId, 'announcement');
        await sock.sendMessage(groupId, { delete: msg.key });
        await sock.groupParticipantsUpdate(groupId, [userId], 'remove');

        await sock.sendMessage(groupId, {
          text: `🚫 [ANTISPAM] Usuario @${userId.split('@')[0]} fue expulsado por enviar imágenes consecutivas sin conversar.\n🔒 Grupo cerrado.`,
          mentions: [userId],
        });

        console.log(`[antispam] Usuario ${userId} expulsado por spam de imágenes.`);
        userMediaMap.delete(userId);
      } catch (err) {
        console.error('❌ Error en antiSpamMedia:', err);
      }
    }
  }
}
