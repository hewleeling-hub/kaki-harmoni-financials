import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BUNDLE_PRICE,
  SPA_ALLOCATION,
  COFFEE_ALLOCATION,
  SPA_PRODUCT_ID,
  COFFEE_PRODUCT_ID,
  SPA_MINUTES,
  REST_MINUTES,
  PAYMENT_METHODS,
} from "@/lib/constants";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type StartBody = {
  chair_id?: string;
  payment_method?: string;
  extras?: string[]; // product ids with bundle_allocation = 0
  client_started_at?: string; // optional, for offline-queued sales
};

export async function POST(req: Request) {
  let body: StartBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { chair_id, payment_method, extras = [], client_started_at } = body;

  if (!chair_id) {
    return NextResponse.json({ error: "chair_id is required" }, { status: 400 });
  }
  if (
    !payment_method ||
    !PAYMENT_METHODS.some((m) => m.value === payment_method)
  ) {
    return NextResponse.json(
      { error: "A valid payment_method is required" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();

  // 1. Chair must exist and be free (guards against double-booking / replays).
  const { data: chair, error: chairErr } = await supabase
    .from("chairs")
    .select("id, status")
    .eq("id", chair_id)
    .single();

  if (chairErr || !chair) {
    return NextResponse.json({ error: "Chair not found" }, { status: 404 });
  }
  if (chair.status !== "free") {
    return NextResponse.json(
      { error: "Chair is not free" },
      { status: 409 },
    );
  }

  // 2. Timers.
  const startedAt = client_started_at
    ? new Date(client_started_at)
    : new Date();
  const spaEndsAt = new Date(startedAt.getTime() + SPA_MINUTES * 60_000);
  const restEndsAt = new Date(
    startedAt.getTime() + (SPA_MINUTES + REST_MINUTES) * 60_000,
  );

  // 3. Load product snapshots for bundle splits + any extras.
  const productIds = [SPA_PRODUCT_ID, COFFEE_PRODUCT_ID, ...extras];
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds);

  if (prodErr || !products) {
    return NextResponse.json(
      { error: "Could not load products" },
      { status: 500 },
    );
  }
  const byId = new Map<string, Product>(products.map((p) => [p.id, p]));
  const spa = byId.get(SPA_PRODUCT_ID);
  const coffee = byId.get(COFFEE_PRODUCT_ID);

  // 4. Total = bundle + extras (at standalone price).
  let total = BUNDLE_PRICE;
  const extraProducts = extras
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p));
  for (const p of extraProducts) total += Number(p.standalone_price);

  // 5. Insert session.
  const { data: session, error: sessErr } = await supabase
    .from("sessions")
    .insert({
      chair_id,
      started_at: startedAt.toISOString(),
      spa_ends_at: spaEndsAt.toISOString(),
      rest_ends_at: restEndsAt.toISOString(),
      status: "running",
    })
    .select()
    .single();

  if (sessErr || !session) {
    return NextResponse.json(
      { error: sessErr?.message || "Could not create session" },
      { status: 500 },
    );
  }

  // 6. Insert sale.
  const { data: sale, error: saleErr } = await supabase
    .from("sales")
    .insert({
      session_id: session.id,
      sale_date: startedAt.toISOString().slice(0, 10),
      payment_method,
      total_amount: total,
      is_bundle: true,
    })
    .select()
    .single();

  if (saleErr || !sale) {
    // Roll back the orphaned session.
    await supabase.from("sessions").delete().eq("id", session.id);
    return NextResponse.json(
      { error: saleErr?.message || "Could not create sale" },
      { status: 500 },
    );
  }

  // 7. Sale items: two bundle splits + one row per extra.
  const items = [
    {
      sale_id: sale.id,
      product_id: SPA_PRODUCT_ID,
      quantity: 1,
      unit_price: SPA_ALLOCATION,
      unit_cost: Number(spa?.cost_price ?? 0),
      is_bundle_split: true,
    },
    {
      sale_id: sale.id,
      product_id: COFFEE_PRODUCT_ID,
      quantity: 1,
      unit_price: COFFEE_ALLOCATION,
      unit_cost: Number(coffee?.cost_price ?? 0),
      is_bundle_split: true,
    },
    ...extraProducts.map((p) => ({
      sale_id: sale.id,
      product_id: p.id,
      quantity: 1,
      unit_price: Number(p.standalone_price),
      unit_cost: Number(p.cost_price),
      is_bundle_split: false,
    })),
  ];

  const { error: itemErr } = await supabase.from("sale_items").insert(items);
  if (itemErr) {
    return NextResponse.json(
      { error: itemErr.message || "Could not create sale items" },
      { status: 500 },
    );
  }

  // 8. Flip chair to running.
  const { error: chairUpdErr } = await supabase
    .from("chairs")
    .update({ status: "running", current_session_id: session.id })
    .eq("id", chair_id);

  if (chairUpdErr) {
    return NextResponse.json(
      { error: chairUpdErr.message || "Could not update chair" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { session, sale, total, item_count: items.length },
    { status: 201 },
  );
}
