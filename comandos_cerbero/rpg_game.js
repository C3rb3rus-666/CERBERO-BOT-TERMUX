import fs from 'fs';
import path from 'path';

const HISTORIA_FILE = path.resolve('./historia.json');
const PROGRESO_FILE = path.resolve('./progreso.json');

let historia = {};
let progreso = {};

// Cargar archivos
function loadFiles() {
  if (fs.existsSync(HISTORIA_FILE)) historia = JSON.parse(fs.readFileSync(HISTORIA_FILE));
  if (fs.existsSync(PROGRESO_FILE)) progreso = JSON.parse(fs.readFileSync(PROGRESO_FILE));
}
function saveProgreso() {
  fs.writeFileSync(PROGRESO_FILE, JSON.stringify(progreso, null, 2));
}

function getPlayer(id) {
  if (!progreso[id]) {
    progreso[id] = {
      capitulo: 0,
      escena: 0,
      hambre: 50,
      sueño: 50,
      energia: 100,
      salud: 100,
      dinero: 100,
      inventario: [],
      estado: 'activo',
    };
    saveProgreso();
  }
  return progreso[id];
}

// Simulación de desgaste
function deterioroEstado(jugador) {
  jugador.hambre += 5;
  jugador.sueño += 5;
  jugador.energia -= 10;
  if (jugador.hambre >= 100 || jugador.sueño >= 100 || jugador.energia <= 0) {
    jugador.salud -= 10;
  }
  if (jugador.salud <= 0) {
    jugador.estado = 'muerto';
    jugador.capitulo = 0;
    jugador.escena = 0;
    jugador.hambre = 50;
    jugador.sueño = 50;
    jugador.energia = 100;
    jugador.salud = 100;
    jugador.dinero = 0;
    jugador.inventario = [];
  }
}

// Comando para avanzar automáticamente según historia.json
export async function comandoHistoria(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  loadFiles();
  const jugador = getPlayer(id);

  if (jugador.estado === 'muerto') {
    await sock.sendMessage(msg.key.remoteJid, { text: '☠️ Has muerto. Tu historia ha sido reiniciada desde cero.' }, { quoted: msg });
    saveProgreso();
    return;
  }

  deterioroEstado(jugador);

  const cap = historia.capitulos[jugador.capitulo];
  if (!cap) {
    await sock.sendMessage(msg.key.remoteJid, { text: '📚 Aún no hay más historia disponible.' }, { quoted: msg });
    return;
  }

  const escena = cap.escenas[jugador.escena];
  if (!escena) {
    jugador.capitulo++;
    jugador.escena = 0;
    saveProgreso();
    await comandoHistoria(sock, msg);
    return;
  }

  jugador.escena++;
  saveProgreso();

  let texto = `📖 *Capítulo ${jugador.capitulo + 1}, Escena ${jugador.escena}*\n\n${escena.texto}`;

  if (escena.encuentro_c3rb3rus) {
    texto += `\n\n👁 Encuentro con *C3rb3rus-666*... (evento especial)`;
    // Aquí puedes agregar lógica de premios o castigos según JSON
  }

  await sock.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg });
}

// 📥 Estado del jugador
export async function comandoInventarioHistoria(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  loadFiles();
  const jugador = getPlayer(id);

  const texto = `🎒 Estado actual:\n` +
    `🧠 Energía: ${jugador.energia}/100\n` +
    `😴 Sueño: ${jugador.sueño}/100\n` +
    `🍗 Hambre: ${jugador.hambre}/100\n` +
    `❤️ Salud: ${jugador.salud}/100\n` +
    `💰 Dinero: $${jugador.dinero}\n` +
    `� Inventario: ${jugador.inventario.join(', ') || 'Vacío'}\n` +
    `📍 Capítulo ${jugador.capitulo + 1}, Escena ${jugador.escena}`;

  await sock.sendMessage(msg.key.remoteJid, { text: texto }, { quoted: msg });
}

// 🛌 Dormir
export async function comandoDormir(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  loadFiles();
  const jugador = getPlayer(id);
  jugador.sueño = Math.max(0, jugador.sueño - 50);
  jugador.energia = Math.min(100, jugador.energia + 30);
  saveProgreso();
  await sock.sendMessage(msg.key.remoteJid, { text: '🛌 Dormiste y recuperaste energía. Zzz...' }, { quoted: msg });
}

// 🍽 Comer
export async function comandoComer(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  loadFiles();
  const jugador = getPlayer(id);
  jugador.hambre = Math.max(0, jugador.hambre - 40);
  jugador.energia = Math.min(100, jugador.energia + 10);
  saveProgreso();
  await sock.sendMessage(msg.key.remoteJid, { text: '🍽 Comiste algo y redujiste el hambre.' }, { quoted: msg });
}

// 💼 Trabajar
export async function comandoTrabajarHistoria(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  loadFiles();
  const jugador = getPlayer(id);

  if (jugador.energia < 20) {
    await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Estás demasiado cansado para trabajar.' }, { quoted: msg });
    return;
  }

  const ganancia = 50 + Math.floor(Math.random() * 100);
  jugador.dinero += ganancia;
  jugador.energia -= 20;
  jugador.hambre += 10;
  saveProgreso();

  await sock.sendMessage(msg.key.remoteJid, { text: `💼 Trabajaste y ganaste $${ganancia}. Tu energía bajó.` }, { quoted: msg });
}

// 🧘‍♂️ Descansar
export async function comandoDescansar(sock, msg) {
  const id = msg.key.participant || msg.key.remoteJid;
  loadFiles();
  const jugador = getPlayer(id);
  jugador.energia = Math.min(100, jugador.energia + 20);
  jugador.sueño = Math.max(0, jugador.sueño - 10);
  saveProgreso();
  await sock.sendMessage(msg.key.remoteJid, { text: '🧘‍♂️ Descansaste y recuperaste un poco de energía.' }, { quoted: msg });
}

// Carga inicial
loadFiles();

