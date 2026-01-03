import fs from 'fs';
import path from 'path';
import { creador } from './programador.js';

async function runTest() {
  const chatId = 'test-000@testing';
  const mockMsg = {
    key: { remoteJid: chatId }
  };

  const mockSock = {
    async sendMessage(remoteJid, message, opts = {}) {
      // Save a readable preview JSON
      const preview = {
        remoteJid,
        messageKeys: Object.keys(message),
        caption: message.caption || null,
        buttons: message.buttons || null,
        footer: message.footer || null
      };

      fs.writeFileSync('comandos_cerbero/programador_preview.json', JSON.stringify(preview, null, 2));
      console.log('Preview written to comandos_cerbero/programador_preview.json');

      // If there's an image buffer, save it
      if (message.image) {
        const imgBuffer = Buffer.isBuffer(message.image) ? message.image : (message.image.buffer || null);
        if (imgBuffer) {
          const outPath = 'comandos_cerbero/programador_preview_image.jpg';
          fs.writeFileSync(outPath, imgBuffer);
          console.log('Image written to', outPath);
        } else if (message.image.url) {
          console.log('Image is a URL:', message.image.url);
        }
      }

      // Return a fake ack
      return { ok: true };
    }
  };

  try {
    await creador(mockSock, mockMsg);
    console.log('\n✅ Test ejecutado. Revisa /tmp/programador_preview.json y la imagen en /tmp si existe.');
  } catch (err) {
    console.error('Error durante el test:', err);
  }
}

runTest();
