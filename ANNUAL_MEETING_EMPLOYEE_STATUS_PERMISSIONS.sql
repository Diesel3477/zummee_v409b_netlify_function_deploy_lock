-- Zummee v281 - Annual Meeting Employee Status permissions
-- Run once in Supabase SQL editor.
-- Purpose: employees can VIEW annual meeting notice status for their assigned communities,
-- while approval actions remain handled by the existing supervisor/admin pages.

-- Required table guardrails. These do not drop data.
alter table if exists public.annual_meeting_packet_requests enable row level security;

-- Employees / authenticated app users need read access for the read-only status page.
-- The page still client-filters employees to assigned communities, and existing supervisor
-- approval update policies remain separate from this SELECT policy.
drop policy if exists "zummee annual packet employee status read" on public.annual_meeting_packet_requests;
create policy "zummee annual packet employee status read"
on public.annual_meeting_packet_requests
for select
to authenticated
using (true);

-- If your app is currently using the public anon key with local app-level login state,
-- keep this SELECT policy so the status page can load in the existing Netlify build.
-- Remove this anon policy later only after every page is fully on Supabase Auth sessions.
drop policy if exists "zummee annual packet employee status anon read" on public.annual_meeting_packet_requests;
create policy "zummee annual packet employee status anon read"
on public.annual_meeting_packet_requests
for select
to anon
using (true);

-- Optional but safe: make sure the status query stays fast.
create index if not exists idx_annual_meeting_packet_requests_community_submitted
on public.annual_meeting_packet_requests (community_id, submitted_at desc);

create index if not exists idx_annual_meeting_packet_requests_company_submitted
on public.annual_meeting_packet_requests (company_id, submitted_at desc);
