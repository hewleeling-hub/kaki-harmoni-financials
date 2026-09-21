-- Depreciating a fixed asset over its useful life.
--
-- An asset isn't spent the day it's bought: it earns its keep over years, so
-- its cost is charged to the P&L across those years rather than all at once.
--
--   Dr  6830 Depreciation - Café Equipment        one month's share
--       Cr  1630 Accumulated Depreciation - Café Equipment   one month's share
--
-- The asset account keeps the original cost and the accumulated account carries
-- what has been written off, so the balance sheet can show both, and cost minus
-- accumulated is the net book value.

-- Useful life in months, from `depreciation_start`. Null means not set yet, and
-- nothing is charged until it is: a guessed life misstates the P&L every month.
alter table expenses
  add column if not exists depreciation_months integer,
  -- When the asset was put to use. Usually the purchase date, but a fit-out
  -- bought in April and used from June starts in June.
  add column if not exists depreciation_start date,
  -- What it's expected to be worth at the end. Almost always zero here; the
  -- charge spreads cost minus residual.
  add column if not exists residual_value numeric not null default 0,
  -- The two sides of the monthly entry, remembered once chosen.
  add column if not exists depreciation_account text,
  add column if not exists accumulated_account text;

alter table expenses
  add constraint expenses_residual_nonneg check (residual_value >= 0) not valid;

-- One row per asset per month charged. The unique index is what makes running a
-- month twice harmless — the second run has nothing left to charge.
create table if not exists depreciation_charges (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  -- First day of the calendar month being charged.
  period date not null,
  amount numeric not null check (amount >= 0),
  expense_account text not null,
  accumulated_account text not null,
  journal_id uuid references journals(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists depreciation_charges_period_key
  on depreciation_charges (expense_id, period);

create index if not exists depreciation_charges_journal_idx
  on depreciation_charges (journal_id);

alter table depreciation_charges enable row level security;

drop policy if exists "depreciation_charges_v1_read" on depreciation_charges;
create policy "depreciation_charges_v1_read" on depreciation_charges for select using (true);
drop policy if exists "depreciation_charges_v1_write" on depreciation_charges;
create policy "depreciation_charges_v1_write" on depreciation_charges for all using (true) with check (true);
