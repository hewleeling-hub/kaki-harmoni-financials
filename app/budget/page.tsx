import { createAdminClient } from "@/lib/supabase/admin";
import { BudgetClient } from "@/components/BudgetClient";
import { monthlyNetByCode, rollUpMonthly } from "@/lib/budget";
import { today } from "@/lib/format";
import type { Account, Budget } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const sp = await searchParams;
  const currentYear = Number(today().slice(0, 4));
  const currentMonth = Number(today().slice(5, 7)); // 1–12
  const year = Number(sp.year) || currentYear;

  const supabase = createAdminClient();
  const { data: accData, error: accErr } = await supabase
    .from("accounts")
    .select("*")
    .order("sort_order");

  if (accErr) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">Chart of Accounts not set up yet</h1>
        <p className="mt-2 text-sm">
          Apply <code>0004_chart_of_accounts.sql</code> then{" "}
          <code>0006_budgets.sql</code> in Supabase, then reload.
        </p>
      </div>
    );
  }
  const accounts = (accData ?? []) as Account[];

  const { data: budgetData, error: budgetErr } = await supabase
    .from("budgets")
    .select("*")
    .eq("fiscal_year", year);

  if (budgetErr) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">Budgets table not set up yet</h1>
        <p className="mt-2 text-sm">
          Apply <code>supabase/migrations/0006_budgets.sql</code> in the Supabase
          SQL Editor, then reload.
        </p>
        <p className="mt-2 text-xs text-amber-700">{budgetErr.message}</p>
      </div>
    );
  }
  // One figure per month per account. A row with month = null is a flat budget
  // and fills all twelve; a row with a month overrides just that month.
  const budgets: Record<string, number[]> = {};
  for (const b of (budgetData ?? []) as Budget[]) {
    const arr = (budgets[b.account_code] ??= Array(12).fill(0));
    const amount = Number(b.amount);
    if (b.month === null || b.month === undefined) arr.fill(amount);
    else if (b.month >= 1 && b.month <= 12) arr[b.month - 1] = amount;
  }

  // Actuals from the ledger (empty/absent → all zero, page still works).
  let actualsNet: Record<string, number[]> = {};
  const { data: lines, error: lineErr } = await supabase
    .from("journal_lines")
    .select("account_code, debit, credit, journals(entry_date)");
  if (!lineErr && lines) {
    const leaf = monthlyNetByCode(lines as never[], year);
    actualsNet = rollUpMonthly(accounts, leaf);
  }

  return (
    <BudgetClient
      accounts={accounts}
      year={year}
      currentYear={currentYear}
      currentMonth={currentMonth}
      budgets={budgets}
      actualsNet={actualsNet}
    />
  );
}
