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

// PUT — set the monthly budget for one account in one fiscal year (upsert).
export async function PUT(req: Request) {
  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const account_code = String(body.account_code ?? "").trim();
  const fiscal_year = Number(body.fiscal_year);
  const amount = Math.round(Number(body.amount) * 100) / 100;

  if (!account_code || !Number.isInteger(fiscal_year))
    return NextResponse.json({ error: "account_code and fiscal_year are required." }, { status: 400 });
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
      { account_code, fiscal_year, amount, updated_at: new Date().toISOString() },
      { onConflict: "account_code,fiscal_year" },
    )
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ budget: data as Budget });
}
