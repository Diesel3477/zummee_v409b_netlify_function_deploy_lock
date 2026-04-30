create extension if not exists pgcrypto;

create table if not exists community_announcements (
  id uuid primary key default gen_random_uuid(),
  type text default 'annual_meeting_notice',
  community_id uuid not null,
  title text,
  body text,
  meeting_link text,
  meeting_date date,
  meeting_time text,
  nomination_deadline date,
  proxy_return_deadline date,
  association_legal_name text,
  community_name text,
  meeting_format text,
  meeting_location text,
  expires_at date,
  created_at timestamptz default now()
);

create index if not exists idx_community_announcements_community_created
on community_announcements (community_id, created_at desc);

create table if not exists supervisor_team_members (
  id uuid primary key default gen_random_uuid(),
  supervisor_user_id uuid not null,
  supervisor_name text,
  employee_user_id uuid not null,
  employee_name text,
  company_id uuid,
  created_at timestamptz default now()
);

create unique index if not exists idx_supervisor_team_members_unique
on supervisor_team_members (company_id, employee_user_id);

create table if not exists annual_meeting_packet_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  employee_user_id uuid,
  employee_email text,
  employee_name text,
  supervisor_user_id uuid,
  supervisor_name text,
  status text default 'pending',
  resident_count integer default 0,
  preview_html text,
  packet_payload jsonb,
  submitted_at timestamptz default now(),
  approved_at timestamptz,
  approved_by uuid,
  rejection_reason text
);

create index if not exists idx_annual_meeting_packet_requests_supervisor_status
on annual_meeting_packet_requests (supervisor_user_id, status, submitted_at desc);

create table if not exists annual_meeting_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text,
  title text,
  detail text,
  company_id uuid,
  community_id uuid,
  community_name text,
  actor_user_id uuid,
  actor_name text,
  target_user_id uuid,
  created_at timestamptz default now()
);

create index if not exists idx_annual_meeting_activity_target_created
on annual_meeting_activity_events (target_user_id, created_at desc);

alter table community_announcements enable row level security;
alter table supervisor_team_members enable row level security;
alter table annual_meeting_packet_requests enable row level security;
alter table annual_meeting_activity_events enable row level security;

drop policy if exists community_announcements_all on community_announcements;
create policy community_announcements_all on community_announcements
for all
using (true)
with check (true);

drop policy if exists supervisor_team_members_all on supervisor_team_members;
create policy supervisor_team_members_all on supervisor_team_members
for all
using (true)
with check (true);

drop policy if exists annual_meeting_packet_requests_all on annual_meeting_packet_requests;
create policy annual_meeting_packet_requests_all on annual_meeting_packet_requests
for all
using (true)
with check (true);

drop policy if exists annual_meeting_activity_events_all on annual_meeting_activity_events;
create policy annual_meeting_activity_events_all on annual_meeting_activity_events
for all
using (true)
with check (true);
