// anti_numbers.js — Filtro de región: solo LATAM, Norteamérica y España
// Coded by C3rb3rus-666
//
// LÓGICA DE NÚMEROS — basada en el console.log real del bot:
//   "19:59:28 | GRUP | Grupo >> @34614493967 (34614493967) : mensaje"
//    El número entre paréntesis viene de NUMBER@s.whatsapp.net
//    → participant.phoneNumber.split('@')[0]  = número real
//    → participant.id puede ser @lid (106949534314540@lid) ≠ teléfono, NUNCA usarlo
//
// BLACKLIST/WHITELIST: editar configuraciones/antinumbers_config.json
//   Formato número: sin +, sin espacios (igual al log)  ej: "34614493967"

import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const imagesDir   = path.join(__dirname, 'imagenes')
const CONFIG_PATH = path.join(__dirname, 'configuraciones', 'antinumbers_config.json')

const delay = promisify(setTimeout)

// ─── Anti-ban: delays seguros para no saturar la API de WhatsApp ─────────────
// Valores calculados para simular ritmo humano y evitar rate-limit
const DELAY_ENTRE_EXPULSIONES_MS  = 8_000   // 8 s entre cada kick dentro de un grupo
const DELAY_ENTRE_GRUPOS_MS       = 25_000  // 25 s entre grupo y grupo en el ciclo
const DELAY_RATELIMIT_MS          = 90_000  // 90 s de pausa si WhatsApp da rate-overlimit
const GRUPOS_POR_CICLO            = 3       // máx grupos a revisar por ciclo (no todos a la vez)

// Jitter: suma ±20 % aleatorio al delay para evitar patrón fijo detectable
const jitter = (ms) => ms + Math.floor((Math.random() - 0.5) * ms * 0.4)

// ─── Prefijos de país permitidos ─────────────────────────────────────────────
const allowedPrefixes = new Set([
  '1',                                         // USA, Canadá, Caribe
  '52', '53',                                  // México, Cuba
  '54', '55', '56', '57', '58',               // Argentina, Brasil, Chile, Colombia, Venezuela
  '51',                                        // Perú
  '591', '592', '593', '594', '595',          // Bolivia, Guyana, Ecuador, Guyana Francesa, Paraguay
  '596', '597', '598', '599',                 // Martinica, Surinam, Uruguay, Antillas
  '502', '503', '504', '505', '506', '507',   // Guatemala, El Salvador, Honduras, Nicaragua, Costa Rica, Panamá
  '34'                                         // España
])

// ─── Cargar listas desde JSON (recargable en caliente) ───────────────────────
// Acepta dos formatos:
//   [{numero: "34614493967", nota: "spam"}]   ← con descripción
//   ["34614493967"]                           ← lista simple
function cargarListas() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    const cfg = JSON.parse(raw)
    const toSet = (arr) => new Set(
      (Array.isArray(arr) ? arr : [])
        .map(e => typeof e === 'string' ? e.trim() : String(e?.numero || '').trim())
        .filter(Boolean)
    )
    return { blacklist: toSet(cfg.blacklist), whitelist: toSet(cfg.whitelist) }
  } catch (e) {
    console.error('[REGION] ⚠️ Error cargando antinumbers_config.json:', e.message)
    return { blacklist: new Set(), whitelist: new Set() }
  }
}

let { blacklist, whitelist } = cargarListas()
console.log(`[REGION] ✅ Listas cargadas — blacklist: ${blacklist.size}, whitelist: ${whitelist.size}`)

// ─── Intervalo del escáner periódico ─────────────────────────────────────────
let _intervaloId = null

// ─── Extraer número real de un objeto participante de Baileys ────────────────
// Misma lógica que el console.log de index.js:
//   addReal?.phoneNumber?.toString().split('@')[0]  →  número real
//   fallback: id @s.whatsapp.net (nunca @lid)
function phoneFromParticipant(p) {
  if (!p) return null
  if (p.phoneNumber && typeof p.phoneNumber === 'string') {
    const n = p.phoneNumber.split('@')[0].split(':')[0].replace(/\D/g, '')
    return n || null
  }
  const id = p.id || p.jid || ''
  if (id.includes('@s.whatsapp.net')) {
    return id.split('@')[0].split(':')[0].replace(/\D/g, '') || null
  }
  return null   // @lid = LID interno, no es teléfono
}

// ─── Buscar número real de un JID en el groupMetadata ────────────────────────
// Cuando index.js nos pasa un JID string, lo cruzamos con participants
// para obtener el phoneNumber real (igual que el console.log del bot)
function phoneFromJidInMeta(jid, metaParticipants) {
  if (!jid || !Array.isArray(metaParticipants)) return null
  const clean = jid.split('@')[0].split(':')[0]
  const found = metaParticipants.find(p =>
    (p.id || '').split('@')[0].split(':')[0] === clean ||
    (p.phoneNumber || '').split('@')[0] === clean
  )
  if (found) return phoneFromParticipant(found)
  if (jid.includes('@s.whatsapp.net')) return clean || null
  return null
}

// ─── Extraer código de país ───────────────────────────────────────────────────
function extractCountryCode(phone) {
  if (!phone) return null
  const three = ['591','592','593','594','595','596','597','598','599','502','503','504','505','506','507']
  for (const c of three) if (phone.startsWith(c)) return c
  const two = ['34','51','52','53','54','55','56','57','58','59']
  for (const c of two) if (phone.startsWith(c)) return c
  if (phone.startsWith('1')) return '1'
  return null
}

function isAllowedPhone(phone) {
  const code = extractCountryCode(phone)
  return code ? allowedPrefixes.has(code) : false
}

// ─── Imagen aleatoria (estilo CERBERO-BOT) ───────────────────────────────────
function randomImage() {
  try {
    const files = fs.readdirSync(imagesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f))
    if (!files.length) return null
    return path.join(imagesDir, files[Math.floor(Math.random() * files.length)])
  } catch (_) { return null }
}

function buildAvisoTexto(phone, countryCode, razon) {
  const protocolo = razon === 'BLACKLIST'
    ? '�� VECTOR RESTRINGIDO'
    : '🔒 ZONA EXCLUIDA'
  return (
    `╔═══[ 🛡️ *CERBERO · AEGIS* ]═══╗\n` +
    `║\n` +
    `║  ⛔ *ACCESO DENEGADO*\n` +
    `║  ─────────────────────────────\n` +
    `║  📡 *Objetivo*  : +${phone}\n` +
    `║  🌐 *Región*    : +${countryCode || '???'}\n` +
    `║  �� *Protocolo* : ${protocolo}\n` +
    `║  ─────────────────────────────\n` +
    `║\n` +
    `║   〔 *Coded by c3rb3rus-666* 〕\n` +
    `╚═══════════════════════════════╝`
  )
}

async function enviarAviso(sock, chatId, texto) {
  try {
    await sock.sendPresenceUpdate('composing', chatId)
    const img = randomImage()
    if (img) {
      await sock.sendMessage(chatId, { image: { url: img }, caption: texto })
    } else {
      await sock.sendMessage(chatId, { text: texto })
    }
  } catch (e) {
    console.error('[REGION] Error enviando aviso:', e.message)
  }
}

// ─── VERIFICACIÓN INSTANTÁNEA al unirse ──────────────────────────────────────
export async function verificarParticipanteNuevo(sock, chatId, participantJid) {
  try {
    const meta  = await sock.groupMetadata(chatId)
    const phone = phoneFromJidInMeta(participantJid, meta.participants)

    if (!phone) {
      console.log(`[REGION] ⚠️ No se pudo resolver número de ${participantJid} — omitiendo.`)
      return
    }

    console.log(`[REGION] 🔍 Nuevo miembro: +${phone}`)

    if (whitelist.has(phone)) {
      console.log(`[REGION] ✅ +${phone} en whitelist — permitido.`)
      return
    }

    // Proteger admins
    const pObj = meta.participants.find(p =>
      (p.id || '').split('@')[0].split(':')[0] === participantJid.split('@')[0].split(':')[0] ||
      (p.phoneNumber || '').split('@')[0] === phone
    )
    if (pObj?.admin === 'admin' || pObj?.admin === 'superadmin') {
      console.log(`[REGION] ✅ +${phone} es admin — no se expulsa.`)
      return
    }

    const code       = extractCountryCode(phone)
    const allowed    = isAllowedPhone(phone)
    const blacklisted = blacklist.has(phone)

    console.log(`[REGION]   Código: +${code || '?'} | Permitido: ${allowed} | Blacklist: ${blacklisted}`)

    if (!allowed || blacklisted) {
      const razon = blacklisted ? 'BLACKLIST' : 'GEO-LOCK'
      console.log(`[REGION] ❌ Expulsando +${phone} — ${razon}`)
      try {
        await sock.groupParticipantsUpdate(chatId, [participantJid], 'remove')
      } catch (e) {
        console.error('[REGION] Error expulsando:', e.message)
        return
      }
      await enviarAviso(sock, chatId, buildAvisoTexto(phone, code, razon))
    } else {
      console.log(`[REGION] ✅ +${phone} permitido (+${code}).`)
    }
  } catch (err) {
    console.error('[REGION] Error en verificarParticipanteNuevo:', err.message)
  }
}

// ─── ESCANEO COMPLETO de un grupo ────────────────────────────────────────────
export async function escanearGrupoRegion(sock, chatId) {
  try {
    const meta         = await sock.groupMetadata(chatId)
    const participants = meta.participants || []
    const expulsados   = []

    console.log(`[REGION] 📋 Escaneo: ${participants.length} miembros en "${meta.subject}"`)

    for (const p of participants) {
      if (p.admin === 'admin' || p.admin === 'superadmin') continue

      const phone = phoneFromParticipant(p)
      if (!phone) {
        console.log(`[REGION] ⚠️ Sin número real para ${p.id} — omitiendo.`)
        continue
      }

      if (whitelist.has(phone)) continue

      const code       = extractCountryCode(phone)
      const allowed    = isAllowedPhone(phone)
      const blacklisted = blacklist.has(phone)

      if (!allowed || blacklisted) {
        const razon = blacklisted ? 'BLACKLIST' : `GEO-LOCK (+${code || '?'})`
        console.log(`[REGION] ❌ Escaneo — expulsando +${phone} (${razon})`)

        const jidParaExpulsar = (p.phoneNumber && p.phoneNumber.includes('@s.whatsapp.net'))
          ? p.phoneNumber
          : p.id

        try {
          await sock.groupParticipantsUpdate(chatId, [jidParaExpulsar], 'remove')
          expulsados.push(`+${phone} — ${razon}`)
          const waitMs = jitter(DELAY_ENTRE_EXPULSIONES_MS)
          console.log(`[REGION] ⏳ Pausa anti-ban: ${(waitMs/1000).toFixed(1)}s`)
          await delay(waitMs)
        } catch (e) {
          if (e?.message?.includes('not-authorized')) {
            console.log('[REGION] Bot no es admin, omitiendo grupo.')
            break
          }
          if (e?.message?.includes('rate-overlimit')) {
            console.log(`[REGION] 🚨 Rate-limit de WhatsApp — pausando ${DELAY_RATELIMIT_MS/1000}s`)
            await delay(DELAY_RATELIMIT_MS)
          }
          console.error('[REGION] Error expulsando en escaneo:', e.message)
        }
      } else {
        console.log(`[REGION] ✅ +${phone} permitido (+${code}).`)
      }
    }

    if (expulsados.length > 0) {
      const txt =
        `╔═══[ 🛡️ *CERBERO · AEGIS* ]═══╗\n` +
        `║\n` +
        `║  �� *PURGA PERIMETRAL*\n` +
        `║  ─────────────────────────────\n` +
        `║  📋 *Neutralizados:*\n` +
        expulsados.map(e => `║   ◈ ${e}`).join('\n') + '\n' +
        `║\n` +
        `║   〔 *Coded by c3rb3rus-666* 〕\n` +
        `╚═══════════════════════════════╝`
      await enviarAviso(sock, chatId, txt)
    }

    console.log(`[REGION] ✅ Completado en "${meta.subject}". Expulsados: ${expulsados.length}`)
  } catch (err) {
    console.error(`[REGION] Error escaneo en ${chatId}:`, err.message)
  }
}

// ─── ESCÁNER PERIÓDICO (cada 5 minutos) ──────────────────────────────────────
export function iniciarEscaneoPeriodicoRegion(sock) {
  if (_intervaloId) clearInterval(_intervaloId)

  const INTERVALO_MS = 20 * 60 * 1000
  console.log(`[REGION] 🕐 Escáner periódico iniciado (cada 20 min, máx ${GRUPOS_POR_CICLO} grupos/ciclo).`)

  // Índice rotativo: cada ciclo escanea el siguiente lote de grupos (no todos a la vez)
  let _cicloOffset = 0

  _intervaloId = setInterval(async () => {
    // Recargar listas en cada ciclo (detecta cambios en el JSON sin reiniciar)
    const listas = cargarListas()
    blacklist = listas.blacklist
    whitelist = listas.whitelist

    try {
      const grupos = await sock.groupFetchAllParticipating()
      const ids    = Object.keys(grupos)

      // Tomar solo GRUPOS_POR_CICLO grupos a partir del offset rotativo
      const lote = ids.slice(_cicloOffset, _cicloOffset + GRUPOS_POR_CICLO)
      _cicloOffset = (_cicloOffset + GRUPOS_POR_CICLO) % Math.max(ids.length, 1)

      console.log(`[REGION] 🔄 Ciclo periódico — lote ${lote.length}/${ids.length} grupos (offset ${_cicloOffset}).`)

      for (const chatId of lote) {
        await escanearGrupoRegion(sock, chatId)
        const waitMs = jitter(DELAY_ENTRE_GRUPOS_MS)
        console.log(`[REGION] ⏳ Pausa entre grupos: ${(waitMs/1000).toFixed(1)}s`)
        await delay(waitMs)
      }
    } catch (err) {
      console.error('[REGION] Error en ciclo periódico:', err.message)
    }
  }, INTERVALO_MS)

  return _intervaloId
}

export function detenerEscaneoRegion() {
  if (_intervaloId) {
    clearInterval(_intervaloId)
    _intervaloId = null
    console.log('[REGION] Escáner periódico detenido.')
  }
}

// ─── Compatibilidad con llamadas antiguas ─────────────────────────────────────
export async function filtrarParticipantes(sock, message, groupMetadata) {
  const chatId = message?.key?.remoteJid
  if (!chatId) return
  await escanearGrupoRegion(sock, chatId)
}
