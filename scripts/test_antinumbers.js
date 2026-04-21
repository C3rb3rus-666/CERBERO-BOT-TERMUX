#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// test_antinumbers.js — Prueba seca (dry-run) del filtro CERBERO · AEGIS
//
// USO:
//   node scripts/test_antinumbers.js
//   node scripts/test_antinumbers.js --extra 573001234567 12025551234
//
// NO conecta a WhatsApp. NO expulsa a nadie.
// Lee el JSON real de configuración (blacklist/whitelist).
// Imprime el veredicto por cada número.
// ─────────────────────────────────────────────────────────────────────────────

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const CONFIG_PATH = path.join(__dirname, '..', 'comandos_cerbero', 'configuraciones', 'antinumbers_config.json')

// ── Colores ANSI ──────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
  bgRed:  '\x1b[41m',
  bgGreen:'\x1b[42m',
}

// ── Prefijos permitidos (igual que anti_numbers.js) ───────────────────────────
const allowedPrefixes = new Set([
  '1',
  '52','53',
  '54','55','56','57','58','51',
  '591','592','593','594','595','596','597','598','599',
  '502','503','504','505','506','507',
  '34'
])

const PAIS = {
  '1':   'USA/Canadá', '34': 'España',
  '51':  'Perú',       '52': 'México',    '53': 'Cuba',
  '54':  'Argentina',  '55': 'Brasil',    '56': 'Chile',
  '57':  'Colombia',   '58': 'Venezuela',
  '591': 'Bolivia',    '592': 'Guyana',   '593': 'Ecuador',
  '594': 'G.Francesa', '595': 'Paraguay', '596': 'Martinica',
  '597': 'Surinam',    '598': 'Uruguay',  '599': 'Antillas',
  '502': 'Guatemala',  '503': 'El Salvador','504': 'Honduras',
  '505': 'Nicaragua',  '506': 'Costa Rica','507': 'Panamá',
}

function extractCountryCode(phone) {
  if (!phone) return null
  const three = ['591','592','593','594','595','596','597','598','599','502','503','504','505','506','507']
  for (const c of three) if (phone.startsWith(c)) return c
  const two = ['34','51','52','53','54','55','56','57','58','59']
  for (const c of two) if (phone.startsWith(c)) return c
  if (phone.startsWith('1')) return '1'
  return null
}

// ── Cargar config ─────────────────────────────────────────────────────────────
function cargarConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    const cfg = JSON.parse(raw)
    const toSet = (arr) => new Set(
      (Array.isArray(arr) ? arr : [])
        .map(e => typeof e === 'string' ? e.trim() : String(e?.numero || '').trim())
        .filter(Boolean)
    )
    const toMap = (arr) => {
      const m = new Map()
      if (!Array.isArray(arr)) return m
      for (const e of arr) {
        if (typeof e === 'string') m.set(e.trim(), '')
        else if (e?.numero)        m.set(String(e.numero).trim(), e.nota || '')
      }
      return m
    }
    return { blacklist: toMap(cfg.blacklist), whitelist: toMap(cfg.whitelist) }
  } catch (e) {
    console.error(`${C.red}❌ No se pudo leer ${CONFIG_PATH}: ${e.message}${C.reset}`)
    return { blacklist: new Map(), whitelist: new Map() }
  }
}

// ── Evaluar un número ─────────────────────────────────────────────────────────
function evaluar(phone, blacklist, whitelist) {
  const code    = extractCountryCode(phone)
  const pais    = PAIS[code] || `+${code || '?'}`
  const allowed = code ? allowedPrefixes.has(code) : false

  if (whitelist.has(phone)) {
    return { veredicto: 'WHITELIST', color: C.cyan, accion: 'permitido (protegido)', code, pais, nota: whitelist.get(phone) }
  }
  if (blacklist.has(phone)) {
    return { veredicto: 'BLACKLIST', color: C.red, accion: 'EXPULSADO', code, pais, nota: blacklist.get(phone) }
  }
  if (!allowed) {
    return { veredicto: 'GEO-LOCK', color: C.yellow, accion: 'EXPULSADO', code: code || '???', pais, nota: '' }
  }
  return { veredicto: 'PERMITIDO', color: C.green, accion: 'permitido', code, pais, nota: '' }
}

// ── Números de ejemplo tomados de logs reales + extra por CLI ─────────────────
const NUMEROS_TEST = [
  // Del console.log del bot (sesión real):
  { num: '5213318564947',  desc: 'México (log real)' },
  { num: '34614493967',    desc: 'España (log real)' },
  { num: '18085903322',    desc: 'USA Hawaii (log real)' },
  { num: '59160874735',    desc: 'Bolivia (log real)' },
  { num: '573233704652',   desc: 'Colombia (owner whitelist)' },
  { num: '573133675695',   desc: 'Colombia (blacklist spam)' },
  { num: '5491123456789',  desc: 'Argentina (blacklist bot)' },
  // Zonas NO permitidas:
  { num: '447911123456',   desc: 'Reino Unido +44' },
  { num: '8613912345678',  desc: 'China +86' },
  { num: '917012345678',   desc: 'India +91' },
  { num: '4915212345678',  desc: 'Alemania +49' },
  { num: '971501234567',   desc: 'Emiratos +971' },
]

// Añadir números extra pasados por CLI: node test_antinumbers.js --extra 123 456
const extraIdx = process.argv.indexOf('--extra')
if (extraIdx !== -1) {
  for (const n of process.argv.slice(extraIdx + 1)) {
    NUMEROS_TEST.push({ num: n.replace(/\D/g, ''), desc: 'CLI extra' })
  }
}

// ── Ejecutar ──────────────────────────────────────────────────────────────────
const { blacklist, whitelist } = cargarConfig()

console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════╗${C.reset}`)
console.log(`${C.bold}${C.cyan}║    🛡️  CERBERO · AEGIS — DRY-RUN TEST                ║${C.reset}`)
console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════╝${C.reset}`)
console.log(`${C.dim}   Config: ${CONFIG_PATH}${C.reset}`)
console.log(`${C.dim}   Blacklist: ${blacklist.size} · Whitelist: ${whitelist.size}${C.reset}\n`)

const COL = { num: 20, pais: 16, veredicto: 11, desc: 28 }
const header =
  `${'NÚMERO'.padEnd(COL.num)} ${'PAÍS'.padEnd(COL.pais)} ${'VEREDICTO'.padEnd(COL.veredicto)} ${'DESCRIPCIÓN'.padEnd(COL.desc)} NOTA`
console.log(`${C.bold}${C.white}  ${header}${C.reset}`)
console.log(`  ${'─'.repeat(85)}`)

let expulsados = 0, permitidos = 0

for (const { num, desc } of NUMEROS_TEST) {
  const r = evaluar(num, blacklist, whitelist)
  const icon = r.veredicto === 'PERMITIDO'  ? '✅' :
               r.veredicto === 'WHITELIST'  ? '🔵' :
               r.veredicto === 'BLACKLIST'  ? '⛔' : '🚫'
  const fNum  = `+${num}`.padEnd(COL.num)
  const fPais = r.pais.padEnd(COL.pais)
  const fVerd = r.veredicto.padEnd(COL.veredicto)
  const fDesc = desc.padEnd(COL.desc)
  const nota  = r.nota ? `← ${r.nota}` : ''
  console.log(`  ${icon} ${r.color}${C.bold}${fNum}${C.reset} ${C.dim}${fPais}${C.reset} ${r.color}${fVerd}${C.reset} ${C.dim}${fDesc}${C.reset} ${C.yellow}${nota}${C.reset}`)

  if (r.accion === 'EXPULSADO') expulsados++
  else permitidos++
}

console.log(`\n  ${'─'.repeat(85)}`)
console.log(`  ${C.bold}Resultado: ${C.green}${permitidos} permitidos${C.reset}  ${C.bold}${C.red}${expulsados} expulsados${C.reset}`)
console.log(`\n  ${C.dim}⚠️  Prueba seca — nadie fue expulsado de WhatsApp.${C.reset}\n`)
