-- 0005_ledger.sql
-- Double-entry general ledger on top of the Chart of Accounts (0004).
-- A journal is a balanced set of lines (total debits = total credits); each
-- line posts to one active, postable leaf account. Balance enforcement lives in
-- the API (the only writer); the DB guarantees each line uses exactly one side.

create table if not exists journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  entry_date date not null default current_date,
  memo text,
  reference text,
  source text not null default 'manual', -- manual | reversal | sale | expense | adjustment
  reverses uuid references journals(id),   -- this entry reverses that one
  reversed_by uuid references journals(id),-- that entry reversed this one
  created_at timestamptz not null default now()
);

create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references journals(id) on delete cascade,
  line_no integer not null default 1,
  account_code text not null references accounts(code),
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  memo text,
  constraint jl_nonneg check (debit >= 0 and credit >= 0),
  constraint jl_one_side check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create index if not exists journal_lines_journal_idx on journal_lines (journal_id);
create index if not exists journal_lines_account_idx on journal_lines (account_code);
create index if not exists journals_date_idx on journals (entry_date);

alter table journals enable row level security;
drop policy if exists "journals_v1_read" on journals;
create policy "journals_v1_read" on journals for select using (true);
drop policy if exists "journals_v1_write" on journals;
create policy "journals_v1_write" on journals for all using (true) with check (true);

alter table journal_lines enable row level security;
drop policy if exists "journal_lines_v1_read" on journal_lines;
create policy "journal_lines_v1_read" on journal_lines for select using (true);
drop policy if exists "journal_lines_v1_write" on journal_lines;
create policy "journal_lines_v1_write" on journal_lines for all using (true) with check (true);
