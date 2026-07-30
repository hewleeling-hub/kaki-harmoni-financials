import { createAdminClient } from "@/lib/supabase/admin";
import { LedgerClient } from "@/components/LedgerClient";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
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
          Apply <code>supabase/migrations/0004_chart_of_accounts.sql</code> then{" "}
          <code>0005_ledger.sql</code> in the Supabase SQL Editor, then reload.
        </p>
      </div>
    );
  }

  return <LedgerClient accounts={(data ?? []) as Account[]} />;
}
