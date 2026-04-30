-- Zummee ACC Board Approval Workflow

-- Main ACC request table upgrades
create table if not exists architectural_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid not null,
  resident_id uuid,
  resident_email text,
  resident_name text,
  address text,
  request_title text not null,
  request_type text,
  description text,
  file_path text,
  status text default 'pending_board_review',
  board_question text,
  reviewer_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_at timestamptz,
  resident_notified_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table architectural_change_requests
add column if not exists board_question text,
add column if not exists approved_at timestamptz,
add column if not exists resident_notified_at timestamptz;

alter table architectural_change_requests
alter column status set default 'pending_board_review';

create index if not exists idx_architectural_change_requests_community on architectural_change_requests (community_id);
create index if not exists idx_architectural_change_requests_resident on architectural_change_requests (resident_id);
create index if not exists idx_architectural_change_requests_email on architectural_change_requests (resident_email);
create index if not exists idx_architectural_change_requests_status on architectural_change_requests (status);

alter table architectural_change_requests enable row level security;

drop policy if exists "Residents and staff can read ACC requests" on architectural_change_requests;
create policy "Residents and staff can read ACC requests"
on architectural_change_requests
for select
using (true);

drop policy if exists "Residents can submit ACC requests" on architectural_change_requests;
create policy "Residents can submit ACC requests"
on architectural_change_requests
for insert
with check (true);

drop policy if exists "Staff and board can update ACC requests" on architectural_change_requests;
create policy "Staff and board can update ACC requests"
on architectural_change_requests
for update
using (true)
with check (true);

-- One vote/action per board member per ACC request.
create table if not exists architectural_change_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references architectural_change_requests(id) on delete cascade,
  board_user_id uuid,
  board_email text not null,
  vote text not null check (vote in ('approve','reject','question')),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (request_id, board_email)
);

create index if not exists idx_acc_votes_request on architectural_change_request_votes (request_id);
create index if not exists idx_acc_votes_email on architectural_change_request_votes (board_email);
create index if not exists idx_acc_votes_vote on architectural_change_request_votes (vote);

alter table architectural_change_request_votes enable row level security;

drop policy if exists "Board can read ACC votes" on architectural_change_request_votes;
create policy "Board can read ACC votes"
on architectural_change_request_votes
for select
using (true);

drop policy if exists "Board can insert ACC votes" on architectural_change_request_votes;
create policy "Board can insert ACC votes"
on architectural_change_request_votes
for insert
with check (true);

drop policy if exists "Board can update ACC votes" on architectural_change_request_votes;
create policy "Board can update ACC votes"
on architectural_change_request_votes
for update
using (true)
with check (true);

-- Storage bucket needed by the ACC upload page:
-- Supabase Storage bucket name: acc-request-files
-- Recommended during testing: public read enabled so attachments open from resident/board pages.
