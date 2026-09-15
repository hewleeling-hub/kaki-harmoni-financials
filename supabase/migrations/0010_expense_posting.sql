-- Link a journal back to the purchase it posts.
--
-- Without this there is no way to tell which purchases have reached the books,
-- so the Purchases list can't show a posted/unposted state and nothing stops
-- the same purchase being posted twice.
--
-- `on delete set null` rather than cascade: deleting a purchase must never
-- silently remove a posted journal — the books stay intact and the entry is
-- reversed deliberately if it was wrong.

alter table journals
  add column if not exists expense_id uuid references expenses(id) on delete set null;

-- One live posting per purchase. Partial so the many manual journals with no
-- expense_id don't collide with each other on null.
create unique index if not exists journals_expense_id_key
  on journals (expense_id)
  where expense_id is not null;

create index if not exists journals_source_idx on journals (source);

-- Backfill the wages entry posted by hand before this existed, matching on the
-- reference it was filed under, so it shows as posted rather than inviting a
-- duplicate.
update journals j
set expense_id = e.id
from expenses e
where j.expense_id is null
  and e.po_number is not null
  and j.reference is not null
  and j.reference like '%' || e.po_number || '%';
