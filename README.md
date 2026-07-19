# Kaki Harmoni Financials

Tablet-first counter POS + bookkeeping for a 4-chair foot-spa café. Staff ring up
chair sessions, the RM40 bundle auto-splits into spa + coffee revenue, expenses and
reimbursements are captured, and the owner closes the day with a cashflow report.

See [`docs/`](docs) for the full plan (PRD, architecture, data model, sprints, test plan).

## The core job

1. **Chair board** (`/`) — four chairs with live status (Free / Running / Resting) and countdowns.
2. Tap a free chair → pick payment + extras → **Start Session**. This writes a `session`,
   a `sale`, and the bundle-split `sale_items` (RM28 spa + RM12 coffee), and flips the chair to
   Running with a 15-min timer.
3. The state machine auto-advances Running → Resting (15 min) → Free (45 min) via
   `/api/sessions/reconcile`.
4. **Expenses** (`/expenses`) capture cost, payer, and type; personal/staff-card payers
   auto-draft a **reimbursement**.
5. **Report** (`/reports`) gives inflow / outflow / net, session count, spa·coffee·extras
   split with margin, and a chair-occupancy grid for any date.

Offline-resilient: sales queue in the browser when wifi drops and flush on reconnect.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript |
| Styles | Tailwind CSS v4 |
| DB | Supabase (Postgres + RLS) |
| Deploy | Vercel (Git-connected — pushes to `main` auto-deploy) |

## Local development

```bash
npm install          # or: bun install
vercel env pull .env.local   # pull Supabase keys from the Vercel project
npm run dev
```

Open http://localhost:3000.

## Database

Schema + seed live in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
and are already applied to the project's Supabase database. To change the schema, add a new
migration file (`0002_*.sql`) — never edit `0001`. v1 uses permissive RLS (demo-first, no login
wall); per-user lockdown is the auth sprint.

## Conventions

See [CLAUDE.md](CLAUDE.md).
