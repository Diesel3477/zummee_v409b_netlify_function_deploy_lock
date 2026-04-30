-- Optional support table for ACC live activity events.
-- Manager Hub v234 also reads architectural_change_requests directly, so this is safe even if you skip it.

create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  event_type text,
  priority text,
  title text,
  message text,
  link_url text,
  source_table text,
  source_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_notification_events_community_created
on notification_events (community_id, created_at desc);

create index if not exists idx_notification_events_event_type
on notification_events (event_type);

alter table notification_events enable row level security;

drop policy if exists "Read notification events" on notification_events;
create policy "Read notification events"
on notification_events for select
using (true);

drop policy if exists "Insert notification events" on notification_events;
create policy "Insert notification events"
on notification_events for insert
with check (true);
