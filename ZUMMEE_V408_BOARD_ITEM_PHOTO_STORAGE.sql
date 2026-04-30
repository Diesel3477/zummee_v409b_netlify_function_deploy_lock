-- Zummee v408 Board Item Photo Storage
-- Creates the Supabase Storage bucket used by Board Member Hub photo attachments.
-- Safe to run more than once.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-item-photos',
  'board-item-photos',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read policy for generated photo thumbnails/links.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'board item photos public read'
  ) then
    create policy "board item photos public read"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'board-item-photos');
  end if;
end $$;

-- Upload policy. This supports the current app pattern where employee context is app-managed.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'board item photos upload'
  ) then
    create policy "board item photos upload"
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'board-item-photos');
  end if;
end $$;

-- Optional replacement/update support if a file ever needs to be overwritten by future UI.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'board item photos update'
  ) then
    create policy "board item photos update"
    on storage.objects
    for update
    to anon, authenticated
    using (bucket_id = 'board-item-photos')
    with check (bucket_id = 'board-item-photos');
  end if;
end $$;
