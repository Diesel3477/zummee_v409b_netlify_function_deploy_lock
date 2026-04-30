-- Zummee Community Gallery approval permissions
-- Run in Supabase SQL Editor. Safe to rerun.

alter table public.community_gallery enable row level security;

drop policy if exists "Gallery reviewers can view submissions" on public.community_gallery;
drop policy if exists "Gallery reviewers can approve submissions" on public.community_gallery;

create policy "Gallery reviewers can view submissions"
on public.community_gallery
for select
using (true);

create policy "Gallery reviewers can approve submissions"
on public.community_gallery
for update
using (true)
with check (true);

drop policy if exists "Residents can submit gallery photos" on public.community_gallery;
create policy "Residents can submit gallery photos"
on public.community_gallery
for insert
with check (true);

drop policy if exists "Allow uploads to community gallery" on storage.objects;
create policy "Allow uploads to community gallery"
on storage.objects
for insert
with check (bucket_id = 'community-gallery');
