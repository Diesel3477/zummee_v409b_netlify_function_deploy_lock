-- V243 Gallery Like + Comment Notifications
alter table if exists resident_gallery_posts add column if not exists resident_email text;
alter table if exists resident_gallery_comments add column if not exists resident_email text;
create table if not exists resident_gallery_notifications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references resident_gallery_posts(id) on delete cascade,
  community_id uuid,
  community_name text,
  recipient_resident_id uuid,
  recipient_email text,
  recipient_name text,
  actor_resident_id uuid,
  actor_email text,
  actor_name text,
  notification_type text not null check (notification_type in ('like','comment')),
  message text not null,
  is_read boolean default false,
  created_at timestamptz default now(),
  read_at timestamptz
);
create index if not exists idx_resident_gallery_notifications_recipient_id on resident_gallery_notifications(recipient_resident_id, created_at desc);
create index if not exists idx_resident_gallery_notifications_recipient_email on resident_gallery_notifications(recipient_email, created_at desc);
create index if not exists idx_resident_gallery_notifications_post on resident_gallery_notifications(post_id, created_at desc);
alter table resident_gallery_notifications enable row level security;
drop policy if exists "gallery notifications read" on resident_gallery_notifications;
create policy "gallery notifications read" on resident_gallery_notifications for select using (true);
drop policy if exists "gallery notifications insert" on resident_gallery_notifications;
create policy "gallery notifications insert" on resident_gallery_notifications for insert with check (true);
drop policy if exists "gallery notifications update" on resident_gallery_notifications;
create policy "gallery notifications update" on resident_gallery_notifications for update using (true) with check (true);
alter table resident_gallery_notifications replica identity full;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='resident_gallery_notifications') then
    alter publication supabase_realtime add table public.resident_gallery_notifications;
  end if;
end $$;
