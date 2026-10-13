-- Why a document number can be missing from the run, and a place to say so.
--
-- PO and PV numbers come from Postgres sequences stamped on insert. Two things
-- put holes in the run, and only one of them is a deletion:
--
--   1. A row was created and later deleted — a duplicate, a purchase that
--      turned out to be a journal. The number is retired: it must never be
--      issued again, because it may already be written on a paper receipt or
--      quoted in a bank narrative.
--   2. An insert failed or timed out. nextval() is deliberately NOT rolled
--      back, so the number was spent without a row ever existing.
--
-- Either way the gap is permanent and correct. What it is NOT is
-- self-explaining: an auditor looking at a missing PO-0196 cannot tell a
-- careful correction from a vanished invoice. This table is where the answer
-- lives.
create table if not exists void_document_numbers (
  id          uuid primary key default gen_random_uuid(),
  series      text not null check (series in ('PO', 'PV', 'DN', 'JV')),
  number      integer not null check (number > 0),
  -- 'deleted'   — a row existed and was removed on purpose
  -- 'not_issued'— the sequence advanced but no row was ever created
  -- 'unknown'   — a gap found in the books with no record of its cause
  cause       text not null default 'unknown'
                check (cause in ('deleted', 'not_issued', 'unknown')),
  voided_on   date,
  -- What the row held, in enough detail to recognise it: vendor, amount, date.
  was         text,
  -- Why it went, and where the substance ended up if it moved.
  reason      text,
  recorded_at timestamptz not null default now(),
  unique (series, number)
);

comment on table void_document_numbers is
  'Retired and never-issued document numbers, with the reason for each. Read through the document_number_gaps view, which finds gaps live and shows which ones are still unexplained.';

-- Every gap in the PO and PV runs, computed from the books rather than stored,
-- so a number that goes missing tomorrow appears here without anyone
-- remembering to add it. The explanation is joined on; "unexplained" is a
-- question waiting to be answered, not an error.
create or replace view document_number_gaps as
with po as (
  select (regexp_replace(po_number, '\D', '', 'g'))::int as n
  from expenses where po_number is not null
),
pv as (
  select (regexp_replace(pv_number, '\D', '', 'g'))::int as n
  from reimbursements where pv_number is not null
),
gaps as (
  select 'PO' as series, g as number
  from (select min(n) lo, max(n) hi from po) b,
       generate_series(b.lo, b.hi) g
  where not exists (select 1 from po where po.n = g)
  union all
  select 'PV', g
  from (select min(n) lo, max(n) hi from pv) b,
       generate_series(b.lo, b.hi) g
  where not exists (select 1 from pv where pv.n = g)
)
select
  gaps.series,
  gaps.number,
  gaps.series || '-' || lpad(gaps.number::text, 4, '0') as document_number,
  coalesce(v.cause, 'unknown') as cause,
  v.voided_on,
  v.was,
  v.reason,
  (v.id is null or v.cause = 'unknown') as unexplained
from gaps
left join void_document_numbers v
  on v.series = gaps.series and v.number = gaps.number
order by gaps.series, gaps.number;

comment on view document_number_gaps is
  'Live list of missing PO and PV numbers with their explanations. unexplained = true means the gap is real but nobody has recorded why.';
