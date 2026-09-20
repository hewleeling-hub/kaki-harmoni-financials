-- Spreading a prepaid subscription over the months it covers.
--
-- A subscription paid up front isn't spent on the day it's bought — it buys
-- coverage for a term. So the purchase debits a prepaid asset (1350 Prepaid
-- Software Subscriptions, or 1340 for a domain), and each month a slice of it
-- moves to the P&L:
--
--   Dr  6440 Software and SaaS Subscriptions   one month's share
--       Cr  1350 Prepaid Software Subscriptions             one month's share
--
-- Run every month, the prepaid balance walks down to exactly zero on the last
-- month of the term. Without this the three-year StoreHub subscription sits on
-- the balance sheet as an asset for three years and the P&L never sees it.

-- Where a subscription's monthly charge lands. Chosen once per subscription:
-- software goes to 6440, a domain to 6510, hosting to 6520.
alter table expenses
  add column if not exists amortisation_account text;

-- One row per subscription per month charged. The unique index is what makes
-- running a month twice harmless — the second run has nothing left to charge.
create table if not exists subscription_charges (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  -- First day of the calendar month being charged.
  period date not null,
  amount numeric not null check (amount >= 0),
  expense_account text not null,
  journal_id uuid references journals(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists subscription_charges_period_key
  on subscription_charges (expense_id, period);

create index if not exists subscription_charges_journal_idx
  on subscription_charges (journal_id);

alter table subscription_charges enable row level security;

drop policy if exists "subscription_charges_v1_read" on subscription_charges;
create policy "subscription_charges_v1_read" on subscription_charges for select using (true);
drop policy if exists "subscription_charges_v1_write" on subscription_charges;
create policy "subscription_charges_v1_write" on subscription_charges for all using (true) with check (true);
