import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeReport, reportRange } from "@/lib/reports";
import { loadStatements } from "@/lib/financialStatementsServer";
import type { StatementLine, Total } from "@/lib/financialStatements";
import { getSalesLedger } from "@/lib/sales";
import { dayBounds, today, timeOfDay, gmt8Date } from "@/lib/format";
import { REIMBURSABLE_PAYERS, payerLabel } from "@/lib/constants";
import type { Session, Sale, Chair } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    const receiptLink = (v: string | null) => {
      if (!v) return "";
      if (/^https?:\/\//i.test(v)) return v;
      return `${url.origin}/api/receipts/view?path=${encodeURIComponent(v)}`;
    };
    const rows = (data ?? []).map((e) => ({
      "PO No.": e.po_number ?? "",
      Date: e.expense_date,
      Vendor: e.vendor,
      Description: e.description ?? "",
      Comments: e.comments ?? "",
      Category: String(e.category).replace(/_/g, " "),
      Payer: payerLabel(e.payer),
      Type: String(e.expense_type).replace(/_/g, " "),
      "Amount (RM)": Number(e.amount),
      Status: !REIMBURSABLE_PAYERS.includes(e.payer)
        ? "Paid"
        : e.is_settled
          ? "Settled"
          : "Owed",
      Items: Array.isArray(e.line_items) ? e.line_items.length : 0,
      Settled: e.is_settled ? "Yes" : "No",
      "AI Category": e.ai_category ?? "",
      Receipt: receiptLink(e.receipt_url),
    }));
    // Flatten line items into their own sheet, one row per item.
    const itemRows: Record<string, unknown>[] = [];
    for (const e of data ?? []) {
      for (const li of Array.isArray(e.line_items) ? e.line_items : []) {
        itemRows.push({
          Date: e.expense_date,
          Vendor: e.vendor,
          Item: li.description ?? "",
          Qty: Number(li.quantity) || 0,
          "Unit Price (RM)": Number(li.unit_price) || 0,
          "Amount (RM)": Number(li.amount) || 0,
        });
      }
    }
    return workbookResponse(
      [
        { name: "Expenses", rows },
        { name: "Line Items", rows: itemRows },
      ],
      `kaki-harmoni-expenses-${stamp}.xlsx`,
    );
  }

  if (type === "reimbursements") {
    const { data } = await supabase
      .from("reimbursements")
      .select("*")
      .order("created_at", { ascending: false });
    const list = data ?? [];
    const expIds = [...new Set(list.map((r) => r.expense_id))].filter(Boolean);
    const expById = new Map<string, { vendor: string; receipt_url: string | null }>();
    if (expIds.length) {
      const { data: exps } = await supabase
        .from("expenses")
        .select("id, vendor, receipt_url")
        .in("id", expIds);
      for (const e of exps ?? [])
        expById.set(e.id, { vendor: e.vendor, receipt_url: e.receipt_url });
    }
    const receiptLink = (v: string | null | undefined) =>
      !v
        ? ""
        : /^https?:\/\//i.test(v)
          ? v
          : `${url.origin}/api/receipts/view?path=${encodeURIComponent(v)}`;
    const rows = list.map((r) => {
      const e = expById.get(r.expense_id);
      return {
        "PV No.": r.pv_number ?? "",
        // The voucher date — blank until the money has actually been paid back.
        Date: r.settled_at ? gmt8Date(r.settled_at) : "",
        "Owed To": r.owed_to,
        Vendor: e?.vendor ?? "",
        "Amount (RM)": Number(r.amount),
        Status: r.is_settled ? "Settled" : "Outstanding",
        Created: gmt8Date(r.created_at),
        "Settled At": r.settled_at ? gmt8Date(r.settled_at) : "",
        Receipt: receiptLink(e?.receipt_url),
      };
    });
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
        "Started At": `${gmt8Date(s.started_at)} ${timeOfDay(s.started_at)}`,
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

  if (type === "sales") {
    const range = reportRange({
      period: url.searchParams.get("period") || undefined,
      date: url.searchParams.get("date") || undefined,
      month: url.searchParams.get("month") || undefined,
      start: url.searchParams.get("start") || undefined,
      end: url.searchParams.get("end") || undefined,
    });
    const ledger = await getSalesLedger(range.start, range.end);
    const rows = ledger.map((r) => ({
      Date: r.sale_date,
      Time: timeOfDay(r.created_at),
      Source: r.source,
      Kind: r.kind === "quick" ? "Quick Sale" : "Chair Session",
      Items: r.items,
      Payment: r.payment_method.replace(/_/g, " "),
      "Total (RM)": r.total,
    }));
    const suffix =
      range.period === "month"
        ? range.start.slice(0, 7)
        : range.start === range.end
          ? range.start
          : `${range.start}_to_${range.end}`;
    return workbookResponse(
      [{ name: "Sales", rows }],
      `kaki-harmoni-sales-${suffix}.xlsx`,
    );
  }

  if (type === "report") {
    const range = reportRange({
      period: url.searchParams.get("period") || undefined,
      date: url.searchParams.get("date") || undefined,
      month: url.searchParams.get("month") || undefined,
      start: url.searchParams.get("start") || undefined,
      end: url.searchParams.get("end") || undefined,
    });
    const r = await computeReport(
      range.start,
      range.end,
      range.period,
      range.label,
    );
    const summary = [
      { Metric: "Period", Value: r.label },
      {
        Metric: "Range",
        Value: r.start === r.end ? r.start : `${r.start} → ${r.end}`,
      },
      { Metric: "Inflow — Sales (RM)", Value: r.inflow },
      { Metric: "Cash Out (RM)", Value: r.outflow },
      { Metric: "Net Cashflow (RM)", Value: r.net },
      { Metric: "Total Purchases (RM)", Value: r.purchases.total },
      { Metric: "  Paid by Business (RM)", Value: r.purchases.paidDirect },
      {
        Metric: "  Fronted / On Credit — not yet paid (RM)",
        Value: r.purchases.owed,
      },
      {
        Metric: "  Reimbursements Settled (RM)",
        Value: r.purchases.reimbSettled,
      },
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
    const dailyCashflow = r.daily.map((d) => ({
      Date: d.date,
      "Cash In (RM)": d.inflow,
      "Cash Out (RM)": d.outflow,
      "Net (RM)": d.net,
      "Running Balance (RM)": d.cumulative,
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
    const suffix =
      range.period === "month"
        ? range.start.slice(0, 7)
        : range.start === range.end
          ? range.start
          : `${range.start}_to_${range.end}`;

    // Profit & loss and balance sheet, same shape as the reports page.
    const statements = await loadStatements(range.start, range.end);
    const plRows: Record<string, unknown>[] = [];
    const bsRows: Record<string, unknown>[] = [];
    if (statements) {
      const { profitAndLoss: pl, balanceSheet: bs } = statements;
      const plLine = (l: StatementLine, indent = true) => ({
        Account: `${indent ? "    " : ""}${l.name}`,
        "A/C": l.code,
        [`${r.label} (RM)`]: l.period,
        "To Date (RM)": l.cumulative,
      });
      const plTotal = (label: string, t: Total) => ({
        Account: label,
        "A/C": "",
        [`${r.label} (RM)`]: t.period,
        "To Date (RM)": t.cumulative,
      });
      const plHead = (label: string) => ({ Account: label, "A/C": "" });
      plRows.push(plHead("REVENUE"), ...pl.revenue.map((l) => plLine(l)));
      plRows.push(plTotal("Gross revenue", pl.grossRevenue));
      plRows.push(...pl.discounts.map((l) => plLine(l)));
      plRows.push(plTotal("NET REVENUE", pl.netRevenue), plHead(""));
      plRows.push(plHead("COST OF SALES"), ...pl.costOfSales.map((l) => plLine(l)));
      plRows.push(plTotal("Total cost of sales", pl.totalCostOfSales));
      plRows.push(plTotal("GROSS PROFIT / (LOSS)", pl.grossProfit), plHead(""));
      plRows.push(plHead("OPERATING EXPENSES"), ...pl.operatingExpenses.map((l) => plLine(l)));
      plRows.push(plTotal("Total operating expenses", pl.totalOperatingExpenses));
      plRows.push(plTotal("PROFIT / (LOSS) FOR THE PERIOD", pl.profit));

      const bsLine = (name: string, code: string, amount: number) => ({
        Account: `    ${name}`,
        "A/C": code,
        "RM": amount,
      });
      const bsTotal = (name: string, amount: number) => ({
        Account: name,
        "A/C": "",
        "RM": amount,
      });
      const bsHead = (name: string) => ({ Account: name, "A/C": "" });
      bsRows.push(bsHead("NON-CURRENT ASSETS"));
      bsRows.push(...bs.nonCurrent.map((l) => bsLine(l.name, l.code, l.cumulative)));
      bsRows.push(bsTotal("At cost", bs.totalCost));
      bsRows.push(...bs.accumulatedDepreciation.map((l) => bsLine(l.name, l.code, -l.cumulative)));
      bsRows.push(bsTotal("Net book value", bs.netBookValue), bsHead(""));
      bsRows.push(bsHead("CURRENT ASSETS"));
      bsRows.push(...bs.current.map((l) => bsLine(l.name, l.code, l.cumulative)));
      bsRows.push(bsTotal("Total current assets", bs.totalCurrent));
      bsRows.push(bsTotal("TOTAL ASSETS", bs.totalAssets), bsHead(""));
      bsRows.push(bsHead("LIABILITIES"));
      bsRows.push(...bs.liabilities.map((l) => bsLine(l.name, l.code, l.cumulative)));
      bsRows.push(bsTotal("TOTAL LIABILITIES", bs.totalLiabilities), bsHead(""));
      bsRows.push(bsHead("EQUITY"));
      bsRows.push(bsLine("Share capital", "3100", bs.shareCapital));
      bsRows.push(bsLine("Retained profit / (loss)", "", bs.retainedEarnings));
      bsRows.push(bsTotal("TOTAL EQUITY", bs.totalEquity));
      bsRows.push(bsTotal("TOTAL LIABILITIES AND EQUITY", bs.totalLiabilitiesAndEquity));
      bsRows.push(bsHead(""));
      bsRows.push(
        bs.outOfBalanceBy === 0
          ? bsHead("Balanced - total assets agree with total liabilities and equity.")
          : bsTotal("OUT OF BALANCE BY", bs.outOfBalanceBy),
      );
    }

    return workbookResponse(
      [
        { name: "Summary", rows: summary },
        { name: "Profit and Loss", rows: plRows },
        { name: "Balance Sheet", rows: bsRows },
        { name: "Daily Cashflow", rows: dailyCashflow },
        { name: "Revenue Split", rows: split },
        { name: "Occupancy %", rows: occupancy },
      ],
      `kaki-harmoni-report-${suffix}.xlsx`,
    );
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 404 });
}
