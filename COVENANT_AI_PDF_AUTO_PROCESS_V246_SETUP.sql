-- Zummee v246 Covenant AI PDF Auto-Processing setup
-- Run after the base Covenant AI Assistant setup.

-- 1) Vector support for optional semantic embeddings.
create extension if not exists vector with schema extensions;

-- 2) Document table safety.
create table if not exists community_ai_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  document_name text not null,
  document_type text,
  file_path text not null,
  file_url text,
  uploaded_by uuid,
  created_at timestamptz default now()
);

-- 3) Chunk table safety.
create table if not exists community_ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references community_ai_documents(id) on delete cascade,
  community_id uuid not null,
  content text,
  chunk_text text,
  document_name text,
  document_type text,
  section_title text,
  page_reference text,
  page_number integer,
  embedding extensions.vector(1536),
  created_by uuid,
  created_at timestamptz default now()
);

-- 4) Add missing columns safely if your table was created from an older setup.
alter table community_ai_document_chunks
add column if not exists content text,
add column if not exists chunk_text text,
add column if not exists document_name text,
add column if not exists document_type text,
add column if not exists page_reference text,
add column if not exists created_by uuid,
add column if not exists embedding extensions.vector(1536);

-- Keep both old/new text columns populated for compatibility.
update community_ai_document_chunks
set content = coalesce(content, chunk_text),
    chunk_text = coalesce(chunk_text, content)
where content is null or chunk_text is null;

-- 5) Performance indexes.
create index if not exists idx_ai_chunks_community
on community_ai_document_chunks(community_id);

create index if not exists idx_ai_chunks_document
on community_ai_document_chunks(document_id);

create index if not exists idx_ai_chunks_text_search
on community_ai_document_chunks
using gin (to_tsvector('english', coalesce(content, chunk_text, '')));

create index if not exists idx_ai_chunks_embedding
on community_ai_document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- 6) Storage bucket for PDFs.
insert into storage.buckets (id, name, public)
values ('community-ai-documents', 'community-ai-documents', true)
on conflict (id) do update set public = true;

-- 7) RLS policies. These are permissive to match the current Zummee dev/build pattern.
alter table community_ai_documents enable row level security;
alter table community_ai_document_chunks enable row level security;

drop policy if exists "Read community AI documents" on community_ai_documents;
create policy "Read community AI documents"
on community_ai_documents for select
using (true);

drop policy if exists "Upload community AI documents" on community_ai_documents;
create policy "Upload community AI documents"
on community_ai_documents for insert
with check (true);

drop policy if exists "Read community AI document chunks" on community_ai_document_chunks;
create policy "Read community AI document chunks"
on community_ai_document_chunks for select
using (true);

drop policy if exists "Insert community AI document chunks" on community_ai_document_chunks;
create policy "Insert community AI document chunks"
on community_ai_document_chunks for insert
with check (true);
