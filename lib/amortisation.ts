// Spreading a prepaid subscription over the months it covers.
//
// Nothing here touches the database: given an amount, a term and a start date
// it says what each month should be charged. The rule that matters is that the
// slices add back to the amount exactly — a subscription that doesn't clear to
// zero at the end of its term leaves a stub sitting on the balance sheet
// forever.

export type MonthCharge = {
  /** First day of the calendar month, YYYY-MM-01. */
  period: string;
  amount: number;
};

/** The month a date falls in, as its first day. */
export function monthStart(date: string): string {
  return `${String(date).slice(0, 7)}-01`;
}

/** n months after a period, as a first-of-month date. */
export function addMonths(period: string, n: number): string {
  const y = Number(period.slice(0, 4));
  const m = Number(period.slice(5, 7)) - 1 + n;
  const year = y + Math.floor(m / 12);
  const month = ((m % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/** Last day of the month a period is in. */
export function monthEnd(period: string): string {
  const next = addMonths(period, 1);
  const d = new Date(`${next}T00:00:00Z`);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-09-01" → "September 2026". */
export function monthLabel(period: string): string {
  const m = Number(String(period).slice(5, 7));
  return `${MONTHS[m - 1] ?? "?"} ${String(period).slice(0, 4)}`;
}

/**
 * One charge per month of the term, starting with the month of purchase.
 *
 * Whole months, not days: a subscription bought on the 24th is charged for the
 * whole of that month. Pro-rating by day would be more precise than this
 * business needs and would make every month a different number.
 *
 * The split is done in sen, and the odd sen that won't divide are handed to the
 * earliest months (269.50 over 60 months is ten months of 4.50 then fifty of
 * 4.49). Dividing and rounding instead leaves a gap — 4.49 × 60 is 269.40, ten
 * sen short — so the prepaid balance would never reach zero.
 */
export function amortisationSchedule(
  amount: number,
  months: number | null | undefined,
  startDate: string,
): MonthCharge[] {
  const n = Number(months);
  const total = Math.round(Number(amount) * 100);
  if (!Number.isInteger(n) || n <= 0 || !Number.isFinite(total) || total <= 0)
    return [];
  if (!/^\d{4}-\d{2}/.test(String(startDate))) return [];

  const base = Math.floor(total / n);
  const extra = total - base * n; // fewer than n sen left over
  const first = monthStart(startDate);

  return Array.from({ length: n }, (_, i) => ({
    period: addMonths(first, i),
    amount: (base + (i < extra ? 1 : 0)) / 100,
  }));
}

/** The months of a schedule that fall up to and including `through`, uncharged. */
export function outstandingMonths(
  schedule: MonthCharge[],
  chargedPeriods: string[],
  through: string,
): MonthCharge[] {
  const done = new Set(chargedPeriods.map((p) => monthStart(p)));
  const limit = monthStart(through);
  return schedule.filter((c) => c.period <= limit && !done.has(c.period));
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function sumCharges(charges: { amount: number }[]): number {
  return round2(charges.reduce((a, c) => a + Number(c.amount), 0));
}
