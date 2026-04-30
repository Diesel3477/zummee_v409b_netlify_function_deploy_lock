-- Zummee v409 board photo upload notes
-- Uploads now run through Netlify function: /.netlify/functions/upload-board-photo
-- Required Netlify env vars:
--   SUPABASE_URL
--   SUPABASE_SERVICE_ROLE_KEY
--
-- Bucket should exist and remain private. This is safe if already created.
insert into storage.buckets (id, name, public)
values ('board-item-photos', 'board-item-photos', false)
on conflict (id) do update set public = false;

-- Client insert policies are no longer required for this bucket.
-- The server function validates community_assignments and uploads with the service role.
