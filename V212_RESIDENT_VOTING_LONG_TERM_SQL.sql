-- Zummee V212 Resident Voting Long-Term Security + Results Support
-- Use this with the long-term tables: elections, candidates, votes.

create extension if not exists pgcrypto;

create table if not exists elections (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null,
  title text not null,
  description text,
  status text default 'draft', -- draft | active | closed
  visibility text default 'hidden', -- hidden | released
  created_at timestamptz default now()
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  name text not null,
  bio text,
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id) on delete cascade,
  candidate_id uuid not null references candidates(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists one_vote_per_user
on votes(election_id, voter_id);

create index if not exists idx_elections_community_status
on elections(community_id, status, visibility);

create index if not exists idx_candidates_election
on candidates(election_id);

create index if not exists idx_votes_election_candidate
on votes(election_id, candidate_id);

alter table elections enable row level security;
alter table candidates enable row level security;
alter table votes enable row level security;

-- Residents and employees can read elections/candidates. App-side community filtering controls display.
drop policy if exists "Read elections" on elections;
create policy "Read elections" on elections
for select to authenticated
using (true);

drop policy if exists "Read candidates" on candidates;
create policy "Read candidates" on candidates
for select to authenticated
using (true);

-- Voters may only see their own vote records. Released totals come from the RPC below.
drop policy if exists "Read own votes" on votes;
create policy "Read own votes" on votes
for select to authenticated
using (auth.uid() = voter_id);

drop policy if exists "Insert own vote" on votes;
create policy "Insert own vote" on votes
for insert to authenticated
with check (auth.uid() = voter_id);

-- No public update/delete policy for votes. Ballots are locked after submit.

create or replace function public.get_election_results(p_election_id uuid)
returns table (
  candidate_id uuid,
  candidate_name text,
  candidate_bio text,
  votes integer
)
language sql
security definer
set search_path = public
as $$
  select
    c.id as candidate_id,
    c.name as candidate_name,
    c.bio as candidate_bio,
    count(v.id)::int as votes
  from elections e
  join candidates c on c.election_id = e.id
  left join votes v on v.election_id = e.id and v.candidate_id = c.id
  where e.id = p_election_id
    and e.visibility = 'released'
  group by c.id, c.name, c.bio
  order by count(v.id) desc, c.name asc;
$$;

grant execute on function public.get_election_results(uuid) to authenticated;
