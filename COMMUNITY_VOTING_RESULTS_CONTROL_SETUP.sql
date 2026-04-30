-- V210 Community Voting Results Control
-- Adds board/supervisor results visibility, release controls, audit support, and email-result logging.

alter table community_voting_elections
add column if not exists results_visibility text default 'hidden';

alter table community_voting_elections
add column if not exists results_released boolean default false;

alter table community_voting_elections
add column if not exists results_released_at timestamptz;

alter table community_voting_elections
add column if not exists results_emailed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'community_voting_results_visibility_check'
  ) then
    alter table community_voting_elections
    add constraint community_voting_results_visibility_check
    check (results_visibility in ('hidden','winners_only','totals'));
  end if;
end $$;

create table if not exists community_voting_result_emails (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references community_voting_elections(id) on delete cascade,
  community_id uuid,
  results_visibility text default 'winners_only',
  email_subject text,
  email_body text,
  sent_by uuid,
  sent_by_name text,
  created_at timestamptz default now()
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
  c.id as candidate_id,
  c.candidate_name,
  count(v.id)::int as total_votes
from community_voting_elections e
join community_voting_candidates c on c.election_id = e.id
left join community_voting_votes v on v.candidate_id = c.id and v.election_id = e.id
group by e.id, e.company_id, e.community_id, e.community_name, e.title, e.max_votes, e.results_visibility, e.results_released, c.id, c.candidate_name;

create or replace view community_voting_winners as
select *
from (
  select
    r.*,
    rank() over (partition by r.election_id order by r.total_votes desc) as winner_rank
  from community_voting_results r
) ranked
where winner_rank <= greatest(1, coalesce(max_votes, 1));

create index if not exists idx_community_voting_result_emails_election
on community_voting_result_emails(election_id);
