// Business rules — deterministic, no AI. See docs/PRD.md + docs/DATA_MODEL.md.

// Bundle: RM40 = RM28 spa + RM12 coffee, written as two sale_items.
export const BUNDLE_PRICE = 40;
export const SPA_ALLOCATION = 28;
export const COFFEE_ALLOCATION = 12;

// Timers (minutes). Spa runs 15 min, then rests 30 min, then frees.
export const SPA_MINUTES = 15;
export const REST_MINUTES = 30;

// Seed product ids the bundle always splits into (from 0001_init.sql).
export const SPA_PRODUCT_ID = "22222222-0000-0000-0000-000000000001";
export const COFFEE_PRODUCT_ID = "22222222-0000-0000-0000-000000000002";

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "bank_transfer", label: "Bank Transfer" },
] as const;

export const EXPENSE_CATEGORIES = [
  "supplies",
  "cafe_consumables_and_packaging",
  "office_supplies_and_stationery",
  "hygiene_consumables",
  "cleaning_supplies",
  "towels_and_linen",
  "spa_consumables",
  "cost_of_goods",
  "operating_expenses",
  "maintenance",
  // Filters, descaler, lubricant, seals, spare washers — bought to keep the
  // machines running rather than to fix a fault. Separated from `maintenance`
  // so a month of routine upkeep can be told apart from a repair bill, though
  // both land on the same P&L line (6280).
  "maintenance_consumables",
  "utilities",
  "mobile_charges_and_internet",
  "rent",
  "equipment",
  // Festive and seasonal decor, plants, wall pieces, display props — what makes
  // the room feel like the room. Non-capital only: a decoration durable and
  // costly enough to last years is a fixed asset (furniture_and_fittings), not
  // this.
  "shop_decoration",
  "marketing",
  "wages",
  "transport",
  "petrol",
  "toll",
  "meals",
  // Supplier and amount known, the item not: a card line or a notebook entry
  // whose invoice has not turned up. A holding line (6795), not a kind of
  // spending — the row is meant to leave it once the document names what was
  // bought.
  "pending_classification",
  "other",
] as const;

/** Who can be chosen as the payer on a NEW purchase. */
export const PAYERS = [
  { value: "company", label: "Company" },
  { value: "owner_mg", label: "Owner (MG)" },
  { value: "owner_hll", label: "Owner (HLL)" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "creditor", label: "Creditor" },
] as const;

/**
 * Payers who no longer buy for the business but whose purchases are still in
 * the books. Kept out of the dropdown so nothing new can be recorded against
 * them, and kept everywhere else — labels, validation, exports — so their
 * history still reads correctly and can still be edited.
 *
 * KY (Yap Sau Yong) ceased to be a partner on 02/10/2026; MG settled what the
 * company owed her and the liability moved to MG's director loan account.
 */
export const RETIRED_PAYERS = [
  { value: "owner_ky", label: "Owner (KY)" },
] as const;

/** Every payer the books have ever used. Use this to resolve a stored value. */
export const ALL_PAYERS = [...PAYERS, ...RETIRED_PAYERS] as const;

/** The label for a stored payer value, retired ones included. */
export function payerLabel(value: string): string {
  return (
    ALL_PAYERS.find((p) => p.value === value)?.label ?? value.replace(/_/g, " ")
  );
}

/** Whether a stored payer value is one the books accept at all. */
export function isKnownPayer(value: string): boolean {
  return ALL_PAYERS.some((p) => p.value === value);
}

export const EXPENSE_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "prepayment", label: "Prepayment" },
  { value: "stock", label: "Stock" },
  { value: "fixed_asset", label: "Fixed Asset" },
] as const;

// Paid up front for a period, so it is a current asset until the months it
// covers have passed — a secretarial retainer, a year of insurance, a domain.
// Not a fixed asset: it is used up rather than owned and worn out, which is why
// it sits in 13xx and is amortised rather than depreciated.
export const PREPAYMENT_CATEGORIES = [
  "company_secretarial_and_office_address",
  "subscription",
  "rent",
  "insurance",
  "licence",
  "domain_and_hosting",
  "other",
] as const;

// Stock is an asset that becomes cost of goods when it's consumed or sold —
// distinct from an expense (gone the moment it's paid) and from a fixed asset
// (held for years and depreciated). These mirror the inventory accounts in the
// chart, 1210–1280.
export const STOCK_CATEGORIES = [
  "coffee_beans",
  "tea_and_beverage",
  "milk_and_chilled",
  "food",
  "essential_oils_and_salts",
  "retail_merchandise",
  "packaging",
  "operating_consumables",
  "other",
] as const;

// Asset classes shown as the "category" when the type is Fixed Asset. Stored in
// the same category text column; "Other" allows a custom class.
export const ASSET_CATEGORIES = [
  "kitchen_equipment",
  "spa_machine_and_water_filter",
  "furniture_and_fittings",
  "electrical_equipment",
  "office_equipment",
  "computer",
  "printer",
  "other",
] as const;

export const PRODUCT_CATEGORIES = ["spa", "coffee", "food", "retail"] as const;

// Payers that create an amount owed back (owner fronted the money, or bought on
// credit from a creditor). "staff_card"/"personal" kept for legacy rows.
export const REIMBURSABLE_PAYERS = [
  "owner_mg",
  "owner_hll",
  "owner_ky",
  "creditor",
  "staff_card",
  "personal",
];

// Operating window for occupancy grid (10:00–20:00).
export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 20;

export type ChairStatus = "free" | "running" | "resting";
export type SessionStatus = "running" | "resting" | "completed";

// Supplier-side debit/credit notes. A debit note claims money back from a
// supplier; a credit note records a reduction the supplier has granted us.
export const NOTE_TYPES = [
  { value: "debit", label: "Debit note" },
  { value: "credit", label: "Credit note" },
] as const;

export const NOTE_REASONS = [
  "goods_returned",
  "damaged_or_faulty",
  "overcharged",
  "short_delivery",
  "price_adjustment",
  "cancelled_order",
  "other",
] as const;
