import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACCOUNT_TYPES,
  STATEMENT_GROUPS,
  CSV_COLUMNS,
  defaultNormalBalance,
  isValidCode,
  parseCsv,
  statementGroupForCode,
} from "@/lib/accounts";
import type { Account, AccountType, StatementGroup } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseBool(v: string | undefined, fallback: boolean): boolean {
  const s = (v ?? "").trim().toLowerCase();
  if (["true", "yes", "1"].includes(s)) return true;
  if (["false", "no", "0"].includes(s)) return false;
  return fallback;
}

type ParsedRow = {
  line: number;
  code: string;
  name: string;
  errors: string[];
  account?: Record<string, unknown>;
};

// POST { csv, commit } — validate a CSV upload (preview) and, when there are no
// errors and commit=true, upsert every row by code. All-or-nothing at the
// validation gate: if any row is invalid, nothing is written.
export async function POST(req: Request) {
  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const csv = String(body.csv ?? "");
  const commit = body.commit === true;

  const grid = parseCsv(csv);
  if (grid.length < 2)
    return NextResponse.json(
      { error: "CSV needs a header row and at least one account row." },
      { status: 400 },
    );

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const idx = (col: string) => header.indexOf(col);
  const missing = CSV_COLUMNS.filter(
    (c) => idx(c) === -1 && c !== "sort_order" && c !== "system_locked",
  );
  if (idx("code") === -1 || idx("name") === -1 || idx("account_type") === -1)
    return NextResponse.json(
      {
        error: `Missing required columns. Expected at least: code, name, account_type. Missing: ${missing.join(", ")}`,
      },
      { status: 400 },
    );

  const dataRows = grid.slice(1);
  const cell = (r: string[], col: string) => (idx(col) >= 0 ? (r[idx(col)] ?? "").trim() : "");

  // Codes present in the file, and header codes (file + DB) for parent checks.
  const fileCodes = new Set(dataRows.map((r) => cell(r, "code")));
  const { data: dbAccounts } = await supabase
    .from("accounts")
    .select("code, account_type");
  const dbByCode = new Map(
    ((dbAccounts ?? []) as Pick<Account, "code" | "account_type">[]).map((a) => [
      a.code,
      a.account_type,
    ]),
  );
  const fileHeaderCodes = new Set(
    dataRows
      .filter((r) => cell(r, "account_type") === "header")
      .map((r) => cell(r, "code")),
  );
  const isHeaderCode = (c: string) =>
    fileHeaderCodes.has(c) || dbByCode.get(c) === "header";

  const seen = new Set<string>();
  const parsed: ParsedRow[] = dataRows.map((r, i) => {
    const line = i + 2; // 1-based, +1 for header
    const code = cell(r, "code");
    const name = cell(r, "name");
    const type = cell(r, "account_type") as AccountType;
    const errors: string[] = [];

    if (!isValidCode(code)) errors.push("Code must be exactly four digits.");
    else if (seen.has(code)) errors.push(`Duplicate code ${code} in file.`);
    seen.add(code);

    if (!name) errors.push("Name is required.");
    if (!ACCOUNT_TYPES.some((t) => t.value === type))
      errors.push(`Invalid account type "${type}".`);

    let sg = cell(r, "statement_group") as StatementGroup;
    if (!sg) sg = statementGroupForCode(code);
    else if (!STATEMENT_GROUPS.some((g) => g.value === sg))
      errors.push(`Invalid statement group "${sg}".`);

    let normal: string | null = cell(r, "normal_balance") || null;
    if (type === "header") normal = null;
    else if (!normal) normal = defaultNormalBalance(type);
    if (normal && !["debit", "credit"].includes(normal))
      errors.push(`Normal balance must be debit or credit (got "${normal}").`);

    const parent = cell(r, "parent_code") || null;
    if (parent) {
      if (!fileCodes.has(parent) && !dbByCode.has(parent))
        errors.push(`Parent ${parent} does not exist.`);
      else if (!isHeaderCode(parent))
        errors.push(`Parent ${parent} must be a header account.`);
    }

    const sortRaw = cell(r, "sort_order");
    const sort_order = /^\d+$/.test(sortRaw)
      ? parseInt(sortRaw, 10)
      : parseInt(code, 10) || 0;

    const account = {
      code,
      name,
      account_type: type,
      normal_balance: normal,
      parent_code: parent,
      description: cell(r, "description") || null,
      is_postable: parseBool(cell(r, "is_postable"), type !== "header"),
      is_active: parseBool(cell(r, "is_active"), true),
      system_locked: parseBool(cell(r, "system_locked"), false),
      statement_group: sg,
      sort_order,
    };

    return { line, code, name, errors, account: errors.length ? undefined : account };
  });

  const errorCount = parsed.filter((p) => p.errors.length).length;
  const toInsert = parsed.filter((p) => p.account && !dbByCode.has(p.code)).length;
  const toUpdate = parsed.filter((p) => p.account && dbByCode.has(p.code)).length;
  const summary = {
    total: parsed.length,
    errors: errorCount,
    toInsert,
    toUpdate,
    rows: parsed.map(({ line, code, name, errors }) => ({ line, code, name, errors })),
  };

  if (!commit) return NextResponse.json({ preview: summary });

  if (errorCount > 0)
    return NextResponse.json(
      { error: `${errorCount} row(s) have errors — nothing was imported.`, preview: summary },
      { status: 400 },
    );

  const payload = parsed.map((p) => p.account!) as Record<string, unknown>[];
  const { error } = await supabase
    .from("accounts")
    .upsert(payload, { onConflict: "code" });
  if (error)
    return NextResponse.json({ error: error.message, preview: summary }, { status: 400 });

  await supabase.from("account_audit").insert({
    action: "imported",
    detail: { total: payload.length, inserted: toInsert, updated: toUpdate },
  });

  return NextResponse.json({ ok: true, imported: payload.length, preview: summary });
}
