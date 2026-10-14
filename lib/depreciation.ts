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
  // Two lives, decided by one question: can it leave with us?
  //
  // Anything fixed to the clubhouse — wiring, glass, air conditioning, the
  // fit-out — is written off over 3 years. The lease runs a year at a time
  // with an extension we expect but do not hold, and depreciation already
  // charged cannot be clawed back if we stay longer, so three years is the
  // honest middle between a one-year term and a five-year guess.
  //
  // Anything we could carry out of the door — furniture, equipment, the
  // computers — lasts as long as it lasts, and that is 5 years.
  "1510": 60, // Furniture and fittings — moveable
  "1520": 60, // Wellness equipment — moveable
  "1530": 60, // Café equipment — moveable
  "1540": 36, // Water system — plumbed into the premises
  "1550": 36, // Air conditioning — cassette unit and piping, stays with the unit
  "1560": 60, // Computer and office equipment — moveable
  "1570": 60, // POS hardware — moveable
  "1580": 36, // CCTV and security — wired into the premises
  "1590": 36, // Renovation and fit-out — stays with the premises
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
