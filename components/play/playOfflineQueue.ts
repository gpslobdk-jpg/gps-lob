const STORAGE_KEY = "gpslob_offline_answers_queue";
const MAX_QUEUE_SIZE = 200;

export type OfflineAnswerEntry = {
  payloads: Record<string, unknown>[];
  queuedAt: string;
};

export function readOfflineQueue(): OfflineAnswerEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeOfflineQueue(queue: OfflineAnswerEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — silently drop
  }
}

export function enqueueOfflineAnswer(payloads: Record<string, unknown>[]) {
  const queue = readOfflineQueue();
  queue.push({ payloads, queuedAt: new Date().toISOString() });
  // Cap the queue so we don't fill localStorage indefinitely
  if (queue.length > MAX_QUEUE_SIZE) {
    queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  }
  writeOfflineQueue(queue);
}

export function removeOfflineEntry(index: number) {
  const queue = readOfflineQueue();
  queue.splice(index, 1);
  writeOfflineQueue(queue);
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}
