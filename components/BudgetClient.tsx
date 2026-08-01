"use client";

import { useMemo, useState } from "react";
import type { Account } from "@/lib/types";
import { rm } from "@/lib/format";
import { withDepth } from "@/lib/accounts";
import { naturalBalance } from "@/lib/ledger";
import { rollUpNumber, plGroup, higherIsBetter } from "@/lib/budget";

const TEAL = "#1F5A5E";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Period = { mode: "ytd" | "year" | "month"; month: number };

export function BudgetClient({
  accounts,
  year,
  currentYear,
  currentMonth,
  budgets,
  actualsNet,
}: {
  accounts: Account[];
  year: number;
  currentYear: number;
  currentMonth: number;
  budgets: Record<string, number>;
  actualsNet: Record<string, number[]>;
}) {
  const [budget, setBudget] = useState<Record<string, number>>(budgets);
  const [period, setPeriod] = useState<Period>({ mode: "ytd", month: currentMonth });
  const [saving, setSaving] = useState<string | null>(null);

  const monthsElapsed = year === currentYear ? currentMonth : 12;
  const months = useMemo(() => {
    if (period.mode === "year") return Array.from({ length: 12 }, (_, i) => i);
    if (period.mode === "month") return [period.month - 1];
    return Array.from({ length: monthsElapsed }, (_, i) => i); // ytd
  }, [period, monthsElapsed]);
  const periodLabel =
    period.mode === "year" ? "Full year" : period.mode === "month" ? MONTHS[period.month - 1] : "YTD";

  const rolledBudget = useMemo(() => rollUpNumber(accounts, budget), [accounts, budget]);
  const plRows = useMemo(
    () => withDepth(accounts).filter((a) => a.statement_group === "profit_loss"),
    [accounts],
  );

  function periodActual(code: string): number {
    const arr = actualsNet[code];
    if (!arr) return 0;
    return months.reduce((s, m) => s + (arr[m] ?? 0), 0);
  }

  async function saveBudget(code: string, amount: number) {
    setSaving(code);
    await fetch("/api/budgets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_code: code, fiscal_year: year, amount }),
    });
    setSaving(null);
  }

  // Summary over leaf accounts, grouped for the P&L.
  const summary = useMemo(() => {
    let revB = 0, revA = 0, expB = 0, expA = 0, oiB = 0, oiA = 0;
    for (const a of accounts) {
      if (!a.is_postable || a.statement_group !== "profit_loss") continue;
      const net = (actualsNet[a.code] ?? []).reduce(
        (s, v, m) => s + (months.includes(m) ? v : 0),
        0,
      );
      const pBud = (budget[a.code] ?? 0) * months.length;
      const g = plGroup(a.code);
      if (g === "revenue") { revA += -net; revB += pBud; }
      else if (g === "expense") { expA += net; expB += pBud; }
      else if (g === "other_income") { oiA += -net; oiB += pBud; }
    }
    return {
      revB, revA, expB, expA,
      netB: revB - expB + oiB,
      netA: revA - expA + oiA,
    };
  }, [accounts, actualsNet, months, budget]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budget vs Actual</h1>
          <p className="text-sm text-neutral-500">
            Monthly budgets per account · actuals from the ledger · {periodLabel} {year}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 p-0.5 text-sm">
          <a href={`/budget?year=${year - 1}`} className="rounded-md px-2 py-1 hover:bg-neutral-100">‹</a>
          <span className="px-2 font-medium tabular-nums">{year}</span>
          <a href={`/budget?year=${year + 1}`} className="rounded-md px-2 py-1 hover:bg-neutral-100">›</a>
        </div>
      </div>

      {/* Period toggle */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {(["ytd", "year", "month"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setPeriod((p) => ({ ...p, mode: m }))}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
              period.mode === m ? "border-transparent text-white" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            }`}
            style={period.mode === m ? { backgroundColor: TEAL } : undefined}
          >
            {m === "ytd" ? "YTD" : m === "year" ? "Full Year" : "Month"}
          </button>
        ))}
        {period.mode === "month" && (
          <select
            value={period.month}
            onChange={(e) => setPeriod((p) => ({ ...p, month: Number(e.target.value) }))}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          >
            {MONTHS.map((mn, i) => (
              <option key={mn} value={i + 1}>{mn} {year}</option>
            ))}
          </select>
        )}
      </div>

      {/* Summary tiles */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile label="Revenue" actual={summary.revA} budget={summary.revB} higherBetter />
        <SummaryTile label="Expenses" actual={summary.expA} budget={summary.expB} higherBetter={false} />
        <SummaryTile label="Net Profit" actual={summary.netA} budget={summary.netB} higherBetter />
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 text-right font-medium">Monthly&nbsp;Budget</th>
              <th className="px-3 py-2 text-right font-medium">Budget ({periodLabel})</th>
              <th className="px-3 py-2 text-right font-medium">Actual</th>
              <th className="px-3 py-2 text-right font-medium">Variance</th>
              <th className="px-3 py-2 text-right font-medium">%</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {plRows.map((a) => {
              const isHeader = !a.is_postable;
              const monthlyBudget = rolledBudget[a.code] ?? 0;
              const periodBudget = monthlyBudget * months.length;
              const actual = naturalBalance(a, periodActual(a.code));
              const variance = actual - periodBudget;
              const hasData = Math.abs(periodBudget) > 0.005 || Math.abs(actual) > 0.005;
              const favorable =
                Math.abs(variance) < 0.005 ? null : higherIsBetter(a.code) ? variance > 0 : variance < 0;
              const varClass =
                favorable === null ? "text-neutral-400" : favorable ? "text-emerald-600" : "text-red-600";
              const pctText =
                Math.abs(periodBudget) > 0.005 ? `${Math.round((variance / periodBudget) * 100)}%` : "—";
              return (
                <tr key={a.code} className={isHeader ? "bg-neutral-50/40" : ""}>
                  <td className="px-3 py-1.5">
                    <div style={{ paddingLeft: a.depth * 16 }}>
                      <span className={isHeader ? "font-semibold text-neutral-900" : ""}>{a.name}</span>
                      <span className="ml-2 font-mono text-xs text-neutral-400">{a.code}</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {isHeader ? (
                      <span className="text-neutral-500 tabular-nums">{monthlyBudget ? rm(monthlyBudget) : ""}</span>
                    ) : (
                      <input
                        type="number" min="0" step="10" inputMode="decimal"
                        value={budget[a.code] ? budget[a.code] : ""}
                        placeholder="0"
                        onChange={(e) =>
                          setBudget((b) => ({ ...b, [a.code]: Number(e.target.value) || 0 }))
                        }
                        onBlur={(e) => saveBudget(a.code, Number(e.target.value) || 0)}
                        className={`w-24 rounded-md border px-2 py-1 text-right text-sm ${
                          saving === a.code ? "border-emerald-400" : "border-neutral-200"
                        }`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-neutral-600">
                    {hasData ? rm(periodBudget) : ""}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {hasData ? rm(actual) : ""}
                  </td>
                  <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${varClass}`}>
                    {hasData ? rm(variance) : ""}
                  </td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${varClass}`}>
                    {hasData ? pctText : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        Enter a monthly budget on any leaf account — it saves automatically. The
        budget column multiplies it by the months in the selected period. Actuals
        come from posted journals; green variance is favourable (revenue above
        budget, or costs below).
      </p>
    </div>
  );
}

function SummaryTile({
  label,
  actual,
  budget,
  higherBetter,
}: {
  label: string;
  actual: number;
  budget: number;
  higherBetter: boolean;
}) {
  const variance = actual - budget;
  const favorable =
    Math.abs(variance) < 0.005 ? null : higherBetter ? variance > 0 : variance < 0;
  const color = favorable === null ? "#6B7280" : favorable ? "#16A34A" : "#DC2626";
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{rm(actual)}</p>
      <p className="mt-0.5 text-xs text-neutral-400 tabular-nums">
        vs {rm(budget)} budget
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums" style={{ color }}>
        {variance >= 0 ? "+" : ""}
        {rm(variance)} {favorable === null ? "" : favorable ? "favourable" : "over"}
      </p>
    </div>
  );
}
