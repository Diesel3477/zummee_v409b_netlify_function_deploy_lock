-- Zummee Operations Portal supervisor communications lockdown
-- Run this in Supabase SQL editor after confirming your role column is stored in either profiles.role or userdirectory.role.
-- Employees can READ communications. Only supervisors/admins can INSERT/UPDATE/DELETE.

alter table public.supervisor_messages enable row level security;

create or replace function public.zummee_is_supervisor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.user_id = auth.uid())
      and lower(coalesce(p.role, p.user_role, p.account_type, p.type, '')) in ('supervisor','admin')
  )
  or exists (
    select 1
    from public.userdirectory u
    where (u.id = auth.uid() or u.user_id = auth.uid())
      and lower(coalesce(u.role, u.user_role, u.account_type, u.type, '')) in ('supervisor','admin')
  );
$$;

-- Replace old write policies if they exist.
drop policy if exists "Supervisor messages read" on public.supervisor_messages;
drop policy if exists "Supervisor messages insert supervisors only" on public.supervisor_messages;
drop policy if exists "Supervisor messages update supervisors only" on public.supervisor_messages;
drop policy if exists "Supervisor messages delete supervisors only" on public.supervisor_messages;

-- Read remains open to signed-in users so employees can see actual communications.
create policy "Supervisor messages read"
on public.supervisor_messages
for select
to authenticated
using (true);

-- Writes are supervisor/admin only.
create policy "Supervisor messages insert supervisors only"
on public.supervisor_messages
for insert
to authenticated
with check (public.zummee_is_supervisor_or_admin());

create policy "Supervisor messages update supervisors only"
on public.supervisor_messages
for update
to authenticated
using (public.zummee_is_supervisor_or_admin())
with check (public.zummee_is_supervisor_or_admin());

create policy "Supervisor messages delete supervisors only"
on public.supervisor_messages
for delete
to authenticated
using (public.zummee_is_supervisor_or_admin());
