-- Zummee v394 Board Hub V2 stable manager-context RPCs
-- Run this in Supabase SQL Editor after deploying v394.

create or replace function get_board_hub_v2_communities_for_user(p_user_id uuid)
returns table (community_id uuid, community_name text)
language sql
security definer
set search_path = public
as $$
  select ca.community_id, coalesce(pc.name, c.name, ca.community_id::text) as community_name
  from "CommunityAssignments" ca
  left join "PropertyCommunities" pc on pc.id = ca.community_id
  left join "Communities" c on c.id = ca.community_id
  where ca.user_id = p_user_id
  order by coalesce(pc.name, c.name, ca.community_id::text);
$$;

grant execute on function get_board_hub_v2_communities_for_user(uuid) to authenticated, anon;

create or replace function get_board_member_action_items_for_community_user(p_user_id uuid, p_community_id uuid)
returns table (id uuid, community_id uuid, title text, details text, status text, created_at timestamptz, due_date date, photo_url text)
language sql
security definer
set search_path = public
as $$
  select b.id, b.community_id, b.title, b.details, b.status, b.created_at, b.due_date, b.photo_url
  from "BoardMemberActionItems" b
  where b.community_id = p_community_id
    and exists (
      select 1 from "CommunityAssignments" ca
      where ca.community_id = p_community_id and ca.user_id = p_user_id
    )
  order by b.created_at desc nulls last;
$$;

grant execute on function get_board_member_action_items_for_community_user(uuid, uuid) to authenticated, anon;
