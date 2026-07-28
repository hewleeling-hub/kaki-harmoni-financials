// The café operates in Malaysia (GMT+8, no daylight saving). Vercel's servers
// run in UTC, so all day-grouping and time display is pinned to GMT+8 here via a
// fixed offset (no timezone database needed, no DST edge cases).
const GMT8_MS = 8 * 60 * 60 * 1000;

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

// Time-of-day in GMT+8, e.g. "01:05 pm".
export function timeOfDay(iso: string): string {
  const d = new Date(new Date(iso).getTime() + GMT8_MS);
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
}

// GMT+8 calendar date (YYYY-MM-DD) for a given instant.
export function gmt8Date(d: Date | string): string {
  const ms = (typeof d === "string" ? new Date(d) : d).getTime();
  return new Date(ms + GMT8_MS).toISOString().slice(0, 10);
}

// Today's date in GMT+8.
export function today(): string {
  return new Date(Date.now() + GMT8_MS).toISOString().slice(0, 10);
}

// GMT+8 day [start, end) as UTC ISO strings for a YYYY-MM-DD date string.
export function dayBounds(dateStr: string): { startISO: string; endISO: string } {
  const start = new Date(`${dateStr}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
