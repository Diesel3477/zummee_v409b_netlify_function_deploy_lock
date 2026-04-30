-- Board-first annual meeting notice routing
create table if not exists annual_meeting_board_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references annual_meeting_packet_requests(id) on delete cascade,
  board_user_id uuid not null,
  decision text not null default 'approved',
  created_at timestamptz not null default now()
);

create unique index if not exists annual_meeting_board_approvals_request_user_idx
on annual_meeting_board_approvals(request_id, board_user_id);

alter table if exists annual_meeting_packet_requests
add column if not exists board_approved_at timestamptz;
