-- Add converted amount columns to transactions
-- When a transaction currency differs from the group currency,
-- we store the converted value so budget calculations are consistent.

alter table public.transactions
  add column converted_amount numeric(12, 2),
  add column converted_currency text;

comment on column public.transactions.converted_amount is 'Amount converted to the group default currency at time of entry';
comment on column public.transactions.converted_currency is 'The group currency code the amount was converted to';
