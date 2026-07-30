import { createAdminClient } from "@/lib/supabase/admin";
import { accountsToCsv } from "@/lib/accounts";
import { today } from "@/lib/format";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — the whole chart as CSV (same columns as the seed → re-importable).
export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase.from("accounts").select("*").order("sort_order");
  const csv = accountsToCsv((data ?? []) as Account[]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kaki-harmoni-chart-of-accounts-${today()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
