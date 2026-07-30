import { createAdminClient } from "@/lib/supabase/admin";
import { typeLabel, statementGroupLabel, ancestorCodes } from "@/lib/accounts";
import { naturalIsDebit, naturalBalance } from "@/lib/ledger";
import { rm, today } from "@/lib/format";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

type LedgerLine = {
  account_code: string;
  debit: number;
  credit: number;
  memo: string | null;
  journals: { entry_date: string; memo: string | null } | null;
};

export default async function AccountDetail({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createAdminClient();

  const { data: allAccounts } = await supabase
    .from("accounts")
    .select("*")
    .order("sort_order");
  const accounts = (allAccounts ?? []) as Account[];
  const account = accounts.find((a) => a.code === code);

  if (!account) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-neutral-500">Account {code} not found.</p>
        <a href="/accounts" className="mt-2 inline-block text-sm text-emerald-700 underline">
          ← Back to Chart of Accounts
        </a>
      </div>
    );
  }

  const byCode = new Map(accounts.map((a) => [a.code, a]));
  const parent = account.parent_code ? byCode.get(account.parent_code) : null;
  const kids = accounts.filter((a) => a.parent_code === code);

  // Codes whose postings roll into this account (self for a leaf; all
  // descendants for a header).
  const codeSet = account.is_postable
    ? [code]
    : accounts
        .filter((a) => a.is_postable && ancestorCodes(a.code, byCode).includes(code))
        .map((a) => a.code);

  let ledgerAvailable = true;
  let lines: LedgerLine[] = [];
  if (codeSet.length) {
    const { data, error } = await supabase
      .from("journal_lines")
      .select("account_code, debit, credit, memo, journals(entry_date, memo)")
      .in("account_code", codeSet);
    if (error) ledgerAvailable = false;
    else lines = (data ?? []) as unknown as LedgerLine[];
  }

  lines.sort((a, b) =>
    (a.journals?.entry_date ?? "").localeCompare(b.journals?.entry_date ?? ""),
  );

  const debitNatural = naturalIsDebit(account);
  const net = lines.reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  const balance = naturalBalance(account, net);
  const year = today().slice(0, 4);
  const ytd = lines
    .filter((l) => (l.journals?.entry_date ?? "").startsWith(year))
    .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);
  const ytdNatural = debitNatural ? ytd : -ytd;

  let running = 0;

  return (
    <div className="space-y-6">
      <div>
        <a href="/accounts" className="text-sm text-emerald-700 underline">← Chart of Accounts</a>
        <div className="mt-2 flex items-center gap-3">
          <span className="font-mono text-sm text-neutral-500">{account.code}</span>
          <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
          {account.system_locked && <span title="System-controlled">🔒</span>}
          {!account.is_active && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">Inactive</span>
          )}
        </div>
        {parent && (
          <p className="mt-1 text-sm text-neutral-500">
            Under{" "}
            <a href={`/accounts/${parent.code}`} className="text-emerald-700 underline">
              {parent.code} · {parent.name}
            </a>
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Account information</h2>
          <dl className="space-y-2 text-sm">
            <Info label="Type" value={typeLabel(account.account_type)} />
            <Info label="Normal balance" value={account.normal_balance ? (account.normal_balance === "debit" ? "Debit" : "Credit") : "—"} />
            <Info label="Statement" value={statementGroupLabel(account.statement_group)} />
            <Info label="Postable" value={account.is_postable ? "Yes (leaf account)" : "No (header — rolls up)"} />
            <Info label="Status" value={account.is_active ? "Active" : "Inactive"} />
            <Info label="System-controlled" value={account.system_locked ? "Yes" : "No"} />
          </dl>
          {account.description && <p className="mt-3 text-sm text-neutral-600">{account.description}</p>}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Balance summary</h2>
          {ledgerAvailable ? (
            <div className="space-y-2 text-sm">
              <Info label="Current balance" value={rm(balance)} strong />
              <Info label="Year-to-date movement" value={rm(ytdNatural)} />
              <Info label="Transactions" value={String(lines.length)} />
              <Info label="Natural side" value={debitNatural ? "Debit" : "Credit"} />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <Info label="Current balance" value="Awaiting ledger" muted />
              <Info label="Transactions" value="Awaiting ledger" muted />
              <p className="text-xs text-neutral-400">
                Apply <code>0005_ledger.sql</code> to enable balances.
              </p>
            </div>
          )}
        </div>
      </div>

      {ledgerAvailable && lines.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Ledger ({lines.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Detail</th>
                  {!account.is_postable && <th className="py-2 font-medium">Account</th>}
                  <th className="py-2 text-right font-medium">Debit</th>
                  <th className="py-2 text-right font-medium">Credit</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lines.map((l, i) => {
                  const move = Number(l.debit) - Number(l.credit);
                  running += debitNatural ? move : -move;
                  return (
                    <tr key={i}>
                      <td className="py-2 whitespace-nowrap">{l.journals?.entry_date ?? ""}</td>
                      <td className="py-2 text-neutral-600">{l.memo || l.journals?.memo || ""}</td>
                      {!account.is_postable && (
                        <td className="py-2 font-mono text-xs text-neutral-400">{l.account_code}</td>
                      )}
                      <td className="py-2 text-right tabular-nums">{Number(l.debit) ? rm(l.debit) : ""}</td>
                      <td className="py-2 text-right tabular-nums text-neutral-500">{Number(l.credit) ? rm(l.credit) : ""}</td>
                      <td className="py-2 text-right font-medium tabular-nums">{rm(running)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {kids.length > 0 && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Sub-accounts ({kids.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-neutral-100">
                {kids.map((k) => (
                  <tr key={k.id}>
                    <td className="py-2 font-mono text-xs text-neutral-500">{k.code}</td>
                    <td className="py-2">
                      <a href={`/accounts/${k.code}`} className="hover:underline">{k.name}</a>
                    </td>
                    <td className="py-2 text-neutral-500">{typeLabel(k.account_type)}</td>
                    <td className="py-2 text-right text-neutral-400">{k.is_active ? "" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={muted ? "text-neutral-400" : strong ? "font-semibold text-neutral-900" : "font-medium text-neutral-800"}>
        {value}
      </dd>
    </div>
  );
}
