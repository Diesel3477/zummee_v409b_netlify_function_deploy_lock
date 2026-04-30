-- Community Documents resident view setup
-- Employees/supervisors will upload/manage these documents in a later management page.
-- Residents only read/download records for their community.

create table if not exists community_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  title text not null,
  description text,
  category text default 'General',
  file_url text,
  file_path text,
  bucket_name text default 'community_documents',
  is_active boolean default true,
  uploaded_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table community_documents enable row level security;

drop policy if exists "Community documents are readable" on community_documents;
create policy "Community documents are readable"
on community_documents
for select
to authenticated
using (is_active is not false);

-- Broad authenticated management policy for now, matching the current app pattern.
-- Tighten to employee/supervisor/admin roles when the employee upload page is built.
drop policy if exists "Authenticated users can manage community documents" on community_documents;
create policy "Authenticated users can manage community documents"
on community_documents
for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('community_documents', 'community_documents', true)
on conflict (id) do nothing;
