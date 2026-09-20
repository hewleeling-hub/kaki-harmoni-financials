// Working out a stock take.
//
//   opening + purchases − closing = consumed
//
// Only the closing count is ever stored. Opening comes from the previous take
// and purchases from the expenses themselves, so the arithmetic can't drift out
// of step with the underlying records — re-deriving it always agrees with them.

import { STOCK_CATEGORIES } from "./constants";
import { cogsAccountForStockClass, inventoryAccountForStockClass } from "./posting";
import type { StockTakeRow } from "./types";

export type PriorClosing = Record<string, number>;
export type PurchaseTotals = Record<string, number>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Build a row per stock class.
 *
 * `closing` covers only the classes actually counted; a class with no entry is
 * treated as nothing left, which is the honest reading of "we didn't count any".
 */
export function buildStockTakeRows(
  opening: PriorClosing,
  purchases: PurchaseTotals,
  closing: Record<string, number>,
): StockTakeRow[] {
  // Every class that has any figure at all, in the order the form shows them.
  const classes = [
    ...STOCK_CATEGORIES.filter(
      (c) => opening[c] || purchases[c] || closing[c] !== undefined,
    ),
    // A class that only appears in the data (an old or custom one) still counts.
    ...Object.keys({ ...opening, ...purchases, ...closing }).filter(
      (c) => !STOCK_CATEGORIES.includes(c as (typeof STOCK_CATEGORIES)[number]),
    ),
  ];

  return [...new Set(classes)].map((stock_class) => {
    const o = round2(Number(opening[stock_class] ?? 0));
    const p = round2(Number(purchases[stock_class] ?? 0));
    const c = round2(Number(closing[stock_class] ?? 0));
    return {
      stock_class,
      opening: o,
      purchases: p,
      closing: c,
      consumed: round2(o + p - c),
      inventoryAccount: inventoryAccountForStockClass(stock_class),
      cogsAccount: cogsAccountForStockClass(stock_class),
    };
  });
}

export type StockTakeProblem = { stock_class: string; message: string };

/**
 * Reasons a take can't be posted yet.
 *
 * A negative consumed figure means the count exceeds what was ever bought —
 * arithmetically impossible under this method, so it is a miscount or a missing
 * purchase, not a valid credit to cost of goods. Better to refuse than to post
 * a negative cost of sales that quietly flatters the margin.
 */
export function stockTakeProblems(rows: StockTakeRow[]): StockTakeProblem[] {
  const problems: StockTakeProblem[] = [];
  for (const r of rows) {
    if (r.consumed < -0.005) {
      problems.push({
        stock_class: r.stock_class,
        message: `Closing count (${r.closing.toFixed(2)}) is more than opening plus purchases (${(r.opening + r.purchases).toFixed(2)}). Check the count, or record the missing purchase.`,
      });
    }
    if (r.consumed > 0.005 && !r.inventoryAccount) {
      problems.push({
        stock_class: r.stock_class,
        message: "No inventory account for this class — it can't be relieved.",
      });
    }
  }
  return problems;
}

/** Lines that actually move money; a class with nothing consumed is skipped. */
export function postableRows(rows: StockTakeRow[]): StockTakeRow[] {
  return rows.filter((r) => r.consumed > 0.005);
}

export function totalConsumed(rows: StockTakeRow[]): number {
  return round2(rows.reduce((a, r) => a + Math.max(0, r.consumed), 0));
}
