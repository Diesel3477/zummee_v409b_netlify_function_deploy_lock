-- Covenant AI generation production support
-- Safe to run after the original Covenant AI Assistant SQL.

create extension if not exists vector with schema extensions;

-- If your chunk table was already created without vector, this keeps it compatible.
alter table community_ai_document_chunks
add column if not exists document_name text,
add column if not exists document_type text,
add column if not exists page_reference text,
add column if not exists chunk_text text,
add column if not exists created_by uuid,
add column if not exists ai_summary text,
add column if not exists embedding extensions.vector(1536);

-- If you used the earlier content column, keep both available.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='community_ai_document_chunks' and column_name='content'
  ) then
    update community_ai_document_chunks
    set chunk_text = coalesce(chunk_text, content)
    where chunk_text is null;
  end if;
end $$;

alter table covenant_questions
add column if not exists subject text,
add column if not exists resident_address text,
add column if not exists draft_answer text,
add column if not exists final_answer text,
add column if not exists citations text,
add column if not exists ai_confidence text,
add column if not exists manager_approved_by uuid,
add column if not exists manager_approved_at timestamptz,
add column if not exists updated_at timestamptz;

-- Make status flexible for manager review workflow.
alter table covenant_questions
alter column status set default 'manager_review';

-- If an old strict check constraint exists, remove common versions so new states work.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'covenant_questions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table covenant_questions drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table covenant_questions
add constraint covenant_questions_status_check
check (status in ('manager_review','pending','draft_ready','approved_response','answered','rejected'));

create index if not exists idx_ai_chunks_text_search
on community_ai_document_chunks using gin (to_tsvector('english', coalesce(chunk_text, content, '')));

create index if not exists idx_covenant_questions_updated
on covenant_questions(updated_at desc);

-- Optional realtime for manager queue updates.
alter publication supabase_realtime add table covenant_questions;
