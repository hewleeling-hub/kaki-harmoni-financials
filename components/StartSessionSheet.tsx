"use client";

import { useMemo, useState } from "react";
import type { ChairWithSession, Product } from "@/lib/types";
import { BUNDLE_PRICE, PAYMENT_METHODS } from "@/lib/constants";
import { rm } from "@/lib/format";

export function StartSessionSheet({
  chair,
  extras,
  onClose,
  onSubmit,
}: {
  chair: ChairWithSession;
  extras: Product[];
  onClose: () => void;
  onSubmit: (payload: {
    chair_id: string;
    payment_method: string;
    extras: string[];
  }) => void | Promise<void>;
}) {
  const [payment, setPayment] = useState<string>("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [showError, setShowError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => {
    let t = BUNDLE_PRICE;
    for (const p of extras) if (chosen.has(p.id)) t += Number(p.standalone_price);
    return t;
  }, [chosen, extras]);

  function toggleExtra(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!payment) {
      setShowError(true);
      return;
    }
    setSubmitting(true);
    await onSubmit({
      chair_id: chair.id,
      payment_method: payment,
      extras: [...chosen],
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Start Session — {chair.label}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Payment method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => {
                  setPayment(m.value);
                  setShowError(false);
                }}
                className={`min-h-[48px] rounded-xl border-2 px-2 py-3 text-sm font-medium transition ${
                  payment === m.value
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          {showError && (
            <p className="mt-2 text-sm font-medium text-red-600">
              Select a payment method to continue.
            </p>
          )}
        </div>

        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-neutral-700">
            Extras (optional)
          </p>
          {extras.length === 0 ? (
            <p className="text-sm text-neutral-400">No extras available.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {extras.map((p) => {
                const on = chosen.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleExtra(p.id)}
                    className={`flex min-h-[48px] items-center justify-between rounded-xl border-2 px-4 py-3 text-left transition ${
                      on
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-neutral-200 bg-white hover:border-neutral-300"
                    }`}
                  >
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-neutral-600">
                      {rm(p.standalone_price)} {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between rounded-xl bg-neutral-100 px-4 py-3">
          <span className="text-sm text-neutral-600">
            RM40 bundle (RM28 spa + RM12 coffee) + extras
          </span>
          <span className="text-xl font-bold">{rm(total)}</span>
        </div>

        <button
          onClick={submit}
          disabled={submitting}
          className="min-h-[52px] w-full rounded-2xl bg-emerald-600 px-4 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Starting…" : `Start Session · ${rm(total)}`}
        </button>
      </div>
    </div>
  );
}
