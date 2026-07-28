"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/types";
import { PAYMENT_METHODS } from "@/lib/constants";
import { rm } from "@/lib/format";

// Over-the-counter sale: pick products + quantities, choose payment, record a
// sale with no chair session.
export function QuickSaleSheet({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: () => void;
}) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [payment, setPayment] = useState("");
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setProducts(
          (j.products ?? []).filter((p: Product) => p.is_active),
        ),
      );
  }, []);

  const total = useMemo(() => {
    if (!products) return 0;
    return products.reduce(
      (a, p) => a + (qty[p.id] || 0) * Number(p.standalone_price),
      0,
    );
  }, [products, qty]);

  const itemCount = Object.values(qty).reduce((a, n) => a + n, 0);

  function bump(id: string, delta: number) {
    setQty((q) => {
      const next = Math.max(0, (q[id] || 0) + delta);
      const copy = { ...q };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });
  }

  async function submit() {
    setError(null);
    if (!payment) return setShowError(true);
    if (itemCount === 0) return setError("Add at least one product.");
    setSubmitting(true);
    const items = Object.entries(qty).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));
    const res = await fetch("/api/sales/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_method: payment, items }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      return setError(j.error || "Sale failed");
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between p-6 pb-3">
          <h2 className="text-xl font-bold">Quick Sale</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          {!products ? (
            <p className="py-6 text-sm text-neutral-500">Loading products…</p>
          ) : products.length === 0 ? (
            <p className="py-6 text-sm text-neutral-500">
              No active products. Add some under Products.
            </p>
          ) : (
            <div className="space-y-2 pb-2">
              {products.map((p) => {
                const n = qty[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between rounded-xl border-2 px-3 py-2 ${
                      n > 0 ? "border-emerald-400 bg-emerald-50" : "border-neutral-200"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{p.name}</div>
                      <div className="text-xs capitalize text-neutral-500">
                        {p.category} · {rm(p.standalone_price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => bump(p.id, -1)}
                        disabled={n === 0}
                        className="h-9 w-9 rounded-lg border border-neutral-300 text-lg disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="w-6 text-center tabular-nums">{n}</span>
                      <button
                        onClick={() => bump(p.id, 1)}
                        className="h-9 w-9 rounded-lg border border-neutral-300 text-lg"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 p-6 pt-4">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Payment method
          </p>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  setPayment(m.value);
                  setShowError(false);
                }}
                className={`min-h-[44px] rounded-xl border-2 px-2 py-2 text-sm font-medium ${
                  payment === m.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {showError && (
            <p className="mb-2 text-sm font-medium text-red-600">
              Select a payment method.
            </p>
          )}
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <button
            onClick={submit}
            disabled={submitting || itemCount === 0}
            className="min-h-[52px] w-full rounded-2xl bg-emerald-600 px-4 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting
              ? "Recording…"
              : `Record Sale · ${itemCount} item${itemCount === 1 ? "" : "s"} · ${rm(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
