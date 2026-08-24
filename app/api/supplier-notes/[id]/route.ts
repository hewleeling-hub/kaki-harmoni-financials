import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NOTE_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

// PATCH /api/supplier-notes/[id] — edit a note, or mark it applied/open.
// The note number is never changed: an issued document keeps its number.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {};

  if (typeof body.note_type === "string") {
    if (!NOTE_TYPES.some((t) => t.value === body.note_type))
      return NextResponse.json({ error: "Invalid note type" }, { status: 400 });
    patch.note_type = body.note_type;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 },
      );
    patch.amount = amount;
  }
  if (typeof body.vendor === "string" && body.vendor.trim())
    patch.vendor = body.vendor.trim();
  if (body.note_date) patch.note_date = body.note_date;
  if (body.reason !== undefined) patch.reason = body.reason || null;
  if (body.description !== undefined)
    patch.description = String(body.description).trim() || null;
  if (body.expense_id !== undefined) patch.expense_id = body.expense_id || null;

  // Marking a note applied stamps when the adjustment landed; reopening clears it.
  if (typeof body.status === "string") {
    if (!["open", "applied"].includes(body.status))
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    patch.status = body.status;
    patch.applied_at = body.status === "applied" ? new Date().toISOString() : null;
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("supplier_notes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message || "Could not update the note" },
      { status: 500 },
    );

  return NextResponse.json({ note: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { error } = await supabase.from("supplier_notes").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
