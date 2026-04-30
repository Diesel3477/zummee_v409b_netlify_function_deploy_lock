-- Zummee Community Assignments regression lock
-- Run once in Supabase SQL Editor.
-- Purpose: one saved assignment row per company/community, with cloud as the only source of truth.

-- 1) Remove duplicates before adding the constraint. Keeps the most recently updated/created row.
with ranked as (
  select
    id,
    row_number() over (
      partition by company_id, community_id
      order by coalesce(updated_at, created_at) desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from community_assignments
  where company_id is not null
    and community_id is not null
)
delete from community_assignments ca
using ranked r
where ca.id = r.id
  and r.rn > 1;

-- 2) Enforce one assignment per company/community going forward.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'community_assignments_one_per_community'
  ) then
    alter table community_assignments
    add constraint community_assignments_one_per_community
    unique (company_id, community_id);
  end if;
end $$;

-- 3) Verification: should return zero rows.
select company_id, community_id, count(*)
from community_assignments
group by company_id, community_id
having count(*) > 1;
