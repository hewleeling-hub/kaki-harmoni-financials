-- A purchase sometimes arrives knowing its supplier and its amount but not
-- what was bought: a credit card line, a bank transfer, a notebook entry whose
-- invoice is still to come. Those were landing in 6790 Miscellaneous
-- Administrative Expense, which is wrong twice over — most of them are not
-- administrative at all, and once they are mixed in with the genuine odds and
-- ends nothing says they are still waiting on a document.
--
-- 6795 is a holding line, not a category of spending. Every row in it is
-- expected to leave once the invoice names the item, so a balance here at a
-- month end is simply a list of documents to chase.
insert into accounts (
  code, name, account_type, normal_balance, parent_code,
  description, is_postable, statement_group, sort_order
)
values (
  '6795',
  'Purchases Pending Classification',
  'expense',
  'debit',
  '6700',
  'Purchases awaiting their invoice, where the supplier is known but what was bought is not. A holding line, not a category of spending: each row leaves it once the document names the item.',
  true,
  'profit_loss',
  6795
)
on conflict (code) do nothing;
