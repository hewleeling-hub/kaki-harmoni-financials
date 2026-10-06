-- A journal you can print and sign needs a number on it.
--
-- Journals have only a uuid, which is no use on a document someone files. This
-- gives every entry a JV number from the same shape of sequence the PO, PV and
-- DN numbers use, stamped by a trigger so it lands however the row is written —
-- the ledger form, a posting run, a reversal.
--
-- Existing entries are backfilled in entry order, so the oldest journal is
-- JV-0001 and the numbering reads chronologically from the start.

create sequence if not exists journal_voucher_seq start 1;

alter table journals
  add column if not exists jv_number text;

create unique index if not exists journals_jv_number_key on journals (jv_number);

create or replace function assign_journal_voucher_number()
returns trigger
language plpgsql
as $$
begin
  if new.jv_number is null then
    new.jv_number := 'JV-' || lpad(nextval('journal_voucher_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists journals_voucher_number on journals;
create trigger journals_voucher_number
  before insert on journals
  for each row execute function assign_journal_voucher_number();

-- Backfill in entry order, then move the sequence past what was handed out.
with ordered as (
  select id, row_number() over (order by entry_date, created_at, id) as n
  from journals
  where jv_number is null
)
update journals j
set jv_number = 'JV-' || lpad(ordered.n::text, 4, '0')
from ordered
where j.id = ordered.id;

select setval(
  'journal_voucher_seq',
  greatest((select count(*) from journals), 1),
  (select count(*) > 0 from journals)
);

comment on column journals.jv_number is
  'Document number for the printable journal voucher (JV-0001...). Stamped on insert.';
