-- Resident Community Gallery with Board Approval
-- Run this once in Supabase SQL before testing photo uploads.

create extension if not exists pgcrypto;

create table if not exists resident_gallery_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  resident_id uuid,
  resident_name text,
  caption text,
  image_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  likes_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists resident_gallery_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references resident_gallery_posts(id) on delete cascade,
  resident_id uuid,
  commenter_name text,
  comment text not null,
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now()
);

alter table resident_gallery_posts enable row level security;
alter table resident_gallery_comments enable row level security;

drop policy if exists "resident gallery posts read" on resident_gallery_posts;
create policy "resident gallery posts read"
on resident_gallery_posts for select
to authenticated
using (true);

drop policy if exists "resident gallery posts insert" on resident_gallery_posts;
create policy "resident gallery posts insert"
on resident_gallery_posts for insert
to authenticated
with check (true);

drop policy if exists "resident gallery posts update" on resident_gallery_posts;
create policy "resident gallery posts update"
on resident_gallery_posts for update
to authenticated
using (true)
with check (true);

drop policy if exists "resident gallery comments read" on resident_gallery_comments;
create policy "resident gallery comments read"
on resident_gallery_comments for select
to authenticated
using (true);

drop policy if exists "resident gallery comments insert" on resident_gallery_comments;
create policy "resident gallery comments insert"
on resident_gallery_comments for insert
to authenticated
with check (true);

insert into storage.buckets (id, name, public)
values ('resident_gallery', 'resident_gallery', true)
on conflict (id) do update set public = true;

drop policy if exists "resident gallery storage read" on storage.objects;
create policy "resident gallery storage read"
on storage.objects for select
to authenticated
using (bucket_id = 'resident_gallery');

drop policy if exists "resident gallery storage upload" on storage.objects;
create policy "resident gallery storage upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'resident_gallery');

drop policy if exists "resident gallery storage update" on storage.objects;
create policy "resident gallery storage update"
on storage.objects for update
to authenticated
using (bucket_id = 'resident_gallery')
with check (bucket_id = 'resident_gallery');
