import { computeReport } from "@/lib/reports";
import { rm, today } from "@/lib/format";
import { DatePicker } from "@/components/DatePicker";

export const dynamic = "force-dynamic";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
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
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const day = date || today();
  const r = await computeReport(day);

  const netColor =
    r.net > 0
      ? "text-emerald-600"
      : r.net < -200
        ? "text-red-600"
        : "text-neutral-700";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">End-of-Day Report</h1>
        <DatePicker date={day} />
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Inflow" value={rm(r.inflow)} valueClass="text-emerald-600" />
        <Tile label="Outflow" value={rm(r.outflow)} valueClass="text-red-600" />
        <Tile label="Net Cashflow" value={rm(r.net)} valueClass={netColor} />
        <Tile
          label="Sessions"
          value={String(r.sessionCount)}
          sub={`avg ${rm(r.avgPerSession)}/session`}
        />
      </div>

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
          % of each hour a chair was occupied (running or resting), {10}:00–
          {20}:00
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
