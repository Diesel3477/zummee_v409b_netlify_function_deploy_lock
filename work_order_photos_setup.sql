-- Run in Supabase SQL editor

insert into storage.buckets (id, name, public)
values ('work-order-photos', 'work-order-photos', false)
on conflict (id) do nothing;

create table if not exists public.work_order_photos (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null,
  uploader_type text not null check (uploader_type in ('resident','vendor')),
  uploader_email text,
  file_path text not null,
  file_name text,
  content_type text,
  created_at timestamptz not null default now()
);

create index if not exists work_order_photos_work_order_idx
  on public.work_order_photos (work_order_id, created_at desc);