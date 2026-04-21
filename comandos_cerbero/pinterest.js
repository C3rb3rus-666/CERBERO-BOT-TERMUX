// pinterest.js — Buscador de imágenes en Pinterest
// Cerbero-Bot by C3rb3rus-666
//
// Busca pines por palabra clave usando la API interna de Pinterest
// y envía las imágenes al chat con info del pin.

import axios from 'axios';

const BOT_HEADER = '[𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐁𝐎𝐓]';
const MAX_RESULTS = 5;
const COOLDOWNS = new Map();
const COOLDOWN_MS = 8000; // 8 segundos entre usos por usuario

/**
 * Busca pines en Pinterest por palabra clave.
 * Usa la API interna BaseSearchResource (no requiere API key).
 */
async function searchPinterest(query, count = MAX_RESULTS) {
  const res = await axios.get('https://www.pinterest.com/resource/BaseSearchResource/get/', {
    params: {
      source_url: '/search/pins/?q=' + encodeURIComponent(query) + '&rs=typed',
      data: JSON.stringify({
        options: {
          query,
          scope: 'pins',
          redux_normalize_feed: true,
          rs: 'typed',
          no_fetch_context_on_resource: false
        },
        context: {}
      }),
      _: Date.now()
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Pinterest-PWS-Handler': 'www/search/[scope].js',
      'Referer': 'https://www.pinterest.com/'
    },
    timeout: 15000
  });

  const results = res.data?.resource_response?.data?.results || [];

  // Filtrar solo pines con imagen válida
  return results
    .filter(pin => pin.type === 'pin' && pin.images)
    .slice(0, count)
    .map(pin => ({
      id: pin.id,
      title: pin.grid_title || pin.description || '',
      description: pin.description || '',
      imageUrl: pin.images?.['736x']?.url || pin.images?.['474x']?.url || pin.images?.['236x']?.url || null,
      pinner: {
        username: pin.pinner?.username || 'Desconocido',
        fullName: pin.pinner?.full_name || ''
      },
      board: pin.board?.name || '',
      link: `https://pinterest.com/pin/${pin.id}/`,
      domain: pin.link_domain || ''
    }));
}

/**
 * Descarga una imagen y retorna el buffer.
 */
async function downloadImage(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
    }
  });
  return Buffer.from(res.data);
}

/**
 * Handler del comando !pin
 * Uso: !pin <búsqueda> [cantidad]
 */
export async function handlePinterest(sock, msg) {
  const chatId = msg.key.remoteJid;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
  const args = text.split(/\s+/).slice(1); // Quitar '!pin'

  // ─── Sin argumentos → Ayuda ───
  if (args.length === 0) {
    await sock.sendMessage(chatId, {
      text: `📌 *PINTEREST — Cerbero-Bot*\n` +
            `─────────────────────────\n\n` +
            `*Uso:*\n` +
            `• *!pin <búsqueda>* — Buscar 1 imagen\n` +
            `• *!pin <búsqueda> 3* — Buscar 3 imágenes (máx 5)\n\n` +
            `*Ejemplos:*\n` +
            `• !pin tatuajes tribales\n` +
            `• !pin fondos anime aesthetic 3\n` +
            `• !pin la gula pecado capital\n\n` +
            `_📸 Las imágenes se obtienen directamente de Pinterest._`
    }, { quoted: msg });
    return;
  }

  // ─── Cooldown ───
  const now = Date.now();
  const lastUse = COOLDOWNS.get(senderJid) || 0;
  if (now - lastUse < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastUse)) / 1000);
    await sock.sendMessage(chatId, {
      text: `${BOT_HEADER} ⏳ Espera ${wait}s antes de buscar otra vez.`
    }, { quoted: msg });
    return;
  }

  // ─── Parsear cantidad (último argumento si es número 1-5) ───
  let count = 1;
  let queryArgs = [...args];
  const lastArg = args[args.length - 1];
  if (/^[1-5]$/.test(lastArg) && args.length > 1) {
    count = parseInt(lastArg);
    queryArgs = args.slice(0, -1);
  }
  const query = queryArgs.join(' ');

  if (query.length < 2) {
    await sock.sendMessage(chatId, {
      text: `${BOT_HEADER} ⚠️ La búsqueda es muy corta. Ejemplo: *!pin gatos aesthetic*`
    }, { quoted: msg });
    return;
  }

  // ─── Indicar que está buscando ───
  await sock.sendPresenceUpdate('composing', chatId);
  COOLDOWNS.set(senderJid, now);

  try {
    const pins = await searchPinterest(query, count);

    if (pins.length === 0) {
      await sock.sendMessage(chatId, {
        text: `${BOT_HEADER} ❌ No se encontraron resultados para *${query}*\n` +
              `_Intenta con otras palabras clave._`
      }, { quoted: msg });
      return;
    }

    // ─── Enviar cada pin como imagen con caption ───
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];

      if (!pin.imageUrl) continue;

      try {
        const imageBuffer = await downloadImage(pin.imageUrl);

        const title = pin.title.trim() || pin.description.trim() || 'Sin título';
        const displayTitle = title.length > 100 ? title.substring(0, 100) + '…' : title;

        const caption =
          `📌 *PINTEREST*\n` +
          `─────────────────────────\n` +
          (displayTitle !== 'Sin título' ? `📝 *${displayTitle}*\n` : '') +
          `❀ *Usuario:* ${pin.pinner.fullName || pin.pinner.username} (${pin.pinner.username})\n` +
          (pin.board ? `❏ *Tablero:* ${pin.board}\n` : '') +
          `🔗 *Link:* ${pin.link}` +
          (pins.length > 1 ? `\n\n_📸 ${i + 1}/${pins.length}_` : '');

        await sock.sendMessage(chatId, {
          image: imageBuffer,
          caption,
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true
          }
        }, { quoted: msg });

        // Pequeña pausa entre envíos para no saturar
        if (i < pins.length - 1) {
          await new Promise(r => setTimeout(r, 1500));
        }

      } catch (dlErr) {
        console.error(`[Pinterest] Error descargando pin ${pin.id}:`, dlErr.message);
        // Enviar solo texto si la descarga falla
        await sock.sendMessage(chatId, {
          text: `📌 *${pin.title || 'Pin'}*\n` +
                `❀ ${pin.pinner.username}\n` +
                `🔗 ${pin.link}\n` +
                `_⚠️ No se pudo descargar la imagen._`
        }, { quoted: msg });
      }
    }

    console.log(`[Pinterest] ${pins.length} pin(es) enviados para "${query}" en ${chatId}`);

  } catch (error) {
    console.error('[Pinterest] Error en búsqueda:', error.message);

    let errorMsg = `${BOT_HEADER} ❌ Error buscando en Pinterest.`;
    if (error.response?.status === 429) {
      errorMsg += '\n_⏳ Demasiadas solicitudes. Intenta en unos minutos._';
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      errorMsg += '\n_⏳ Pinterest tardó demasiado en responder._';
    } else {
      errorMsg += '\n_Intenta de nuevo en unos segundos._';
    }

    await sock.sendMessage(chatId, { text: errorMsg }, { quoted: msg });
  }
}
