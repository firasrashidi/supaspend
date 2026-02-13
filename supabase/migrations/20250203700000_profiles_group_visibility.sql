-- Allow users to see profiles of members in their shared groups
-- Uses the existing is_member_of_group() SECURITY DEFINER function to avoid recursion

create policy "Users can view profiles of group co-members"
  on public.profiles for select
  using (
    id in (
      select gm.user_id
      from public.group_members gm
      where public.is_member_of_group(gm.group_id)
    )
  );
