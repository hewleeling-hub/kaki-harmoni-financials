import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthEnd, monthLabel, monthStart, round2 } from "@/lib/amortisation";
import { chargeableRows, depreciationRows, monthsDue } from "@/lib/depreciationServer";
import { today } from "@/lib/format";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/depreciation?through=YYYY-MM — the asset register: cost, life, what
// has been written off, net book value and what is due up to that month.
export async function GET(req: Request) {
  const asked = new URL(req.url).searchParams.get("through") ?? today();
  if (!/^\d{4}-\d{2}/.test(asked))
    return NextResponse.json({ error: "A valid month is required." }, { status: 400 });
  const through = monthStart(asked);

  const supabase = createAdminClient();
  const rows = await depreciationRows(supabase, through);

  return NextResponse.json({
    through,
    label: monthLabel(through),
    rows,
    due: monthsDue(rows),
    dueTotal: round2(chargeableRows(rows).reduce((a, r) => a + r.outstandingTotal, 0)),
  });
}

// PATCH /api/depreciation — set how an asset depreciates, without posting
// anything. Body: { assets: { <expense id>: { months?, start?, residual?,
// expense_account?, accumulated_account? } } }
//
// Separate from the posting route on purpose: deciding a useful life is a
// judgement the owner makes once, and it should not be bundled into the click
// that writes to the ledger.
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const assets = (body.assets ?? {}) as Record<string, Record<string, unknown>>;
  const supabase = createAdminClient();

  for (const [id, patch] of Object.entries(assets)) {
    const update: Record<string, unknown> = {};

    if (patch.months !== undefined && patch.months !== "") {
      const n = Number(patch.months);
      if (!Number.isInteger(n) || n <= 0 || n > 1200)
        return NextResponse.json(
          { error: "A useful life must be a whole number of months between 1 and 1200." },
          { status: 400 },
        );
      update.depreciation_months = n;
    }
    if (patch.start) {
      const d = String(patch.start).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d))
        return NextResponse.json({ error: "Invalid in-service date." }, { status: 400 });
      update.depreciation_start = d;
    }
    if (patch.residual !== undefined && patch.residual !== "") {
      const n = Number(patch.residual);
      if (!Number.isFinite(n) || n < 0)
        return NextResponse.json(
          { error: "Residual value must be zero or more." },
          { status: 400 },
        );
      update.residual_value = round2(n);
    }
    if (patch.expense_account) update.depreciation_account = String(patch.expense_account);
    if (patch.accumulated_account)
      update.accumulated_account = String(patch.accumulated_account);

    if (Object.keys(update).length) {
      const { error } = await supabase.from("expenses").update(update).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

// POST /api/depreciation — write off every month due up to `through`.
//
//   Dr  depreciation expense (68xx)   one month's share
//       Cr  accumulated depreciation (16xx)      one month's share
//
// One journal per month, with a line pair per asset, so the ledger reads as one
// month-end entry rather than a scatter of tiny ones.
// Body: { through }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const asked = String(body.through ?? today());
  if (!/^\d{4}-\d{2}/.test(asked))
    return NextResponse.json({ error: "A valid month is required." }, { status: 400 });
  const through = monthStart(asked);

  const supabase = createAdminClient();
  const rows = await depreciationRows(supabase, through);
  const due = chargeableRows(rows);
  if (!due.length)
    return NextResponse.json(
      {
        error: `Nothing is due up to ${monthLabel(through)}. Assets are either up to date, unposted, or have no useful life set.`,
      },
      { status: 400 },
    );

  const needsAccount = due.filter((r) => !r.expenseAccount || !r.accumulatedAccount);
  if (needsAccount.length)
    return NextResponse.json(
      {
        error: `Choose the depreciation accounts for: ${needsAccount
          .map((r) => r.expense.po_number ?? r.expense.vendor)
          .join(", ")}.`,
        needsAccount: needsAccount.map((r) => r.expense.id),
      },
      { status: 400 },
    );

  // Every account must be a real, active, postable leaf — the same rule the
  // manual journal route enforces — and the two sides must differ.
  const codes = [
    ...new Set(due.flatMap((r) => [r.expenseAccount!, r.accumulatedAccount!])),
  ];
  const { data: accs } = await supabase
    .from("accounts")
    .select("code, name, is_postable, is_active")
    .in("code", codes);
  const byCode = new Map(
    ((accs ?? []) as Pick<Account, "code" | "name" | "is_postable" | "is_active">[]).map(
      (a) => [a.code, a],
    ),
  );
  for (const code of codes) {
    const a = byCode.get(code);
    if (!a)
      return NextResponse.json({ error: `Account ${code} does not exist.` }, { status: 400 });
    if (!a.is_postable)
      return NextResponse.json(
        { error: `${code} is a header account — charge to a leaf account.` },
        { status: 400 },
      );
    if (!a.is_active)
      return NextResponse.json({ error: `Account ${code} is inactive.` }, { status: 400 });
  }
  for (const r of due) {
    if (r.expenseAccount === r.accumulatedAccount)
      return NextResponse.json(
        {
          error: `${r.expense.po_number ?? r.expense.vendor}: the expense and accumulated accounts are the same (${r.expenseAccount}), so the entry would say nothing.`,
        },
        { status: 400 },
      );
  }

  const periods = [
    ...new Set(due.flatMap((r) => r.outstanding.map((m) => m.period))),
  ].sort();

  const journals = [];
  let charged = 0;

  for (const period of periods) {
    const slices = due
      .map((r) => ({ row: r, month: r.outstanding.find((m) => m.period === period) }))
      .filter((s) => s.month && s.month.amount > 0);
    if (!slices.length) continue;

    // Claim the months first. The unique index on (expense_id, period) is what
    // makes a second run harmless: it fails here, before any journal is
    // written, rather than charging the same month twice.
    const claim = slices.map((s) => ({
      expense_id: s.row.expense.id,
      period,
      amount: s.month!.amount,
      expense_account: s.row.expenseAccount!,
      accumulated_account: s.row.accumulatedAccount!,
    }));
    const { data: claimed, error: cErr } = await supabase
      .from("depreciation_charges")
      .insert(claim)
      .select();
    if (cErr)
      return NextResponse.json(
        {
          error: `${monthLabel(period)} could not be charged: ${cErr.message}. ${journals.length ? "Earlier months in this run were charged." : ""}`.trim(),
        },
        { status: 409 },
      );

    // Date it at month end, but never in the future — a month still running is
    // charged as at today.
    const end = monthEnd(period);
    const entry_date = end > today() ? today() : end;

    const { data: journal, error: jErr } = await supabase
      .from("journals")
      .insert({
        entry_date,
        memo: `Depreciation — ${monthLabel(period)}`,
        reference: `DEPR-${period.slice(0, 7)}`,
        source: "depreciation",
      })
      .select()
      .single();
    if (jErr || !journal) {
      await supabase
        .from("depreciation_charges")
        .delete()
        .in("id", (claimed ?? []).map((c) => c.id));
      return NextResponse.json(
        { error: jErr?.message ?? "Could not create the journal." },
        { status: 400 },
      );
    }

    // Debits first, then the matching credits, so the entry reads top to bottom.
    const lines = [
      ...slices.map((s, i) => ({
        journal_id: journal.id,
        line_no: i + 1,
        account_code: s.row.expenseAccount!,
        debit: s.month!.amount,
        credit: 0,
        memo: `${s.row.expense.po_number ?? s.row.expense.vendor} — ${monthLabel(period)}`,
      })),
      ...slices.map((s, i) => ({
        journal_id: journal.id,
        line_no: slices.length + i + 1,
        account_code: s.row.accumulatedAccount!,
        debit: 0,
        credit: s.month!.amount,
        memo: `${s.row.expense.po_number ?? s.row.expense.vendor} — written down`,
      })),
    ];

    const { error: lErr } = await supabase.from("journal_lines").insert(lines);
    if (lErr) {
      // Never leave a header with no lines, or a claimed month with no entry.
      await supabase.from("journals").delete().eq("id", journal.id);
      await supabase
        .from("depreciation_charges")
        .delete()
        .in("id", (claimed ?? []).map((c) => c.id));
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }

    await supabase
      .from("depreciation_charges")
      .update({ journal_id: journal.id })
      .in("id", (claimed ?? []).map((c) => c.id));

    journals.push({ ...journal, period, label: monthLabel(period) });
    charged = round2(charged + slices.reduce((a, s) => a + s.month!.amount, 0));
  }

  return NextResponse.json({ journals, charged }, { status: 201 });
}
