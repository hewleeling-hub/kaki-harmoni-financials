import { createAdminClient } from "@/lib/supabase/admin";
import { ChartOfAccounts } from "@/components/ChartOfAccounts";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("sort_order");

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold">Chart of Accounts not set up yet</h1>
        <p className="mt-2 text-sm">
          The <code>accounts</code> table isn&apos;t in the database. Apply
          migration{" "}
          <code>supabase/migrations/0004_chart_of_accounts.sql</code> in the
          Supabase SQL Editor, then reload this page.
        </p>
        <p className="mt-2 text-xs text-amber-700">Details: {error.message}</p>
      </div>
    );
  }

  return <ChartOfAccounts initial={(data ?? []) as Account[]} />;
}
