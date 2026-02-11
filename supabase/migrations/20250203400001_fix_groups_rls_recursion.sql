-- Fix: infinite recursion in group_members RLS policy.
-- The SELECT policy on group_members referenced group_members itself.
-- Solution: use a SECURITY DEFINER function to check membership without triggering RLS.

-- Helper function that bypasses RLS to check if a user belongs to a group
create or replace function public.is_member_of_group(gid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- Drop the recursive policies
drop policy if exists "Members can view their groups" on public.groups;
drop policy if exists "Members can view group members" on public.group_members;

-- Recreate using the helper function (no recursion)
create policy "Members can view their groups"
  on public.groups for select
  using (public.is_member_of_group(id));

create policy "Members can view group members"
  on public.group_members for select
  using (public.is_member_of_group(group_id));
