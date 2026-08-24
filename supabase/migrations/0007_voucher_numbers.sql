-- Document numbering for the paper trail.
--
--   PO-0001…  purchase order number, one per purchase (expenses)
--   PV-0001…  petty cash voucher number, one per reimbursement
--
-- Two independent running sequences. Numbers are assigned by the database
-- (column default) so every insert gets one without the app having to think
-- about it, and a deleted row burns its number rather than reusing it — gaps
-- are expected and correct for document sequences.

-- ── purchase order numbers ──────────────────────────────────────────────────
create sequence if not exists expense_po_seq;

alter table expenses
  add column if not exists po_number text;

-- Backfill in the order the purchases actually happened, so PO-0001 is the
-- oldest purchase rather than whichever row Postgres happens to return first.
with numbered as (
  select id,
         row_number() over (order by expense_date, created_at, id) as n
  from expenses
  where po_number is null
)
update expenses e
set po_number = 'PO-' || lpad(numbered.n::text, 4, '0')
from numbered
where e.id = numbered.id;

-- Park the sequence past everything already handed out.
-- is_called=false when the table is empty, so the very first number is PO-0001.
select setval(
  'expense_po_seq',
  greatest((select count(*) from expenses where po_number is not null), 1),
  (select count(*) from expenses where po_number is not null) > 0
);

alter table expenses
  alter column po_number
  set default 'PO-' || lpad(nextval('expense_po_seq')::text, 4, '0');

create unique index if not exists expenses_po_number_key
  on expenses (po_number);

-- ── petty cash voucher numbers ──────────────────────────────────────────────
create sequence if not exists reimbursement_pv_seq;

alter table reimbursements
  add column if not exists pv_number text;

with numbered as (
  select r.id,
         row_number() over (
           order by coalesce(e.expense_date, r.created_at::date), r.created_at, r.id
         ) as n
  from reimbursements r
  left join expenses e on e.id = r.expense_id
  where r.pv_number is null
)
update reimbursements r
set pv_number = 'PV-' || lpad(numbered.n::text, 4, '0')
from numbered
where r.id = numbered.id;

select setval(
  'reimbursement_pv_seq',
  greatest((select count(*) from reimbursements where pv_number is not null), 1),
  (select count(*) from reimbursements where pv_number is not null) > 0
);

alter table reimbursements
  alter column pv_number
  set default 'PV-' || lpad(nextval('reimbursement_pv_seq')::text, 4, '0');

create unique index if not exists reimbursements_pv_number_key
  on reimbursements (pv_number);
