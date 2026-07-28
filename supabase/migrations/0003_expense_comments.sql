-- Free-text comments on a purchase — who / when / why context beyond the short
-- description (e.g. for a Meal: who it was for and the occasion).
alter table expenses
  add column if not exists comments text;
