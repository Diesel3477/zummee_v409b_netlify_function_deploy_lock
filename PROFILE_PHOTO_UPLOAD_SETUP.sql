-- Zummee resident directory profile photo upload setup
-- Run once in Supabase SQL editor.

insert into storage.buckets (id, name, public)
values ('resident-profile-photos', 'resident-profile-photos', true)
on conflict (id) do nothing;

alter table public.profiles
add column if not exists profile_photo_url text;

alter table public.profiles enable row level security;

drop policy if exists "Users can upload their own profile photo" on storage.objects;
create policy "Users can upload their own profile photo"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'resident-profile-photos');

drop policy if exists "Public can view profile photos" on storage.objects;
create policy "Public can view profile photos"
on storage.objects
for select
using (bucket_id = 'resident-profile-photos');

drop policy if exists "Users can update their own profile photo" on public.profiles;
create policy "Users can update their own profile photo"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users can view profiles" on public.profiles;
create policy "Users can view profiles"
on public.profiles
for select
using (true);
