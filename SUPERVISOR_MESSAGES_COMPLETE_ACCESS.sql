-- Zummee Operations Portal employee completion access
-- Run after SUPERVISOR_MESSAGES_RLS_LOCKDOWN.sql.
-- This keeps authoring supervisor/admin-only, but lets employees mark a communication complete.

alter table public.supervisor_messages
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by uuid;

create or replace function public.zummee_complete_supervisor_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.supervisor_messages
     set completed_at = coalesce(completed_at, now()),
         completed_by = coalesce(completed_by, auth.uid()),
         updated_at = now()
   where id = p_message_id;
end;
$$;

grant execute on function public.zummee_complete_supervisor_message(uuid) to authenticated;
