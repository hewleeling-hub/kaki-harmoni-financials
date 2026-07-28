import { createAdminClient } from "@/lib/supabase/admin";
import { today, gmt8Date } from "@/lib/format";
import { OPEN_HOUR, CLOSE_HOUR } from "@/lib/constants";
import type { Sale, SaleItem, Expense, Session, Chair, Product } from "@/lib/types";

export type RevenueGroup = {
  revenue: number;
  cost: number;
  margin: number; // 0–1
};

export type OccupancyCell = { chairId: string; hour: number; pct: number };

export type ReportPeriod = "day" | "month" | "range";

export type DailyReport = {
  start: string;
  end: string;
  period: ReportPeriod;
  label: string;
  days: number;
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

function dayLabel(d: string): string {
  return new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

// Resolve URL params into a concrete date range + label.
export function reportRange(params: {
  period?: string;
  date?: string;
  month?: string;
  start?: string;
  end?: string;
}): { period: ReportPeriod; start: string; end: string; label: string } {
  if (params.period === "month") {
    const month = params.month || today().slice(0, 7); // YYYY-MM
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, "0")}`;
    const label = new Date(`${start}T12:00:00+08:00`).toLocaleDateString(
      "en-MY",
      { month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" },
    );
    return { period: "month", start, end, label };
  }
  if (params.period === "range") {
    let start = params.start || today();
    let end = params.end || start;
    if (start > end) [start, end] = [end, start]; // tolerate reversed inputs
    const label =
      start === end ? dayLabel(start) : `${dayLabel(start)} → ${dayLabel(end)}`;
    return { period: "range", start, end, label };
  }
  const date = params.date || today();
  return { period: "day", start: date, end: date, label: dayLabel(date) };
}

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

// Aggregate over an inclusive [startStr, endStr] date range (both YYYY-MM-DD).
export async function computeReport(
  startStr: string,
  endStr: string = startStr,
  period: ReportPeriod = "day",
  label?: string,
): Promise<DailyReport> {
  const supabase = createAdminClient();
  const startISO = new Date(`${startStr}T00:00:00+08:00`).toISOString();
  const endMs = new Date(`${endStr}T00:00:00+08:00`).getTime() + 24 * 60 * 60_000;
  const endISO = new Date(endMs).toISOString();
  const days =
    Math.round(
      (new Date(`${endStr}T00:00:00+08:00`).getTime() -
        new Date(`${startStr}T00:00:00+08:00`).getTime()) /
        86_400_000,
    ) + 1;

  const [
    { data: salesData },
    { data: expensesData },
    { data: sessionsData },
    { data: chairsData },
    { data: productsData },
    { data: reimbData },
  ] = await Promise.all([
    supabase
      .from("sales")
      .select("*")
      .gte("sale_date", startStr)
      .lte("sale_date", endStr),
    supabase
      .from("expenses")
      .select("*")
      .gte("expense_date", startStr)
      .lte("expense_date", endStr),
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

  const saleIds = sales.map((s) => s.id);
  let items: SaleItem[] = [];
  if (saleIds.length) {
    const { data } = await supabase
      .from("sale_items")
      .select("*")
      .in("sale_id", saleIds);
    items = (data ?? []) as SaleItem[];
  }

  // Group by product category so bundle splits, standalone and quick sales all
  // land in the right bucket (spa / coffee / everything else = extras).
  const cat = (i: SaleItem) => productById.get(i.product_id)?.category;
  const spaItems = items.filter((i) => cat(i) === "spa");
  const coffeeItems = items.filter((i) => cat(i) === "coffee");
  const extraItems = items.filter(
    (i) => cat(i) !== "spa" && cat(i) !== "coffee",
  );

  // Occupancy: average % per hour-of-day across the range (sum of occupied
  // minutes for that hour over all days, ÷ (days × 60)).
  const hours: number[] = [];
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) hours.push(h);

  const minutesByChairHour = new Map<string, number[]>();
  for (const c of chairs) minutesByChairHour.set(c.id, hours.map(() => 0));

  for (const s of sessions) {
    const arr = minutesByChairHour.get(s.chair_id);
    if (!arr) continue;
    const dateStr = gmt8Date(s.started_at);
    const start = new Date(s.started_at).getTime();
    const end = s.rest_ends_at ? new Date(s.rest_ends_at).getTime() : start;
    hours.forEach((h, idx) => {
      const hourStart =
        new Date(`${dateStr}T00:00:00+08:00`).getTime() + h * 3_600_000;
      arr[idx] += overlapMinutes(start, end, hourStart, hourStart + 3_600_000);
    });
  }

  const occupancy: OccupancyCell[] = [];
  for (const chair of chairs) {
    const arr = minutesByChairHour.get(chair.id)!;
    hours.forEach((h, idx) => {
      occupancy.push({
        chairId: chair.id,
        hour: h,
        pct: Math.min(100, Math.round((arr[idx] / (days * 60)) * 100)),
      });
    });
  }

  const reimb = (reimbData ?? []) as { amount: number }[];

  return {
    start: startStr,
    end: endStr,
    period,
    label: label ?? startStr,
    days,
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
