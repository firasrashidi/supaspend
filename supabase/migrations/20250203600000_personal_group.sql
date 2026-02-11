-- ============================================================
-- Auto-create a "Personal" group for every new user.
-- Personal groups: is_personal = true, cannot be joined by others.
-- ============================================================

-- Add is_personal flag to groups
alter table public.groups
  add column is_personal boolean not null default false;

comment on column public.groups.is_personal is 'True for auto-created personal groups. Cannot be joined by others.';

-- ============================================================
-- Function: create a Personal group when a user signs up
-- Runs after the profile trigger so the user already exists.
-- ============================================================
create or replace function public.create_personal_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_group_id uuid;
begin
  -- Create the personal group (invite_code will be set by the existing trigger)
  insert into public.groups (name, created_by, is_personal, invite_code)
  values ('Personal', new.id, true, 'TEMP')
  returning id into new_group_id;

  -- The on_group_created_add_owner trigger already adds the user as owner
  -- so we don't need to insert into group_members here.

  return new;
end;
$$;

create trigger on_auth_user_created_personal_group
  after insert on auth.users
  for each row
  execute function public.create_personal_group();

-- ============================================================
-- Prevent others from joining personal groups
-- Update the join_group_by_code function to reject personal groups
-- ============================================================
create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  found_group_id uuid;
  found_is_personal boolean;
begin
  select id, is_personal into found_group_id, found_is_personal
  from public.groups
  where upper(invite_code) = upper(code);

  if found_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  if found_is_personal then
    raise exception 'This is a personal group and cannot be joined';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (found_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return found_group_id;
end;
$$;

-- ============================================================
-- Backfill: create Personal groups for all existing users
-- who don't already have one
-- ============================================================
do $$
declare
  u record;
  new_gid uuid;
begin
  for u in
    select id from auth.users
    where id not in (
      select created_by from public.groups where is_personal = true
    )
  loop
    insert into public.groups (name, created_by, is_personal, invite_code)
    values ('Personal', u.id, true, 'TEMP')
    returning id into new_gid;

    -- The trigger handles invite_code but we need to add the owner
    -- since the on_group_created_add_owner trigger won't fire inside DO blocks
    insert into public.group_members (group_id, user_id, role)
    values (new_gid, u.id, 'owner')
    on conflict (group_id, user_id) do nothing;
  end loop;
end;
$$;
