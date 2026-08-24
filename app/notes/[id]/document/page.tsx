import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { SupplierNoteDocument } from "@/components/SupplierNoteDocument";
import type { Expense, SupplierNote } from "@/lib/types";

export const dynamic = "force-dynamic";

// Printable debit/credit note, reached from the Notes register.
export default async function NoteDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: note } = await supabase
    .from("supplier_notes")
    .select("*")
    .eq("id", id)
    .single();
  if (!note) notFound();

  let expense: Expense | null = null;
  if (note.expense_id) {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", note.expense_id)
      .maybeSingle();
    expense = (data as Expense) ?? null;
  }

  return (
    <SupplierNoteDocument note={note as SupplierNote} expense={expense} />
  );
}
