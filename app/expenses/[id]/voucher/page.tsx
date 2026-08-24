import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PettyCashVoucher } from "@/components/PettyCashVoucher";
import type { Expense, Reimbursement } from "@/lib/types";

export const dynamic = "force-dynamic";

// Printable petty cash voucher for a purchase someone fronted out of their own
// pocket. Reached from the Purchases tab; the PV number and the date come from
// the linked reimbursement (the voucher is dated the day the money moved back).
export default async function VoucherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();
  if (!expense) notFound();

  const { data: reimbursement } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("expense_id", id)
    .maybeSingle();

  return (
    <PettyCashVoucher
      expense={expense as Expense}
      reimbursement={(reimbursement as Reimbursement) ?? null}
    />
  );
}
