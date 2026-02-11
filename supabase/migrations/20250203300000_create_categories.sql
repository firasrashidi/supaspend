-- Categories table for user-defined transaction categories
-- Run this in the Supabase SQL Editor

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  
  -- Each user can only have one category with the same name
  unique (user_id, name)
);

-- Index for faster lookups
create index categories_user_id_name_idx on public.categories (user_id, name);

-- Row Level Security
alter table public.categories enable row level security;

create policy "Users can view own categories"
  on public.categories for select
  using (auth.uid() = user_id);

create policy "Users can insert own categories"
  on public.categories for insert
  with check (auth.uid() = user_id);

create policy "Users can update own categories"
  on public.categories for update
  using (auth.uid() = user_id);

create policy "Users can delete own categories"
  on public.categories for delete
  using (auth.uid() = user_id);
