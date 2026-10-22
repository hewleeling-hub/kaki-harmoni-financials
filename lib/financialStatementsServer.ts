// Server-side loader for the profit & loss and balance sheet. Kept out of the
// page file so the reports page and any future export route work from one
// reading of the ledger.

import { createAdminClient } from "./supabase/admin";
import { sumLines, type Net } from "./ledger";
import {
  buildBalanceSheet,
  buildProfitAndLoss,
  type BalanceSheet,
  type ProfitAndLoss,
} from "./financialStatements";
import type { Account, JournalLine } from "./types";

export type Statements = {
  profitAndLoss: ProfitAndLoss;
  balanceSheet: BalanceSheet;
  journalCount: number;
  earliestEntry: string | null;
};

// Supabase caps .in() lists and selects, so walk the journals in chunks rather
// than silently truncating the statements once the ledger grows.
const CHUNK = 200;

export async function loadStatements(
  start: string,
  end: string,
): Promise<Statements | null> {
  const supabase = createAdminClient();

  const { data: accountRows, error: accErr } = await supabase
    .from("accounts")
    .select("*")
    .order("sort_order");
  if (accErr || !accountRows) return null;
  const accounts = accountRows as Account[];

  const { data: journalRows, error: jErr } = await supabase
    .from("journals")
    .select("id,entry_date")
    .lte("entry_date", end)
    .order("entry_date");
  if (jErr || !journalRows) return null;

  const journals = journalRows as { id: string; entry_date: string }[];
  if (journals.length === 0) return null;

  const dateOf = new Map(journals.map((j) => [j.id, j.entry_date]));
  const ids = journals.map((j) => j.id);

  const all: JournalLine[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from("journal_lines")
      .select("*")
      .in("journal_id", ids.slice(i, i + CHUNK));
    if (error) return null;
    all.push(...((data ?? []) as JournalLine[]));
  }

  const inPeriod = all.filter((l) => {
    const d = dateOf.get(l.journal_id);
    return d !== undefined && d >= start && d <= end;
  });

  const period: Record<string, Net> = sumLines(inPeriod);
  const cumulative: Record<string, Net> = sumLines(all);

  const profitAndLoss = buildProfitAndLoss(accounts, period, cumulative);
  const balanceSheet = buildBalanceSheet(
    accounts,
    cumulative,
    profitAndLoss.profit.cumulative,
  );

  return {
    profitAndLoss,
    balanceSheet,
    journalCount: journals.length,
    earliestEntry: journals[0]?.entry_date ?? null,
  };
}
