-- Community Assignments cloud persistence
create table if not exists public.community_assignments (
  id uuid primary key default gen_random_uuid(),
  company_scope text not null,
  company_id uuid null,
  company_name text not null default '',
  community_id text not null,
  community_name text not null,
  employee_id text not null,
  employee_name text not null,
  employee_email text not null default '',
  assistant_name text not null default '',
  assistant_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_assignments_company_scope_community_unique unique (company_scope, community_id)
);

create index if not exists community_assignments_company_scope_idx
  on public.community_assignments(company_scope);

create index if not exists community_assignments_company_id_idx
  on public.community_assignments(company_id);

alter table public.community_assignments enable row level security;

drop policy if exists "community_assignments_read" on public.community_assignments;
create policy "community_assignments_read"
on public.community_assignments
for select to authenticated
using (true);

drop policy if exists "community_assignments_insert" on public.community_assignments;
create policy "community_assignments_insert"
on public.community_assignments
for insert to authenticated
with check (true);

drop policy if exists "community_assignments_update" on public.community_assignments;
create policy "community_assignments_update"
on public.community_assignments
for update to authenticated
using (true)
with check (true);

drop policy if exists "community_assignments_delete" on public.community_assignments;
create policy "community_assignments_delete"
on public.community_assignments
for delete to authenticated
using (true);

create or replace function public.set_community_assignments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_community_assignments_updated_at on public.community_assignments;
create trigger trg_community_assignments_updated_at
before update on public.community_assignments
for each row
execute function public.set_community_assignments_updated_at();

-- V162 compatibility columns used by newer app pages.
-- Safe to run more than once.
alter table public.community_assignments
  add column if not exists company text null,
  add column if not exists employee_user_id text null,
  add column if not exists user_id text null;

update public.community_assignments
set
  company = coalesce(company, company_name),
  employee_user_id = coalesce(employee_user_id, employee_id),
  user_id = coalesce(user_id, employee_id)
where company is null or employee_user_id is null or user_id is null;
