import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ACCOUNT_TYPES,
  defaultNormalBalance,
  isValidCode,
  statementGroupForCode,
} from "@/lib/accounts";
import type { Account, AccountType } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — the full chart, ordered as a tree (by code).
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("sort_order");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ accounts: (data ?? []) as Account[] });
}

// POST — create a new account (leaf or header).
export async function POST(req: Request) {
  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();
  const name = String(body.name ?? "").trim();
  const account_type = String(body.account_type ?? "") as AccountType;

  if (!isValidCode(code))
    return NextResponse.json(
      { error: "Code must be exactly four digits." },
      { status: 400 },
    );
  if (!name)
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!ACCOUNT_TYPES.some((t) => t.value === account_type))
    return NextResponse.json(
      { error: "Invalid account type." },
      { status: 400 },
    );

  const { data: existing } = await supabase
    .from("accounts")
    .select("code, account_type, parent_code, name")
    .or(`code.eq.${code},code.eq.${body.parent_code ?? "____"}`);
  const rows = (existing ?? []) as Pick<
    Account,
    "code" | "account_type" | "parent_code" | "name"
  >[];

  if (rows.some((r) => r.code === code))
    return NextResponse.json(
      { error: `Code ${code} already exists.` },
      { status: 409 },
    );

  const parent_code = body.parent_code ? String(body.parent_code) : null;
  if (parent_code) {
    const parent = rows.find((r) => r.code === parent_code);
    if (!parent)
      return NextResponse.json(
        { error: `Parent ${parent_code} does not exist.` },
        { status: 400 },
      );
    if (parent.account_type !== "header")
      return NextResponse.json(
        { error: `Parent ${parent_code} must be a header account.` },
        { status: 400 },
      );
  }

  const is_postable = account_type !== "header";
  const normal_balance =
    account_type === "header"
      ? null
      : (body.normal_balance ?? defaultNormalBalance(account_type));
  if (normal_balance && !["debit", "credit"].includes(normal_balance))
    return NextResponse.json(
      { error: "Normal balance must be debit or credit." },
      { status: 400 },
    );

  const insert = {
    code,
    name,
    account_type,
    normal_balance,
    parent_code,
    description: body.description ? String(body.description) : null,
    is_postable,
    is_active: body.is_active === false ? false : true,
    system_locked: false,
    statement_group: statementGroupForCode(code),
    sort_order: parseInt(code, 10),
  };

  const { data, error } = await supabase
    .from("accounts")
    .insert(insert)
    .select()
    .single();
  if (error) {
    const msg =
      error.code === "23505"
        ? "An account with that name already exists under this parent."
        : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  await supabase.from("account_audit").insert({
    account_id: data.id,
    account_code: code,
    action: "created",
    detail: insert,
  });

  return NextResponse.json({ account: data as Account });
}
