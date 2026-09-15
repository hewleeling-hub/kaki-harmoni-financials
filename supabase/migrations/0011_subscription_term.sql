-- Subscription term, so a prepaid subscription can be amortised.
--
-- A subscription paid up front isn't spent on the day it's bought — it buys
-- coverage over a period. Recording only the lump sum overstates the month it
-- was paid in and understates every month after. The term is what lets the cost
-- be spread across the months it actually covers.
--
-- Stored as a whole number of months from the purchase date; the end date and
-- the monthly charge are derived, not stored, so they can never drift from it.

alter table expenses
  add column if not exists subscription_months integer
    check (subscription_months is null or subscription_months > 0);

comment on column expenses.subscription_months is
  'Length of a prepaid subscription in months, counted from expense_date. Null for anything that is not a subscription.';
