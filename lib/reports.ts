import { createAdminClient } from "@/lib/supabase/admin";
import { dayBounds } from "@/lib/format";
import { OPEN_HOUR, CLOSE_HOUR } from "@/lib/constants";
import type { Sale, SaleItem, Expense, Session, Chair, Product } from "@/lib/types";

export type RevenueGroup = {
  revenue: number;
  cost: number;
  margin: number; // 0–1
};

export type OccupancyCell = { chairId: string; hour: number; pct: number };

export type DailyReport = {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  sessionCount: number;
  avgPerSession: number;
  split: { spa: RevenueGroup; coffee: RevenueGroup; extras: RevenueGroup };
  chairs: Chair[];
  occupancy: OccupancyCell[];
  hours: number[];
  outstandingReimbursements: { count: number; total: number };
};

function overlapMinutes(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return Math.max(0, (end - start) / 60_000);
}

function group(items: SaleItem[]): RevenueGroup {
  const revenue = items.reduce(
    (a, i) => a + Number(i.unit_price) * i.quantity,
    0,
  );
  const cost = items.reduce((a, i) => a + Number(i.unit_cost) * i.quantity, 0);
  return {
    revenue,
    cost,
    margin: revenue > 0 ? (revenue - cost) / revenue : 0,
  };
}

export async function computeReport(dateStr: string): Promise<DailyReport> {
  const supabase = createAdminClient();
  const { startISO, endISO } = dayBounds(dateStr);

  const [
    { data: salesData },
    { data: expensesData },
    { data: sessionsData },
    { data: chairsData },
    { data: productsData },
    { data: reimbData },
  ] = await Promise.all([
    supabase.from("sales").select("*").eq("sale_date", dateStr),
    supabase.from("expenses").select("*").eq("expense_date", dateStr),
    supabase
      .from("sessions")
      .select("*")
      .gte("started_at", startISO)
      .lt("started_at", endISO),
    supabase.from("chairs").select("*").order("label"),
    supabase.from("products").select("*"),
    supabase.from("reimbursements").select("*").eq("is_settled", false),
  ]);

  const sales = (salesData ?? []) as Sale[];
  const expenses = (expensesData ?? []) as Expense[];
  const sessions = (sessionsData ?? []) as Session[];
  const chairs = (chairsData ?? []) as Chair[];
  const products = (productsData ?? []) as Product[];
  const productById = new Map(products.map((p) => [p.id, p]));

  const inflow = sales.reduce((a, s) => a + Number(s.total_amount), 0);
  const outflow = expenses.reduce((a, e) => a + Number(e.amount), 0);

  // Sale items for the day's sales → revenue split.
  const saleIds = sales.map((s) => s.id);
  let items: SaleItem[] = [];
  if (saleIds.length) {
    const { data } = await supabase
      .from("sale_items")
      .select("*")
      .in("sale_id", saleIds);
    items = (data ?? []) as SaleItem[];
  }

  const spaItems = items.filter(
    (i) => i.is_bundle_split && productById.get(i.product_id)?.category === "spa",
  );
  const coffeeItems = items.filter(
    (i) =>
      i.is_bundle_split &&
      productById.get(i.product_id)?.category === "coffee",
  );
  const extraItems = items.filter((i) => !i.is_bundle_split);

  // Occupancy grid: hours 10–20, per chair, % of each hour a chair was occupied
  // (running or resting = the [started_at, rest_ends_at] window).
  const hours: number[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) hours.push(h);

  const occupancy: OccupancyCell[] = [];
  for (const chair of chairs) {
    const chairSessions = sessions.filter((s) => s.chair_id === chair.id);
    for (const h of hours) {
      const hourStart = new Date(`${dateStr}T00:00:00`).getTime() + h * 3_600_000;
      const hourEnd = hourStart + 3_600_000;
      let mins = 0;
      for (const s of chairSessions) {
        const start = new Date(s.started_at).getTime();
        const end = s.rest_ends_at
          ? new Date(s.rest_ends_at).getTime()
          : start;
        mins += overlapMinutes(start, end, hourStart, hourEnd);
      }
      occupancy.push({
        chairId: chair.id,
        hour: h,
        pct: Math.min(100, Math.round((mins / 60) * 100)),
      });
    }
  }

  const reimb = (reimbData ?? []) as { amount: number }[];

  return {
    date: dateStr,
    inflow,
    outflow,
    net: inflow - outflow,
    sessionCount: sessions.length,
    avgPerSession: sessions.length ? inflow / sessions.length : 0,
    split: {
      spa: group(spaItems),
      coffee: group(coffeeItems),
      extras: group(extraItems),
    },
    chairs,
    occupancy,
    hours,
    outstandingReimbursements: {
      count: reimb.length,
      total: reimb.reduce((a, r) => a + Number(r.amount), 0),
    },
  };
}
