create table if not exists public.supervisor_message_completions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  user_id uuid not null,
  community_id text not null,
  completed_at timestamptz not null default now(),
  unique (message_id, user_id)
);

alter table public.supervisor_message_completions enable row level security;

drop policy if exists "Users can insert their own completions" on public.supervisor_message_completions;
drop policy if exists "Users can view their own completions" on public.supervisor_message_completions;
drop policy if exists "Users can view their own supervisor message completions" on public.supervisor_message_completions;
drop policy if exists "Users can insert their own supervisor message completions" on public.supervisor_message_completions;

create policy "Users can view their own supervisor message completions"
on public.supervisor_message_completions
for select
using (auth.uid() = user_id);

create policy "Users can insert their own supervisor message completions"
on public.supervisor_message_completions
for insert
with check (auth.uid() = user_id);
