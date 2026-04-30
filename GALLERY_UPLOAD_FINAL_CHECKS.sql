-- Gallery upload final verification / setup
-- The active frontend uses resident_gallery_posts and the community-gallery storage bucket.

create table if not exists public.resident_gallery_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  resident_id uuid,
  resident_name text,
  resident_email text,
  caption text,
  image_path text,
  status text default 'pending',
  scope text default 'community',
  post_source text default 'resident',
  area_key text,
  likes_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  reviewed_at timestamptz
);

alter table public.resident_gallery_posts enable row level security;

drop policy if exists "resident gallery posts read" on public.resident_gallery_posts;
create policy "resident gallery posts read"
on public.resident_gallery_posts for select
using (true);

drop policy if exists "resident gallery posts insert" on public.resident_gallery_posts;
create policy "resident gallery posts insert"
on public.resident_gallery_posts for insert
with check (true);

drop policy if exists "resident gallery posts update" on public.resident_gallery_posts;
create policy "resident gallery posts update"
on public.resident_gallery_posts for update
using (true)
with check (true);

drop policy if exists "Allow uploads to community gallery" on storage.objects;
create policy "Allow uploads to community gallery"
on storage.objects for insert
with check (bucket_id = 'community-gallery');

drop policy if exists "Allow public read from community gallery" on storage.objects;
create policy "Allow public read from community gallery"
on storage.objects for select
using (bucket_id = 'community-gallery');

select schemaname, tablename, policyname, cmd
from pg_policies
where (schemaname = 'public' and tablename = 'resident_gallery_posts')
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;
