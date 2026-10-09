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
import { amountInWords } from "./amountInWords";

/**
 * Which document is being printed for a purchase.
 *
 *   reimbursement — the default: made out to whoever fronted the money, for
 *                   the business to pay them back.
 *   payee         — made out to the supplier who received the money, for them
 *                   to sign acknowledging it. Same purchase, other side of it.
 */
export type VoucherMode = "reimbursement" | "payee";

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
  /** The certification printed above the signatures. Null when there is none. */
  declaration: string | null;
  /** What that block is headed — a buyer certifies, a payee acknowledges. */
  declarationLabel: string;
  /** How much of the voucher a supplier slip backs up. Null unless self-certified. */
  slipSummary: string | null;
};

/** The payee's acknowledgement, printed above their signature. */
function acknowledgement(amountInWordsPlaceholder: string): string {
  return (
    `Received from ${businessConfig.legalName} the sum of ${amountInWordsPlaceholder} ` +
    `in full settlement of the particulars listed above.`
  );
}

/** Did this line come with a slip from the stall? Absent on older rows. */
export function slipLabel(li: LineItem): string {
  if (li.has_slip === true) return "Yes";
  if (li.has_slip === false) return "No";
  return "—";
}

export function voucherView(
  expense: Expense,
  reimbursement: Reimbursement | null,
  mode: VoucherMode = "reimbursement",
): VoucherView {
  // A payee voucher names the supplier however the money reached them, so the
  // petty-cash/reimbursement distinction does not apply to it.
  const isPayee = mode === "payee";
  const isDirect = !isPayee && expense.payer === "petty_cash" && !reimbursement;
  // Self-certification is the buyer swearing to their own spending. On a payee
  // voucher the payee signs instead, so it has no place there.
  const selfCertified = !isPayee && !!expense.self_certified;
  const lineItems = expense.line_items ?? [];

  const paidTo =
    isPayee || isDirect
      ? expense.vendor
      : (reimbursement?.owed_to ?? payerLabel(expense.payer));

  // "Paid to" already names the payee on a direct voucher, so the second field
  // says what the money was for instead of repeating the name.
  const beingFor =
    isPayee || isDirect ? expense.description || null : expense.vendor;

  const withSlip = lineItems.filter((li) => li.has_slip === true).length;
  const withoutSlip = lineItems.filter((li) => li.has_slip === false).length;

  return {
    isDirect,
    selfCertified,
    // A self-certified purchase is its own document, so it gets its own name —
    // calling it a petty cash voucher would misstate where the money came from.
    title: isPayee
      ? "Payment Voucher"
      : isDirect
        ? "Petty Cash Voucher"
        : selfCertified
          ? "Self-Certified Purchase Voucher"
          : "Purchase Voucher",
    pvNumber: reimbursement?.pv_number ?? expense.pv_number,
    paidTo,
    beingForLabel:
      isPayee || isDirect
        ? "Being payment for"
        : selfCertified
          ? "Bought from"
          : "Being reimbursement for",
    beingFor,
    beingForFallback: expense.category.replace(/_/g, " "),
    // A payee dates their own signature, so the header date is the purchase
    // date — when the books say the money was due to them.
    voucherDate:
      isPayee || isDirect
        ? expense.expense_date
        : reimbursement?.settled_at
          ? gmt8Date(reimbursement.settled_at)
          : null,
    signatures: isPayee
      ? ["Received by", "Paid by", "Approved by"]
      : selfCertified
        ? ["Purchased & certified by", "Approved by", "Reimbursed by"]
        : ["Received by", "Approved by", "Paid by"],
    declarationLabel: isPayee ? "Acknowledgement" : "Declaration",
    declaration: isPayee
      ? acknowledgement(amountInWords(Number(expense.amount)))
      : selfCertified
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
