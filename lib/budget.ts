// Budget vs Actual math — pure functions, safe on client or server.
import type { Account } from "./types";
import { ancestorCodes } from "./accounts";

// Roll a per-code number onto each account AND its ancestors (so headers
// subtotal their descendants). Used for budgets.
export function rollUpNumber(
  accounts: Account[],
  leaf: Record<string, number>,
): Record<string, number> {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const out: Record<string, number> = {};
  for (const a of accounts) out[a.code] = 0;
  for (const a of accounts) {
    const v = leaf[a.code];
    if (!v) continue;
    for (const c of [a.code, ...ancestorCodes(a.code, byCode)]) {
      out[c] = (out[c] ?? 0) + v;
    }
  }
  return out;
}

// Same roll-up but for a 12-element monthly array. Used for actuals.
export function rollUpMonthly(
  accounts: Account[],
  leaf: Record<string, number[]>,
): Record<string, number[]> {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const out: Record<string, number[]> = {};
  for (const a of accounts) out[a.code] = Array(12).fill(0);
  for (const a of accounts) {
    const arr = leaf[a.code];
    if (!arr) continue;
    for (const c of [a.code, ...ancestorCodes(a.code, byCode)]) {
      const dst = out[c];
      if (!dst) continue;
      for (let m = 0; m < 12; m++) dst[m] += arr[m] ?? 0;
    }
  }
  return out;
}

type RawLine = {
  account_code: string;
  debit: number | string;
  credit: number | string;
  journals?: { entry_date: string } | null;
  entry_date?: string;
};

// Net (debit − credit) per leaf account, split into 12 months, for one year.
export function monthlyNetByCode(
  lines: RawLine[],
  fiscalYear: number,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const yr = String(fiscalYear);
  for (const l of lines) {
    const d = l.journals?.entry_date ?? l.entry_date ?? "";
    if (!d.startsWith(yr)) continue;
    const m = parseInt(d.slice(5, 7), 10) - 1;
    if (m < 0 || m > 11) continue;
    (out[l.account_code] ??= Array(12).fill(0))[m] +=
      Number(l.debit) - Number(l.credit);
  }
  return out;
}

// Which P&L group a code belongs to, and the sign that makes "more" mean more of
// that group (revenue/other-income are credit-positive; costs are debit-positive).
export function plGroup(
  code: string,
): "revenue" | "expense" | "other_income" | null {
  const d = code[0];
  if (d === "4") return "revenue";
  if (d === "5" || d === "6" || d === "7") return "expense";
  if (d === "8") return "other_income";
  return null;
}

// Is a favourable variance one where actual is ABOVE budget? True for revenue &
// other income; false for costs (under budget is good).
export function higherIsBetter(code: string): boolean {
  return code[0] === "4" || code[0] === "8";
}
