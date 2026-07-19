# Tasks & Sprints

## Sprint 1 — Database + Chair Engine ✦ core verb ✦
**Goal:** Tap a chair, ring up a sale, watch the state machine run. App is live and demoable without login.
- [ ] Apply migration SQL to Supabase (chairs, products, sessions, sales, sale_items, expenses, reimbursements + seed data)
- [ ] `/` — Chair board: 4 cards, status colour (green/amber/red), countdown timer from `spa_ends_at` / `rest_ends_at`
- [ ] "Start Session" bottom sheet: payment method selector (cash / e-wallet / bank transfer), extras multi-select
- [ ] POST `/api/sessions/start`: insert session, sale, 2 bundle sale_items, update chair status
- [ ] Client-side state machine: poll or Realtime → advance Running→Resting→Free at computed timestamps
- [ ] `/sessions` — today's session list (chair, started_at, total, payment method)
- [ ] Loading / empty / error states on chair board

**Definition of Done:** Tap Chair 3, submit cash bundle, see Running countdown; after 15 min Resting; after 30 min Free. Row in DB. Refreshing page shows correct state. No login required.

---

## Sprint 2 — Extras, Product Catalogue & Expenses
**Goal:** Full product control and cost capture.
- [ ] `/products` — CRUD for products (name, category, cost_price, standalone_price, bundle_allocation)
- [ ] Extras picker in Start Session sheet pulls from active products where bundle_allocation = 0
- [ ] `/expenses/new` — form: amount, vendor, description, date, category, payer, expense_type
- [ ] On save: if payer ∈ {personal, staff_card} → auto-draft reimbursement confirmation banner
- [ ] `/expenses` — list, filterable by payer and expense_type
- [ ] `/reimbursements` — list of outstanding amounts with "Mark Settled" button

**Definition of Done:** Save expense with payer=personal → reimbursement row in DB, appears in list. Add Foot Scrub extra to session → sale_items row exists, session total = RM55.

---

## Sprint 3 — End-of-Day Reports ✦ v1 functional milestone ✦
**Goal:** Owner can close the day knowing exactly what happened.
- [ ] `/reports` — date-picker defaulting to today
- [ ] Inflow: sum of sales.total_amount for date
- [ ] Outflow: sum of expenses.amount for date
- [ ] Net cashflow = inflow − outflow; colour-coded
- [ ] Session count and average revenue per session
- [ ] Revenue split table: spa total / coffee total / extras total with margin %
- [ ] Chair occupancy grid: hours 10–20 × 4 chairs, % of each hour a chair was in Running state
- [ ] Outstanding reimbursements summary

**Definition of Done:** Run 3 demo sessions via the chair board + add 1 expense. Open `/reports` for today. All totals match DB sums. Occupancy grid shows non-zero for chairs used. Page renders correctly with zero data (empty state).

---

## Sprint 4 — Offline Resilience & Tablet Polish
**Goal:** Sales never fail because the wifi dropped.
- [ ] Service worker caches `/`, `/api/sessions/start`, sale form assets
- [ ] IndexedDB queue: on POST failure → store payload; on reconnect → flush in order
- [ ] "Offline — sales queued" banner visible when `navigator.onLine = false`
- [ ] Optimistic chair card update on submit (no waiting for server response)
- [ ] Touch targets ≥ 48 px; high-contrast status colours; large readable type for counter use
- [ ] Test: disable wifi → ring up sale → re-enable → confirm row in DB and report updates

**Definition of Done:** Airplane-mode sale completes without error shown to staff. On reconnect the session row and sale row appear in DB within 10 seconds.

---

## Sprint 5 — Lock It Down (Auth + Roles)
**Goal:** Real user data is protected before the first real customer pays.
- [ ] Supabase Auth: owner account creation, staff PIN accounts
- [ ] Replace v1 permissive RLS with `auth.uid() = user_id` write policies on expenses, reimbursements
- [ ] Staff role claim: can access `/` and `/sessions` only
- [ ] Owner role claim: full access including `/reports`, `/expenses`, `/products`
- [ ] Middleware: redirect unauthenticated to `/login` (chair board can remain public until owner toggles)
- [ ] Assign `user_id` on all new rows from `auth.uid()`

**Definition of Done:** Log in as staff → `/reports` returns 403. Log in as owner → all pages load. Anon visit → redirected to login. Existing seed data unaffected.

---

## Gantt (sprint → calendar week)
```
Week 1: Sprint 1 (Chair Engine)
Week 1: Sprint 2 (Expenses)
Week 2: Sprint 3 (Reports) ← v1 functional
Week 2: Sprint 4 (Offline)
Week 3: Sprint 5 (Lock It Down)
```
