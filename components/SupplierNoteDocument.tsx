"use client";

import Link from "next/link";
import type { Expense, SupplierNote } from "@/lib/types";
import { rm } from "@/lib/format";
import { amountInWords } from "@/lib/amountInWords";
import { EntityLetterhead } from "@/components/EntityLetterhead";

const label = (v: string) => v.replace(/_/g, " ");

export function SupplierNoteDocument({
  note,
  expense,
}: {
  note: SupplierNote;
  expense: Expense | null;
}) {
  const isDebit = note.note_type === "debit";
  const title = isDebit ? "Debit Note" : "Credit Note";

  // A debit note is normally a claim we make on the supplier; a credit note
  // records one they have granted us. But a note whose payee is the supplier
  // themselves is money going the other way — a repayment we are making — and
  // saying "we hereby debit your account" on it would state the opposite of
  // what the document is for.
  const payingTheSupplier =
    !!note.pay_to_name &&
    note.pay_to_name.trim().toLowerCase() === note.vendor.trim().toLowerCase();

  const statement = payingTheSupplier
    ? "The amount shown below is being repaid to you, to the account given under Payment details."
    : isDebit
      ? "We hereby debit your account with the amount shown below."
      : "Your credit to our account is recorded below.";

  const hasPaymentDetails =
    !!note.pay_to_name || !!note.pay_to_bank || !!note.pay_to_account || !!note.pay_to_qr_url;

  return (
    <div>
      {/* Screen-only toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/notes"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            ← Notes
          </Link>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {note.status === "open" && (
            <p className="text-sm text-amber-700">
              Open — not yet applied by the supplier.
            </p>
          )}
          <button
            onClick={() => window.print()}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Print
          </button>
        </div>
      </div>

      <div className="voucher-sheet mx-auto max-w-[820px] border border-neutral-300 bg-white p-8 text-[13px] leading-relaxed text-neutral-900 print:max-w-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
          <EntityLetterhead />
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-widest">{title}</p>
            <table className="ml-auto mt-2 text-xs">
              <tbody>
                <tr>
                  <td className="pr-3 text-neutral-500">
                    {isDebit ? "DN No." : "CN No."}
                  </td>
                  <td className="font-mono font-semibold">
                    {note.note_number ?? "—"}
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 text-neutral-500">Date</td>
                  <td className="font-mono font-semibold">{note.note_date}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-2 border-b border-neutral-300 py-4">
          <div>
            <span className="text-neutral-500">To</span>
            <p className="text-base font-semibold">{note.vendor}</p>
          </div>
          <div>
            <span className="text-neutral-500">Reason</span>
            <p className="font-semibold capitalize">
              {note.reason ? label(note.reason) : "—"}
            </p>
          </div>
          <div>
            <span className="text-neutral-500">Against PO No.</span>
            <p className="font-mono">{expense?.po_number ?? "—"}</p>
          </div>
          <div>
            <span className="text-neutral-500">Original purchase</span>
            <p>
              {expense ? `${expense.expense_date} · ${rm(expense.amount)}` : "—"}
            </p>
          </div>
        </section>

        <p className="py-4 text-neutral-700">{statement}</p>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 font-medium">Particulars</th>
              <th className="w-32 py-2 text-right font-medium">Amount (RM)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-100 align-top">
              <td className="py-2">
                {note.description ||
                  (note.reason ? label(note.reason) : title) +
                    (expense ? ` — ${expense.vendor}` : "")}
              </td>
              <td className="py-2 text-right tabular-nums">
                {Number(note.amount).toFixed(2)}
              </td>
            </tr>
            {Array.from({ length: 3 }).map((_, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2">&nbsp;</td>
                <td className="py-2" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900 text-base font-bold">
              <td className="py-2">Total</td>
              <td className="py-2 text-right tabular-nums">{rm(note.amount)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 border-b border-neutral-300 pb-3 text-[12px]">
          <span className="text-neutral-500">Amount in words: </span>
          <span className="font-semibold">{amountInWords(note.amount)}</span>
        </p>

        {hasPaymentDetails && (
          <section className="mt-5 flex flex-wrap items-start justify-between gap-6 rounded border border-neutral-300 p-4">
            <div className="text-[12px]">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
                Payment details
              </p>
              <table className="border-collapse">
                <tbody>
                  {note.pay_to_name && (
                    <tr>
                      <td className="pr-4 align-top text-neutral-500">Pay to</td>
                      <td className="font-semibold">{note.pay_to_name}</td>
                    </tr>
                  )}
                  {note.pay_to_bank && (
                    <tr>
                      <td className="pr-4 align-top text-neutral-500">Bank</td>
                      <td className="font-semibold">{note.pay_to_bank}</td>
                    </tr>
                  )}
                  {note.pay_to_account && (
                    <tr>
                      <td className="pr-4 align-top text-neutral-500">Account no.</td>
                      <td className="font-mono text-base font-semibold tracking-wide">
                        {note.pay_to_account}
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td className="pr-4 align-top text-neutral-500">Amount</td>
                    <td className="font-semibold">{rm(note.amount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {note.pay_to_qr_url && (
              <div className="text-center">
                {/* Printed at a size a phone camera can actually read. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/receipts/view?path=${encodeURIComponent(note.pay_to_qr_url)}`}
                  alt={`Payment QR for ${note.pay_to_name ?? note.vendor}`}
                  className="h-[150px] w-[150px] border border-neutral-200 object-contain"
                />
                <p className="mt-1 text-[10px] uppercase tracking-widest text-neutral-500">
                  Scan to pay
                </p>
              </div>
            )}
          </section>
        )}

        <div className="mt-14 grid grid-cols-2 gap-8 text-xs">
          {(payingTheSupplier
            ? ["Paid by", "Received by (supplier)"]
            : ["Issued by", "Acknowledged by (supplier)"]
          ).map((l) => (
            <div key={l}>
              <div className="border-t border-neutral-900 pt-1">{l}</div>
              <div className="mt-6 border-t border-dotted border-neutral-400 pt-1 text-neutral-500">
                Date
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm;
          }
          body {
            background: #fff;
          }
          body * {
            visibility: hidden;
          }
          .voucher-sheet,
          .voucher-sheet * {
            visibility: visible;
          }
          .voucher-sheet {
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
