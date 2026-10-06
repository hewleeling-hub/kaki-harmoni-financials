// A journal entry as a document someone can sign.
//
// The ledger records what happened; this is the piece of paper that says who
// authorised it. Cash moving into the till, a correction, a transfer between
// director accounts — none of those have a supplier invoice behind them, so
// the signed voucher is the only evidence that the entry was intended.
//
// Drawn with pdf-lib for the same reasons as the purchase voucher: selectable
// text, a small file, and a download for a device with no printer attached.

import fs from "node:fs";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { amountInWords } from "./amountInWords";
import { businessConfig, entitySubline } from "../config/business";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 39.7;
const RIGHT = PAGE_W - M;

const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.45, 0.48, 0.53);
const RULE = rgb(0.8, 0.82, 0.85);

export type VoucherLine = {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  memo: string | null;
};

export type JournalVoucher = {
  jv_number: string | null;
  entry_date: string;
  memo: string | null;
  reference: string | null;
  source: string;
  lines: VoucherLine[];
};

/** Characters the bundled font has no glyph for — CJK names, mainly. */
export function unsupportedCharacters(texts: string[]): string[] {
  const bad = new Set<string>();
  for (const t of texts) {
    for (const ch of t ?? "") {
      const cp = ch.codePointAt(0)!;
      if (cp > 0x2e00 && !(cp >= 0x2e00 && cp <= 0x2e7f)) bad.add(ch);
    }
  }
  return [...bad];
}

const round2 = (n: number) => Math.round(Number(n) * 100) / 100;
const money = (n: number) =>
  round2(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

type Ctx = { page: PDFPage; reg: PDFFont; bold: PDFFont };

function text(
  { page, reg, bold }: Ctx,
  s: string,
  x: number,
  y: number,
  o: { size?: number; bold?: boolean; color?: typeof INK; align?: "left" | "right" } = {},
) {
  const size = o.size ?? 9;
  const font = o.bold ? bold : reg;
  const w = font.widthOfTextAtSize(s, size);
  page.drawText(s, {
    x: o.align === "right" ? x - w : x,
    y,
    size,
    font,
    color: o.color ?? INK,
  });
}

function wrap(font: PDFFont, s: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of (s ?? "").split(/\s+/)) {
    const candidate = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) > maxW && line) {
      out.push(line);
      line = w;
    } else line = candidate;
  }
  if (line) out.push(line);
  return out;
}

export async function buildJournalVoucherPdf(j: JournalVoucher): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const fp = (f: string) => path.join(process.cwd(), "assets", "fonts", f);
  const reg = await doc.embedFont(fs.readFileSync(fp("DejaVuSans.ttf")), { subset: true });
  const bold = await doc.embedFont(fs.readFileSync(fp("DejaVuSans-Bold.ttf")), { subset: true });
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const c: Ctx = { page, reg, bold };
  const rule = (y: number, th = 0.6, col = RULE) =>
    page.drawLine({ start: { x: M, y }, end: { x: RIGHT, y }, thickness: th, color: col });

  const totalDebit = j.lines.reduce((a, l) => a + Number(l.debit), 0);
  const totalCredit = j.lines.reduce((a, l) => a + Number(l.credit), 0);

  let y = PAGE_H - M;
  text(c, businessConfig.legalName, M, y - 14, { size: 15, bold: true });
  text(c, "JOURNAL VOUCHER", RIGHT, y - 13, { size: 13, bold: true, align: "right" });
  y -= 28;
  text(c, entitySubline(), M, y, { size: 7.5, color: MUTED });
  y -= 11;
  for (const line of businessConfig.address.lines) {
    text(c, line, M, y, { size: 7.5, color: MUTED });
    y -= 10;
  }

  let metaY = PAGE_H - M - 34;
  for (const [label, value] of [
    ["JV No.", j.jv_number ?? "—"],
    ["Date", j.entry_date],
  ] as const) {
    text(c, label, RIGHT - 90, metaY, { size: 7.5, color: MUTED });
    text(c, value, RIGHT, metaY, { size: 9, bold: true, align: "right" });
    metaY -= 12;
  }

  y = Math.min(y, metaY) - 6;
  rule(y, 1.4, INK);
  y -= 18;

  // ── what this entry is for ────────────────────────────────────────────────
  text(c, "Being", M, y, { size: 7.5, color: MUTED });
  y -= 13;
  for (const l of wrap(bold, j.memo ?? "—", 10, RIGHT - M)) {
    text(c, l, M, y, { size: 10, bold: true });
    y -= 13;
  }
  y -= 5;
  if (j.reference) {
    text(c, "Reference", M, y, { size: 7.5, color: MUTED });
    text(c, j.reference, M + 60, y, { size: 8.5 });
    y -= 13;
  }
  y -= 2;
  rule(y);
  y -= 16;

  // ── the entry ─────────────────────────────────────────────────────────────
  const codeX = M, nameX = M + 46, drX = RIGHT - 95, crX = RIGHT;
  text(c, "CODE", codeX, y, { size: 7, color: MUTED });
  text(c, "ACCOUNT", nameX, y, { size: 7, color: MUTED });
  text(c, "DEBIT (RM)", drX, y, { size: 7, color: MUTED, align: "right" });
  text(c, "CREDIT (RM)", crX, y, { size: 7, color: MUTED, align: "right" });
  y -= 8;
  rule(y);
  y -= 15;

  for (const l of j.lines) {
    text(c, l.account_code, codeX, y, { size: 9 });
    text(c, l.account_name, nameX, y, { size: 9, bold: true });
    if (Number(l.debit) > 0) text(c, money(l.debit), drX, y, { size: 9, align: "right" });
    if (Number(l.credit) > 0) text(c, money(l.credit), crX, y, { size: 9, align: "right" });
    y -= 11;
    if (l.memo) {
      for (const m of wrap(reg, l.memo, 7.5, drX - nameX - 14)) {
        text(c, m, nameX, y, { size: 7.5, color: MUTED });
        y -= 10;
      }
    }
    y -= 4;
    rule(y + 5, 0.4, rgb(0.93, 0.94, 0.95));
  }

  // Ruled blanks so the sheet still reads as a form.
  for (let i = j.lines.length; i < 4; i++) {
    y -= 14;
    rule(y + 5, 0.4, rgb(0.93, 0.94, 0.95));
  }

  y -= 6;
  rule(y, 1.4, INK);
  y -= 16;
  text(c, "TOTAL", M, y, { size: 10, bold: true });
  text(c, money(totalDebit), drX, y, { size: 10, bold: true, align: "right" });
  text(c, money(totalCredit), crX, y, { size: 10, bold: true, align: "right" });
  y -= 18;

  text(c, "Amount in words:", M, y, { size: 7.5, color: MUTED });
  text(c, amountInWords(round2(totalDebit)), M + 78, y, { size: 8, bold: true });
  y -= 14;
  rule(y);
  y -= 14;

  // An unbalanced voucher should never print silently as if it were fine.
  if (round2(totalDebit) !== round2(totalCredit)) {
    text(c, "NOT BALANCED — debits and credits differ. Do not file this voucher.", M, y, {
      size: 8,
      bold: true,
      color: rgb(0.72, 0.1, 0.1),
    });
    y -= 14;
  }

  // ── signatures ────────────────────────────────────────────────────────────
  y -= 48;
  const colW = (RIGHT - M) / 3;
  ["Prepared by", "Checked by", "Approved by"].forEach((label, i) => {
    const x = M + i * colW;
    const w = colW - 18;
    page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: 0.8, color: INK });
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
