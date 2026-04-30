/* Zummee v318 manager board open-item legacy-history guard */
(function(){
  if(window.__ZUMMEE_V318_MANAGER_BOARD_OPEN_FILTER__) return;
  window.__ZUMMEE_V318_MANAGER_BOARD_OPEN_FILTER__ = true;
  var URL='https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var KEY='sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  function s(v){ return String(v==null?'':v).trim(); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v)); }
  async function getSB(){
    try{ if(window.supabaseClient && typeof window.supabaseClient.from==='function') return window.supabaseClient; }catch(e){}
    try{ if(window.sb && typeof window.sb.from==='function'){ window.supabaseClient=window.sb; return window.sb; } }catch(e){}
    try{ if(typeof window.ensureSupabase==='function'){ var c=await window.ensureSupabase(); if(c && typeof c.from==='function'){ window.supabaseClient=c; window.sb=c; return c; } }catch(e){}
    try{ if(window.supabase && typeof window.supabase.createClient==='function'){ var n=window.supabase.createClient(URL, KEY, {auth:{storageKey:'sb-zummee-auth',storage:window.localStorage,persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}); window.supabaseClient=n; window.sb=n; window.ensureSupabase=window.ensureSupabase||async function(){return n;}; return n; } }catch(e){ console.warn('[v318 manager board] Supabase fallback failed',e); }
    return null;
  }
  function selectedId(){
    var sel=document.querySelector('#zummeeCommunitySelect,#communitySelect,#communityDropdown,select[id*=community]');
    if(sel && isUuid(sel.value)) return s(sel.value);
    var keys=['zummee_selected_community_id','activeCommunityId','zummeeActiveCommunityId','currentCommunityId'];
    for(var i=0;i<keys.length;i++){ var v=s(localStorage.getItem(keys[i])); if(isUuid(v)) return v; }
    return '';
  }
  function meta(row){ return row && row.metadata && typeof row.metadata==='object' ? row.metadata : {}; }
  function keyOf(row){ var md=meta(row); return s(row && (row.source_id || md.board_item_id || md.id || row.id)); }
  function isSubmitted(row){ var type=s(row && (row.event_type||row.type)).toLowerCase(); var title=s(row && row.title).toLowerCase(); var source=s(row && row.source_table).toLowerCase(); return type==='board_item_submitted' || title==='board item submitted' || source.indexOf('boardmemberaction')>=0; }
  function isConverted(row){ var type=s(row && (row.event_type||row.type)).toLowerCase(); var title=s(row && row.title).toLowerCase(); return type==='new_work_order' || title.indexOf('converted to work order')>=0; }
  function hasModernOpenState(r){ var md=meta(r); return !!(md.board_item_id||md.open_state||md.item_status||md.status||md.workflow_state||md.open===true||md.is_open===true); }
  function openEvents(rows){
    rows=Array.isArray(rows)?rows:[];
    var converted=new Set();
    rows.forEach(function(r){
      if(!isConverted(r)) return;
      var md=meta(r);
      [md.board_item_id, md.source_id, md.original_board_item_id, md.board_id, md.work_order_id, r.source_id].forEach(function(id){ id=s(id); if(id) converted.add(id); });
    });
    var seen=new Set();
    var candidates=rows.filter(function(r){
      if(!isSubmitted(r)) return false;
      var k=keyOf(r);
      if(!k || converted.has(k) || converted.has(s(meta(r).board_item_id)) || seen.has(k)) return false;
      seen.add(k); return true;
    });
    var modern=candidates.filter(hasModernOpenState);
    if(modern.length) return modern;
    return candidates.length ? [candidates[0]] : [];
  }
  function norm(r){ var md=meta(r); return {id:r.id||r.source_id||md.board_item_id||'', source_id:r.source_id||md.board_item_id||'', title:s(r.title||md.title||'Board Item Submitted'), message:s(r.message||md.message||'A new board item was submitted and needs review.'), created_at:r.created_at||new Date().toISOString(), raw:r}; }
  async function fetchOpen(){ var sb=await getSB(); var cid=selectedId(); if(!sb||!cid) return []; var q=await sb.from('notification_events').select('*').eq('community_id',cid).order('created_at',{ascending:false}).limit(200); if(q.error){ console.warn('[v318 manager board] query failed', q.error); return []; } return openEvents(q.data||[]).map(norm); }
  function set(id,v){ var el=document.getElementById(id); if(el) el.textContent=String(v); }
  function render(items){
    items=Array.isArray(items)?items:[];
    set('mh2BoardItemsPill',items.length); set('mh2BoardStatusPill',items.length?'Open '+items.length:'Clear'); set('mh2BoardOverdueCount',0); set('mh2BoardItemNote',items.length?'Open board-submitted items awaiting review.':'No open board-submitted items for this community.');
    var alert=document.getElementById('mh2AlertBoard');
    if(alert){ alert.classList.remove('is-good','is-attention','is-urgent'); alert.classList.add(items.length?'is-attention':'is-good'); alert.setAttribute('href','board_member_hub_rebuild.html?from=manager_hub'); alert.setAttribute('data-zummee-route','board_member_hub_rebuild.html?from=manager_hub'); alert.innerHTML='<div class="mh2-alert-top"><div class="mh2-alert-title">Board review status</div><div class="mh2-alert-badge">'+(items.length?'OPEN':'STABLE')+'</div></div><div class="mh2-alert-copy">'+(items.length?esc(items.length+' submitted item'+(items.length===1?'':'s')+' ready for review.'):'No open board items for the selected community.')+'</div>'; }
    var body=document.getElementById('managerBoardItemsBody');
    if(body){
      if(!items.length) body.innerHTML='<div class="mh2-placeholder">No new board-submitted items for this community.</div>';
      else body.innerHTML=items.slice(0,5).map(function(it){return '<article class="mh2-list-item"><div><div class="mh2-item-title">'+esc(it.title)+'</div><div class="mh2-item-copy">'+esc(it.message)+'</div><div class="mh2-board-meta"><span class="mh2-chip">Submitted '+esc(new Date(it.created_at).toLocaleString())+'</span></div></div><a class="mh2-item-tag mh2-board-tag" href="board_member_hub_rebuild.html?from=manager_hub">Open</a></article>';}).join('');
    }
    window.__zummeeV317ManagerOpenBoardRows=items;
  }
  async function refresh(){ var items=await fetchOpen(); render(items); console.log('[v318 manager board open]',items.length,'open rows'); return items; }
  window.zummeeRefreshManagerBoardPanel=refresh;
  function schedule(){ refresh(); setTimeout(refresh,500); setTimeout(refresh,1600); setTimeout(refresh,3600); setTimeout(refresh,7000); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  window.addEventListener('pageshow',schedule); document.addEventListener('community:changed',function(){setTimeout(schedule,100);}); document.addEventListener('visibilitychange',function(){ if(!document.hidden) schedule(); });
})();
