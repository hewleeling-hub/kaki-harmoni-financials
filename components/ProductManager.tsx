"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
import { PRODUCT_CATEGORIES } from "@/lib/constants";
import { rm } from "@/lib/format";

type Draft = {
  name: string;
  category: string;
  cost_price: string;
  standalone_price: string;
  bundle_allocation: string;
};

const EMPTY: Draft = {
  name: "",
  category: "food",
  cost_price: "",
  standalone_price: "",
  bundle_allocation: "0",
};

export function ProductManager() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/products", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to load");
      return;
    }
    setProducts(json.products);
  }
  useEffect(() => {
    load();
  }, []);

  function startEdit(p: Product) {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      category: p.category,
      cost_price: String(p.cost_price),
      standalone_price: String(p.standalone_price),
      bundle_allocation: String(p.bundle_allocation),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!draft.name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      name: draft.name,
      category: draft.category,
      cost_price: Number(draft.cost_price) || 0,
      standalone_price: Number(draft.standalone_price) || 0,
      bundle_allocation: Number(draft.bundle_allocation) || 0,
    };
    const res = await fetch(
      editingId ? `/api/products/${editingId}` : "/api/products",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Save failed");
      return;
    }
    setDraft(EMPTY);
    setEditingId(null);
    load();
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/products/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    });
    load();
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Products</h1>

      <div className="mb-6 rounded-2xl border border-neutral-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">
          {editingId ? "Edit product" : "Add product"}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
              placeholder="e.g. Iced Lemon Tea"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Category</span>
            <select
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 capitalize"
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c} className="capitalize">
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Cost price (RM)</span>
            <input
              type="number"
              step="0.01"
              value={draft.cost_price}
              onChange={(e) =>
                setDraft({ ...draft, cost_price: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">
              Standalone price (RM)
            </span>
            <input
              type="number"
              step="0.01"
              value={draft.standalone_price}
              onChange={(e) =>
                setDraft({ ...draft, standalone_price: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">
              Bundle allocation (RM) — 0 makes it an extra
            </span>
            <input
              type="number"
              step="0.01"
              value={draft.bundle_allocation}
              onChange={(e) =>
                setDraft({ ...draft, bundle_allocation: e.target.value })
              }
              className="w-full rounded-lg border border-neutral-300 px-3 py-2"
            />
          </label>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={save}
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : editingId ? "Update product" : "Add product"}
          </button>
          {editingId && (
            <button
              onClick={() => {
                setEditingId(null);
                setDraft(EMPTY);
                setError(null);
              }}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {!products ? (
        <p className="text-neutral-500">Loading…</p>
      ) : products.length === 0 ? (
        <p className="text-neutral-500">No products yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Standalone</th>
                <th className="px-4 py-3 text-right font-medium">Bundle</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {products.map((p) => (
                <tr key={p.id} className={p.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {p.category}
                  </td>
                  <td className="px-4 py-3 text-right">{rm(p.cost_price)}</td>
                  <td className="px-4 py-3 text-right">
                    {rm(p.standalone_price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {Number(p.bundle_allocation) === 0
                      ? "—"
                      : rm(p.bundle_allocation)}
                  </td>
                  <td className="px-4 py-3">
                    {p.is_active ? (
                      <span className="text-emerald-600">Active</span>
                    ) : (
                      <span className="text-neutral-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(p)}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                      >
                        {p.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
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
