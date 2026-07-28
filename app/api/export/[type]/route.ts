import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeReport } from "@/lib/reports";
import { dayBounds, today } from "@/lib/format";
import { PAYERS } from "@/lib/constants";
import type { Session, Sale, Chair } from "@/lib/types";

export const dynamic = "force-dynamic";

function payerLabel(v: string): string {
  return PAYERS.find((p) => p.value === v)?.label ?? v;
}

// Build a single- or multi-sheet workbook and return it as an .xlsx download.
function workbookResponse(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  filename: string,
) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const url = new URL(req.url);
  const date = url.searchParams.get("date") || today();
  const supabase = createAdminClient();
  const stamp = today();

  if (type === "products") {
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at");
    const rows = (data ?? []).map((p) => ({
      Name: p.name,
      Category: p.category,
      "Cost Price (RM)": Number(p.cost_price),
      "Standalone Price (RM)": Number(p.standalone_price),
      "Bundle Allocation (RM)": Number(p.bundle_allocation),
      Active: p.is_active ? "Yes" : "No",
    }));
    return workbookResponse(
      [{ name: "Products", rows }],
      `kaki-harmoni-products-${stamp}.xlsx`,
    );
  }

  if (type === "expenses") {
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((e) => ({
      Date: e.expense_date,
      Vendor: e.vendor,
      Description: e.description ?? "",
      Category: String(e.category).replace(/_/g, " "),
      Payer: payerLabel(e.payer),
      Type: String(e.expense_type).replace(/_/g, " "),
      "Amount (RM)": Number(e.amount),
      Settled: e.is_settled ? "Yes" : "No",
      "AI Category": e.ai_category ?? "",
      "Receipt URL": e.receipt_url ?? "",
    }));
    return workbookResponse(
      [{ name: "Expenses", rows }],
      `kaki-harmoni-expenses-${stamp}.xlsx`,
    );
  }

  if (type === "reimbursements") {
    const { data } = await supabase
      .from("reimbursements")
      .select("*")
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((r) => ({
      "Owed To": r.owed_to,
      "Amount (RM)": Number(r.amount),
      Status: r.is_settled ? "Settled" : "Outstanding",
      Created: String(r.created_at).slice(0, 10),
      "Settled At": r.settled_at ? String(r.settled_at).slice(0, 10) : "",
    }));
    return workbookResponse(
      [{ name: "Reimbursements", rows }],
      `kaki-harmoni-reimbursements-${stamp}.xlsx`,
    );
  }

  if (type === "sessions") {
    const { startISO, endISO } = dayBounds(date);
    const [{ data: sessions }, { data: chairs }] = await Promise.all([
      supabase
        .from("sessions")
        .select("*")
        .gte("started_at", startISO)
        .lt("started_at", endISO)
        .order("started_at", { ascending: false }),
      supabase.from("chairs").select("*"),
    ]);
    const chairById = new Map<string, Chair>(
      (chairs ?? []).map((c: Chair) => [c.id, c]),
    );
    const rows = (sessions ?? []) as Session[];
    let salesBySession = new Map<string, Sale>();
    if (rows.length) {
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .in(
          "session_id",
          rows.map((s) => s.id),
        );
      salesBySession = new Map(
        (sales ?? []).map((s: Sale) => [s.session_id as string, s]),
      );
    }
    const out = rows.map((s) => {
      const sale = salesBySession.get(s.id);
      return {
        Chair: chairById.get(s.chair_id)?.label ?? "",
        "Started At": String(s.started_at).replace("T", " ").slice(0, 16),
        Status: s.status,
        Payment: sale ? String(sale.payment_method).replace(/_/g, " ") : "",
        "Total (RM)": sale ? Number(sale.total_amount) : 0,
      };
    });
    return workbookResponse(
      [{ name: `Sessions ${date}`, rows: out }],
      `kaki-harmoni-sessions-${date}.xlsx`,
    );
  }

  if (type === "report") {
    const r = await computeReport(date);
    const summary = [
      { Metric: "Date", Value: r.date },
      { Metric: "Inflow (RM)", Value: r.inflow },
      { Metric: "Outflow (RM)", Value: r.outflow },
      { Metric: "Net Cashflow (RM)", Value: r.net },
      { Metric: "Sessions", Value: r.sessionCount },
      { Metric: "Avg per Session (RM)", Value: Number(r.avgPerSession.toFixed(2)) },
      {
        Metric: "Outstanding Reimbursements (count)",
        Value: r.outstandingReimbursements.count,
      },
      {
        Metric: "Outstanding Reimbursements (RM)",
        Value: r.outstandingReimbursements.total,
      },
    ];
    const split = (
      [
        ["Spa", r.split.spa],
        ["Coffee", r.split.coffee],
        ["Extras", r.split.extras],
      ] as const
    ).map(([label, g]) => ({
      Group: label,
      "Revenue (RM)": g.revenue,
      "Cost (RM)": g.cost,
      "Margin %": g.revenue > 0 ? Math.round(g.margin * 100) : 0,
    }));
    const occupancy = r.chairs.map((c) => {
      const row: Record<string, unknown> = { Chair: c.label };
      for (const h of r.hours) {
        const cell = r.occupancy.find(
          (o) => o.chairId === c.id && o.hour === h,
        );
        row[`${h}:00`] = cell?.pct ?? 0;
      }
      return row;
    });
    return workbookResponse(
      [
        { name: "Summary", rows: summary },
        { name: "Revenue Split", rows: split },
        { name: "Occupancy %", rows: occupancy },
      ],
      `kaki-harmoni-report-${date}.xlsx`,
    );
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
}
