import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { JournalVoucher } from "@/components/JournalVoucher";
import type { Journal, JournalLine, Account } from "@/lib/types";

export const dynamic = "force-dynamic";

// Printable voucher for a journal entry. Reached from the Ledger; the PDF of
// the same document is at /api/journals/[id]/voucher-pdf.
export default async function JournalVoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: journal } = await supabase
    .from("journals")
    .select("*")
    .eq("id", id)
    .single();
  if (!journal) notFound();

  const { data: lineRows } = await supabase
    .from("journal_lines")
    .select("*")
    .eq("journal_id", id)
    .order("line_no");
  const rows = (lineRows ?? []) as JournalLine[];

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
  return (
    <JournalVoucher
      id={j.id}
      jvNumber={j.jv_number}
      entryDate={j.entry_date}
      memo={j.memo}
      reference={j.reference}
      lines={rows.map((l) => ({
        account_code: l.account_code,
        account_name: nameByCode.get(l.account_code) ?? l.account_code,
        debit: Number(l.debit),
        credit: Number(l.credit),
        memo: l.memo,
      }))}
    />
  );
}
