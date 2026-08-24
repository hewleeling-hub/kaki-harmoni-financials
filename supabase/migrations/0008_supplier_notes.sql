-- Supplier-side debit and credit notes.
--
--   DN-0001…  debit note  — we claim money back from a supplier
--                           (goods returned, overcharged, faulty)
--   CN-0001…  credit note — the supplier grants us a reduction
--
-- Each note usually adjusts a purchase (its PO), so the paper trail runs
-- PO → DN/CN. Two independent running series, matching PO/PV numbering.

create sequence if not exists supplier_debit_note_seq;
create sequence if not exists supplier_credit_note_seq;

create table if not exists supplier_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  created_at timestamptz not null default now(),
  note_number text unique,
  note_type text not null check (note_type in ('debit', 'credit')),
  note_date date not null default current_date,
  -- The purchase being adjusted. Nullable so a note can stand alone when the
  -- original purchase predates the system; set null rather than cascade-delete
  -- so removing a purchase never silently destroys an issued document.
  expense_id uuid references expenses(id) on delete set null,
  vendor text not null,
  amount numeric not null check (amount >= 0),
  reason text,
  description text,
  -- 'open'   = raised, not yet applied
  -- 'applied'= supplier has credited us / the adjustment has landed
  status text not null default 'open' check (status in ('open', 'applied')),
  applied_at timestamptz
);

create index if not exists supplier_notes_expense_idx on supplier_notes (expense_id);
create index if not exists supplier_notes_type_idx on supplier_notes (note_type);

-- A column default can't branch on note_type, so the number is stamped by a
-- trigger. That way every insert gets one no matter which path writes the row.
create or replace function assign_supplier_note_number()
returns trigger
language plpgsql
as $$
begin
  if new.note_number is null then
    if new.note_type = 'debit' then
      new.note_number := 'DN-' || lpad(nextval('supplier_debit_note_seq')::text, 4, '0');
    else
      new.note_number := 'CN-' || lpad(nextval('supplier_credit_note_seq')::text, 4, '0');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists supplier_notes_number on supplier_notes;
create trigger supplier_notes_number
  before insert on supplier_notes
  for each row execute function assign_supplier_note_number();

-- v1 permissive RLS, matching the other tables in this schema.
alter table supplier_notes enable row level security;

drop policy if exists "supplier_notes_v1_read" on supplier_notes;
create policy "supplier_notes_v1_read" on supplier_notes for select using (true);

drop policy if exists "supplier_notes_v1_write" on supplier_notes;
create policy "supplier_notes_v1_write" on supplier_notes for all using (true) with check (true);
