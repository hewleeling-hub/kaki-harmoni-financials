import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Account, Journal, JournalLine } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — recent journals with their lines attached.
export async function GET() {
  const supabase = createAdminClient();
  const { data: journals, error } = await supabase
    .from("journals")
    .select("*")
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (journals ?? []).map((j) => j.id);
  let lines: JournalLine[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("journal_lines")
      .select("*")
      .in("journal_id", ids)
      .order("line_no");
    lines = (data ?? []) as JournalLine[];
  }
  const byJournal = new Map<string, JournalLine[]>();
  for (const l of lines) {
    const arr = byJournal.get(l.journal_id) ?? [];
    arr.push(l);
    byJournal.set(l.journal_id, arr);
  }
  const out = (journals ?? []).map((j: Journal) => ({
    ...j,
    lines: byJournal.get(j.id) ?? [],
  }));
  return NextResponse.json({ journals: out });
}

type LineInput = {
  account_code?: string;
  debit?: number | string;
  credit?: number | string;
  memo?: string | null;
};

const money = (v: number | string | undefined) => {
  const n = Math.round(Number(v ?? 0) * 100) / 100;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

// POST — create a balanced journal. Body: { entry_date, memo?, reference?, lines[] }.
export async function POST(req: Request) {
  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const entry_date = String(body.entry_date ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry_date))
    return NextResponse.json({ error: "A valid entry date is required." }, { status: 400 });

  const rawLines = (Array.isArray(body.lines) ? body.lines : []) as LineInput[];
  const lines = rawLines
    .map((l) => ({
      account_code: String(l.account_code ?? "").trim(),
      debit: money(l.debit),
      credit: money(l.credit),
      memo: l.memo ? String(l.memo) : null,
    }))
    .filter((l) => l.account_code && (l.debit > 0 || l.credit > 0));

  if (lines.length < 2)
    return NextResponse.json(
      { error: "A journal needs at least two lines." },
      { status: 400 },
    );

  for (const l of lines) {
    if (l.debit > 0 && l.credit > 0)
      return NextResponse.json(
        { error: `Line ${l.account_code}: put an amount in debit OR credit, not both.` },
        { status: 400 },
      );
  }

  const totalDebit = Math.round(lines.reduce((a, l) => a + l.debit, 0) * 100) / 100;
  const totalCredit = Math.round(lines.reduce((a, l) => a + l.credit, 0) * 100) / 100;
  if (totalDebit <= 0)
    return NextResponse.json({ error: "The journal has no amounts." }, { status: 400 });
  if (Math.abs(totalDebit - totalCredit) >= 0.005)
    return NextResponse.json(
      {
        error: `Not balanced — debits ${totalDebit.toFixed(2)} ≠ credits ${totalCredit.toFixed(2)}.`,
      },
      { status: 400 },
    );

  // Validate every account is a real, active, postable leaf.
  const codes = [...new Set(lines.map((l) => l.account_code))];
  const { data: accs } = await supabase
    .from("accounts")
    .select("code, is_postable, is_active")
    .in("code", codes);
  const byCode = new Map(
    ((accs ?? []) as Pick<Account, "code" | "is_postable" | "is_active">[]).map((a) => [
      a.code,
      a,
    ]),
  );
  for (const code of codes) {
    const a = byCode.get(code);
    if (!a) return NextResponse.json({ error: `Account ${code} does not exist.` }, { status: 400 });
    if (!a.is_postable)
      return NextResponse.json({ error: `Account ${code} is a header — postings must go to a leaf account.` }, { status: 400 });
    if (!a.is_active)
      return NextResponse.json({ error: `Account ${code} is inactive.` }, { status: 400 });
  }

  const { data: journal, error: jErr } = await supabase
    .from("journals")
    .insert({
      entry_date,
      memo: body.memo ? String(body.memo) : null,
      reference: body.reference ? String(body.reference) : null,
      source: "manual",
    })
    .select()
    .single();
  if (jErr || !journal)
    return NextResponse.json({ error: jErr?.message ?? "Could not create journal." }, { status: 400 });

  const lineRows = lines.map((l, i) => ({ ...l, journal_id: journal.id, line_no: i + 1 }));
  const { error: lErr } = await supabase.from("journal_lines").insert(lineRows);
  if (lErr) {
    // Roll back the header so we never leave an empty/partial journal.
    await supabase.from("journals").delete().eq("id", journal.id);
    return NextResponse.json({ error: lErr.message }, { status: 400 });
  }

  return NextResponse.json({ journal });
}
