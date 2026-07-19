import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Deterministic state machine (docs/AGENTIC_LAYER.md → advance_chair_status, Low risk).
// Advances every chair whose timer has elapsed:
//   running  + now > spa_ends_at   → resting  (session.status = resting)
//   resting  + now > rest_ends_at  → free     (session.status = completed, chair cleared)
// Idempotent: called on page load and on a client interval; safe to run repeatedly
// and from multiple devices.
export async function POST() {
  const supabase = createAdminClient();
  const now = Date.now();

  const { data: chairs, error } = await supabase
    .from("chairs")
    .select("id, status, current_session_id")
    .neq("status", "free");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let advanced = 0;
  for (const chair of chairs ?? []) {
    if (!chair.current_session_id) continue;

    const { data: session } = await supabase
      .from("sessions")
      .select("id, spa_ends_at, rest_ends_at, status")
      .eq("id", chair.current_session_id)
      .single();
    if (!session) continue;

    const spaEnds = session.spa_ends_at
      ? new Date(session.spa_ends_at).getTime()
      : Infinity;
    const restEnds = session.rest_ends_at
      ? new Date(session.rest_ends_at).getTime()
      : Infinity;

    if (now >= restEnds) {
      await supabase
        .from("sessions")
        .update({ status: "completed" })
        .eq("id", session.id);
      await supabase
        .from("chairs")
        .update({ status: "free", current_session_id: null })
        .eq("id", chair.id);
      advanced++;
    } else if (now >= spaEnds && chair.status === "running") {
      await supabase
        .from("sessions")
        .update({ status: "resting" })
        .eq("id", session.id);
      await supabase
        .from("chairs")
        .update({ status: "resting" })
        .eq("id", chair.id);
      advanced++;
    }
  }

  return NextResponse.json({ advanced });
}
