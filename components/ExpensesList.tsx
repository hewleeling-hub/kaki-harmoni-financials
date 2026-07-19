"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Expense } from "@/lib/types";
import { PAYERS, EXPENSE_TYPES } from "@/lib/constants";
import { rm } from "@/lib/format";

export function ExpensesList() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [payerFilter, setPayerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetch("/api/expenses", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setExpenses(j.expenses ?? []));
  }, []);

  const filtered = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(
      (e) =>
        (payerFilter === "all" || e.payer === payerFilter) &&
        (typeFilter === "all" || e.expense_type === typeFilter),
    );
  }, [expenses, payerFilter, typeFilter]);

  const total = filtered.reduce((a, e) => a + Number(e.amount), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        <Link
          href="/expenses/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          + Add Expense
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={payerFilter}
          onChange={(e) => setPayerFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="all">All payers</option>
          {PAYERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          {EXPENSE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <span className="ml-auto self-center text-sm text-neutral-500">
          {filtered.length} rows · {rm(total)}
        </span>
      </div>

      {!expenses ? (
        <p className="text-neutral-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          No expenses recorded.{" "}
          <Link
            href="/expenses/new"
            className="font-medium text-emerald-700 underline"
          >
            Add one
          </Link>
          .
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Payer</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-neutral-600">
                    {e.expense_date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.vendor}</div>
                    {e.description && (
                      <div className="text-xs text-neutral-500">
                        {e.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {e.category.replace("_", " ")}
                    {e.ai_category && e.ai_category !== e.category && (
                      <span
                        className="ml-1 text-xs text-neutral-400"
                        title={`AI suggested: ${e.ai_category}`}
                      >
                        (AI: {e.ai_category})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {e.payer.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {e.expense_type.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {rm(e.amount)}
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
