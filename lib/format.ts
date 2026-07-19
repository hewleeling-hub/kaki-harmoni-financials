export function rm(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `RM${n.toFixed(2)}`;
}

// mm:ss countdown from milliseconds remaining (never negative).
export function countdown(msRemaining: number): string {
  const s = Math.max(0, Math.floor(msRemaining / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function today(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

// Local-day [start, end) as ISO strings for a YYYY-MM-DD date string.
export function dayBounds(dateStr: string): { startISO: string; endISO: string } {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
