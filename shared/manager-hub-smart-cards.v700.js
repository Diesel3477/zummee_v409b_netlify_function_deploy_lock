/*
  Zummee Manager Hub Smart Cards v700
  Long-term controller: one owner, one render path, no delayed repaint loops.

  Owns only:
    - #mh2AlertBoard
    - #mh2AlertActivity
    - #mh2AlertApprovals

  Data sources:
    - Board review: public.notification_events where event_type = board_item_submitted
    - Maintenance: public.resident_work_orders
    - Annual approvals: public.annual_meeting_approval_requests

  Rules:
    - Never render a zero/fallback over a previous good value after a failed/late query.
    - Never allow stale results from a previous community to paint the current community.
    - Only load on initial boot and selected community change.
    - pageshow/focus repaint cached data only; they do not restart multi-second polling.
*/
(function(){
  'use strict';

  if(window.__ZUMMEE_MANAGER_HUB_SMART_CARDS_V700__) return;
  window.__ZUMMEE_MANAGER_HUB_SMART_CARDS_V700__ = true;

  var BUILD = '2026-05-11-v700-manager-hub-smart-cards-single-owner';
  var SUPABASE_URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_DqOtjzILWph7-bFjKIFN0w_kSpPI864';
  var TIMEOUT_MS = 6500;
  var CACHE_PREFIX = 'zummee_manager_hub_smart_cards_v700:';
  var READY_ATTRS = ['data-zummee-smart-alerts-ready','data-zummee-smart-alerts-v426-ready','data-zummee-smart-cards-v700-ready'];

  var CARD_IDS = {
    board: 'mh2AlertBoard',
    maintenance: 'mh2AlertActivity',
    annual: 'mh2AlertApprovals'
  };

  var state = {
    build: BUILD,
    booted: false,
    loading: false,
    loadSeq: 0,
    activeCommunityId: '',
    activeCommunityName: '',
    latest: null,
    lastGoodByCommunity: {},
    lastError: null
  };

  window.__ZummeeManagerHubSmartCardsV700State = state;

  function s(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return s(v).toLowerCase(); }
  function uuidish(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v)); }
  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function todayStart(){ var d = new Date(); d.setHours(0,0,0,0); return d; }
  function safeJsonParse(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(_e){ return null; } }

  function setReady(on){
    READY_ATTRS.forEach(function(attr){
      try{
        if(on) document.documentElement.setAttribute(attr, '1');
        else document.documentElement.removeAttribute(attr);
      }catch(_e){}
    });
  }

  function getCard(key){ return document.getElementById(CARD_IDS[key]); }

  function readCommunityFromState(){
    try{
      if(window.ZummeeCommunityState && typeof window.ZummeeCommunityState.getActiveCommunity === 'function'){
        var c = window.ZummeeCommunityState.getActiveCommunity();
        if(c && uuidish(c.id)) return { id:s(c.id), name:s(c.name), source:'ZummeeCommunityState' };
      }
    }catch(_e){}

    try{
      var sel = document.getElementById('zummeeCommunitySelect') || document.getElementById('communitySelect') || document.querySelector('select[data-community-select], select[name="community"]');
      if(sel && uuidish(sel.value)){
        var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        return { id:s(sel.value), name:s(opt && opt.textContent), source:'dropdown' };
      }
    }catch(_e2){}

    var rawKeys = ['zummee_active_community_v601','zummee_active_community','zummee_selected_community'];
    for(var i=0;i<rawKeys.length;i++){
      try{
        var obj = safeJsonParse(localStorage.getItem(rawKeys[i]) || sessionStorage.getItem(rawKeys[i]) || '');
        if(obj && uuidish(obj.id)) return { id:s(obj.id), name:s(obj.name), source:rawKeys[i] };
      }catch(_e3){}
    }

    var idKeys = ['zummee_active_community_id','zummee_selected_community_id','zummeeActiveCommunityId','activeCommunityId','currentCommunityId','zummee_community_id'];
    var nameKeys = ['zummee_active_community_name','zummeeCurrentCommunityName','currentCommunityName','activeCommunityName'];
    var id = '';
    var name = '';
    idKeys.some(function(k){ try{ id = s(localStorage.getItem(k) || sessionStorage.getItem(k)); return uuidish(id); }catch(_e4){ return false; } });
    nameKeys.some(function(k){ try{ name = s(localStorage.getItem(k) || sessionStorage.getItem(k)); return !!name; }catch(_e5){ return false; } });
    if(uuidish(id)) return { id:id, name:name, source:'storage-scalar' };

    return { id:'', name:'', source:'none' };
  }

  async function ensureSupabaseSdk(){
    if(window.supabase && typeof window.supabase.createClient === 'function') return true;
    var existing = document.querySelector('script[src*="supabase-js"]');
    if(existing){
      for(var i=0;i<40;i++){
        if(window.supabase && typeof window.supabase.createClient === 'function') return true;
        await sleep(100);
      }
    }
    return false;
  }

  function findExistingClient(){
    var names = ['supabaseClient','sb','supabaseClientV2','ZUMMEE_SUPABASE','__zummeeSupabase','zummeeSupabase','__sb'];
    for(var i=0;i<names.length;i++){
      try{ var c = window[names[i]]; if(c && typeof c.from === 'function') return { client:c, source:'window.' + names[i] }; }catch(_e){}
    }
    var fns = ['getSupabase','ensureSupabaseSync','requireSb'];
    for(var j=0;j<fns.length;j++){
      try{ var fn = window[fns[j]]; if(typeof fn === 'function'){ var c2 = fn(); if(c2 && typeof c2.from === 'function') return { client:c2, source:fns[j] + '()' }; } }catch(_e2){}
    }
    return { client:null, source:'none' };
  }

  async function client(){
    var existing = findExistingClient();
    if(existing.client) return existing;
    await ensureSupabaseSdk();
    try{
      if(window.supabase && typeof window.supabase.createClient === 'function'){
        if(!window.__ZummeeManagerHubSmartCardsV700Sb){
          window.__ZummeeManagerHubSmartCardsV700Sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        return { client:window.__ZummeeManagerHubSmartCardsV700Sb, source:'v700-created-client' };
      }
    }catch(err){ return { client:null, source:'create failed: ' + (err && err.message ? err.message : String(err)) }; }
    return { client:null, source:'no-client' };
  }

  function metadata(row){
    var raw = row && row.metadata;
    if(!raw) return {};
    if(typeof raw === 'object') return raw;
    return safeJsonParse(raw) || {};
  }

  function statusOf(row){
    var m = metadata(row);
    return lower(row && (row.status || row.approval_status || row.state || row.workflow_status || row.board_status || row.item_status || m.status || m.approval_status || m.state || m.workflow_status || m.board_status));
  }

  function isClosed(row){
    if(!row) return true;
    if(row.archived_at || row.completed_at || row.deleted_at || row.closed_at || row.mailed_at) return true;
    return ['completed','complete','closed','archived','approved','rejected','done','mailed','cancelled','canceled','inactive','resolved'].indexOf(statusOf(row)) >= 0;
  }

  function dateFrom(row){
    return s(row && (row.due_date || row.deadline || row.next_annual_meeting_date || row.created_at || row.updated_at || row.initiated_at)).slice(0,10);
  }

  function isOverdue(row){
    var raw = dateFrom(row);
    if(!raw) return false;
    var dt = new Date(raw + 'T00:00:00');
    if(Number.isNaN(dt.getTime())) return false;
    return dt.getTime() < todayStart().getTime();
  }

  function withTimeout(promise, label){
    return new Promise(function(resolve){
      var done = false;
      var timer = setTimeout(function(){
        if(done) return;
        done = true;
        resolve({ ok:false, label:label, timeout:true, error:'Timed out after ' + TIMEOUT_MS + 'ms', rows:[], count:null, totalRows:0 });
      }, TIMEOUT_MS);
      Promise.resolve(promise).then(function(value){
        if(done) return;
        done = true;
        clearTimeout(timer);
        resolve(value);
      }).catch(function(err){
        if(done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok:false, label:label, error:err && err.message ? err.message : String(err), rows:[], count:null, totalRows:0 });
      });
    });
  }

  function normalize(label, source, rows, filter){
    rows = Array.isArray(rows) ? rows : [];
    filter = filter || function(r){ return !isClosed(r); };
    var open = rows.filter(filter);
    return { ok:true, label:label, source:source, rows:open, count:open.length, overdue:open.filter(isOverdue).length, totalRows:rows.length };
  }

  async function loadBoard(sb, community){
    if(!sb || !uuidish(community.id)) return { ok:false, label:'board', source:'notification_events.board_item_submitted', count:null, rows:[], error:'missing client/community' };
    var res = await sb.from('notification_events').select('*').eq('community_id', community.id).eq('event_type','board_item_submitted').limit(250);
    if(res && res.error) return { ok:false, label:'board', source:'notification_events.board_item_submitted', count:null, rows:[], error:res.error.message || JSON.stringify(res.error) };
    return normalize('board', 'notification_events.board_item_submitted', res && res.data, function(row){ return !isClosed(row); });
  }

  function isOpenMaintenance(row){
    if(isClosed(row)) return false;
    var st = statusOf(row);
    return ['draft','deleted','void'].indexOf(st) < 0;
  }

  async function loadMaintenance(sb, community){
    if(!sb || !uuidish(community.id)) return { ok:false, label:'maintenance', source:'resident_work_orders', count:null, rows:[], error:'missing client/community' };
    var res = await sb.from('resident_work_orders').select('*').eq('community_id', community.id).limit(250);
    if(res && res.error) return { ok:false, label:'maintenance', source:'resident_work_orders', count:null, rows:[], error:res.error.message || JSON.stringify(res.error) };
    var out = normalize('maintenance', 'resident_work_orders', res && res.data, isOpenMaintenance);
    out.urgent = out.rows.filter(function(row){ return /urgent|emergency|high/i.test(s(row.priority || row.severity || row.level)); }).length;
    return out;
  }

  function isOpenAnnual(row){
    if(!row) return false;
    if(row.archived_at || row.mailed_at || row.deleted_at) return false;
    var st = lower(row.current_step || row.approval_status || row.status);
    return ['completed','complete','closed','archived','mailed','cancelled','canceled'].indexOf(st) < 0;
  }

  async function loadAnnual(sb, community){
    if(!sb || !uuidish(community.id)) return { ok:false, label:'annual', source:'annual_meeting_approval_requests', count:null, rows:[], error:'missing client/community' };
    var res = await sb.from('annual_meeting_approval_requests')
      .select('id,community_id,current_step,approval_status,status,archived_at,mailed_at,deleted_at,created_at,updated_at,initiated_at,next_annual_meeting_date')
      .eq('community_id', community.id)
      .is('archived_at', null)
      .limit(100);
    if(res && res.error) return { ok:false, label:'annual', source:'annual_meeting_approval_requests', count:null, rows:[], error:res.error.message || JSON.stringify(res.error) };
    return normalize('annual', 'annual_meeting_approval_requests', res && res.data, isOpenAnnual);
  }

  function cacheKey(communityId){ return CACHE_PREFIX + communityId; }

  function readCache(communityId){
    try{
      var obj = safeJsonParse(sessionStorage.getItem(cacheKey(communityId)) || localStorage.getItem(cacheKey(communityId)) || '');
      if(obj && obj.community && obj.community.id === communityId) return obj;
    }catch(_e){}
    return null;
  }

  function writeCache(summary){
    if(!summary || !summary.community || !uuidish(summary.community.id)) return;
    try{ sessionStorage.setItem(cacheKey(summary.community.id), JSON.stringify(summary)); }catch(_e){}
    try{ localStorage.setItem(cacheKey(summary.community.id), JSON.stringify(summary)); }catch(_e2){}
  }

  function mergeCount(previous, result, key){
    if(result && result.ok && Number.isFinite(Number(result.count))) return Number(result.count);
    if(previous && Number.isFinite(Number(previous[key]))) return Number(previous[key]);
    return 0;
  }

  function buildSummary(community, clientSource, previous, results){
    var board = results[0] || {};
    var maintenance = results[1] || {};
    var annual = results[2] || {};
    return {
      build: BUILD,
      community: community,
      clientSource: clientSource,
      board: mergeCount(previous, board, 'board'),
      boardOverdue: board && board.ok ? Number(board.overdue || 0) : Number(previous && previous.boardOverdue || 0),
      maintenance: mergeCount(previous, maintenance, 'maintenance'),
      maintenanceUrgent: maintenance && maintenance.ok ? Number(maintenance.urgent || 0) : Number(previous && previous.maintenanceUrgent || 0),
      annual: mergeCount(previous, annual, 'annual'),
      annualOverdue: annual && annual.ok ? Number(annual.overdue || 0) : Number(previous && previous.annualOverdue || 0),
      sources: { board:board, maintenance:maintenance, annual:annual },
      loadedAt: Date.now()
    };
  }

  function setAlert(key, opts){
    var card = getCard(key);
    if(!card) return;
    opts = opts || {};
    var tone = opts.tone || 'good';

    card.dataset.smartCardsOwner = 'v700';
    card.style.display = '';
    card.style.visibility = 'visible';
    card.style.opacity = '1';

    card.classList.remove('is-good','is-attention','is-urgent');
    card.classList.add(tone === 'urgent' ? 'is-urgent' : (tone === 'attention' ? 'is-attention' : 'is-good'));

    if(opts.href) card.setAttribute('href', opts.href);

    var title = card.querySelector('.mh2-alert-title');
    var badge = card.querySelector('.mh2-alert-badge');
    var copy = card.querySelector('.mh2-alert-copy');
    if(title && title.textContent !== opts.title) title.textContent = opts.title || '';
    if(badge && badge.textContent !== opts.badge) badge.textContent = opts.badge || '';
    if(copy && copy.textContent !== opts.copy) copy.textContent = opts.copy || '';
  }

  function render(summary){
    if(!summary || !summary.community || !uuidish(summary.community.id)) return false;
    if(state.activeCommunityId && summary.community.id !== state.activeCommunityId) return false;

    var boardCount = Number(summary.board || 0);
    var boardOverdue = Number(summary.boardOverdue || 0);
    setAlert('board', {
      tone: boardOverdue > 0 ? 'urgent' : (boardCount > 0 ? 'attention' : 'good'),
      title: 'Board review status',
      badge: boardOverdue > 0 ? (boardOverdue + ' overdue') : (boardCount > 0 ? (boardCount + ' open') : 'Clear'),
      copy: boardCount > 0 ? (boardCount + ' board-submitted item' + (boardCount === 1 ? '' : 's') + ' awaiting review.') : 'No board items need review right now.',
      href: 'board_member_hub_v2.html'
    });

    var maintCount = Number(summary.maintenance || 0);
    var maintUrgent = Number(summary.maintenanceUrgent || 0);
    setAlert('maintenance', {
      tone: maintUrgent > 0 ? 'urgent' : (maintCount > 0 ? 'attention' : 'good'),
      title: 'Maintenance activity',
      badge: maintUrgent > 0 ? (maintUrgent + ' urgent') : (maintCount > 0 ? (maintCount + ' open') : 'Quiet'),
      copy: maintCount > 0 ? (maintCount + ' open maintenance item' + (maintCount === 1 ? '' : 's') + ' for this community.') : 'No open maintenance activity for this community.',
      href: 'maintenance_updates.html'
    });

    var annualCount = Number(summary.annual || 0);
    var annualOverdue = Number(summary.annualOverdue || 0);
    setAlert('annual', {
      tone: annualOverdue > 0 ? 'urgent' : (annualCount > 0 ? 'attention' : 'good'),
      title: 'Annual meeting approvals',
      badge: annualOverdue > 0 ? (annualOverdue + ' overdue') : (annualCount > 0 ? (annualCount + ' open') : 'Clear'),
      copy: annualCount > 0 ? (annualCount + ' annual meeting approval workflow' + (annualCount === 1 ? '' : 's') + ' active for this community.') : 'No active annual meeting approval workflows.',
      href: 'board_member_hub_v2.html#annualApprovalRequestsSection'
    });

    state.latest = summary;
    state.lastGoodByCommunity[summary.community.id] = summary;
    window.__ManagerHubSmartAlertsSummaryV700 = summary;
    window.__ManagerHubSmartAlertsSummaryV633 = summary; // compatibility for existing diagnostics
    writeCache(summary);
    setReady(true);
    return true;
  }

  async function loadAndRender(reason){
    var community = readCommunityFromState();
    state.activeCommunityId = community.id;
    state.activeCommunityName = community.name;

    if(!uuidish(community.id)){
      state.lastError = 'No valid community selected';
      return null;
    }

    var seq = ++state.loadSeq;
    var previous = state.lastGoodByCommunity[community.id] || readCache(community.id) || null;
    if(previous) render(previous);
    else setReady(false);

    state.loading = true;
    try{
      var resolved = await client();
      var sb = resolved.client;
      var results = await Promise.all([
        withTimeout(loadBoard(sb, community), 'board'),
        withTimeout(loadMaintenance(sb, community), 'maintenance'),
        withTimeout(loadAnnual(sb, community), 'annual')
      ]);

      if(seq !== state.loadSeq || community.id !== state.activeCommunityId) return state.latest;

      var summary = buildSummary(community, resolved.source, previous, results);
      summary.reason = reason || 'load';
      render(summary);
      return summary;
    }catch(err){
      state.lastError = err && err.message ? err.message : String(err);
      if(previous) render(previous);
      return previous;
    }finally{
      if(seq === state.loadSeq) state.loading = false;
    }
  }

  function boot(){
    if(state.booted) return;
    state.booted = true;
    loadAndRender('boot');
  }

  function reloadForCommunity(){
    var community = readCommunityFromState();
    state.activeCommunityId = community.id;
    state.activeCommunityName = community.name;
    state.loadSeq++;
    state.loading = false;
    state.latest = null;
    setReady(false);
    loadAndRender('community-changed');
  }

  window.refreshManagerHubCanonicalSmartAlerts = function(){ return loadAndRender('manual-refresh'); };
  window.refreshManagerHubSmartCardsAuthoritative = window.refreshManagerHubCanonicalSmartAlerts;
  window.refreshManagerHubSmartCardsStable = window.refreshManagerHubCanonicalSmartAlerts;
  window.getManagerHubSmartCardsSummary = function(){ return state.latest || window.__ManagerHubSmartAlertsSummaryV700 || null; };
  window.getManagerHubSmartCardsDeploymentStatus = function(){
    return {
      build: BUILD,
      singleOwner:true,
      activeCommunityId: state.activeCommunityId,
      loading: state.loading,
      loadSeq: state.loadSeq,
      summary: state.latest,
      lastError: state.lastError,
      cardOwners: {
        board: getCard('board') && getCard('board').dataset.smartCardsOwner,
        maintenance: getCard('maintenance') && getCard('maintenance').dataset.smartCardsOwner,
        annual: getCard('annual') && getCard('annual').dataset.smartCardsOwner
      }
    };
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  window.addEventListener('zummee:community-changed', function(){ setTimeout(reloadForCommunity, 80); });
  window.addEventListener('pageshow', function(){ if(state.latest) render(state.latest); else setTimeout(boot, 80); });
  window.addEventListener('focus', function(){ if(state.latest) render(state.latest); });
})();
