"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  EXPENSE_CATEGORIES,
  ASSET_CATEGORIES,
  STOCK_CATEGORIES,
  PAYERS,
  EXPENSE_TYPES,
  REIMBURSABLE_PAYERS,
} from "@/lib/constants";
import { amortise, isSubscription } from "@/lib/posting";
import { humanise, today, rm } from "@/lib/format";
import type { Expense } from "@/lib/types";

// Category options depend on the expense type: running costs, stock classes or
// asset classes.
function categoryOptionsFor(type: string): readonly string[] {
  if (type === "fixed_asset") return ASSET_CATEGORIES;
  if (type === "stock") return STOCK_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

// What the category field is called for each type.
function categoryLabel(type: string): string {
  if (type === "fixed_asset") return "Asset class";
  if (type === "stock") return "Stock class";
  return "Category";
}

export function ExpenseForm({ initial }: { initial?: Expense }) {
  const router = useRouter();
  const editing = !!initial;

  const initType = initial?.expense_type ?? "expense";
  const initCatCustom = initial
    ? !categoryOptionsFor(initType).includes(initial.category)
    : false;

  const [form, setForm] = useState({
    vendor: initial?.vendor ?? "",
    description: initial?.description ?? "",
    amount: initial ? String(initial.amount) : "",
    expense_date: initial?.expense_date ?? today(),
    category: initial ? (initCatCustom ? "other" : initial.category) : "supplies",
    payer: initial?.payer ?? "company",
    expense_type: initType,
    subscription_months: initial?.subscription_months
      ? String(initial.subscription_months)
      : "12",
    discount: initial?.discount ? String(initial.discount) : "",
    comments: initial?.comments ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(
    initial?.receipt_url ?? null,
  );
  const [customCategory, setCustomCategory] = useState(
    initCatCustom && initial ? initial.category : "",
  );
  type LineDraft = {
    description: string;
    quantity: string;
    unit_price: string;
    amount: string;
  };
  const [lineItems, setLineItems] = useState<LineDraft[]>(
    (initial?.line_items ?? []).map((li) => ({
      description: li.description,
      quantity: String(li.quantity),
      unit_price: String(li.unit_price),
      amount: String(li.amount),
    })),
  );

  function updateLine(i: number, field: keyof LineDraft, value: string) {
    setLineItems((items) =>
      items.map((li, idx) => (idx === i ? { ...li, [field]: value } : li)),
    );
  }
  function addLine() {
    setLineItems((items) => [
      ...items,
      { description: "", quantity: "1", unit_price: "", amount: "" },
    ]);
  }
  function removeLine(i: number) {
    setLineItems((items) => items.filter((_, idx) => idx !== i));
  }
  const lineItemsTotal = lineItems.reduce(
    (a, li) => a + (Number(li.amount) || 0),
    0,
  );
  // What the purchase comes to after any discount — never below zero.
  const netTotal = Math.max(
    0,
    Math.round((lineItemsTotal - (Number(form.discount) || 0)) * 100) / 100,
  );

  // When "Other" is picked, the typed label becomes the category (stored as
  // free text). Common ones can be promoted into EXPENSE_CATEGORIES later.
  function effectiveCategory() {
    if (form.category === "other" && customCategory.trim()) {
      return customCategory.trim().toLowerCase();
    }
    return form.category;
  }

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

      // Store the original receipt (audit trail) — independent of OCR, so this
      // works even when scanning is disabled. Best-effort; failure is non-fatal.
      fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, media_type: file.type }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.path && setReceiptPath(j.path))
        .catch(() => {});

      const res = await fetch("/api/expenses/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, media_type: file.type }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // OCR is off/unavailable — show a calm note (not a red error) and let
        // the user fill in the form manually. The receipt upload, if it
        // succeeded, is shown separately via receiptUrl.
        if (j.needs_key) {
          setScanNote(j.error || "Auto-fill is off — enter the details manually.");
        } else {
          setError(j.error || "Could not scan the receipt.");
        }
        return;
      }
      const f = j.fields || {};
      const type = EXPENSE_TYPES.some((t) => t.value === f.expense_type)
        ? f.expense_type
        : form.expense_type;
      // Keep the category valid for the resulting type's option set; for a
      // fixed asset the OCR's expense category won't match, so fall back to "Other".
      const opts = categoryOptionsFor(type);
      const category = opts.includes(f.category) ? f.category : "other";
      setForm((prev) => ({
        ...prev,
        vendor: f.vendor || prev.vendor,
        description: f.description || prev.description,
        amount: f.amount ? String(f.amount) : prev.amount,
        expense_date: f.expense_date || prev.expense_date,
        category,
        expense_type: type,
      }));
      setCustomCategory("");
      if (Array.isArray(f.line_items) && f.line_items.length) {
        setLineItems(
          f.line_items.map(
            (li: {
              description?: string;
              quantity?: number;
              unit_price?: number;
              amount?: number;
            }) => ({
              description: li.description ?? "",
              quantity: li.quantity != null ? String(li.quantity) : "1",
              unit_price: li.unit_price != null ? String(li.unit_price) : "",
              amount: li.amount != null ? String(li.amount) : "",
            }),
          ),
        );
      }
      setScanNote(
        type === "fixed_asset"
          ? "Scanned as a fixed asset — pick the asset class below, then save."
          : type === "stock"
            ? "Scanned as stock — pick the stock class below, then save."
            : "Scanned — please review the details and line items below before saving.",
      );
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
    const res = await fetch(
      editing ? `/api/expenses/${initial!.id}` : "/api/expenses",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          category: effectiveCategory(),
          amount: amt,
          // Only meaningful for a subscription; null everywhere else so an old
          // term can't linger after the category changes.
          discount: Number(form.discount) || 0,
          subscription_months: isSubscription(effectiveCategory())
            ? Number(form.subscription_months) || null
            : null,
          receipt_url: receiptPath,
          line_items: lineItems
            .filter((li) => li.description.trim())
            .map((li) => ({
              description: li.description.trim(),
              quantity: Number(li.quantity) || 0,
              unit_price: Number(li.unit_price) || 0,
              amount: Number(li.amount) || 0,
            })),
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setError(j.error || "Save failed");
    }
    router.push("/expenses");
    router.refresh();
  }

  async function remove() {
    if (!editing) return;
    if (!confirm("Delete this purchase? This also removes any linked reimbursement.")) return;
    setDeleting(true);
    const res = await fetch(`/api/expenses/${initial!.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setError(j.error || "Delete failed");
    }
    router.push("/expenses");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">
        {editing ? "Edit Purchase" : "New Purchase"}
      </h1>
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
        {receiptPath && (
          <p className="mt-1 text-xs text-emerald-700">
            📎 Receipt attached ·{" "}
            <a
              href={`/api/receipts/view?path=${encodeURIComponent(receiptPath)}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              view
            </a>
          </p>
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
          <span className="mb-1 block text-neutral-600">
            {categoryLabel(form.expense_type)}
          </span>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          >
            {categoryOptionsFor(form.expense_type).map((c) => (
              <option key={c} value={c}>
                {humanise(c)}
              </option>
            ))}
          </select>
        </label>

        {form.category === "other" && (
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">
              {`Custom ${categoryLabel(form.expense_type).toLowerCase()} (optional)`}
            </span>
            <input
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              maxLength={50}
              placeholder={
                form.expense_type === "fixed_asset"
                  ? "e.g. signage, water tank, sound system"
                  : form.expense_type === "stock"
                    ? "e.g. cups, straws, gift boxes"
                    : "e.g. insurance, licenses, cleaning"
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-neutral-400">
              Leave blank to just record it as &ldquo;Other&rdquo;.
            </span>
          </label>
        )}

        {/* A prepaid subscription buys coverage over a period, so the term is
            what lets the cost be spread across the months it covers. */}
        {isSubscription(effectiveCategory()) && (
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">
              Subscription term (months)
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={form.subscription_months}
              onChange={(e) => set("subscription_months", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
            {(() => {
              const a = amortise(
                Number(form.amount) || 0,
                Number(form.subscription_months),
                form.expense_date,
              );
              return a ? (
                <span className="mt-1 block text-xs text-neutral-500">
                  {rm(a.perMonth)}/month · covers {a.startDate} to {a.endDate}
                </span>
              ) : (
                <span className="mt-1 block text-xs text-neutral-400">
                  Enter a term to see the monthly charge.
                </span>
              );
            })()}
          </label>
        )}

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
              onChange={(e) => {
                const type = e.target.value;
                // Switch the category set and reset to its first option so the
                // stored category always matches the type (expense vs asset).
                setForm((f) => ({
                  ...f,
                  expense_type: type,
                  category: categoryOptionsFor(type)[0],
                }));
                setCustomCategory("");
              }}
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

        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm text-neutral-600">Line items (optional)</span>
            <button
              type="button"
              onClick={addLine}
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              + Add line
            </button>
          </div>
          {lineItems.length === 0 ? (
            <p className="text-xs text-neutral-400">
              Scan a receipt to itemise automatically, or add lines manually.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="flex-1">Item</span>
                <span className="w-14 text-center">Qty</span>
                <span className="w-20 text-center">Unit</span>
                <span className="w-24 text-center">Amount</span>
                <span className="w-4" />
              </div>
              {lineItems.map((li, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={li.description}
                    onChange={(e) => updateLine(i, "description", e.target.value)}
                    placeholder="Item"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={li.quantity}
                    onChange={(e) => updateLine(i, "quantity", e.target.value)}
                    className="w-14 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={li.unit_price}
                    onChange={(e) => updateLine(i, "unit_price", e.target.value)}
                    className="w-20 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={li.amount}
                    onChange={(e) => updateLine(i, "amount", e.target.value)}
                    className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="w-4 text-neutral-400 hover:text-red-600"
                    title="Remove line"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {/* Subtotal → discount → total, so the paperwork shows how the
                  amount paid was arrived at. `amount` stays the cash figure;
                  the discount is recorded, never deducted a second time. */}
              <div className="ml-auto w-64 space-y-1 text-sm">
                <div className="flex justify-between text-neutral-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{rm(lineItemsTotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="discount" className="text-neutral-500">
                    Discount
                  </label>
                  <div className="flex items-center gap-1">
                    <span className="text-neutral-400">−RM</span>
                    <input
                      id="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.discount}
                      onChange={(e) => set("discount", e.target.value)}
                      placeholder="0.00"
                      className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-right text-sm tabular-nums"
                    />
                  </div>
                </div>
                <div className="flex justify-between border-t border-neutral-300 pt-1 font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{rm(netTotal)}</span>
                </div>
                {form.amount &&
                  Math.abs(netTotal - (Number(form.amount) || 0)) > 0.01 && (
                    <button
                      type="button"
                      onClick={() => set("amount", netTotal.toFixed(2))}
                      className="w-full rounded-md bg-amber-50 px-2 py-1 text-left text-xs text-amber-800 hover:bg-amber-100"
                    >
                      Amount above says {rm(Number(form.amount))} — tap to use{" "}
                      {rm(netTotal)}
                    </button>
                  )}
              </div>
            </div>
          )}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-600">
            Comments (optional)
          </span>
          <textarea
            value={form.comments}
            onChange={(e) => set("comments", e.target.value)}
            rows={2}
            placeholder="Who / when / why — e.g. Staff lunch for MG, KY & 2 part-timers, month-end"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2"
          />
        </label>

        {willReimburse && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            We&apos;ll log this as owed to{" "}
            <strong>
              {PAYERS.find((p) => p.value === form.payer)?.label ?? form.payer}
            </strong>{" "}
            and create a reimbursement to settle later.
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={busy || deleting}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Save purchase"}
          </button>
          <a
            href="/expenses"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
          >
            Cancel
          </a>
          {editing && (
            <button
              type="button"
              onClick={remove}
              disabled={busy || deleting}
              className="ml-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
