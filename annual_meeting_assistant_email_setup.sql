-- Run this before using the assistant email mailing workflow.

alter table if exists userdirectory
add column if not exists assistant_email text;

alter table if exists annual_meeting_packet_requests
add column if not exists mailing_confirm_token text;

alter table if exists annual_meeting_packet_requests
add column if not exists mailing_email_sent_at timestamptz;

alter table if exists annual_meeting_packet_requests
add column if not exists mailing_confirmed_at timestamptz;
