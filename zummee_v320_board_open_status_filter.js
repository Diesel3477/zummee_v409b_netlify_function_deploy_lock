/* Zummee v320 board submitted open-status source filter
   Source of truth: BoardMemberActionItems where status = open. notification_events is history only. */
(function(){
  if(window.__ZUMMEE_V320_BOARD_OPEN_STATUS_FILTER__) return;
  window.__ZUMMEE_V320_BOARD_OPEN_STATUS_FILTER__ = true;
  var URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var KEY = 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  var refreshTimer = null;

  function s(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return s(v).toLowerCase(); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v)); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function meta(row){ return row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {}; }
  function pick(obj,names,fallback){ obj=obj||{}; for(var i=0;i<names.length;i++){ var v=obj[names[i]]; if(s(v)) return s(v); } return fallback || ''; }

  async function getSB(){
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient; }catch(e){}
    try{ if(window.sb && typeof window.sb.from === 'function'){ window.supabaseClient = window.sb; return window.sb; } }catch(e){}
    try{ if(typeof window.ensureSupabase === 'function'){ var c = await window.ensureSupabase(); if(c && typeof c.from === 'function'){ window.supabaseClient = c; window.sb = c; return c; } } }catch(e){}
    try{
      if(window.supabase && typeof window.supabase.createClient === 'function'){
        var n = window.supabase.createClient(URL, KEY, { auth:{ storageKey:'sb-zummee-auth', storage:window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }});
        window.supabaseClient = n; window.sb = n; window.ensureSupabase = window.ensureSupabase || (async function(){ return n; }); return n;
      }
    }catch(e){ console.warn('[v319 board] Supabase fallback failed', e); }
    return null;
  }
  window.zummeeGetSB = window.zummeeGetSB || getSB;
  window.ensureSupabase = window.ensureSupabase || getSB;

  function activeCommunityId(){
    var sel = document.querySelector('#communitySelect,#zummeeCommunitySelect,#communityDropdown,select[id*=community]');
    if(sel && isUuid(sel.value)) return s(sel.value);
    var keys = ['zummee_selected_community_id','activeCommunityId','zummeeActiveCommunityId','currentCommunityId'];
    for(var i=0;i<keys.length;i++){ try{ var v=s(localStorage.getItem(keys[i])); if(isUuid(v)) return v; }catch(e){} }
    return '';
  }

  function isSubmittedEvent(row){
    row = row || {};
    var type = lower(row.event_type || row.type);
    var title = lower(row.title);
    var source = lower(row.source_table);
    return type === 'board_item_submitted' || title === 'board item submitted' || source.indexOf('boardmemberaction') >= 0;
  }
  function isConvertedEvent(row){
    row = row || {};
    var type = lower(row.event_type || row.type);
    var title = lower(row.title);
    return type === 'new_work_order' || title.indexOf('converted to work order') >= 0 || title.indexOf('sent to vendor') >= 0;
  }
  function eventSourceId(row){
    var md = meta(row);
    return s(row && (row.source_id || md.board_item_id || md.original_board_item_id || md.board_id || md.id));
  }
  function conversionIds(events){
    var out = new Set();
    (events || []).forEach(function(row){
      if(!isConvertedEvent(row)) return;
      var md = meta(row);
      [md.board_item_id, md.original_board_item_id, md.board_id, md.source_id, row.source_id].forEach(function(id){ id=s(id); if(id) out.add(id); });
    });
    return out;
  }
  function liveId(row){ return s(row && (row.id || row.board_item_id || row.source_id)); }
  function liveIsClosed(row){
    row = row || {};
    var md = meta(row);
    var status = lower(row.status || row.item_status || row.workflow_state || row.board_status || row.state || md.status || md.item_status || md.workflow_state);
    var closedWords = ['complete','completed','closed','converted','archived','deleted','inactive','cancelled','canceled','resolved','done','sent_to_vendor','sent to vendor','vendor_sent','work_order_created','work order created','converted_to_work_order'];
    for(var i=0;i<closedWords.length;i++){ if(status === closedWords[i] || status.indexOf(closedWords[i]) >= 0) return true; }
    if(row.completed_at || row.closed_at || row.converted_at || row.archived_at || row.deleted_at || row.resolved_at) return true;
    if(row.work_order_id || row.converted_work_order_id || row.maintenance_request_id || row.resident_work_order_id) return true;
    if(md.completed_at || md.closed_at || md.converted_at || md.archived_at || md.deleted_at || md.work_order_id || md.converted_work_order_id) return true;
    return false;
  }
  function normalize(event, live){
    event = event || {}; live = live || {};
    var em = meta(event), lm = meta(live);
    return {
      id: event.id || event.source_id || live.id || em.board_item_id || '',
      source_id: event.source_id || live.id || em.board_item_id || '',
      title: pick(live, ['title','subject'], pick(em, ['title','subject'], pick(event, ['title','subject'], 'Board submitted item'))),
      message: pick(live, ['details','description','message','body'], pick(em, ['details','description','message','body'], pick(event, ['message','details','description'], 'Submitted item ready for board review.'))),
      created_at: event.created_at || live.created_at || live.submitted_at || new Date().toISOString(),
      due_date: live.due_date || em.due_date || '',
      status: live.status || em.status || event.status || '',
      raw_event: event,
      raw_live: live
    };
  }

  async function fetchTrueOpenBoardItems(){
    var sb = await getSB();
    var cid = activeCommunityId();
    if(!sb || !cid) return [];

    // v320: BoardMemberActionItems is the source of truth.
    // notification_events is only an activity/history log and should not drive open counts.
    var liveRes = await sb.from('BoardMemberActionItems')
      .select('*')
      .eq('community_id', cid)
      .eq('status', 'open')
      .order('created_at', { ascending:false });

    if(liveRes && liveRes.error){
      console.warn('[v320 board] BoardMemberActionItems open lookup failed', liveRes.error);
      return [];
    }

    var liveRows = Array.isArray(liveRes && liveRes.data) ? liveRes.data : [];
    var out = [];
    var seen = new Set();
    liveRows.forEach(function(row){
      var id = liveId(row);
      if(!id || seen.has(id)) return;
      seen.add(id);
      out.push(normalize(null, row));
    });
    console.log('[v320 board open source]', {community:cid, open:out.length, rows:liveRows});
    return out;
  }

  function syncBoardCounts(count){
    count = Number(count || 0);
    ['submittedCountPill','prioritySubmittedPill','todaySubmittedMini'].forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      if(id === 'submittedCountPill') el.textContent = 'Submitted: ' + count;
      else if(id === 'prioritySubmittedPill') el.textContent = count + ' Submitted';
      else el.textContent = String(count);
    });
    document.querySelectorAll('[data-submitted-count], .submitted-count, .submittedCount').forEach(function(el){ el.textContent = String(count); });
  }

  function renderBoardHub(items){
    var host = document.querySelector('#submittedItemsHost');
    if(!host) return;
    items = Array.isArray(items) ? items : [];
    syncBoardCounts(items.length);
    if(!items.length){ host.innerHTML = '<div class="board-empty">No submitted items for this community.</div>'; return; }
    host.innerHTML = items.map(function(item){
      return '<article class="item itemRow board-notification-item" data-source-id="'+esc(item.source_id)+'">'
        + '<div><div class="itemTitle">'+esc(item.title || 'Board submitted item')+'</div>'
        + '<div class="muted">'+esc(item.message || 'Submitted item ready for board review.')+'</div>'
        + '<div class="tiny">Submitted '+esc(new Date(item.created_at).toLocaleString())+'</div></div>'
        + '<div class="itemActions"><button class="btn btn-primary" type="button" data-source-id="'+esc(item.source_id)+'">Open</button></div>'
        + '</article>';
    }).join('');
  }

  function renderManagerHub(items){
    var isManager = /manager_hub/i.test(location.pathname) || document.getElementById('managerBoardItemsBody');
    if(!isManager) return;
    items = Array.isArray(items) ? items : [];
    function text(id,v){ var el=document.getElementById(id); if(el) el.textContent=String(v); }
    text('mh2BoardItemsPill', items.length);
    text('mh2BoardOverdueCount', 0);
    text('mh2BoardStatusPill', items.length ? 'Open '+items.length : 'Clear');
    text('mh2BoardItemNote', items.length ? 'Open board-submitted items awaiting review.' : 'No open board-submitted items for this community.');
    var alert = document.getElementById('mh2AlertBoard');
    if(alert){
      alert.classList.remove('is-good','is-attention','is-urgent');
      alert.classList.add(items.length ? 'is-attention' : 'is-good');
      alert.setAttribute('href','board_member_hub_rebuild.html?from=manager_hub');
      alert.setAttribute('data-zummee-route','board_member_hub_rebuild.html?from=manager_hub');
      alert.innerHTML = '<div class="mh2-alert-top"><div class="mh2-alert-title">Board review status</div><div class="mh2-alert-badge">'+(items.length?'OPEN':'STABLE')+'</div></div><div class="mh2-alert-copy">'+(items.length?esc(items.length+' submitted item'+(items.length===1?'':'s')+' ready for review.'):'No open board items for the selected community.')+'</div>';
    }
    var body = document.getElementById('managerBoardItemsBody');
    if(body){
      if(!items.length) body.innerHTML = '<div class="mh2-placeholder">No new board-submitted items for this community.</div>';
      else body.innerHTML = items.slice(0,5).map(function(it){
        return '<article class="mh2-list-item"><div><div class="mh2-item-title">'+esc(it.title)+'</div><div class="mh2-item-copy">'+esc(it.message)+'</div><div class="mh2-board-meta"><span class="mh2-chip">Submitted '+esc(new Date(it.created_at).toLocaleString())+'</span></div></div><a class="mh2-item-tag mh2-board-tag" href="board_member_hub_rebuild.html?from=manager_hub">Open</a></article>';
      }).join('');
    }
    window.__zummeeV320ManagerOpenBoardRows = items;
  }

  async function refresh(){
    var items = await fetchTrueOpenBoardItems();
    window.__zummeeV320OpenBoardItems = items;
    if(document.querySelector('#submittedItemsHost')) renderBoardHub(items);
    renderManagerHub(items);
    return items;
  }

  window.loadSubmittedItems = refresh;
  window.renderSubmittedItems = renderBoardHub;
  window.zummeeRefreshBoardSubmitted = refresh;
  window.zummeeRefreshManagerBoardPanel = refresh;

  function schedule(){
    clearTimeout(refreshTimer);
    refresh();
    [400,1200,2500,5000,9000,14000].forEach(function(ms){ setTimeout(refresh, ms); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once:true }); else schedule();
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) schedule(); });
  window.addEventListener('community:changed', function(){ setTimeout(schedule,100); });
})();
