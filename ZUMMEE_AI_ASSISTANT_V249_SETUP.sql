-- Zummee AI Assistant setup (v249)
create table if not exists zummee_ai_assistant_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  user_id uuid,
  user_email text,
  mode text check (mode in ('schedule','covenants','route','auto')),
  prompt text not null,
  response text,
  created_at timestamptz default now()
);
create index if not exists idx_zummee_ai_logs_community on zummee_ai_assistant_logs(community_id, created_at desc);
alter table zummee_ai_assistant_logs enable row level security;
drop policy if exists "Managers can read AI assistant logs" on zummee_ai_assistant_logs;
create policy "Managers can read AI assistant logs" on zummee_ai_assistant_logs for select using (true);
drop policy if exists "Managers can insert AI assistant logs" on zummee_ai_assistant_logs;
create policy "Managers can insert AI assistant logs" on zummee_ai_assistant_logs for insert with check (true);

create table if not exists manager_reminders (
  id uuid primary key default gen_random_uuid(),
  community_id uuid,
  title text not null,
  reminder_type text,
  reminder_date date,
  reminder_time time,
  source text,
  source_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_manager_reminders_community_date on manager_reminders(community_id, reminder_date);
alter table manager_reminders enable row level security;
drop policy if exists "Managers can read reminders" on manager_reminders;
create policy "Managers can read reminders" on manager_reminders for select using (true);
drop policy if exists "Managers can create reminders" on manager_reminders;
create policy "Managers can create reminders" on manager_reminders for insert with check (true);
drop policy if exists "Managers can update reminders" on manager_reminders;
create policy "Managers can update reminders" on manager_reminders for update using (true) with check (true);
