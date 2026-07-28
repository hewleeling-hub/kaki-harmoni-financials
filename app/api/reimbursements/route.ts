import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Reimbursement, Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("reimbursements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const reimbursements = (data ?? []) as Reimbursement[];

  // Attach the linked expense's vendor + receipt so each reimbursement can
  // point back to its source document (audit trail).
  const expenseIds = [...new Set(reimbursements.map((r) => r.expense_id))].filter(
    Boolean,
  );
  let expenseById = new Map<string, Expense>();
  if (expenseIds.length) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, vendor, receipt_url")
      .in("id", expenseIds);
    expenseById = new Map(
      (expenses ?? []).map((e) => [e.id as string, e as Expense]),
    );
  }

  const enriched = reimbursements.map((r) => {
    const e = expenseById.get(r.expense_id);
    return {
      ...r,
      vendor: e?.vendor ?? null,
      receipt_url: e?.receipt_url ?? null,
    };
  });

  return NextResponse.json({ reimbursements: enriched });
}
