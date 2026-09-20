-- Monthly stock take — the periodic inventory method.
--
--   opening stock  +  purchases in the period  −  closing count  =  consumed
--
-- Stock purchases debit inventory (1210–1280) and sit there until a stock take
-- says how much was actually used. The take posts the consumed figure to cost
-- of goods, which is what stops inventory growing forever and the P&L
-- understating what the month really cost.
--
-- Only the closing count is stored. Opening and purchases are derived — opening
-- from the previous take, purchases from the expenses themselves — so the
-- arithmetic can never drift out of step with the underlying records.

create table if not exists stock_takes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  -- The day the count was taken; normally the last day of the month.
  take_date date not null,
  notes text,
  -- Set once the take has been posted. Null means counted but not yet charged.
  journal_id uuid references journals(id) on delete set null,
  posted_at timestamptz
);

-- One take per date: two counts of the same day would double-charge.
create unique index if not exists stock_takes_take_date_key
  on stock_takes (take_date);

create table if not exists stock_take_lines (
  id uuid primary key default gen_random_uuid(),
  stock_take_id uuid not null references stock_takes(id) on delete cascade,
  -- Matches the stock class on a purchase (lib/constants STOCK_CATEGORIES).
  stock_class text not null,
  -- Value of what was physically left at the count.
  closing_value numeric not null default 0 check (closing_value >= 0),
  -- Cost-of-goods account this class was charged to. Recorded at posting time
  -- because two classes are genuinely ambiguous (essential oils used in
  -- services vs sold; operating consumables as cost of sales vs overhead).
  cogs_account text,
  created_at timestamptz not null default now()
);

create index if not exists stock_take_lines_take_idx
  on stock_take_lines (stock_take_id);

-- One line per class per take.
create unique index if not exists stock_take_lines_class_key
  on stock_take_lines (stock_take_id, stock_class);

alter table stock_takes enable row level security;
alter table stock_take_lines enable row level security;

drop policy if exists "stock_takes_v1_read" on stock_takes;
create policy "stock_takes_v1_read" on stock_takes for select using (true);
drop policy if exists "stock_takes_v1_write" on stock_takes;
create policy "stock_takes_v1_write" on stock_takes for all using (true) with check (true);

drop policy if exists "stock_take_lines_v1_read" on stock_take_lines;
create policy "stock_take_lines_v1_read" on stock_take_lines for select using (true);
drop policy if exists "stock_take_lines_v1_write" on stock_take_lines;
create policy "stock_take_lines_v1_write" on stock_take_lines for all using (true) with check (true);
