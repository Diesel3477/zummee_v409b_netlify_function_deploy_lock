-- Zummee Covenant AI Assistant setup
-- Safe workflow: resident question -> AI/manager draft -> manager-approved response.

create table if not exists community_ai_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  document_name text not null,
  document_type text default 'Covenants',
  source_document_id uuid,
  file_path text,
  file_url text,
  is_active boolean default true,
  uploaded_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists community_ai_document_chunks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  document_id uuid references community_ai_documents(id) on delete cascade,
  document_name text not null,
  document_type text default 'Covenants',
  page_reference text,
  section_reference text,
  chunk_text text not null,
  created_by uuid,
  created_at timestamptz default now()
);

create table if not exists covenant_questions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  resident_id uuid,
  resident_name text,
  resident_email text,
  resident_address text,
  subject text not null,
  question text not null,
  status text default 'manager_review' check (status in ('manager_review','draft_ready','approved_response','rejected','needs_more_info')),
  draft_answer text,
  final_answer text,
  citations text,
  confidence text,
  manager_notes text,
  manager_approved_by uuid,
  manager_approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_community_ai_documents_community on community_ai_documents(community_id);
create index if not exists idx_community_ai_chunks_community on community_ai_document_chunks(community_id);
create index if not exists idx_community_ai_chunks_type on community_ai_document_chunks(document_type);
create index if not exists idx_covenant_questions_community on covenant_questions(community_id);
create index if not exists idx_covenant_questions_resident_email on covenant_questions(resident_email);
create index if not exists idx_covenant_questions_status on covenant_questions(status);

alter table community_ai_documents enable row level security;
alter table community_ai_document_chunks enable row level security;
alter table covenant_questions enable row level security;

drop policy if exists "Read active AI documents" on community_ai_documents;
create policy "Read active AI documents" on community_ai_documents for select using (is_active = true);
drop policy if exists "Managers can manage AI documents" on community_ai_documents;
create policy "Managers can manage AI documents" on community_ai_documents for all using (true) with check (true);

drop policy if exists "Read AI document chunks" on community_ai_document_chunks;
create policy "Read AI document chunks" on community_ai_document_chunks for select using (true);
drop policy if exists "Managers can manage AI document chunks" on community_ai_document_chunks;
create policy "Managers can manage AI document chunks" on community_ai_document_chunks for all using (true) with check (true);

drop policy if exists "Read covenant questions" on covenant_questions;
create policy "Read covenant questions" on covenant_questions for select using (true);
drop policy if exists "Residents can submit covenant questions" on covenant_questions;
create policy "Residents can submit covenant questions" on covenant_questions for insert with check (true);
drop policy if exists "Managers can update covenant questions" on covenant_questions;
create policy "Managers can update covenant questions" on covenant_questions for update using (true) with check (true);

create or replace function set_covenant_questions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_covenant_questions_updated_at on covenant_questions;
create trigger trg_covenant_questions_updated_at before update on covenant_questions for each row execute function set_covenant_questions_updated_at();

-- Optional realtime for manager queue / resident answer visibility
alter publication supabase_realtime add table covenant_questions;
