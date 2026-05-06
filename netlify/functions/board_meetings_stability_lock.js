/*
  Zummee Board Meetings Stability Lock
  Purpose: Lock Board Meetings community dropdown + board attendance to one source of truth.
  Drop this script at the END of board_meetings.html, just before </body>.

  Sources:
  - Communities: community_assignments where employee_id = authenticated user id
  - Board members: daily_ops_board_members where community_id = selected community id
*/
(function(){
  'use strict';

  var BUILD = '2026-05-06-board-meetings-stability-lock-v1';
  var SELECT_ID = 'zummeeCommunitySelect';
  var ATTENDANCE_ID = 'bmAttendanceList';
  var applying = false;
  var lastCommunityId = '';
  var lastRenderKey = '';

  function log(){
    try{ console.log.apply(console, ['[Board Meetings Stability Lock]', BUILD].concat([].slice.call(arguments))); }catch(_e){}
  }
  function warn(){
    try{ console.warn.apply(console, ['[Board Meetings Stability Lock]', BUILD].concat([].slice.call(arguments))); }catch(_e){}
  }
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
  function safeParse(raw){
    try{ return JSON.parse(raw); }catch(_e){ return null; }
  }
  function getLocal(k){
    try{ return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; }catch(_e){ return ''; }
  }
  function setLocal(k,v){
    try{ localStorage.setItem(k, v); }catch(_e){}
  }

  async function getSb(){
    try{ if(window.supabaseClient && window.supabaseClient.from) return window.supabaseClient; }catch(_e){}
    try{ if(window.sb && window.sb.from) return window.sb; }catch(_e){}
    try{ if(window.supabase && window.supabase.from) return window.supabase; }catch(_e){}
    try{ if(typeof window.ensureSupabase === 'function'){ var s = await window.ensureSupabase(); if(s && s.from) return s; } }catch(_e){}
    try{ if(typeof window.getSupabaseClientSafe === 'function'){ var c = window.getSupabaseClientSafe(); if(c && c.from) return c; } }catch(_e){}
    return null;
  }

  async function getUid(sb){
    try{
      var u = await sb.auth.getUser();
      if(u && u.data && u.data.user && u.data.user.id) return String(u.data.user.id);
    }catch(_e){}
    try{
      var sess = await sb.auth.getSession();
      if(sess && sess.data && sess.data.session && sess.data.session.user && sess.data.session.user.id) return String(sess.data.session.user.id);
    }catch(_e){}
    var keys = ['zummee_user_id_v1','auth_user_id','user_id'];
    for(var i=0;i<keys.length;i++){
      var v = getLocal(keys[i]);
      if(v) return String(v);
    }
    try{
      var raw = getLocal('zummee_session_v1');
      var obj = safeParse(raw);
      if(obj && obj.userId) return String(obj.userId);
    }catch(_e){}
    return '';
  }

  function preferredCommunityId(){
    var keys = [
      'zummee_selected_community_id',
      'mh2_selected_community_id',
      'board_member_hub_selected_community_id',
      'activeCommunityId',
      'currentCommunityId',
      'zummee_community_id',
      'zummee_selected_community_v1'
    ];
    for(var i=0;i<keys.length;i++){
      var raw = getLocal(keys[i]);
      if(!raw) continue;
      var obj = safeParse(raw);
      if(obj && (obj.id || obj.community_id)) return String(obj.id || obj.community_id);
      if(raw.charAt(0) !== '{') return String(raw);
    }
    return '';
  }

  function persistCommunity(c){
    if(!c || !c.id) return;
    var id = String(c.id);
    var name = String(c.name || '');
    setLocal('zummee_selected_community_id', id);
    setLocal('mh2_selected_community_id', id);
    setLocal('board_member_hub_selected_community_id', id);
    setLocal('activeCommunityId', id);
    setLocal('currentCommunityId', id);
    setLocal('zummee_community_id', id);
    setLocal('activeCommunityName', name);
    setLocal('currentCommunityName', name);
    try{ localStorage.setItem('zummee_selected_community_v1', JSON.stringify({ id:id, community_id:id, name:name, community_name:name })); }catch(_e){}
  }

  function normalizeAssignment(row){
    if(!row) return null;
    var id = String(row.community_id || '').trim();
    var name = String(row.community_name || '').trim();
    if(!id) return null;
    return { id:id, name:name || id };
  }

  async function fetchAssignedCommunities(sb, uid){
    if(!sb || !uid) return [];
    var q;
    try{
      q = await sb
        .from('community_assignments')
        .select('community_id, community_name, employee_id')
        .eq('employee_id', uid)
        .order('community_name', { ascending: true });
    }catch(e){
      warn('community_assignments query crashed', e);
      return [];
    }
    if(q && q.error){
      warn('community_assignments query failed', q.error);
      return [];
    }
    var seen = {};
    return (q && Array.isArray(q.data) ? q.data : [])
      .map(normalizeAssignment)
      .filter(function(c){
        if(!c || !c.id || seen[c.id]) return false;
        seen[c.id] = true;
        return true;
      })
      .sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  }

  function nameFromRow(r){
    if(!r) return '';
    var vals = [
      r.name,
      r.board_member_name,
      r.member_name,
      r.profile_name,
      r.full_name,
      r.boardMemberName,
      r.memberName,
      (r.first_name && r.last_name) ? (r.first_name + ' ' + r.last_name) : '',
      r.first_name,
      r.email
    ];
    for(var i=0;i<vals.length;i++){
      var v = String(vals[i] || '').trim();
      if(v) return v;
    }
    return '';
  }

  async function fetchBoardMembers(sb, communityId){
    if(!sb || !communityId) return [];
    var q;
    try{
      q = await sb
        .from('daily_ops_board_members')
        .select('*')
        .eq('community_id', communityId)
        .order('name', { ascending: true });
    }catch(e){
      warn('daily_ops_board_members query crashed', e);
      return [];
    }
    if(q && q.error){
      warn('daily_ops_board_members query failed', q.error);
      return [];
    }
    var seen = {};
    return (q && Array.isArray(q.data) ? q.data : [])
      .map(function(row){ return { name: nameFromRow(row), raw: row }; })
      .filter(function(m){
        var key = String(m.name || '').toLowerCase();
        if(!key || seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  function dispatchCommunity(c){
    try{ window.dispatchEvent(new CustomEvent('zummee:community-changed', { detail:{ community_id:c.id, community_name:c.name } })); }catch(_e){}
    try{ document.dispatchEvent(new CustomEvent('community:changed', { detail:{ community_id:c.id, community_name:c.name } })); }catch(_e){}
  }

  async function lockDropdown(){
    if(applying) return;
    applying = true;
    try{
      var sel = document.getElementById(SELECT_ID);
      if(!sel) return;
      var sb = await getSb();
      var uid = await getUid(sb);
      var list = await fetchAssignedCommunities(sb, uid);

      sel.dataset.zummeeStableLocked = '1';
      sel.innerHTML = '';
      var ph = document.createElement('option');
      ph.value = '';
      ph.textContent = list.length ? 'Select a community' : 'No assigned communities';
      sel.appendChild(ph);
      list.forEach(function(c){
        var o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name;
        sel.appendChild(o);
      });

      var want = preferredCommunityId();
      var found = list.find(function(c){ return c.id === want; }) || list[0] || null;
      if(found){
        sel.value = found.id;
        persistCommunity(found);
        if(lastCommunityId !== found.id){
          lastCommunityId = found.id;
          dispatchCommunity(found);
        }
      }

      if(!sel.dataset.zummeeStableChangeBound){
        sel.dataset.zummeeStableChangeBound = '1';
        sel.addEventListener('change', function(){
          var chosen = list.find(function(c){ return c.id === sel.value; }) || { id: sel.value, name: sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent : '' };
          persistCommunity(chosen);
          lastCommunityId = chosen.id;
          dispatchCommunity(chosen);
          renderAttendance();
        }, true);
      }

      await renderAttendance();
      log('locked dropdown communities:', list.map(function(c){ return c.name; }).join(', ') || '(none)');
    }finally{
      applying = false;
    }
  }

  function attendanceKey(){
    var mid = '';
    try{ if(window.ZummeeMeetings && typeof window.ZummeeMeetings.getCurrentId === 'function') mid = window.ZummeeMeetings.getCurrentId() || ''; }catch(_e){}
    if(!mid){
      var d = new Date();
      mid = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    return 'zummee_board_meeting_attendance_present_v2__' + mid + '__' + (lastCommunityId || preferredCommunityId() || '');
  }
  function readPresent(){ return safeParse(getLocal(attendanceKey())) || {}; }
  function writePresent(obj){ setLocal(attendanceKey(), JSON.stringify(obj || {})); }

  async function renderAttendance(){
    var box = document.getElementById(ATTENDANCE_ID);
    if(!box) return;
    var sel = document.getElementById(SELECT_ID);
    var communityId = (sel && sel.value) ? String(sel.value) : preferredCommunityId();
    lastCommunityId = communityId || lastCommunityId;

    var sb = await getSb();
    var members = await fetchBoardMembers(sb, communityId);
    var renderKey = communityId + '::' + members.map(function(m){ return m.name; }).join('|');
    if(renderKey === lastRenderKey && box.dataset.zummeeStableAttendance === '1') return;
    lastRenderKey = renderKey;

    box.dataset.zummeeStableAttendance = '1';
    if(!communityId){
      box.innerHTML = '<div class="help">Select a community to load board members.</div>';
      return;
    }
    if(!members.length){
      box.innerHTML = '<div class="help">No board members found for this community.</div>';
      warn('No board members returned from daily_ops_board_members for community_id:', communityId);
      return;
    }

    var present = readPresent();
    box.innerHTML = members.map(function(m, idx){
      var key = String(m.name).toLowerCase();
      var isPresent = !!present[key];
      return '<button type="button" class="bm-att-item ' + (isPresent ? 'is-present' : '') + '" data-bm-att-name="' + esc(m.name) + '" aria-pressed="' + (isPresent ? 'true' : 'false') + '">' +
        '<span class="bm-att-name">' + esc(m.name) + '</span>' +
      '</button>';
    }).join('');

    Array.prototype.forEach.call(box.querySelectorAll('[data-bm-att-name]'), function(btn){
      btn.addEventListener('click', function(){
        var name = String(btn.getAttribute('data-bm-att-name') || '');
        var key = name.toLowerCase();
        var p = readPresent();
        p[key] = !p[key];
        writePresent(p);
        btn.classList.toggle('is-present', !!p[key]);
        btn.setAttribute('aria-pressed', p[key] ? 'true' : 'false');
      });
    });

    log('rendered board members:', members.map(function(m){ return m.name; }).join(', '));
  }

  function scheduleLock(){
    lockDropdown();
    setTimeout(lockDropdown, 250);
    setTimeout(lockDropdown, 900);
    setTimeout(lockDropdown, 2200);
  }

  document.addEventListener('DOMContentLoaded', scheduleLock);
  window.addEventListener('load', scheduleLock);
  window.addEventListener('zummee:meeting-changed', function(){ setTimeout(renderAttendance, 50); });

  // Guard against old page scripts rewriting dropdown/attendance after load.
  var observerTimer = null;
  function startObserver(){
    try{
      var root = document.body;
      if(!root || window.__zummeeBoardMeetingsStabilityObserver) return;
      window.__zummeeBoardMeetingsStabilityObserver = new MutationObserver(function(mutations){
        var touched = false;
        mutations.forEach(function(m){
          if(!m.target) return;
          if(m.target.id === SELECT_ID || m.target.id === ATTENDANCE_ID) touched = true;
          if(m.target.closest && (m.target.closest('#'+SELECT_ID) || m.target.closest('#'+ATTENDANCE_ID))) touched = true;
        });
        if(!touched || applying) return;
        clearTimeout(observerTimer);
        observerTimer = setTimeout(lockDropdown, 120);
      });
      window.__zummeeBoardMeetingsStabilityObserver.observe(root, { childList:true, subtree:true });
    }catch(e){ warn('observer failed', e); }
  }
  document.addEventListener('DOMContentLoaded', startObserver);
})();
