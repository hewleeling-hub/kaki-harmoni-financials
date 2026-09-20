// Turning a purchase into a double entry.
//
// Every purchase is the same shape of entry: debit what you bought, credit
// where the money came from.
//
//   Dr  expense (or fixed asset)      amount
//       Cr  source of funds                   amount
//
// The mappings below are SUGGESTIONS, not rules. A wrong account silently
// misstates the books, so anything ambiguous returns null and the UI makes the
// user choose before it will post.

import type { Expense } from "./types";

/**
 * Where the money came from, by payer.
 *
 * The three owners each have their own director-loan account — the company owes
 * that specific person, and netting them together would hide who is owed what.
 *   MG  = Goh Hian Gek
 *   HLL = Hew Lee Ling
 *   KY  = Yap Sau Yong
 */
export const SOURCE_ACCOUNT_BY_PAYER: Record<string, string> = {
  petty_cash: "1120", // Petty Cash
  owner_mg: "2210", // Director Loan - Goh Hian Gek
  owner_hll: "2220", // Director Loan - Hew Lee Ling
  owner_ky: "2230", // Director Loan - Yap Sau Yong
  creditor: "2110", // Accounts Payable
  staff_card: "2190", // Other Payables (legacy payer)
  personal: "2190", // Other Payables (legacy payer)
  // 'company' is deliberately absent: paid from the bank or from cash on hand
  // are different accounts and the payer alone doesn't say which.
};

/** What was bought — fixed assets, by asset class. */
const ASSET_ACCOUNT_BY_CATEGORY: Record<string, string> = {
  kitchen_equipment: "1530", // Café Equipment
  spa_machine: "1520", // Wellness Equipment
  furniture_and_fittings: "1510", // Furniture and Fittings
  office_equipment: "1560", // Computer and Office Equipment
  computer: "1560",
  printer: "1560",
  shop_renovation: "1590", // Renovation and Fit-Out
  // Paid up front, so it buys coverage over a period rather than being spent
  // on the day — an asset until the months it covers have passed.
  subscription: "1350", // Prepaid Software Subscriptions
  // electrical_equipment and other are ambiguous — could be air-conditioning,
  // POS, security or fit-out. Left for the user to pick.
};

/**
 * What was bought — stock, by stock class. Inventory sits on the balance sheet
 * until it is consumed or sold, when it becomes cost of goods.
 */
export const STOCK_ACCOUNT_BY_CATEGORY: Record<string, string> = {
  coffee_beans: "1210", // Coffee Beans Inventory
  tea_and_beverage: "1220", // Tea and Beverage Inventory
  milk_and_chilled: "1230", // Milk and Chilled Ingredients Inventory
  food: "1240", // Food Inventory
  // Oils and bath salts go into the same soak and are counted together.
  essential_oils_and_salts: "1250", // Essential Oils Inventory
  retail_merchandise: "1260", // Retail Merchandise Inventory
  packaging: "1270", // Packaging Inventory
  operating_consumables: "1280", // Operating Consumables Inventory
  // "other" is left for the user to place — stock that fits none of the eight
  // is exactly the case where guessing would be wrong.
};

/** What was bought — running costs, by expense category. */
const EXPENSE_ACCOUNT_BY_CATEGORY: Record<string, string> = {
  wages: "6110", // Salaries and Wages
  rent: "6210", // Rent and Service Charges
  maintenance: "6280", // Repairs and Maintenance
  mobile_charges_and_internet: "6240", // Internet and Telephone
  marketing: "6310", // Digital Advertising
  transport: "6740", // Travel and Transport
  petrol: "6740",
  toll: "6740",
  meals: "6750", // Meals and Entertainment
  other: "6790", // Miscellaneous Administrative Expense
  // Deliberately unmapped, because the chart is more specific than the
  // category and guessing would misstate the P&L:
  //   utilities          → electricity and water are separate accounts (phone
  //                        and internet have their own category)
  //   supplies           → cleaning supplies vs office stationery
  //   cost_of_goods      → coffee / milk / food / packaging are separate
  //   operating_expenses → too broad to place
  //   equipment          → may be an asset rather than an expense
};

// Category is free text — the form lets the user type their own via "Other",
// so real rows carry things like "shop renovation" and "incorporation fees".
// Normalise before looking up so spacing and case don't decide the mapping.
function key(category: string): string {
  return category.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export type PostingSuggestion = {
  /** Account to debit — what was bought. Null when it must be chosen. */
  debitAccount: string | null;
  /** Account to credit — where the money came from. Null when it must be chosen. */
  creditAccount: string | null;
  /** Why a side was left blank, shown to the user. */
  notes: string[];
};

export function suggestPosting(expense: Expense): PostingSuggestion {
  const notes: string[] = [];
  const type = expense.expense_type;

  const k = key(expense.category);
  const debitAccount =
    type === "fixed_asset"
      ? (ASSET_ACCOUNT_BY_CATEGORY[k] ?? null)
      : type === "stock"
        ? (STOCK_ACCOUNT_BY_CATEGORY[k] ?? null)
        : (EXPENSE_ACCOUNT_BY_CATEGORY[k] ?? null);

  if (!debitAccount) {
    const what = expense.category.replace(/_/g, " ");
    notes.push(
      type === "fixed_asset"
        ? `"${what}" could be several asset accounts — pick the right one.`
        : type === "stock"
          ? `"${what}" doesn't match one of the inventory accounts — pick the right one.`
          : `"${what}" covers several accounts in your chart — pick the right one.`,
    );
  }

  const creditAccount = SOURCE_ACCOUNT_BY_PAYER[expense.payer] ?? null;
  if (!creditAccount) {
    notes.push(
      expense.payer === "company"
        ? "Company-paid — choose whether it left the bank or cash on hand."
        : `No default account for payer "${expense.payer.replace(/_/g, " ")}".`,
    );
  }

  return { debitAccount, creditAccount, notes };
}

/** The reference a posted journal is filed under, tying it to the paperwork. */
export function postingReference(expense: Expense): string {
  return [expense.pv_number, expense.po_number].filter(Boolean).join(" / ");
}

export function postingMemo(expense: Expense): string {
  const what = expense.description || expense.category.replace(/_/g, " ");
  return `${expense.vendor} — ${what}`.slice(0, 300);
}

// ── subscriptions ───────────────────────────────────────────────────────────

/** True when this purchase is a prepaid subscription, whatever its type. */
export function isSubscription(category: string): boolean {
  return key(category) === "subscription";
}

export type Amortisation = {
  months: number;
  /** Charge per month, rounded to sen. */
  perMonth: number;
  /** First and last month the subscription covers, as YYYY-MM-DD. */
  startDate: string;
  endDate: string;
};

/**
 * How a prepaid subscription spreads across the months it covers.
 *
 * The term runs from the purchase date, so a 12-month subscription bought on
 * 2026-09-13 covers up to 2027-09-12 — the day before the anniversary, not the
 * anniversary itself.
 */
export function amortise(
  amount: number,
  months: number | null | undefined,
  startDate: string,
): Amortisation | null {
  const n = Number(months);
  if (!Number.isFinite(n) || n <= 0) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  // Adding months naively overflows: 31 Jan + 1 month becomes 3 March, because
  // 31 February doesn't exist and JS rolls forward. Move the month on the 1st,
  // then clamp the day to one that exists in the target month.
  const end = new Date(start);
  const day = start.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + n);
  const lastDayOfMonth = new Date(
    Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0),
  ).getUTCDate();
  end.setUTCDate(Math.min(day, lastDayOfMonth));
  // The term covers up to the day before the anniversary.
  end.setUTCDate(end.getUTCDate() - 1);

  return {
    months: n,
    perMonth: Math.round((Number(amount) / n) * 100) / 100,
    startDate,
    endDate: end.toISOString().slice(0, 10),
  };
}

// ── stock takes ─────────────────────────────────────────────────────────────

/**
 * Where each stock class is charged when a stock take says it was consumed.
 *
 * Inventory (12xx) is relieved and cost of goods (5xxx) takes the charge:
 *   Dr 5210 Coffee Beans Used / Cr 1210 Coffee Beans Inventory
 *
 * Two classes are deliberately absent because the right account depends on how
 * the business actually uses them, and a wrong one misstates gross margin:
 *   essential_oils_and_salts → used in treatments (5110) or sold (5310)?
 *   operating_consumables  → cost of sales (5130) or general overhead?
 */
export const COGS_ACCOUNT_BY_STOCK_CLASS: Record<string, string> = {
  coffee_beans: "5210", // Coffee Beans Used
  tea_and_beverage: "5220", // Milk and Beverage Ingredients Used
  milk_and_chilled: "5220",
  food: "5230", // Food and Snack Purchases
  retail_merchandise: "5320", // Merchandise Sold - Cost
  packaging: "5240", // Takeaway Packaging Used
};

/** The inventory account a stock class sits in, for the credit side. */
export function inventoryAccountForStockClass(stockClass: string): string | null {
  return STOCK_ACCOUNT_BY_CATEGORY[key(stockClass)] ?? null;
}

export function cogsAccountForStockClass(stockClass: string): string | null {
  return COGS_ACCOUNT_BY_STOCK_CLASS[key(stockClass)] ?? null;
}
