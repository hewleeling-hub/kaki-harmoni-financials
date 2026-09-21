import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monthEnd, monthLabel, monthStart, round2 } from "@/lib/amortisation";
import { amortisationRows, chargeableRows, monthsDue } from "@/lib/amortisationServer";
import { today } from "@/lib/format";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/amortisation?through=YYYY-MM — every prepayment with a term, what it
// has released so far and what is due up to that month.
export async function GET(req: Request) {
  const asked = new URL(req.url).searchParams.get("through") ?? today();
  if (!/^\d{4}-\d{2}/.test(asked))
    return NextResponse.json({ error: "A valid month is required." }, { status: 400 });
  const through = monthStart(asked);

  const supabase = createAdminClient();
  const rows = await amortisationRows(supabase, through);

  return NextResponse.json({
    through,
    label: monthLabel(through),
    rows,
    due: monthsDue(rows),
    dueTotal: round2(
      chargeableRows(rows).reduce((a, r) => a + r.outstandingTotal, 0),
    ),
  });
}

// POST /api/amortisation — release every month due up to `through`.
//
//   Dr  expense account (6440 / 6510 / 6520 …)   one month's share
//       Cr  prepaid account (1350 / 1340)                   one month's share
//
// One journal per month, with a line pair per prepayment, so the ledger reads
// as one month-end entry rather than a scatter of tiny ones.
// Body: { through, accounts?: { <expense id>: "<account code>" } }
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const asked = String(body.through ?? today());
  if (!/^\d{4}-\d{2}/.test(asked))
    return NextResponse.json({ error: "A valid month is required." }, { status: 400 });
  const through = monthStart(asked);
  const chosen = (body.accounts ?? {}) as Record<string, string>;

  const supabase = createAdminClient();

  // Remember the user's choice on the purchase, so next month needs no picking.
  for (const [expenseId, code] of Object.entries(chosen)) {
    if (!code) continue;
    await supabase
      .from("expenses")
      .update({ amortisation_account: String(code).trim() })
      .eq("id", expenseId);
  }

  const rows = await amortisationRows(supabase, through);
  const due = chargeableRows(rows);
  if (!due.length)
    return NextResponse.json(
      {
        error: `Nothing is due up to ${monthLabel(through)}. Anything still sitting in prepaid is either already up to date, unposted, or has no term recorded.`,
      },
      { status: 400 },
    );

  const needsAccount = due.filter((r) => !r.expenseAccount);
  if (needsAccount.length)
    return NextResponse.json(
      {
        error: `Choose the account to charge for: ${needsAccount
          .map((r) => r.expense.po_number ?? r.expense.vendor)
          .join(", ")}.`,
        needsAccount: needsAccount.map((r) => r.expense.id),
      },
      { status: 400 },
    );

  // Every account must be a real, active, postable leaf — the same rule the
  // manual journal route enforces — and the two sides must differ, or the entry
  // would say nothing.
  const codes = [
    ...new Set(due.flatMap((r) => [r.expenseAccount!, r.prepaidAccount!])),
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
    if (r.expenseAccount === r.prepaidAccount)
      return NextResponse.json(
        {
          error: `${r.expense.po_number ?? r.expense.vendor}: the charge account and the prepaid account are the same (${r.prepaidAccount}), so the entry would say nothing.`,
        },
        { status: 400 },
      );
  }

  // Group the months due across all prepayments: one journal per month.
  const periods = [
    ...new Set(due.flatMap((r) => r.outstanding.map((m) => m.period))),
  ].sort();

  const journals = [];
  let charged = 0;

  for (const period of periods) {
    const slices = due
      .map((r) => ({
        row: r,
        month: r.outstanding.find((m) => m.period === period),
      }))
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
    }));
    const { data: claimed, error: cErr } = await supabase
      .from("subscription_charges")
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
        memo: `Amortisation — ${monthLabel(period)}`,
        reference: `AMORT-${period.slice(0, 7)}`,
        source: "amortisation",
      })
      .select()
      .single();
    if (jErr || !journal) {
      await supabase
        .from("subscription_charges")
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
        memo: `${s.row.expense.vendor} — ${monthLabel(period)}`,
      })),
      ...slices.map((s, i) => ({
        journal_id: journal.id,
        line_no: slices.length + i + 1,
        account_code: s.row.prepaidAccount!,
        debit: 0,
        credit: s.month!.amount,
        memo: `${s.row.expense.vendor} — prepaid released`,
      })),
    ];

    const { error: lErr } = await supabase.from("journal_lines").insert(lines);
    if (lErr) {
      // Never leave a header with no lines, or a claimed month with no entry.
      await supabase.from("journals").delete().eq("id", journal.id);
      await supabase
        .from("subscription_charges")
        .delete()
        .in("id", (claimed ?? []).map((c) => c.id));
      return NextResponse.json({ error: lErr.message }, { status: 400 });
    }

    await supabase
      .from("subscription_charges")
      .update({ journal_id: journal.id })
      .in("id", (claimed ?? []).map((c) => c.id));

    journals.push({ ...journal, period, label: monthLabel(period) });
    charged = round2(charged + slices.reduce((a, s) => a + s.month!.amount, 0));
  }

  return NextResponse.json({ journals, charged }, { status: 201 });
}
