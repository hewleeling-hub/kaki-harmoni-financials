-- Company secretarial, office address, accounting and audit fees are usually
-- paid a year in advance. They belong in prepayments until the months they
-- cover have passed, and the chart had no account for them — the nearest were
-- prepaid licences and prepaid subscriptions, neither of which is what a
-- secretarial retainer is.
insert into accounts (code, name, account_type, normal_balance, parent_code, description, is_postable, is_active, statement_group, sort_order)
values (
  '1380',
  'Prepaid Professional Fees',
  'asset',
  'debit',
  '1300',
  'Company secretarial, office address, accounting and audit fees paid in advance, released to expenses over the months they cover.',
  true,
  true,
  'balance_sheet',
  1380
)
on conflict (code) do nothing;
