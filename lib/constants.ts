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
  "cost_of_goods",
  "maintenance",
  "utilities",
  "rent",
  "other",
] as const;

export const PAYERS = [
  { value: "company", label: "Company" },
  { value: "personal", label: "Personal (Owner)" },
  { value: "petty_cash", label: "Petty Cash" },
  { value: "staff_card", label: "Staff Card" },
] as const;

export const EXPENSE_TYPES = [
  { value: "expense", label: "Expense" },
  { value: "fixed_asset", label: "Fixed Asset" },
] as const;

export const PRODUCT_CATEGORIES = ["spa", "coffee", "food", "retail"] as const;

// Payers that create a reimbursement (money fronted by a person, owed back).
export const REIMBURSABLE_PAYERS = ["personal", "staff_card"];

// Operating window for occupancy grid (10:00–20:00).
export const OPEN_HOUR = 10;
export const CLOSE_HOUR = 20;

export type ChairStatus = "free" | "running" | "resting";
export type SessionStatus = "running" | "resting" | "completed";
