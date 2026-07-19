import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Settle / unsettle a reimbursement (docs/AGENTIC_LAYER.md settle_reimbursement,
// High risk — explicit user action; the UI confirms before calling this).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const settled = Boolean(body.is_settled);

  const supabase = createAdminClient();
  const { data: reimb, error } = await supabase
    .from("reimbursements")
    .update({
      is_settled: settled,
      settled_at: settled ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error || !reimb)
    return NextResponse.json(
      { error: error?.message || "Not found" },
      { status: 500 },
    );

  // Keep the linked expense's settled flag in sync.
  if (reimb.expense_id) {
    await supabase
      .from("expenses")
      .update({ is_settled: settled })
      .eq("id", reimb.expense_id);
  }

  return NextResponse.json({ reimbursement: reimb });
}
