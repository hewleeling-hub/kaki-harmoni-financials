import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYERS,
  EXPENSE_TYPES,
  REIMBURSABLE_PAYERS,
} from "@/lib/constants";
import { suggestExpenseCategory } from "@/lib/aiCategory";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const vendor = String(body.vendor ?? "").trim();
  const amount = Number(body.amount);
  const category = String(body.category ?? "").trim().toLowerCase() || "other";
  const payer = String(body.payer ?? "company");
  const expense_type = String(body.expense_type ?? "expense");

  if (!vendor)
    return NextResponse.json({ error: "Vendor is required" }, { status: 400 });
  if (!amount || amount <= 0)
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 },
    );
  if (!PAYERS.some((p) => p.value === payer))
    return NextResponse.json({ error: "Invalid payer" }, { status: 400 });
  if (!EXPENSE_TYPES.some((t) => t.value === expense_type))
    return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });

  const supabase = createAdminClient();

  const lineItems = Array.isArray(body.line_items)
    ? body.line_items
        .map((li: Record<string, unknown>) => ({
          description: String(li?.description ?? "").trim(),
          quantity: Number(li?.quantity) || 0,
          unit_price: Number(li?.unit_price) || 0,
          amount: Number(li?.amount) || 0,
        }))
        .filter((li: { description: string }) => li.description)
    : [];

  const patch: Record<string, unknown> = {
    expense_date: body.expense_date || undefined,
    vendor,
    description: body.description ? String(body.description) : null,
    amount,
    category,
    payer,
    expense_type,
    receipt_url: body.receipt_url ? String(body.receipt_url) : null,
    line_items: lineItems,
    comments: body.comments ? String(body.comments) : null,
    ...suggestExpenseCategory(vendor, body.description),
  };
  if (!patch.expense_date) delete patch.expense_date;

  let { error } = await supabase.from("expenses").update(patch).eq("id", id);
  if (error) {
    const missing = ["line_items", "comments"].filter((c) =>
      new RegExp(c, "i").test(error!.message),
    );
    if (missing.length) {
      const retry = { ...patch };
      for (const c of missing) delete retry[c];
      ({ error } = await supabase.from("expenses").update(retry).eq("id", id));
    }
  }
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Keep the linked reimbursement in sync with the edited payer/amount.
  const shouldOwe = REIMBURSABLE_PAYERS.includes(payer);
  const { data: existing } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("expense_id", id)
    .maybeSingle();

  if (shouldOwe) {
    const owed_to = PAYERS.find((p) => p.value === payer)?.label ?? payer;
    if (existing) {
      await supabase
        .from("reimbursements")
        .update({ amount, owed_to })
        .eq("id", existing.id);
      await supabase
        .from("expenses")
        .update({ is_settled: existing.is_settled })
        .eq("id", id);
    } else {
      await supabase
        .from("reimbursements")
        .insert({ expense_id: id, owed_to, amount, is_settled: false });
      await supabase.from("expenses").update({ is_settled: false }).eq("id", id);
    }
  } else {
    if (existing)
      await supabase.from("reimbursements").delete().eq("id", existing.id);
    await supabase.from("expenses").update({ is_settled: false }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  await supabase.from("reimbursements").delete().eq("expense_id", id);
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
