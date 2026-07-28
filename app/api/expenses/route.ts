import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYERS, EXPENSE_TYPES, REIMBURSABLE_PAYERS } from "@/lib/constants";
import { suggestExpenseCategory } from "@/lib/aiCategory";
import { today } from "@/lib/format";

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
  // Category is free text (dropdown values + user-defined via "Other").
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
  if (category.length > 50)
    return NextResponse.json(
      { error: "Category is too long (max 50 chars)" },
      { status: 400 },
    );
  if (!PAYERS.some((p) => p.value === payer))
    return NextResponse.json({ error: "Invalid payer" }, { status: 400 });
  if (!EXPENSE_TYPES.some((t) => t.value === expense_type))
    return NextResponse.json({ error: "Invalid expense type" }, { status: 400 });

  const supabase = createAdminClient();
  const suggestion = suggestExpenseCategory(vendor, body.description);

  // Normalise line items to {description, quantity, unit_price, amount}.
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

  const row: Record<string, unknown> = {
    expense_date: body.expense_date || today(),
    vendor,
    description: body.description ? String(body.description) : null,
    amount,
    category,
    payer,
    expense_type,
    receipt_url: body.receipt_url ? String(body.receipt_url) : null,
    line_items: lineItems,
    comments: body.comments ? String(body.comments) : null,
    ...suggestion,
  };

  let { data: expense, error } = await supabase
    .from("expenses")
    .insert(row)
    .select()
    .single();

  // If an optional column isn't present yet (migration not applied), drop just
  // the offending field(s) and retry so the core save still works.
  if (error) {
    const missing = ["line_items", "comments"].filter((c) =>
      new RegExp(c, "i").test(error!.message),
    );
    if (missing.length) {
      const retry = { ...row };
      for (const c of missing) delete retry[c];
      ({ data: expense, error } = await supabase
        .from("expenses")
        .insert(retry)
        .select()
        .single());
    }
  }

  if (error || !expense)
    return NextResponse.json(
      { error: error?.message || "Could not save expense" },
      { status: 500 },
    );

  // Auto-create reimbursement when a person fronted the money (docs/AGENTIC_LAYER.md,
  // create_reimbursement, Medium risk — drafted on save).
  let reimbursement = null;
  if (REIMBURSABLE_PAYERS.includes(payer)) {
    // Owe it back to the named payer (e.g. "Owner (MG)", "Staff Card").
    const owed_to =
      PAYERS.find((p) => p.value === payer)?.label ??
      (payer === "personal" ? "Owner (personal)" : payer);
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
