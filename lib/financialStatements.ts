// Profit & loss and balance sheet — pure functions over the ledger, safe on
// client or server. Both are derived on every read, never stored, so they
// always show the ledger as it stands.
//
// Signs follow the rest of the ledger code: a Net is debit − credit, and
// naturalBalance() flips it so each line reads positive in its own direction
// (revenue and liabilities positive as credits, assets and expenses as debits).

import type { Account } from "./types";
import { naturalBalance, type Net } from "./ledger";

export type StatementLine = {
  code: string;
  name: string;
  period: number;
  cumulative: number;
};

export type Total = { period: number; cumulative: number };

export type ProfitAndLoss = {
  revenue: StatementLine[];
  grossRevenue: Total;
  discounts: StatementLine[];
  netRevenue: Total;
  costOfSales: StatementLine[];
  totalCostOfSales: Total;
  grossProfit: Total;
  operatingExpenses: StatementLine[];
  totalOperatingExpenses: Total;
  profit: Total;
};

export type BalanceSheet = {
  nonCurrent: StatementLine[];
  totalCost: number;
  accumulatedDepreciation: StatementLine[];
  totalAccumulatedDepreciation: number;
  netBookValue: number;
  current: StatementLine[];
  totalCurrent: number;
  totalAssets: number;
  liabilities: StatementLine[];
  totalLiabilities: number;
  shareCapital: number;
  retainedEarnings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  outOfBalanceBy: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

// Fixed assets are the 15xx range and their accumulated depreciation the 16xx
// range. Pairing them one-to-one is not safe — 1580 CCTV sits under 1670 "POS
// and Security" — so they are totalled separately and netted.
const isNonCurrentAsset = (code: string) => code.startsWith("15");
const isAccumulatedDepreciation = (code: string) => code.startsWith("16");
const isCostOfSales = (code: string) => code.startsWith("5");

function lines(
  accounts: Account[],
  period: Record<string, Net>,
  cumulative: Record<string, Net>,
  keep: (a: Account) => boolean,
): StatementLine[] {
  const out: StatementLine[] = [];
  for (const a of accounts) {
    if (!a.is_postable || !keep(a)) continue;
    const p = r2(naturalBalance(a, period[a.code]?.net ?? 0));
    const c = r2(naturalBalance(a, cumulative[a.code]?.net ?? 0));
    if (p === 0 && c === 0) continue;
    out.push({ code: a.code, name: a.name, period: p, cumulative: c });
  }
  return out;
}

const total = (ls: StatementLine[]): Total => ({
  period: r2(ls.reduce((t, l) => t + l.period, 0)),
  cumulative: r2(ls.reduce((t, l) => t + l.cumulative, 0)),
});

const minus = (a: Total, b: Total): Total => ({
  period: r2(a.period - b.period),
  cumulative: r2(a.cumulative - b.cumulative),
});

export function buildProfitAndLoss(
  accounts: Account[],
  period: Record<string, Net>,
  cumulative: Record<string, Net>,
): ProfitAndLoss {
  const pl = (a: Account) => a.statement_group === "profit_loss";
  const pick = (f: (a: Account) => boolean) =>
    lines(accounts, period, cumulative, (a) => pl(a) && f(a));

  const revenue = pick(
    (a) => a.account_type === "revenue" || a.account_type === "other_income",
  );
  const discounts = pick((a) => a.account_type === "contra_revenue");
  const costOfSales = pick(
    (a) => a.account_type === "expense" && isCostOfSales(a.code),
  );
  const operatingExpenses = pick(
    (a) => a.account_type === "expense" && !isCostOfSales(a.code),
  );

  const grossRevenue = total(revenue);
  // Contra-revenue is naturally a debit, so it reads positive and is deducted.
  const netRevenue = minus(grossRevenue, total(discounts));
  const totalCostOfSales = total(costOfSales);
  const grossProfit = minus(netRevenue, totalCostOfSales);
  const totalOperatingExpenses = total(operatingExpenses);

  return {
    revenue,
    grossRevenue,
    discounts,
    netRevenue,
    costOfSales,
    totalCostOfSales,
    grossProfit,
    operatingExpenses,
    totalOperatingExpenses,
    profit: minus(grossProfit, totalOperatingExpenses),
  };
}

export function buildBalanceSheet(
  accounts: Account[],
  cumulative: Record<string, Net>,
  profitToDate: number,
): BalanceSheet {
  // The balance sheet is always "as at" the end of the period, so the period
  // column is meaningless here — cumulative is passed for both.
  const pick = (f: (a: Account) => boolean) =>
    lines(accounts, cumulative, cumulative, (a) => a.statement_group === "balance_sheet" && f(a));

  const nonCurrent = pick((a) => a.account_type === "asset" && isNonCurrentAsset(a.code));
  const accumulatedDepreciation = pick(
    (a) => a.account_type === "contra_asset" && isAccumulatedDepreciation(a.code),
  );
  const current = pick((a) => a.account_type === "asset" && !isNonCurrentAsset(a.code));
  const liabilities = pick((a) => a.account_type === "liability");
  const equity = pick((a) => a.account_type === "equity");

  const totalCost = total(nonCurrent).cumulative;
  // Contra-assets read positive in their own direction, so they are deducted.
  const totalAccumulatedDepreciation = total(accumulatedDepreciation).cumulative;
  const netBookValue = r2(totalCost - totalAccumulatedDepreciation);
  const totalCurrent = total(current).cumulative;
  const totalAssets = r2(netBookValue + totalCurrent);

  const totalLiabilities = total(liabilities).cumulative;
  const shareCapital = total(equity).cumulative;
  // Retained earnings are not posted to an account of their own: the profit or
  // loss to date IS the balance.
  const retainedEarnings = profitToDate;
  const totalEquity = r2(shareCapital + retainedEarnings);
  const totalLiabilitiesAndEquity = r2(totalLiabilities + totalEquity);

  return {
    nonCurrent,
    totalCost,
    accumulatedDepreciation,
    totalAccumulatedDepreciation,
    netBookValue,
    current,
    totalCurrent,
    totalAssets,
    liabilities,
    totalLiabilities,
    shareCapital,
    retainedEarnings,
    totalEquity,
    totalLiabilitiesAndEquity,
    outOfBalanceBy: r2(totalAssets - totalLiabilitiesAndEquity),
  };
}
