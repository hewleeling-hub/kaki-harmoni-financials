// Double-entry ledger math — pure functions, safe on client or server.
import type { Account, JournalLine } from "./types";
import { ancestorCodes } from "./accounts";

export type Net = { debit: number; credit: number; net: number };

// Debits and credits summed by account code, straight from journal lines.
export function sumLines(lines: JournalLine[]): Record<string, Net> {
  const out: Record<string, Net> = {};
  for (const l of lines) {
    const e = (out[l.account_code] ??= { debit: 0, credit: 0, net: 0 });
    e.debit += Number(l.debit);
    e.credit += Number(l.credit);
  }
  for (const c in out) out[c].net = out[c].debit - out[c].credit;
  return out;
}

// Whether an account's balance is naturally a debit (positive when it grows the
// normal way). Leaves use their normal_balance; headers fall back to the code
// range (1/5/6/7/9 → debit, 2/3/4/8 → credit).
export function naturalIsDebit(a: Pick<Account, "normal_balance" | "code">): boolean {
  if (a.normal_balance) return a.normal_balance === "debit";
  return ["1", "5", "6", "7", "9"].includes(a.code[0]);
}

// The signed net (debit − credit) accumulated onto every account AND each of its
// ancestors, so header rows show the roll-up of their descendants.
export function rollUp(
  accounts: Account[],
  leaf: Record<string, Net>,
): Record<string, Net> {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const out: Record<string, Net> = {};
  for (const a of accounts) out[a.code] = { debit: 0, credit: 0, net: 0 };
  for (const a of accounts) {
    const ln = leaf[a.code];
    if (!ln) continue;
    for (const c of [a.code, ...ancestorCodes(a.code, byCode)]) {
      const e = out[c];
      if (!e) continue;
      e.debit += ln.debit;
      e.credit += ln.credit;
    }
  }
  for (const c in out) out[c].net = out[c].debit - out[c].credit;
  return out;
}

// Balance in natural terms (positive = the account's normal direction).
export function naturalBalance(
  a: Pick<Account, "normal_balance" | "code">,
  net: number,
): number {
  return naturalIsDebit(a) ? net : -net;
}

export type TrialRow = {
  code: string;
  name: string;
  debit: number;
  credit: number;
};

// Trial balance: one row per postable account that has movement, with its net
// shown in the debit or credit column. Totals must match.
export function buildTrialBalance(
  accounts: Account[],
  rolled: Record<string, Net>,
): { rows: TrialRow[]; totalDebit: number; totalCredit: number } {
  const rows: TrialRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const a of accounts) {
    if (!a.is_postable) continue;
    const net = rolled[a.code]?.net ?? 0;
    if (Math.abs(net) < 0.005) continue;
    const row =
      net > 0
        ? { code: a.code, name: a.name, debit: net, credit: 0 }
        : { code: a.code, name: a.name, debit: 0, credit: -net };
    totalDebit += row.debit;
    totalCredit += row.credit;
    rows.push(row);
  }
  return { rows, totalDebit, totalCredit };
}
