-- Daily Ops Cloud Sync (v1117+)
-- Stores the full Daily Ops state JSON per user + community so it stays consistent across devices.

create table if not exists public.daily_ops_state (
  user_id uuid not null,
  community_id uuid not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, community_id)
);

alter table public.daily_ops_state enable row level security;

-- Users can read/write only their own Daily Ops state.
drop policy if exists "dos_state_select_own" on public.daily_ops_state;
create policy "dos_state_select_own"
on public.daily_ops_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "dos_state_insert_own" on public.daily_ops_state;
create policy "dos_state_insert_own"
on public.daily_ops_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "dos_state_update_own" on public.daily_ops_state;
create policy "dos_state_update_own"
on public.daily_ops_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
