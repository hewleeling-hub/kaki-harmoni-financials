-- Discount given on a purchase.
--
-- `amount` stays what was actually paid — it drives the ledger, the voucher and
-- every report, so it must remain the real cash figure. The discount is held
-- separately so the paperwork can show how the total was reached:
--
--   subtotal (line items)  −  discount  =  amount paid
--
-- Recorded for the record, not deducted twice.

alter table expenses
  add column if not exists discount numeric not null default 0
    check (discount >= 0);

comment on column expenses.discount is
  'Discount given on this purchase, in MYR. The amount column is already net of it.';
