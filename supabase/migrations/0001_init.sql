create table if not exists chairs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  label text not null,
  status text not null default 'free',
  current_session_id uuid
);

alter table chairs enable row level security;
drop policy if exists "chairs_v1_read" on chairs;
create policy "chairs_v1_read" on chairs for select using (true);
drop policy if exists "chairs_v1_write" on chairs;
create policy "chairs_v1_write" on chairs for all using (true) with check (true);

insert into chairs (id, label, status) values
  ('11111111-0000-0000-0000-000000000001', 'Chair 1', 'free'),
  ('11111111-0000-0000-0000-000000000002', 'Chair 2', 'free'),
  ('11111111-0000-0000-0000-000000000003', 'Chair 3', 'free'),
  ('11111111-0000-0000-0000-000000000004', 'Chair 4', 'free')
on conflict (id) do nothing;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  name text not null,
  category text not null,
  cost_price numeric(10,2) not null default 0,
  standalone_price numeric(10,2) not null default 0,
  bundle_allocation numeric(10,2) not null default 0,
  is_active boolean not null default true
);

alter table products enable row level security;
drop policy if exists "products_v1_read" on products;
create policy "products_v1_read" on products for select using (true);
drop policy if exists "products_v1_write" on products;
create policy "products_v1_write" on products for all using (true) with check (true);

insert into products (id, name, category, cost_price, standalone_price, bundle_allocation) values
  ('22222222-0000-0000-0000-000000000001', 'Foot Spa Session', 'spa', 10.00, 35.00, 28.00),
  ('22222222-0000-0000-0000-000000000002', 'House Coffee', 'coffee', 3.50, 8.00, 12.00),
  ('22222222-0000-0000-0000-000000000003', 'Iced Lemon Tea', 'food', 2.00, 7.00, 0),
  ('22222222-0000-0000-0000-000000000004', 'Foot Scrub Add-on', 'spa', 5.00, 15.00, 0),
  ('22222222-0000-0000-0000-000000000005', 'Mineral Water', 'food', 1.00, 3.00, 0)
on conflict (id) do nothing;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  chair_id uuid not null,
  started_at timestamptz not null default now(),
  spa_ends_at timestamptz,
  rest_ends_at timestamptz,
  status text not null default 'running',
  notes text
);

alter table sessions enable row level security;
drop policy if exists "sessions_v1_read" on sessions;
create policy "sessions_v1_read" on sessions for select using (true);
drop policy if exists "sessions_v1_write" on sessions;
create policy "sessions_v1_write" on sessions for all using (true) with check (true);

create table if not exists sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  session_id uuid,
  sale_date date not null default current_date,
  payment_method text not null default 'cash',
  total_amount numeric(10,2) not null default 0,
  is_bundle boolean not null default true,
  notes text
);

alter table sales enable row level security;
drop policy if exists "sales_v1_read" on sales;
create policy "sales_v1_read" on sales for select using (true);
drop policy if exists "sales_v1_write" on sales;
create policy "sales_v1_write" on sales for all using (true) with check (true);

create table if not exists sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  sale_id uuid not null,
  product_id uuid not null,
  quantity int not null default 1,
  unit_price numeric(10,2) not null,
  unit_cost numeric(10,2) not null default 0,
  is_bundle_split boolean not null default false
);

alter table sale_items enable row level security;
drop policy if exists "sale_items_v1_read" on sale_items;
create policy "sale_items_v1_read" on sale_items for select using (true);
drop policy if exists "sale_items_v1_write" on sale_items;
create policy "sale_items_v1_write" on sale_items for all using (true) with check (true);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  expense_date date not null default current_date,
  vendor text not null,
  description text,
  amount numeric(10,2) not null,
  category text not null,
  payer text not null default 'company',
  expense_type text not null default 'expense',
  is_settled boolean not null default false,
  receipt_url text,
  ai_category text,
  ai_category_source text,
  ai_category_confidence numeric,
  ai_category_review_status text default 'unreviewed'
);

alter table expenses enable row level security;
drop policy if exists "expenses_v1_read" on expenses;
create policy "expenses_v1_read" on expenses for select using (true);
drop policy if exists "expenses_v1_write" on expenses;
create policy "expenses_v1_write" on expenses for all using (true) with check (true);

create table if not exists reimbursements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  expense_id uuid not null,
  owed_to text not null,
  amount numeric(10,2) not null,
  is_settled boolean not null default false,
  settled_at timestamptz
);

alter table reimbursements enable row level security;
drop policy if exists "reimbursements_v1_read" on reimbursements;
create policy "reimbursements_v1_read" on reimbursements for select using (true);
drop policy if exists "reimbursements_v1_write" on reimbursements;
create policy "reimbursements_v1_write" on reimbursements for all using (true) with check (true);

insert into sessions (id, chair_id, started_at, spa_ends_at, rest_ends_at, status) values
  ('33333333-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', now() - interval '3 hours', now() - interval '3 hours' + interval '15 minutes', now() - interval '3 hours' + interval '45 minutes', 'completed'),
  ('33333333-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000002', now() - interval '2 hours', now() - interval '2 hours' + interval '15 minutes', now() - interval '2 hours' + interval '45 minutes', 'completed'),
  ('33333333-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000003', now() - interval '1 hour', now() - interval '1 hour' + interval '15 minutes', now() - interval '1 hour' + interval '45 minutes', 'completed')
on conflict (id) do nothing;

insert into sales (id, session_id, sale_date, payment_method, total_amount, is_bundle) values
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000001', current_date, 'cash', 40.00, true),
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000002', current_date, 'ewallet', 40.00, true),
  ('44444444-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000003', current_date, 'cash', 55.00, true)
on conflict (id) do nothing;

insert into sale_items (sale_id, product_id, quantity, unit_price, unit_cost, is_bundle_split) values
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 1, 28.00, 10.00, true),
  ('44444444-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002', 1, 12.00, 3.50, true),
  ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 1, 28.00, 10.00, true),
  ('44444444-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000002', 1, 12.00, 3.50, true),
  ('44444444-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000001', 1, 28.00, 10.00, true),
  ('44444444-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', 1, 12.00, 3.50, true),
  ('44444444-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000004', 1, 15.00, 5.00, false)
on conflict do nothing;

insert into expenses (id, expense_date, vendor, description, amount, category, payer, expense_type) values
  ('55555555-0000-0000-0000-000000000001', current_date, 'Eco Clean Supply', 'Towels and disinfectant', 85.00, 'supplies', 'company', 'expense'),
  ('55555555-0000-0000-0000-000000000002', current_date, 'Kedai Kopi Ah Seng', 'Coffee beans monthly stock', 120.00, 'cost_of_goods', 'personal', 'expense'),
  ('55555555-0000-0000-0000-000000000003', current_date - 1, 'Sunway Hardware', 'Foot spa machine repair kit', 250.00, 'maintenance', 'petty_cash', 'expense')
on conflict (id) do nothing;

insert into reimbursements (expense_id, owed_to, amount, is_settled) values
  ('55555555-0000-0000-0000-000000000002', 'Owner (personal)', 120.00, false)
on conflict do nothing;