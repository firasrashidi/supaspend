-- Transactions table for tracking expenses and income
-- Run this in the Supabase SQL Editor

-- Create enum for transaction type
create type public.transaction_type as enum ('expense', 'income');

-- Create transactions table
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type transaction_type not null,
  date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'USD',
  merchant text not null,
  category text,
  notes text,
  receipt_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for faster queries by user and date
create index transactions_user_id_date_idx on public.transactions (user_id, date desc);

-- Row Level Security: users can only access their own transactions
alter table public.transactions enable row level security;

create policy "Users can view own transactions"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on public.transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- Keep updated_at in sync
create trigger transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.set_updated_at();

-- Optional: Create a storage bucket for receipts
-- Run this separately if you want receipt uploads:
-- insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
