"use client";

import Link from "next/link";
import type { Expense, Reimbursement } from "@/lib/types";
import { rm } from "@/lib/format";
import { amountInWords } from "@/lib/amountInWords";
import { voucherView, slipLabel } from "@/lib/voucher";
import { EntityLetterhead } from "@/components/EntityLetterhead";

// A blank ruled line for details filled in by hand at the counter.
function Blank() {
  return <span className="text-neutral-300">………………………</span>;
}

export function PurchaseVoucher({
  expense,
  reimbursement,
}: {
  expense: Expense;
  reimbursement: Reimbursement | null;
}) {
  // Which of the three vouchers this is, and the wording that goes with it —
  // shared with the PDF so the printed and downloaded copies can't drift.
  const v = voucherView(expense, reimbursement);
  const isDirect = v.isDirect;
  const selfCertified = v.selfCertified;

  const discount = Number(expense.discount) || 0;
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
          <h1 className="text-xl font-bold tracking-tight">{v.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {!isDirect && !v.voucherDate && (
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
          <EntityLetterhead />
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-widest">
              {v.title}
            </p>
            <table className="ml-auto mt-2 text-xs">
              <tbody>
                <tr>
                  <td className="pr-3 text-neutral-500">PV No.</td>
                  <td className="font-mono font-semibold">
                    {v.pvNumber ?? <Blank />}
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 text-neutral-500">Date</td>
                  <td className="font-mono font-semibold">
                    {v.voucherDate ?? <Blank />}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-8 gap-y-2 border-b border-neutral-300 py-4">
          <div>
            <span className="text-neutral-500">Paid to</span>
            <p className="text-base font-semibold">{v.paidTo}</p>
          </div>
          <div>
            <span className="text-neutral-500">{v.beingForLabel}</span>
            <p className={`font-semibold ${v.beingFor ? "" : "capitalize"}`}>
              {v.beingFor ?? v.beingForFallback}
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
              {selfCertified && (
                <th className="w-16 py-2 text-right font-medium">Slip</th>
              )}
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
                  {selfCertified && (
                    <td
                      className={`py-2 text-right ${
                        li.has_slip === false ? "text-neutral-400" : ""
                      }`}
                    >
                      {slipLabel(li)}
                    </td>
                  )}
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
                {selfCertified && <td className="py-2" />}
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
                {selfCertified && <td className="py-2" />}
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
                {selfCertified && <td className="py-2" />}
                <td className="py-2" />
              </tr>
            ))}
          </tbody>
          <tfoot>
            {/* Only shown when there was one — an empty discount line on a
                voucher just invites the question "discount of what?". */}
            {discount > 0 && (
              <>
                <tr className="border-t border-neutral-300 text-neutral-600">
                  <td className="py-1.5" colSpan={selfCertified ? 3 : 2}>
                    Subtotal
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {rm(Number(expense.amount) + discount)}
                  </td>
                </tr>
                <tr className="text-neutral-600">
                  <td className="py-1.5" colSpan={selfCertified ? 3 : 2}>
                    Discount
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    −{rm(discount)}
                  </td>
                </tr>
              </>
            )}
            <tr className="border-t-2 border-neutral-900 text-base font-bold">
              <td className="py-2" colSpan={selfCertified ? 3 : 2}>
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

        {v.slipSummary && (
          <p className="mt-3 text-[12px] text-neutral-500">{v.slipSummary}</p>
        )}

        {expense.comments && (
          <p className="mt-3 text-[12px]">
            <span className="text-neutral-500">Notes: </span>
            {expense.comments}
          </p>
        )}

        {/* With no supplier receipt to attach, this signed declaration is the
            document — so it prints above the signature it refers to. */}
        {v.declaration && (
          <div className="mt-4 rounded-md border border-neutral-400 bg-neutral-50 p-3 text-[11.5px] leading-snug print:bg-white">
            <p className="mb-1 font-semibold uppercase tracking-wide text-neutral-500">
              Declaration
            </p>
            <p>{v.declaration}</p>
          </div>
        )}

        <div className="mt-14 grid grid-cols-3 gap-8 text-xs">
          {v.signatures.map((label) => (
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
