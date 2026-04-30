-- V241 Resident Gallery Likes + Comments support
-- Run after RESIDENT_GALLERY_V240_AREA_ADMIN_SETUP.sql.

alter table resident_gallery_posts
add column if not exists likes_count integer default 0;

create table if not exists resident_gallery_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references resident_gallery_posts(id) on delete cascade,
  resident_id uuid,
  commenter_name text,
  comment text,
  status text default 'visible',
  created_at timestamptz default now()
);

create index if not exists idx_resident_gallery_comments_post
on resident_gallery_comments(post_id);

alter table resident_gallery_comments enable row level security;

drop policy if exists "resident gallery comments read" on resident_gallery_comments;
create policy "resident gallery comments read"
on resident_gallery_comments
for select
using (status = 'visible');

drop policy if exists "resident gallery comments insert" on resident_gallery_comments;
create policy "resident gallery comments insert"
on resident_gallery_comments
for insert
with check (true);

drop policy if exists "resident gallery likes update count" on resident_gallery_posts;
create policy "resident gallery likes update count"
on resident_gallery_posts
for update
using (true)
with check (true);
