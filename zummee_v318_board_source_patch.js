/* Zummee v318 board submitted legacy-history guard + Supabase fallback */
(function(){
  if(window.__ZUMMEE_V318_BOARD_SOURCE_PATCH__) return;
  window.__ZUMMEE_V318_BOARD_SOURCE_PATCH__ = true;
  var URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var KEY = 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  function s(v){ return String(v == null ? '' : v).trim(); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v)); }
  async function getSB(){
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient; }catch(e){}
    try{ if(window.sb && typeof window.sb.from === 'function'){ window.supabaseClient = window.sb; return window.sb; } }catch(e){}
    try{ if(typeof window.ensureSupabase === 'function'){ var c = await window.ensureSupabase(); if(c && typeof c.from === 'function'){ window.supabaseClient = c; window.sb = c; return c; } } }catch(e){}
    try{ if(window.supabase && typeof window.supabase.createClient === 'function'){ var n = window.supabase.createClient(URL, KEY, { auth:{ storageKey:'sb-zummee-auth', storage:window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }}); window.supabaseClient = n; window.sb = n; window.ensureSupabase = window.ensureSupabase || (async function(){ return n; }); return n; } }catch(e){ console.warn('[v318] Supabase fallback failed', e); }
    return null;
  }
  window.zummeeGetSB = window.zummeeGetSB || getSB;
  window.ensureSupabase = window.ensureSupabase || getSB;
  function activeCommunityId(){
    var keys = ['zummee_selected_community_id','activeCommunityId','zummeeActiveCommunityId','currentCommunityId'];
    for(var i=0;i<keys.length;i++){ var v=s(localStorage.getItem(keys[i])); if(isUuid(v)) return v; }
    var sel = document.querySelector('#communitySelect,#zummeeCommunitySelect,#communityDropdown,select[id*=community]');
    if(sel && isUuid(sel.value)) return s(sel.value);
    return '';
  }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function pick(row, names, fallback){ for(var i=0;i<names.length;i++){ var v=row && row[names[i]]; if(s(v)) return s(v); } return fallback || ''; }
  function getMeta(row){ return row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {}; }
  function rowKey(row){ row = row || {}; var md = getMeta(row); return s(row.source_id || md.board_item_id || md.id || row.id); }
  function isSubmittedEvent(row){ row = row || {}; var type = s(row.event_type || row.type).toLowerCase(); var title = s(row.title).toLowerCase(); var source = s(row.source_table).toLowerCase(); return type === 'board_item_submitted' || title === 'board item submitted' || source.indexOf('boardmemberaction') >= 0; }
  function isConvertedEvent(row){ row = row || {}; var type = s(row.event_type || row.type).toLowerCase(); var title = s(row.title).toLowerCase(); return type === 'new_work_order' || title.indexOf('converted to work order') >= 0; }
  function hasModernOpenState(row){
    var md = getMeta(row);
    return !!(md.board_item_id || md.open_state || md.item_status || md.status || md.workflow_state || md.open === true || md.is_open === true);
  }
  function openSubmittedEvents(rows){
    rows = Array.isArray(rows) ? rows : [];
    var converted = new Set();
    rows.forEach(function(row){
      if(!isConvertedEvent(row)) return;
      var md = getMeta(row);
      [md.board_item_id, md.source_id, md.original_board_item_id, md.board_id, md.work_order_id, row.source_id].forEach(function(id){ id=s(id); if(id) converted.add(id); });
    });
    var seen = new Set();
    var candidates = rows.filter(function(row){
      if(!isSubmittedEvent(row)) return false;
      var key = rowKey(row);
      if(!key) return false;
      if(converted.has(key)) return false;
      if(converted.has(s(getMeta(row).board_item_id))) return false;
      if(seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    var modern = candidates.filter(hasModernOpenState);
    if(modern.length) return modern;
    return candidates.length ? [candidates[0]] : [];
  }
  function normalize(row){
    row = row || {};
    var md = getMeta(row);
    return {
      id: row.id || row.source_id || md.board_item_id || md.id || '',
      source_id: row.source_id || md.board_item_id || md.id || '',
      title: pick(row, ['title','subject','event_type','type'], pick(md,['title','subject','event_type','type'], 'Board submitted item')),
      message: pick(row, ['message','details','description','body'], pick(md,['message','details','description','body'], 'Submitted item ready for board review.')),
      created_at: row.created_at || row.submitted_at || row.updated_at || new Date().toISOString(),
      priority: row.priority || md.priority || '',
      raw: row
    };
  }
  async function fetchBoardNotifications(){
    var sb = await getSB();
    var cid = activeCommunityId();
    if(!sb || !cid) return [];
    var res = await sb.from('notification_events').select('*').eq('community_id', cid).order('created_at', {ascending:false}).limit(200);
    if(res && res.error){ console.warn('[v318] notification_events failed', res.error); return []; }
    return openSubmittedEvents(res && Array.isArray(res.data) ? res.data : []).map(normalize);
  }
  function syncBoardCounts(count){
    count = Number(count||0);
    try{ var pill=document.querySelector('#submittedCountPill'); if(pill) pill.textContent='Submitted: '+count; }catch(e){}
    try{ var priority=document.querySelector('#prioritySubmittedPill'); if(priority) priority.textContent=count+' Submitted'; }catch(e){}
    try{ var mini=document.querySelector('#todaySubmittedMini'); if(mini) mini.textContent=String(count); }catch(e){}
  }
  window.renderSubmittedItems = function(items){
    var host = document.querySelector('#submittedItemsHost');
    if(!host) return;
    items = Array.isArray(items) ? items : [];
    syncBoardCounts(items.length);
    if(!items.length){ host.innerHTML = '<div class="board-empty">No submitted items for this community.</div>'; return; }
    host.innerHTML = items.map(function(item){
      return '<article class="item itemRow board-notification-item" data-notification-id="'+esc(item.id)+'" data-source-id="'+esc(item.source_id)+'">'
        + '<div><div class="itemTitle">'+esc(item.title || 'Board submitted item')+'</div>'
        + '<div class="muted">'+esc(item.message || 'Submitted item ready for board review.')+'</div>'
        + '<div class="tiny">Submitted '+esc(new Date(item.created_at).toLocaleString())+'</div></div>'
        + '<div class="itemActions"><button class="btn btn-primary" type="button" data-notification-open="'+esc(item.id)+'">Open</button></div>'
        + '</article>';
    }).join('');
  };
  window.loadSubmittedItems = async function(){
    var items = await fetchBoardNotifications();
    window.__zummeeV317OpenBoardNotifications = items;
    window.renderSubmittedItems(items);
    return items;
  };
  window.zummeeRefreshBoardSubmitted = window.loadSubmittedItems;
  async function patchManagerBoardPanel(){
    if(!/manager_hub/i.test(location.pathname)) return;
    var body = document.querySelector('#managerBoardItemsBody');
    if(!body) return;
    var items = await fetchBoardNotifications();
    try{ var pill=document.querySelector('#mh2BoardItemsPill'); if(pill) pill.textContent=String(items.length); }catch(e){}
    try{ var status=document.querySelector('#mh2BoardStatusPill'); if(status) status.textContent=items.length?'Open '+items.length:'Clear'; }catch(e){}
    try{ var note=document.querySelector('#mh2BoardItemNote'); if(note) note.textContent=items.length?'Board-submitted items loaded from notification events.':'No open board-submitted items for this community.'; }catch(e){}
    if(!items.length){ body.innerHTML='<div class="mh2-placeholder">No new board-submitted items for this community.</div>'; return; }
    body.innerHTML = items.slice(0,5).map(function(item){
      return '<article class="mh2-list-item"><div><div class="mh2-item-title">'+esc(item.title)+'</div><div class="mh2-item-copy">'+esc(item.message)+'</div><div class="mh2-board-meta"><span class="mh2-chip">Submitted '+esc(new Date(item.created_at).toLocaleString())+'</span></div></div><a class="mh2-item-tag mh2-board-tag" href="board_member_hub_rebuild.html">Open</a></article>';
    }).join('');
  }
  function run(){
    if(document.querySelector('#submittedItemsHost')) window.loadSubmittedItems();
    patchManagerBoardPanel();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(run,200); setTimeout(run,1200); setTimeout(run,3000); });
  else { setTimeout(run,200); setTimeout(run,1200); setTimeout(run,3000); }
  window.addEventListener('community:changed', function(){ setTimeout(run,100); });
})();
