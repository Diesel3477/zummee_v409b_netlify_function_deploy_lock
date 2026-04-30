-- Community Documents management setup
-- Supervisors/Admin upload PDFs. Employees and residents read PDF documents for their community.

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
  uploaded_by_name text,
  uploaded_by_role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table community_documents add column if not exists uploaded_by_name text;
alter table community_documents add column if not exists uploaded_by_role text;
alter table community_documents add column if not exists updated_at timestamptz default now();

create index if not exists community_documents_community_id_idx on community_documents(community_id);
create index if not exists community_documents_company_id_idx on community_documents(company_id);
create index if not exists community_documents_active_idx on community_documents(is_active);

alter table community_documents enable row level security;

drop policy if exists "Community documents are readable" on community_documents;
create policy "Community documents are readable"
on community_documents
for select
to authenticated
using (is_active is not false);

-- Frontend limits upload controls to Supervisor/Admin. This policy keeps the current app's authenticated-write pattern.
drop policy if exists "Authenticated users can manage community documents" on community_documents;
create policy "Authenticated users can manage community documents"
on community_documents
for all
to authenticated
using (true)
with check (true);

insert into storage.buckets (id, name, public)
values ('community_documents', 'community_documents', true)
on conflict (id) do update set public = true;

-- Storage policies are safe to run repeatedly; ignore notices if names already exist.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Community document PDFs are readable') then
    create policy "Community document PDFs are readable"
    on storage.objects for select
    to authenticated
    using (bucket_id = 'community_documents');
  end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated users can upload community PDFs') then
    create policy "Authenticated users can upload community PDFs"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'community_documents');
  end if;
end $$;
