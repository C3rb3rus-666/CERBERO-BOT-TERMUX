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

// ── Persistencia ─────────────────────────────────────────────────────────────

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')); }
  catch (_) { return { confesiones: [], nextId: 1 }; }
}
function saveData(d) { fs.writeFileSync(DATA_PATH, JSON.stringify(d, null, 2)); }

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); }
  catch (_) { return { grupo_id: null, activo: false }; }
}
function saveConfig(c) { fs.writeFileSync(CONFIG_PATH, JSON.stringify(c, null, 2)); }

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

async function publicarConf(sock, texto, id) {
  const config = loadConfig();
  if (!config.grupo_id || !config.activo) return false;

  try {
    const img = await generarImagenConf(texto, id);

    // Etiquetar a todos los miembros del grupo
    let mentions = [];
    try {
      const meta = await sock.groupMetadata(config.grupo_id);
      mentions = (meta.participants || []).map(p => p.id);
    } catch (_) {}

    const ts = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', hour12: false });
    const frase = FRASES_INCENTIVO[id % FRASES_INCENTIVO.length];
    const tags  = mentions.map(jid => `@${jid.split('@')[0]}`).join(' ');

    await sock.sendMessage(config.grupo_id, {
      image:    img,
      caption:
        `╔══════════════════════════╗\n` +
        `║  🤫  C3RB3RUS :: CONF_DAEMON  🤫  ║\n` +
        `╚══════════════════════════╝\n` +
        `▸ PROC    : confesiones.publish()\n` +
        `▸ ID      : #${id}\n` +
        `▸ TS      : ${ts}\n` +
        `▸ STATUS  : ANONYMOUS ✓\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `${frase}\n\n` +
        `📩 _Escríbeme en privado: "🤫 tu secreto aquí"_\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      mentions,
    });
    console.log(`[CONF] ✅ #${id} publicada → ${config.grupo_id}`);
    return true;
  } catch (e) {
    console.error('[CONF] ❌ Error publicando imagen:', e.message);
    // Fallback texto plano
    try {
      await sock.sendMessage(config.grupo_id, {
        text: `🤫 *CONFESIÓN ANÓNIMA #${id}*\n\n_"${texto}"_\n\n— Anónimo`,
      });
    } catch (_) {}
    return false;
  }
}

// ── Filtro anti-basura ────────────────────────────────────────────────────────
const BASURA = [
  /^(hola|buenas?|buenos?\s+d[ií]as?|buenas?\s+noches?|buenas?\s+tardes?)/i,
  /soy\s+nuevo/i,
  /quien\s+me\s+agrega/i,
  /alguien\s+me\s+agrega/i,
  /me\s+pueden\s+agregar/i,
  /agreguen?me/i,
  /\bagg\b/i,
  /ag+[s]?\b/i,
  /\btest\b/i,
  /^(ok|okay|bien|si|no|jaja|lol|xd|😂|🤣|👍|😊)\s*$/i,
  /^[?!.]+$/,
  /qu[eé]\s+(es\s+esto|hace|hacen|pasa)/i,
  /c[oó]mo\s+(funciona|se\s+usa)/i,
];

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
    console.log(`[CONF DM] ⚠️ texto descartado (muy corto o es comando)`);
    await sock.sendMessage(senderJid, {
      text:
        `🤫 ¡Hola! Soy el bot de confesiones anónimas.\n\n` +
        `Escríbeme tu secreto directamente y lo publicaré de forma anónima en el grupo. 🔐`,
    });
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

  const config = loadConfig();
  console.log(`[CONF DM] config → grupo_id=${config.grupo_id} activo=${config.activo}`);

  if (!config.grupo_id || !config.activo) {
    await sock.sendMessage(senderJid, {
      text: `🤫 Las confesiones no están activas ahora mismo. Espera a que un admin las abra.`,
    });
    return true;
  }

  // ── Publicar directamente ─────────────────────────────────────────────────
  const data = loadData();
  const id   = data.nextId++;
  data.confesiones.push({ id, ts: Date.now() });
  if (data.confesiones.length > 50) data.confesiones = data.confesiones.slice(-50);
  saveData(data);

  await publicarConf(sock, confesion, id);
  await sock.sendMessage(senderJid, {
    text: `✅ *¡Publicada!* (#${id}) 🔐\n_Nadie sabe que fuiste tú._`,
  });

  return true;
}

// ── Comandos !confesiones ─────────────────────────────────────────────────────

export async function manejarComandoConf(sock, chatId, senderJid, isAdmin, args) {
  const sub = (args[0] || '').toLowerCase();

  if (!isAdmin) {
    await sock.sendMessage(chatId, { text: '⛔ Solo los administradores pueden usar este comando.' });
    return;
  }

  // !confesiones grupo → registrar este grupo como destino
  if (sub === 'grupo') {
    const config = loadConfig();
    config.grupo_id = chatId;
    saveConfig(config);
    await sock.sendMessage(chatId, {
      text:
        `✅ *Grupo registrado como destino de confesiones.*
` +
        `▸ ID: \`${chatId}\`
` +
        `Ahora usa *!confesiones abrir* para activar la dinámica.`,
    });
    return;
  }

  // !confesiones abrir
  if (sub === 'abrir') {
    const config = loadConfig();
    if (!config.grupo_id) {
      await sock.sendMessage(chatId, {
        text: `⚠️ Primero registra el grupo con *!confesiones grupo*`,
      });
      return;
    }
    config.activo = true;
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
    const config = loadConfig();
    config.activo = false;
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
    const config = loadConfig();
    const data   = loadData();
    let groupName = config.grupo_id || 'No configurado';
    if (config.grupo_id) {
      try { groupName = (await sock.groupMetadata(config.grupo_id)).subject || config.grupo_id; } catch (_) {}
    }
    await sock.sendMessage(chatId, {
      text:
        `🤫 *Estado del sistema de confesiones:*\n\n` +
        `▸ Grupo destino : ${groupName}\n` +
        `▸ Estado        : ${config.activo ? '✅ ACTIVO' : '🔒 CERRADO'}\n` +
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
      `!confesiones abrir   → activar + anunciar\n` +
      `!confesiones cerrar  → desactivar\n` +
      `!confesiones limpiar → borrar historial completo\n` +
      `!confesiones estado  → ver configuración`,
  });
}
