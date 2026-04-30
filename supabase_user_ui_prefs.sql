-- User UI Preferences (per-user settings, e.g., Manager Hub card order)
create table if not exists public.user_ui_prefs (
  user_id uuid not null,
  pref_key text not null,
  pref_value jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, pref_key)
);

alter table public.user_ui_prefs enable row level security;

-- Users can read their own prefs
drop policy if exists "prefs read own" on public.user_ui_prefs;
create policy "prefs read own"
on public.user_ui_prefs
for select
to authenticated
using (auth.uid() = user_id);

-- Users can insert their own prefs
drop policy if exists "prefs insert own" on public.user_ui_prefs;
create policy "prefs insert own"
on public.user_ui_prefs
for insert
to authenticated
with check (auth.uid() = user_id);

-- Users can update their own prefs
drop policy if exists "prefs update own" on public.user_ui_prefs;
create policy "prefs update own"
on public.user_ui_prefs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
