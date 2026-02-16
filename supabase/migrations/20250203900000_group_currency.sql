-- Add a default currency to each group
alter table public.groups
  add column currency text not null default 'USD';

comment on column public.groups.currency is 'Default currency for the group (ISO 4217 code)';
