-- Petty cash paid straight out of the tin.
--
-- Until now a PV number only existed on `reimbursements` — money owed back to
-- someone who fronted it. But the most literal petty cash voucher is cash
-- handed over on the spot (wages, a taxi, a small purchase): nobody is
-- reimbursed, so no reimbursement row is created and the payment got no
-- voucher number at all.
--
-- Expenses with payer = 'petty_cash' now draw a PV number too, from the SAME
-- sequence as reimbursements. The petty cash voucher book is one continuous
-- series regardless of which way the cash moved, so PV numbers never collide
-- and never repeat.

alter table expenses
  add column if not exists pv_number text;

create or replace function assign_expense_pv_number()
returns trigger
language plpgsql
as $$
begin
  -- Only cash paid directly from the tin gets a voucher number here;
  -- everything else is either company-paid or reimbursed (numbered on
  -- `reimbursements`). Never re-number a row that already has one.
  if new.payer = 'petty_cash' and new.pv_number is null then
    new.pv_number := 'PV-' || lpad(nextval('reimbursement_pv_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists expenses_pv_number on expenses;
create trigger expenses_pv_number
  before insert or update of payer on expenses
  for each row execute function assign_expense_pv_number();

-- Backfill the petty-cash payments already recorded, oldest first.
do $$
declare
  r record;
begin
  for r in
    select id from expenses
    where payer = 'petty_cash' and pv_number is null
    order by expense_date, created_at, id
  loop
    update expenses
    set pv_number = 'PV-' || lpad(nextval('reimbursement_pv_seq')::text, 4, '0')
    where id = r.id;
  end loop;
end;
$$;

create unique index if not exists expenses_pv_number_key
  on expenses (pv_number);
