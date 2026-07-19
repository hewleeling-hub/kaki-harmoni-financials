import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: true });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ products: data });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const name = String(body.name ?? "").trim();
  const category = String(body.category ?? "");
  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!PRODUCT_CATEGORIES.includes(category as never))
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name,
      category,
      cost_price: Number(body.cost_price) || 0,
      standalone_price: Number(body.standalone_price) || 0,
      bundle_allocation: Number(body.bundle_allocation) || 0,
      is_active: body.is_active ?? true,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ product: data }, { status: 201 });
}
