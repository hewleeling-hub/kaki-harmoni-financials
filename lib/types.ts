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
  expense_date: string;
  vendor: string;
  description: string | null;
  amount: number;
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
};

export type Reimbursement = {
  id: string;
  user_id: string | null;
  created_at: string;
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
