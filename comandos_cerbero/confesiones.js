import fs from 'fs';
import path from 'path';
import https from 'https';
import { createCanvas, registerFont, loadImage } from 'canvas';
import { parse as parseEmoji } from 'twemoji-parser';

// ── Cache local de PNGs Twemoji ───────────────────────────────────────────────
const EMOJI_CACHE_DIR = path.resolve(process.cwd(), 'temp', 'emoji_cache');
if (!fs.existsSync(EMOJI_CACHE_DIR)) fs.mkdirSync(EMOJI_CACHE_DIR, { recursive: true });

function emojiToPngUrl(emoji) {
  const cp = [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4,'0')).join('-');
  return `https://twemoji.maxcdn.com/v/latest/72x72/${cp}.png`;
}

async function fetchEmojiImage(emoji) {
  const cp = [...emoji].map(c => c.codePointAt(0).toString(16).padStart(4,'0')).join('-');
  const cachePath = path.join(EMOJI_CACHE_DIR, `${cp}.png`);
  if (fs.existsSync(cachePath)) return loadImage(cachePath);
  return new Promise((resolve, reject) => {
    const url = `https://twemoji.maxcdn.com/v/latest/72x72/${cp}.png`;
    const file = fs.createWriteStream(cachePath);
    https.get(url, res => {
      if (res.statusCode !== 200) { fs.unlinkSync(cachePath); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(() => loadImage(cachePath).then(resolve).catch(reject)));
    }).on('error', e => { try { fs.unlinkSync(cachePath); } catch(_){} reject(e); });
  });
}

// Divide un string en segmentos [{type:'text'|'emoji', value}]
function segmentarTexto(texto) {
  const tokens = parseEmoji(texto, { assetType: 'png' });
  if (!tokens.length) return [{ type: 'text', value: texto }];
  const segs = [];
  let cursor = 0;
  for (const tok of tokens) {
    if (tok.indices[0] > cursor) segs.push({ type: 'text', value: texto.slice(cursor, tok.indices[0]) });
    segs.push({ type: 'emoji', value: tok.text });
    cursor = tok.indices[1];
  }
  if (cursor < texto.length) segs.push({ type: 'text', value: texto.slice(cursor) });
  return segs;
}

// Mide el ancho de una línea con emojis (emojis cuentan como fontSize px de ancho)
function medirLinea(ctx, segs, fontSize) {
  let w = 0;
  for (const s of segs) {
    if (s.type === 'emoji') w += fontSize * 1.2;
    else w += ctx.measureText(s.value).width;
  }
  return w;
}

// Dibuja una línea mixta (texto + emojis PNG) en el canvas
async function dibujarLineaMixta(ctx, segs, x, y, fontSize) {
  let cx = x;
  for (const s of segs) {
    if (s.type === 'emoji') {
      try {
        const img = await fetchEmojiImage(s.value);
        const sz = fontSize * 1.15;
        ctx.drawImage(img, cx, y - sz * 0.82, sz, sz);
        cx += fontSize * 1.2;
      } catch (_) {
        // fallback: dibujar el caracter igualmente
        ctx.fillText(s.value, cx, y);
        cx += fontSize * 1.2;
      }
    } else {
      ctx.fillText(s.value, cx, y);
      cx += ctx.measureText(s.value).width;
    }
  }
}

// ==========================================
// 🤫 CONFESIONES — Sistema anónimo para grupos
//
// FLUJO:
//   1. Admin registra el grupo destino desde dentro del grupo:
//        !confesiones grupo   → registra ESTE grupo como destino
//        !confesiones abrir   → activa la dinámica + anuncia
//
//   2. Miembro manda DM al bot — el bot detecta la intención:
//        "🤫 tengo un secreto"
//        "confesion: me gusta alguien"
//        "secreto: nunca lo he dicho"
//      → Bot publica INMEDIATAMENTE la imagen en el grupo
//      → Registra y limpia (no acumula basura)
//
//   3. Admin gestiona:
//        !confesiones cerrar  → desactiva
//        !confesiones limpiar → borra historial completo
//        !confesiones estado  → ver config
// ==========================================

const DATA_PATH   = path.resolve(process.cwd(), 'comandos_cerbero', 'confesiones_data.json');
const CONFIG_PATH = path.resolve(process.cwd(), 'comandos_cerbero', 'confesiones_config.json');
const CONFESIONES_GROUP_SEND_DELAY_MS = Number(process.env.CONFESIONES_GROUP_SEND_DELAY_MS || 3500);

// Delay humano con variabilidad (±500ms) para evitar detección automática
function getHumanDelay(baseMs) {
  const variance = Math.random() * 1000 - 500; // ±500ms
  return Math.max(baseMs + variance, 1000); // Mínimo 1 segundo
}
// ── Persistencia ─────────────────────────────────────────────────────────────

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch (_) { return { confesiones: [], nextId: 1 }; }
}
function saveData(d) { fs.writeFileSync(DATA_PATH, JSON.stringify(d, null, 2)); }

function createEmptyConfig() {
  return { enabled_groups: {} };
}

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch (_) { return createEmptyConfig(); }
}
function saveConfig(c) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2)); }

function normalizeJidNumber(jid = '') {
  return jid.toString().split('@')[0].split(':')[0].replace(/\D/g, '');
}

function getNormalizedConfig() {
  const parsed = loadConfig();
  if (parsed.enabled_groups && typeof parsed.enabled_groups === 'object') {
    return parsed;
  }

  if (parsed.grupo_id) {
    return {
      enabled_groups: {
        [parsed.grupo_id]: {
          activo: !!parsed.activo,
          updatedAt: Date.now(),
          updatedBy: parsed.updatedBy || null,
        },
      },
    };
  }

  return createEmptyConfig();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getActiveGroupIds(config = getNormalizedConfig()) {
  return Object.entries(config.enabled_groups || {})
    .filter(([, value]) => value?.activo)
    .map(([groupId]) => groupId);
}

async function findActiveGroupsForSender(sock, senderJid) {
  const config = getNormalizedConfig();
  const activeGroupIds = getActiveGroupIds(config);
  if (!activeGroupIds.length) return [];

  const senderNumber = normalizeJidNumber(senderJid);
  const matches = [];

  for (const groupId of activeGroupIds) {
    try {
      const meta = await sock.groupMetadata(groupId);
      const isMember = (meta.participants || []).some(participant => {
        const ids = [
          participant?.id,
          participant?.phoneNumber,
          participant?.lid,
        ].filter(Boolean);
        return ids.some(id => normalizeJidNumber(id) === senderNumber);
      });

      if (isMember) matches.push(groupId);
    } catch (err) {
      console.error(`[CONF] No se pudo leer metadata de ${groupId}:`, err.message || err);
    }
  }

  return matches;
}

// ── Detección inteligente de intención ───────────────────────────────────────

// Prefijos opcionales que se eliminan del texto antes de publicar
const PREFIJOS = [
  /^confes(?:i[oó]n|ar|o)\s*[:→\-]?\s*/i,
  /^quiero\s+confesar\s*/i,
  /^tengo\s+(?:una\s+)?confes(?:i[oó]n|ion)\s*/i,
  /^mi\s+confes(?:i[oó]n|ion)\s*[:→\-]?\s*/i,
  /^secreto\s*[:→\-]?\s*/i,
  /^anon(?:imo)?\s*[:→\-]?\s*/i,
  /^\u{1F92B}\s*/u,
  /^(?:quiero\s+)?(?:decir|contar)\s+algo\s+an[oó]nimo\s*/i,
];

// Ignorar si es un comando del bot
const IGNORAR = /^[!\/\.#][\w]/;

export function detectarConf(text) {
  if (!text?.trim()) return null;
  const t = text.trim();
  // Ignorar comandos
  if (IGNORAR.test(t)) return null;
  // Quitar prefijo si lo trae
  for (const pat of PREFIJOS) {
    if (pat.test(t)) {
      const conf = t.replace(pat, '').trim();
      return conf.length >= 5 ? conf : null;
    }
  }
  // Modo agresivo: cualquier mensaje con al menos 10 caracteres es confesión
  return t.length >= 10 ? t : null;
}

// ── Limpiar historial ─────────────────────────────────────────────────────────

export function limpiarHistorial() {
  saveData({ confesiones: [], nextId: 1 });
}

// ── Generar imagen con canvas ─────────────────────────────────────────────────

export async function generarImagenConf(texto, numero) {
  const W = 800, PADDING = 52, LINE_H = 44, FONT_SIZE = 27;

  // Segmentar texto en partes de texto y emojis
  const allSegs = segmentarTexto(texto);

  // Medir y dividir en líneas respetando ancho máximo
  const tmpC = createCanvas(W, 100);
  const tmpX = tmpC.getContext('2d');
  tmpX.font  = `bold ${FONT_SIZE}px Sans`;
  const maxW = W - PADDING * 2 - 50;

  // Construir líneas: cada "línea" es un array de segmentos
  const lineSegs = [];
  let curSegs = [];
  let curW = 0;

  for (const seg of allSegs) {
    if (seg.type === 'emoji') {
      const sw = FONT_SIZE * 1.2;
      if (curW + sw > maxW && curSegs.length) { lineSegs.push(curSegs); curSegs = []; curW = 0; }
      curSegs.push(seg); curW += sw;
    } else {
      // partir el texto en palabras
      const words = seg.value.split(' ');
      for (let wi = 0; wi < words.length; wi++) {
        const w = words[wi];
        const spacer = wi < words.length - 1 ? ' ' : '';
        const sw = tmpX.measureText(w + spacer).width;
        if (curW + sw > maxW && curSegs.length) { lineSegs.push(curSegs); curSegs = []; curW = 0; }
        if (w) { curSegs.push({ type: 'text', value: w + spacer }); curW += sw; }
      }
    }
  }
  if (curSegs.length) lineSegs.push(curSegs);

  const HEADER_H = 115;
  const FOOTER_H = 65;
  const H        = HEADER_H + lineSegs.length * LINE_H + 40 + FOOTER_H;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0d0d1a');
  bg.addColorStop(1, '#1a0d2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Borde glow
  ctx.shadowColor = '#b026ff';
  ctx.shadowBlur  = 18;
  ctx.strokeStyle = '#b026ff';
  ctx.lineWidth   = 2;
  ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.shadowBlur  = 0;

  // Línea header
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0,   '#b026ff');
  lineGrad.addColorStop(0.5, '#ff2d6b');
  lineGrad.addColorStop(1,   '#b026ff');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth   = 3;
  ctx.beginPath(); ctx.moveTo(PADDING, 68); ctx.lineTo(W - PADDING, 68); ctx.stroke();

  // Título
  ctx.fillStyle = '#ff2d6b';
  ctx.font      = 'bold 20px Sans';
  ctx.textAlign = 'left';
  ctx.fillText('⬡  CONFESIÓN ANÓNIMA', PADDING, 40);

  ctx.fillStyle = '#b026ff';
  ctx.font      = 'bold 20px Sans';
  ctx.textAlign = 'right';
  ctx.fillText(`#${numero}`, W - PADDING, 40);

  // Comilla decorativa
  ctx.fillStyle = '#b026ff33';
  ctx.font      = 'bold 90px Sans';
  ctx.textAlign = 'left';
  ctx.fillText('"', PADDING - 4, HEADER_H + 14);

  // Texto mixto con emojis PNG de Twemoji
  ctx.fillStyle = '#f0f0f0';
  ctx.font      = `bold ${FONT_SIZE}px Sans`;
  ctx.textAlign = 'left';
  for (let i = 0; i < lineSegs.length; i++) {
    await dibujarLineaMixta(ctx, lineSegs[i], PADDING + 48, HEADER_H + 26 + i * LINE_H, FONT_SIZE);

  }

  // Separador footer
  ctx.strokeStyle = '#b026ff55';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PADDING, H - FOOTER_H);
  ctx.lineTo(W - PADDING, H - FOOTER_H);
  ctx.stroke();

  // Footer
  const fecha = new Date().toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bogota',
  });
  ctx.fillStyle = '#888';
  ctx.font      = '17px Sans';
  ctx.textAlign = 'left';
  ctx.fillText(`— Anónimo · ${fecha}`, PADDING, H - 24);

  ctx.fillStyle = '#b026ff';
  ctx.font      = 'bold 16px Sans';
  ctx.textAlign = 'right';
  ctx.fillText('C3RB3RUS-BOT', W - PADDING, H - 24);

  return canvas.toBuffer('image/jpeg', { quality: 0.93 });
}

// ── Frases del admin autónomo para incentivar confesiones ────────────────────

const FRASES_INCENTIVO = [
  '👀 Alguien se atrevió... ¿y tú? Mándale tu confesión al bot en privado 🤫',
  '🔥 Ya llegó la primera del día. ¿Quién sigue? El bot guarda tu secreto 🔐',
  '😈 Anónima y publicada. ¿Tienes algo que confesar? El bot no habla 🤐',
  '🌙 Los secretos pesan. Libérate — mándasela al bot en privado y nadie sabrá quién fue 👻',
  '💀 C3RB3RUS recibió una confesión. ¿La tuya también merece ser contada? 🤫',
  '🎭 ¿Cuántos secretos más hay en este grupo...? El bot los publica sin revelar quién los manda 🕵️',
  '⚡ Confesión recibida y procesada. Tú también puedes — es 100% anónimo 🔏',
  '🫣 Alguien se desahogó. ¿Y tú cargas algo solo/a? Cuéntaselo al bot 🤫',
  '🃏 El que confiesa duerme tranquilo. Hazlo tú también — el bot es discreto 🤐',
  '🌀 Nueva confesión en el sistema. ¿Quién más tiene algo que soltar? 🤫',
];

// ── Publicar al grupo con etiqueta masiva ─────────────────────────────────────

async function publicarConf(sock, texto, id, groupIds = null) {
  const config = getNormalizedConfig();
  const groupIdsResolved = Array.isArray(groupIds) && groupIds.length
    ? groupIds
    : getActiveGroupIds(config);
  const groupIdsToUse = groupIdsResolved;
  if (!groupIdsToUse.length) return false;

  // Etiquetar a todos solo cada 2 confesiones (IDs pares), el resto sin tags
  const esTurnoTag = (id % 2 === 0);
  const img = await generarImagenConf(texto, id);
  let published = 0;

  try {
    const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
    const frase = FRASES_INCENTIVO[id % FRASES_INCENTIVO.length];

    for (let index = 0; index < groupIdsToUse.length; index++) {
      const groupId = groupIdsToUse[index];
      let mentions = [];
      if (esTurnoTag) {
        try {
          const meta = await sock.groupMetadata(groupId);
          mentions = (meta.participants || []).map(p => p.id).filter(Boolean);
        } catch (_) {}
      }

      const tagLine = esTurnoTag && mentions.length
        ? `\n👥 ${mentions.map(j => `@${j.split('@')[0]}`).join(' ')}\n`
        : '';

      await sock.sendMessage(groupId, {
        image: img,
        caption:
          `╔══════════════════════════╗\n` +
          `║  🤫  C3RB3RUS :: CONF_DAEMON  🤫  ║\n` +
          `╚══════════════════════════╝\n` +
          `▸ PROC    : confesiones.publish()\n` +
          `▸ ID      : #${id}\n` +
          `▸ TS      : ${ts}\n` +
          `▸ STATUS  : ANONYMOUS ✓\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${frase}${tagLine}\n\n` +
          `📩 _Escríbeme en privado: "🤫 tu secreto aquí"_\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        mentions,
      });
      console.log(`[CONF] ✅ #${id} publicada → ${groupId}`);
      published++;
      if (index < groupIdsToUse.length - 1) {
        await sleep(getHumanDelay(CONFESIONES_GROUP_SEND_DELAY_MS));
      }
    }
    return published > 0;
  } catch (e) {
    console.error('[CONF] ❌ Error publicando imagen:', e.message);
    // Fallback texto plano
    try {
      for (const groupId of groupIdsToUse) {
        await sock.sendMessage(groupId, {
          text: `🤫 *CONFESIÓN ANÓNIMA #${id}*\n\n_"${texto}"_\n\n— Anónimo`,
        });
      }
    } catch (_) {}
    return published > 0;
  }
}

// ── Filtro anti-basura ────────────────────────────────────────────────────────
const BASURA = [
  /^(hola|buenas?|buenos?\s+d[ií]as?|buenas?\s+noches?|buenas?\s+tardes?)/i,
  /soy\s+nuevo/i,
  /quien\s+me\s+agrega/i,
  /alguien\s+me\s+agrega/i,
  /me\s+pueden\s+agregar/i,
  /agr[eé]g[ua](?:en)?me/i,      // agrégueme, agrégame, agregame, agréguenme
  /ag+a?me/i,                     // aggame, agame, aggaame
  /\bagg(?:a|ar|en|s)?\b/i,       // agg, agga, aggar, aggen
  /ag+[s]?\b/i,
  /\btest\b/i,
  /^(ok|okay|bien|si|no|jaja|lol|xd|😂|🤣|👍|😊)\s*$/i,
  /^[?!.]+$/,
  /qu[eé]\s+(es\s+esto|hace|hacen|pasa)/i,
  /c[oó]mo\s+(funciona|se\s+usa)/i,
];

// ── Patrones de promoción / spam de redes sociales ────────────────────────────
const PROMO_REDES = [
  // WhatsApp — links de grupo o canal
  /chat\.whatsapp\.com\//i,
  /whatsapp\.com\/channel\//i,
  /wa\.me\//i,
  // Instagram
  /instagram\.com\//i,
  /instagr\.am\//i,
  /(?:^|\s)@[\w.]+\s*(en|en\s+insta|instagram|ig)\b/i,
  /(?:sígueme|sigan?me|follow\s*me|follow\s*us|visita\s+mi)\s+(?:en\s+)?(?:insta(?:gram)?|ig|face(?:book)?|fb|whatsapp|wa|tiktok|tt|youtube|yt)\b/i,
  // Facebook
  /facebook\.com\//i,
  /fb\.com\//i,
  /fb\.me\//i,
  // TikTok
  /tiktok\.com\//i,
  /vm\.tiktok\.com\//i,
  // YouTube canales / promoción
  /youtube\.com\/(channel|c|@)/i,
  /youtu\.be\//i,
  // Telegram
  /t\.me\//i,
  /telegram\.me\//i,
  // Menciones @usuario sueltas (cualquier @ seguido de nombre de usuario)
  /@[\w.]{3,}/i,
  // Patrones genéricos de autopromoción
  /\bmi\s+(canal|perfil|cuenta|ig|insta(?:gram)?|face(?:book)?|fb|whatsapp|wa|tiktok|tt|yt|youtube)\b/i,
  /\b(s[íi]gueme|s[íi]game|sigan?me|follow\s*me|follow\s*us)\b/i,
  /\b(link\s+en\s+(bio|perfil)|link\s*:\s*http)/i,
  /\bvisit[ae]\s+(mi\s+)?(perfil|canal|cuenta|ig|insta(?:gram)?|face(?:book)?|fb|tiktok|tt|yt|youtube)\b/i,
  // "busca mi ig", "add mi fb", "search mi tt", "escríbeme al ig"
  /\b(?:busca|add|a[ñn]ade|encuentra|escr[íi]beme|contacta?me|mensaje(?:a)?me|dm[eé]?me)\s+(?:a\s+|al\s+|mi\s+)?(?:ig|insta(?:gram)?|fb|face(?:book)?|tt|tiktok|yt|youtube|wa|whatsapp)\b/i,
  // "en ig:", "en fb:", "en tt:" como anuncio de usuario
  /\ben\s+(?:ig|insta(?:gram)?|fb|face(?:book)?|tt|tiktok|yt|youtube|wa|whatsapp)\s*[:→\-]/i,
  // "escríbanme", "escríbeme", "escríbame" — invitación a contacto directo
  /escr[\u00ed\u00eabi]b[ae](?:n)?me\b/i,
  // "agregar al privado / pv / priv / priva / privado"
  /agr[e\u00e9]g[ua](?:r|me|nos|en)?\s+(?:al?\s+)?(?:priv(?:ado|a)?|p[vb])\b/i,
  // "al privado", "al priv", "al pv", "al priva" — solos también
  /\bal\s+(?:priv(?:ado|a)?|p[vb])\b/i,
  // "mándame mensaje al pv", "escríbeme al privado", "contáctame al priv"
  /(?:manda?me|escr[\u00edi]b[ae](?:n)?me|contacta?me|habla?me|chatea?me)\s+(?:por\s+)?(?:al?\s+)?(?:priv(?:ado|a)?|p[vb]|privs?)\b/i,
  // Números de WhatsApp con intención de contacto
  /(?:escr[\u00edi]beme|contacta?me|manda?me\s+(?:msg|mensaje)|agr[e\u00e9]game)\s+(?:al?\s+)?\+?\d[\d\s\-]{7,}/i,
];

function esPromocion(texto) {
  const t = texto.trim();
  // Detectar URLs genéricas (http/https) — cualquier link = posible promo
  if (/https?:\/\//i.test(t)) return true;
  return PROMO_REDES.some(pat => pat.test(t));
}

function esBasura(texto) {
  if (!texto || texto.trim().length < 15) return true;
  const t = texto.trim();
  // Más del 60% del texto son emojis/símbolos → basura
  const soloTexto = t.replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\s]/gu, '');
  if (soloTexto.length < 5) return true;
  return BASURA.some(pat => pat.test(t));
}

// ── Manejador de DMs ──────────────────────────────────────────────────────────

export async function manejarDMConf(sock, senderJid, text) {
  console.log(`[CONF DM] 📩 de ${senderJid} → "${text?.slice(0,60)}"`);

  const confesion = detectarConf(text);
  if (!confesion) {
    console.log(`[CONF DM] ⚠️ texto descartado (muy corto, no tiene prefijo o es comando)`);
    // Solo responder con el mensaje de bienvenida si las confesiones están activas
    const cfgCheck = loadConfig();
    if (getActiveGroupIds(cfgCheck).length) {
      await sock.sendMessage(senderJid, {
        text:
          `🤫 ¡Hola! Soy el bot de confesiones anónimas.\n\n` +
          `Empieza tu mensaje con: _"confesion: tu secreto aquí"_ y lo publicaré de forma anónima en el grupo. 🔐`,
      });
    }
    return false;
  }

  // ── Filtro anti-basura ────────────────────────────────────────────────────
  if (esBasura(confesion)) {
    console.log(`[CONF DM] 🚫 bloqueado por filtro anti-basura`);
    await sock.sendMessage(senderJid, {
      text: `🤫 Ese mensaje no parece una confesión.\nCuéntame algo real y lo publicaré de forma anónima 🔐`,
    });
    return true;
  }

  // ── Filtro anti-promoción de redes sociales ───────────────────────────────
  if (esPromocion(confesion)) {
    console.log(`[CONF DM] 🚫 bloqueado por promoción de redes sociales`);
    await sock.sendMessage(senderJid, {
      text: `🚫 Las confesiones anónimas no son para promocionar redes sociales ni compartir links.\n\nCuéntame un secreto de verdad 🤫`,
    });
    return true;
  }

  const config = loadConfig();
  const destinos = await findActiveGroupsForSender(sock, senderJid);
  console.log(`[CONF DM] config → grupos_activos=${getActiveGroupIds(config).length} destinos=${destinos.length}`);

  if (!destinos.length) {
    return true;
  }

  // ── Publicar directamente ─────────────────────────────────────────────────
  const data = loadData();
  const id   = data.nextId++;
  data.confesiones.push({ id, ts: Date.now() });
  if (data.confesiones.length > 50) data.confesiones = data.confesiones.slice(-50);
  saveData(data);

  await publicarConf(sock, confesion, id, destinos);
  await sock.sendMessage(senderJid, {
    text: `✅ *¡Publicada!* (#${id}) 🔐\n_Nadie sabe que fuiste tú._`,
  });

  return true;
}

// ── Comandos !confesiones ─────────────────────────────────────────────────────

export async function manejarComandoConf(sock, chatId, senderJid, isAdmin, args) {
  const sub = (args[0] || '').toLowerCase();

  if (!chatId.endsWith('@g.us')) {
    await sock.sendMessage(chatId, { text: 'Este comando debe usarse dentro de un grupo.' });
    return;
  }

  if (!isAdmin) {
    await sock.sendMessage(chatId, { text: '⛔ Solo los administradores pueden usar este comando.' });
    return;
  }

  // !confesiones grupo → registrar este grupo como destino
  if (sub === 'grupo') {
    const config = getNormalizedConfig();
    if (!config.enabled_groups) config.enabled_groups = {};
    config.enabled_groups[chatId] = {
      activo: false,
      updatedAt: Date.now(),
      updatedBy: senderJid,
    };
    saveConfig(config);
    await sock.sendMessage(chatId, {
      text:
        `✅ *Grupo registrado como destino de confesiones.*
` +
        `▸ ID: \`${chatId}\`
` +
        `Ahora usa *!confesiones abrir* para activar la dinámica en este grupo.`,
    });
    return;
  }

  // !confesiones abrir
  if (sub === 'abrir') {
    const config = getNormalizedConfig();
    if (!config.enabled_groups) config.enabled_groups = {};
    config.enabled_groups[chatId] = {
      ...(config.enabled_groups[chatId] || {}),
      activo: true,
      updatedAt: Date.now(),
      updatedBy: senderJid,
    };
    saveConfig(config);

    let mentions = [];
    try {
      const meta = await sock.groupMetadata(chatId);
      mentions = (meta.participants || []).map(p => p.id);
    } catch (_) {}

    await sock.sendMessage(chatId, {
      text:
        `╔══════════════════════════╗\n` +
        `║  🤫  CONFESIONES ABIERTAS  🤫  ║\n` +
        `╚══════════════════════════╝\n\n` +
        `✅ La dinámica está *ACTIVA* 🔓\n\n` +
        `📩 Mándale un mensaje privado al bot así:\n\n` +
        `   _"🤫 me gusta alguien del grupo"_\n` +
        `   _"confesion: tengo un secreto"_\n` +
        `   _"secreto: nunca lo he dicho"_\n\n` +
        `🔐 Son *100% anónimas* — el bot no revela quién las mandó.\n` +
        `📸 Se publicarán aquí automáticamente como imagen.`,
      mentions,
    });
    return;
  }

  // !confesiones cerrar
  if (sub === 'cerrar') {
    const config = getNormalizedConfig();
    if (!config.enabled_groups) config.enabled_groups = {};
    config.enabled_groups[chatId] = {
      ...(config.enabled_groups[chatId] || {}),
      activo: false,
      updatedAt: Date.now(),
      updatedBy: senderJid,
    };
    saveConfig(config);
    await sock.sendMessage(chatId, { text: '🔒 Dinámica de confesiones *cerrada*.' });
    return;
  }

  // !confesiones limpiar → borra TODO el historial
  if (sub === 'limpiar') {
    limpiarHistorial();
    await sock.sendMessage(chatId, {
      text:
        `🗑️ *Historial limpiado completamente.*\n` +
        `El contador reinicia desde #1.\n` +
        `_(La configuración del grupo se conserva)_`,
    });
    return;
  }

  // !confesiones estado
  if (sub === 'estado' || sub === 'info') {
    const config = getNormalizedConfig();
    const data   = loadData();
    const current = config.enabled_groups?.[chatId];
    const activeCount = getActiveGroupIds(config).length;
    await sock.sendMessage(chatId, {
      text:
        `🤫 *Estado del sistema de confesiones:*\n\n` +
        `▸ Grupo actual  : ${chatId}\n` +
        `▸ Estado aquí   : ${current?.activo ? '✅ ACTIVO' : '🔒 CERRADO'}\n` +
        `▸ Grupos activos: ${activeCount}\n` +
        `▸ Publicadas    : ${data.confesiones.length} (historial reciente)\n` +
        `▸ Próximo ID    : #${data.nextId}`,
    });
    return;
  }

  // Ayuda
  await sock.sendMessage(chatId, {
    text:
      `🤫 *CONFESIONES — Comandos admin:*\n\n` +
      `!confesiones grupo   → registrar este grupo como destino\n` +
      `!confesiones abrir   → activar en este grupo\n` +
      `!confesiones cerrar  → desactivar en este grupo\n` +
      `!confesiones limpiar → borrar historial completo\n` +
      `!confesiones estado  → ver configuración`,
  });
}
