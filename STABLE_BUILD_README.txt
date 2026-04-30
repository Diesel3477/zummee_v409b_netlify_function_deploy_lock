Zummee Stable Build (Working Baseline)

Build: v646_SECTION_WIDTH_ALIGN
Date: 2026-02-15
Baseline: v638_STABLE_BASE

Purpose
- Provides a clean, stable baseline with a permanent fix for Company Communities assignments reverting to "Unassigned" after refresh/logout.

Key Fix
- Company Communities assignment dropdown now WRITES to Supabase table: CommunityAssignments
  - Includes required company_id field (table NOT NULL constraint).
  - Uses a delegated change handler so the save logic works even if the list is re-rendered.
  - Persists by delete-then-insert scoped to {company_id, community_id}.
  - Optimistically updates the local assignments cache so the UI stays stable immediately.
- Assignments LOAD from Supabase on page load/refresh (existing v638 sync logic), so assignments survive refresh/logout and appear for employees.

Expected Behavior
1) Supervisor/Admin assigns a community to an employee in Supervisor Access → Company Communities.
2) Network shows a write to CommunityAssignments (DELETE then POST/INSERT).
3) Refresh/logout/login: Supervisor/Admin still sees the saved assignment.
4) Employee logs in: assigned communities appear in employee community dropdown and persist across refresh/logout.


v651_SUP_REMOVE_COMMUNITY_SELECTOR:
- Supervisor Access header: removed Community dropdown/swatch/label entirely.
- Profile + Sign out remain in header.
