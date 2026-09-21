// Depreciating a fixed asset over its useful life.
//
// Straight line: the same charge every month, so the P&L carries a steady cost
// of owning the thing rather than one lump in the month it was bought.
//
//   Dr  depreciation expense (68xx)   one month's share
//       Cr  accumulated depreciation (16xx)      one month's share
//
// The asset account keeps the original cost untouched — cost minus accumulated
// is the net book value, which is what the balance sheet should show.

import { spreadOverMonths, type MonthCharge } from "./amortisation";

/**
 * The two sides of the monthly entry, by the account the asset sits in.
 *
 * Both come straight from the chart's own naming, so there is nothing to guess:
 * 1630 Café Equipment is written down through 1630's accumulated account and
 * charged to 6830 Depreciation - Café Equipment.
 */
export const DEPRECIATION_ACCOUNTS_BY_ASSET: Record<
  string,
  { accumulated: string; expense: string }
> = {
  "1510": { accumulated: "1610", expense: "6810" }, // Furniture and Fittings
  "1520": { accumulated: "1620", expense: "6820" }, // Wellness Equipment
  "1530": { accumulated: "1630", expense: "6830" }, // Café Equipment
  "1540": { accumulated: "1640", expense: "6840" }, // Water System Equipment
  "1550": { accumulated: "1650", expense: "6840" }, // Air Conditioning (6840 covers water and air-con)
  "1560": { accumulated: "1660", expense: "6850" }, // Computer and Office Equipment
  "1570": { accumulated: "1670", expense: "6850" }, // POS and Payment Equipment
  "1580": { accumulated: "1670", expense: "6850" }, // CCTV and Security (1670 covers POS and security)
  "1590": { accumulated: "1680", expense: "6860" }, // Renovation and Fit-Out
};

export function depreciationAccountsFor(assetAccount: string | null | undefined) {
  if (!assetAccount) return null;
  return DEPRECIATION_ACCOUNTS_BY_ASSET[assetAccount] ?? null;
}

/**
 * Suggested useful life in months, by asset account.
 *
 * These are a starting point, not a rule: useful life is the owner's judgement
 * about how long the thing will actually earn its keep, and it is stored per
 * asset so anything unusual can differ. Nothing is charged until a life is set
 * on the asset itself, so a bad default can never quietly reach the books.
 */
export const SUGGESTED_LIFE_MONTHS: Record<string, number> = {
  "1510": 120, // Furniture and fittings — 10 years
  "1520": 60, // Wellness equipment — 5 years, worked hard every day
  "1530": 60, // Café equipment — 5 years
  "1540": 60, // Water system — 5 years
  "1550": 120, // Air conditioning — 10 years, part of the premises
  "1560": 36, // Computers — 3 years
  "1570": 36, // POS hardware — 3 years
  "1580": 60, // CCTV — 5 years
  "1590": 60, // Renovation — 5 years, or the lease term if shorter
};

export function suggestedLifeMonths(assetAccount: string | null | undefined): number | null {
  if (!assetAccount) return null;
  return SUGGESTED_LIFE_MONTHS[assetAccount] ?? null;
}

/**
 * What each month of an asset's life is charged.
 *
 * Spreads cost minus residual — what the asset is expected to be worth when the
 * business is done with it, almost always nothing here. The sen that won't
 * divide go to the earliest months, so the accumulated account lands on the
 * depreciable amount exactly and the asset never carries a stray sen forever.
 */
export function depreciationSchedule(
  cost: number,
  residual: number,
  months: number | null | undefined,
  startDate: string,
): MonthCharge[] {
  const depreciable = Math.round((Number(cost) - Number(residual || 0)) * 100) / 100;
  if (!(depreciable > 0)) return [];
  return spreadOverMonths(depreciable, months, startDate);
}

/** Cost less everything written off so far. */
export function netBookValue(cost: number, accumulated: number): number {
  return Math.round((Number(cost) - Number(accumulated)) * 100) / 100;
}
