const CMD_ACTIVITY_WINDOW_MS = Number(process.env.CERBERO_CMD_ACTIVITY_WINDOW_MS || 60_000);
const CMD_MAX_DYNAMIC_DELAY_MS = Number(process.env.CERBERO_CMD_MAX_DYNAMIC_DELAY_MS || 60_000);
const CMD_GROUP_ACTIVITY_HIGH_WATERMARK = Number(process.env.CERBERO_CMD_GROUP_ACTIVITY_HIGH_WATERMARK || 20);
const CMD_QUEUE_PRESSURE_HIGH_WATERMARK = Number(process.env.CERBERO_CMD_QUEUE_PRESSURE_HIGH_WATERMARK || 100);
const CMD_SOFT_PENDING_LIMIT = Number(process.env.CERBERO_CMD_QUEUE_SOFT_LIMIT || 150);
const ADMIN_PRIORITY_COMMANDS = new Set([
  'ban', 'kick', 'promote', 'demote',
  'antilink', 'bienvenida', 'vigilar',
  'todos', 'tag_group', 'tag', 'admins',
  'grupo', 'leerlog', 'clear_log', 'antistatustag',
  'status_cerbero', 'statuscerbero', 'bot_join', 'nuevos',
  'actividad', 'bateria', 'bateria_defensa',
  'autonomo', 'autoadmin', 'admin_autonomo'
]);

const highPriorityQueue = [];
const normalPriorityQueue = [];
let isQueueWorkerRunning = false;
let pendingCommands = 0;
let sequence = 0;
let maxObservedPending = 0;
const commandActivityByChat = new Map();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanupAndCountRecent(chatId, now = Date.now()) {
  if (!chatId) return 0;
  const current = commandActivityByChat.get(chatId) || [];
  const recent = current.filter(ts => now - ts <= CMD_ACTIVITY_WINDOW_MS);
  commandActivityByChat.set(chatId, recent);
  return recent.length;
}

function registerCommandActivity(chatId, now = Date.now()) {
  if (!chatId) return 0;
  const current = commandActivityByChat.get(chatId) || [];
  const recent = current.filter(ts => now - ts <= CMD_ACTIVITY_WINDOW_MS);
  recent.push(now);
  commandActivityByChat.set(chatId, recent);
  return recent.length;
}

function clamp01(value) {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function computeDynamicDelayMs(chatId) {
  const now = Date.now();
  const groupActivity = cleanupAndCountRecent(chatId, now);
  const queueDepth = pendingCommands;

  const groupFactor = clamp01(groupActivity / Math.max(1, CMD_GROUP_ACTIVITY_HIGH_WATERMARK));
  const queueFactor = clamp01(queueDepth / Math.max(1, CMD_QUEUE_PRESSURE_HIGH_WATERMARK));

  const groupDelay = Math.floor(groupFactor * 40_000);
  const queueDelay = Math.floor(queueFactor * 20_000);
  const delayMs = Math.min(CMD_MAX_DYNAMIC_DELAY_MS, groupDelay + queueDelay);

  return Math.max(0, delayMs);
}

function isPriorityTask(meta = {}) {
  if (meta?.priority === 'high') return true;
  const command = String(meta?.command || '').toLowerCase();
  return Boolean(meta?.isAdmin) && ADMIN_PRIORITY_COMMANDS.has(command);
}

function dequeueNextTask() {
  if (highPriorityQueue.length > 0) return highPriorityQueue.shift();
  if (normalPriorityQueue.length > 0) return normalPriorityQueue.shift();
  return null;
}

async function runQueueWorker() {
  if (isQueueWorkerRunning) return;
  isQueueWorkerRunning = true;
  try {
    while (true) {
      const entry = dequeueNextTask();
      if (!entry) break;

      const { taskId, task, chatId, isPriority } = entry;
      try {
        const dynamicDelayMs = isPriority ? 0 : computeDynamicDelayMs(chatId);
        if (dynamicDelayMs > 0) {
          await sleep(dynamicDelayMs);
        }
        await task();
      } catch (err) {
        console.error(`[CMD-QUEUE] task=${taskId} failed:`, err?.message || err);
      } finally {
        pendingCommands = Math.max(0, pendingCommands - 1);
      }
    }
  } finally {
    isQueueWorkerRunning = false;
    if (highPriorityQueue.length > 0 || normalPriorityQueue.length > 0) {
      Promise.resolve().then(() => runQueueWorker());
    }
  }
}

export function enqueueGlobalCommandTask(task, meta = {}) {
  if (typeof task !== 'function') {
    return { accepted: false, reason: 'invalid_task' };
  }

  const chatId = meta?.chatId || 'unknown';
  const command = meta?.command || 'unknown';
  const now = Date.now();
  const groupActivity = registerCommandActivity(chatId, now);

  pendingCommands += 1;
  if (pendingCommands > maxObservedPending) maxObservedPending = pendingCommands;
  sequence += 1;
  const taskId = sequence;
  const position = pendingCommands;
  const priorityTask = isPriorityTask(meta);
  const lane = priorityTask ? 'high' : 'normal';

  const entry = { taskId, task, chatId, isPriority: priorityTask };
  if (priorityTask) {
    highPriorityQueue.push(entry);
  } else {
    normalPriorityQueue.push(entry);
  }
  Promise.resolve().then(() => runQueueWorker());

  const isAboveSoftLimit = pendingCommands > CMD_SOFT_PENDING_LIMIT;
  if (isAboveSoftLimit) {
    console.warn(`[CMD-QUEUE] soft-limit exceeded pending=${pendingCommands} limit=${CMD_SOFT_PENDING_LIMIT} task=${taskId} cmd=${command} chat=${chatId}`);
  }
  console.log(`[CMD-QUEUE] enqueued task=${taskId} lane=${lane} cmd=${command} chat=${chatId} pending=${pendingCommands} groupActivity=${groupActivity}`);

  return {
    accepted: true,
    taskId,
    position,
    pending: pendingCommands,
    lane,
    dynamicDelayCapMs: CMD_MAX_DYNAMIC_DELAY_MS,
  };
}

export function getGlobalCommandQueueStats() {
  return {
    pending: pendingCommands,
    softLimit: CMD_SOFT_PENDING_LIMIT,
    maxObservedPending,
    maxDynamicDelayMs: CMD_MAX_DYNAMIC_DELAY_MS,
  };
}
