-- Adds company-wide support for Supervisor Communications in Supabase.
-- Safe to run more than once.

alter table public.supervisor_messages
  add column if not exists scope text not null default 'Community',
  add column if not exists company_key text,
  add column if not exists type text,
  add column if not exists rule text,
  add column if not exists notes text,
  add column if not exists due_date date,
  add column if not exists updated_at timestamptz not null default now();

update public.supervisor_messages
set scope = coalesce(nullif(scope, ''), 'Community')
where scope is null or scope = '';

update public.supervisor_messages
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create index if not exists supervisor_messages_scope_community_idx
  on public.supervisor_messages (scope, community_id, created_at desc);

create index if not exists supervisor_messages_scope_company_idx
  on public.supervisor_messages (scope, company_key, created_at desc);

-- Keep delete open to authenticated users until you are ready to narrow this further.
drop policy if exists "supervisors can delete supervisor messages" on public.supervisor_messages;
create policy "supervisors can delete supervisor messages"
on public.supervisor_messages
for delete
to authenticated
using (true);
