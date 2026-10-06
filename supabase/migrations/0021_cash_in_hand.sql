-- "Cash in Hand" is what the business calls the money in the drawer — the
-- float plus the takings not yet banked. The account was seeded as "Cash on
-- Hand", which nobody here says.
--
-- A rename, not a new account: a second account for the same money is how a
-- till balance ends up split across two codes and wrong. Nothing had posted to
-- 1110 when it was renamed.
--
-- It stays distinct from 1120 Petty Cash, which is the tin small payments come
-- out of. The description says so, because the two are easy to blur.
update accounts
set name = 'Cash in Hand',
    description = 'Money physically in the till at the outlet: the float plus takings not yet banked. The balance here should equal what is in the drawer. Petty Cash (1120) is the separate tin that small payments are made from.'
where code = '1110';
