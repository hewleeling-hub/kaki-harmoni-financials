"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EXPENSE_CATEGORIES,
  PAYERS,
  EXPENSE_TYPES,
  REIMBURSABLE_PAYERS,
} from "@/lib/constants";
import { today } from "@/lib/format";

export function ExpenseForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    vendor: "",
    description: "",
    amount: "",
    expense_date: today(),
    category: "supplies",
    payer: "company",
    expense_type: "expense",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const willReimburse = REIMBURSABLE_PAYERS.includes(form.payer);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.vendor.trim()) return setError("Vendor is required");
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return setError("Amount must be greater than zero");

    setBusy(true);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: amt }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setError(j.error || "Save failed");
    }
    router.push("/expenses");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">New Expense</h1>
      <form
        onSubmit={submit}
        className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Vendor</span>
          <input
            value={form.vendor}
            onChange={(e) => set("vendor", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="e.g. Eco Clean Supply"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">
            Description (optional)
          </span>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            placeholder="e.g. Towels and disinfectant"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">Amount (RM)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">Date</span>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => set("expense_date", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">Category</span>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 capitalize"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">Payer</span>
            <select
              value={form.payer}
              onChange={(e) => set("payer", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              {PAYERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">Type</span>
            <select
              value={form.expense_type}
              onChange={(e) => set("expense_type", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            >
              {EXPENSE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {willReimburse && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            We&apos;ll log this as owed to{" "}
            <strong>
              {form.payer === "personal" ? "Owner (personal)" : "Staff (card)"}
            </strong>{" "}
            and create a reimbursement to settle later.
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save expense"}
          </button>
          <a
            href="/expenses"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  );
}
