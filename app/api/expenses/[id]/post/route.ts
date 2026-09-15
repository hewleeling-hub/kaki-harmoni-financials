import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { postingMemo, postingReference, suggestPosting } from "@/lib/posting";
import type { Account, Expense, Reimbursement } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/expenses/[id]/post — the proposed entry for review, plus whether
// this purchase has already reached the books.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();
  if (!expense)
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });

  const { data: journal } = await supabase
    .from("journals")
    .select("id, entry_date, reference, memo")
    .eq("expense_id", id)
    .maybeSingle();

  const e = expense as Expense;
  return NextResponse.json({
    expense: e,
    posted: journal ?? null,
    suggestion: suggestPosting(e),
    reference: postingReference(e),
    memo: postingMemo(e),
  });
}

// POST /api/expenses/[id]/post — write the double entry.
// Body: { debit_account, credit_account }. Both are required: the suggestion is
// a starting point for the user, never something this route assumes on its own.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const debit_account = String(body.debit_account ?? "").trim();
  const credit_account = String(body.credit_account ?? "").trim();

  if (!debit_account || !credit_account)
    return NextResponse.json(
      { error: "Choose both an expense account and a source of funds." },
      { status: 400 },
    );
  if (debit_account === credit_account)
    return NextResponse.json(
      { error: "The two sides must be different accounts." },
      { status: 400 },
    );

  const supabase = createAdminClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();
  if (!expense)
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });
  const e = expense as Expense;

  const amount = Math.round(Number(e.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json(
      { error: "This purchase has no amount to post." },
      { status: 400 },
    );

  // Already posted? Say so rather than writing a second entry — the unique
  // index would reject it anyway, but the message should be useful.
  const { data: existing } = await supabase
    .from("journals")
    .select("id, reference")
    .eq("expense_id", id)
    .maybeSingle();
  if (existing)
    return NextResponse.json(
      {
        error: `Already posted as ${existing.reference ?? existing.id}. Reverse that entry in the Ledger if it needs changing.`,
      },
      { status: 409 },
    );

  // Both accounts must be real, active, postable leaves — same rule the manual
  // journal route enforces.
  const { data: accs } = await supabase
    .from("accounts")
    .select("code, name, is_postable, is_active")
    .in("code", [debit_account, credit_account]);
  const byCode = new Map(
    ((accs ?? []) as Pick<Account, "code" | "name" | "is_postable" | "is_active">[]).map(
      (a) => [a.code, a],
    ),
  );
  for (const code of [debit_account, credit_account]) {
    const a = byCode.get(code);
    if (!a)
      return NextResponse.json({ error: `Account ${code} does not exist.` }, { status: 400 });
    if (!a.is_postable)
      return NextResponse.json(
        { error: `${code} is a header account — post to a leaf account.` },
        { status: 400 },
      );
    if (!a.is_active)
      return NextResponse.json({ error: `Account ${code} is inactive.` }, { status: 400 });
  }

  // Date the entry when the money moved: the day it was reimbursed if someone
  // fronted it, otherwise the purchase date.
  const { data: reimb } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("expense_id", id)
    .maybeSingle();
  const r = (reimb as Reimbursement) ?? null;
  const entry_date =
    r?.settled_at ? String(r.settled_at).slice(0, 10) : e.expense_date;

  const { data: journal, error: jErr } = await supabase
    .from("journals")
    .insert({
      entry_date,
      memo: postingMemo(e),
      reference: postingReference(e) || null,
      source: "expense",
      expense_id: id,
    })
    .select()
    .single();
  if (jErr || !journal)
    return NextResponse.json(
      { error: jErr?.message ?? "Could not create the journal." },
      { status: 400 },
    );

  const { error: lErr } = await supabase.from("journal_lines").insert([
    {
      journal_id: journal.id,
      line_no: 1,
      account_code: debit_account,
      debit: amount,
      credit: 0,
      memo: byCode.get(debit_account)?.name ?? null,
    },
    {
      journal_id: journal.id,
      line_no: 2,
      account_code: credit_account,
      debit: 0,
      credit: amount,
      memo: byCode.get(credit_account)?.name ?? null,
    },
  ]);
  if (lErr) {
    // Never leave a header with no lines behind.
    await supabase.from("journals").delete().eq("id", journal.id);
    return NextResponse.json({ error: lErr.message }, { status: 400 });
  }

  return NextResponse.json({ journal }, { status: 201 });
}
