/*
  Zummee Board Meetings stability lock
  Purpose: make Board Meetings use one source of truth:
    - community dropdown: community_assignments.employee_id
    - board members: BoardMembers.community_id + is_active = true

  Install: load this script after the existing board_meetings.html page scripts,
  immediately before </body>.
*/
(function () {
  'use strict';

  const BUILD = '2026-05-06-board-meetings-dropdown-boardmembers-lock';
  const COMMUNITY_SELECT_ID = 'zummeeCommunitySelect';
  const SELECTED_KEY = 'zummee_board_meetings_selected_community_id_v1';

  function log(...args) {
    console.log('[Board Meetings Stability]', ...args);
  }

  function getSupabase() {
    return window.supabaseClient || window.supabase || null;
  }

  async function getUserId() {
    try {
      if (window.zummeeGetAuthUserId) {
        const id = await window.zummeeGetAuthUserId({ redirect: false });
        if (id) return String(id);
      }
    } catch (_e) {}
    const sb = getSupabase();
    try {
      const res = sb && sb.auth ? await sb.auth.getSession() : null;
      const id = res?.data?.session?.user?.id;
      if (id) return String(id);
    } catch (_e2) {}
    console.warn('[Board Meetings Stability] No Supabase auth session available.');
    return '';
  }

  function getCommunitySelect() {
    return document.getElementById(COMMUNITY_SELECT_ID);
  }

  function normalizeCommunity(row) {
    return {
      id: String(row.community_id || '').trim(),
      name: String(row.community_name || '').trim()
    };
  }

  function normalizeBoardMember(row) {
    return {
      id: row.id,
      name: String(row.name || row.full_name || '').trim(),
      community_id: row.community_id,
      is_active: row.is_active !== false
    };
  }

  async function loadAssignedCommunities() {
    const sb = getSupabase();
    const userId = await getUserId();
    if (!sb || !userId) {
      log('Missing Supabase client or user id.', { hasClient: !!sb, userId });
      return [];
    }

    const { data, error } = await sb
      .from('community_assignments')
      .select('community_id, community_name')
      .eq('employee_id', userId)
      .order('community_name', { ascending: true });

    if (error) {
      console.error('[Board Meetings Stability] community_assignments failed:', error);
      return [];
    }

    const seen = new Set();
    return (data || [])
      .map(normalizeCommunity)
      .filter((community) => {
        if (!community.id || seen.has(community.id)) return false;
        seen.add(community.id);
        return true;
      });
  }

  async function loadBoardMembersForCommunity(communityId) {
    const sb = getSupabase();
    if (!sb || !communityId) return [];

    const { data, error } = await sb
      .from('BoardMembers')
      .select('id, name, is_active, community_id')
      .eq('community_id', communityId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('[Board Meetings Stability] BoardMembers failed:', error);
      return [];
    }

    return (data || []).map(normalizeBoardMember).filter((member) => member.name);
  }

  function renderCommunityOptions(select, communities) {
    const previous = localStorage.getItem(SELECTED_KEY) || select.value || '';
    select.innerHTML = '';

    communities.forEach((community) => {
      const option = document.createElement('option');
      option.value = community.id;
      option.textContent = community.name;
      select.appendChild(option);
    });

    const ids = new Set(communities.map((community) => community.id));
    select.value = ids.has(previous) ? previous : (communities[0]?.id || '');
    if (select.value) localStorage.setItem(SELECTED_KEY, select.value);
  }

  function findAttendanceContainers() {
    const candidates = [
      '#boardMembersList',
      '#boardMembersAttendance',
      '#boardMeetingAttendanceList',
      '#attendanceList',
      '[data-board-members-list]',
      '[data-attendance-list]'
    ];
    return candidates.map((selector) => document.querySelector(selector)).filter(Boolean);
  }

  function renderBoardMembers(members) {
    window.zummeeBoardMeetingBoardMembers = members;
    window.boardMeetingBoardMembers = members;

    const containers = findAttendanceContainers();
    if (!containers.length) {
      log('Loaded board members, but no known attendance container was found.', members);
      return;
    }

    containers.forEach((container) => {
      container.innerHTML = '';
      if (!members.length) {
        const empty = document.createElement('div');
        empty.className = 'empty-state board-members-empty';
        empty.textContent = 'No active board members found for this community.';
        container.appendChild(empty);
        return;
      }

      members.forEach((member) => {
        const row = document.createElement('label');
        row.className = 'board-member-row attendance-member-row';
        row.dataset.memberId = member.id;
        row.dataset.communityId = member.community_id;
        row.innerHTML = `
          <input type="checkbox" checked data-board-member-id="${member.id}">
          <span>${member.name}</span>
        `;
        container.appendChild(row);
      });
    });
  }

  async function refreshBoardMembers() {
    const select = getCommunitySelect();
    const communityId = select?.value || '';
    if (!communityId) {
      renderBoardMembers([]);
      return [];
    }

    localStorage.setItem(SELECTED_KEY, communityId);
    const members = await loadBoardMembersForCommunity(communityId);
    renderBoardMembers(members);
    return members;
  }

  async function refreshCommunitiesAndMembers() {
    const select = getCommunitySelect();
    if (!select) {
      log('Community dropdown not found:', COMMUNITY_SELECT_ID);
      return;
    }

    const communities = await loadAssignedCommunities();
    renderCommunityOptions(select, communities);
    await refreshBoardMembers();

    log('Locked community dropdown and board members.', {
      build: BUILD,
      communities: communities.map((c) => c.name),
      selectedCommunityId: select.value,
      boardMembers: window.zummeeBoardMeetingBoardMembers
    });
  }

  function installChangeHandler() {
    const select = getCommunitySelect();
    if (!select || select.dataset.zummeeStabilityLocked === 'true') return;
    select.dataset.zummeeStabilityLocked = 'true';
    select.addEventListener('change', refreshBoardMembers);
  }

  function protectCommunityDropdown() {
    const select = getCommunitySelect();
    if (!select || select.dataset.zummeeMutationProtected === 'true') return;
    select.dataset.zummeeMutationProtected = 'true';

    let repairing = false;
    const observer = new MutationObserver(async () => {
      if (repairing) return;
      const count = select.options.length;
      const selected = select.value;
      const saved = localStorage.getItem(SELECTED_KEY);

      // If an older loader collapses the dropdown after our load, restore from the locked source.
      if (count <= 1 && saved && selected !== saved) {
        repairing = true;
        await refreshCommunitiesAndMembers();
        repairing = false;
      }
    });

    observer.observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['value'] });
  }

  window.zummeeBoardMeetingsStableRefresh = refreshCommunitiesAndMembers;
  window.zummeeBoardMeetingsLoadBoardMembers = refreshBoardMembers;

  async function boot() {
    installChangeHandler();
    protectCommunityDropdown();
    await refreshCommunitiesAndMembers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
