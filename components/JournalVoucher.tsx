"use client";

import Link from "next/link";
import { rm } from "@/lib/format";
import { amountInWords } from "@/lib/amountInWords";
import { EntityLetterhead } from "@/components/EntityLetterhead";
import type { VoucherLine } from "@/lib/journalVoucherPdf";

/**
 * A journal entry as a document someone can sign.
 *
 * The ledger records what happened; this says who authorised it. Cash into the
 * till, a correction, a transfer between director accounts — none has a
 * supplier invoice behind it, so this signed sheet is the only evidence the
 * entry was intended.
 */
export function JournalVoucher({
  id,
  jvNumber,
  entryDate,
  memo,
  reference,
  lines,
}: {
  id: string;
  jvNumber: string | null;
  entryDate: string;
  memo: string | null;
  reference: string | null;
  lines: VoucherLine[];
}) {
  const totalDebit = lines.reduce((a, l) => a + Number(l.debit), 0);
  const totalCredit = lines.reduce((a, l) => a + Number(l.credit), 0);
  const balanced =
    Math.round(totalDebit * 100) === Math.round(totalCredit * 100);

  return (
    <div>
      {/* Screen-only toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/ledger"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            ← Ledger
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Journal Voucher</h1>
        </div>
        <div className="flex items-center gap-3">
          {!balanced && (
            <p className="text-sm font-medium text-red-700">
              This entry does not balance — do not file it.
            </p>
          )}
          <a
            href={`/api/journals/${id}/voucher-pdf`}
            className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-50"
          >
            Download PDF
          </a>
          <button
            onClick={() => window.print()}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Print
          </button>
        </div>
      </div>

      {/* The voucher itself — the only thing that reaches the printer. */}
      <div className="voucher-sheet mx-auto max-w-[820px] border border-neutral-300 bg-white p-8 text-[13px] leading-relaxed text-neutral-900 print:max-w-none print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4">
          <EntityLetterhead />
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-widest">
              Journal Voucher
            </p>
            <table className="ml-auto mt-2 text-xs">
              <tbody>
                <tr>
                  <td className="pr-3 text-neutral-500">JV No.</td>
                  <td className="font-mono font-semibold">{jvNumber ?? "—"}</td>
                </tr>
                <tr>
                  <td className="pr-3 text-neutral-500">Date</td>
                  <td className="font-mono font-semibold">{entryDate}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="border-b border-neutral-300 py-4">
          <span className="text-neutral-500">Being</span>
          <p className="text-base font-semibold">{memo ?? "—"}</p>
          {reference && (
            <p className="mt-2 text-xs">
              <span className="text-neutral-500">Reference: </span>
              {reference}
            </p>
          )}
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="w-16 py-2 font-medium">Code</th>
              <th className="py-2 font-medium">Account</th>
              <th className="w-28 py-2 text-right font-medium">Debit (RM)</th>
              <th className="w-28 py-2 text-right font-medium">Credit (RM)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-100 align-top">
                <td className="py-2 font-mono text-xs">{l.account_code}</td>
                <td className="py-2">
                  <span className="font-semibold">{l.account_name}</span>
                  {l.memo && (
                    <span className="block text-xs text-neutral-500">{l.memo}</span>
                  )}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {Number(l.debit) > 0 ? Number(l.debit).toFixed(2) : ""}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {Number(l.credit) > 0 ? Number(l.credit).toFixed(2) : ""}
                </td>
              </tr>
            ))}
            {/* Ruled blanks keep the printed sheet looking like a form. */}
            {Array.from({ length: Math.max(0, 4 - lines.length) }).map((_, i) => (
              <tr key={`blank-${i}`} className="border-b border-neutral-100">
                <td className="py-2">&nbsp;</td>
                <td className="py-2" />
                <td className="py-2" />
                <td className="py-2" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900 text-base font-bold">
              <td className="py-2" colSpan={2}>
                Total
              </td>
              <td className="py-2 text-right tabular-nums">{rm(totalDebit)}</td>
              <td className="py-2 text-right tabular-nums">{rm(totalCredit)}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 border-b border-neutral-300 pb-3 text-[12px]">
          <span className="text-neutral-500">Amount in words: </span>
          <span className="font-semibold">{amountInWords(totalDebit)}</span>
        </p>

        {/* A signed voucher that does not balance is worse than none, so it
            says so on the page rather than printing quietly. */}
        {!balanced && (
          <p className="mt-3 rounded-md border border-red-400 bg-red-50 p-3 text-[12px] font-semibold text-red-800 print:bg-white">
            NOT BALANCED — debits and credits differ. Do not file this voucher.
          </p>
        )}

        <div className="mt-14 grid grid-cols-3 gap-8 text-xs">
          {["Prepared by", "Checked by", "Approved by"].map((label) => (
            <div key={label}>
              <div className="border-t border-neutral-900 pt-1">{label}</div>
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
