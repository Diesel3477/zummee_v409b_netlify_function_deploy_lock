-- Zummee mileage production tables
-- Run this in Supabase SQL editor

create table if not exists public.mileage_submission_status (
  user_id uuid not null,
  community_id uuid not null,
  month text not null,
  reminder_enabled boolean not null default false,
  compliance_complete boolean not null default false,
  total_miles numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id, month)
);

create table if not exists public.mileage_monthly_archive (
  user_id uuid not null,
  community_id uuid not null,
  month text not null,
  total_miles numeric not null default 0,
  compliance_complete boolean not null default false,
  entries_count integer not null default 0,
  archived_at timestamptz not null default now(),
  source text,
  primary key (user_id, community_id, month)
);

create index if not exists mileage_submission_status_community_month_idx
  on public.mileage_submission_status (community_id, month);

create index if not exists mileage_monthly_archive_community_month_idx
  on public.mileage_monthly_archive (community_id, month);

alter table public.mileage_submission_status enable row level security;
alter table public.mileage_monthly_archive enable row level security;

-- Employees can upsert/read their own status
drop policy if exists mileage_submission_status_select_own on public.mileage_submission_status;
create policy mileage_submission_status_select_own
on public.mileage_submission_status
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists mileage_submission_status_upsert_own on public.mileage_submission_status;
create policy mileage_submission_status_upsert_own
on public.mileage_submission_status
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists mileage_submission_status_update_own on public.mileage_submission_status;
create policy mileage_submission_status_update_own
on public.mileage_submission_status
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Employees can read/write their own archive snapshots
drop policy if exists mileage_monthly_archive_select_own on public.mileage_monthly_archive;
create policy mileage_monthly_archive_select_own
on public.mileage_monthly_archive
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists mileage_monthly_archive_insert_own on public.mileage_monthly_archive;
create policy mileage_monthly_archive_insert_own
on public.mileage_monthly_archive
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists mileage_monthly_archive_update_own on public.mileage_monthly_archive;
create policy mileage_monthly_archive_update_own
on public.mileage_monthly_archive
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Supervisor/admin cross-user visibility:
-- Adjust this policy to match your role model if you want supervisors/admins
-- to view all statuses for their assigned communities.
-- For now, the frontend gracefully falls back if broader access is not allowed.
