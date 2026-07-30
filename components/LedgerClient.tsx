"use client";

import { useEffect, useMemo, useState } from "react";
import type { Account, JournalWithLines } from "@/lib/types";
import { rm, today } from "@/lib/format";
import { sumLines, rollUp, buildTrialBalance } from "@/lib/ledger";

const TEAL = "#1F5A5E";

export function LedgerClient({ accounts }: { accounts: Account[] }) {
  const [journals, setJournals] = useState<JournalWithLines[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nameByCode = useMemo(
    () => new Map(accounts.map((a) => [a.code, a.name])),
    [accounts],
  );
  const postable = useMemo(
    () => accounts.filter((a) => a.is_postable && a.is_active),
    [accounts],
  );

  async function load() {
    const res = await fetch("/api/journals", { cache: "no-store" });
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error ?? "Could not load the ledger.");
      setJournals([]);
      return;
    }
    setErr(null);
    setJournals(j.journals ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  function flash(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  }

  const trial = useMemo(() => {
    const lines = (journals ?? []).flatMap((j) => j.lines);
    const rolled = rollUp(accounts, sumLines(lines));
    return buildTrialBalance(accounts, rolled);
  }, [journals, accounts]);

  const balanced = Math.abs(trial.totalDebit - trial.totalCredit) < 0.005;

  async function reverse(id: string) {
    if (!confirm("Post a reversing entry for this journal?")) return;
    setBusyId(id);
    const res = await fetch(`/api/journals/${id}/reverse`, { method: "POST" });
    setBusyId(null);
    const j = await res.json();
    if (!res.ok) {
      flash(j.error ?? "Could not reverse.");
      return;
    }
    flash("Reversing entry posted.");
    load();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
          <p className="text-sm text-neutral-500">
            Double-entry journals — every entry balances. Balances flow to the
            Chart of Accounts.
          </p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          disabled={!!err}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: TEAL }}
        >
          + New Journal Entry
        </button>
      </div>

      {toast && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {toast}
        </div>
      )}

      {err && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {err} If this is the first run, apply{" "}
          <code>supabase/migrations/0005_ledger.sql</code> in Supabase, then
          reload.
        </div>
      )}

      {/* Trial balance */}
      <section className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Trial Balance</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              balanced
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {balanced ? "In balance" : "Out of balance"}
          </span>
        </div>
        {trial.rows.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No postings yet. Create a journal entry to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2 font-medium">Code</th>
                  <th className="py-2 font-medium">Account</th>
                  <th className="py-2 text-right font-medium">Debit</th>
                  <th className="py-2 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {trial.rows.map((r) => (
                  <tr key={r.code}>
                    <td className="py-2 font-mono text-xs text-neutral-500">{r.code}</td>
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.debit ? rm(r.debit) : ""}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {r.credit ? rm(r.credit) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-200 font-semibold">
                  <td className="py-2" colSpan={2}>Total</td>
                  <td className="py-2 text-right tabular-nums">{rm(trial.totalDebit)}</td>
                  <td className="py-2 text-right tabular-nums">{rm(trial.totalCredit)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Journals */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">Journal Entries</h2>
        {!journals ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : journals.length === 0 ? (
          <p className="text-sm text-neutral-500">No journals posted yet.</p>
        ) : (
          <div className="space-y-3">
            {journals.map((j) => {
              const total = j.lines.reduce((a, l) => a + Number(l.debit), 0);
              const isReversal = j.source === "reversal";
              return (
                <div
                  key={j.id}
                  className={`rounded-xl border p-3 ${
                    j.reversed_by ? "border-neutral-200 bg-neutral-50" : "border-neutral-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{j.entry_date}</span>
                      {j.memo && <span className="text-neutral-600">· {j.memo}</span>}
                      {j.reference && (
                        <span className="text-xs text-neutral-400">({j.reference})</span>
                      )}
                      {isReversal && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">Reversal</span>
                      )}
                      {j.reversed_by && (
                        <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600">Reversed</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{rm(total)}</span>
                      {!j.reversed_by && !isReversal && (
                        <button
                          onClick={() => reverse(j.id)}
                          disabled={busyId === j.id}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
                        >
                          {busyId === j.id ? "…" : "Reverse"}
                        </button>
                      )}
                    </div>
                  </div>
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {j.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-0.5 font-mono text-xs text-neutral-400">{l.account_code}</td>
                          <td className="py-0.5 text-neutral-700">{nameByCode.get(l.account_code) ?? ""}</td>
                          <td className="py-0.5 text-right tabular-nums">
                            {Number(l.debit) ? rm(l.debit) : ""}
                          </td>
                          <td className="py-0.5 text-right tabular-nums text-neutral-500">
                            {Number(l.credit) ? rm(l.credit) : ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {formOpen && (
        <JournalForm
          accounts={postable}
          onClose={() => setFormOpen(false)}
          onPosted={() => {
            setFormOpen(false);
            flash("Journal posted.");
            load();
          }}
        />
      )}
    </div>
  );
}

// ── Journal entry form ───────────────────────────────────────────────────────
type Line = { account_code: string; debit: string; credit: string };
const emptyLine = (): Line => ({ account_code: "", debit: "", credit: "" });

function JournalForm({
  accounts,
  onClose,
  onPosted,
}: {
  accounts: Account[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const [date, setDate] = useState(today());
  const [memo, setMemo] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totalDebit = lines.reduce((a, l) => a + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((a, l) => a + (Number(l.credit) || 0), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const balanced = Math.abs(diff) < 0.005 && totalDebit > 0;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function post() {
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/journals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entry_date: date,
        memo,
        reference,
        lines: lines
          .filter((l) => l.account_code && (Number(l.debit) || Number(l.credit)))
          .map((l) => ({
            account_code: l.account_code,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
      }),
    });
    setBusy(false);
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error ?? "Could not post.");
      return;
    }
    onPosted();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">New Journal Entry</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close">✕</button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-neutral-600">Memo</label>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="mb-2 grid grid-cols-[1fr_7rem_7rem_1.5rem] gap-2 text-xs font-medium text-neutral-500">
          <span>Account</span>
          <span className="text-right">Debit</span>
          <span className="text-right">Credit</span>
          <span />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_7rem_7rem_1.5rem] items-center gap-2">
              <select
                value={l.account_code}
                onChange={(e) => setLine(i, { account_code: e.target.value })}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-sm"
              >
                <option value="">Select account…</option>
                {accounts.map((a) => (
                  <option key={a.code} value={a.code}>{a.code} · {a.name}</option>
                ))}
              </select>
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={l.debit}
                onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-right text-sm"
              />
              <input
                type="number" min="0" step="0.01" inputMode="decimal"
                value={l.credit}
                onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })}
                className="rounded-lg border border-neutral-300 px-2 py-2 text-right text-sm"
              />
              <button
                onClick={() => setLines((prev) => (prev.length > 2 ? prev.filter((_, idx) => idx !== i) : prev))}
                className="text-neutral-400 hover:text-red-600"
                aria-label="Remove line"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setLines((prev) => [...prev, emptyLine()])}
          className="mt-2 text-sm font-medium text-emerald-700"
        >
          + Add line
        </button>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-sm">
          <span className="text-neutral-500">Totals</span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>Dr {rm(totalDebit)}</span>
            <span>Cr {rm(totalCredit)}</span>
            <span className={balanced ? "font-semibold text-emerald-600" : "font-semibold text-red-600"}>
              {balanced ? "Balanced" : `Off by ${rm(Math.abs(diff))}`}
            </span>
          </div>
        </div>

        {err && <p className="mt-3 text-sm font-medium text-red-600">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium">Cancel</button>
          <button
            onClick={post}
            disabled={busy || !balanced}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {busy ? "Posting…" : "Post Journal"}
          </button>
        </div>
      </div>
    </div>
  );
}
