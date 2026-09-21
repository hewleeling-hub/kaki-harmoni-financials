// Server-side depreciation lookups. Kept out of the route files so the register
// and the posting route work from one reading of the data — a Next route module
// may only export HTTP handlers.

import type { SupabaseClient } from "@supabase/supabase-js";
import { monthStart, outstandingMonths, round2, sumCharges, type MonthCharge } from "./amortisation";
import {
  depreciationAccountsFor,
  depreciationSchedule,
  netBookValue,
  suggestedLifeMonths,
} from "./depreciation";
import type { DepreciationCharge, Expense } from "./types";

export type DepreciationRow = {
  expense: Expense;
  /** Every month of the asset's life and its slice. Empty until a life is set. */
  schedule: MonthCharge[];
  charged: DepreciationCharge[];
  chargedTotal: number;
  /** Cost less what has been written off. */
  netBookValue: number;
  /** The account the purchase debited — the asset being written down. */
  assetAccount: string | null;
  purchaseJournalId: string | null;
  /** The two sides of the monthly entry, chosen or suggested from the asset. */
  expenseAccount: string | null;
  accumulatedAccount: string | null;
  /** Life actually recorded on the asset, and what would be suggested for it. */
  lifeMonths: number | null;
  suggestedLife: number | null;
  startDate: string;
  outstanding: MonthCharge[];
  outstandingTotal: number;
  /** Why this one can't be charged yet, if it can't. */
  blocked: string | null;
};

/**
 * Every fixed asset, worked out as at `through`.
 *
 * Prepaid subscriptions live on the Amortisation page instead — they are bought
 * for a term rather than owned and used up, and the two would otherwise both
 * claim the same purchase.
 *
 * An asset can only be depreciated once its purchase has been posted: the
 * monthly entry writes down what the asset account holds, and writing down an
 * account nothing was ever debited to would invent a cost that was never there.
 */
export async function depreciationRows(
  supabase: SupabaseClient,
  through: string,
): Promise<DepreciationRow[]> {
  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("*")
    .eq("expense_type", "fixed_asset")
    .order("expense_date", { ascending: true });
  const assets = ((expenseRows ?? []) as Expense[]).filter(
    (e) => !e.subscription_months, // prepayments belong to amortisation
  );
  if (!assets.length) return [];

  const ids = assets.map((e) => e.id);

  const { data: chargeRows } = await supabase
    .from("depreciation_charges")
    .select("*")
    .in("expense_id", ids)
    .order("period", { ascending: true });
  const charges = (chargeRows ?? []) as DepreciationCharge[];

  const { data: journalRows } = await supabase
    .from("journals")
    .select("id, expense_id")
    .in("expense_id", ids);
  const journalByExpense = new Map<string, string>();
  for (const j of journalRows ?? []) {
    if (j.expense_id) journalByExpense.set(j.expense_id as string, j.id as string);
  }

  const debitByJournal = new Map<string, string>();
  const journalIds = [...journalByExpense.values()];
  if (journalIds.length) {
    const { data: lineRows } = await supabase
      .from("journal_lines")
      .select("journal_id, account_code, debit")
      .in("journal_id", journalIds)
      .gt("debit", 0);
    for (const l of lineRows ?? []) {
      if (!debitByJournal.has(l.journal_id as string))
        debitByJournal.set(l.journal_id as string, l.account_code as string);
    }
  }

  return assets.map((e) => {
    const purchaseJournalId = journalByExpense.get(e.id) ?? null;
    const assetAccount = purchaseJournalId
      ? (debitByJournal.get(purchaseJournalId) ?? null)
      : null;
    const suggested = depreciationAccountsFor(assetAccount);
    const startDate = e.depreciation_start || e.expense_date;
    const schedule = depreciationSchedule(
      Number(e.amount),
      Number(e.residual_value ?? 0),
      e.depreciation_months,
      startDate,
    );
    const mine = charges.filter((c) => c.expense_id === e.id);
    const chargedTotal = sumCharges(mine);
    const outstanding = outstandingMonths(
      schedule,
      mine.map((c) => c.period),
      through,
    );

    let blocked: string | null = null;
    if (!purchaseJournalId)
      blocked =
        "Not posted to the ledger yet, so there is no asset on the books to write down. Post it from Purchases first.";
    else if (!e.depreciation_months)
      blocked = "No useful life set — say how many months this should be written off over.";
    else if (!schedule.length)
      blocked = "Nothing to depreciate: the residual value is the whole cost.";
    else if (!outstanding.length)
      blocked = chargedTotal > 0 ? "Up to date." : "Nothing due yet this month.";

    return {
      expense: e,
      schedule,
      charged: mine,
      chargedTotal,
      netBookValue: netBookValue(Number(e.amount), chargedTotal),
      assetAccount,
      purchaseJournalId,
      expenseAccount: e.depreciation_account || suggested?.expense || null,
      accumulatedAccount: e.accumulated_account || suggested?.accumulated || null,
      lifeMonths: e.depreciation_months ?? null,
      suggestedLife: suggestedLifeMonths(assetAccount),
      startDate,
      outstanding,
      outstandingTotal: sumCharges(outstanding),
      blocked,
    };
  });
}

/** Rows that have months due and nothing standing in the way. */
export function chargeableRows(rows: DepreciationRow[]): DepreciationRow[] {
  return rows.filter((r) => r.outstanding.length > 0 && !r.blocked);
}

/** Outstanding months across every asset, grouped by month. */
export function monthsDue(
  rows: DepreciationRow[],
): { period: string; total: number; count: number }[] {
  const byPeriod = new Map<string, { total: number; count: number }>();
  for (const r of chargeableRows(rows)) {
    for (const m of r.outstanding) {
      const p = monthStart(m.period);
      const at = byPeriod.get(p) ?? { total: 0, count: 0 };
      at.total = round2(at.total + m.amount);
      at.count += 1;
      byPeriod.set(p, at);
    }
  }
  return [...byPeriod.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period, ...v }));
}
