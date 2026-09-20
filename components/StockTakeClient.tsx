"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Account, StockTake, StockTakeLine, StockTakeRow } from "@/lib/types";
import { rm, today } from "@/lib/format";

type TakeWithLines = StockTake & { lines: StockTakeLine[] };

type Detail = {
  take: StockTake;
  rows: StockTakeRow[];
  problems: { stock_class: string; message: string }[];
  totalConsumed: number;
  prior: { id: string; take_date: string } | null;
};

const label = (s: string) => s.replace(/_/g, " ");

export function StockTakeClient() {
  const [takes, setTakes] = useState<TakeWithLines[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New count
  const [takeDate, setTakeDate] = useState(today());
  const [preview, setPreview] = useState<StockTakeRow[]>([]);
  const [closing, setClosing] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  // Open take
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [tRes, aRes] = await Promise.all([
      fetch("/api/stock-takes", { cache: "no-store" }),
      fetch("/api/accounts", { cache: "no-store" }),
    ]);
    const tJson = await tRes.json();
    if (!tRes.ok) {
      setError(tJson.error ?? "Could not load stock takes.");
      setTakes([]);
      return;
    }
    setTakes(tJson.takes ?? []);
    if (aRes.ok) setAccounts((await aRes.json()).accounts ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // What this count will be measured against.
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(takeDate)) return;
    let cancelled = false;
    fetch(`/api/stock-takes/preview?date=${takeDate}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j.rows) setPreview(j.rows);
      });
    return () => {
      cancelled = true;
    };
  }, [takeDate]);

  const cogsOptions = useMemo(
    () => accounts.filter((a) => a.is_postable && a.is_active && a.code.startsWith("5")),
    [accounts],
  );

  async function openTake(id: string) {
    setOpenId(id);
    setDetail(null);
    setChosen({});
    const res = await fetch(`/api/stock-takes/${id}`, { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) {
      setError(j.error ?? "Could not load that take.");
      return;
    }
    setDetail(j);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      take_date: takeDate,
      notes,
      closing: Object.fromEntries(
        Object.entries(closing)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, Number(v) || 0]),
      ),
    };
    const res = await fetch("/api/stock-takes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not save.");
      return;
    }
    const { take } = await res.json();
    setClosing({});
    setNotes("");
    await load();
    openTake(take.id);
  }

  async function post() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/stock-takes/${detail.take.id}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts: chosen }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? "Could not post the stock take.");
      return;
    }
    await load();
    openTake(detail.take.id);
  }

  // Classes worth showing on the count form: anything with stock behind it,
  // plus anything already typed into.
  const countable = preview.filter(
    (r) => r.opening > 0 || r.purchases > 0 || closing[r.stock_class],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Take</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-500">
          Count what&apos;s left at month end. Opening plus purchases minus your
          count is what was used, and that gets charged to cost of goods.
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* New count */}
      <form onSubmit={save} className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Count date</span>
            <input
              type="date"
              value={takeDate}
              onChange={(e) => setTakeDate(e.target.value)}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex-1 text-sm">
            <span className="mb-1 block text-neutral-600">Notes (optional)</span>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. counted with MG after close"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        {countable.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No stock to count for this date. Record purchases with type{" "}
            <strong>Stock</strong> first — they show up here automatically.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Stock class</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Opening</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Purchases</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Counted</th>
                  <th className="w-28 px-3 py-2 text-right font-medium">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {countable.map((r) => {
                  const counted = Number(closing[r.stock_class] ?? 0);
                  const used =
                    Math.round((r.opening + r.purchases - counted) * 100) / 100;
                  return (
                    <tr key={r.stock_class}>
                      <td className="px-3 py-2 capitalize">{label(r.stock_class)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                        {rm(r.opening)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                        {rm(r.purchases)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={closing[r.stock_class] ?? ""}
                          onChange={(e) =>
                            setClosing((c) => ({ ...c, [r.stock_class]: e.target.value }))
                          }
                          placeholder="0.00"
                          className="w-28 rounded-lg border border-neutral-300 px-2 py-1 text-right text-sm tabular-nums"
                        />
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold tabular-nums ${
                          used < 0 ? "text-red-600" : ""
                        }`}
                      >
                        {rm(used)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4">
          <button
            type="submit"
            disabled={busy || countable.length === 0}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save count"}
          </button>
        </div>
      </form>

      {/* Takes */}
      <div>
        <h2 className="mb-3 font-semibold">Counts</h2>
        {!takes ? (
          <p className="text-neutral-500">Loading…</p>
        ) : takes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
            No stock takes yet.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {takes.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <button
                  onClick={() => openTake(t.id)}
                  className="font-medium text-emerald-700 underline underline-offset-2"
                >
                  {t.take_date}
                </button>
                <span className="text-sm text-neutral-500">
                  {t.lines.length} class{t.lines.length === 1 ? "" : "es"} counted
                </span>
                {t.notes && (
                  <span className="text-xs text-neutral-400">{t.notes}</span>
                )}
                <span className="ml-auto text-sm">
                  {t.journal_id ? (
                    <span className="text-emerald-700">Posted</span>
                  ) : (
                    <span className="text-amber-600">Not posted</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detail / post */}
      {openId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
          <div className="w-full max-w-3xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-bold tracking-tight">
                Stock take {detail?.take.take_date ?? ""}
              </h2>
              <button
                onClick={() => {
                  setOpenId(null);
                  setDetail(null);
                }}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
              >
                Close
              </button>
            </div>

            {!detail ? (
              <p className="text-neutral-500">Loading…</p>
            ) : (
              <>
                {detail.problems.length > 0 && (
                  <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    <p className="font-medium">This can&apos;t be posted yet</p>
                    <ul className="mt-1 list-disc pl-5">
                      {detail.problems.map((p, i) => (
                        <li key={i}>
                          <span className="capitalize">{label(p.stock_class)}</span>:{" "}
                          {p.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-neutral-200">
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Class</th>
                        <th className="w-24 px-3 py-2 text-right font-medium">Opening</th>
                        <th className="w-24 px-3 py-2 text-right font-medium">Bought</th>
                        <th className="w-24 px-3 py-2 text-right font-medium">Counted</th>
                        <th className="w-24 px-3 py-2 text-right font-medium">Used</th>
                        <th className="px-3 py-2 font-medium">Charged to</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {detail.rows.map((r) => (
                        <tr key={r.stock_class}>
                          <td className="px-3 py-2 capitalize">{label(r.stock_class)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                            {rm(r.opening)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                            {rm(r.purchases)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-neutral-500">
                            {rm(r.closing)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            {rm(r.consumed)}
                          </td>
                          <td className="px-3 py-2">
                            {r.consumed <= 0 ? (
                              <span className="text-xs text-neutral-400">—</span>
                            ) : detail.take.journal_id ? (
                              <span className="text-xs">{r.cogsAccount ?? "—"}</span>
                            ) : r.cogsAccount ? (
                              <span className="text-xs text-neutral-600">
                                {r.cogsAccount}
                              </span>
                            ) : (
                              <select
                                value={chosen[r.stock_class] ?? ""}
                                onChange={(e) =>
                                  setChosen((c) => ({
                                    ...c,
                                    [r.stock_class]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs"
                              >
                                <option value="">— choose an account —</option>
                                {cogsOptions.map((a) => (
                                  <option key={a.code} value={a.code}>
                                    {a.code} · {a.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-neutral-900 font-bold">
                        <td className="px-3 py-2" colSpan={4}>
                          Charged to cost of goods
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {rm(detail.totalConsumed)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {detail.take.journal_id ? (
                  <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    Posted. To change it, reverse the journal in the Ledger — a posted
                    take isn&apos;t edited in place.
                  </p>
                ) : (
                  <div className="mt-5 flex items-center gap-3">
                    <button
                      onClick={post}
                      disabled={busy || detail.problems.length > 0}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {busy ? "Posting…" : `Charge ${rm(detail.totalConsumed)}`}
                    </button>
                    <p className="text-xs text-neutral-500">
                      Debits cost of goods, credits inventory.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
