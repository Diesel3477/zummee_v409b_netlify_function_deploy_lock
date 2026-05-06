-- Zummee BoardMembers production-safe RLS
-- Run after deploying the production auth foundation and signing in again.

alter table public."BoardMembers" enable row level security;

drop policy if exists "Allow anon users to read board members test" on public."BoardMembers";
drop policy if exists "Allow authenticated users to read board members" on public."BoardMembers";
drop policy if exists "Allow users to read assigned board members" on public."BoardMembers";

create policy "Allow users to read assigned board members"
on public."BoardMembers"
for select
to authenticated
using (
  exists (
    select 1
    from public.community_assignments ca
    where ca.employee_id::uuid = auth.uid()
      and ca.community_id::uuid = "BoardMembers".community_id
  )
);
