import { createAdminClient } from "@/lib/supabase/admin";
import { gmt8Date } from "@/lib/format";
import {
  BUNDLE_PRICE,
  SPA_ALLOCATION,
  COFFEE_ALLOCATION,
  SPA_PRODUCT_ID,
  COFFEE_PRODUCT_ID,
  SPA_MINUTES,
  REST_MINUTES,
  OPEN_HOUR,
  CLOSE_HOUR,
  REIMBURSABLE_PAYERS,
} from "@/lib/constants";
import type { Sale, SaleItem, Expense, Session, Product } from "@/lib/types";

export type MonthPoint = {
  month: string; // YYYY-MM
  label: string; // "Jul 26"
  revenue: number;
  cashOut: number;
  net: number;
  sessions: number;
};

export type StreamMix = {
  key: "spa" | "coffee" | "extras";
  label: string;
  revenue: number;
  cost: number;
  margin: number; // 0–1
};

export type Dashboard = {
  hasData: boolean;
  firstDate: string | null;
  lastDate: string | null;
  activeDays: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number; // 0–1
  sessions: number;
  transactions: number;
  avgTicket: number;
  cashOut: number;
  net: number;
  outstandingPayables: number;
  utilization: number; // 0–1
  months: MonthPoint[];
  mix: StreamMix[];
  unit: {
    bundlePrice: number;
    spaAlloc: number;
    coffeeAlloc: number;
    bundleCost: number;
    bundleProfit: number;
    bundleMargin: number;
    sessionsPerChairDay: number;
    chairs: number;
    dailyPotential: number;
    monthlyPotential: number;
  };
};

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTH_ABBR[Number(m) - 1]} ${y.slice(2)}`;
}

function addMonth(key: string): string {
  let [y, m] = key.split("-").map(Number);
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export async function getDashboard(): Promise<Dashboard> {
  const supabase = createAdminClient();

  const [
    { data: salesData },
    { data: itemsData },
    { data: expensesData },
    { data: sessionsData },
    { data: chairsData },
    { data: productsData },
    { data: reimbData },
  ] = await Promise.all([
    supabase.from("sales").select("*"),
    supabase.from("sale_items").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("sessions").select("*"),
    supabase.from("chairs").select("*"),
    supabase.from("products").select("*"),
    supabase.from("reimbursements").select("*"),
  ]);

  const sales = (salesData ?? []) as Sale[];
  const items = (itemsData ?? []) as SaleItem[];
  const expenses = (expensesData ?? []) as Expense[];
  const sessions = (sessionsData ?? []) as Session[];
  const products = (productsData ?? []) as Product[];
  const productById = new Map(products.map((p) => [p.id, p]));
  const chairs = chairsData ?? [];
  const reimbursements = (reimbData ?? []) as {
    amount: number;
    is_settled: boolean;
    settled_at: string | null;
  }[];

  const revenue = sales.reduce((a, s) => a + Number(s.total_amount), 0);
  const cogs = items.reduce(
    (a, i) => a + Number(i.unit_cost) * i.quantity,
    0,
  );
  const grossProfit = revenue - cogs;

  // Revenue mix by category.
  const cat = (i: SaleItem) => productById.get(i.product_id)?.category;
  function stream(
    key: StreamMix["key"],
    label: string,
    pick: (c: string | undefined) => boolean,
  ): StreamMix {
    const rows = items.filter((i) => pick(cat(i)));
    const rev = rows.reduce((a, i) => a + Number(i.unit_price) * i.quantity, 0);
    const cost = rows.reduce((a, i) => a + Number(i.unit_cost) * i.quantity, 0);
    return { key, label, revenue: rev, cost, margin: rev > 0 ? (rev - cost) / rev : 0 };
  }
  const mix: StreamMix[] = [
    stream("spa", "Spa", (c) => c === "spa"),
    stream("coffee", "Coffee", (c) => c === "coffee"),
    stream("extras", "Extras", (c) => c !== "spa" && c !== "coffee"),
  ];

  // Cash-basis outflow (all-time): business-paid purchases + settled reimbursements.
  const paidDirect = expenses
    .filter((e) => !REIMBURSABLE_PAYERS.includes(e.payer))
    .reduce((a, e) => a + Number(e.amount), 0);
  const reimbSettled = reimbursements
    .filter((r) => r.is_settled)
    .reduce((a, r) => a + Number(r.amount), 0);
  const cashOut = paidDirect + reimbSettled;
  const outstandingPayables = reimbursements
    .filter((r) => !r.is_settled)
    .reduce((a, r) => a + Number(r.amount), 0);

  // Active days + utilization (session occupies a chair for spa+rest minutes).
  const sessionDates = new Set(sessions.map((s) => gmt8Date(s.started_at)));
  const saleDates = new Set(sales.map((s) => s.sale_date));
  const activeDays = new Set([...sessionDates, ...saleDates]).size;
  const occupiedMin = sessions.length * (SPA_MINUTES + REST_MINUTES);
  const chairCount = Math.max(1, chairs.length);
  const operatingMin = (CLOSE_HOUR - OPEN_HOUR) * 60;
  const capacityMin = chairCount * operatingMin * Math.max(1, activeDays);
  const utilization = capacityMin > 0 ? occupiedMin / capacityMin : 0;

  // Monthly series (fill gaps between first and last active month).
  const allDates = [
    ...sales.map((s) => s.sale_date),
    ...expenses.map((e) => e.expense_date),
  ].filter(Boolean);
  allDates.sort();
  const firstDate = allDates[0] ?? null;
  const lastDate = allDates[allDates.length - 1] ?? null;

  const months: MonthPoint[] = [];
  if (firstDate && lastDate) {
    const revByMonth = new Map<string, number>();
    const sessByMonth = new Map<string, number>();
    const cashByMonth = new Map<string, number>();
    for (const s of sales)
      revByMonth.set(
        s.sale_date.slice(0, 7),
        (revByMonth.get(s.sale_date.slice(0, 7)) ?? 0) + Number(s.total_amount),
      );
    for (const s of sessions) {
      const mk = gmt8Date(s.started_at).slice(0, 7);
      sessByMonth.set(mk, (sessByMonth.get(mk) ?? 0) + 1);
    }
    for (const e of expenses)
      if (!REIMBURSABLE_PAYERS.includes(e.payer))
        cashByMonth.set(
          e.expense_date.slice(0, 7),
          (cashByMonth.get(e.expense_date.slice(0, 7)) ?? 0) + Number(e.amount),
        );
    for (const r of reimbursements)
      if (r.is_settled && r.settled_at) {
        const mk = gmt8Date(r.settled_at).slice(0, 7);
        cashByMonth.set(mk, (cashByMonth.get(mk) ?? 0) + Number(r.amount));
      }

    let mk = firstDate.slice(0, 7);
    const last = lastDate.slice(0, 7);
    let guard = 0;
    while (guard++ < 120) {
      const rev = revByMonth.get(mk) ?? 0;
      const co = cashByMonth.get(mk) ?? 0;
      months.push({
        month: mk,
        label: monthLabel(mk),
        revenue: rev,
        cashOut: co,
        net: rev - co,
        sessions: sessByMonth.get(mk) ?? 0,
      });
      if (mk === last) break;
      mk = addMonth(mk);
    }
  }

  // Unit economics of the RM40 bundle.
  const spaCost = Number(productById.get(SPA_PRODUCT_ID)?.cost_price ?? 0);
  const coffeeCost = Number(productById.get(COFFEE_PRODUCT_ID)?.cost_price ?? 0);
  const bundleCost = spaCost + coffeeCost;
  const bundleProfit = BUNDLE_PRICE - bundleCost;
  const sessionsPerChairDay = Math.floor(
    operatingMin / (SPA_MINUTES + REST_MINUTES),
  );
  const dailyPotential = chairCount * sessionsPerChairDay * BUNDLE_PRICE;

  return {
    hasData: sales.length > 0 || expenses.length > 0,
    firstDate,
    lastDate,
    activeDays,
    revenue,
    cogs,
    grossProfit,
    grossMargin: revenue > 0 ? grossProfit / revenue : 0,
    sessions: sessions.length,
    transactions: sales.length,
    avgTicket: sales.length ? revenue / sales.length : 0,
    cashOut,
    net: revenue - cashOut,
    outstandingPayables,
    utilization,
    months,
    mix,
    unit: {
      bundlePrice: BUNDLE_PRICE,
      spaAlloc: SPA_ALLOCATION,
      coffeeAlloc: COFFEE_ALLOCATION,
      bundleCost,
      bundleProfit,
      bundleMargin: bundleProfit / BUNDLE_PRICE,
      sessionsPerChairDay,
      chairs: chairCount,
      dailyPotential,
      monthlyPotential: dailyPotential * 26,
    },
  };
}
