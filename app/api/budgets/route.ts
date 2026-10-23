import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Account, Budget } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET ?year=YYYY — budgets for that fiscal year.
export async function GET(req: Request) {
  const supabase = createAdminClient();
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getUTCFullYear();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("fiscal_year", year);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budgets: (data ?? []) as Budget[] });
}

// PUT — set the budget for one account, one fiscal year, one month (upsert).
// Omit month to set a flat figure that applies to every month of the year.
export async function PUT(req: Request) {
  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const account_code = String(body.account_code ?? "").trim();
  const fiscal_year = Number(body.fiscal_year);
  const amount = Math.round(Number(body.amount) * 100) / 100;
  const month =
    body.month === null || body.month === undefined ? null : Number(body.month);

  if (!account_code || !Number.isInteger(fiscal_year))
    return NextResponse.json({ error: "account_code and fiscal_year are required." }, { status: 400 });
  if (month !== null && (!Number.isInteger(month) || month < 1 || month > 12))
    return NextResponse.json({ error: "month must be 1-12, or omitted." }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0)
    return NextResponse.json({ error: "Amount must be zero or positive." }, { status: 400 });

  const { data: acc } = await supabase
    .from("accounts")
    .select("code, is_postable")
    .eq("code", account_code)
    .single();
  if (!acc)
    return NextResponse.json({ error: `Account ${account_code} does not exist.` }, { status: 400 });
  if (!(acc as Pick<Account, "is_postable">).is_postable)
    return NextResponse.json({ error: "Budgets can only be set on postable (leaf) accounts." }, { status: 400 });

  const { data, error } = await supabase
    .from("budgets")
    .upsert(
      { account_code, fiscal_year, month, amount, updated_at: new Date().toISOString() },
      { onConflict: "account_code,fiscal_year,month" },
    )
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ budget: data as Budget });
}
