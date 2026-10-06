import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildJournalVoucherPdf,
  unsupportedCharacters,
  type VoucherLine,
} from "@/lib/journalVoucherPdf";
import type { Journal, JournalLine, Account } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/journals/[id]/voucher-pdf — the journal entry as a signable A4 PDF.
// The ledger says what happened; this is the paper that says who authorised it.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: journal } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .single();
  if (!journal)
    return NextResponse.json({ error: "Journal not found." }, { status: 404 });

  const { data: lineRows } = await supabase
    .from("journal_lines")
    .select("*")
    .eq("journal_id", id)
    .order("line_no");
  const rows = (lineRows ?? []) as JournalLine[];

  // Name every account on the voucher — a code alone means nothing to whoever
  // signs it.
  const codes = [...new Set(rows.map((l) => l.account_code))];
  const { data: accountRows } = await supabase
    .from("accounts")
    .select("code, name")
    .in("code", codes.length ? codes : ["__none__"]);
  const nameByCode = new Map(
    ((accountRows ?? []) as Pick<Account, "code" | "name">[]).map((a) => [
      a.code,
      a.name,
    ]),
  );

  const j = journal as Journal;
  const lines: VoucherLine[] = rows.map((l) => ({
    account_code: l.account_code,
    account_name: nameByCode.get(l.account_code) ?? l.account_code,
    debit: Number(l.debit),
    credit: Number(l.credit),
    memo: l.memo,
  }));

  // Refuse rather than print a voucher with a blank line: the bundled font
  // covers Latin, Cyrillic and Greek but not CJK.
  const missing = unsupportedCharacters([
    j.memo ?? "",
    j.reference ?? "",
    ...lines.flatMap((l) => [l.account_name, l.memo ?? ""]),
  ]);
  if (missing.length)
    return NextResponse.json(
      {
        error: `This voucher contains characters the PDF font cannot render (${missing.join(" ")}). Use the Print button and choose "Save as PDF" instead.`,
      },
      { status: 422 },
    );

  const pdf = await buildJournalVoucherPdf({
    jv_number: j.jv_number,
    entry_date: j.entry_date,
    memo: j.memo,
    reference: j.reference,
    source: j.source,
    lines,
  });

  const name = (j.jv_number ?? "journal").replace(/[^A-Za-z0-9-]/g, "");
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}-journal-voucher.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
