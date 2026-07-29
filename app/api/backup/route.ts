import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLES = [
  "chairs",
  "products",
  "sessions",
  "sales",
  "sale_items",
  "expenses",
  "reimbursements",
] as const;

// Full data backup: every table dumped to one JSON file. Read-only. Pairs with
// the code (git tag + zip) for a complete app backup. Restore by re-inserting
// each table's rows in the order above.
export async function GET() {
  const supabase = createAdminClient();
  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const t of TABLES) {
    const { data: rows, error } = await supabase.from(t).select("*");
    if (error) {
      return NextResponse.json(
        { error: `Failed on ${t}: ${error.message}` },
        { status: 500 },
      );
    }
    data[t] = rows ?? [];
    counts[t] = rows?.length ?? 0;
  }

  const backup = {
    app: "kaki-harmoni-financials",
    version: 1,
    exported_at: new Date().toISOString(),
    counts,
    data,
  };

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="kaki-harmoni-backup-${today()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
