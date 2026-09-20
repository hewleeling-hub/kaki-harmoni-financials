import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowsForTake } from "@/lib/stockTakeServer";
import { stockTakeProblems, totalConsumed } from "@/lib/stockTake";
import type { StockTake, StockTakeLine } from "@/lib/types";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const supabase = createAdminClient();
  const { data: take } = await supabase
    .from("stock_takes")
    .select("*")
    .eq("id", id)
    .single();
  if (!take) return null;
  const { data: lines } = await supabase
    .from("stock_take_lines")
    .select("*")
    .eq("stock_take_id", id);
  return {
    supabase,
    take: take as StockTake,
    lines: (lines ?? []) as StockTakeLine[],
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded)
    return NextResponse.json({ error: "Stock take not found." }, { status: 404 });

  const { rows, prior } = await rowsForTake(loaded.supabase, loaded.take, loaded.lines);
  return NextResponse.json({
    take: loaded.take,
    lines: loaded.lines,
    rows,
    prior,
    problems: stockTakeProblems(rows),
    totalConsumed: totalConsumed(rows),
  });
}

// PATCH — revise the counts. Refused once posted: a posted take is history, and
// changing it would leave the journal saying something the take no longer does.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded)
    return NextResponse.json({ error: "Stock take not found." }, { status: 404 });
  if (loaded.take.journal_id)
    return NextResponse.json(
      { error: "This take is already posted. Reverse its journal in the Ledger first." },
      { status: 409 },
    );

  const body = await req.json().catch(() => ({}));
  const closing = (body.closing ?? {}) as Record<string, unknown>;

  const { supabase } = loaded;
  if (body.notes !== undefined || body.take_date) {
    await supabase
      .from("stock_takes")
      .update({
        ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes) : null } : {}),
        ...(body.take_date ? { take_date: String(body.take_date).slice(0, 10) } : {}),
      })
      .eq("id", id);
  }

  for (const [stock_class, raw] of Object.entries(closing)) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0)
      return NextResponse.json(
        { error: `Closing value for "${stock_class}" must be zero or more.` },
        { status: 400 },
      );
    const closing_value = Math.round(n * 100) / 100;
    const existing = loaded.lines.find((l) => l.stock_class === stock_class);
    if (existing) {
      await supabase
        .from("stock_take_lines")
        .update({ closing_value })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("stock_take_lines")
        .insert({ stock_take_id: id, stock_class, closing_value });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await load(id);
  if (!loaded)
    return NextResponse.json({ error: "Stock take not found." }, { status: 404 });
  if (loaded.take.journal_id)
    return NextResponse.json(
      { error: "This take is already posted. Reverse its journal in the Ledger first." },
      { status: 409 },
    );
  await loaded.supabase.from("stock_takes").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
