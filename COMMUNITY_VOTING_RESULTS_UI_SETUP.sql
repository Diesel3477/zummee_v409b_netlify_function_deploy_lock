-- Community Voting Results UI support
-- Safe to run after COMMUNITY_VOTING_RESIDENT_SETUP.sql

create or replace view community_voting_results as
select
  e.id as election_id,
  e.company_id,
  e.community_id,
  e.community_name,
  e.title as election_title,
  c.id as candidate_id,
  c.candidate_name,
  count(v.id)::int as total_votes
from community_voting_elections e
join community_voting_candidates c on c.election_id = e.id
left join community_voting_votes v on v.candidate_id = c.id and v.election_id = e.id
group by e.id, e.company_id, e.community_id, e.community_name, e.title, c.id, c.candidate_name;

create index if not exists idx_community_voting_votes_election
on community_voting_votes(election_id);

create index if not exists idx_community_voting_votes_candidate
on community_voting_votes(candidate_id);
