-- V401 Board Hub V2 community dropdown/name + assigned board items RPCs
-- Uses explicit p_user_id + p_community_id context passed by Manager Hub.

create or replace function public.get_user_communities_with_names(p_user_id uuid)
returns table (
  community_id uuid,
  name text
)
language sql
stable
as $$
  select
    ca.community_id,
    coalesce(pc.name, c.name, ca.community_id::text) as name
  from "CommunityAssignments" ca
  left join "PropertyCommunities" pc on pc.id = ca.community_id
  left join "Communities" c on c.id = ca.community_id
  where ca.user_id = p_user_id
  order by coalesce(pc.name, c.name, ca.community_id::text);
$$;

grant execute on function public.get_user_communities_with_names(uuid) to authenticated;

create or replace function public.get_user_communities(p_user_id uuid)
returns table (community_id uuid)
language sql
stable
as $$
  select ca.community_id
  from "CommunityAssignments" ca
  where ca.user_id = p_user_id
  order by ca.community_id;
$$;

grant execute on function public.get_user_communities(uuid) to authenticated;

create or replace function public.get_board_member_action_items_for_community(
  p_user_id uuid,
  p_community_id uuid
)
returns table (
  id uuid,
  community_id uuid,
  title text,
  details text,
  due_date date,
  created_at timestamptz,
  status text
)
language sql
stable
as $$
  select
    b.id,
    b.community_id,
    b.title,
    b.details,
    b.due_date,
    b.created_at,
    b.status
  from "BoardMemberActionItems" b
  where b.community_id = p_community_id
    and exists (
      select 1
      from "CommunityAssignments" ca
      where ca.user_id = p_user_id
        and ca.community_id = b.community_id
    )
  order by b.created_at desc;
$$;

grant execute on function public.get_board_member_action_items_for_community(uuid, uuid) to authenticated;
