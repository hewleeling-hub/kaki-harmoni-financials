"use client";

import { useEffect, useState } from "react";
import type { Reimbursement } from "@/lib/types";
import { rm } from "@/lib/format";

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function ReimbursementsList() {
  const [rows, setRows] = useState<Reimbursement[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/reimbursements", { cache: "no-store" });
    const j = await res.json();
    setRows(j.reimbursements ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function setSettled(r: Reimbursement, settled: boolean) {
    if (settled && !confirm(`Mark ${rm(r.amount)} owed to ${r.owed_to} as settled? This records that money has moved.`))
      return;
    setBusyId(r.id);
    await fetch(`/api/reimbursements/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_settled: settled }),
    });
    setBusyId(null);
    load();
  }

  const outstanding = (rows ?? []).filter((r) => !r.is_settled);
  const outstandingTotal = outstanding.reduce(
    (a, r) => a + Number(r.amount),
    0,
  );

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Reimbursements</h1>
        <p className="text-sm text-neutral-500">
          {outstanding.length} outstanding · {rm(outstandingTotal)}
        </p>
      </div>

      {!rows ? (
        <p className="text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          No reimbursements. They&apos;re created automatically when an expense is
          paid personally or on a staff card.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Owed to</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => {
                const age = Date.now() - new Date(r.created_at).getTime();
                const stale = !r.is_settled && age > SEVEN_DAYS;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">
                      {r.owed_to}
                      {stale && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                          &gt; 7 days
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {rm(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_settled ? (
                        <span className="text-emerald-600">Settled</span>
                      ) : (
                        <span className="text-amber-600">Outstanding</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_settled ? (
                        <button
                          onClick={() => setSettled(r, false)}
                          disabled={busyId === r.id}
                          className="rounded-md border border-neutral-300 px-3 py-1 text-xs disabled:opacity-50"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => setSettled(r, true)}
                          disabled={busyId === r.id}
                          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {busyId === r.id ? "…" : "Mark Settled"}
                        </button>
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
  );
}
