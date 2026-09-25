import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTE_TYPES } from "@/lib/constants";
import { today } from "@/lib/format";
import type { Expense } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Where the money goes when the note settles — the payee, their bank and
 * account, and an optional QR image. All optional: a note can be raised before
 * anyone knows how it will be paid, and filled in later.
 */
function paymentDetails(body: Record<string, unknown>) {
  const text = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s ? s.slice(0, 120) : null;
  };
  return {
    pay_to_name: text(body.pay_to_name),
    pay_to_bank: text(body.pay_to_bank),
    // Digits, spaces and dashes only — an account number is not free text, and
    // a typo here sends the money to a stranger.
    pay_to_account: text(body.pay_to_account)?.replace(/[^0-9 -]/g, "") || null,
    pay_to_qr_url: body.pay_to_qr_url ? String(body.pay_to_qr_url) : null,
  };
}

// GET /api/supplier-notes — the DN/CN register, newest number first, with the
// PO number of the purchase each note adjusts.
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_notes")
    .select("*")
    .order("note_date", { ascending: false })
    .order("note_number", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const notes = data ?? [];
  const expenseIds = [
    ...new Set(notes.map((n) => n.expense_id).filter(Boolean)),
  ] as string[];

  const poById = new Map<string, string | null>();
  if (expenseIds.length) {
    const { data: expenses } = await supabase
      .from("expenses")
      .select("id, po_number")
      .in("id", expenseIds);
    for (const e of (expenses ?? []) as Pick<Expense, "id" | "po_number">[]) {
      poById.set(e.id, e.po_number);
    }
  }

  return NextResponse.json({
    notes: notes.map((n) => ({
      ...n,
      po_number: n.expense_id ? (poById.get(n.expense_id) ?? null) : null,
    })),
  });
}

// POST /api/supplier-notes — raise a note. The DN/CN number is stamped by the
// database trigger, so it is never assigned here.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const note_type = String(body.note_type ?? "");
  const amount = Number(body.amount);
  let vendor = String(body.vendor ?? "").trim();
  const expense_id = body.expense_id ? String(body.expense_id) : null;

  if (!NOTE_TYPES.some((t) => t.value === note_type))
    return NextResponse.json({ error: "Pick a debit or credit note" }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 },
    );

  const supabase = createAdminClient();

  // Take the vendor from the linked purchase when one is chosen, so the note
  // can never disagree with the purchase it adjusts.
  if (expense_id) {
    const { data: expense } = await supabase
      .from("expenses")
      .select("vendor")
      .eq("id", expense_id)
      .maybeSingle();
    if (!expense)
      return NextResponse.json({ error: "That purchase no longer exists" }, { status: 400 });
    vendor = expense.vendor;
  }

  if (!vendor)
    return NextResponse.json({ error: "Vendor is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("supplier_notes")
    .insert({
      note_type,
      note_date: body.note_date || today(),
      expense_id,
      vendor,
      amount,
      reason: body.reason ? String(body.reason) : null,
      description: body.description ? String(body.description).trim() || null : null,
      ...paymentDetails(body),
    })
    .select()
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message || "Could not save the note" },
      { status: 500 },
    );

  return NextResponse.json({ note: data }, { status: 201 });
}
