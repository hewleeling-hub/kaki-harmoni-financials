"use client";

// Sprint 4 offline resilience. A small durable queue of pending session-start
// POSTs. Stored in localStorage (survives reload); flushed in order on reconnect.
// Each item carries a client_id so replays after a partial success don't double-book.

const KEY = "kh_offline_queue_v1";

export type QueuedSale = {
  client_id: string;
  body: {
    chair_id: string;
    payment_method: string;
    extras: string[];
    client_started_at: string;
  };
};

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): QueuedSale[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: QueuedSale[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  listeners.forEach((l) => l());
}

export function onQueueChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getQueueLength(): number {
  return read().length;
}

export function enqueue(item: QueuedSale) {
  const items = read();
  items.push(item);
  write(items);
}

let flushing = false;

// Flush queued sales in order. Stops on the first network failure (still
// offline) and keeps the remaining items for the next attempt.
export async function flushQueue(): Promise<void> {
  if (flushing || typeof window === "undefined") return;
  if (!navigator.onLine) return;
  flushing = true;
  try {
    let items = read();
    while (items.length > 0) {
      const item = items[0];
      try {
        const res = await fetch("/api/sessions/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        // 2xx = success. 4xx (e.g. chair no longer free) = drop it, it will
        // never succeed on replay. 5xx / network error = keep and retry later.
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          items = read();
          items.shift();
          write(items);
        } else {
          break;
        }
      } catch {
        // Network error — still offline. Retry on next reconnect.
        break;
      }
      items = read();
    }
  } finally {
    flushing = false;
  }
}
