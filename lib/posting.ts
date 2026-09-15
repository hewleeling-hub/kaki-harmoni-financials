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
  // electrical_equipment and other are ambiguous — could be air-conditioning,
  // POS, security or fit-out. Left for the user to pick.
};

/** What was bought — running costs, by expense category. */
const EXPENSE_ACCOUNT_BY_CATEGORY: Record<string, string> = {
  wages: "6110", // Salaries and Wages
  rent: "6210", // Rent and Service Charges
  maintenance: "6280", // Repairs and Maintenance
  marketing: "6310", // Digital Advertising
  transport: "6740", // Travel and Transport
  petrol: "6740",
  toll: "6740",
  meals: "6750", // Meals and Entertainment
  other: "6790", // Miscellaneous Administrative Expense
  // Deliberately unmapped, because the chart is more specific than the
  // category and guessing would misstate the P&L:
  //   utilities          → electricity / water / internet are separate accounts
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
  const isAsset = expense.expense_type === "fixed_asset";

  const k = key(expense.category);
  const debitAccount = isAsset
    ? (ASSET_ACCOUNT_BY_CATEGORY[k] ?? null)
    : (EXPENSE_ACCOUNT_BY_CATEGORY[k] ?? null);

  if (!debitAccount) {
    notes.push(
      isAsset
        ? `"${expense.category.replace(/_/g, " ")}" could be several asset accounts — pick the right one.`
        : `"${expense.category.replace(/_/g, " ")}" covers several accounts in your chart — pick the right one.`,
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
