-- V211 Community Voting High Impact Results Setup
-- Adds resident release banner support, participation metrics, result email queue metadata, and audit-friendly views.

alter table community_voting_elections
add column if not exists results_visibility text default 'hidden';

alter table community_voting_elections
add column if not exists results_released boolean default false;

alter table community_voting_elections
add column if not exists results_released_at timestamptz;

alter table community_voting_elections
add column if not exists results_visible boolean default false;

create table if not exists community_voting_result_emails (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references community_voting_elections(id) on delete cascade,
  community_id uuid,
  results_visibility text default 'winners_only',
  email_subject text,
  email_body text,
  status text default 'pending',
  sent_by uuid,
  sent_by_name text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

alter table community_voting_result_emails enable row level security;

drop policy if exists "Read voting result emails" on community_voting_result_emails;
create policy "Read voting result emails"
on community_voting_result_emails
for select
to authenticated
using (true);

drop policy if exists "Manage voting result emails" on community_voting_result_emails;
create policy "Manage voting result emails"
on community_voting_result_emails
for all
to authenticated
using (true)
with check (true);

create or replace view community_voting_results as
select
  e.id as election_id,
  e.company_id,
  e.community_id,
  e.community_name,
  e.title as election_title,
  e.max_votes,
  e.results_visibility,
  e.results_released,
  e.results_released_at,
  c.id as candidate_id,
  c.candidate_name,
  count(v.id) as total_votes,
  count(distinct v.resident_id) as total_voters
from community_voting_elections e
join community_voting_candidates c on c.election_id = e.id
left join community_voting_votes v on v.candidate_id = c.id and v.election_id = e.id
group by e.id, e.company_id, e.community_id, e.community_name, e.title, e.max_votes, e.results_visibility, e.results_released, e.results_released_at, c.id, c.candidate_name;

create or replace view community_voting_winners as
select *
from (
  select
    r.*,
    rank() over (partition by r.election_id order by r.total_votes desc) as winner_rank
  from community_voting_results r
) ranked
where winner_rank <= greatest(1, coalesce(max_votes, 1));

create or replace view community_voting_participation as
select
  election_id,
  count(distinct resident_id) as total_voters,
  count(*) as total_vote_selections
from community_voting_votes
group by election_id;

create index if not exists idx_community_voting_votes_election_resident
on community_voting_votes(election_id, resident_id);

create index if not exists idx_community_voting_result_emails_status
on community_voting_result_emails(status);
