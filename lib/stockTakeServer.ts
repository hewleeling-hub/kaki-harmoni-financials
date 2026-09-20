// Server-side stock take lookups. Kept out of the route files so they can be
// shared — a Next route module may only export HTTP handlers.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStockTakeRows } from "./stockTake";
import type { StockTake, StockTakeLine } from "./types";

/**
 * Opening stock and purchases for a take dated `takeDate`.
 *
 * Opening is the previous take's closing count; purchases are the stock bought
 * since that take (or since the beginning, for the first one).
 */
export async function periodFigures(
  supabase: SupabaseClient,
  takeDate: string,
  excludeTakeId?: string,
) {
  let priorQuery = supabase
    .from("stock_takes")
    .select("id, take_date")
    .lt("take_date", takeDate)
    .order("take_date", { ascending: false })
    .limit(1);
  if (excludeTakeId) priorQuery = priorQuery.neq("id", excludeTakeId);
  const { data: priorRows } = await priorQuery;
  const prior = priorRows?.[0] ?? null;

  const opening: Record<string, number> = {};
  if (prior) {
    const { data: priorLines } = await supabase
      .from("stock_take_lines")
      .select("stock_class, closing_value")
      .eq("stock_take_id", prior.id);
    for (const l of priorLines ?? []) {
      opening[l.stock_class as string] = Number(l.closing_value);
    }
  }

  // Purchases in the window. The prior take's own date is excluded — stock
  // bought that day was already standing on the shelf when it was counted.
  let purchaseQuery = supabase
    .from("expenses")
    .select("category, amount")
    .eq("expense_type", "stock")
    .lte("expense_date", takeDate);
  if (prior) purchaseQuery = purchaseQuery.gt("expense_date", prior.take_date);
  const { data: purchaseRows } = await purchaseQuery;

  const purchases: Record<string, number> = {};
  for (const e of purchaseRows ?? []) {
    const c = e.category as string;
    purchases[c] = (purchases[c] ?? 0) + Number(e.amount);
  }

  return { prior, opening, purchases };
}

export async function rowsForTake(
  supabase: SupabaseClient,
  take: StockTake,
  lines: StockTakeLine[],
) {
  const { opening, purchases, prior } = await periodFigures(
    supabase,
    take.take_date,
    take.id,
  );
  const closing: Record<string, number> = {};
  for (const l of lines) closing[l.stock_class] = Number(l.closing_value);
  return { rows: buildStockTakeRows(opening, purchases, closing), prior };
}
