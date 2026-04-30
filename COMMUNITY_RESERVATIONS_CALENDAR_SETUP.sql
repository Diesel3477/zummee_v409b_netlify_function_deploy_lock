-- Community Reservations / Community Calendar setup
-- Board members and employees can create calendar items. Residents can view published items.

create table if not exists community_reservation_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,

  title text not null,
  description text,
  event_type text default 'community_event' check (event_type in ('board_meeting','important_date','community_event','reservation_notice')),

  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean default false,

  recurrence text default 'none' check (recurrence in ('none','weekly','monthly','yearly')),
  recurrence_until date,

  is_published boolean default true,
  created_by uuid,
  created_by_name text,
  created_by_role text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists community_reservation_events_community_idx
on community_reservation_events (community_id, starts_at);

create index if not exists community_reservation_events_company_idx
on community_reservation_events (company_id, starts_at);

alter table community_reservation_events enable row level security;

drop policy if exists "Community calendar read" on community_reservation_events;
create policy "Community calendar read"
on community_reservation_events
for select
to authenticated
using (true);

drop policy if exists "Community calendar insert" on community_reservation_events;
create policy "Community calendar insert"
on community_reservation_events
for insert
to authenticated
with check (true);

drop policy if exists "Community calendar update" on community_reservation_events;
create policy "Community calendar update"
on community_reservation_events
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Community calendar delete" on community_reservation_events;
create policy "Community calendar delete"
on community_reservation_events
for delete
to authenticated
using (true);
