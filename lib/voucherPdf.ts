// Petty cash voucher as a real PDF file.
//
// Drawn directly with pdf-lib rather than screenshotting the page, so the text
// stays selectable and the file stays small — and so a printerless device can
// still get the document (the browser's Print dialog needs a printer; a
// download does not).

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Expense, Reimbursement } from "./types";
import { amountInWords } from "./amountInWords";
import { PAYERS } from "./constants";
import { gmt8Date } from "./format";
import { businessConfig } from "../config/business";

// A4 in points, with the same 14mm margin the print stylesheet uses.
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 39.7;
const RIGHT = PAGE_W - M;

const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.45, 0.48, 0.53);
const RULE = rgb(0.8, 0.82, 0.85);

function fontPath(file: string) {
  return path.join(process.cwd(), "assets", "fonts", file);
}

/**
 * Characters the bundled font has no glyph for — CJK vendor names, mainly.
 * Reported rather than silently drawn as blank boxes: a voucher with a missing
 * payee name is worse than no PDF at all.
 */
export function unsupportedCharacters(texts: string[]): string[] {
  // DejaVu covers Latin, Cyrillic and Greek; anything above U+2E00 (CJK and
  // friends) is out of range, as are a few other blocks we don't bundle.
  const bad = new Set<string>();
  for (const t of texts) {
    for (const ch of t ?? "") {
      const cp = ch.codePointAt(0)!;
      if (cp > 0x2e00 && !(cp >= 0x2e00 && cp <= 0x2e7f)) bad.add(ch);
    }
  }
  return [...bad];
}

type Ctx = { page: PDFPage; reg: PDFFont; bold: PDFFont };

function text(
  { page, reg, bold }: Ctx,
  s: string,
  x: number,
  y: number,
  opts: { size?: number; bold?: boolean; color?: typeof INK; align?: "left" | "right" } = {},
) {
  const size = opts.size ?? 9;
  const font = opts.bold ? bold : reg;
  const w = font.widthOfTextAtSize(s, size);
  page.drawText(s, {
    x: opts.align === "right" ? x - w : x,
    y,
    size,
    font,
    color: opts.color ?? INK,
  });
}

function rule(page: PDFPage, y: number, thickness = 0.6, color = RULE) {
  page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness, color });
}

export async function buildVoucherPdf(
  expense: Expense,
  reimbursement: Reimbursement | null,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const reg = await doc.embedFont(fs.readFileSync(fontPath("DejaVuSans.ttf")), {
    subset: true,
  });
  const bold = await doc.embedFont(fs.readFileSync(fontPath("DejaVuSans-Bold.ttf")), {
    subset: true,
  });
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const c: Ctx = { page, reg, bold };

  // Same two modes as the on-screen voucher (see components/PettyCashVoucher).
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
  const beingForLabel = isDirect ? "Being payment for" : "Being reimbursement for";
  const beingFor = isDirect
    ? expense.description || expense.category.replace(/_/g, " ")
    : expense.vendor;

  let y = PAGE_H - M;

  // ── masthead ──────────────────────────────────────────────────────────────
  text(c, businessConfig.name, M, y - 14, { size: 16, bold: true });
  text(c, "PETTY CASH VOUCHER", RIGHT, y - 13, { size: 13, bold: true, align: "right" });
  y -= 30;

  for (const line of businessConfig.address.lines) {
    text(c, line, M, y, { size: 7.5, color: MUTED });
    y -= 10;
  }

  let metaY = PAGE_H - M - 34;
  for (const [label, value] of [
    ["PV No.", pvNumber ?? "—"],
    ["Date", voucherDate ?? "—"],
  ] as const) {
    text(c, label, RIGHT - 90, metaY, { size: 7.5, color: MUTED });
    text(c, value, RIGHT, metaY, { size: 9, bold: true, align: "right" });
    metaY -= 12;
  }

  y = Math.min(y, metaY) - 6;
  rule(page, y, 1.4, INK);
  y -= 20;

  // ── who and what ──────────────────────────────────────────────────────────
  const colR = M + 260;
  text(c, "Paid to", M, y, { size: 7.5, color: MUTED });
  text(c, beingForLabel, colR, y, { size: 7.5, color: MUTED });
  y -= 13;
  text(c, paidTo, M, y, { size: 11, bold: true });
  text(c, beingFor, colR, y, { size: 9, bold: true });
  y -= 20;

  text(c, "PO No.", M, y, { size: 7.5, color: MUTED });
  text(c, "Purchase date", colR, y, { size: 7.5, color: MUTED });
  y -= 12;
  text(c, expense.po_number ?? "—", M, y, { size: 9 });
  text(c, expense.expense_date, colR, y, { size: 9 });
  y -= 14;
  rule(page, y);
  y -= 16;

  // ── particulars ───────────────────────────────────────────────────────────
  const qtyX = RIGHT - 150;
  const amtX = RIGHT;
  text(c, "PARTICULARS", M, y, { size: 7, color: MUTED });
  text(c, "QTY", qtyX, y, { size: 7, color: MUTED, align: "right" });
  text(c, "AMOUNT (RM)", amtX, y, { size: 7, color: MUTED, align: "right" });
  y -= 8;
  rule(page, y);
  y -= 16;

  const items = expense.line_items ?? [];
  const rows =
    items.length > 0
      ? items.map((li) => ({
          desc: li.description,
          qty: li.quantity > 0 ? String(li.quantity) : "",
          amt: Number(li.amount),
        }))
      : [
          {
            desc: expense.description || expense.category.replace(/_/g, " "),
            qty: "",
            amt: Number(expense.amount),
          },
        ];

  for (const r of rows) {
    // Wrap long particulars rather than letting them run under the amount.
    const maxW = qtyX - M - 12;
    const words = r.desc.split(/\s+/);
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w;
      if (reg.widthOfTextAtSize(candidate, 9) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = candidate;
    }
    if (line) lines.push(line);

    text(c, r.qty, qtyX, y, { size: 9, align: "right" });
    text(c, r.amt.toFixed(2), amtX, y, { size: 9, align: "right" });
    for (const l of lines) {
      text(c, l, M, y, { size: 9 });
      y -= 12;
    }
    y -= 4;
    rule(page, y + 6, 0.4, rgb(0.93, 0.94, 0.95));
  }

  // Ruled blanks so the printed sheet still reads as a form.
  for (let i = rows.length; i < 4; i++) {
    y -= 12;
    rule(page, y + 4, 0.4, rgb(0.93, 0.94, 0.95));
  }

  y -= 12;

  // Subtotal and discount only appear when there was a discount.
  const discount = Number(expense.discount) || 0;
  if (discount > 0) {
    rule(page, y);
    y -= 14;
    text(c, "Subtotal", M, y, { size: 9, color: MUTED });
    text(c, (Number(expense.amount) + discount).toFixed(2), amtX, y, {
      size: 9,
      align: "right",
    });
    y -= 13;
    text(c, "Discount", M, y, { size: 9, color: MUTED });
    text(c, `-${discount.toFixed(2)}`, amtX, y, { size: 9, align: "right" });
    y -= 6;
  }

  rule(page, y, 1.4, INK);
  y -= 18;
  text(c, "Total", M, y, { size: 11, bold: true });
  text(c, `RM${Number(expense.amount).toFixed(2)}`, amtX, y, {
    size: 11,
    bold: true,
    align: "right",
  });
  y -= 20;

  text(c, "Amount in words:", M, y, { size: 7.5, color: MUTED });
  text(c, amountInWords(expense.amount), M + 78, y, { size: 8, bold: true });
  y -= 12;
  rule(page, y);
  y -= 16;

  if (expense.comments) {
    text(c, "Notes:", M, y, { size: 7.5, color: MUTED });
    text(c, expense.comments, M + 34, y, { size: 8 });
    y -= 16;
  }

  // ── signatures ────────────────────────────────────────────────────────────
  y -= 56;
  const colW = (RIGHT - M) / 3;
  ["Received by", "Approved by", "Paid by"].forEach((label, i) => {
    const x = M + i * colW;
    const w = colW - 18;
    page.drawLine({
      start: { x, y },
      end: { x: x + w, y },
      thickness: 0.8,
      color: INK,
    });
    text(c, label, x, y - 10, { size: 7.5 });
    page.drawLine({
      start: { x, y: y - 34 },
      end: { x: x + w, y: y - 34 },
      thickness: 0.4,
      color: RULE,
    });
    text(c, "Date", x, y - 44, { size: 7.5, color: MUTED });
  });

  return doc.save();
}
