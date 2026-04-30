create extension if not exists pgcrypto;

create table if not exists public.board_meeting_agenda_events (
  id uuid primary key default gen_random_uuid(),
  employee_user_id uuid null,
  employee_email text null,
  employee_name text null,
  company_id uuid null,
  community_id uuid null,
  community_name text null,
  meeting_key text not null,
  meeting_date date null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists board_meeting_agenda_events_unique
  on public.board_meeting_agenda_events (employee_user_id, community_id, meeting_key);

create index if not exists board_meeting_agenda_events_company_idx
  on public.board_meeting_agenda_events (company_id, sent_at desc);

create index if not exists board_meeting_agenda_events_community_idx
  on public.board_meeting_agenda_events (community_id, sent_at desc);

alter table public.board_meeting_agenda_events enable row level security;

drop policy if exists board_meeting_agenda_events_select_auth on public.board_meeting_agenda_events;
create policy board_meeting_agenda_events_select_auth
on public.board_meeting_agenda_events
for select
to authenticated
using (true);

drop policy if exists board_meeting_agenda_events_insert_auth on public.board_meeting_agenda_events;
create policy board_meeting_agenda_events_insert_auth
on public.board_meeting_agenda_events
for insert
to authenticated
with check (true);

drop policy if exists board_meeting_agenda_events_update_auth on public.board_meeting_agenda_events;
create policy board_meeting_agenda_events_update_auth
on public.board_meeting_agenda_events
for update
to authenticated
using (true)
with check (true);
