-- Where the money on a note actually moves.
--
-- A note settles by someone making a transfer, and the account details live on
-- a phone or in a chat rather than on the document, so whoever pays has to go
-- looking. Putting them on the note means the document is enough on its own —
-- and with a DuitNow QR attached, it can be paid by scanning the printed page.
alter table supplier_notes
  -- Who is to be paid. Usually the supplier on a repayment going out; our own
  -- name when the note claims money back and they are remitting to us.
  add column if not exists pay_to_name text,
  add column if not exists pay_to_bank text,
  add column if not exists pay_to_account text,
  -- Storage path of a QR image (DuitNow or similar), in the same private
  -- bucket as receipts. Served through /api/receipts/view, never public.
  add column if not exists pay_to_qr_url text;
