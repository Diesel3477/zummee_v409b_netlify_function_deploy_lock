-- Zummee Community Gallery Approval Flow
-- Run once in Supabase SQL Editor before testing resident photo uploads.
-- Uses existing public Storage bucket: community-gallery

create extension if not exists pgcrypto;

create table if not exists public.resident_gallery_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  resident_id uuid,
  resident_name text,
  resident_email text,
  caption text,
  image_path text not null,
  status text not null default 'pending',
  scope text not null default 'community',
  post_source text not null default 'resident',
  area_key text,
  category text,
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.resident_gallery_posts add column if not exists company_id uuid;
alter table public.resident_gallery_posts add column if not exists community_id uuid;
alter table public.resident_gallery_posts add column if not exists community_name text;
alter table public.resident_gallery_posts add column if not exists resident_id uuid;
alter table public.resident_gallery_posts add column if not exists resident_name text;
alter table public.resident_gallery_posts add column if not exists resident_email text;
alter table public.resident_gallery_posts add column if not exists caption text;
alter table public.resident_gallery_posts add column if not exists image_path text;
alter table public.resident_gallery_posts add column if not exists status text default 'pending';
alter table public.resident_gallery_posts add column if not exists scope text default 'community';
alter table public.resident_gallery_posts add column if not exists post_source text default 'resident';
alter table public.resident_gallery_posts add column if not exists area_key text;
alter table public.resident_gallery_posts add column if not exists category text;
alter table public.resident_gallery_posts add column if not exists likes_count integer default 0;
alter table public.resident_gallery_posts add column if not exists created_at timestamptz default now();
alter table public.resident_gallery_posts add column if not exists updated_at timestamptz default now();
alter table public.resident_gallery_posts add column if not exists reviewed_at timestamptz;

create table if not exists public.resident_gallery_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.resident_gallery_posts(id) on delete cascade,
  resident_id uuid,
  resident_email text,
  commenter_name text,
  comment text not null,
  status text not null default 'visible',
  created_at timestamptz not null default now()
);

create table if not exists public.resident_gallery_notifications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.resident_gallery_posts(id) on delete cascade,
  community_id uuid,
  community_name text,
  recipient_resident_id uuid,
  recipient_email text,
  recipient_name text,
  actor_resident_id uuid,
  actor_email text,
  actor_name text,
  notification_type text,
  message text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_resident_gallery_posts_status_community on public.resident_gallery_posts(status, community_id, created_at desc);
create index if not exists idx_resident_gallery_posts_status_name on public.resident_gallery_posts(status, community_name, created_at desc);
create index if not exists idx_resident_gallery_comments_post on public.resident_gallery_comments(post_id, created_at);

alter table public.resident_gallery_posts enable row level security;
alter table public.resident_gallery_comments enable row level security;
alter table public.resident_gallery_notifications enable row level security;

drop policy if exists "resident gallery posts read" on public.resident_gallery_posts;
create policy "resident gallery posts read" on public.resident_gallery_posts for select using (true);

drop policy if exists "resident gallery posts insert" on public.resident_gallery_posts;
create policy "resident gallery posts insert" on public.resident_gallery_posts for insert with check (true);

drop policy if exists "resident gallery posts update" on public.resident_gallery_posts;
create policy "resident gallery posts update" on public.resident_gallery_posts for update using (true) with check (true);

drop policy if exists "resident gallery comments read" on public.resident_gallery_comments;
create policy "resident gallery comments read" on public.resident_gallery_comments for select using (true);

drop policy if exists "resident gallery comments insert" on public.resident_gallery_comments;
create policy "resident gallery comments insert" on public.resident_gallery_comments for insert with check (true);

drop policy if exists "gallery notifications read" on public.resident_gallery_notifications;
create policy "gallery notifications read" on public.resident_gallery_notifications for select using (true);

drop policy if exists "gallery notifications insert" on public.resident_gallery_notifications;
create policy "gallery notifications insert" on public.resident_gallery_notifications for insert with check (true);

drop policy if exists "gallery notifications update" on public.resident_gallery_notifications;
create policy "gallery notifications update" on public.resident_gallery_notifications for update using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('community-gallery', 'community-gallery', true)
on conflict (id) do update set public = true;

drop policy if exists "community gallery storage read" on storage.objects;
create policy "community gallery storage read" on storage.objects for select
using (bucket_id = 'community-gallery');

drop policy if exists "community gallery storage upload" on storage.objects;
create policy "community gallery storage upload" on storage.objects for insert
with check (bucket_id = 'community-gallery');

drop policy if exists "community gallery storage update" on storage.objects;
create policy "community gallery storage update" on storage.objects for update
using (bucket_id = 'community-gallery')
with check (bucket_id = 'community-gallery');

alter table public.resident_gallery_posts replica identity full;
alter table public.resident_gallery_comments replica identity full;
alter table public.resident_gallery_notifications replica identity full;
