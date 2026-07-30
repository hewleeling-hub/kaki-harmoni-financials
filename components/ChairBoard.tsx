"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChairWithSession, Product } from "@/lib/types";
import { rm, timeOfDay } from "@/lib/format";
import { SPA_MINUTES, REST_MINUTES } from "@/lib/constants";
import { StartSessionSheet } from "./StartSessionSheet";
import { QuickSaleSheet } from "./QuickSaleSheet";
import { enqueue, flushQueue } from "@/lib/offlineQueue";

// Chairs enriched by /api/board with real today-so-far stats.
type BoardChair = ChairWithSession & {
  sessions_today?: number;
  revenue_today?: number;
};
type BoardData = { chairs: BoardChair[]; extras: Product[] };

const SPA_MS = SPA_MINUTES * 60_000;
const REST_MS = REST_MINUTES * 60_000;

// ── Brand + semantic palette (Kaki Harmoni design system) ──────────────────
const C = {
  brand: "#5E8F45",
  ink: "#1F2937",
  sub: "#6B7280",
  muted: "#9CA3AF",
  border: "#E5E7EB",
  available: "#16A34A",
  running: "#F59E0B",
  resting: "#2563EB",
  maintenance: "#DC2626",
};

// Visual config per status. `running`/`resting` are the two live occupied
// phases; `cleaning`/`maintenance` have no data workflow yet — they exist here
// only so the card renders correctly if that status is ever introduced.
type Phase = "free" | "running" | "resting" | "cleaning" | "maintenance";
const STATUS: Record<
  Phase,
  { label: string; color: string; tint: string; ring: string }
> = {
  free: { label: "Available", color: C.available, tint: "#ECFDF5", ring: "#A7F3D0" },
  running: { label: "In Session", color: C.running, tint: "#FFFBEB", ring: "#FDE68A" },
  resting: { label: "Resting", color: C.resting, tint: "#EFF6FF", ring: "#BFDBFE" },
  cleaning: { label: "Cleaning", color: "#2563EB", tint: "#EFF6FF", ring: "#BFDBFE" },
  maintenance: {
    label: "Under maintenance",
    color: C.maintenance,
    tint: "#FEF2F2",
    ring: "#FECACA",
  },
};

// Remaining time as MM:SS (or HH:MM:SS past an hour). Never negative.
function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Derive the *displayed* phase from the session timestamps so the UI is correct
// the instant a timer elapses, even before the server reconcile persists it.
function derive(
  chair: ChairWithSession,
  now: number,
): { phase: Phase; remaining: number; total: number } {
  const s = chair.session;
  if (!s || chair.status === "free")
    return { phase: "free", remaining: 0, total: 0 };
  const spaEnds = s.spa_ends_at ? new Date(s.spa_ends_at).getTime() : 0;
  const restEnds = s.rest_ends_at ? new Date(s.rest_ends_at).getTime() : 0;
  if (now >= restEnds) return { phase: "free", remaining: 0, total: 0 };
  if (now >= spaEnds)
    return { phase: "resting", remaining: restEnds - now, total: REST_MS };
  return { phase: "running", remaining: spaEnds - now, total: SPA_MS };
}

// ── Icons (inline, no dependency) ──────────────────────────────────────────
function Icon({ path, size = 18 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
const P = {
  chair: "M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M5 11h14M5 11a2 2 0 0 0-2 2v3h18v-3a2 2 0 0 0-2-2M6 19v-3m12 3v-3",
  check: "M20 6 9 17l-5-5",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  cart: "M6 6h15l-1.5 9h-12L5 3H2M6 20a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z",
  grid: "M4 5h16M4 12h16M4 19h16",
  shield: "M12 3l7 3v6c0 4-3 7-7 8-4-1-7-4-7-8V6l7-3Zm-2.5 8.5 2 2 4-4",
  cup: "M4 8h12v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm12 1h2a2 2 0 0 1 0 4h-2M6 3v2m4-2v2",
};

// ── Status pill (colour + dot + text — never colour alone) ─────────────────
function StatusBadge({ phase }: { phase: Phase }) {
  const s = STATUS[phase];
  const occupied = phase === "running" || phase === "resting";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: s.tint, color: s.color }}
    >
      <span
        className={`h-2 w-2 rounded-full ${occupied ? "motion-safe:animate-pulse" : ""}`}
        style={{ backgroundColor: s.color }}
      />
      {s.label}
    </span>
  );
}

// ── Live countdown for an occupied chair ───────────────────────────────────
function SessionCountdown({
  label,
  phase,
  remaining,
  total,
  freesAt,
}: {
  label: string;
  phase: Phase;
  remaining: number;
  total: number;
  freesAt: string | null;
}) {
  const s = STATUS[phase];
  const pct = total > 0 ? Math.min(100, Math.max(0, ((total - remaining) / total) * 100)) : 0;
  const warn = phase === "running" && remaining <= 5 * 60_000;

  // Coarse aria-live: announce only within the final 5 minutes, at most once a
  // minute — never per second. Empty otherwise.
  const mins = Math.ceil(remaining / 60_000);
  const announce = warn ? `${label}: about ${mins} minute${mins === 1 ? "" : "s"} of spa remaining` : "";

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className="font-bold tabular-nums leading-none"
          style={{
            fontSize: "clamp(2.5rem, 8vw, 3.25rem)",
            color: warn ? C.maintenance : s.color,
          }}
        >
          {fmtClock(remaining)}
        </span>
        <span className="text-sm font-medium" style={{ color: C.muted }}>
          remaining
        </span>
      </div>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: s.tint }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-label={`${phase === "running" ? "Spa" : "Rest"} progress for ${label}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-linear"
          style={{ width: `${pct}%`, backgroundColor: warn ? C.maintenance : s.color }}
        />
      </div>

      <p className="mt-2 text-sm" style={{ color: C.sub }}>
        {phase === "running" ? (
          <>Spa in progress{freesAt ? <> · frees at {freesAt}</> : null}</>
        ) : (
          <>Resting · frees automatically{freesAt ? <> at {freesAt}</> : null}</>
        )}
      </p>

      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </div>
  );
}

// ── One chair ──────────────────────────────────────────────────────────────
function ChairCard({
  chair,
  now,
  onStart,
}: {
  chair: BoardChair;
  now: number;
  onStart: (c: BoardChair) => void;
}) {
  const d = derive(chair, now);
  const s = STATUS[d.phase];
  const isFree = d.phase === "free";
  const freesAt = chair.session?.rest_ends_at
    ? timeOfDay(chair.session.rest_ends_at)
    : null;

  const Header = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: s.tint, color: s.color }}
        >
          <Icon path={P.chair} size={20} />
        </span>
        <span className="text-lg font-semibold" style={{ color: C.ink }}>
          {chair.label}
        </span>
      </div>
      <StatusBadge phase={d.phase} />
    </div>
  );

  const body = isFree ? (
    <div className="mt-5">
      <p
        className="flex items-center gap-2 text-sm font-medium"
        style={{ color: C.available }}
      >
        <Icon path={P.check} size={16} />
        Ready for next guest
      </p>
      <dl className="mt-3 space-y-1.5">
        <div className="flex justify-between text-sm">
          <dt style={{ color: C.sub }}>Sessions today</dt>
          <dd className="font-semibold tabular-nums" style={{ color: C.ink }}>
            {chair.sessions_today ?? 0}
          </dd>
        </div>
        <div className="flex justify-between text-sm">
          <dt style={{ color: C.sub }}>Revenue today</dt>
          <dd className="font-semibold tabular-nums" style={{ color: C.ink }}>
            {rm(chair.revenue_today ?? 0)}
          </dd>
        </div>
      </dl>
      <span
        className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold text-white"
        style={{ backgroundColor: C.available }}
      >
        <Icon path={P.chair} size={18} /> + Start Session
      </span>
    </div>
  ) : (
    <div className="mt-5">
      <SessionCountdown
        label={chair.label}
        phase={d.phase}
        remaining={d.remaining}
        total={d.total}
        freesAt={freesAt}
      />
    </div>
  );

  const base =
    "flex min-h-[13rem] w-full flex-col rounded-2xl border bg-white p-5 text-left transition";
  const style = {
    borderColor: s.ring,
    boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
  } as const;

  if (isFree) {
    return (
      <button
        onClick={() => onStart(chair)}
        aria-label={`Start a session on ${chair.label}`}
        className={`${base} cursor-pointer hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E8F45] focus-visible:ring-offset-2 active:scale-[0.99]`}
        style={style}
      >
        {Header}
        {body}
      </button>
    );
  }
  return (
    <div className={base} style={style}>
      {Header}
      {body}
    </div>
  );
}

// ── Header summary strip ───────────────────────────────────────────────────
function SummaryItem({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: number | string;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${color}14`, color }}
      >
        <Icon path={icon} size={18} />
      </span>
      <div>
        <div
          className="text-2xl font-bold leading-none tabular-nums"
          style={{ color: C.ink }}
        >
          {value}
        </div>
        <div className="mt-1 text-xs font-medium" style={{ color: C.sub }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function ChairSummary({ chairs, now }: { chairs: BoardChair[]; now: number }) {
  const counts = useMemo(() => {
    let available = 0;
    let inSession = 0;
    for (const c of chairs) {
      const p = derive(c, now).phase;
      if (p === "free") available++;
      else if (p === "running" || p === "resting") inSession++;
    }
    // No maintenance workflow in the data model yet → honestly 0.
    return { total: chairs.length, available, inSession, maintenance: 0 };
  }, [chairs, now]);

  return (
    <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:px-6"
      style={{ borderColor: C.border, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
    >
      <SummaryItem icon={P.grid} value={counts.total} label="Total Chairs" color={C.brand} />
      <SummaryItem icon={P.check} value={counts.available} label="Available" color={C.available} />
      <SummaryItem icon={P.clock} value={counts.inSession} label="In Session" color={C.running} />
      <SummaryItem icon={P.shield} value={counts.maintenance} label="Maintenance" color={C.maintenance} />
    </div>
  );
}

// ── Hygiene footer banner ──────────────────────────────────────────────────
function HygieneBanner() {
  return (
    <div
      className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:px-6"
      style={{ borderColor: C.border, boxShadow: "0 1px 2px rgba(16,24,40,0.04)" }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${C.brand}14`, color: C.brand }}
        >
          <Icon path={P.shield} size={20} />
        </span>
        <div>
          <p className="font-semibold" style={{ color: C.ink }}>
            Clean. Safe. Ready.
          </p>
          <p className="text-sm" style={{ color: C.sub }}>
            Every chair is sanitised after each session.
          </p>
        </div>
      </div>
      {/* No dedicated cleaning-log route exists; session history is the closest
          real destination, so the control links there honestly. */}
      <a
        href="/sessions"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 text-sm font-medium transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E8F45] focus-visible:ring-offset-2"
        style={{ borderColor: C.border, color: C.ink }}
      >
        View Session Log
        <Icon path="M9 6l6 6-6 6" size={16} />
      </a>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export function ChairBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<BoardChair | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [saleNote, setSaleNote] = useState<string | null>(null);
  const reconciledRef = useRef(false);

  // One board GET with a hard timeout so a hung request can't wedge the UI.
  async function fetchBoard(): Promise<BoardData> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch("/api/board", { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`Board failed (${res.status})`);
      return (await res.json()) as BoardData;
    } finally {
      clearTimeout(t);
    }
  }

  const load = useCallback(
    async (opts?: { reconcile?: boolean; retries?: number }) => {
      // Fire-and-forget: advancing timers must never block or fail the load.
      if (opts?.reconcile) {
        fetch("/api/sessions/reconcile", { method: "POST" }).catch(() => {});
      }
      const retries = opts?.retries ?? 0;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const json = await fetchBoard();
          setData(json);
          setError(null);
          return;
        } catch (e) {
          if (attempt === retries) {
            setError(e instanceof Error ? e.message : "Failed to load board");
          } else {
            await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          }
        }
      }
    },
    [],
  );

  // Initial load (with retries) + 5s poll to advance/reconcile timers server-side.
  useEffect(() => {
    load({ reconcile: true, retries: 3 });
    reconciledRef.current = true;
    const poll = setInterval(() => load({ reconcile: true }), 5000);
    return () => clearInterval(poll);
  }, [load]);

  // 1s tick for smooth countdowns (timestamp-derived, so refresh/idle safe).
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleStart(payload: {
    chair_id: string;
    payment_method: string;
    extras: string[];
  }) {
    const client_started_at = new Date().toISOString();
    // Optimistic: flip the card to running immediately.
    setData((dd) =>
      dd
        ? {
            ...dd,
            chairs: dd.chairs.map((c) =>
              c.id === payload.chair_id
                ? {
                    ...c,
                    status: "running",
                    session: {
                      id: "optimistic",
                      user_id: null,
                      created_at: client_started_at,
                      chair_id: c.id,
                      started_at: client_started_at,
                      spa_ends_at: new Date(Date.now() + SPA_MS).toISOString(),
                      rest_ends_at: new Date(
                        Date.now() + SPA_MS + REST_MS,
                      ).toISOString(),
                      status: "running",
                      notes: null,
                    },
                  }
                : c,
            ),
          }
        : dd,
    );
    setSelected(null);

    const body = { ...payload, client_started_at };
    try {
      const res = await fetch("/api/sessions/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("server");
      await load();
    } catch {
      // Offline / server unreachable — queue and let the banner sync it.
      enqueue({ client_id: `${payload.chair_id}-${client_started_at}`, body });
      flushQueue();
    }
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-medium">Couldn&apos;t load the chair board.</p>
        <p className="text-sm">{error}</p>
        <button
          onClick={() => {
            setError(null);
            load({ reconcile: true, retries: 3 });
          }}
          className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight sm:text-[36px]"
            style={{ color: C.ink }}
          >
            Chair Board
          </h1>
          <p className="mt-1 text-sm sm:text-base" style={{ color: C.sub }}>
            Real-time overview of all foot wellness chairs.
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <button
            onClick={() => setQuickOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5E8F45] focus-visible:ring-offset-2"
            style={{ backgroundColor: C.brand }}
          >
            <Icon path={P.cart} size={16} /> + Quick Sale
          </button>
          <span className="text-xs" style={{ color: C.muted }}>
            Tap an available chair to begin a new session.
          </span>
        </div>
      </div>

      {saleNote && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
          {saleNote}
        </div>
      )}

      {!data ? (
        <>
          <div
            className="mb-6 h-20 animate-pulse rounded-2xl border bg-white"
            style={{ borderColor: C.border }}
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-52 animate-pulse rounded-2xl border"
                style={{ borderColor: C.border, backgroundColor: "#fff" }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mb-6">
            <ChairSummary chairs={data.chairs} now={now} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {data.chairs.map((chair) => (
              <ChairCard
                key={chair.id}
                chair={chair}
                now={now}
                onStart={setSelected}
              />
            ))}
          </div>

          <HygieneBanner />
        </>
      )}

      {selected && data && (
        <StartSessionSheet
          chair={selected}
          extras={data.extras}
          onClose={() => setSelected(null)}
          onSubmit={handleStart}
        />
      )}

      {quickOpen && (
        <QuickSaleSheet
          onClose={() => setQuickOpen(false)}
          onDone={() => {
            setQuickOpen(false);
            setSaleNote("Quick sale recorded — it's in today's Report.");
            setTimeout(() => setSaleNote(null), 5000);
          }}
        />
      )}
    </div>
  );
}
