-- Zummee v392 Board Hub V2 long-term stable data access
-- Run this once in Supabase SQL Editor.

alter table "BoardMemberActionItems" enable row level security;
alter table "CommunityAssignments" enable row level security;

grant select, insert, update, delete on "BoardMemberActionItems" to authenticated;
grant select on "CommunityAssignments" to authenticated;

drop policy if exists "users_can_read_own_assignments" on "CommunityAssignments";
create policy "users_can_read_own_assignments"
on "CommunityAssignments"
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users_can_read_assigned_board_items" on "BoardMemberActionItems";
drop policy if exists "board_items_read" on "BoardMemberActionItems";
create policy "users_can_read_assigned_board_items"
on "BoardMemberActionItems"
for select
to authenticated
using (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
);

drop policy if exists "users_can_create_assigned_board_items" on "BoardMemberActionItems";
create policy "users_can_create_assigned_board_items"
on "BoardMemberActionItems"
for insert
to authenticated
with check (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
);

create or replace function public.get_board_member_action_items_for_community(p_community_id uuid)
returns setof "BoardMemberActionItems"
language sql
security definer
set search_path = public
as $$
  select b.*
  from "BoardMemberActionItems" b
  where b.community_id = p_community_id
    and exists (
      select 1
      from "CommunityAssignments" ca
      where ca.community_id = p_community_id
        and ca.user_id = auth.uid()
    );
$$;

revoke all on function public.get_board_member_action_items_for_community(uuid) from public;
grant execute on function public.get_board_member_action_items_for_community(uuid) to authenticated;

-- Verification after deployment/login:
-- select count(*) from public.get_board_member_action_items_for_community('be74ed53-0be0-4d91-b89c-37394c7594e0');
