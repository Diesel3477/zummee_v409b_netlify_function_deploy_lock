-- Zummee Covenant AI Assistant v247
-- Section-aware chunking + better citation/embedding metadata

alter table community_ai_document_chunks
add column if not exists article_title text,
add column if not exists section_number text,
add column if not exists citation_label text,
add column if not exists chunk_hash text,
add column if not exists embedding_model text,
add column if not exists embedded_at timestamptz,
add column if not exists chunk_index integer,
add column if not exists token_count integer,
add column if not exists token_estimate integer,
add column if not exists source_page_start integer,
add column if not exists source_page_end integer;

-- Backfill existing rows so the unique index can be created safely.
update community_ai_document_chunks
set chunk_hash = md5(coalesce(document_id::text,'') || '|' || coalesce(content,'') || '|' || coalesce(section_title,''))
where chunk_hash is null;

create unique index if not exists idx_ai_chunks_unique_hash
on community_ai_document_chunks(document_id, chunk_hash);

create index if not exists idx_ai_chunks_section_number
on community_ai_document_chunks(section_number);

create index if not exists idx_ai_chunks_citation_label
on community_ai_document_chunks(citation_label);

create index if not exists idx_ai_chunks_article_title
on community_ai_document_chunks(article_title);

create index if not exists idx_ai_chunks_doc_chunk_index
on community_ai_document_chunks(document_id, chunk_index);

-- Optional full-text backup search.
create index if not exists idx_ai_chunks_text_search
on community_ai_document_chunks
using gin (to_tsvector('english', content));

alter table community_ai_documents
add column if not exists processing_status text default 'pending',
add column if not exists processed_at timestamptz,
add column if not exists page_count integer;
