create extension if not exists pgcrypto;

create table if not exists online_voting_events (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  community_name text,
  title text not null,
  election_type text default 'Board Election',
  description text,
  status text default 'draft',
  nomination_open boolean default false,
  nomination_start_at timestamptz,
  nomination_end_at timestamptz,
  voting_start_at timestamptz,
  voting_end_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_online_voting_events_community_updated
  on online_voting_events (community_id, updated_at desc);

create table if not exists online_voting_nominees (
  id uuid primary key default gen_random_uuid(),
  voting_event_id uuid not null references online_voting_events(id) on delete cascade,
  community_id uuid not null,
  nominee_name text not null,
  nominee_email text,
  unit_label text,
  notes text,
  status text not null default 'pending',
  submitted_by uuid,
  submitted_at timestamptz not null default now(),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_online_voting_nominees_event_submitted
  on online_voting_nominees (voting_event_id, submitted_at desc);

alter table online_voting_events enable row level security;
alter table online_voting_nominees enable row level security;

drop policy if exists online_voting_events_all on online_voting_events;
create policy online_voting_events_all on online_voting_events
for all
using (true)
with check (true);

drop policy if exists online_voting_nominees_all on online_voting_nominees;
create policy online_voting_nominees_all on online_voting_nominees
for all
using (true)
with check (true);
