create table if not exists community_voting_elections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  title text not null,
  description text,
  max_votes int default 1,
  status text default 'draft' check (status in ('draft','open','closed','results')),
  results_visible boolean default false,
  start_at timestamptz,
  end_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists community_voting_candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references community_voting_elections(id) on delete cascade,
  candidate_name text not null,
  candidate_bio text,
  display_order int default 0,
  created_at timestamptz default now()
);

create table if not exists community_voting_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references community_voting_elections(id) on delete cascade,
  candidate_id uuid not null references community_voting_candidates(id) on delete cascade,
  resident_id uuid,
  resident_name text,
  created_at timestamptz default now()
);

create table if not exists community_voting_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  document_title text not null,
  document_type text default 'annual_meeting',
  file_url text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table community_voting_elections enable row level security;
alter table community_voting_candidates enable row level security;
alter table community_voting_votes enable row level security;
alter table community_voting_documents enable row level security;

drop policy if exists "Read voting elections" on community_voting_elections;
create policy "Read voting elections" on community_voting_elections for select to authenticated using (true);
drop policy if exists "Manage voting elections" on community_voting_elections;
create policy "Manage voting elections" on community_voting_elections for all to authenticated using (true) with check (true);

drop policy if exists "Read voting candidates" on community_voting_candidates;
create policy "Read voting candidates" on community_voting_candidates for select to authenticated using (true);
drop policy if exists "Manage voting candidates" on community_voting_candidates;
create policy "Manage voting candidates" on community_voting_candidates for all to authenticated using (true) with check (true);

drop policy if exists "Read voting votes" on community_voting_votes;
create policy "Read voting votes" on community_voting_votes for select to authenticated using (true);
drop policy if exists "Insert voting votes" on community_voting_votes;
create policy "Insert voting votes" on community_voting_votes for insert to authenticated with check (true);

drop policy if exists "Read voting documents" on community_voting_documents;
create policy "Read voting documents" on community_voting_documents for select to authenticated using (true);
drop policy if exists "Manage voting documents" on community_voting_documents;
create policy "Manage voting documents" on community_voting_documents for all to authenticated using (true) with check (true);

create unique index if not exists one_vote_choice_per_resident on community_voting_votes(election_id,candidate_id,resident_id);
create index if not exists idx_voting_elections_community on community_voting_elections(community_id);
create index if not exists idx_voting_documents_community on community_voting_documents(community_id);
