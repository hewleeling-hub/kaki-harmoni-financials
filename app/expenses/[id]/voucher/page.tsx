import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PurchaseVoucher } from "@/components/PurchaseVoucher";
import type { Expense, Reimbursement } from "@/lib/types";

export const dynamic = "force-dynamic";

// Printable voucher for a purchase someone fronted out of their own pocket, or
// cash handed straight out of the tin. Reached from the Purchases tab; the PV
// number and the date come from the linked reimbursement (the voucher is dated
// the day the money moved back). lib/voucher picks which of the three it is.
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
    <PurchaseVoucher
      expense={expense as Expense}
      reimbursement={(reimbursement as Reimbursement) ?? null}
    />
  );
}
