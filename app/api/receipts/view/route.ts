import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const BUCKET = "receipts";

// Serves a stored receipt by minting a short-lived signed URL and redirecting to
// it — the private bucket is never exposed publicly. `path` is the value saved in
// expenses.receipt_url. Legacy full-URL values are redirected through as-is.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }
  if (/^https?:\/\//i.test(path)) {
    return NextResponse.redirect(path);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 300); // 5-minute link

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message || "Receipt not found" },
      { status: 404 },
    );
  }
  return NextResponse.redirect(data.signedUrl);
}
