"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { monthLabel } from "@/lib/amortisation";
import { rm, today } from "@/lib/format";
import type { Account, Expense, SubscriptionCharge } from "@/lib/types";

type Row = {
  expense: Expense;
  schedule: { period: string; amount: number }[];
  charged: SubscriptionCharge[];
  chargedTotal: number;
  prepaidBalance: number;
  prepaidAccount: string | null;
  purchaseJournalId: string | null;
  expenseAccount: string | null;
  expenseAccountIsChosen: boolean;
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

export function AmortisationClient() {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [data, setData] = useState<Data | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [chosen, setChosen] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/amortisation?through=${month}-01`, {
      cache: "no-store",
    });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Could not load subscriptions.");
      return;
    }
    setData(j);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/accounts", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { accounts: [] }))
      .then((j) => setAccounts(j.accounts ?? []));
  }, []);

  // Where a monthly charge can land: running costs and cost of sales.
  const chargeOptions = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.is_postable &&
          a.is_active &&
          (a.code.startsWith("6") || a.code.startsWith("5")),
      ),
    [accounts],
  );

  const accountName = (code: string | null) =>
    code ? (accounts.find((a) => a.code === code)?.name ?? "") : "";

  async function charge() {
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await fetch("/api/amortisation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ through: `${month}-01`, accounts: chosen }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(j.error ?? "Could not charge the subscriptions.");
      await load();
      return;
    }
    const months = (j.journals ?? []).length;
    setResult(
      `Charged ${rm(j.charged)} across ${months} month${months === 1 ? "" : "s"}. ${
        months === 1 ? "The entry is" : "The entries are"
      } in the Ledger.`,
    );
    setChosen({});
    await load();
  }

  const rows = data?.rows ?? [];
  const ready = rows.filter((r) => r.outstanding.length > 0 && !r.blocked);
  const needsAccount = ready.filter((r) => !(chosen[r.expense.id] || r.expenseAccount));
  const canCharge = ready.length > 0 && needsAccount.length === 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Amortisation</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Anything paid up front — a subscription, rent, insurance, a licence —
          sits in prepaid and a slice moves to expenses each month. Charged in
          whole months from the month of purchase, so the prepaid balance walks
          down to exactly zero on the last month of the term.
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
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Charge up to</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-neutral-600">Due</span>
            <span className="text-lg font-bold tabular-nums">
              {rm(data?.dueTotal ?? 0)}
            </span>
          </div>
          <button
            onClick={charge}
            disabled={busy || !canCharge}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy
              ? "Charging…"
              : `Charge ${rm(data?.dueTotal ?? 0)}`}
          </button>
        </div>

        {(data?.due ?? []).length > 1 && (
          <p className="mt-3 text-xs text-neutral-500">
            {data!.due.length} months are outstanding —{" "}
            {data!.due.map((d) => monthLabel(d.period)).join(", ")}. Each gets its
            own entry, dated that month.
          </p>
        )}
        {needsAccount.length > 0 && (
          <p className="mt-3 text-xs text-amber-700">
            Choose the account to charge for{" "}
            {needsAccount.map((r) => r.expense.po_number ?? r.expense.vendor).join(", ")}{" "}
            before this can be posted.
          </p>
        )}
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Prepayments</h2>
        {!data ? (
          <p className="text-neutral-500">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
            Nothing prepaid yet. Record one in{" "}
            <Link href="/expenses" className="text-emerald-700 underline">
              Purchases
            </Link>{" "}
            as a fixed asset with the class <strong>Subscription</strong> or{" "}
            <strong>Prepayment</strong>, and say how many months it covers.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Prepayment</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 text-right font-medium">Per month</th>
                  <th className="px-4 py-3 text-right font-medium">Charged</th>
                  <th className="px-4 py-3 text-right font-medium">In prepaid</th>
                  <th className="px-4 py-3 font-medium">Charge to</th>
                  <th className="px-4 py-3 text-right font-medium">Due now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => {
                  const perMonth = r.schedule[0]?.amount ?? 0;
                  const last = r.schedule[r.schedule.length - 1];
                  const monthsCharged = r.charged.length;
                  const isReady = r.outstanding.length > 0 && !r.blocked;
                  return (
                    <tr key={r.expense.id} className="align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.expense.vendor}</div>
                        <div className="text-xs text-neutral-500">
                          {r.expense.po_number ?? "—"}
                          {r.expense.description ? ` · ${r.expense.description}` : ""}
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
                            {!r.purchaseJournalId && (
                              <>
                                {" "}
                                <Link
                                  href="/expenses"
                                  className="text-emerald-700 underline"
                                >
                                  Go to Purchases
                                </Link>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {r.expense.subscription_months
                          ? `${r.expense.subscription_months} months`
                          : "—"}
                        {last && (
                          <div className="text-xs text-neutral-400">
                            last charge {monthLabel(last.period)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                        {r.schedule.length ? rm(perMonth) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                        {rm(r.chargedTotal)}
                        {r.schedule.length > 0 && (
                          <div className="text-xs text-neutral-400">
                            {monthsCharged} of {r.schedule.length} months
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {rm(r.prepaidBalance)}
                        {r.prepaidAccount && (
                          <div className="text-xs text-neutral-400">
                            {r.prepaidAccount}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!isReady && r.expenseAccount ? (
                          <span className="text-xs text-neutral-500">
                            {r.expenseAccount} · {accountName(r.expenseAccount)}
                          </span>
                        ) : !isReady ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : (
                          <select
                            value={chosen[r.expense.id] ?? r.expenseAccount ?? ""}
                            onChange={(e) =>
                              setChosen((c) => ({ ...c, [r.expense.id]: e.target.value }))
                            }
                            className={`w-56 rounded-lg border px-2 py-1 text-xs ${
                              chosen[r.expense.id] || r.expenseAccount
                                ? "border-neutral-300"
                                : "border-amber-300 bg-amber-50"
                            }`}
                          >
                            <option value="">— choose an account —</option>
                            {chargeOptions.map((a) => (
                              <option key={a.code} value={a.code}>
                                {a.code} · {a.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.outstanding.length ? (
                          <>
                            <span className="font-semibold">
                              {rm(r.outstandingTotal)}
                            </span>
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
      </div>
    </div>
  );
}
