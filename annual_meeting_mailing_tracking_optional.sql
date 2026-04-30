-- Optional mailing tracking fields
alter table if exists annual_meeting_packet_requests
add column if not exists mailed_at timestamptz;

alter table if exists annual_meeting_packet_requests
add column if not exists mailed_by text;
