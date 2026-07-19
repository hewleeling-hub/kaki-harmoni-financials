import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EXPENSE_CATEGORIES,
  PAYERS,
  EXPENSE_TYPES,
  REIMBURSABLE_PAYERS,
} from "@/lib/constants";
import { suggestExpenseCategory } from "@/lib/aiCategory";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expenses: data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const vendor = String(body.vendor ?? "").trim();
  const amount = Number(body.amount);
  const category = String(body.category ?? "");
  const payer = String(body.payer ?? "company");
  const expense_type = String(body.expense_type ?? "expense");

  if (!vendor)
    return NextResponse.json({ error: "Vendor is required" }, { status: 400 });
  if (!amount || amount <= 0)
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 },
    );
  if (!EXPENSE_CATEGORIES.includes(category as never))
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!PAYERS.some((p) => p.value === payer))
    return NextResponse.json({ error: "Invalid payer" }, { status: 400 });
  if (!EXPENSE_TYPES.some((t) => t.value === expense_type))
    return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });

  const supabase = createAdminClient();
  const suggestion = suggestExpenseCategory(vendor, body.description);

  const { data: expense, error } = await supabase
    .from("expenses")
    .insert({
      expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
      vendor,
      description: body.description ? String(body.description) : null,
      amount,
      category,
      payer,
      expense_type,
      ...suggestion,
    })
    .select()
    .single();

  if (error || !expense)
    return NextResponse.json(
      { error: error?.message || "Could not save expense" },
      { status: 500 },
    );

  // Auto-create reimbursement when a person fronted the money (docs/AGENTIC_LAYER.md,
  // create_reimbursement, Medium risk — drafted on save).
  let reimbursement = null;
  if (REIMBURSABLE_PAYERS.includes(payer)) {
    const owed_to =
      payer === "personal" ? "Owner (personal)" : "Staff (card)";
    const { data: r } = await supabase
      .from("reimbursements")
      .insert({
        expense_id: expense.id,
        owed_to,
        amount,
        is_settled: false,
      })
      .select()
      .single();
    reimbursement = r;
  }

  return NextResponse.json({ expense, reimbursement }, { status: 201 });
}
