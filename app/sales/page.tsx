import { getSalesLedger } from "@/lib/sales";
import { reportRange } from "@/lib/reports";
import { rm, today, timeOfDay } from "@/lib/format";
import { ReportControls } from "@/components/ReportControls";
import { ExportButton } from "@/components/ExportButton";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const range = reportRange(sp);
  const rows = await getSalesLedger(range.start, range.end);

  const total = rows.reduce((a, r) => a + r.total, 0);
  const byMethod = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.payment_method] = (acc[r.payment_method] || 0) + r.total;
    return acc;
  }, {});
  const quickCount = rows.filter((r) => r.kind === "quick").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales</h1>
          <p className="text-sm text-neutral-500">{range.label}</p>
        </div>
        <div className="flex items-center gap-3">
          <ReportControls
            period={range.period}
            date={sp.date || today()}
            month={sp.month || today().slice(0, 7)}
            basePath="/sales"
          />
          <ExportButton
            type="sales"
            params={{ period: range.period, date: sp.date, month: sp.month }}
          />
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Total Sales" value={rm(total)} valueClass="text-emerald-600" />
        <Tile
          label="Transactions"
          value={String(rows.length)}
          sub={`${rows.length - quickCount} chair · ${quickCount} quick`}
        />
        {["cash", "ewallet", "bank_transfer"].map((m) => (
          <Tile
            key={m}
            label={m.replace("_", " ")}
            value={rm(byMethod[m] || 0)}
          />
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          No sales in this period.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">
                    {range.period === "month" ? `${r.sale_date} · ` : ""}
                    {timeOfDay(r.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.kind === "quick"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {r.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{r.items}</td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {r.payment_method.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {rm(r.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
      <p className="text-xs uppercase tracking-wide text-neutral-500 capitalize">
        {label}
      </p>
      <p className={`mt-1 text-xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
