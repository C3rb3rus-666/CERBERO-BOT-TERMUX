import fs from 'fs';
import path from 'path';

const gamesPath = './comandos_cerbero/juegos/estado_ahorcado.json';

// Palabras para el juego
const PALABRA_LISTA = [
  'javascript', 'python', 'typescript', 'cerbero', 'whatsapp', 'bot', 'programador',
  'desarrollo', 'informatica', 'computadora', 'internet', 'servidor', 'cliente',
  'database', 'algoritmo', 'variable', 'funcion', 'objeto', 'array', 'matriz',
  'codigo', 'compilar', 'ejecutar', 'error', 'debug', 'terminal', 'comando',
  'archivo', 'carpeta', 'sistema', 'operativo', 'windows', 'linux', 'macos',
  'tecnologia', 'inteligencia', 'artificial', 'machine', 'learning', 'neural',
  'red', 'conexion', 'protocolo', 'http', 'https', 'socket', 'puerto',
  'cloud', 'docker', 'kubernetes', 'devops', 'agile', 'scrum', 'testing'
];

// Cargar estado del juego
function cargarEstado() {
  try {
    if (fs.existsSync(gamesPath)) {
      return JSON.parse(fs.readFileSync(gamesPath, 'utf-8'));
    }
  } catch (error) {
    console.error('Error al cargar estado del ahorcado:', error);
  }
  return {};
}

// Guardar estado del juego
function guardarEstado(estado) {
  try {
    const dir = path.dirname(gamesPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(gamesPath, JSON.stringify(estado, null, 2));
  } catch (error) {
    console.error('Error al guardar estado del ahorcado:', error);
  }
}

// Inicializar juego
function iniciarJuego(groupId) {
  const palabra = PALABRA_LISTA[Math.floor(Math.random() * PALABRA_LISTA.length)].toUpperCase();
  const estado = cargarEstado();
  
  estado[groupId] = {
    palabra,
    adivinadas: [],
    intentosFallidos: 0,
    maxIntentos: 6,
    activo: true,
    creador: Date.now()
  };
  
  guardarEstado(estado);
  return estado[groupId];
}

// Obtener estado del juego
function obtenerJuego(groupId) {
  const estado = cargarEstado();
  return estado[groupId] || null;
}

// Procesar adivinanza
function procesarAdivinanza(groupId, letra) {
  const estado = cargarEstado();
  const juego = estado[groupId];
  
  if (!juego || !juego.activo) {
    return { error: 'No hay juego activo', juego: null };
  }
  
  letra = letra.toUpperCase();
  
  if (juego.adivinadas.includes(letra)) {
    return { error: `La letra *${letra}* ya fue adivinada`, juego };
  }
  
  juego.adivinadas.push(letra);
  
  if (!juego.palabra.includes(letra)) {
    juego.intentosFallidos++;
  }
  
  // Verificar si ganó o perdió
  const palabraCompleta = juego.palabra.split('').every(l => juego.adivinadas.includes(l));
  const perdio = juego.intentosFallidos >= juego.maxIntentos;
  
  if (palabraCompleta) {
    juego.activo = false;
    juego.resultado = 'GANÓ';
  } else if (perdio) {
    juego.activo = false;
    juego.resultado = 'PERDIÓ';
  }
  
  estado[groupId] = juego;
  guardarEstado(estado);
  
  return { error: null, juego, palabraCompleta, perdio };
}

// Generar visual del juego
function generarVisual(juego) {
  const intentosRestantes = juego.maxIntentos - juego.intentosFallidos;
  const palabraEnmascarada = juego.palabra
    .split('')
    .map(letra => juego.adivinadas.includes(letra) ? letra : '_')
    .join(' ');
  
  const letraseidas = juego.adivinadas.join(', ') || 'ninguna';
  
  const hangman = [
    '╔════════════════╗',
    '║ AHORCADO 🔫    ║',
    '╠════════════════╣',
    `║ Palabra: ${palabraEnmascarada.padEnd(15)}║`,
    `║ Intentos: ${intentosRestantes}/6          ║`,
    `║ Letras: ${letraseidas.substring(0, 10).padEnd(8)}║`,
    '║                ║',
    '╚════════════════╝'
  ];
  
  return hangman.join('\n');
}

// Comando principal
export async function comandoAhorcado(sock, msg, args) {
  const chatId = msg.key.remoteJid;
  const subcomando = args[0]?.toLowerCase();
  
  let respuesta = '';
  
  if (!subcomando || subcomando === 'help') {
    respuesta = `
╔════════════════════════════════════════╗
║        🎮 AHORCADO - AYUDA 🎮          ║
╠════════════════════════════════════════╣
║ !ahorcado start  → Iniciar juego       ║
║ !ahorcado <letra> → Adivinar letra     ║
║ !ahorcado ver    → Ver estado actual   ║
║ !ahorcado stop   → Cancelar juego      ║
║                                        ║
║ 📝 Adivina la palabra antes que se     ║
║ acaben los intentos (máx 6 fallos)    ║
╚════════════════════════════════════════╝`;
  } 
  else if (subcomando === 'start') {
    const juego = iniciarJuego(chatId);
    respuesta = `
🎮 *JUEGO DE AHORCADO INICIADO* 🎮

${generarVisual(juego)}

💭 *Envía una letra para adivinar*
_Usa: !ahorcado <letra>_`;
  } 
  else if (subcomando === 'ver') {
    const juego = obtenerJuego(chatId);
    if (!juego) {
      respuesta = '❌ No hay juego activo. Inicia uno con: *!ahorcado start*';
    } else {
      respuesta = `${generarVisual(juego)}`;
    }
  } 
  else if (subcomando === 'stop') {
    const estado = cargarEstado();
    if (estado[chatId]) {
      estado[chatId].activo = false;
      guardarEstado(estado);
      respuesta = '🛑 Juego cancelado.';
    } else {
      respuesta = '❌ No hay juego activo.';
    }
  } 
  else if (subcomando.length === 1) {
    // Procesar letra
    const juego = obtenerJuego(chatId);
    if (!juego) {
      respuesta = '❌ No hay juego activo. Inicia uno con: *!ahorcado start*';
    } else {
      const { error, juego: juegoActualizado, palabraCompleta, perdio } = procesarAdivinanza(chatId, subcomando);
      
      if (error) {
        respuesta = `⚠️ ${error}`;
      } else {
        respuesta = `${generarVisual(juegoActualizado)}`;
        
        if (palabraCompleta) {
          respuesta += `\n\n🎉 *¡GANASTE!* 🎉\nLa palabra era: *${juegoActualizado.palabra}*`;
        } else if (perdio) {
          respuesta += `\n\n💀 *¡PERDISTE!* 💀\nLa palabra era: *${juegoActualizado.palabra}*`;
        }
      }
    }
  } 
  else {
    respuesta = '❌ Comando no reconocido. Usa: *!ahorcado help*';
  }
  
  await sock.sendMessage(chatId, { text: respuesta }, { quoted: msg });
}

export default comandoAhorcado;
