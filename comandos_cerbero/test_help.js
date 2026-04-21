import fs from 'fs';
import { helpCommand } from './help.js';

async function runTest() {
  const chatId = 'test-000@testing';
  const mockMsg = {
    key: { remoteJid: chatId, participant: 'user1@s.whatsapp.net' }
  };

  const mockSock = {
    user: { id: 'bot@s.whatsapp.net' },
    async sendPresenceUpdate(type, chat) {
      console.log('sendPresenceUpdate', type, chat);
      return true;
    },
    async sendMessage(remoteJid, message, opts = {}) {
      const preview = {
        remoteJid,
        messageKeys: Object.keys(message),
        caption: message.caption || null,
        text: message.text || null,
        contextInfo: message.contextInfo || null
      };
      fs.writeFileSync('comandos_cerbero/help_preview.json', JSON.stringify(preview, null, 2));
      console.log('Preview written to comandos_cerbero/help_preview.json');
      if (message.image) {
        const buf = Buffer.isBuffer(message.image) ? message.image : (message.image.buffer || null);
        if (buf) fs.writeFileSync('comandos_cerbero/help_preview_image.jpg', buf);
      }
      return { ok: true };
    }
  };

  try {
    await helpCommand(mockSock, mockMsg);
    console.log('✅ help test executed');
  } catch (err) {
    console.error('Error during help test:', err);
  }
}

runTest();
