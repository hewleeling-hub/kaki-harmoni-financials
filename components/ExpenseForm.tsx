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
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const willReimburse = REIMBURSABLE_PAYERS.includes(form.payer);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        // strip the "data:<type>;base64," prefix
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Scan a receipt photo/PDF → pre-fill the form. The user still reviews + saves.
  async function onReceiptPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setError(null);
    setScanNote(null);
    setScanning(true);
    try {
      const data = await fileToBase64(file);
      const res = await fetch("/api/expenses/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, media_type: file.type }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "Could not scan the receipt.");
        return;
      }
      const f = j.fields || {};
      setForm((prev) => ({
        ...prev,
        vendor: f.vendor || prev.vendor,
        description: f.description || prev.description,
        amount: f.amount ? String(f.amount) : prev.amount,
        expense_date: f.expense_date || prev.expense_date,
        category: EXPENSE_CATEGORIES.includes(f.category) ? f.category : prev.category,
        expense_type:
          f.expense_type === "fixed_asset" || f.expense_type === "expense"
            ? f.expense_type
            : prev.expense_type,
      }));
      setScanNote("Scanned — please review the details below before saving.");
    } catch {
      setError("Could not read that file. Enter the details manually.");
    } finally {
      setScanning(false);
    }
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
      <div className="mb-4 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-900">
              📷 Scan a receipt
            </p>
            <p className="text-xs text-emerald-700">
              Snap a photo or upload a PDF and we&apos;ll fill in the details for you.
            </p>
          </div>
          <label
            className={`shrink-0 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white ${
              scanning ? "bg-emerald-400" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {scanning ? "Scanning…" : "Scan receipt"}
            <input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              className="hidden"
              disabled={scanning}
              onChange={onReceiptPicked}
            />
          </label>
        </div>
        {scanNote && (
          <p className="mt-2 text-xs font-medium text-emerald-800">{scanNote}</p>
        )}
      </div>

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
