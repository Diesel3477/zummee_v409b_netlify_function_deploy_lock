create table if not exists community_announcements (
  id uuid primary key default gen_random_uuid(),
  type text default 'annual_meeting_notice',
  community_id uuid not null,
  title text,
  body text,
  meeting_link text,
  meeting_date date,
  meeting_time text,
  nomination_deadline date,
  proxy_return_deadline date,
  association_legal_name text,
  community_name text,
  meeting_format text,
  meeting_location text,
  expires_at date,
  created_at timestamptz default now()
);

create index if not exists idx_community_announcements_community_created
  on community_announcements (community_id, created_at desc);
