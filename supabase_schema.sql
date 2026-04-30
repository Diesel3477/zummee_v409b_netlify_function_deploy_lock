-- Zummee (Phase 1) - Cloud Sync tables
-- Run this in Supabase SQL Editor.

-- DAILY OPS (entire Daily Ops JSON per user+community)
create table if not exists public.daily_ops_state (
  user_id uuid not null,
  community_id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

-- BOARD MEETINGS (entire meeting state JSON per user+community+meeting_key)
create table if not exists public.board_meetings_state (
  user_id uuid not null,
  community_id text not null,
  meeting_key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id, meeting_key)
);

-- Row Level Security
alter table public.daily_ops_state enable row level security;
alter table public.board_meetings_state enable row level security;

-- Policies: users can only read/write their own rows
create policy if not exists daily_ops_state_rw_own
  on public.daily_ops_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists board_meetings_state_rw_own
  on public.board_meetings_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- v1000: Employee audit log (approvals / disables / actions)
create table if not exists public.employee_audit_log (
  id bigserial primary key,
  company_id uuid null,
  actor_user_id uuid null,
  target_user_id uuid null,
  action text not null,
  details jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists employee_audit_log_company_created_at_idx
  on public.employee_audit_log (company_id, created_at desc);

create index if not exists employee_audit_log_target_created_at_idx
  on public.employee_audit_log (target_user_id, created_at desc);

-- Enable RLS (recommended)
alter table public.employee_audit_log enable row level security;

-- Minimal policies (adjust as needed):
-- Allow authenticated users to insert (UI writes best-effort; you can tighten later)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='employee_audit_log' and policyname='employee_audit_log_insert_auth'
  ) then
    create policy employee_audit_log_insert_auth on public.employee_audit_log
      for insert to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='employee_audit_log' and policyname='employee_audit_log_select_auth'
  ) then
    create policy employee_audit_log_select_auth on public.employee_audit_log
      for select to authenticated
      using (true);
  end if;
end$$;



-- BOARD MEETING AGENDA ITEMS (topics board members submit for next meeting)
create table if not exists public."BoardMeetingAgendaItems" (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  title text not null,
  details text null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

alter table public."BoardMeetingAgendaItems" enable row level security;

drop policy if exists "bmai_select" on public."BoardMeetingAgendaItems";
create policy "bmai_select"
on public."BoardMeetingAgendaItems"
for select
to authenticated
using (true);

drop policy if exists "bmai_insert" on public."BoardMeetingAgendaItems";
create policy "bmai_insert"
on public."BoardMeetingAgendaItems"
for insert
to authenticated
with check (true);

drop policy if exists "bmai_update" on public."BoardMeetingAgendaItems";
create policy "bmai_update"
on public."BoardMeetingAgendaItems"
for update
to authenticated
using (true)
with check (true);

drop policy if exists "bmai_delete" on public."BoardMeetingAgendaItems";
create policy "bmai_delete"
on public."BoardMeetingAgendaItems"
for delete
to authenticated
using (true);
