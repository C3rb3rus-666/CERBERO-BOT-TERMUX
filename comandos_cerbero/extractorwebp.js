import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

export async function extractStickerImage(sock, message) {
  try {
    console.log("🔹 [DEBUG] Extractor de stickers iniciado...");

    const messageContent = message.message;
    const senderId = message.key.participant || message.key.remoteJid;
    const chatId = message.key.remoteJid;

    console.log("📩 [DEBUG] Recibido mensaje de:", senderId);
    console.log("🧐 [DEBUG] Contenido del mensaje:", JSON.stringify(messageContent, null, 2));

    // 🔍 Verificar si el mensaje contiene un sticker (directo o citado)
    const stickerMessage = messageContent?.stickerMessage ||
      messageContent?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;

    if (!stickerMessage) {
      console.log("⚠️ [DEBUG] El mensaje NO contiene un sticker.");
      await sock.sendMessage(chatId, {
        text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderId.split('@')[0]}, el mensaje no contiene un sticker válido. Asegúrate de citar un sticker.`,
        mentions: [senderId]
      }, { quoted: message });
      return;
    }

    console.log("✅ [DEBUG] Sticker detectado, comenzando descarga...");

    // 📥 Descargar el contenido del sticker
    const stream = await downloadContentFromMessage(stickerMessage, 'sticker');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    console.log("✅ [DEBUG] Sticker descargado correctamente.");

    // 📂 Definir ruta temporal para la imagen
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      console.log("📁 [DEBUG] Creando carpeta 'temp/'...");
      fs.mkdirSync(tempDir);
    }

    const outputPath = path.join(tempDir, `sticker-${Date.now()}.png`);

    // 🖼️ Convertir el sticker WebP a PNG
    console.log("🔄 [DEBUG] Iniciando conversión WebP -> PNG...");
    await sharp(buffer).toFormat('png').toFile(outputPath);

    console.log("✅ [DEBUG] Conversión completada. Imagen guardada en:", outputPath);

    // 📤 Enviar la imagen extraída al chat
    const imageBuffer = fs.readFileSync(outputPath);
    await sock.sendMessage(chatId, {
      image: imageBuffer,
      caption: `✅ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderId.split('@')[0]}, aquí tienes la imagen extraída del sticker.`,
      mentions: [senderId]
    }, { quoted: message });

    console.log("📤 [DEBUG] Imagen enviada correctamente.");

    // 🗑️ Eliminar el archivo temporal
    fs.unlinkSync(outputPath);
    console.log("🗑️ [DEBUG] Imagen temporal eliminada.");

  } catch (error) {
    console.error("❌ [ERROR] Error al extraer la imagen del sticker:", error);
    const senderId = message.key.participant || message.key.remoteJid;
    await sock.sendMessage(chatId, {
      text: `❌ **[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]** @${senderId.split('@')[0]}, error al extraer la imagen del sticker. Asegúrate de enviar o citar un sticker válido.`,
      mentions: [senderId]
    }, { quoted: message });
  }
}
