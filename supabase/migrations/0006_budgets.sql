-- 0006_budgets.sql
-- Budget vs Actual. One monthly budget figure per postable account per fiscal
-- year; actuals come from the ledger (0005). A period view multiplies the
-- monthly budget by the months in range and compares to posted journals.

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  account_code text not null references accounts(code),
  fiscal_year integer not null,
  amount numeric(14,2) not null default 0, -- monthly budget (RM)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_code, fiscal_year)
);

create index if not exists budgets_year_idx on budgets (fiscal_year);
create index if not exists budgets_account_idx on budgets (account_code);

alter table budgets enable row level security;
drop policy if exists "budgets_v1_read" on budgets;
create policy "budgets_v1_read" on budgets for select using (true);
drop policy if exists "budgets_v1_write" on budgets;
create policy "budgets_v1_write" on budgets for all using (true) with check (true);
