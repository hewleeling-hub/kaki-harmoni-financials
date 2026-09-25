// DB row shapes — mirror supabase/migrations/0001_init.sql.

export type Chair = {
  id: string;
  user_id: string | null;
  created_at: string;
  label: string;
  status: "free" | "running" | "resting";
  current_session_id: string | null;
};

export type Product = {
  id: string;
  user_id: string | null;
  created_at: string;
  name: string;
  category: string;
  cost_price: number;
  standalone_price: number;
  bundle_allocation: number;
  is_active: boolean;
};

export type Session = {
  id: string;
  user_id: string | null;
  created_at: string;
  chair_id: string;
  started_at: string;
  spa_ends_at: string | null;
  rest_ends_at: string | null;
  status: "running" | "resting" | "completed";
  notes: string | null;
};

export type Sale = {
  id: string;
  user_id: string | null;
  created_at: string;
  session_id: string | null;
  sale_date: string;
  payment_method: string;
  total_amount: number;
  is_bundle: boolean;
  notes: string | null;
};

export type SaleItem = {
  id: string;
  user_id: string | null;
  created_at: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  is_bundle_split: boolean;
};

export type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
};

export type Expense = {
  id: string;
  user_id: string | null;
  created_at: string;
  po_number: string | null;
  // Set only for cash paid straight from the tin (payer = 'petty_cash');
  // reimbursed purchases carry their PV number on the reimbursement row.
  pv_number: string | null;
  // Term of a prepaid subscription, in months from expense_date. Null otherwise.
  subscription_months: number | null;
  // Account a subscription's monthly slice is charged to, once chosen.
  amortisation_account: string | null;
  // Fixed assets: useful life in months, when it was put to use, what it is
  // expected to be worth at the end, and the two sides of the monthly entry.
  depreciation_months: number | null;
  depreciation_start: string | null;
  residual_value: number;
  depreciation_account: string | null;
  accumulated_account: string | null;
  expense_date: string;
  vendor: string;
  description: string | null;
  amount: number;
  // Discount given on the purchase. `amount` is already net of it.
  discount: number;
  line_items?: LineItem[];
  category: string;
  payer: string;
  expense_type: string;
  is_settled: boolean;
  receipt_url: string | null;
  ai_category: string | null;
  ai_category_source: string | null;
  ai_category_confidence: number | null;
  ai_category_review_status: string | null;
  comments?: string | null;
  // Attached by GET /api/expenses — true once a journal posts this purchase.
  posted?: boolean;
};

export type Reimbursement = {
  id: string;
  user_id: string | null;
  created_at: string;
  pv_number: string | null;
  expense_id: string;
  owed_to: string;
  amount: number;
  is_settled: boolean;
  settled_at: string | null;
};

// Chair joined with its live session (for the board).
export type ChairWithSession = Chair & {
  session: Session | null;
};

// ── Chart of Accounts (0004) ────────────────────────────────────────────────
export type AccountType =
  | "header"
  | "asset"
  | "contra_asset"
  | "liability"
  | "equity"
  | "revenue"
  | "contra_revenue"
  | "expense"
  | "other_income";

export type NormalBalance = "debit" | "credit" | null;
export type StatementGroup = "balance_sheet" | "profit_loss" | "control";

export type Account = {
  id: string;
  user_id: string | null;
  code: string;
  name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  parent_code: string | null;
  description: string | null;
  is_postable: boolean;
  is_active: boolean;
  system_locked: boolean;
  statement_group: StatementGroup;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// ── Double-entry ledger (0005) ──────────────────────────────────────────────
export type Journal = {
  id: string;
  user_id: string | null;
  entry_date: string; // YYYY-MM-DD
  memo: string | null;
  reference: string | null;
  source: string; // manual | reversal | sale | expense | adjustment
  reverses: string | null;
  reversed_by: string | null;
  created_at: string;
};

export type JournalLine = {
  id: string;
  journal_id: string;
  line_no: number;
  account_code: string;
  debit: number;
  credit: number;
  memo: string | null;
};

// A journal with its lines attached (for lists / detail).
export type JournalWithLines = Journal & { lines: JournalLine[] };

// ── Budget vs Actual (0006) ─────────────────────────────────────────────────
export type Budget = {
  id: string;
  user_id: string | null;
  account_code: string;
  fiscal_year: number;
  amount: number; // monthly budget (RM)
  created_at: string;
  updated_at: string;
};

export type SupplierNoteType = "debit" | "credit";

export type SupplierNote = {
  id: string;
  user_id: string | null;
  created_at: string;
  note_number: string | null;
  note_type: SupplierNoteType;
  note_date: string;
  expense_id: string | null;
  vendor: string;
  amount: number;
  // Where the money goes when the note is settled. Printed on the document so
  // it can be paid from the page itself.
  pay_to_name: string | null;
  pay_to_bank: string | null;
  pay_to_account: string | null;
  /** Storage path of a QR image, served through /api/receipts/view. */
  pay_to_qr_url: string | null;
  reason: string | null;
  description: string | null;
  status: "open" | "applied";
  applied_at: string | null;
};

export type StockTakeLine = {
  id: string;
  stock_take_id: string;
  stock_class: string;
  closing_value: number;
  cogs_account: string | null;
  created_at: string;
};

export type StockTake = {
  id: string;
  user_id: string | null;
  created_at: string;
  take_date: string;
  notes: string | null;
  journal_id: string | null;
  posted_at: string | null;
};

/** A stock class worked out for one take: what came in, what's left, what went. */
export type StockTakeRow = {
  stock_class: string;
  opening: number;
  purchases: number;
  closing: number;
  /** opening + purchases − closing. Negative means the count can't be right. */
  consumed: number;
  inventoryAccount: string | null;
  cogsAccount: string | null;
};

/** One month of a prepaid subscription, released from prepaid to the P&L. */
export type SubscriptionCharge = {
  id: string;
  expense_id: string;
  /** First day of the calendar month charged. */
  period: string;
  amount: number;
  expense_account: string;
  journal_id: string | null;
  created_at: string;
};

/** One month of a fixed asset's cost, written off to the P&L. */
export type DepreciationCharge = {
  id: string;
  expense_id: string;
  /** First day of the calendar month charged. */
  period: string;
  amount: number;
  expense_account: string;
  accumulated_account: string;
  journal_id: string | null;
  created_at: string;
};
