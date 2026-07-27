import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "receipts";
const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};
const MAX_BYTES = 5 * 1024 * 1024;

// Stores the original receipt file in Supabase Storage and returns a public URL
// for expenses.receipt_url. Independent of the OCR feature — the image is kept
// as an audit trail even when scanning is disabled. Self-provisions the bucket
// on first use (requires the service-role key server-side).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.data || !body?.media_type) {
    return NextResponse.json(
      { error: "data (base64) and media_type are required" },
      { status: 400 },
    );
  }
  const ext = EXT[body.media_type as string];
  if (!ext) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const bytes = Buffer.from(body.data, "base64");
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large (max 5MB)." },
      { status: 413 },
    );
  }

  const supabase = createAdminClient();

  // Ensure the public bucket exists (idempotent; ignores "already exists").
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });
  if (
    bucketErr &&
    !/exist/i.test(bucketErr.message) &&
    !/already/i.test(bucketErr.message)
  ) {
    return NextResponse.json(
      {
        error:
          "Receipt storage is unavailable (could not create bucket). Check SUPABASE_SERVICE_ROLE_KEY.",
        detail: bucketErr.message,
      },
      { status: 501 },
    );
  }

  const path = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: body.media_type, upsert: false });

  if (uploadErr) {
    return NextResponse.json(
      { error: uploadErr.message || "Upload failed" },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ receipt_url: data.publicUrl });
}
