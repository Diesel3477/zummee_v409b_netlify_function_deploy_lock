-- Community Reservations Phase 2 setup
-- Adds facility reservation requests, approvals, statuses, and indexes.
-- Safe to run after COMMUNITY_RESERVATIONS_CALENDAR_SETUP.sql.

create table if not exists community_reservation_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,

  facility_name text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,

  requested_by uuid,
  requested_by_name text,

  status text default 'pending' check (status in ('pending','approved','declined','cancelled')),
  reviewed_by uuid,
  reviewed_by_name text,
  reviewed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists community_reservation_requests_community_idx
on community_reservation_requests (community_id, starts_at);

create index if not exists community_reservation_requests_status_idx
on community_reservation_requests (status, starts_at);

alter table community_reservation_requests enable row level security;

drop policy if exists "Reservation requests read" on community_reservation_requests;
create policy "Reservation requests read"
on community_reservation_requests
for select
to authenticated
using (true);

drop policy if exists "Reservation requests insert" on community_reservation_requests;
create policy "Reservation requests insert"
on community_reservation_requests
for insert
to authenticated
with check (true);

drop policy if exists "Reservation requests update" on community_reservation_requests;
create policy "Reservation requests update"
on community_reservation_requests
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Reservation requests delete" on community_reservation_requests;
create policy "Reservation requests delete"
on community_reservation_requests
for delete
to authenticated
using (true);

-- Optional convenience columns for older builds if they were not present.
alter table community_reservation_events add column if not exists company_id uuid;
alter table community_reservation_events add column if not exists community_name text;
alter table community_reservation_events add column if not exists all_day boolean default false;
alter table community_reservation_events add column if not exists recurrence text default 'none';
alter table community_reservation_events add column if not exists recurrence_until date;
alter table community_reservation_events add column if not exists is_published boolean default true;
alter table community_reservation_events add column if not exists created_by_name text;
alter table community_reservation_events add column if not exists created_by_role text;
alter table community_reservation_events add column if not exists updated_at timestamptz default now();
