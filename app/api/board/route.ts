import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Chair, Session, Product, ChairWithSession } from "@/lib/types";

export const dynamic = "force-dynamic";

// Board snapshot: chairs (ordered) each joined with their live session, plus the
// active extras catalogue for the Start Session sheet.
export async function GET() {
  const supabase = createAdminClient();

  const [{ data: chairs }, { data: sessions }, { data: products }] =
    await Promise.all([
      supabase.from("chairs").select("*").order("label"),
      supabase
        .from("sessions")
        .select("*")
        .neq("status", "completed"),
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("name"),
    ]);

  const sessionById = new Map<string, Session>(
    (sessions ?? []).map((s) => [s.id, s]),
  );

  const board: ChairWithSession[] = (chairs ?? []).map((c: Chair) => ({
    ...c,
    session: c.current_session_id
      ? sessionById.get(c.current_session_id) ?? null
      : null,
  }));

  // Extras = active products that are not part of the fixed bundle split.
  const extras: Product[] = (products ?? []).filter(
    (p: Product) => Number(p.bundle_allocation) === 0,
  );

  return NextResponse.json({ chairs: board, extras });
}
