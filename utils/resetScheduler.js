import fs from 'fs/promises';
import path from 'path';
import { clearAll } from './messageCounter.js';

const STATE_PATH = path.resolve('./temp/reset_state.json');
const COUNTS_PATH = path.resolve('./temp/message_counts.json');

async function loadState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (e) {
    return {};
  }
}

async function saveState(obj) {
  try {
    await fs.mkdir(path.dirname(STATE_PATH), { recursive: true });
    await fs.writeFile(STATE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {}
}

async function backupCounts() {
  try {
    await fs.mkdir(path.dirname(COUNTS_PATH), { recursive: true });
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const dest = path.resolve(`./temp/message_counts_backup_${stamp}.json`);
    try {
      const data = await fs.readFile(COUNTS_PATH, 'utf8');
      await fs.writeFile(dest, data, 'utf8');
    } catch (e) {
      // if no counts file, ignore
    }
  } catch (e) {}
}

export async function initResetScheduler() {
  // Ejecutar una comprobación inmediata y luego cada 6 horas
  try {
    await checkAndReset();
    setInterval(() => checkAndReset().catch(() => {}), 1000 * 60 * 60 * 6);
  } catch (e) {}
}

async function checkAndReset() {
  const now = new Date();
  const day = now.getDate();
  const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;

  const state = await loadState();
  if (state.lastReset === monthKey) return; // ya reseteado este mes

  if (day === 30) {
    // backup y limpiar
    await backupCounts();
    await clearAll();
    state.lastReset = monthKey;
    await saveState(state);
  }
}

export default { initResetScheduler };
