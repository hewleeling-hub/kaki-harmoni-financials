# Test Plan

## Success Scenario — Full Walk-Through
1. Load `/` — four chair cards visible, all green (Free). No login prompt.
2. Tap **Chair 2**. Start Session sheet opens.
3. Select payment: **Cash**. Add extra: **Iced Lemon Tea**. Tap **Start Session**.
4. Chair 2 card turns amber (Running), shows 15:00 countdown. Other chairs unchanged.
5. Wait for 15 min (or manually set `spa_ends_at` to now() in DB for test speed).
6. Chair 2 card turns red (Resting), shows 30:00 countdown.
7. Wait 30 min (or adjust `rest_ends_at`). Chair 2 turns green (Free).
8. Go to `/sessions` — one row: Chair 2, today, RM47, Cash.
9. Go to `/reports` for today — inflow RM47, 1 session, Chair 2 occupancy > 0%.
10. Revenue split shows: Spa RM28, Coffee RM12, Extras RM7.
11. Verify DB: `sessions` has 1 row, `sales` has 1 row, `sale_items` has 3 rows.

## Empty States
- `/` on a day with no sessions → chairs all Free, no errors.
- `/sessions` before any sales today → "No sessions yet today" message.
- `/reports` for a future date → all zeros, no crash.
- `/expenses` with no entries → "No expenses recorded" with Add button visible.

## Error Cases
- Submit Start Session with no payment method selected → inline validation, form does not submit.
- API returns 500 → toast error, chair card stays Free (no phantom Running state).
- Offline sale → "Queued — will sync when online" message; no duplicate on reconnect.
- Enter expense with amount = 0 → validation rejects with "Amount must be greater than zero".

## Offline Test
1. Open `/` on tablet.
2. Enable Airplane Mode.
3. Tap Chair 1, submit RM40 cash bundle.
4. Chair 1 shows Running (optimistic). Banner: "Offline — sale queued".
5. Re-enable wifi.
6. Within 10 s: `sessions` row appears in Supabase dashboard. Banner clears.

## Permissions (Sprint 5)
- Staff login → GET `/reports` → 403 page shown.
- Owner login → GET `/reports` → data visible.
- Staff login → POST `/api/sessions/start` → 200 (allowed).
- Unauth → POST `/api/expenses` → 401.
