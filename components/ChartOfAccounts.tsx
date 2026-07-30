"use client";

import { useMemo, useState } from "react";
import type { Account, AccountType } from "@/lib/types";
import {
  ACCOUNT_TYPES,
  STATEMENT_GROUPS,
  typeLabel,
  statementGroupLabel,
  defaultNormalBalance,
  isValidCode,
  ancestorCodes,
  withDepth,
} from "@/lib/accounts";
import { rm } from "@/lib/format";

const TEAL = "#1F5A5E";

export function ChartOfAccounts({
  initial,
  balances,
}: {
  initial: Account[];
  balances?: Record<string, number> | null;
}) {
  const [accounts, setAccounts] = useState<Account[]>(initial);
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [groupF, setGroupF] = useState("all");
  const [activeF, setActiveF] = useState("all");
  const [postableF, setPostableF] = useState("all");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{ mode: "add" | "edit"; account?: Account } | null>(null);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const byCode = useMemo(
    () => new Map(accounts.map((a) => [a.code, a])),
    [accounts],
  );
  const rows = useMemo(() => withDepth(accounts), [accounts]);

  async function reload() {
    const res = await fetch("/api/accounts", { cache: "no-store" });
    const j = await res.json();
    if (j.accounts) setAccounts(j.accounts);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const anyFilter =
    q.trim() !== "" ||
    typeF !== "all" ||
    groupF !== "all" ||
    activeF !== "all" ||
    postableF !== "all";

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const matches = (a: Account) => {
      if (needle) {
        const hay = `${a.code} ${a.name} ${a.description ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (typeF !== "all" && a.account_type !== typeF) return false;
      if (groupF !== "all" && a.statement_group !== groupF) return false;
      if (activeF === "active" && !a.is_active) return false;
      if (activeF === "inactive" && a.is_active) return false;
      if (postableF === "postable" && !a.is_postable) return false;
      if (postableF === "header" && a.is_postable) return false;
      return true;
    };
    if (anyFilter) return rows.filter(matches);
    // Tree mode: hide rows whose ancestor header is collapsed.
    return rows.filter((a) =>
      ancestorCodes(a.code, byCode).every((c) => !collapsed.has(c)),
    );
  }, [rows, q, typeF, groupF, activeF, postableF, anyFilter, collapsed, byCode]);

  function toggleCollapse(code: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function toggleActive(a: Account) {
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !a.is_active }),
    });
    await reload();
  }

  const headerCount = accounts.filter((a) => !a.is_postable).length;
  const postableCount = accounts.length - headerCount;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-neutral-500">
            {accounts.length} accounts · {headerCount} headers ·{" "}
            {postableCount} postable — AQUAHARMONI SDN. BHD.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/accounts/export"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ⬇ Export CSV
          </a>
          <button
            onClick={() => setImporting(true)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          >
            ⬆ Import CSV
          </button>
          <button
            onClick={() => setDrawer({ mode: "add" })}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: TEAL }}
          >
            + Add Account
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {toast}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search code, name or description…"
          className="min-w-[220px] flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="all">All types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select value={groupF} onChange={(e) => setGroupF(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="all">All statements</option>
          {STATEMENT_GROUPS.map((g) => (
            <option key={g.value} value={g.value}>{g.label}</option>
          ))}
        </select>
        <select value={activeF} onChange={(e) => setActiveF(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="all">Active + inactive</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <select value={postableF} onChange={(e) => setPostableF(e.target.value)} className="rounded-lg border border-neutral-300 px-3 py-2 text-sm">
          <option value="all">Headers + postable</option>
          <option value="postable">Postable only</option>
          <option value="header">Headers only</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-3 py-2 font-medium">Code</th>
              <th className="px-3 py-2 font-medium">Account Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Normal</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {visible.map((a) => {
              const isHeader = !a.is_postable;
              const canCollapse = isHeader && !anyFilter;
              return (
                <tr key={a.id} className={a.is_active ? "" : "bg-neutral-50/60 text-neutral-400"}>
                  <td className="px-3 py-2 font-mono text-xs text-neutral-500">{a.code}</td>
                  <td className="px-3 py-2">
                    <div style={{ paddingLeft: a.depth * 18 }} className="flex items-center gap-1.5">
                      {canCollapse ? (
                        <button
                          onClick={() => toggleCollapse(a.code)}
                          className="w-4 shrink-0 text-neutral-400"
                          aria-label={collapsed.has(a.code) ? "Expand" : "Collapse"}
                        >
                          {collapsed.has(a.code) ? "▸" : "▾"}
                        </button>
                      ) : (
                        <span className="w-4 shrink-0" />
                      )}
                      <a
                        href={`/accounts/${a.code}`}
                        className={isHeader ? "font-semibold text-neutral-900 hover:underline" : "hover:underline"}
                      >
                        {a.name}
                      </a>
                      {a.system_locked && (
                        <span title="System-controlled" className="text-xs text-neutral-400">🔒</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-neutral-600">{typeLabel(a.account_type)}</td>
                  <td className="px-3 py-2 text-neutral-500">
                    {a.normal_balance ? (a.normal_balance === "debit" ? "Dr" : "Cr") : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {balances
                      ? (() => {
                          const v = balances[a.code] ?? 0;
                          if (Math.abs(v) < 0.005)
                            return <span className="text-neutral-300">—</span>;
                          return (
                            <span className={v < 0 ? "text-red-600" : "text-neutral-700"}>
                              {rm(v)}
                            </span>
                          );
                        })()
                      : <span className="text-neutral-300" title="Awaiting ledger">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {isHeader ? (
                      <span className="text-xs text-neutral-400">Header</span>
                    ) : a.is_active ? (
                      <span className="text-xs text-emerald-600">Active</span>
                    ) : (
                      <span className="text-xs text-neutral-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setDrawer({ mode: "edit", account: a })}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                      >
                        Edit
                      </button>
                      {a.is_postable && (
                        <button
                          onClick={() => toggleActive(a)}
                          className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
                        >
                          {a.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-neutral-400">
                  No accounts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-400">
        {balances
          ? "Balances roll up from posted journals (natural sign; red = contra-normal). Header accounts total their sub-accounts."
          : "Balances are pending the posting ledger — accounts are a reference chart for now. Header accounts can never receive postings; only active leaf accounts will."}
      </p>

      {drawer && (
        <AccountDrawer
          mode={drawer.mode}
          account={drawer.account}
          headers={accounts.filter((a) => a.account_type === "header")}
          onClose={() => setDrawer(null)}
          onSaved={(msg) => {
            setDrawer(null);
            flash(msg);
            reload();
          }}
        />
      )}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onImported={(n) => {
            setImporting(false);
            flash(`Imported ${n} accounts.`);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ── Add / Edit drawer ────────────────────────────────────────────────────────
function AccountDrawer({
  mode,
  account,
  headers,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  account?: Account;
  headers: Account[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const locked = account?.system_locked ?? false;
  const [code, setCode] = useState(account?.code ?? "");
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.account_type ?? "expense");
  const [parent, setParent] = useState(account?.parent_code ?? "");
  const [normal, setNormal] = useState<string>(account?.normal_balance ?? defaultNormalBalance(account?.account_type ?? "expense") ?? "");
  const [description, setDescription] = useState(account?.description ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onType(t: AccountType) {
    setType(t);
    setNormal(t === "header" ? "" : (defaultNormalBalance(t) ?? ""));
  }

  async function save() {
    setErr(null);
    if (mode === "add" && !isValidCode(code)) {
      setErr("Code must be exactly four digits.");
      return;
    }
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    setBusy(true);
    const payload =
      mode === "add"
        ? {
            code,
            name,
            account_type: type,
            parent_code: parent || null,
            normal_balance: type === "header" ? null : normal || null,
            description,
          }
        : {
            name,
            description,
            parent_code: parent || null,
            ...(locked ? {} : { account_type: type, normal_balance: type === "header" ? null : normal || null }),
          };
    const res = await fetch(
      mode === "add" ? "/api/accounts" : `/api/accounts/${account!.id}`,
      {
        method: mode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setBusy(false);
    const j = await res.json();
    if (!res.ok) {
      setErr(j.error ?? "Could not save.");
      return;
    }
    onSaved(mode === "add" ? `Added ${code} ${name}.` : `Saved ${account!.code} ${name}.`);
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">
            {mode === "add" ? "Add Account" : `Edit ${account!.code}`}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close">✕</button>
        </div>

        {locked && (
          <p className="mb-3 rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
            🔒 System-controlled account — type and normal balance are locked.
          </p>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Code</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={mode === "edit"}
          placeholder="e.g. 6795"
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />

        <label className="mb-1 block text-sm font-medium text-neutral-700">Type</label>
        <select
          value={type}
          onChange={(e) => onType(e.target.value as AccountType)}
          disabled={locked}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <label className="mb-1 block text-sm font-medium text-neutral-700">Parent (header)</label>
        <select
          value={parent}
          onChange={(e) => setParent(e.target.value)}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="">— none (top level) —</option>
          {headers
            .filter((h) => h.code !== account?.code)
            .map((h) => (
              <option key={h.code} value={h.code}>{h.code} · {h.name}</option>
            ))}
        </select>

        {type !== "header" && (
          <>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Normal balance</label>
            <select
              value={normal}
              onChange={(e) => setNormal(e.target.value)}
              disabled={locked}
              className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm disabled:bg-neutral-100"
            >
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </>
        )}

        <label className="mb-1 block text-sm font-medium text-neutral-700">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />

        {err && <p className="mb-3 text-sm font-medium text-red-600">{err}</p>}

        <div className="mt-auto flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: TEAL }}
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV import modal ─────────────────────────────────────────────────────────
type Preview = {
  total: number;
  errors: number;
  toInsert: number;
  toUpdate: number;
  rows: { line: number; code: string; name: string; errors: string[] }[];
};

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (n: number) => void;
}) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(commit: boolean) {
    setErr(null);
    setBusy(true);
    const res = await fetch("/api/accounts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, commit }),
    });
    setBusy(false);
    const j = await res.json();
    if (commit) {
      if (!res.ok) {
        setErr(j.error ?? "Import failed.");
        if (j.preview) setPreview(j.preview);
        return;
      }
      onImported(j.imported);
      return;
    }
    if (!res.ok) {
      setErr(j.error ?? "Could not read CSV.");
      setPreview(null);
      return;
    }
    setPreview(j.preview);
  }

  const badRows = preview?.rows.filter((r) => r.errors.length) ?? [];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Import Chart of Accounts (CSV)</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100" aria-label="Close">✕</button>
        </div>
        <p className="mb-2 text-xs text-neutral-500">
          Same columns as the export (code, name, account_type, normal_balance,
          parent_code, description, …). Existing codes are updated; new codes are
          added. Nothing is written if any row has an error.
        </p>

        <label className="mb-3 inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-neutral-300 px-3 py-1.5 text-sm">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                setCsv(await f.text());
                setPreview(null);
              }
            }}
          />
        </label>

        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setPreview(null);
          }}
          rows={6}
          placeholder="…or paste CSV here"
          className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs"
        />

        {err && <p className="mb-3 text-sm font-medium text-red-600">{err}</p>}

        {preview && (
          <div className="mb-3 overflow-y-auto rounded-lg border border-neutral-200 p-3 text-sm">
            <p className="font-medium">
              {preview.total} rows · {preview.toInsert} new · {preview.toUpdate} updates ·{" "}
              <span className={preview.errors ? "text-red-600" : "text-emerald-600"}>
                {preview.errors} errors
              </span>
            </p>
            {badRows.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-red-600">
                {badRows.slice(0, 25).map((r) => (
                  <li key={r.line}>
                    Line {r.line} ({r.code || "?"}): {r.errors.join(" ")}
                  </li>
                ))}
                {badRows.length > 25 && <li>…and {badRows.length - 25} more.</li>}
              </ul>
            )}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <button
            onClick={() => run(false)}
            disabled={busy || !csv.trim()}
            className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Checking…" : "Preview"}
          </button>
          <button
            onClick={() => run(true)}
            disabled={busy || !preview || preview.errors > 0}
            className="flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: TEAL }}
          >
            {preview ? `Import ${preview.toInsert + preview.toUpdate}` : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
