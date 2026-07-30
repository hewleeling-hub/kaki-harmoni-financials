import { computeReport, reportRange } from "@/lib/reports";
import { rm, today } from "@/lib/format";
import { ReportControls } from "@/components/ReportControls";
import { ExportButton } from "@/components/ExportButton";
import { GroupedBars, BreakEvenChart } from "@/components/charts";

export const dynamic = "force-dynamic";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// Weekday + DD Mon for the daily cashflow table (GMT+8).
function fmtDay(d: string) {
  return new Date(`${d}T12:00:00+08:00`).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kuala_Lumpur",
  });
}

function signClass(n: number) {
  if (n > 0) return "text-emerald-600";
  if (n < 0) return "text-red-600";
  return "text-neutral-400";
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function occColor(p: number) {
  if (p === 0) return "bg-neutral-100 text-neutral-400";
  if (p < 34) return "bg-emerald-100 text-emerald-800";
  if (p < 67) return "bg-emerald-300 text-emerald-900";
  return "bg-emerald-500 text-white";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    date?: string;
    month?: string;
    start?: string;
    end?: string;
  }>;
}) {
  const sp = await searchParams;
  const range = reportRange(sp);
  const r = await computeReport(range.start, range.end, range.period, range.label);

  const netColor =
    r.net > 0
      ? "text-emerald-600"
      : r.net < -200
        ? "text-red-600"
        : "text-neutral-700";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {range.period === "month"
              ? "Monthly Report"
              : range.period === "range"
                ? "Report"
                : "End-of-Day Report"}
          </h1>
          <p className="text-sm text-neutral-500">{r.label}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ReportControls
            period={range.period}
            date={sp.date || today()}
            month={sp.month || today().slice(0, 7)}
            start={sp.start || today()}
            end={sp.end || today()}
          />
          <ExportButton
            type="report"
            params={{
              period: range.period,
              date: sp.date,
              month: sp.month,
              start: sp.start,
              end: sp.end,
            }}
          />
        </div>
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Inflow" value={rm(r.inflow)} valueClass="text-emerald-600" />
        <Tile
          label="Cash Out"
          value={rm(r.outflow)}
          valueClass="text-red-600"
          sub="paid by business"
        />
        <Tile label="Net Cashflow" value={rm(r.net)} valueClass={netColor} />
        <Tile
          label="Sessions"
          value={String(r.sessionCount)}
          sub={`avg ${rm(r.avgPerSession)}/session`}
        />
      </div>

      {/* Daily cashflow — day-by-day cash in / out / net / running balance */}
      <DailyCashflowSection report={r} />

      {/* Purchases & payables — accrual vs cash */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Purchases &amp; Payables</h2>
        <div className="space-y-1 text-sm">
          <Row label="Total purchases (period)" value={rm(r.purchases.total)} />
          <Row
            label="Paid by business (cash out)"
            value={rm(r.purchases.paidDirect)}
          />
          <Row
            label="Fronted by owner / on credit — not yet paid"
            value={rm(r.purchases.owed)}
            muted
          />
          <Row
            label="Reimbursements / creditors settled (cash paid back)"
            value={rm(r.purchases.reimbSettled)}
          />
          <div className="my-1 border-t border-neutral-100" />
          <Row
            label="Cash Out this period"
            value={rm(r.outflow)}
            strong
          />
          <Row
            label="Outstanding payables (all unsettled)"
            value={rm(r.outstandingReimbursements.total)}
            muted
          />
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Owner-fronted and creditor purchases are liabilities, not cash out —
          they only hit Cash Out when you settle them under Reimbursements.
        </p>
      </section>

      {/* Revenue split */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Revenue Split &amp; Margin</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 font-medium">Group</th>
                <th className="py-2 text-right font-medium">Revenue</th>
                <th className="py-2 text-right font-medium">Cost</th>
                <th className="py-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(
                [
                  ["Spa", r.split.spa],
                  ["Coffee", r.split.coffee],
                  ["Extras", r.split.extras],
                ] as const
              ).map(([label, g]) => (
                <tr key={label}>
                  <td className="py-2 font-medium">{label}</td>
                  <td className="py-2 text-right">{rm(g.revenue)}</td>
                  <td className="py-2 text-right text-neutral-500">
                    {rm(g.cost)}
                  </td>
                  <td className="py-2 text-right">
                    {g.revenue > 0 ? pct(g.margin) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Occupancy grid */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-1 font-semibold">Chair Occupancy</h2>
        <p className="mb-3 text-xs text-neutral-500">
          {r.days > 1 ? "Average % " : "% "}
          of each hour a chair was occupied (running or resting), {10}:00–{20}:00
          {r.days > 1 ? ` · averaged over ${r.days} days` : ""}
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-neutral-500">Chair</th>
                {r.hours.map((h) => (
                  <th
                    key={h}
                    className="px-1 py-1 text-center font-medium text-neutral-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.chairs.map((c) => (
                <tr key={c.id}>
                  <td className="px-2 py-1 font-medium">{c.label}</td>
                  {r.hours.map((h) => {
                    const cell = r.occupancy.find(
                      (o) => o.chairId === c.id && o.hour === h,
                    );
                    const p = cell?.pct ?? 0;
                    return (
                      <td key={h} className="p-0.5">
                        <div
                          className={`flex h-8 w-9 items-center justify-center rounded ${occColor(
                            p,
                          )}`}
                          title={`${c.label} @ ${h}:00 — ${p}%`}
                        >
                          {p > 0 ? `${p}%` : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Outstanding reimbursements */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-2 font-semibold">Outstanding Reimbursements</h2>
        {r.outstandingReimbursements.count === 0 ? (
          <p className="text-sm text-neutral-500">All settled. 🎉</p>
        ) : (
          <p className="text-sm">
            <span className="font-semibold">
              {r.outstandingReimbursements.count}
            </span>{" "}
            unsettled ·{" "}
            <span className="font-semibold text-amber-600">
              {rm(r.outstandingReimbursements.total)}
            </span>{" "}
            owed back —{" "}
            <a href="/reimbursements" className="text-emerald-700 underline">
              review
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

function DailyCashflowSection({
  report,
}: {
  report: Awaited<ReturnType<typeof computeReport>>;
}) {
  const daily = report.daily;
  const hasActivity = daily.some((d) => d.inflow !== 0 || d.outflow !== 0);
  // Charts read well up to ~2 months; beyond that the table alone stays legible.
  const showCharts = daily.length > 1 && daily.length <= 62;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="mb-3">
        <h2 className="font-semibold">Daily Cashflow</h2>
        <p className="text-xs text-neutral-500">
          Cash in vs cash out for each day, with a running balance (cash-basis).
        </p>
      </div>

      {!hasActivity ? (
        <p className="text-sm text-neutral-500">
          No cash movement in this period.
        </p>
      ) : (
        <>
          {showCharts && (
            <div className="space-y-6">
              <div>
                <div className="mb-1 flex items-center gap-4 text-xs text-neutral-500">
                  <Legend color="#5E8F45" label="Cash In" />
                  <Legend color="#DC2626" label="Cash Out" />
                </div>
                <GroupedBars
                  data={daily.map((d) => ({
                    label: d.label,
                    a: d.inflow,
                    b: d.outflow,
                  }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-neutral-500">
                  Running cash balance over the period (opens at RM0)
                </p>
                <BreakEvenChart
                  data={daily.map((d) => ({
                    label: d.label,
                    value: d.cumulative,
                  }))}
                />
              </div>
            </div>
          )}

          <div className={`overflow-x-auto ${showCharts ? "mt-6" : ""}`}>
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 text-right font-medium">Cash In</th>
                  <th className="py-2 text-right font-medium">Cash Out</th>
                  <th className="py-2 text-right font-medium">Net</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {daily.map((d) => (
                  <tr key={d.date}>
                    <td className="py-2 font-medium">{fmtDay(d.date)}</td>
                    <td className="py-2 text-right tabular-nums text-emerald-600">
                      {d.inflow ? rm(d.inflow) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums text-red-600">
                      {d.outflow ? rm(d.outflow) : "—"}
                    </td>
                    <td
                      className={`py-2 text-right font-medium tabular-nums ${signClass(d.net)}`}
                    >
                      {rm(d.net)}
                    </td>
                    <td
                      className={`py-2 text-right font-semibold tabular-nums ${signClass(d.cumulative)}`}
                    >
                      {rm(d.cumulative)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-200 font-semibold text-neutral-900">
                  <td className="py-2">Total</td>
                  <td className="py-2 text-right tabular-nums">
                    {rm(report.inflow)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {rm(report.outflow)}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${signClass(report.net)}`}>
                    {rm(report.net)}
                  </td>
                  <td className={`py-2 text-right tabular-nums ${signClass(report.net)}`}>
                    {rm(report.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            Cash out is what the business actually paid that day — direct
            purchases plus any reimbursements/creditors settled. Owner-fronted and
            credit purchases only appear on their settlement day.
          </p>
        </>
      )}
    </section>
  );
}

function Row({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 ${
        muted ? "text-neutral-500" : "text-neutral-700"
      } ${strong ? "font-semibold text-neutral-900" : ""}`}
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  valueClass = "text-neutral-900",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
