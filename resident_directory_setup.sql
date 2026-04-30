-- Run in Supabase SQL editor

create table if not exists public.resident_directory (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  resident_name text not null,
  unit_number text,
  street_address text,
  city text,
  state text,
  zip_code text,
  email text,
  phone text,
  lease_status text default 'active',
  building text,
  notes text,
  move_in_date date,
  move_out_date date,
  is_active boolean not null default true,
  invited_at timestamptz,
  auth_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resident_directory_community_idx
  on public.resident_directory (community_id, resident_name);

create index if not exists resident_directory_email_idx
  on public.resident_directory (email);

create or replace function public.set_updated_at_resident_directory()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists resident_directory_set_updated_at on public.resident_directory;
create trigger resident_directory_set_updated_at
before update on public.resident_directory
for each row execute function public.set_updated_at_resident_directory();

alter table if exists public.resident_directory
  add column if not exists auth_user_id uuid;

comment on table public.resident_directory is 'Resident directory records used for import, invite tracking, and resident portal linkage.';
