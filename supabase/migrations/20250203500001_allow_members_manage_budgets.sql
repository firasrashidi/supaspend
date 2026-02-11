-- Allow all group members (not just owners) to manage budgets

drop policy if exists "Owners can create group budgets" on public.group_budgets;
drop policy if exists "Owners can update group budgets" on public.group_budgets;
drop policy if exists "Owners can delete group budgets" on public.group_budgets;

create policy "Members can create group budgets"
  on public.group_budgets for insert
  with check (public.is_member_of_group(group_id));

create policy "Members can update group budgets"
  on public.group_budgets for update
  using (public.is_member_of_group(group_id));

create policy "Members can delete group budgets"
  on public.group_budgets for delete
  using (public.is_member_of_group(group_id));
