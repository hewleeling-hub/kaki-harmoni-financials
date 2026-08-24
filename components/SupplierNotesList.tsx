"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Expense, SupplierNote, SupplierNoteType } from "@/lib/types";
import { NOTE_TYPES, NOTE_REASONS } from "@/lib/constants";
import { rm, today } from "@/lib/format";

type NoteRow = SupplierNote & { po_number?: string | null };

const label = (v: string) => v.replace(/_/g, " ");

const TYPE_STYLE: Record<SupplierNoteType, { cls: string; label: string }> = {
  debit: { cls: "bg-sky-100 text-sky-800", label: "Debit" },
  credit: { cls: "bg-purple-100 text-purple-800", label: "Credit" },
};

type Draft = {
  note_type: SupplierNoteType;
  note_date: string;
  expense_id: string;
  vendor: string;
  amount: string;
  reason: string;
  description: string;
};

const EMPTY: Draft = {
  note_type: "debit",
  note_date: today(),
  expense_id: "",
  vendor: "",
  amount: "",
  reason: "goods_returned",
  description: "",
};

export function SupplierNotesList() {
  const [notes, setNotes] = useState<NoteRow[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    const [nRes, eRes] = await Promise.all([
      fetch("/api/supplier-notes", { cache: "no-store" }),
      fetch("/api/expenses", { cache: "no-store" }),
    ]);
    const nJson = await nRes.json();
    if (!nRes.ok) {
      setError(nJson.error || "Failed to load notes");
      setNotes([]);
      return;
    }
    setNotes(nJson.notes ?? []);
    if (eRes.ok) {
      const eJson = await eRes.json();
      setExpenses(eJson.expenses ?? []);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/supplier-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...draft, amount: Number(draft.amount) }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not save the note");
      return;
    }
    setDraft({ ...EMPTY, note_date: today() });
    load();
  }

  async function setStatus(n: NoteRow, status: "open" | "applied") {
    setBusyId(n.id);
    setError(null);
    const res = await fetch(`/api/supplier-notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "Could not update the note");
      return;
    }
    load();
  }

  async function remove(n: NoteRow) {
    if (
      !confirm(
        `Delete ${n.note_number}? An issued note is normally kept and marked applied instead — its number will not be reused.`,
      )
    )
      return;
    setBusyId(n.id);
    await fetch(`/api/supplier-notes/${n.id}`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  const filtered = useMemo(
    () =>
      (notes ?? []).filter(
        (n) =>
          (typeFilter === "all" || n.note_type === typeFilter) &&
          (statusFilter === "all" || n.status === statusFilter),
      ),
    [notes, typeFilter, statusFilter],
  );

  // Debit notes are money owed to us, credit notes money already granted —
  // worth seeing separately rather than as one meaningless total.
  const openDebit = (notes ?? [])
    .filter((n) => n.note_type === "debit" && n.status === "open")
    .reduce((a, n) => a + Number(n.amount), 0);
  const openCredit = (notes ?? [])
    .filter((n) => n.note_type === "credit" && n.status === "open")
    .reduce((a, n) => a + Number(n.amount), 0);

  const linked = expenses.find((e) => e.id === draft.expense_id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Debit &amp; Credit Notes</h1>
        <p className="text-sm text-neutral-500">
          {rm(openDebit)} claimed · {rm(openCredit)} credit pending
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Raise a note */}
      <form
        onSubmit={save}
        className="mb-6 rounded-xl border border-neutral-200 bg-white p-5"
      >
        <h2 className="mb-3 font-semibold">Raise a note</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Type</span>
            <select
              value={draft.note_type}
              onChange={(e) => set("note_type", e.target.value as SupplierNoteType)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Date</span>
            <input
              type="date"
              value={draft.note_date}
              onChange={(e) => set("note_date", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Amount (RM)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={draft.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm lg:col-span-2">
            <span className="mb-1 block text-neutral-600">
              Against purchase (optional)
            </span>
            <select
              value={draft.expense_id}
              onChange={(e) => set("expense_id", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="">— none, enter the vendor below —</option>
              {expenses.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.po_number ?? "—"} · {e.expense_date} · {e.vendor} ·{" "}
                  {rm(e.amount)}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-neutral-600">Reason</span>
            <select
              value={draft.reason}
              onChange={(e) => set("reason", e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm capitalize"
            >
              {NOTE_REASONS.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {label(r)}
                </option>
              ))}
            </select>
          </label>

          {/* Only asked for when no purchase is linked — otherwise the vendor
              comes from the purchase and can't disagree with it. */}
          {!draft.expense_id && (
            <label className="text-sm">
              <span className="mb-1 block text-neutral-600">Vendor</span>
              <input
                type="text"
                required
                value={draft.vendor}
                onChange={(e) => set("vendor", e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          )}

          <label className="text-sm lg:col-span-2">
            <span className="mb-1 block text-neutral-600">Details (optional)</span>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="e.g. 2 trailing sockets returned, faulty switch"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Raise note"}
          </button>
          <p className="text-xs text-neutral-500">
            The {draft.note_type === "debit" ? "DN" : "CN"} number is assigned
            automatically
            {linked ? ` · vendor taken from ${linked.vendor}` : ""}.
          </p>
        </div>
      </form>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="all">All types</option>
          {NOTE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="applied">Applied</option>
        </select>
        <span className="ml-auto self-center text-sm text-neutral-500">
          {filtered.length} notes
        </span>
      </div>

      {/* Register */}
      {!notes ? (
        <p className="text-neutral-500">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          {notes.length === 0
            ? "No notes raised yet. Raise one above when a supplier owes you money or grants a reduction."
            : "No notes match these filters."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Note No.</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Against PO</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filtered.map((n) => (
                <tr key={n.id}>
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/notes/${n.id}/document`}
                      className="text-emerald-700 underline underline-offset-2"
                      title="Open the printable note"
                    >
                      {n.note_number ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{n.note_date}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_STYLE[n.note_type].cls}`}
                    >
                      {TYPE_STYLE[n.note_type].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{n.vendor}</div>
                    {n.description && (
                      <div className="text-xs text-neutral-500">
                        {n.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-500">
                    {n.po_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600">
                    {n.reason ? label(n.reason) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {rm(n.amount)}
                  </td>
                  <td className="px-4 py-3">
                    {n.status === "applied" ? (
                      <span className="text-emerald-600">Applied</span>
                    ) : (
                      <span className="text-amber-600">Open</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() =>
                          setStatus(n, n.status === "applied" ? "open" : "applied")
                        }
                        disabled={busyId === n.id}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
                      >
                        {n.status === "applied" ? "Reopen" : "Mark applied"}
                      </button>
                      <button
                        onClick={() => remove(n)}
                        disabled={busyId === n.id}
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
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
