import { createAdminClient } from "@/lib/supabase/admin";
import { dayBounds, timeOfDay, rm, today } from "@/lib/format";
import type { Session, Sale, Chair } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  running: "bg-amber-100 text-amber-800",
  resting: "bg-red-100 text-red-800",
  completed: "bg-neutral-100 text-neutral-600",
};

export default async function SessionsPage() {
  const supabase = createAdminClient();
  const { startISO, endISO } = dayBounds(today());

  const [{ data: sessions }, { data: chairs }] = await Promise.all([
    supabase
      .from("sessions")
      .select("*")
      .gte("started_at", startISO)
      .lt("started_at", endISO)
      .order("started_at", { ascending: false }),
    supabase.from("chairs").select("*"),
  ]);

  const sessionRows = (sessions ?? []) as Session[];
  const chairById = new Map<string, Chair>(
    (chairs ?? []).map((c: Chair) => [c.id, c]),
  );

  const sessionIds = sessionRows.map((s) => s.id);
  let salesBySession = new Map<string, Sale>();
  if (sessionIds.length) {
    const { data: sales } = await supabase
      .from("sales")
      .select("*")
      .in("session_id", sessionIds);
    salesBySession = new Map(
      (sales ?? []).map((s: Sale) => [s.session_id as string, s]),
    );
  }

  const totalToday = [...salesBySession.values()].reduce(
    (acc, s) => acc + Number(s.total_amount),
    0,
  );

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Today&apos;s Sessions</h1>
        <p className="text-sm text-neutral-500">
          {sessionRows.length} session{sessionRows.length === 1 ? "" : "s"} ·{" "}
          {rm(totalToday)}
        </p>
      </div>

      {sessionRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
          No sessions yet today. Ring one up from the{" "}
          <a href="/" className="font-medium text-emerald-700 underline">
            Chair Board
          </a>
          .
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Chair</th>
                <th className="px-4 py-3 font-medium">Started</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {sessionRows.map((s) => {
                const sale = salesBySession.get(s.id);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-medium">
                      {chairById.get(s.chair_id)?.label ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600">
                      {timeOfDay(s.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          STATUS_BADGE[s.status] ?? "bg-neutral-100"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-neutral-600">
                      {sale ? sale.payment_method.replace("_", " ") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {sale ? rm(sale.total_amount) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
