import axios from 'axios';
import fs from 'fs';
import path from 'path';

const BOT_HEADER = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑rus-666';
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

const instagramDownload = async (url) => {
  // Reuse approach similar to TheMystic: try publer API
  try {
    const jobRes = await axios.post('https://app.publer.io/hooks/media', { url, iphone: false }, {
      headers: {
        Accept: '/',
        Origin: 'https://publer.io',
        Referer: 'https://publer.io',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    const jobId = jobRes.data.job_id;
    let status = 'working';
    let jobStatusResponse;
    while (status !== 'complete') {
      jobStatusResponse = await axios.get(`https://app.publer.io/api/v1/job_status/${jobId}`);
      status = jobStatusResponse.data.status;
      await new Promise(r => setTimeout(r, 800));
    }
    const data = jobStatusResponse.data.payload.map(item => ({ type: item.type === 'photo' ? 'image' : 'video', url: item.path }));
    return { status: true, data };
  } catch (e) {
    return { status: false, msg: e.message };
  }
};

export const instagramCb = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const url = args[0];
  if (!url) {
    await sock.sendMessage(chatId, { text: `${BOT_HEADER}\nUso: !ig_cb <url>` }, { quoted: msg });
    return;
  }

  try {
    const res = await instagramDownload(url);
    if (!res || !res.status) throw new Error('fallback');
    for (let i = 0; i < res.data.length; i++) {
      const item = res.data[i];
      if (item.type === 'image') await sock.sendMessage(chatId, { image: { url: item.url } }, { quoted: msg });
      else await sock.sendMessage(chatId, { video: { url: item.url } }, { quoted: msg });
      if (i < res.data.length - 1) await new Promise(resolve => setTimeout(resolve, 800));
    }
  } catch (e) {
    console.error('IG fallback:', e);
    // fallback to public API if configured
    try {
      const res2 = await axios.get(global.BASE_API_DELIRIUS + '/download/instagram', { params: { url } });
      const data = res2.data.data || [];
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item.type === 'image') await sock.sendMessage(chatId, { image: { url: item.url } }, { quoted: msg });
        else await sock.sendMessage(chatId, { video: { url: item.url } }, { quoted: msg });
        if (i < data.length - 1) await new Promise(resolve => setTimeout(resolve, 800));
      }
    } catch (err) {
      console.error('IG error final:', err);
      await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ No se pudo descargar Instagram.` }, { quoted: msg });
    }
  }
};

export default instagramCb;