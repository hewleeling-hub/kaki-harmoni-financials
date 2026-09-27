-- Chart names, brought into line with what the business actually buys.
--
-- These were renamed in the live database as the categories they back were
-- added, but never written down, so a database rebuilt from 0004 would come
-- back with the old names and the mappings in lib/posting.ts would point at
-- accounts labelled something else. Idempotent: it states the names rather
-- than toggling them.

-- Oils and bath salts go into the same soak and are counted together.
update accounts set name = 'Essential Oils and Salts Inventory'
  where code = '1250';
update accounts set name = 'Essential Oils and Salts Used in Services'
  where code = '5110';
update accounts set name = 'Essential Oils and Salts Sold - Cost'
  where code = '5310';

-- Cups, lids, straws, serviettes and takeaway bags arrive on one receipt and
-- are used up as the café serves, so the line covers consumables as well as
-- packaging. Both routes land here: expensed directly, or relieved from 1270
-- Packaging Inventory at a stock take.
update accounts
set name = 'Café Consumables and Packaging',
    description = 'Cups, lids, straws, serviettes, takeaway bags and other café consumables used in serving, whether expensed directly or relieved from packaging inventory at a stock take.'
where code = '5240';
