"use client";

import Link from "next/link";
import type { Expense, Reimbursement } from "@/lib/types";
import { rm, gmt8Date } from "@/lib/format";
import { amountInWords } from "@/lib/amountInWords";
import { PAYERS } from "@/lib/constants";
import { businessConfig } from "@/config/business";

// A blank ruled line for details filled in by hand at the counter.
function Blank() {
  return <span className="text-neutral-300">………………………</span>;
}

export function PettyCashVoucher({
  expense,
  reimbursement,
}: {
  expense: Expense;
  reimbursement: Reimbursement | null;
}) {
  // Two kinds of petty cash voucher:
  //   direct      — cash handed straight out of the tin (wages, a taxi). The
  //                 money has already moved, so the voucher is dated the day
  //                 of the payment and made out to whoever received it.
  //   reimbursement — someone fronted the money and is owed it back. Dated the
  //                 day it was actually repaid, which is blank until settled.
  const isDirect = expense.payer === "petty_cash" && !reimbursement;

  const pvNumber = reimbursement?.pv_number ?? expense.pv_number;

  const paidTo = isDirect
    ? expense.vendor
    : (reimbursement?.owed_to ??
      PAYERS.find((p) => p.value === expense.payer)?.label ??
      expense.payer.replace(/_/g, " "));

  const voucherDate = isDirect
    ? expense.expense_date
    : reimbursement?.settled_at
      ? gmt8Date(reimbursement.settled_at)
      : null;

  // "Paid to" already names the payee on a direct voucher, so the second field
  // says what the money was for instead of repeating the name.
  const beingForLabel = isDirect ? "Being payment for" : "Being reimbursement for";
  // Only the category fallback needs capitalising — a description the user
  // typed is left exactly as they wrote it.
  const beingFor = isDirect
    ? expense.description || null
    : expense.vendor;
  const beingForFallback = expense.category.replace(/_/g, " ");

  const lineItems = expense.line_items ?? [];
  const itemised = lineItems.length > 0;
  // Line items are captured from the receipt and may not add up to the total
  // (rounding, tax, items not itemised) — show the gap rather than hide it.
  const itemsTotal = lineItems.reduce((a, li) => a + Number(li.amount || 0), 0);
  const unallocated = Number(expense.amount) - itemsTotal;

  return (
    <div>
      {/* Screen-only toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/expenses"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            ← Purchases
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Petty Cash Voucher</h1>
        </div>
        <div className="flex items-center gap-3">
          {!isDirect && !voucherDate && (
            <p className="text-sm text-amber-700">
              Not reimbursed yet — the date line prints blank.
            </p>
          )}
          {/* A download works on a device with no printer configured, where
              the browser's Print dialog has nothing to send to. */}
          <a
            href={`/api/expenses/${expense.id}/voucher-pdf`}
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
          <div>
            <p className="font-serif text-2xl font-semibold">
              {businessConfig.name}
            </p>
            <p className="mt-1 whitespace-pre-line text-xs text-neutral-500">
              {businessConfig.address.lines.join("\n")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-widest">
              Petty Cash Voucher
            </p>
            <table className="ml-auto mt-2 text-xs">
              <tbody>
                <tr>
                  <td className="pr-3 text-neutral-500">PV No.</td>
                  <td className="font-mono font-semibold">
                    {pvNumber ?? <Blank />}
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 text-neutral-500">Date</td>
                  <td className="font-mono font-semibold">
                    {voucherDate ?? <Blank />}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-2 border-b border-neutral-300 py-4">
          <div>
            <span className="text-neutral-500">Paid to</span>
            <p className="text-base font-semibold">{paidTo}</p>
          </div>
          <div>
            <span className="text-neutral-500">{beingForLabel}</span>
            <p className={`font-semibold ${beingFor ? "" : "capitalize"}`}>
              {beingFor ?? beingForFallback}
            </p>
          </div>
          <div>
            <span className="text-neutral-500">PO No.</span>
            <p className="font-mono">{expense.po_number ?? "—"}</p>
          </div>
          <div>
            <span className="text-neutral-500">Purchase date</span>
            <p>{expense.expense_date}</p>
          </div>
        </section>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2 font-medium">Particulars</th>
              <th className="w-24 py-2 text-right font-medium">Qty</th>
              <th className="w-32 py-2 text-right font-medium">Amount (RM)</th>
            </tr>
          </thead>
          <tbody>
            {itemised ? (
              lineItems.map((li, i) => (
                <tr key={i} className="border-b border-neutral-100 align-top">
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-right tabular-nums">
                    {li.quantity || ""}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(li.amount).toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-neutral-100 align-top">
                <td className="py-2">
                  {expense.description || expense.category.replace(/_/g, " ")}
                </td>
                <td className="py-2" />
                <td className="py-2 text-right tabular-nums">
                  {Number(expense.amount).toFixed(2)}
                </td>
              </tr>
            )}

            {itemised && Math.abs(unallocated) >= 0.01 && (
              <tr className="border-b border-neutral-100 align-top">
                <td className="py-2 text-neutral-500">
                  Other / rounding not itemised
                </td>
                <td className="py-2" />
                <td className="py-2 text-right tabular-nums">
                  {unallocated.toFixed(2)}
                </td>
              </tr>
            )}

            {/* Ruled blank rows keep the printed voucher looking like a form. */}
            {Array.from({
              length: Math.max(0, 4 - (itemised ? lineItems.length : 1)),
            }).map((_, i) => (
              <tr key={`blank-${i}`} className="border-b border-neutral-100">
                <td className="py-2">&nbsp;</td>
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
              <td className="py-2 text-right tabular-nums">
                {rm(expense.amount)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-3 border-b border-neutral-300 pb-3 text-[12px]">
          <span className="text-neutral-500">Amount in words: </span>
          <span className="font-semibold">{amountInWords(expense.amount)}</span>
        </p>

        {expense.comments && (
          <p className="mt-3 text-[12px]">
            <span className="text-neutral-500">Notes: </span>
            {expense.comments}
          </p>
        )}

        <div className="mt-14 grid grid-cols-3 gap-8 text-xs">
          {["Received by", "Approved by", "Paid by"].map((label) => (
            <div key={label}>
              <div className="border-t border-neutral-900 pt-1">{label}</div>
              <div className="mt-6 border-t border-dotted border-neutral-400 pt-1 text-neutral-500">
                Date
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Print: the voucher sheet only, on a clean page. Hiding by visibility
          (rather than by tag) keeps this independent of the app chrome — the
          nav is a <header>, and so is the voucher's own masthead. */}
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
