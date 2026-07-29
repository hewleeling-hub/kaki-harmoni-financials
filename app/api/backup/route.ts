import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createAdminClient } from "@/lib/supabase/admin";
import { today } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TABLES = [
  "chairs",
  "products",
  "sessions",
  "sales",
  "sale_items",
  "expenses",
  "reimbursements",
] as const;

const BUCKET = "receipts";

type SB = ReturnType<typeof createAdminClient>;

// Recursively list every file path in a storage bucket.
async function listAll(supabase: SB, prefix = ""): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const out: string[] = [];
  for (const item of data) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      out.push(...(await listAll(supabase, path)));
    } else {
      out.push(path);
    }
  }
  return out;
}

// Complete backup: a ZIP with data.json (all tables) + receipts/ (image files).
export async function GET() {
  const supabase = createAdminClient();

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const t of TABLES) {
    const { data: rows, error } = await supabase.from(t).select("*");
    if (error) {
      return NextResponse.json(
        { error: `Failed on ${t}: ${error.message}` },
        { status: 500 },
      );
    }
    data[t] = rows ?? [];
    counts[t] = rows?.length ?? 0;
  }

  const zip = new JSZip();

  // Receipt image files (best-effort — skipped if storage is unavailable).
  let receiptCount = 0;
  try {
    const paths = await listAll(supabase);
    for (const p of paths) {
      const { data: blob } = await supabase.storage.from(BUCKET).download(p);
      if (blob) {
        const buf = Buffer.from(await blob.arrayBuffer());
        zip.file(`receipts/${p}`, buf);
        receiptCount++;
      }
    }
  } catch {
    // leave receiptCount as-is
  }

  const manifest = {
    app: "kaki-harmoni-financials",
    version: 1,
    exported_at: new Date().toISOString(),
    counts: { ...counts, receipt_files: receiptCount },
    data,
  };
  zip.file("data.json", JSON.stringify(manifest, null, 2));

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="kaki-harmoni-backup-${today()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
