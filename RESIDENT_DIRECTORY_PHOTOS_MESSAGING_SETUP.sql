-- Resident Directory Photos + Neighbor-to-Neighbor Messaging
-- Run this once in Supabase SQL editor before testing the new directory features.

-- 1) Add resident profile photo support to the existing opt-in table.
alter table public.community_directory_opt_ins
  add column if not exists avatar_url text;

-- 2) Create a public storage bucket for resident directory profile photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resident-profile-photos',
  'resident-profile-photos',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- 3) Storage policies for browser uploads and public reads.
drop policy if exists "Residents can upload profile photos" on storage.objects;
create policy "Residents can upload profile photos"
on storage.objects
for insert
with check (bucket_id = 'resident-profile-photos');

drop policy if exists "Residents can update profile photos" on storage.objects;
create policy "Residents can update profile photos"
on storage.objects
for update
using (bucket_id = 'resident-profile-photos')
with check (bucket_id = 'resident-profile-photos');

drop policy if exists "Public can read resident profile photos" on storage.objects;
create policy "Public can read resident profile photos"
on storage.objects
for select
using (bucket_id = 'resident-profile-photos');

-- 4) Neighbor-to-neighbor direct messages.
create table if not exists public.resident_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid null,
  community_id uuid null,
  sender_resident_id uuid null,
  sender_name text,
  recipient_resident_id uuid null,
  recipient_name text,
  message text not null,
  read boolean default false,
  created_at timestamp with time zone default now()
);

alter table public.resident_messages enable row level security;

-- During build phase, keep policies open so resident auth variants do not block testing.
-- We can tighten these to same-community sender/recipient after the flow is fully stable.
drop policy if exists "Residents can send neighbor messages" on public.resident_messages;
create policy "Residents can send neighbor messages"
on public.resident_messages
for insert
with check (true);

drop policy if exists "Residents can read neighbor messages" on public.resident_messages;
create policy "Residents can read neighbor messages"
on public.resident_messages
for select
using (true);

drop policy if exists "Residents can update message read state" on public.resident_messages;
create policy "Residents can update message read state"
on public.resident_messages
for update
using (true)
with check (true);

create index if not exists idx_resident_messages_recipient
on public.resident_messages (recipient_resident_id, created_at desc);

create index if not exists idx_resident_messages_community
on public.resident_messages (community_id, created_at desc);
