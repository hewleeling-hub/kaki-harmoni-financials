import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Chair, Session, Product, ChairWithSession } from "@/lib/types";
import { today, dayBounds } from "@/lib/format";

export const dynamic = "force-dynamic";

// Board snapshot: chairs (ordered) each joined with their live session, plus the
// active extras catalogue for the Start Session sheet. Each chair is also
// enriched with real today-so-far operational stats (sessions started + revenue
// taken through that chair), scoped to the GMT+8 business day.
export async function GET() {
  const supabase = createAdminClient();
  const { startISO, endISO } = dayBounds(today());

  const [
    { data: chairs },
    { data: sessions },
    { data: products },
    { data: todaySessions },
    { data: todaySales },
  ] = await Promise.all([
    supabase.from("chairs").select("*").order("label"),
    supabase.from("sessions").select("*").neq("status", "completed"),
    supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    // Every session started today (any status) → per-chair session count today.
    supabase
      .from("sessions")
      .select("id, chair_id, started_at")
      .gte("started_at", startISO)
      .lt("started_at", endISO),
    // Every sale rung up today that is attached to a session → per-chair revenue.
    // Quick sales (session_id null) are counter sales, not attributed to a chair.
    supabase
      .from("sales")
      .select("session_id, total_amount, created_at")
      .gte("created_at", startISO)
      .lt("created_at", endISO)
      .not("session_id", "is", null),
  ]);

  const sessionById = new Map<string, Session>(
    (sessions ?? []).map((s) => [s.id, s]),
  );

  // sessionId → chairId, from today's sessions (plus live ones as a fallback).
  const sessionChair = new Map<string, string>();
  for (const s of todaySessions ?? []) sessionChair.set(s.id, s.chair_id);
  for (const s of sessions ?? []) sessionChair.set(s.id, s.chair_id);

  const sessionsTodayByChair = new Map<string, number>();
  for (const s of todaySessions ?? [])
    sessionsTodayByChair.set(
      s.chair_id,
      (sessionsTodayByChair.get(s.chair_id) ?? 0) + 1,
    );

  const revenueTodayByChair = new Map<string, number>();
  for (const sale of todaySales ?? []) {
    const chairId = sale.session_id
      ? sessionChair.get(sale.session_id)
      : undefined;
    if (!chairId) continue;
    revenueTodayByChair.set(
      chairId,
      (revenueTodayByChair.get(chairId) ?? 0) + Number(sale.total_amount),
    );
  }

  const board = (chairs ?? []).map((c: Chair) => ({
    ...c,
    session: c.current_session_id
      ? sessionById.get(c.current_session_id) ?? null
      : null,
    sessions_today: sessionsTodayByChair.get(c.id) ?? 0,
    revenue_today: revenueTodayByChair.get(c.id) ?? 0,
  })) satisfies (ChairWithSession & {
    sessions_today: number;
    revenue_today: number;
  })[];

  // Extras = active products that are not part of the fixed bundle split.
  const extras: Product[] = (products ?? []).filter(
    (p: Product) => Number(p.bundle_allocation) === 0,
  );

  return NextResponse.json({ chairs: board, extras });
}
