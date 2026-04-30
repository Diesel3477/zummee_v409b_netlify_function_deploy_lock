-- v377 Board Hub long-term RLS
alter table "BoardMemberActionItems" enable row level security;

drop policy if exists "users_can_read_assigned_board_items" on "BoardMemberActionItems";
create policy "users_can_read_assigned_board_items"
on "BoardMemberActionItems"
for select
using (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
);

-- Optional but recommended if managers create/update/delete board items from Board Hub.
drop policy if exists "users_can_insert_assigned_board_items" on "BoardMemberActionItems";
create policy "users_can_insert_assigned_board_items"
on "BoardMemberActionItems"
for insert
with check (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
);

drop policy if exists "users_can_update_assigned_board_items" on "BoardMemberActionItems";
create policy "users_can_update_assigned_board_items"
on "BoardMemberActionItems"
for update
using (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
)
with check (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
);

drop policy if exists "users_can_delete_assigned_board_items" on "BoardMemberActionItems";
create policy "users_can_delete_assigned_board_items"
on "BoardMemberActionItems"
for delete
using (
  community_id in (
    select community_id
    from "CommunityAssignments"
    where user_id = auth.uid()
  )
);

create index if not exists idx_board_member_action_items_community_id
on "BoardMemberActionItems"(community_id);
