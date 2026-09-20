import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { periodFigures } from "@/lib/stockTakeServer";
import { buildStockTakeRows } from "@/lib/stockTake";

export const dynamic = "force-dynamic";

// GET /api/stock-takes/preview?date=YYYY-MM-DD
// Opening stock and purchases for a date, so the count form can show what it
// is counting against before anything is saved.
export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return NextResponse.json({ error: "A valid date is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { opening, purchases, prior } = await periodFigures(supabase, date);

  return NextResponse.json({
    prior,
    rows: buildStockTakeRows(opening, purchases, {}),
  });
}
