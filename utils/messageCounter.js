import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const STORAGE_PATH = path.resolve('./temp/message_counts.json');
const TEMP_PATH = STORAGE_PATH + '.tmp';

let store = {};
let dirty = false;
let flushInProgress = false;
const FLUSH_INTERVAL_MS = 1000; // flush each 1s

async function loadStore() {
  try {
    const raw = await fs.readFile(STORAGE_PATH, 'utf8');
    store = JSON.parse(raw || '{}');
  } catch (e) {
    store = {};
  }
}

async function flushStore() {
  if (!dirty || flushInProgress) return;
  flushInProgress = true;
  try {
    await fs.mkdir(path.dirname(STORAGE_PATH), { recursive: true });
    const data = JSON.stringify(store, null, 2);
    await fs.writeFile(TEMP_PATH, data, 'utf8');
    await fs.rename(TEMP_PATH, STORAGE_PATH);
    dirty = false;
  } catch (e) {
    // ignore but keep dirty flag so we retry later
  } finally {
    flushInProgress = false;
  }
}

// start background loader and flusher
loadStore().catch(() => {});
setInterval(() => flushStore().catch(() => {}), FLUSH_INTERVAL_MS);

// ensure flush on process exit where possible
process.on('beforeExit', () => {
  try { fsSync.writeFileSync(TEMP_PATH, JSON.stringify(store, null, 2), 'utf8'); fsSync.renameSync(TEMP_PATH, STORAGE_PATH); } catch (e) {}
});

export async function incrementCount(chatId, jid, messageText = '') {
  if (!chatId || !jid) return;
  if (!store[chatId]) store[chatId] = {};
  const prevObj = store[chatId][jid] || { count: 0, lastMessage: '', lastTs: 0 };
  const now = Date.now();
  store[chatId][jid] = {
    count: (prevObj.count || 0) + 1,
    lastMessage: (messageText && messageText.toString().slice(0, 200)) || prevObj.lastMessage || '',
    lastTs: now,
    baseline: prevObj.baseline || 0
  };
  dirty = true;
  return;
}

export async function getCounts(chatId) {
  return store[chatId] || {};
}

export async function setBaseline(chatId, jid) {
  if (!chatId || !jid) return;
  if (!store[chatId]) store[chatId] = {};
  if (!store[chatId][jid]) store[chatId][jid] = { count: 0, lastMessage: '', lastTs: 0 };
  const cur = store[chatId][jid];
  cur.baseline = cur.count || 0;
  dirty = true;
}

export async function getCountsSinceBaseline(chatId) {
  const group = store[chatId] || {};
  const result = {};
  for (const jid of Object.keys(group)) {
    const v = group[jid] || {};
    const baseline = v.baseline || 0;
    const count = v.count || 0;
    result[jid] = {
      countSinceJoin: Math.max(0, count - baseline),
      total: count,
      lastMessage: v.lastMessage || '',
      lastTs: v.lastTs || 0
    };
  }
  return result;
}

export async function resetCounts(chatId) {
  delete store[chatId];
  dirty = true;
}

export async function getAllChats() {
  return Object.keys(store || {});
}

export async function clearAll() {
  store = {};
  dirty = true;
  await flushStore();
}

export default { incrementCount, getCounts, resetCounts, getAllChats, clearAll };
