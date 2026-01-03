import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const BOT_HEADER = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓] 𝐁𝐲 𝐂𝟑𝐫𝐛𝟑𝐫𝐮𝐬-𝟔𝟔𝟔 #𝐔𝐧𝐤𝐧𝐨𝐰𝐧𝐬';
const TEMP_DIR = path.join(process.cwd(), 'temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

function createApiRequest(text, platform) {
  const SITE_URL = 'https://instatiktok.com/';
  const form = new URLSearchParams();
  form.append('url', text);
  form.append('platform', platform);
  form.append('siteurl', SITE_URL);
  return { SITE_URL, form };
}

async function fetchDownloadLinks(text, platform) {
  const { SITE_URL, form } = createApiRequest(text, platform);
  const res = await axios.post(`${SITE_URL}api`, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': SITE_URL,
      'Referer': SITE_URL,
      'User-Agent': 'Mozilla/5.0',
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  const html = res?.data?.html;
  if (!html || res?.data?.status !== 'success') return null;
  const $ = cheerio.load(html);
  const links = [];
  $('a.btn[href^="http"]').each((_, el) => {
    const link = $(el).attr('href');
    if (link && !links.includes(link)) links.push(link);
  });
  return links;
}

function getDownloadLink(platform, links) {
  if (platform === 'tiktok') return links.find(link => /hdplay/.test(link)) || links[0];
  return null;
}

export const tiktokCb = async (sock, msg, args) => {
  const chatId = msg.key.remoteJid;
  const text = args.join(' ').trim();
  if (!text) {
    await sock.sendMessage(chatId, { text: `${BOT_HEADER}\nUso: !tt_cb <url>` }, { quoted: msg });
    return;
  }

  try {
    const links = await fetchDownloadLinks(text, 'tiktok');
    if (!links || !links.length) throw new Error('No se obtuvieron enlaces');
    const download = getDownloadLink('tiktok', links);
    if (!download) throw new Error('No se encontró enlace de descarga');

    await sock.sendMessage(chatId, { video: { url: download }, caption: `${BOT_HEADER}\n✅ Aquí tienes el video` }, { quoted: msg });
  } catch (e) {
    console.error('Error tiktok:', e);
    await sock.sendMessage(chatId, { text: `${BOT_HEADER}\n❌ No pude obtener el video. Intenta con otra URL.` }, { quoted: msg });
  }
};

export default tiktokCb;