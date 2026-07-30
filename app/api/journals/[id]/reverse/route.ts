import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { today } from "@/lib/format";
import type { Journal, JournalLine } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST — reverse a journal by posting a mirror entry (debits ↔ credits) and
// linking the two. A journal is never mutated or deleted, so the audit trail
// stays intact.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: original } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .single();
  if (!original)
    return NextResponse.json({ error: "Journal not found." }, { status: 404 });
  const orig = original as Journal;
  if (orig.reversed_by)
    return NextResponse.json({ error: "This journal has already been reversed." }, { status: 409 });
  if (orig.source === "reversal")
    return NextResponse.json({ error: "A reversal cannot itself be reversed." }, { status: 409 });

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("*")
    .eq("journal_id", id)
    .order("line_no");
  const orig_lines = (lines ?? []) as JournalLine[];
  if (!orig_lines.length)
    return NextResponse.json({ error: "Journal has no lines." }, { status: 400 });

  const { data: rev, error: rErr } = await supabase
    .from("journals")
    .insert({
      entry_date: today(),
      memo: `Reversal of ${orig.memo ?? orig.id.slice(0, 8)}`,
      reference: orig.reference,
      source: "reversal",
      reverses: orig.id,
    })
    .select()
    .single();
  if (rErr || !rev)
    return NextResponse.json({ error: rErr?.message ?? "Could not create reversal." }, { status: 400 });

  const revLines = orig_lines.map((l, i) => ({
    journal_id: rev.id,
    line_no: i + 1,
    account_code: l.account_code,
    debit: Number(l.credit),
    credit: Number(l.debit),
    memo: l.memo,
  }));
  const { error: lErr } = await supabase.from("journal_lines").insert(revLines);
  if (lErr) {
    await supabase.from("journals").delete().eq("id", rev.id);
    return NextResponse.json({ error: lErr.message }, { status: 400 });
  }

  await supabase.from("journals").update({ reversed_by: rev.id }).eq("id", orig.id);
  return NextResponse.json({ reversal: rev });
}
