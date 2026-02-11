-- Groups table
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

comment on table public.groups is 'Private groups that users can create and join via a 6-character invite code.';
comment on column public.groups.invite_code is 'Unique 6-character alphanumeric code for joining the group.';

-- Index for fast invite code lookups
create unique index groups_invite_code_idx on public.groups (upper(invite_code));

-- Group members junction table
create type public.group_role as enum ('owner', 'member');

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role group_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);

comment on table public.group_members is 'Tracks which users belong to which groups and their role.';

-- Index for looking up a user''s groups
create index group_members_user_id_idx on public.group_members (user_id);
create index group_members_group_id_idx on public.group_members (group_id);

-- ============================================================
-- RLS Policies
-- ============================================================

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

-- Groups: members can read their own groups
create policy "Members can view their groups"
  on public.groups for select
  using (
    id in (
      select group_id from public.group_members
      where user_id = auth.uid()
    )
  );

-- Groups: any authenticated user can insert (create) a group
create policy "Authenticated users can create groups"
  on public.groups for insert
  with check (auth.uid() = created_by);

-- Groups: only the owner can update the group
create policy "Owner can update group"
  on public.groups for update
  using (created_by = auth.uid());

-- Groups: only the owner can delete the group
create policy "Owner can delete group"
  on public.groups for delete
  using (created_by = auth.uid());

-- Group members: members can see other members in their groups
create policy "Members can view group members"
  on public.group_members for select
  using (
    group_id in (
      select group_id from public.group_members
      where user_id = auth.uid()
    )
  );

-- Group members: users can insert themselves (join)
create policy "Users can join groups"
  on public.group_members for insert
  with check (auth.uid() = user_id);

-- Group members: users can remove themselves, owners can remove anyone
create policy "Users can leave or owners can remove"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    or group_id in (
      select id from public.groups
      where created_by = auth.uid()
    )
  );

-- ============================================================
-- Function: generate a random 6-character invite code
-- ============================================================
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no I/O/0/1 to avoid confusion
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ============================================================
-- Trigger: auto-generate invite code on group creation
-- ============================================================
create or replace function public.handle_new_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_code text;
  attempts int := 0;
begin
  -- Generate a unique code (retry on collision)
  loop
    new_code := generate_invite_code();
    begin
      new.invite_code := new_code;
      return new;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 10 then
        raise exception 'Could not generate unique invite code after 10 attempts';
      end if;
    end;
  end loop;
end;
$$;

create trigger on_group_created
  before insert on public.groups
  for each row
  execute function public.handle_new_group();

-- ============================================================
-- Trigger: auto-add creator as owner when group is created
-- ============================================================
create or replace function public.add_owner_to_group()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created_add_owner
  after insert on public.groups
  for each row
  execute function public.add_owner_to_group();

-- ============================================================
-- Function: join a group by invite code (RPC)
-- ============================================================
create or replace function public.join_group_by_code(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  found_group_id uuid;
begin
  select id into found_group_id
  from public.groups
  where upper(invite_code) = upper(code);

  if found_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (found_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return found_group_id;
end;
$$;
