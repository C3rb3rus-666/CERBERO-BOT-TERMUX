import { promisify } from 'util'
import { jidDecode } from '@whiskeysockets/baileys'

const delay = promisify(setTimeout)

// Prefijos permitidos
const allowedPrefixes = new Set([
  "1", "52", "53", "54", "55", "56", "57", "58", "51", "591", "592", 
  "593", "594", "595", "596", "597", "598", "599", "502", "503", 
  "504", "505", "506", "507", "34"
])

// Listas
const blacklist = new Set([
  "573133675695",
  "5491123456789",
  "5215513485505"
])

const whitelist = new Set([
  "573233704652"
])

// 🔑 Normaliza JIDs con lid → jid normal
function normalizeJid(jid) {
  if (jid.endsWith('@lid')) {
    const decoded = jidDecode(jid)
    if (decoded?.user) {
      return `${decoded.user}@s.whatsapp.net`
    }
  }
  return jid
}

// Extraer código de país
function extractCountryCode(phoneNumber) {
  if (!phoneNumber) return null

  const threeDigitCodes = [
    "591","592","593","594","595","596","597","598","599",
    "502","503","504","505","506","507"
  ]
  for (const code of threeDigitCodes) {
    if (phoneNumber.startsWith(code)) return code
  }

  const twoDigitCodes = ["34","51","52","53","54","55","56","57","58","59"]
  for (const code of twoDigitCodes) {
    if (phoneNumber.startsWith(code)) return code
  }

  if (phoneNumber.startsWith('1')) return '1'

  return null
}

function hasAllowedPrefix(phoneNumber) {
  const countryCode = extractCountryCode(phoneNumber)
  return countryCode ? allowedPrefixes.has(countryCode) : false
}

export async function filtrarParticipantes(sock, message, groupMetadata) {
  if (!message.key.remoteJid.endsWith('@g.us')) return

  try {
    const chatId = message.key.remoteJid
    const participants = groupMetadata.participants
    const removedParticipants = []

    console.log(`🔍 Escaneando ${participants.length} participantes en ${chatId}...`)

    for (const participant of participants) {
      let participantJid = participant.id
      const originalJid = participantJid

      // Normalizar JID
      participantJid = normalizeJid(participantJid)

      // Obtener número real
      const realPhoneNumber = participantJid.split('@')[0]

      // Debug en consola
      console.log(`\n📌 Participante detectado:`)
      console.log(`   - JID original: ${originalJid}`)
      console.log(`   - JID normalizado: ${participantJid}`)
      console.log(`   - Número: ${realPhoneNumber}`)

      if (!realPhoneNumber) {
        console.log(`❓ No se pudo obtener número para: ${participantJid}`)
        continue
      }

      // Proteger whitelist
      if (whitelist.has(realPhoneNumber)) {
        console.log(`⚠️ ${realPhoneNumber} está en whitelist, no se toca.`)
        continue
      }

      // Proteger admins
      if (participant.admin === 'admin' || participant.admin === 'superadmin') {
        console.log(`⚠️ ${realPhoneNumber} es admin, no se expulsa.`)
        continue
      }

      // Validaciones
      const countryCode = extractCountryCode(realPhoneNumber)
      const hasValidPrefix = hasAllowedPrefix(realPhoneNumber)
      const isBlacklisted = blacklist.has(realPhoneNumber)

      console.log(`   - Código país: ${countryCode}`)
      console.log(`   - Prefijo permitido: ${hasValidPrefix}`)
      console.log(`   - En blacklist: ${isBlacklisted}`)

      // EXPULSAR SI: no tiene prefijo permitido O está en blacklist
      if (!hasValidPrefix || isBlacklisted) {
        try {
          await sock.groupParticipantsUpdate(chatId, [participantJid], 'remove')
          removedParticipants.push(`${realPhoneNumber} (${countryCode || '?'})`)
          console.log(`❌ Expulsado: ${realPhoneNumber} - Razón: ${isBlacklisted ? 'BLACKLIST' : 'REGION NO PERMITIDA'}`)
          await delay(2000)
        } catch (err) {
          if (err?.message?.includes('rate-overlimit')) {
            console.log(`⏳ Rate limit, esperando 30 segundos...`)
            await delay(30000)
          } else if (err?.message?.includes('not-authorized')) {
            console.log(`🚫 El bot NO es admin, no puede expulsar.`)
            break
          } else {
            console.error(`⚠️ Error expulsando: ${err?.message || err}`)
          }
        }
      } else {
        console.log(`✅ ${realPhoneNumber} permitido (${countryCode}).`)
      }
    }

    // Enviar reporte
    if (removedParticipants.length > 0) {
      const messageText =
        `🚨 [𝐂𝐄𝐑𝐁𝐄𝐑𝐎-𝐅𝐈𝐑𝐄𝐖𝐀𝐋𝐋 𝐀𝐂𝐓𝐈𝐕𝐎] 🚨\n\n` +
        `🛑 *Intrusos detectados y neutralizados:*\n` +
        `> ${removedParticipants.join('\n> ')}\n\n` +
        `💀 *Acceso denegado* \n` +
        `🔒 Protocolo: *${removedParticipants.some(p => blacklist.has(p)) ? 'BLACKLIST' : 'REGION NO PERMITIDA'}*\n` +
        `🌍 Regiones permitidas: *Latinoamérica, Norteamérica, España*`

      await sock.sendMessage(chatId, { text: messageText })
    }

    console.log(`\n✅ Escaneo completado. Expulsados: ${removedParticipants.length}`)
  } catch (error) {
    console.error('❌ Error en filtro antinumbers:', error)
  }
}
