-- Zummee v396 Board Hub V2 context RPCs
-- Uses explicit p_user_id + p_community_id from Manager Hub context.

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
security definer
set search_path = public
as $$
  select b.id, b.community_id, b.title, b.details, b.due_date, b.created_at, b.status
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

create or replace function public.get_user_communities_with_names(
  p_user_id uuid
)
returns table (community_id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select ca.community_id, coalesce(c.name, ca.community_id::text) as name
  from "CommunityAssignments" ca
  left join "Communities" c on c.id = ca.community_id
  where ca.user_id = p_user_id
  order by coalesce(c.name, ca.community_id::text);
$$;

create or replace function public.get_board_item_counts(
  p_user_id uuid,
  p_community_id uuid
)
returns table (submitted_count int)
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int as submitted_count
  from "BoardMemberActionItems" b
  where b.community_id = p_community_id
    and exists (
      select 1
      from "CommunityAssignments" ca
      where ca.user_id = p_user_id
        and ca.community_id = b.community_id
    )
    and coalesce(lower(b.status),'open') not in ('completed','complete','closed','deleted','archived','converted','cancelled','canceled');
$$;

grant execute on function public.get_board_member_action_items_for_community(uuid, uuid) to authenticated;
grant execute on function public.get_user_communities_with_names(uuid) to authenticated;
grant execute on function public.get_board_item_counts(uuid, uuid) to authenticated;

-- Optional context fallback for devices where the standalone page has no restored Supabase auth session.
-- These RPCs still restrict data to the supplied user_id/community_id assignment pair.
grant execute on function public.get_board_member_action_items_for_community(uuid, uuid) to anon;
grant execute on function public.get_user_communities_with_names(uuid) to anon;
grant execute on function public.get_board_item_counts(uuid, uuid) to anon;
