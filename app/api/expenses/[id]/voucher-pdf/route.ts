import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildVoucherPdf, unsupportedCharacters } from "@/lib/voucherPdf";
import type { Expense, Reimbursement } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/expenses/[id]/voucher-pdf — the petty cash voucher as a downloadable
// A4 PDF. Exists so a device with no printer configured can still get the
// document; the browser's Print dialog needs a printer, a download does not.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .single();
  if (!expense)
    return NextResponse.json({ error: "Purchase not found." }, { status: 404 });

  const { data: reimbursement } = await supabase
    .from("reimbursements")
    .select("*")
    .eq("expense_id", id)
    .maybeSingle();

  const e = expense as Expense;
  const r = (reimbursement as Reimbursement) ?? null;

  // Refuse rather than print a voucher with a blank payee: the bundled font
  // covers Latin/Cyrillic/Greek but not CJK, and a missing name on a financial
  // document is worse than no PDF.
  const missing = unsupportedCharacters([
    e.vendor,
    e.description ?? "",
    e.comments ?? "",
    r?.owed_to ?? "",
    ...(e.line_items ?? []).map((li) => li.description),
  ]);
  if (missing.length) {
    return NextResponse.json(
      {
        error: `This voucher contains characters the PDF font cannot render (${missing.join(" ")}). Use the Print button and choose "Save as PDF" instead.`,
      },
      { status: 422 },
    );
  }

  const pdf = await buildVoucherPdf(e, r);
  const name = (r?.pv_number ?? e.pv_number ?? e.po_number ?? "voucher").replace(
    /[^A-Za-z0-9-]/g,
    "",
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${name}-petty-cash-voucher.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
