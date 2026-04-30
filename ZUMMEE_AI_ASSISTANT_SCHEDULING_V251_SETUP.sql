-- v251 Zummee AI Assistant scheduling action layer
-- Personal manager calendar. Community calendar uses existing CommunityCalendarEvents table used by Board Member Hub.
create table if not exists manager_calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  manager_user_id uuid,
  title text not null,
  event_date date not null,
  event_time time,
  notes text,
  source text default 'ai_assistant',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_manager_calendar_events_user on manager_calendar_events(manager_user_id);
create index if not exists idx_manager_calendar_events_community on manager_calendar_events(community_id);
create index if not exists idx_manager_calendar_events_date on manager_calendar_events(event_date);
alter table manager_calendar_events enable row level security;
drop policy if exists "Managers can read personal calendar events" on manager_calendar_events;
create policy "Managers can read personal calendar events" on manager_calendar_events for select using (true);
drop policy if exists "Managers can create personal calendar events" on manager_calendar_events;
create policy "Managers can create personal calendar events" on manager_calendar_events for insert with check (true);
drop policy if exists "Managers can update personal calendar events" on manager_calendar_events;
create policy "Managers can update personal calendar events" on manager_calendar_events for update using (true) with check (true);
create or replace function set_manager_calendar_events_updated_at() returns trigger as $$ begin new.updated_at = now(); return new; end; $$ language plpgsql;
drop trigger if exists trg_manager_calendar_events_updated_at on manager_calendar_events;
create trigger trg_manager_calendar_events_updated_at before update on manager_calendar_events for each row execute function set_manager_calendar_events_updated_at();
alter publication supabase_realtime add table manager_calendar_events;
