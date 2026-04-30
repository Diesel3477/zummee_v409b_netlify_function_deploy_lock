/* Zummee v332 board open-items source of truth + cid-gated no-flash loader
   Board counts come ONLY from BoardMemberActionItems where status='open'.
   Loader does NOT run until a valid community UUID exists. */
(function(){
  if(window.__ZUMMEE_V332_BOARD_CID_GATED_LOCK__) return;
  window.__ZUMMEE_V332_BOARD_CID_GATED_LOCK__ = true;

  var URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var KEY = 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  var applying = false;
  var observer = null;
  var lastItems = null;
  var lastGoodAt = 0;
  var refreshInFlight = false;
  var cidRetryTimer = null;
  var lastFetchCid = '';
  var lastFetchAt = 0;
  var started = false;

  function s(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return s(v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v)); }
  function q(id){ return document.getElementById(id); }
  function setText(id,val){ var el=q(id); if(el) el.textContent=String(val); }
  function isBoardOrManager(){ return /board_member_hub|manager_hub/i.test(location.pathname) || q('submittedCountPill') || q('mh2AlertBoard'); }

  async function getSB(){
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient; }catch(e){}
    try{ if(window.sb && typeof window.sb.from === 'function'){ window.supabaseClient=window.sb; return window.sb; } }catch(e){}
    try{ if(typeof window.ensureSupabase === 'function'){
      var c = await window.ensureSupabase();
      if(c && typeof c.from === 'function'){ window.supabaseClient=c; window.sb=c; return c; }
    }}catch(e){ console.warn('[v332 board] ensureSupabase failed', e); }
    try{
      if(window.supabase && typeof window.supabase.createClient === 'function'){
        var c1 = window.supabase.createClient(URL, KEY, {auth:{storageKey:'sb-zummee-auth', storage:window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}});
        window.supabaseClient=c1; window.sb=c1; window.ensureSupabase=async function(){ return c1; };
        return c1;
      }
    }catch(e){ console.warn('[v332 board] createClient fallback failed', e); }
    return null;
  }
  window.zummeeGetSB = getSB;
  if(typeof window.ensureSupabase !== 'function') window.ensureSupabase = getSB;

  function activeCommunityId(){
    var sels=['#communitySelect','#zummeeCommunitySelect','#communityDropdown','select[id*=community]'];
    for(var i=0;i<sels.length;i++){ var el=document.querySelector(sels[i]); if(el && isUuid(el.value)) return s(el.value); }
    var keys=['zummee_selected_community_id','activeCommunityId','zummeeActiveCommunityId','currentCommunityId'];
    for(var j=0;j<keys.length;j++){ try{ var v=localStorage.getItem(keys[j]); if(isUuid(v)) return s(v); }catch(e){} }
    return '';
  }

  async function restoreStoredSession(sb){
    if(!sb || !sb.auth) return null;
    try{
      var cur = await sb.auth.getSession();
      if(cur && cur.data && cur.data.session) return cur.data.session;
    }catch(e){}
    try{
      var access = localStorage.getItem('sb_access_token');
      var refresh = localStorage.getItem('sb_refresh_token');
      if(access && refresh && typeof sb.auth.setSession === 'function'){
        var res = await sb.auth.setSession({access_token:access, refresh_token:refresh});
        if(res && res.data && res.data.session){
          console.info('[v332 board] session restored from stored tokens');
          return res.data.session;
        }
        if(res && res.error) console.warn('[v332 board] setSession failed', res.error);
      }
    }catch(e){ console.warn('[v332 board] restoreStoredSession exception', e); }
    return null;
  }

  async function waitSoftSession(sb){
    var session = await restoreStoredSession(sb);
    if(session) return session;
    for(var i=0;i<10;i++){
      await new Promise(function(r){ setTimeout(r, 250); });
      session = await restoreStoredSession(sb);
      if(session) return session;
    }
    return null;
  }

  function normalize(row){
    row=row||{};
    return {id:s(row.id), title:s(row.title||'Board submitted item'), message:'Submitted item ready for board review.', created_at:row.created_at||new Date().toISOString(), status:s(row.status||'')};
  }

  async function fetchOpenItems(){
    var sb = await getSB();
    var cid = activeCommunityId();
    if(!sb || !cid){ return null; }

    var session = await waitSoftSession(sb);
    if(!session){
      console.warn('[v332 board] session not ready; preserving existing UI');
      return null;
    }

    var res = await sb.from('BoardMemberActionItems')
      .select('id,title,status,created_at,community_id')
      .eq('community_id', cid)
      .eq('status','open')
      .order('created_at',{ascending:false});

    if(res && res.error){
      console.warn('[v332 board] open board query failed (not an auth wipe)', res.error);
      return null;
    }
    return (res && Array.isArray(res.data) ? res.data : []).map(normalize);
  }

  function syncCount(n){
    n = Number(n||0);
    setText('submittedCountPill', 'Submitted: ' + n);
    setText('prioritySubmittedPill', n + ' Submitted');
    setText('boardAttentionCount', String(n));
    setText('todaySubmittedMini', String(n));
    setText('mh2BoardItemsPill', String(n));
    setText('mh2BoardOverdueCount','0');
    setText('mh2BoardStatusPill', n ? 'Open ' + n : 'Clear');
  }

  function card(it){
    return '<article class="item itemRow board-open-item" data-source-id="'+esc(it.id)+'"><div><div class="itemTitle">'+esc(it.title)+'</div><div class="muted">'+esc(it.message)+'</div><div class="tiny">Submitted '+esc(new Date(it.created_at).toLocaleString())+'</div></div><div class="itemActions"><button class="btn btn-primary" type="button" data-source-id="'+esc(it.id)+'">Open</button></div></article>';
  }

  function renderBoardHub(items){
    if(!q('submittedItemsHost') && !q('submittedCountPill')) return;
    items=Array.isArray(items)?items:[];
    applying=true;
    window.__BOARD_ALREADY_RENDERED__ = true;
    syncCount(items.length);
    var host=q('submittedItemsHost');
    if(host) host.innerHTML = items.length ? items.map(card).join('') : '<div class="board-empty">No submitted items for this community.</div>';
    var needs=q('boardNeedsAttention');
    if(needs){
      needs.innerHTML = items.length ? items.slice(0,5).map(function(it){ return '<div class="command-attention-item" data-scroll-target="submittedItemsHost"><div class="command-attention-icon">1</div><div class="command-attention-text"><strong>Review submitted item</strong><span>'+esc(it.title)+'</span></div><div class="command-attention-chevron">›</div></div>'; }).join('') : '<div class="command-empty">No board-submitted items need review.</div>';
    }
    applying=false;
  }

  function renderManagerHub(items){
    if(!q('mh2AlertBoard') && !q('managerBoardItemsBody') && !q('mh2BoardItemsPill')) return;
    items=Array.isArray(items)?items:[];
    applying=true;
    syncCount(items.length);
    var alert=q('mh2AlertBoard');
    if(alert){
      alert.classList.remove('is-good','is-attention','is-urgent');
      alert.classList.add(items.length ? 'is-attention' : 'is-good');
      alert.setAttribute('href','board_member_hub_rebuild.html?from=manager_hub');
      alert.setAttribute('data-zummee-route','board_member_hub_rebuild.html?from=manager_hub');
      alert.innerHTML='<div class="mh2-alert-top"><div class="mh2-alert-title">Board review status</div><div class="mh2-alert-badge">'+(items.length?'OPEN':'STABLE')+'</div></div><div class="mh2-alert-copy">'+(items.length?esc(items.length+' open board item'+(items.length===1?'':'s')+' ready for review.'):'No open board items for the selected community.')+'</div>';
    }
    var body=q('managerBoardItemsBody');
    if(body){ body.innerHTML = items.length ? items.slice(0,5).map(function(it){ return '<article class="mh2-list-item"><div><div class="mh2-item-title">'+esc(it.title)+'</div><div class="mh2-item-copy">'+esc(it.message)+'</div></div><a class="mh2-item-tag mh2-board-tag" href="board_member_hub_rebuild.html?from=manager_hub">Open</a></article>'; }).join('') : '<div class="mh2-placeholder">No new board-submitted items for this community.</div>'; }
    applying=false;
  }

  async function refresh(){
    if(refreshInFlight) return null;
    refreshInFlight = true;
    try{
      var items = await fetchOpenItems();
      if(items === null){ return null; }
      lastItems = items;
      lastGoodAt = Date.now();
      window.__zummeeV332OpenBoardItems = items;
      window.__zummeeV329OpenBoardItems = items;
      renderBoardHub(items);
      renderManagerHub(items);
      return items;
    }finally{ refreshInFlight = false; }
  }

  function restoreIfWiped(){
    if(applying || !lastItems || !lastGoodAt) return;
    var txt = '';
    try{ txt = ((q('submittedItemsHost')&&q('submittedItemsHost').textContent)||'') + ' ' + ((q('boardNeedsAttention')&&q('boardNeedsAttention').textContent)||'') + ' ' + ((q('mh2AlertBoard')&&q('mh2AlertBoard').textContent)||''); }catch(e){}
    if(/session needed|auth not ready|load submitted items|loading board priorities/i.test(txt)){
      console.warn('[v332 board] legacy wipe detected; restoring last good board render');
      renderBoardHub(lastItems);
      renderManagerHub(lastItems);
    }
  }

  window.zummeeBoardSoftRefresh = refresh;
  window.zummeeHardSessionGateRefresh = refresh;
  window.zummeeRefreshBoardSubmitted = refresh;
  window.zummeeRefreshManagerBoardPanel = refresh;
  window.loadSubmittedItems = refresh;
  window.fetchOpenItems = fetchOpenItems;
  window.renderSubmittedItems = function(items){ renderBoardHub(Array.isArray(items)?items:(lastItems||[])); };

  function installObserver(){
    if(observer || !document.body) return;
    observer = new MutationObserver(function(){
      if(applying) return;
      clearTimeout(window.__zummeeV329RestoreTimer);
      window.__zummeeV329RestoreTimer = setTimeout(restoreIfWiped, 50);
    });
    try{ observer.observe(document.body, {childList:true, subtree:true, characterData:true}); }catch(e){}
  }

  function scheduleUntilCommunity(reason){
    if(cidRetryTimer) return;
    var tries = 0;
    cidRetryTimer = setInterval(function(){
      tries++;
      var cid = activeCommunityId();
      if(cid){
        clearInterval(cidRetryTimer);
        cidRetryTimer = null;
        safeFetchBoard(reason || 'community-ready');
      } else if(tries > 40){
        clearInterval(cidRetryTimer);
        cidRetryTimer = null;
        console.warn('[v332 board] no valid community UUID yet; board load paused');
      }
    }, 150);
  }

  function safeFetchBoard(reason){
    if(!isBoardOrManager()) return null;
    installObserver();
    var cid = activeCommunityId();
    if(!cid){
      scheduleUntilCommunity(reason || 'no-cid');
      return null;
    }
    var now = Date.now();
    // Do not run the same community repeatedly during boot. This prevents 50/0/correct flashing.
    if(lastFetchCid === cid && (now - lastFetchAt) < 1200){
      return null;
    }
    lastFetchCid = cid;
    lastFetchAt = now;
    return refresh();
  }

  function start(){
    if(!isBoardOrManager()) return;
    installObserver();
    if(!started){
      started = true;
      safeFetchBoard('start');
      // A single delayed pass only, after community restore/watchdogs settle.
      setTimeout(function(){ safeFetchBoard('settled-pass'); }, 1800);
      var ticks=0;
      var t=setInterval(function(){ ticks++; restoreIfWiped(); if(ticks>40) clearInterval(t); }, 500);
    } else {
      safeFetchBoard('start-again');
    }
  }

  window.safeFetchBoard = safeFetchBoard;

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
  window.addEventListener('pageshow', function(){ setTimeout(function(){ safeFetchBoard('pageshow'); }, 120); });
  document.addEventListener('community:changed', function(){
    lastFetchCid = '';
    lastFetchAt = 0;
    setTimeout(function(){ safeFetchBoard('community-changed'); }, 120);
  });
})();
