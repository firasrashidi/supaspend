-- ============================================================
-- Group budgets: per-category monthly budget limits
-- ============================================================

create table public.group_budgets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  category text not null,
  amount_limit numeric(12, 2) not null check (amount_limit > 0),
  currency text not null default 'USD',
  month int not null check (month between 1 and 12),
  year int not null check (year >= 2000),
  created_at timestamptz not null default now(),
  unique (group_id, category, month, year)
);

comment on table public.group_budgets is 'Monthly budget limits per category for each group.';

create index group_budgets_group_month_idx on public.group_budgets (group_id, year, month);

-- ============================================================
-- RLS for group_budgets
-- ============================================================

alter table public.group_budgets enable row level security;

-- All group members can view budgets
create policy "Members can view group budgets"
  on public.group_budgets for select
  using (public.is_member_of_group(group_id));

-- Only group owners can create budgets
create policy "Owners can create group budgets"
  on public.group_budgets for insert
  with check (
    exists (
      select 1 from public.groups
      where id = group_id and created_by = auth.uid()
    )
  );

-- Only group owners can update budgets
create policy "Owners can update group budgets"
  on public.group_budgets for update
  using (
    exists (
      select 1 from public.groups
      where id = group_id and created_by = auth.uid()
    )
  );

-- Only group owners can delete budgets
create policy "Owners can delete group budgets"
  on public.group_budgets for delete
  using (
    exists (
      select 1 from public.groups
      where id = group_id and created_by = auth.uid()
    )
  );

-- ============================================================
-- Add group_id to transactions (nullable — personal by default)
-- ============================================================

alter table public.transactions
  add column group_id uuid references public.groups (id) on delete set null;

comment on column public.transactions.group_id is 'Optional group link. NULL = personal transaction.';

create index transactions_group_id_idx on public.transactions (group_id)
  where group_id is not null;

-- ============================================================
-- Additional RLS on transactions: group members can view
-- transactions linked to their groups
-- ============================================================

create policy "Members can view group transactions"
  on public.transactions for select
  using (
    group_id is not null
    and public.is_member_of_group(group_id)
  );
