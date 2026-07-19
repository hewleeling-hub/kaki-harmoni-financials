# Architecture

## Stack
- **Frontend:** Next.js 14 (App Router) — tablet-optimised UI
- **Database:** Supabase (Postgres + RLS)
- **Hosting:** Vercel
- **Realtime:** Supabase Realtime subscriptions for chair status updates across devices
- **Offline:** Service Worker + IndexedDB queue; syncs POST requests on reconnect

## Key User Action — Flow
1. Staff taps a Free chair card on the board.
2. A sheet opens: payment method selector, extras picker.
3. On submit, the app writes optimistically (chair card → Running) then POSTs to `/api/sessions/start`.
4. Server inserts `sessions` row, `sales` row, two `sale_items` rows (bundle split), updates `chairs.status = running`.
5. A Supabase Realtime event pushes the chair state change to all connected tablets.
6. A client-side countdown (derived from `spa_ends_at`) displays the timer; at expiry the app patches chair to Resting, then at `rest_ends_at` to Free.
7. If offline: the POST is queued in IndexedDB; on reconnect the queue flushes in order and the chair board reconciles.

## Layer Plan
1. **Data first** — tables, constraints, seed data, permissive RLS (now)
2. **Core engine** — session start/end state machine, bundle split logic, expense entry (Sprint 1–2)
3. **Reports** — aggregation queries for daily cashflow and occupancy (Sprint 3)
4. **Resilience** — offline queue, optimistic UI (Sprint 4)
5. **Smart features** — AI expense categorisation, margin commentary (later)
6. **Auth & lockdown** — per-user RLS, staff vs owner roles (Sprint 5)

## Why the Core Runs Without AI
The chair timer, bundle split (fixed RM28/RM12), expense payer logic, and cashflow totals are all deterministic database queries and server functions. AI is additive only — removing it leaves a fully working POS and bookkeeping tool.
