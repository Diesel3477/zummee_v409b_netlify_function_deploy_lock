-- V242 Resident Gallery Live Likes + Comments
-- Enables Supabase Realtime for approved gallery posts and comments.

alter table if exists resident_gallery_posts
add column if not exists likes_count integer default 0;

create table if not exists resident_gallery_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references resident_gallery_posts(id) on delete cascade,
  resident_id uuid,
  commenter_name text,
  comment text not null,
  status text default 'visible',
  created_at timestamptz default now()
);

create index if not exists idx_resident_gallery_comments_post_id
on resident_gallery_comments(post_id);

create index if not exists idx_resident_gallery_comments_created_at
on resident_gallery_comments(created_at desc);

alter table resident_gallery_posts enable row level security;
alter table resident_gallery_comments enable row level security;

create policy if not exists "Read visible resident gallery comments"
on resident_gallery_comments
for select
using (status = 'visible');

create policy if not exists "Residents can add visible gallery comments"
on resident_gallery_comments
for insert
with check (status = 'visible');

create policy if not exists "Residents and staff can update gallery like counts"
on resident_gallery_posts
for update
using (true)
with check (true);

alter table resident_gallery_posts replica identity full;
alter table resident_gallery_comments replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'resident_gallery_posts'
  ) then
    alter publication supabase_realtime add table public.resident_gallery_posts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'resident_gallery_comments'
  ) then
    alter publication supabase_realtime add table public.resident_gallery_comments;
  end if;
end $$;
