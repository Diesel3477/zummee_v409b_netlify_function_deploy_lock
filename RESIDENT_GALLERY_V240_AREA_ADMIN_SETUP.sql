-- V240 Resident Community Gallery + Zummee Local Area Posts

create table if not exists resident_gallery_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  area_key text,
  scope text default 'community',
  post_source text default 'resident',
  resident_id uuid,
  resident_name text,
  category text,
  caption text,
  image_path text,
  image_url text,
  photo_url text,
  status text default 'pending',
  likes_count integer default 0,
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table resident_gallery_posts
add column if not exists area_key text,
add column if not exists scope text default 'community',
add column if not exists post_source text default 'resident',
add column if not exists category text,
add column if not exists image_url text,
add column if not exists photo_url text,
add column if not exists reviewed_at timestamptz,
add column if not exists updated_at timestamptz;

create table if not exists resident_gallery_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references resident_gallery_posts(id) on delete cascade,
  resident_id uuid,
  commenter_name text,
  comment text,
  status text default 'visible',
  created_at timestamptz default now()
);

create index if not exists idx_resident_gallery_posts_community on resident_gallery_posts(community_id);
create index if not exists idx_resident_gallery_posts_area on resident_gallery_posts(area_key);
create index if not exists idx_resident_gallery_posts_status on resident_gallery_posts(status);
create index if not exists idx_resident_gallery_posts_scope on resident_gallery_posts(scope);
create index if not exists idx_resident_gallery_comments_post on resident_gallery_comments(post_id);

alter table resident_gallery_posts enable row level security;
alter table resident_gallery_comments enable row level security;

drop policy if exists "resident gallery posts read" on resident_gallery_posts;
create policy "resident gallery posts read" on resident_gallery_posts for select using (true);

drop policy if exists "resident gallery posts insert" on resident_gallery_posts;
create policy "resident gallery posts insert" on resident_gallery_posts for insert with check (true);

drop policy if exists "resident gallery posts update" on resident_gallery_posts;
create policy "resident gallery posts update" on resident_gallery_posts for update using (true) with check (true);

drop policy if exists "resident gallery comments read" on resident_gallery_comments;
create policy "resident gallery comments read" on resident_gallery_comments for select using (true);

drop policy if exists "resident gallery comments insert" on resident_gallery_comments;
create policy "resident gallery comments insert" on resident_gallery_comments for insert with check (true);

insert into storage.buckets (id, name, public)
values ('resident_gallery', 'resident_gallery', true)
on conflict (id) do update set public = true;

drop policy if exists "resident gallery public read" on storage.objects;
create policy "resident gallery public read" on storage.objects
for select using (bucket_id = 'resident_gallery');

drop policy if exists "resident gallery uploads" on storage.objects;
create policy "resident gallery uploads" on storage.objects
for insert with check (bucket_id = 'resident_gallery');

drop policy if exists "resident gallery updates" on storage.objects;
create policy "resident gallery updates" on storage.objects
for update using (bucket_id = 'resident_gallery') with check (bucket_id = 'resident_gallery');
