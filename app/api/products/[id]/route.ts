import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) patch.name = String(body.name).trim();
  if (body.category !== undefined) patch.category = body.category;
  if (body.cost_price !== undefined) patch.cost_price = Number(body.cost_price) || 0;
  if (body.standalone_price !== undefined)
    patch.standalone_price = Number(body.standalone_price) || 0;
  if (body.bundle_allocation !== undefined)
    patch.bundle_allocation = Number(body.bundle_allocation) || 0;
  if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  // Soft-delete: deactivate so historical sale_items keep resolving.
  const { data, error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data });
}
