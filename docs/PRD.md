# Kaki Harmoni Financials — Product Requirements

## Problem
A 4-chair foot-spa café runs on paper: staff write sales on slips, the owner manually totals cash at night, and there is no way to see which product (spa vs coffee) is actually profitable or how full the chairs were.

## Target Users
- **Counter staff (1–2):** tablet at the counter, ring up sessions, must learn in 10 minutes.
- **Owner:** laptop in the evening, enter costs, read reports.

## Core Objects
| Object | What it is |
|---|---|
| Chair | One of 4 physical chairs; states: Free / Running / Resting |
| Session | A single customer occupancy of one chair (15 min spa + 30 min rest) |
| Sale | Revenue event tied to a session; carries payment method |
| Sale Item | One product line inside a sale (bundle split or extra) |
| Product | Spa session, house coffee, extras — each with cost price + bundle allocation |
| Expense | Any money out — vendor, payer, type (expense/asset) |
| Reimbursement | Amount owed back when payer = personal or staff card |

## MVP Must-Haves
- [ ] Chair board: 4 cards showing real-time status + countdown
- [ ] Tap free chair → ring up RM40 bundle → chair starts 15-min timer → auto-rests 30 min → auto-frees
- [ ] Bundle auto-split: RM28 spa / RM12 coffee written as separate sale items
- [ ] Add extras (food, retail) to a session
- [ ] Record payment method (cash, e-wallet, bank transfer)
- [ ] Expense entry with payer enum and expense/asset toggle
- [ ] Auto-create reimbursement record when payer ≠ company
- [ ] End-of-day report: inflow, outflow, net cashflow, session count, chair occupancy %
- [ ] Works offline — queued sales sync on reconnect

## Non-Goals (v1)
Card/QR terminal integration, online booking, LHDN e-Invoice, payroll, stock alerts, loyalty, multi-outlet, accounting software sync.

## Definition of Done
**Success scenario:** A staff member taps Chair 2 (Free), submits the RM40 bundle paid by cash, adds one Iced Lemon Tea (RM7). Chair 2 shows Running with 15-min countdown. After 15 min it shows Resting. After 30 min it shows Free. The owner opens the end-of-day report and sees: 1 session, RM47 inflow, correct spa/coffee/food split, Chair 2 occupancy counted. All rows exist in the database and survive a page refresh.
