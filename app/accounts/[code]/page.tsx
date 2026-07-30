import { createAdminClient } from "@/lib/supabase/admin";
import { typeLabel, statementGroupLabel } from "@/lib/accounts";
import type { Account } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountDetail({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = createAdminClient();
  const { data: acc } = await supabase
    .from("accounts")
    .select("*")
    .eq("code", code)
    .single();

  if (!acc) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-6">
        <p className="text-neutral-500">Account {code} not found.</p>
        <a href="/accounts" className="mt-2 inline-block text-sm text-emerald-700 underline">
          ← Back to Chart of Accounts
        </a>
      </div>
    );
  }
  const account = acc as Account;

  const [{ data: children }, { data: parent }] = await Promise.all([
    supabase.from("accounts").select("*").eq("parent_code", code).order("sort_order"),
    account.parent_code
      ? supabase.from("accounts").select("code, name").eq("code", account.parent_code).single()
      : Promise.resolve({ data: null }),
  ]);
  const kids = (children ?? []) as Account[];

  return (
    <div className="space-y-6">
      <div>
        <a href="/accounts" className="text-sm text-emerald-700 underline">
          ← Chart of Accounts
        </a>
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
            <a href={`/accounts/${(parent as { code: string }).code}`} className="text-emerald-700 underline">
              {(parent as { code: string }).code} · {(parent as { name: string }).name}
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
            <Info label="Postable" value={account.is_postable ? "Yes (leaf account)" : "No (header)"} />
            <Info label="Status" value={account.is_active ? "Active" : "Inactive"} />
            <Info label="System-controlled" value={account.system_locked ? "Yes" : "No"} />
          </dl>
          {account.description && (
            <p className="mt-3 text-sm text-neutral-600">{account.description}</p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Balance summary</h2>
          <div className="space-y-2 text-sm">
            <Info label="Current balance" value="Awaiting ledger" muted />
            <Info label="Year-to-date movement" value="Awaiting ledger" muted />
            <Info label="Transactions" value="Awaiting ledger" muted />
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Balances populate once a posting ledger is added. Today the chart is a
            reference structure.
          </p>
        </div>
      </div>

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
                    <td className="py-2 text-right text-neutral-400">
                      {k.is_active ? "" : "Inactive"}
                    </td>
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

function Info({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={muted ? "text-neutral-400" : "font-medium text-neutral-800"}>{value}</dd>
    </div>
  );
}
