-- Annual Meeting Archive Phase 1
-- Run this in Supabase SQL editor before testing the archive flow.

create table if not exists public.annual_meeting_archive (
  id uuid primary key default gen_random_uuid(),
  source_request_id uuid unique,
  company_id uuid null,
  community_id uuid null,
  community_name text null,
  meeting_year integer not null,
  meeting_date date null,
  mailed_at timestamptz null,
  mailed_by text null,
  packet_filename text null,
  packet_content_type text null,
  packet_base64 text null,
  preview_html text null,
  packet_payload jsonb not null default '{}'::jsonb,
  archived_from_status text null,
  employee_user_id uuid null,
  employee_email text null,
  employee_name text null,
  supervisor_user_id uuid null,
  supervisor_name text null,
  created_at timestamptz not null default now()
);

create index if not exists annual_meeting_archive_company_idx
  on public.annual_meeting_archive (company_id);

create index if not exists annual_meeting_archive_community_year_idx
  on public.annual_meeting_archive (community_id, meeting_year desc, mailed_at desc);

create index if not exists annual_meeting_archive_year_idx
  on public.annual_meeting_archive (meeting_year desc);

alter table public.annual_meeting_archive enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'annual_meeting_archive'
      and policyname = 'annual_meeting_archive_authenticated_read'
  ) then
    create policy annual_meeting_archive_authenticated_read
      on public.annual_meeting_archive
      for select
      to authenticated
      using (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'annual_meeting_archive'
      and policyname = 'annual_meeting_archive_authenticated_insert'
  ) then
    create policy annual_meeting_archive_authenticated_insert
      on public.annual_meeting_archive
      for insert
      to authenticated
      with check (true);
  end if;
end $$;
