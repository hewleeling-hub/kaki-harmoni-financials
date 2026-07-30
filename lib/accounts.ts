// Chart of Accounts helpers — shared by the API routes and the UI. Pure
// functions only (no DB), safe to import on client or server.
import type {
  Account,
  AccountType,
  NormalBalance,
  StatementGroup,
} from "./types";

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "header", label: "Header" },
  { value: "asset", label: "Asset" },
  { value: "contra_asset", label: "Contra-Asset" },
  { value: "liability", label: "Liability" },
  { value: "equity", label: "Equity" },
  { value: "revenue", label: "Revenue" },
  { value: "contra_revenue", label: "Contra-Revenue" },
  { value: "expense", label: "Expense" },
  { value: "other_income", label: "Other Income" },
];

export const STATEMENT_GROUPS: { value: StatementGroup; label: string }[] = [
  { value: "balance_sheet", label: "Balance Sheet" },
  { value: "profit_loss", label: "Profit & Loss" },
  { value: "control", label: "Control" },
];

export function typeLabel(t: AccountType): string {
  return ACCOUNT_TYPES.find((x) => x.value === t)?.label ?? t;
}

export function statementGroupLabel(g: StatementGroup): string {
  return STATEMENT_GROUPS.find((x) => x.value === g)?.label ?? g;
}

// The normal balance implied by a type (headers carry none).
export function defaultNormalBalance(t: AccountType): NormalBalance {
  switch (t) {
    case "header":
      return null;
    case "asset":
    case "expense":
    case "contra_revenue":
      return "debit";
    case "liability":
    case "equity":
    case "revenue":
    case "other_income":
    case "contra_asset":
      return "credit";
    default:
      return null;
  }
}

// Statement group implied by the 4-digit code range.
export function statementGroupForCode(code: string): StatementGroup {
  const n = parseInt(code, 10);
  if (n >= 9000) return "control";
  if (n >= 4000) return "profit_loss";
  return "balance_sheet";
}

export function isValidCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

// ── CSV (same column order as the seed) ─────────────────────────────────────
export const CSV_COLUMNS = [
  "code",
  "name",
  "account_type",
  "normal_balance",
  "parent_code",
  "description",
  "is_postable",
  "is_active",
  "system_locked",
  "statement_group",
  "sort_order",
] as const;

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function accountsToCsv(rows: Account[]): string {
  const head = CSV_COLUMNS.join(",");
  const body = rows
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) =>
      CSV_COLUMNS.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","),
    )
    .join("\n");
  return `${head}\n${body}\n`;
}

// Minimal RFC-4180-ish parser: handles quoted fields, escaped quotes, commas
// and newlines inside quotes. Returns an array of rows of string cells.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// ── Tree ────────────────────────────────────────────────────────────────────
export type AccountNode = Account & { depth: number };

// Flatten into pre-order (parents before children) with a depth for indenting.
// Codes are hierarchical, so sort_order already yields pre-order; depth is the
// length of the parent chain.
export function withDepth(accounts: Account[]): AccountNode[] {
  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const depthOf = (a: Account): number => {
    let d = 0;
    let cur = a.parent_code;
    const seen = new Set<string>();
    while (cur && byCode.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      d++;
      cur = byCode.get(cur)!.parent_code;
    }
    return d;
  };
  return accounts
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((a) => ({ ...a, depth: depthOf(a) }));
}

// Ancestor codes of an account, nearest first.
export function ancestorCodes(
  code: string,
  byCode: Map<string, Account>,
): string[] {
  const out: string[] = [];
  let cur = byCode.get(code)?.parent_code ?? null;
  const seen = new Set<string>();
  while (cur && byCode.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = byCode.get(cur)!.parent_code;
  }
  return out;
}
