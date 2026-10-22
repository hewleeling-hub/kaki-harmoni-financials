import { rm } from "@/lib/format";
import type {
  BalanceSheet,
  ProfitAndLoss,
  StatementLine,
  Total,
} from "@/lib/financialStatements";

// Brackets for credits, the way an accountant reads a statement.
function money(n: number) {
  return n < 0 ? `(${rm(Math.abs(n))})` : rm(n);
}

function Section({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-neutral-500">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
      {footer && <div className="border-t border-neutral-200 px-5 py-3 text-xs">{footer}</div>}
    </div>
  );
}

function GroupRow({ label, cols }: { label: string; cols: number }) {
  return (
    <tr className="bg-neutral-50">
      <td
        colSpan={cols}
        className="px-5 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500"
      >
        {label}
      </td>
    </tr>
  );
}

function Row({ line, columns }: { line: StatementLine; columns: 1 | 2 }) {
  return (
    <tr className="border-t border-neutral-100">
      <td className="px-5 py-2 pl-9">{line.name}</td>
      <td className="px-3 py-2 text-xs text-neutral-400">{line.code}</td>
      {columns === 2 && (
        <td className="px-5 py-2 text-right tabular-nums">{money(line.period)}</td>
      )}
      <td className="px-5 py-2 text-right tabular-nums">{money(line.cumulative)}</td>
    </tr>
  );
}

function TotalRow({
  label,
  value,
  columns,
  strong = false,
  highlight = false,
}: {
  label: string;
  value: Total | number;
  columns: 1 | 2;
  strong?: boolean;
  highlight?: boolean;
}) {
  const weight = strong ? "font-semibold" : "font-medium";
  const single = typeof value === "number";
  return (
    <tr
      className={`border-t ${strong ? "border-neutral-300" : "border-neutral-100"} ${
        highlight ? "bg-emerald-50" : ""
      }`}
    >
      <td className={`px-5 py-2 ${weight}`}>{label}</td>
      <td className="px-3 py-2" />
      {columns === 2 && (
        <td className={`px-5 py-2 text-right tabular-nums ${weight}`}>
          {money(single ? value : value.period)}
        </td>
      )}
      <td className={`px-5 py-2 text-right tabular-nums ${weight}`}>
        {money(single ? value : value.cumulative)}
      </td>
    </tr>
  );
}

export function ProfitAndLossReport({
  pl,
  periodLabel,
  asAt,
}: {
  pl: ProfitAndLoss;
  periodLabel: string;
  asAt: string;
}) {
  return (
    <Section title="Profit &amp; Loss" subtitle={`${periodLabel}, beside everything to ${asAt}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left">
            <th className="px-5 py-2 text-xs font-medium text-neutral-500">Account</th>
            <th className="px-3 py-2 text-xs font-medium text-neutral-500">A/C</th>
            <th className="px-5 py-2 text-right text-xs font-medium text-neutral-500">
              {periodLabel}
            </th>
            <th className="px-5 py-2 text-right text-xs font-medium text-neutral-500">To date</th>
          </tr>
        </thead>
        <tbody>
          <GroupRow label="Revenue" cols={4} />
          {pl.revenue.map((l) => <Row key={l.code} line={l} columns={2} />)}
          <TotalRow label="Gross revenue" value={pl.grossRevenue} columns={2} />
          {pl.discounts.map((l) => <Row key={l.code} line={l} columns={2} />)}
          <TotalRow label="Net revenue" value={pl.netRevenue} columns={2} strong />

          <GroupRow label="Cost of sales" cols={4} />
          {pl.costOfSales.map((l) => <Row key={l.code} line={l} columns={2} />)}
          <TotalRow label="Total cost of sales" value={pl.totalCostOfSales} columns={2} />
          <TotalRow label="Gross profit / (loss)" value={pl.grossProfit} columns={2} strong />

          <GroupRow label="Operating expenses" cols={4} />
          {pl.operatingExpenses.map((l) => <Row key={l.code} line={l} columns={2} />)}
          <TotalRow
            label="Total operating expenses"
            value={pl.totalOperatingExpenses}
            columns={2}
          />
          <TotalRow
            label="Profit / (loss) for the period"
            value={pl.profit}
            columns={2}
            strong
            highlight
          />
        </tbody>
      </table>
    </Section>
  );
}

export function BalanceSheetReport({ bs, asAt }: { bs: BalanceSheet; asAt: string }) {
  return (
    <Section
      title="Balance Sheet"
      subtitle={`As at ${asAt}`}
      footer={
        bs.outOfBalanceBy === 0 ? (
          <span className="text-emerald-700">
            Balanced — total assets agree with total liabilities and equity.
          </span>
        ) : (
          <span className="text-red-600">
            Out of balance by {rm(bs.outOfBalanceBy)}. The ledger does not foot, so do not rely
            on these figures until that is found.
          </span>
        )
      }
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-neutral-50 text-left">
            <th className="px-5 py-2 text-xs font-medium text-neutral-500">Account</th>
            <th className="px-3 py-2 text-xs font-medium text-neutral-500">A/C</th>
            <th className="px-5 py-2 text-right text-xs font-medium text-neutral-500">RM</th>
          </tr>
        </thead>
        <tbody>
          <GroupRow label="Non-current assets" cols={3} />
          {bs.nonCurrent.map((l) => <Row key={l.code} line={l} columns={1} />)}
          <TotalRow label="At cost" value={bs.totalCost} columns={1} />
          {bs.accumulatedDepreciation.map((l) => (
            <Row
              key={l.code}
              line={{ ...l, cumulative: -l.cumulative, period: -l.period }}
              columns={1}
            />
          ))}
          <TotalRow label="Net book value" value={bs.netBookValue} columns={1} strong />

          <GroupRow label="Current assets" cols={3} />
          {bs.current.map((l) => <Row key={l.code} line={l} columns={1} />)}
          <TotalRow label="Total current assets" value={bs.totalCurrent} columns={1} />
          <TotalRow label="Total assets" value={bs.totalAssets} columns={1} strong highlight />

          <GroupRow label="Liabilities" cols={3} />
          {bs.liabilities.map((l) => <Row key={l.code} line={l} columns={1} />)}
          <TotalRow label="Total liabilities" value={bs.totalLiabilities} columns={1} strong />

          <GroupRow label="Equity" cols={3} />
          <tr className="border-t border-neutral-100">
            <td className="px-5 py-2 pl-9">Share capital</td>
            <td className="px-3 py-2 text-xs text-neutral-400">3100</td>
            <td className="px-5 py-2 text-right tabular-nums">{money(bs.shareCapital)}</td>
          </tr>
          <tr className="border-t border-neutral-100">
            <td className="px-5 py-2 pl-9">Retained profit / (loss)</td>
            <td className="px-3 py-2" />
            <td className="px-5 py-2 text-right tabular-nums">{money(bs.retainedEarnings)}</td>
          </tr>
          <TotalRow label="Total equity" value={bs.totalEquity} columns={1} strong />
          <TotalRow
            label="Total liabilities and equity"
            value={bs.totalLiabilitiesAndEquity}
            columns={1}
            strong
            highlight
          />
        </tbody>
      </table>
    </Section>
  );
}
