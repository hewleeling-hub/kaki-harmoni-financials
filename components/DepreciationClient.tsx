"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { monthLabel } from "@/lib/amortisation";
import { humanise, rm, today } from "@/lib/format";
import type { DepreciationCharge, Expense } from "@/lib/types";

type Row = {
  expense: Expense;
  schedule: { period: string; amount: number }[];
  charged: DepreciationCharge[];
  chargedTotal: number;
  netBookValue: number;
  assetAccount: string | null;
  purchaseJournalId: string | null;
  expenseAccount: string | null;
  accumulatedAccount: string | null;
  lifeMonths: number | null;
  suggestedLife: number | null;
  startDate: string;
  outstanding: { period: string; amount: number }[];
  outstandingTotal: number;
  blocked: string | null;
};

type Data = {
  through: string;
  label: string;
  rows: Row[];
  due: { period: string; total: number; count: number }[];
  dueTotal: number;
};

const years = (months: number) =>
  months % 12 === 0 ? `${months / 12} year${months === 12 ? "" : "s"}` : `${months} months`;

export function DepreciationClient() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [lives, setLives] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/depreciation?through=${month}-01`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Could not load the asset register.");
      return;
    }
    setData(j);
    setLives({});
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  // Saving a life is deliberately its own step: it decides what every future
  // month costs, and it shouldn't ride along with the click that posts.
  async function saveLives() {
    const assets = Object.fromEntries(
      Object.entries(lives)
        .filter(([, v]) => v !== "")
        .map(([id, v]) => [id, { months: Number(v) }]),
    );
    if (!Object.keys(assets).length) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/depreciation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      return;
    }
    await load();
  }

  async function charge() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/depreciation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ through: `${month}-01` }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Could not post the depreciation.");
      await load();
      return;
    }
    const months = (j.journals ?? []).length;
    setResult(
      `Wrote off ${rm(j.charged)} across ${months} month${months === 1 ? "" : "s"}. ${
        months === 1 ? "The entry is" : "The entries are"
      } in the Ledger.`,
    );
    await load();
  }

  const rows = data?.rows ?? [];
  const pendingLives = Object.values(lives).filter((v) => v !== "").length;
  const cost = rows.reduce((a, r) => a + Number(r.expense.amount), 0);
  const written = rows.reduce((a, r) => a + r.chargedTotal, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Depreciation</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          An asset isn&apos;t spent the day it&apos;s bought — it earns its keep over
          years, so its cost is written off month by month across its useful life.
          The asset account keeps the original cost and the accumulated account
          carries what&apos;s been written off, so you can always see both.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {result && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {result}
        </div>
      )}

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-6">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Write off up to</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-neutral-600">Cost of assets</span>
            <span className="text-lg font-semibold tabular-nums">{rm(cost)}</span>
          </div>
          <div className="text-sm">
            <span className="mb-1 block text-neutral-600">Written off so far</span>
            <span className="text-lg font-semibold tabular-nums">{rm(written)}</span>
          </div>
          <div className="text-sm">
            <span className="mb-1 block text-neutral-600">Due</span>
            <span className="text-lg font-bold tabular-nums">{rm(data?.dueTotal ?? 0)}</span>
          </div>
          <button
            onClick={charge}
            disabled={busy || !(data?.dueTotal ?? 0)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Posting…" : `Write off ${rm(data?.dueTotal ?? 0)}`}
          </button>
        </div>

        {(data?.due ?? []).length > 1 && (
          <p className="mt-3 text-xs text-neutral-500">
            {data!.due.length} months outstanding —{" "}
            {data!.due.map((d) => monthLabel(d.period)).join(", ")}. Each gets its own
            entry, dated that month.
          </p>
        )}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Asset register</h2>
          {pendingLives > 0 && (
            <button
              onClick={saveLives}
              disabled={busy}
              className="rounded-lg border border-neutral-900 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : `Save ${pendingLives} useful ${pendingLives === 1 ? "life" : "lives"}`}
            </button>
          )}
        </div>

        {!data ? (
          <p className="text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
            No fixed assets yet. Record one in{" "}
            <Link href="/expenses" className="text-emerald-700 underline">
              Purchases
            </Link>{" "}
            with the type <strong>Fixed Asset</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 text-right font-medium">Cost</th>
                  <th className="w-40 px-4 py-3 font-medium">Useful life</th>
                  <th className="px-4 py-3 text-right font-medium">Per month</th>
                  <th className="px-4 py-3 text-right font-medium">Written off</th>
                  <th className="px-4 py-3 text-right font-medium">Net book value</th>
                  <th className="px-4 py-3 font-medium">Charge to</th>
                  <th className="px-4 py-3 text-right font-medium">Due now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => {
                  const perMonth = r.schedule[0]?.amount ?? 0;
                  const last = r.schedule[r.schedule.length - 1];
                  const unposted = !r.purchaseJournalId;
                  return (
                    <tr key={r.expense.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.expense.vendor}</div>
                        <div className="text-xs text-neutral-500">
                          {r.expense.po_number ?? "—"} ·{" "}
                          {humanise(r.expense.category)}
                        </div>
                        {r.blocked && (
                          <div
                            className={`mt-1 text-xs ${
                              r.blocked.startsWith("Up to date") ||
                              r.blocked.startsWith("Nothing due")
                                ? "text-neutral-400"
                                : "text-amber-700"
                            }`}
                          >
                            {r.blocked}
                            {unposted && (
                              <>
                                {" "}
                                <Link href="/expenses" className="text-emerald-700 underline">
                                  Go to Purchases
                                </Link>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {rm(r.expense.amount)}
                        <div className="text-xs text-neutral-400">
                          {r.assetAccount ?? "unposted"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              lives[r.expense.id] ??
                              (r.lifeMonths ? String(r.lifeMonths) : "")
                            }
                            placeholder={
                              r.suggestedLife ? String(r.suggestedLife) : "months"
                            }
                            onChange={(e) =>
                              setLives((l) => ({ ...l, [r.expense.id]: e.target.value }))
                            }
                            className={`w-20 rounded-lg border px-2 py-1 text-right text-sm tabular-nums ${
                              r.lifeMonths ? "border-neutral-300" : "border-amber-300 bg-amber-50"
                            }`}
                          />
                          <span className="text-xs text-neutral-500">months</span>
                        </div>
                        <div className="mt-1 text-xs text-neutral-400">
                          {r.lifeMonths
                            ? `${years(r.lifeMonths)} from ${r.startDate}`
                            : r.suggestedLife
                              ? `suggested ${years(r.suggestedLife)}`
                              : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                        {r.schedule.length ? rm(perMonth) : "—"}
                        {last && (
                          <div className="text-xs text-neutral-400">
                            to {monthLabel(last.period)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                        {rm(r.chargedTotal)}
                        {r.schedule.length > 0 && (
                          <div className="text-xs text-neutral-400">
                            {r.charged.length} of {r.schedule.length} months
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {rm(r.netBookValue)}
                      </td>
                      <td className="px-4 py-3 text-xs text-neutral-600">
                        {r.expenseAccount && r.accumulatedAccount ? (
                          <>
                            <div>Dr {r.expenseAccount}</div>
                            <div className="text-neutral-400">
                              Cr {r.accumulatedAccount}
                            </div>
                          </>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.outstanding.length ? (
                          <>
                            <span className="font-semibold">{rm(r.outstandingTotal)}</span>
                            <div className="text-xs text-neutral-400">
                              {r.outstanding.length} month
                              {r.outstanding.length === 1 ? "" : "s"}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 max-w-2xl text-xs text-neutral-500">
          The suggested lives are a starting point, not a rule — 10 years for
          furniture and fittings, 5 for equipment and the fit-out, 3 for computers
          and POS. Change any of them before saving; nothing is written off until a
          life is set, so a suggestion can never reach the books on its own.
        </p>
      </div>
    </div>
  );
}
