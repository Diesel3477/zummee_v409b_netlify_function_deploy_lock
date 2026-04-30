-- V200 Community Events: board-majority approval, flyer upload support, and resident RSVP

create table if not exists community_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  title text not null,
  description text,
  event_date timestamptz,
  event_location text,
  flyer_url text,
  flyer_path text,
  flyer_type text,
  created_by uuid,
  created_by_name text,
  created_by_email text,
  requires_rsvp boolean not null default false,
  status text not null default 'pending',
  approval_count integer not null default 0,
  rejection_count integer not null default 0,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists community_event_approvals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references community_events(id) on delete cascade,
  board_member_id uuid,
  board_member_name text,
  board_member_email text,
  decision text not null check (decision in ('approved','rejected')),
  created_at timestamptz not null default now(),
  unique(event_id, board_member_email)
);

create table if not exists community_event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references community_events(id) on delete cascade,
  resident_id uuid,
  resident_name text,
  resident_email text,
  response text not null check (response in ('yes','no','maybe')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id, resident_email)
);

create index if not exists community_events_community_status_idx on community_events(community_id,status,event_date);
create index if not exists community_events_company_status_idx on community_events(company_id,status,event_date);
create index if not exists community_event_approvals_event_idx on community_event_approvals(event_id);
create index if not exists community_event_rsvps_event_idx on community_event_rsvps(event_id);

alter table community_events enable row level security;
alter table community_event_approvals enable row level security;
alter table community_event_rsvps enable row level security;

drop policy if exists "Community events read" on community_events;
create policy "Community events read" on community_events for select to authenticated using (true);

drop policy if exists "Community events manage" on community_events;
create policy "Community events manage" on community_events for all to authenticated using (true) with check (true);

drop policy if exists "Community event approvals read" on community_event_approvals;
create policy "Community event approvals read" on community_event_approvals for select to authenticated using (true);

drop policy if exists "Community event approvals manage" on community_event_approvals;
create policy "Community event approvals manage" on community_event_approvals for all to authenticated using (true) with check (true);

drop policy if exists "Community event rsvps read" on community_event_rsvps;
create policy "Community event rsvps read" on community_event_rsvps for select to authenticated using (true);

drop policy if exists "Community event rsvps manage" on community_event_rsvps;
create policy "Community event rsvps manage" on community_event_rsvps for all to authenticated using (true) with check (true);

-- Flyer storage bucket. Safe to rerun.
insert into storage.buckets (id, name, public)
values ('community_event_flyers', 'community_event_flyers', true)
on conflict (id) do update set public = true;

drop policy if exists "Community event flyers public read" on storage.objects;
create policy "Community event flyers public read"
on storage.objects for select to public
using (bucket_id = 'community_event_flyers');

drop policy if exists "Community event flyers authenticated upload" on storage.objects;
create policy "Community event flyers authenticated upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'community_event_flyers');

drop policy if exists "Community event flyers authenticated update" on storage.objects;
create policy "Community event flyers authenticated update"
on storage.objects for update to authenticated
using (bucket_id = 'community_event_flyers')
with check (bucket_id = 'community_event_flyers');
