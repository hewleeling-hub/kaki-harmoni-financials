-- "Spa consumables" is what the business calls the things used on a guest
-- during a soak — the small plates the salts go in, spray bottles, liners.
-- The account was seeded as "Wellness Consumables", which is nobody's word for
-- it, and the category that points here now reads the same as the account.
--
-- Oils and salts keep their own account (5110) and towels another (5120), so
-- 5130 is the rest. No postings had reached it when it was renamed.
update accounts
set name = 'Spa Consumables',
    description = 'Consumables used on a guest during a soak: salt dishes, spray bottles, liners and similar. Oils and salts are 5110, towels 5120.'
where code = '5130';
