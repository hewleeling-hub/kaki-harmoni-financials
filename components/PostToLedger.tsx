"use client";

import { useEffect, useMemo, useState } from "react";
import type { Account, Expense } from "@/lib/types";
import { rm } from "@/lib/format";

type Suggestion = {
  debitAccount: string | null;
  creditAccount: string | null;
  notes: string[];
};

type Loaded = {
  expense: Expense;
  posted: { id: string; entry_date: string; reference: string | null } | null;
  suggestion: Suggestion;
  reference: string;
  memo: string;
};

// The accounts you can actually post to — leaves only, never headers.
function postable(accounts: Account[]) {
  return accounts.filter((a) => a.is_postable && a.is_active);
}

export function PostToLedger({
  expenseId,
  onClose,
  onPosted,
}: {
  expenseId: string;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/expenses/${expenseId}/post`, { cache: "no-store" }),
        fetch("/api/accounts", { cache: "no-store" }),
      ]);
      const pJson = await pRes.json();
      if (cancelled) return;
      if (!pRes.ok) {
        setError(pJson.error ?? "Could not load the purchase.");
        return;
      }
      setData(pJson);
      setDebit(pJson.suggestion.debitAccount ?? "");
      setCredit(pJson.suggestion.creditAccount ?? "");
      if (aRes.ok) {
        const aJson = await aRes.json();
        setAccounts(aJson.accounts ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  const options = useMemo(() => postable(accounts), [accounts]);
  const amount = data ? Number(data.expense.amount) : 0;
  const name = (code: string) =>
    options.find((a) => a.code === code)?.name ?? "";

  async function post() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/expenses/${expenseId}/post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debit_account: debit, credit_account: credit }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Could not post the entry.");
      return;
    }
    onPosted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Post to ledger</h2>
            {data && (
              <p className="mt-0.5 text-sm text-neutral-500">
                {data.expense.po_number} · {data.expense.vendor} ·{" "}
                {rm(data.expense.amount)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Close
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!data ? (
          <p className="text-neutral-500">Loading…</p>
        ) : data.posted ? (
          <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Already posted on {data.posted.entry_date}
            {data.posted.reference ? ` as ${data.posted.reference}` : ""}. To
            change it, reverse that entry in the Ledger — posted entries aren&apos;t
            edited in place.
          </div>
        ) : (
          <>
            {data.suggestion.notes.length > 0 && (
              <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Needs your decision</p>
                <ul className="mt-1 list-disc pl-5">
                  {data.suggestion.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">
                  Debit — what was bought
                </span>
                <select
                  value={debit}
                  onChange={(e) => setDebit(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">— choose an account —</option>
                  {options.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">
                  Credit — where the money came from
                </span>
                <select
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="">— choose an account —</option>
                  {options.map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* The entry exactly as it will be written. */}
            <div className="mt-5 overflow-hidden rounded-lg border border-neutral-200">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Account</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Debit</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  <tr>
                    <td className="px-3 py-2">
                      {debit ? `${debit} · ${name(debit)}` : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                  <tr>
                    <td className="px-3 py-2 pl-8">
                      {credit ? `${credit} · ${name(credit)}` : <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {amount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-neutral-500">
              Filed as <span className="font-mono">{data.reference || "—"}</span> ·{" "}
              {data.memo}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={post}
                disabled={busy || !debit || !credit}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Posting…" : `Post ${rm(amount)}`}
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
