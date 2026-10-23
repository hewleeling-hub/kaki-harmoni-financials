-- 0025_budget_months.sql
-- A budget figure per MONTH, not one flat monthly figure per year.
--
-- The first budget only covers September to December 2026 and ramps month by
-- month, so a single monthly number would overstate every period that includes
-- the months before trading began. month stays nullable so a flat annual budget
-- can still be held as one row with month = null.

alter table budgets add column if not exists month smallint;
alter table budgets add constraint budgets_month_range
  check (month is null or (month between 1 and 12));
alter table budgets drop constraint if exists budgets_account_code_fiscal_year_key;
create unique index if not exists budgets_code_year_month_key
  on budgets (account_code, fiscal_year, month);
