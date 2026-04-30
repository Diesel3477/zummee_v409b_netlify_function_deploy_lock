-- Annual Meeting Archive Phase 2 Storage Upgrade
-- Run after Phase 1. Creates a public Storage bucket and adds URL/path columns to the archive table.

alter table public.annual_meeting_archive
  add column if not exists packet_url text null,
  add column if not exists storage_bucket text null,
  add column if not exists storage_path text null;

create index if not exists annual_meeting_archive_packet_url_idx
  on public.annual_meeting_archive (packet_url);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'annual-meeting-packets',
  'annual-meeting-packets',
  true,
  52428800,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'annual_meeting_packets_public_read'
  ) then
    create policy annual_meeting_packets_public_read
      on storage.objects
      for select
      to public
      using (bucket_id = 'annual-meeting-packets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'annual_meeting_packets_anon_insert'
  ) then
    create policy annual_meeting_packets_anon_insert
      on storage.objects
      for insert
      to anon
      with check (bucket_id = 'annual-meeting-packets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'annual_meeting_packets_authenticated_insert'
  ) then
    create policy annual_meeting_packets_authenticated_insert
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'annual-meeting-packets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'annual_meeting_packets_anon_update'
  ) then
    create policy annual_meeting_packets_anon_update
      on storage.objects
      for update
      to anon
      using (bucket_id = 'annual-meeting-packets')
      with check (bucket_id = 'annual-meeting-packets');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'annual_meeting_packets_authenticated_update'
  ) then
    create policy annual_meeting_packets_authenticated_update
      on storage.objects
      for update
      to authenticated
      using (bucket_id = 'annual-meeting-packets')
      with check (bucket_id = 'annual-meeting-packets');
  end if;
end $$;
