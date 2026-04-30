-- V196 Resident-to-Property-Manager Messaging
create table if not exists resident_manager_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  community_id uuid,
  community_name text,
  resident_id uuid,
  resident_name text,
  resident_email text,
  manager_user_id uuid,
  manager_name text,
  manager_email text,
  subject text,
  message text not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists resident_manager_message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references resident_manager_messages(id) on delete cascade,
  sender_role text not null default 'resident',
  sender_user_id uuid,
  sender_name text,
  sender_email text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists resident_manager_messages_community_idx on resident_manager_messages(community_id);
create index if not exists resident_manager_messages_resident_idx on resident_manager_messages(resident_id);
create index if not exists resident_manager_messages_manager_email_idx on resident_manager_messages(manager_email);
create index if not exists resident_manager_message_replies_message_idx on resident_manager_message_replies(message_id);

alter table resident_manager_messages enable row level security;
alter table resident_manager_message_replies enable row level security;

-- Permissive authenticated policies match the current Zummee prototype pattern.
-- Tighten later by role/community once the resident and employee auth claims are finalized.
drop policy if exists "Authenticated can read resident manager messages" on resident_manager_messages;
create policy "Authenticated can read resident manager messages"
on resident_manager_messages for select to authenticated using (true);

drop policy if exists "Authenticated can create resident manager messages" on resident_manager_messages;
create policy "Authenticated can create resident manager messages"
on resident_manager_messages for insert to authenticated with check (true);

drop policy if exists "Authenticated can update resident manager messages" on resident_manager_messages;
create policy "Authenticated can update resident manager messages"
on resident_manager_messages for update to authenticated using (true) with check (true);

drop policy if exists "Authenticated can read resident manager replies" on resident_manager_message_replies;
create policy "Authenticated can read resident manager replies"
on resident_manager_message_replies for select to authenticated using (true);

drop policy if exists "Authenticated can create resident manager replies" on resident_manager_message_replies;
create policy "Authenticated can create resident manager replies"
on resident_manager_message_replies for insert to authenticated with check (true);

-- V199 employee reply UI safety indexes / compatibility
alter table resident_manager_messages add column if not exists updated_at timestamptz not null default now();
create index if not exists resident_manager_messages_status_idx on resident_manager_messages(status);
create index if not exists resident_manager_messages_manager_user_idx on resident_manager_messages(manager_user_id);
