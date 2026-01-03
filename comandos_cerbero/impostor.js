// Juego "Impostor" (versión limpia)

const games = {}; // estado por chatId

import fs from 'fs';
import path from 'path';

const WORDS_FILE = path.resolve(process.cwd(), 'comandos_cerbero', 'configuraciones', 'impostor_words.json');

// Configuración de seguridad para evitar envíos masivos
const MAX_PRIVATE_DMS = 50; // si hay más jugadores, no enviaremos DMs automáticamente
const PRIVATE_DM_DELAY = 2000; // ms entre DMs privados

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Cargar el listado de palabras desde archivo (si existe) o usar la lista por defecto.
let WORDS = [
  'pizza','playa','dragón','gato','escuela','música','árbol','teléfono','película','café','montaña',
  'libro','fútbol','casa','planta','bosque','comida','tren','barco','sol'
];

function loadWordsFromFile() {
  try {
    if (fs.existsSync(WORDS_FILE)) {
      const raw = fs.readFileSync(WORDS_FILE, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        // Normalizar: trim, lowercase y eliminar diacríticos
        const normalized = arr.map(w => {
          if (typeof w !== 'string') return '';
          return w.trim().toLowerCase().normalize('NFD').replace(/\u0300-\u036f/g, '').replace(/[\u0300-\u036f]/g, '');
        }).map(s => s.replace(/[^a-z0-9ñ\s'-]/gi, '').trim())
          .filter(Boolean)
          .filter(s => s.length >= 2 && s.length <= 40);

        // Eliminar duplicados preservando orden
        const unique = Array.from(new Set(normalized));
        const removed = normalized.length - unique.length;
        WORDS = unique;
        console.log(`Impostor: cargadas ${WORDS.length} palabras desde configuraciones/impostor_words.json (duplicados eliminados: ${removed})`);
        return;
      }
    }
  } catch (e) {
    console.error('Error cargando impostor_words.json:', e && e.message ? e.message : e);
  }
  // Si falla la lectura, se usa la lista por defecto (WORDS ya contiene defaults)
}

// Cargar en el arranque
loadWordsFromFile();

function pickWord(provided) {
  if (provided && typeof provided === 'string' && provided.trim()) return provided.trim().toLowerCase();
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

function getJid(part) {
  if (!part) return null;
  if (typeof part === 'string') return part;
  if (part.id) return part.id;
  return String(part);
}

async function helpImpostor(sock, message) {
  const chatId = message.key.remoteJid;
  const helpText = `🎮 IMPOSTOR - Ayuda

Uso básico:
• !impostor iniciar [palabraOpcional] — Inicia una partida (se usan los participantes del grupo)
• !impostor pista <texto> — Envía tu pista para la ronda (no digas la palabra)
• !impostor acusar @usuario — Acusar a un jugador (mención recomendada)
• !impostor adivinar <palabra> — Solo el impostor puede intentar adivinar
• !impostor terminar — Forzar final de la partida
• !impostor estado — Muestra estado actual
• !impostor palabra — Muestra una palabra de ejemplo (útil para pruebas)
• !impostor ayuda — Muestra esta ayuda

(Se aceptan también los comandos en inglés: start|clue|accuse|guess|end|status|help)

Información adicional:
• Lista de palabras cargada desde: ` + (fs.existsSync(WORDS_FILE) ? 'configuraciones/impostor_words.json' : 'lista interna') + `
• Total de palabras disponibles: ${WORDS.length}

Reglas:
- Nadie debe decir la palabra exacta en la pista.
- El impostor no conoce la palabra y debe fingir con pistas genéricas.
`;
  await sock.sendMessage(chatId, { text: helpText }, { quoted: message });
}

export async function startImpostor(sock, message, groupMetadata, args) {
  const chatId = message.key.remoteJid;
  if (games[chatId]) {
    await sock.sendMessage(chatId, { text: 'Ya hay una partida activa en este grupo. Usa !impostor terminar para finalizarla (alias: !impostor end).' }, { quoted: message });
    return;
  }

  // Obtener participantes
  let participants = [];
  try {
    participants = (groupMetadata && groupMetadata.participants) ? groupMetadata.participants : (await sock.groupMetadata(chatId)).participants;
  } catch (e) {
    console.log('No se pudo obtener participants desde groupMetadata:', e && e.message ? e.message : e);
  }

  const jids = [...new Set(participants.map(p => getJid(p)).filter(Boolean))];
  const botJid = (sock && sock.user && sock.user.id) ? sock.user.id : null;
  // Impostor game removed — stub to avoid import errors if referenced elsewhere.
  console.warn('Impostor module loaded: game removed for safety.');
}

export default {};
