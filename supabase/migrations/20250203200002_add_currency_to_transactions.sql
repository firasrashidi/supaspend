-- Add currency field to transactions table
-- Run this in Supabase SQL Editor if you already created the transactions table

alter table public.transactions
  add column currency text not null default 'USD';

comment on column public.transactions.currency is 'ISO 4217 currency code (e.g. USD, EUR, GBP)';
