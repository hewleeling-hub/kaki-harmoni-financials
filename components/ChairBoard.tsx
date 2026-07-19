"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChairWithSession, Product } from "@/lib/types";
import { countdown } from "@/lib/format";
import { SPA_MINUTES, REST_MINUTES } from "@/lib/constants";
import { StartSessionSheet } from "./StartSessionSheet";
import { enqueue, flushQueue } from "@/lib/offlineQueue";

type BoardData = { chairs: ChairWithSession[]; extras: Product[] };

// Derive the *displayed* state from the session timestamps so the UI is correct
// the instant a timer elapses, even before the server reconcile persists it.
function derive(chair: ChairWithSession, now: number) {
  const s = chair.session;
  if (!s || chair.status === "free") {
    return { phase: "free" as const, label: "Free", remaining: 0 };
  }
  const spaEnds = s.spa_ends_at ? new Date(s.spa_ends_at).getTime() : 0;
  const restEnds = s.rest_ends_at ? new Date(s.rest_ends_at).getTime() : 0;
  if (now >= restEnds) return { phase: "free" as const, label: "Free", remaining: 0 };
  if (now >= spaEnds)
    return { phase: "resting" as const, label: "Resting", remaining: restEnds - now };
  return { phase: "running" as const, label: "Running", remaining: spaEnds - now };
}

const PHASE_STYLE: Record<string, string> = {
  free: "border-emerald-300 bg-emerald-50",
  running: "border-amber-300 bg-amber-50",
  resting: "border-red-300 bg-red-50",
};
const DOT_STYLE: Record<string, string> = {
  free: "bg-emerald-500",
  running: "bg-amber-500",
  resting: "bg-red-500",
};

export function ChairBoard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [selected, setSelected] = useState<ChairWithSession | null>(null);
  const reconciledRef = useRef(false);

  // One board GET with a hard timeout so a hung request can't wedge the UI.
  async function fetchBoard(): Promise<BoardData> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch("/api/board", {
        cache: "no-store",
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`Board failed (${res.status})`);
      return (await res.json()) as BoardData;
    } finally {
      clearTimeout(t);
    }
  }

  const load = useCallback(async (opts?: { reconcile?: boolean; retries?: number }) => {
    // Fire-and-forget: advancing timers must never block or fail the board load.
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
        // Only surface an error once retries are exhausted. A later poll (or the
        // Retry button) still recovers on its own if data eventually arrives.
        if (attempt === retries) {
          setError(e instanceof Error ? e.message : "Failed to load board");
        } else {
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    }
  }, []);

  // Initial load (with retries so a cold-start hiccup doesn't dump to the error
  // screen) + poll every 5s to advance timers server-side and reconcile the board.
  useEffect(() => {
    load({ reconcile: true, retries: 3 });
    reconciledRef.current = true;
    const poll = setInterval(() => load({ reconcile: true }), 5000);
    return () => clearInterval(poll);
  }, [load]);

  // 1s tick for smooth countdowns.
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
    // Optimistic: flip the card to running immediately (Sprint 4).
    setData((d) =>
      d
        ? {
            ...d,
            chairs: d.chairs.map((c) =>
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
                      spa_ends_at: new Date(
                        Date.now() + SPA_MINUTES * 60_000,
                      ).toISOString(),
                      rest_ends_at: new Date(
                        Date.now() + (SPA_MINUTES + REST_MINUTES) * 60_000,
                      ).toISOString(),
                      status: "running",
                      notes: null,
                    },
                  }
                : c,
            ),
          }
        : d,
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
      enqueue({
        client_id: `${payload.chair_id}-${client_started_at}`,
        body,
      });
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

  if (!data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Chair Board</h1>
        <p className="text-sm text-neutral-500">
          Tap a free chair to ring up a bundle
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.chairs.map((chair) => {
          const d = derive(chair, now);
          const isFree = d.phase === "free";
          return (
            <button
              key={chair.id}
              disabled={!isFree}
              onClick={() => isFree && setSelected(chair)}
              className={`flex min-h-[11rem] flex-col justify-between rounded-2xl border-2 p-5 text-left transition ${
                PHASE_STYLE[d.phase]
              } ${isFree ? "hover:shadow-md active:scale-[0.99] cursor-pointer" : "cursor-default"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{chair.label}</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={`h-3 w-3 rounded-full ${DOT_STYLE[d.phase]}`}
                  />
                  {d.label}
                </span>
              </div>

              {isFree ? (
                <div className="mt-6">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white">
                    + Start Session
                  </span>
                </div>
              ) : (
                <div className="mt-6">
                  <div className="font-mono text-4xl font-bold tabular-nums">
                    {countdown(d.remaining)}
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">
                    {d.phase === "running"
                      ? "Spa in progress"
                      : "Resting — frees automatically"}
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <StartSessionSheet
          chair={selected}
          extras={data.extras}
          onClose={() => setSelected(null)}
          onSubmit={handleStart}
        />
      )}
    </div>
  );
}
