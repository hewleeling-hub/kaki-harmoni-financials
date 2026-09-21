// Server-side amortisation lookups. Kept out of the route files so the status
// view and the posting route work from one reading of the data — a Next route
// module may only export HTTP handlers.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  amortisationSchedule,
  monthStart,
  outstandingMonths,
  round2,
  sumCharges,
  type MonthCharge,
} from "./amortisation";
import { amortisationAccountForPrepaid } from "./posting";
import type { Expense, SubscriptionCharge } from "./types";

export type AmortisationRow = {
  expense: Expense;
  /** Every month of the term and its slice. */
  schedule: MonthCharge[];
  /** Months already charged, oldest first. */
  charged: SubscriptionCharge[];
  chargedTotal: number;
  /** What's still sitting in prepaid, waiting to be released. */
  prepaidBalance: number;
  /** The account the purchase debited — the one a charge must credit back. */
  prepaidAccount: string | null;
  purchaseJournalId: string | null;
  /** Account the monthly charge goes to, and whether the user set it. */
  expenseAccount: string | null;
  expenseAccountIsChosen: boolean;
  /** Months due up to the asked month that haven't been charged. */
  outstanding: MonthCharge[];
  outstandingTotal: number;
  /** Why this one can't be charged yet, if it can't. */
  blocked: string | null;
};

/**
 * Every prepayment with a term, worked out as at `through` (a YYYY-MM-DD date
 * or YYYY-MM month).
 *
 * A subscription can only be amortised once its purchase has been posted: the
 * monthly entry credits the prepaid account, and crediting an account nothing
 * was ever debited to would show a negative asset rather than a released
 * prepayment.
 */
export async function amortisationRows(
  supabase: SupabaseClient,
  through: string,
): Promise<AmortisationRow[]> {
  // Anything bought with a term to spread: a subscription, prepaid rent,
  // insurance, a licence. The term is what makes it amortisable, not the
  // category, so this follows the term rather than a list of category names.
  const { data: expenseRows } = await supabase
    .from("expenses")
    .select("*")
    .gt("subscription_months", 0)
    .order("expense_date", { ascending: true });
  const expenses = (expenseRows ?? []) as Expense[];
  if (!expenses.length) return [];

  const ids = expenses.map((e) => e.id);

  const { data: chargeRows } = await supabase
    .from("subscription_charges")
    .select("*")
    .in("expense_id", ids)
    .order("period", { ascending: true });
  const charges = (chargeRows ?? []) as SubscriptionCharge[];

  // The journal that posted each purchase, and the account it debited.
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
      // A purchase posts one debit; if there were several, the first is the one
      // the prepayment went to.
      if (!debitByJournal.has(l.journal_id as string))
        debitByJournal.set(l.journal_id as string, l.account_code as string);
    }
  }

  return expenses.map((e) => {
    const schedule = amortisationSchedule(
      Number(e.amount),
      e.subscription_months,
      e.expense_date,
    );
    const mine = charges.filter((c) => c.expense_id === e.id);
    const chargedTotal = sumCharges(mine);
    const purchaseJournalId = journalByExpense.get(e.id) ?? null;
    const prepaidAccount = purchaseJournalId
      ? (debitByJournal.get(purchaseJournalId) ?? null)
      : null;
    const expenseAccount =
      e.amortisation_account || amortisationAccountForPrepaid(prepaidAccount);
    const outstanding = outstandingMonths(
      schedule,
      mine.map((c) => c.period),
      through,
    );

    let blocked: string | null = null;
    if (!schedule.length)
      blocked =
        "No term recorded. Edit the purchase and say how many months the subscription covers.";
    else if (!purchaseJournalId)
      blocked =
        "Not posted to the ledger yet, so there is nothing in prepaid to release. Post it from Purchases first.";
    else if (!prepaidAccount)
      blocked = "Its journal has no debit line, so there is no prepaid account to credit.";
    else if (!outstanding.length)
      blocked = chargedTotal > 0 ? "Up to date." : "Nothing due yet this month.";

    return {
      expense: e,
      schedule,
      charged: mine,
      chargedTotal,
      prepaidBalance: round2(Number(e.amount) - chargedTotal),
      prepaidAccount,
      purchaseJournalId,
      expenseAccount: expenseAccount || null,
      expenseAccountIsChosen: !!e.amortisation_account,
      outstanding,
      outstandingTotal: sumCharges(outstanding),
      blocked,
    };
  });
}

/** Rows that have months due and nothing standing in the way. */
export function chargeableRows(rows: AmortisationRow[]): AmortisationRow[] {
  return rows.filter((r) => r.outstanding.length > 0 && !r.blocked);
}

/** Outstanding months across every prepayment, grouped by month. */
export function monthsDue(
  rows: AmortisationRow[],
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
