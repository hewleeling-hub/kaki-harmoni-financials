-- Line-item breakdown for each expense/receipt.
-- Stored as JSON on the expense: [{ "description": text, "quantity": number,
-- "unit_price": number, "amount": number }, ...]. The expense's own `amount`
-- stays the receipt grand total; line_items is the itemisation for auditing.
alter table expenses
  add column if not exists line_items jsonb not null default '[]'::jsonb;
