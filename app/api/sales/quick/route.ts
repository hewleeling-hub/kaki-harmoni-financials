import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYMENT_METHODS } from "@/lib/constants";
import { today } from "@/lib/format";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type QuickBody = {
  payment_method?: string;
  items?: { product_id: string; quantity: number }[];
};

// Over-the-counter sale not tied to a chair session (café/retail purchases).
// Writes a sale (session_id = null, is_bundle = false) + one sale_item per line
// at standalone price. Feeds Reports inflow + revenue split like any other sale.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as QuickBody | null;
  if (!body)
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  if (!body.payment_method || !PAYMENT_METHODS.some((m) => m.value === body.payment_method))
    return NextResponse.json(
      { error: "A valid payment_method is required" },
      { status: 400 },
    );

  const lines = (body.items ?? []).filter(
    (i) => i.product_id && Number(i.quantity) > 0,
  );
  if (!lines.length)
    return NextResponse.json(
      { error: "Add at least one product" },
      { status: 400 },
    );

  const supabase = createAdminClient();

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("*")
    .in(
      "id",
      lines.map((l) => l.product_id),
    );
  if (prodErr || !products)
    return NextResponse.json(
      { error: "Could not load products" },
      { status: 500 },
    );
  const byId = new Map<string, Product>(products.map((p) => [p.id, p]));

  // Server computes the total from standalone prices (don't trust the client).
  let total = 0;
  const items = lines
    .map((l) => {
      const p = byId.get(l.product_id);
      if (!p) return null;
      const qty = Math.max(1, Math.floor(Number(l.quantity)));
      total += Number(p.standalone_price) * qty;
      return {
        product_id: p.id,
        quantity: qty,
        unit_price: Number(p.standalone_price),
        unit_cost: Number(p.cost_price),
        is_bundle_split: false,
      };
    })
    .filter(Boolean) as {
    product_id: string;
    quantity: number;
    unit_price: number;
    unit_cost: number;
    is_bundle_split: boolean;
  }[];

  if (!items.length)
    return NextResponse.json({ error: "No valid products" }, { status: 400 });

  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .insert({
      session_id: null,
      sale_date: today(),
      payment_method: body.payment_method,
      total_amount: total,
      is_bundle: false,
      notes: "quick_sale",
    })
    .select()
    .single();

  if (saleErr || !sale)
    return NextResponse.json(
      { error: saleErr?.message || "Could not create sale" },
      { status: 500 },
    );

  const { error: itemErr } = await supabase
    .from("sale_items")
    .insert(items.map((i) => ({ ...i, sale_id: sale.id })));
  if (itemErr) {
    await supabase.from("sales").delete().eq("id", sale.id);
    return NextResponse.json(
      { error: itemErr.message || "Could not create sale items" },
      { status: 500 },
    );
  }

  return NextResponse.json({ sale, total, item_count: items.length }, { status: 201 });
}
