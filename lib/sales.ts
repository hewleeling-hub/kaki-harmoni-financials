import { createAdminClient } from "@/lib/supabase/admin";
import type { Sale, SaleItem, Session, Chair, Product } from "@/lib/types";

export type SaleLedgerRow = {
  id: string;
  created_at: string;
  sale_date: string;
  kind: "session" | "quick";
  source: string; // "Chair 2" or "Quick Sale"
  payment_method: string;
  total: number;
  items: string; // "Foot Spa Session ×1, House Coffee ×1"
};

// Every sale in [start, end] (inclusive dates), chair-linked or quick, newest
// first, with a human source label and item summary.
export async function getSalesLedger(
  start: string,
  end: string,
): Promise<SaleLedgerRow[]> {
  const supabase = createAdminClient();

  const { data: salesData } = await supabase
    .from("sales")
    .select("*")
    .gte("sale_date", start)
    .lte("sale_date", end)
    .order("created_at", { ascending: false });
  const sales = (salesData ?? []) as Sale[];
  if (!sales.length) return [];

  const sessionIds = [
    ...new Set(sales.map((s) => s.session_id).filter(Boolean)),
  ] as string[];
  const saleIds = sales.map((s) => s.id);

  const [{ data: sessionsData }, { data: chairsData }, { data: itemsData }] =
    await Promise.all([
      sessionIds.length
        ? supabase.from("sessions").select("*").in("id", sessionIds)
        : Promise.resolve({ data: [] as Session[] }),
      supabase.from("chairs").select("*"),
      supabase.from("sale_items").select("*").in("sale_id", saleIds),
    ]);

  const sessionById = new Map<string, Session>(
    (sessionsData ?? []).map((s: Session) => [s.id, s]),
  );
  const chairById = new Map<string, Chair>(
    (chairsData ?? []).map((c: Chair) => [c.id, c]),
  );

  // Product names for the item summary.
  const productIds = [
    ...new Set((itemsData ?? []).map((i: SaleItem) => i.product_id)),
  ];
  let productById = new Map<string, Product>();
  if (productIds.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .in("id", productIds);
    productById = new Map(
      (products ?? []).map((p) => [p.id, p as Product]),
    );
  }

  const itemsBySale = new Map<string, SaleItem[]>();
  for (const it of (itemsData ?? []) as SaleItem[]) {
    const arr = itemsBySale.get(it.sale_id) ?? [];
    arr.push(it);
    itemsBySale.set(it.sale_id, arr);
  }

  return sales.map((s) => {
    let source = "Quick Sale";
    let kind: "session" | "quick" = "quick";
    if (s.session_id) {
      kind = "session";
      const session = sessionById.get(s.session_id);
      const chair = session ? chairById.get(session.chair_id) : undefined;
      source = chair?.label ?? "Chair session";
    }
    const items = (itemsBySale.get(s.id) ?? [])
      .map(
        (i) =>
          `${productById.get(i.product_id)?.name ?? "Item"}${
            i.quantity > 1 ? ` ×${i.quantity}` : ""
          }`,
      )
      .join(", ");
    return {
      id: s.id,
      created_at: s.created_at,
      sale_date: s.sale_date,
      kind,
      source,
      payment_method: s.payment_method,
      total: Number(s.total_amount),
      items,
    };
  });
}
