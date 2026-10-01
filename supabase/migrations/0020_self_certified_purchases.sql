-- Self-certified purchases: wet market, hawker, parking.
--
-- Cash purchases where no supplier receipt exists or ever will. The signed
-- Market Purchase Voucher is the primary document instead, so the purchase is
-- marked here rather than left looking like a receipt someone lost.
--
-- Per-line evidence ("did the stall give a slip?") rides in the existing
-- line_items jsonb as has_slip, so it needs no column of its own.

alter table expenses
  add column if not exists self_certified boolean not null default false;

comment on column expenses.self_certified is
  'No supplier document behind this purchase (wet market, hawker, parking); the signed voucher is the evidence. Per-line slip flags live in line_items.has_slip.';
