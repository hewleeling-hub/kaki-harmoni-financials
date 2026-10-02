// What a purchase voucher says, worked out once.
//
// The same voucher is rendered twice — on screen (components/PurchaseVoucher)
// and as a PDF (lib/voucherPdf) — so the wording, the title and the signature
// lines live here. Two renderers deriving the same rules independently is how
// the printed copy and the downloaded copy end up disagreeing.

import type { Expense, Reimbursement, LineItem } from "./types";
import { payerLabel } from "./constants";
import { gmt8Date } from "./format";
import { businessConfig } from "../config/business";

export type VoucherView = {
  /** Cash handed straight out of the tin — the money has already moved. */
  isDirect: boolean;
  /** No supplier document: the signature on this voucher is the evidence. */
  selfCertified: boolean;
  title: string;
  pvNumber: string | null;
  paidTo: string;
  beingForLabel: string;
  /** Null on a direct voucher with no description — falls back to the category. */
  beingFor: string | null;
  beingForFallback: string;
  /** Blank until the money actually moves back to whoever fronted it. */
  voucherDate: string | null;
  signatures: readonly [string, string, string];
  /** The certification printed above the signatures. Null unless self-certified. */
  declaration: string | null;
  /** How much of the voucher a supplier slip backs up. Null unless self-certified. */
  slipSummary: string | null;
};

/** Did this line come with a slip from the stall? Absent on older rows. */
export function slipLabel(li: LineItem): string {
  if (li.has_slip === true) return "Yes";
  if (li.has_slip === false) return "No";
  return "—";
}

export function voucherView(
  expense: Expense,
  reimbursement: Reimbursement | null,
): VoucherView {
  const isDirect = expense.payer === "petty_cash" && !reimbursement;
  const selfCertified = !!expense.self_certified;
  const lineItems = expense.line_items ?? [];

  const paidTo = isDirect
    ? expense.vendor
    : (reimbursement?.owed_to ?? payerLabel(expense.payer));

  // "Paid to" already names the payee on a direct voucher, so the second field
  // says what the money was for instead of repeating the name.
  const beingFor = isDirect ? expense.description || null : expense.vendor;

  const withSlip = lineItems.filter((li) => li.has_slip === true).length;
  const withoutSlip = lineItems.filter((li) => li.has_slip === false).length;

  return {
    isDirect,
    selfCertified,
    // A self-certified purchase is its own document, so it gets its own name —
    // calling it a petty cash voucher would misstate where the money came from.
    title: isDirect
      ? "Petty Cash Voucher"
      : selfCertified
        ? "Market Purchase Voucher"
        : "Purchase Voucher",
    pvNumber: reimbursement?.pv_number ?? expense.pv_number,
    paidTo,
    beingForLabel: isDirect
      ? "Being payment for"
      : selfCertified
        ? "Bought at"
        : "Being reimbursement for",
    beingFor,
    beingForFallback: expense.category.replace(/_/g, " "),
    voucherDate: isDirect
      ? expense.expense_date
      : reimbursement?.settled_at
        ? gmt8Date(reimbursement.settled_at)
        : null,
    signatures: selfCertified
      ? ["Purchased & certified by", "Approved by", "Reimbursed by"]
      : ["Received by", "Approved by", "Paid by"],
    declaration: selfCertified
      ? `I certify that the items listed above were bought for the business of ${businessConfig.legalName} ` +
        `and paid for with my own cash. Where the Slip column reads "No", no supplier receipt was issued or ` +
        `available. The particulars and amounts above are true and correct.`
      : null,
    slipSummary:
      selfCertified && lineItems.length > 0
        ? `${withSlip} of ${lineItems.length} ${
            lineItems.length === 1 ? "line" : "lines"
          } supported by a supplier slip` +
          (withoutSlip > 0 ? `; ${withoutSlip} self-certified.` : ".")
        : null,
  };
}
