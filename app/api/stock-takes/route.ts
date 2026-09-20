import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StockTake, StockTakeLine } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/stock-takes — every take, newest first, with its total consumed.
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stock_takes")
    .select("*")
    .order("take_date", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const takes = (data ?? []) as StockTake[];
  const { data: allLines } = await supabase
    .from("stock_take_lines")
    .select("*")
    .in("stock_take_id", takes.map((t) => t.id).length ? takes.map((t) => t.id) : [""]);

  const byTake = new Map<string, StockTakeLine[]>();
  for (const l of (allLines ?? []) as StockTakeLine[]) {
    const arr = byTake.get(l.stock_take_id) ?? [];
    arr.push(l);
    byTake.set(l.stock_take_id, arr);
  }

  return NextResponse.json({
    takes: takes.map((t) => ({
      ...t,
      lines: byTake.get(t.id) ?? [],
    })),
  });
}

// POST /api/stock-takes — record a count.
// Body: { take_date, notes?, closing: { <stock_class>: value } }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const take_date = String(body.take_date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(take_date))
    return NextResponse.json({ error: "A valid count date is required." }, { status: 400 });

  const closingInput = (body.closing ?? {}) as Record<string, unknown>;
  const closing: Record<string, number> = {};
  for (const [k, v] of Object.entries(closingInput)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0)
      return NextResponse.json(
        { error: `Closing value for "${k}" must be zero or more.` },
        { status: 400 },
      );
    closing[k] = Math.round(n * 100) / 100;
  }

  const supabase = createAdminClient();

  const { data: clash } = await supabase
    .from("stock_takes")
    .select("id")
    .eq("take_date", take_date)
    .maybeSingle();
  if (clash)
    return NextResponse.json(
      { error: `There is already a stock take dated ${take_date}.` },
      { status: 409 },
    );

  const { data: take, error } = await supabase
    .from("stock_takes")
    .insert({ take_date, notes: body.notes ? String(body.notes) : null })
    .select()
    .single();
  if (error || !take)
    return NextResponse.json(
      { error: error?.message ?? "Could not save the stock take." },
      { status: 500 },
    );

  const lineRows = Object.entries(closing).map(([stock_class, closing_value]) => ({
    stock_take_id: take.id,
    stock_class,
    closing_value,
  }));
  if (lineRows.length) {
    const { error: lErr } = await supabase.from("stock_take_lines").insert(lineRows);
    if (lErr) {
      // Never leave a take with no counts behind.
      await supabase.from("stock_takes").delete().eq("id", take.id);
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ take }, { status: 201 });
}
