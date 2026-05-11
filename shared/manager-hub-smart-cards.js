/*
  Zummee Manager Hub Smart Cards v705
  Long-term stability controller + corrected canonical logic.

  Rule: this is the only script allowed to write the three Manager Hub smart cards:
  - #mh2AlertBoard
  - #mh2AlertActivity
  - #mh2AlertApprovals

  v702 correction:
  - Board Review uses active notification_events only: metadata.status/workflow_status/board_status must be open.
    Legacy notification rows with no explicit open status are treated as history/archive.
  - Annual approvals only count active approval requests and only mark overdue when a real due/deadline field exists.
  - Maintenance excludes terminal statuses only and does not convert created_at into an overdue signal.
*/
(function(){
  'use strict';
  if(window.__ZummeeManagerHubSmartCardsV705Loaded) return;
  window.__ZummeeManagerHubSmartCardsV705Loaded = true;

  var BUILD = '2026-05-11-v705-manager-hub-annual-workflow-dedupe';
  var SUPABASE_URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_DqOtjzILWph7-bFjKIFN0w_kSpPI864';
  var TIMEOUT_MS = 7000;
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var state = {
    seq: 0,
    inFlight: null,
    latest: null,
    lastGoodByCommunity: {},
    loadedCommunityId: '',
    renderedAt: 0
  };

  function $(id){ return document.getElementById(id); }
  function s(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return s(v).toLowerCase().trim().replace(/[\s-]+/g,'_'); }
  function isUuid(v){ return UUID_RE.test(s(v)); }
  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

  function setReady(isReady){
    try{
      if(isReady){
        document.documentElement.setAttribute('data-zummee-smart-cards-v705-ready','1');
        document.documentElement.setAttribute('data-zummee-smart-cards-v704-ready','1');
        document.documentElement.setAttribute('data-zummee-smart-cards-v702-ready','1');
        document.documentElement.setAttribute('data-zummee-smart-cards-v701-ready','1');
        document.documentElement.setAttribute('data-zummee-smart-alerts-v426-ready','1');
      }else{
        document.documentElement.removeAttribute('data-zummee-smart-cards-v705-ready');
        document.documentElement.removeAttribute('data-zummee-smart-cards-v704-ready');
        document.documentElement.removeAttribute('data-zummee-smart-cards-v702-ready');
        document.documentElement.removeAttribute('data-zummee-smart-cards-v701-ready');
        document.documentElement.removeAttribute('data-zummee-smart-alerts-v426-ready');
      }
    }catch(_e){}
  }

  function activeCommunity(){
    try{
      if(window.ZummeeCommunityState && typeof window.ZummeeCommunityState.getActiveCommunity === 'function'){
        var active = window.ZummeeCommunityState.getActiveCommunity();
        if(active && isUuid(active.id)) return { id:s(active.id), name:s(active.name), source:'ZummeeCommunityState' };
      }
    }catch(_e){}

    try{
      var sel = $('zummeeCommunitySelect') || $('communitySelect') || document.querySelector('select[data-community-select], select[name="community"]');
      if(sel && isUuid(sel.value)){
        var opt = sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
        return { id:s(sel.value), name:s(opt && opt.textContent), source:'dropdown' };
      }
    }catch(_e2){}

    try{
      var raw = localStorage.getItem('zummee_active_community_v601') || sessionStorage.getItem('zummee_active_community_v601') || '';
      var obj = raw ? JSON.parse(raw) : null;
      if(obj && isUuid(obj.id)) return { id:s(obj.id), name:s(obj.name), source:'storage-v601' };
    }catch(_e3){}

    try{
      var id = localStorage.getItem('zummee_active_community_id') || localStorage.getItem('zummee_selected_community_id') || localStorage.getItem('zummeeActiveCommunityId') || localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || '';
      var name = localStorage.getItem('zummee_active_community_name') || localStorage.getItem('zummeeCurrentCommunityName') || localStorage.getItem('currentCommunityName') || '';
      if(isUuid(id)) return { id:s(id), name:s(name), source:'legacy-storage' };
    }catch(_e4){}

    return { id:'', name:'', source:'none' };
  }

  async function ensureSupabaseSdk(){
    if(window.supabase && typeof window.supabase.createClient === 'function') return true;
    var existing = document.querySelector('script[src*="supabase-js"]');
    if(existing){
      for(var i=0;i<50;i++){
        if(window.supabase && typeof window.supabase.createClient === 'function') return true;
        await sleep(100);
      }
    }
    return false;
  }

  function findClient(){
    var names = ['supabaseClient','sb','supabaseClientV2','ZUMMEE_SUPABASE','__zummeeSupabase','zummeeSupabase','__sb'];
    for(var i=0;i<names.length;i++){
      try{
        var c = window[names[i]];
        if(c && typeof c.from === 'function') return { client:c, source:'window.' + names[i] };
      }catch(_e){}
    }
    var fns = ['getSupabase','ensureSupabaseSync','requireSb'];
    for(var j=0;j<fns.length;j++){
      try{
        var fn = window[fns[j]];
        if(typeof fn === 'function'){
          var out = fn();
          if(out && typeof out.then === 'function') continue;
          if(out && typeof out.from === 'function') return { client:out, source:fns[j] + '()' };
        }
      }catch(_e2){}
    }
    return { client:null, source:'' };
  }

  async function resolveClient(){
    var existing = findClient();
    if(existing.client) return existing;
    await ensureSupabaseSdk();
    try{
      if(window.supabase && typeof window.supabase.createClient === 'function'){
        if(!window.__ZummeeManagerSmartCardsSbV702){
          window.__ZummeeManagerSmartCardsSbV702 = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        }
        if(window.__ZummeeManagerSmartCardsSbV702 && typeof window.__ZummeeManagerSmartCardsSbV702.from === 'function'){
          return { client:window.__ZummeeManagerSmartCardsSbV702, source:'v702-created-client' };
        }
      }
    }catch(err){
      return { client:null, source:'createClient failed: ' + (err && err.message ? err.message : String(err)) };
    }
    return { client:null, source:'no-client' };
  }

  function metadata(row){
    var raw = row && row.metadata;
    if(!raw) return {};
    if(typeof raw === 'object') return raw;
    try{ return JSON.parse(raw); }catch(_e){ return {}; }
  }

  function statusOf(row){
    var m = metadata(row);
    return lower(row && (row.status || row.approval_status || row.state || row.workflow_status || row.board_status || row.item_status || m.status || m.approval_status || m.state || m.workflow_status || m.board_status));
  }

  function closedStatus(row){
    var st = statusOf(row);
    if(row && (row.archived_at || row.completed_at || row.deleted_at || row.closed_at)) return true;
    return ['completed','complete','closed','archived','approved','rejected','done','mailed','cancelled','canceled','inactive','resolved','void','deleted','converted','work_order_created'].indexOf(st) !== -1;
  }

  // Board has a stricter status rule than generic rows. The Board Hub shared data layer treats
  // missing metadata.status as legacy/history, not active work.
  function boardStatus(row){
    var m = metadata(row);
    return lower(m.status || m.workflow_status || m.board_status || (row && row.status) || '');
  }
  function isActiveBoardReviewItem(row){
    if(!row) return false;
    if(row.deleted_at || row.archived_at || row.completed_at || row.closed_at) return false;
    return boardStatus(row) === 'open';
  }

  function realDueDate(row){
    // Do not use created_at/submitted_at/updated_at as overdue signals. Those caused false red cards.
    return s(row && (row.due_date || row.deadline || row.review_due_at || row.approval_due_at || row.action_due_at || row.response_due_at)).slice(0,10);
  }
  function hasRealOverdue(row){
    var raw = realDueDate(row);
    if(!raw) return false;
    var dt = new Date(raw + 'T00:00:00');
    if(Number.isNaN(dt.getTime())) return false;
    var today = new Date(); today.setHours(0,0,0,0);
    return dt.getTime() < today.getTime();
  }

  function annualStep(row){
    return lower(row && (row.current_step || row.approval_status || row.status || statusOf(row)));
  }

  // v704: Annual smart card must match Board Member Hub packet-approval queue.
  // Do NOT count setup records, archived history, mailed records, blank legacy rows,
  // or rejected/completed rows. Only active workflow steps count.
  function isAnnualActive(row){
    if(!row) return false;
    if(row.archived_at || row.deleted_at || row.completed_at || row.mailed_at || row.sent_for_mailing_at) return false;
    var st = annualStep(row);
    return ['pending_board','pending_supervisor','pending_admin_mailing','ready_to_mail','board_approved','supervisor_approved'].indexOf(st) !== -1;
  }

  function isOpenMaintenance(row){
    if(!row) return false;
    if(row.archived_at || row.deleted_at || row.completed_at || row.closed_at) return false;
    var st = statusOf(row);
    return ['draft','void','deleted','cancelled','canceled','rejected','completed','complete','closed','archived','resolved','inactive'].indexOf(st) === -1;
  }

  function normalizeCommunityName(v){
    return lower(v).replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  }

  function rowMatchesCommunity(row, community){
    if(!row || !community) return false;
    var activeId = s(community.id);
    var rowId = s(row.community_id || row.communityId || row.property_id || row.association_id);
    if(activeId && rowId && rowId === activeId) return true;
    var targetName = normalizeCommunityName(community.name);
    var rowName = normalizeCommunityName(row.community_name || row.community || row.property_name || row.association_name || row.name);
    return !!(targetName && rowName && targetName === rowName);
  }

  function withTimeout(promise, label){
    return new Promise(function(resolve){
      var done = false;
      var timer = setTimeout(function(){
        if(done) return;
        done = true;
        resolve({ ok:false, label:label, timeout:true, error:'Timed out after ' + TIMEOUT_MS + 'ms', count:null, rows:[], totalRows:0 });
      }, TIMEOUT_MS);
      Promise.resolve(promise).then(function(value){
        if(done) return;
        done = true; clearTimeout(timer); resolve(value);
      }).catch(function(err){
        if(done) return;
        done = true; clearTimeout(timer);
        resolve({ ok:false, label:label, error:err && err.message ? err.message : String(err), count:null, rows:[], totalRows:0 });
      });
    });
  }

  async function loadBoard(client, clientSource, community){
    if(!client || !isUuid(community.id)) return { ok:false, label:'board', source:'none', clientSource:clientSource, count:null, error:'Missing client or community' };
    var res = await client.from('notification_events')
      .select('*')
      .eq('community_id', community.id)
      .eq('event_type','board_item_submitted')
      .order('created_at', { ascending:false })
      .limit(500);
    if(res && res.error) return { ok:false, label:'board', source:'notification_events.board_item_submitted', clientSource:clientSource, count:null, error:res.error.message || JSON.stringify(res.error) };
    var raw = Array.isArray(res && res.data) ? res.data : [];
    var rows = raw.filter(isActiveBoardReviewItem);
    return { ok:true, label:'board', source:'notification_events.board_item_submitted.metadata.status=open', clientSource:clientSource, count:rows.length, overdue:rows.filter(hasRealOverdue).length, rows:rows, totalRows:raw.length };
  }

  async function loadMaintenance(client, clientSource, community){
    if(!client || !isUuid(community.id)) return { ok:false, label:'maintenance', source:'none', clientSource:clientSource, count:null, error:'Missing client or community' };
    var res = await client.from('resident_work_orders')
      .select('*')
      .eq('community_id', community.id)
      .limit(500);
    if(res && res.error) return { ok:false, label:'maintenance', source:'resident_work_orders', clientSource:clientSource, count:null, error:res.error.message || JSON.stringify(res.error) };
    var raw = Array.isArray(res && res.data) ? res.data : [];
    var rows = raw.filter(isOpenMaintenance);
    var urgent = rows.filter(function(row){ return /urgent|emergency|high/i.test(s(row.priority || row.severity || row.level)); }).length;
    return { ok:true, label:'maintenance', source:'resident_work_orders.non_terminal_statuses', clientSource:clientSource, count:rows.length, urgent:urgent, rows:rows, totalRows:raw.length };
  }

  function annualStepCounts(rows){
    var out = { board:0, supervisor:0, admin:0, other:0 };
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var st = annualStep(row);
      if(st === 'pending_board') out.board++;
      else if(st === 'pending_supervisor') out.supervisor++;
      else if(st === 'pending_admin_mailing' || st === 'ready_to_mail') out.admin++;
      else out.other++;
    });
    return out;
  }

  function annualWorkflowKey(row){
    if(!row) return '';
    // v705: Manager Hub annual card counts workflows/packets, not approval-step rows.
    // The Board Member Hub groups packet approvals by annual_meeting_settings_id. Rows with
    // no workflow/settings/packet id are legacy or orphaned rows and should not drive the hub card.
    var candidates = [
      row.annual_meeting_settings_id,
      row.packet_id,
      row.workflow_id,
      row.request_id,
      row.annual_meeting_id,
      row.packet_request_id
    ];
    for(var i=0;i<candidates.length;i++){
      var val = s(candidates[i]);
      if(isUuid(val)) return val;
    }
    return '';
  }

  function annualStageRank(step){
    step = lower(step);
    if(step === 'pending_board') return 1;
    if(step === 'pending_supervisor' || step === 'board_approved') return 2;
    if(step === 'pending_admin_mailing' || step === 'ready_to_mail' || step === 'supervisor_approved') return 3;
    return 9;
  }

  function annualWorkflowStage(rows){
    var best = '';
    var bestRank = 99;
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var step = annualStep(row);
      var rank = annualStageRank(step);
      if(rank < bestRank){ bestRank = rank; best = step; }
    });
    return best || 'active';
  }

  function collapseAnnualRowsToWorkflows(rows){
    var groups = {};
    (Array.isArray(rows) ? rows : []).forEach(function(row){
      var key = annualWorkflowKey(row);
      if(!key) return;
      if(!groups[key]) groups[key] = [];
      groups[key].push(row);
    });

    return Object.keys(groups).map(function(key){
      var groupRows = groups[key] || [];
      var newest = groupRows.slice().sort(function(a,b){
        var at = Date.parse(s(a && (a.updated_at || a.created_at)) || '1970-01-01');
        var bt = Date.parse(s(b && (b.updated_at || b.created_at)) || '1970-01-01');
        return bt - at;
      })[0] || {};
      var stage = annualWorkflowStage(groupRows);
      return {
        workflow_key:key,
        annual_meeting_settings_id:s(newest.annual_meeting_settings_id || key),
        community_id:s(newest.community_id),
        association_legal_name:s(newest.association_legal_name),
        current_step:stage,
        status:stage,
        row_count:groupRows.length,
        latest_row_id:s(newest.id),
        updated_at:newest.updated_at || newest.created_at || null,
        rows:groupRows
      };
    });
  }

  function annualWorkflowStepCounts(workflows){
    var out = { board:0, supervisor:0, admin:0, other:0 };
    (Array.isArray(workflows) ? workflows : []).forEach(function(w){
      var st = lower(w && (w.current_step || w.status));
      var rank = annualStageRank(st);
      if(rank === 1) out.board++;
      else if(rank === 2) out.supervisor++;
      else if(rank === 3) out.admin++;
      else out.other++;
    });
    return out;
  }

  async function loadAnnual(client, clientSource, community){
    if(!client || !isUuid(community.id)) return { ok:false, label:'annual', source:'none', clientSource:clientSource, count:null, error:'Missing client or community' };

    // v705 source of truth: annual_meeting_approval_requests, collapsed to one active
    // workflow per annual_meeting_settings_id/packet id. This matches the Board Member Hub
    // packet queue and prevents one packet with multiple step rows from showing as 6 approvals.
    var res = await client.from('annual_meeting_approval_requests')
      .select('*')
      .eq('community_id', community.id)
      .is('archived_at', null)
      .neq('current_step', 'completed')
      .neq('approval_status', 'completed')
      .order('updated_at', { ascending:false })
      .limit(500);

    if(res && res.error){
      return { ok:false, label:'annual', source:'annual_meeting_approval_requests.workflow_dedupe', clientSource:clientSource, count:null, error:res.error.message || JSON.stringify(res.error), rows:[], totalRows:0 };
    }

    var raw = Array.isArray(res && res.data) ? res.data : [];
    var activeRows = raw.filter(isAnnualActive).filter(function(row){ return !!annualWorkflowKey(row); });
    var workflows = collapseAnnualRowsToWorkflows(activeRows);
    var steps = annualWorkflowStepCounts(workflows);

    return {
      ok:true,
      label:'annual',
      source:'annual_meeting_approval_requests.workflow_dedupe',
      clientSource:clientSource,
      count:workflows.length,
      overdue:0,
      rows:workflows,
      rawRows:activeRows,
      totalRows:raw.length,
      activeStepRows:activeRows.length,
      ignoredRows:raw.length - activeRows.length,
      stepCounts:steps
    };
  }

  function emptySummary(community, resolved){
    return {
      build:BUILD,
      community:community,
      clientReady:!!(resolved && resolved.client),
      clientSource:resolved && resolved.source || '',
      board:0,
      boardOverdue:0,
      maintenance:0,
      maintenanceUrgent:0,
      annual:0,
      annualOverdue:0,
      sources:{},
      loadedAt:Date.now()
    };
  }

  function getLastGood(communityId){
    if(!state.lastGoodByCommunity[communityId]){
      state.lastGoodByCommunity[communityId] = { board:0, boardOverdue:0, maintenance:0, maintenanceUrgent:0, annual:0, annualOverdue:0 };
    }
    return state.lastGoodByCommunity[communityId];
  }

  function countOrLast(key, result, last){
    if(result && result.ok && Number.isFinite(Number(result.count))){
      last[key] = Number(result.count);
      return Number(result.count);
    }
    return Number(last[key] || 0);
  }

  function metricOrLast(key, prop, result, last){
    if(result && result.ok && Number.isFinite(Number(result[prop]))){
      last[key] = Number(result[prop]);
      return Number(result[prop]);
    }
    return Number(last[key] || 0);
  }

  async function loadSummary(expectedCommunityId){
    var community = activeCommunity();
    var resolved = await resolveClient();
    var client = resolved.client;
    var clientSource = resolved.source;
    if(expectedCommunityId && community.id !== expectedCommunityId){
      return { stale:true, community:community };
    }

    var results = await Promise.all([
      withTimeout(loadBoard(client, clientSource, community), 'board'),
      withTimeout(loadMaintenance(client, clientSource, community), 'maintenance'),
      withTimeout(loadAnnual(client, clientSource, community), 'annual')
    ]);

    if(expectedCommunityId && activeCommunity().id !== expectedCommunityId){
      return { stale:true, community:activeCommunity() };
    }

    var board = results[0] || {};
    var maintenance = results[1] || {};
    var annual = results[2] || {};
    var last = getLastGood(community.id || 'none');
    var summary = emptySummary(community, resolved);
    summary.board = countOrLast('board', board, last);
    summary.boardOverdue = metricOrLast('boardOverdue', 'overdue', board, last);
    summary.maintenance = countOrLast('maintenance', maintenance, last);
    summary.maintenanceUrgent = metricOrLast('maintenanceUrgent', 'urgent', maintenance, last);
    summary.annual = countOrLast('annual', annual, last);
    summary.annualOverdue = metricOrLast('annualOverdue', 'overdue', annual, last);
    summary.sources = { board:board, maintenance:maintenance, annual:annual };
    return summary;
  }

  function setCard(id, opts){
    var card = $(id);
    if(!card) return;
    opts = opts || {};
    var tone = opts.tone || 'good';

    card.dataset.smartCardOwner = 'v705';
    card.dataset.smartAlertsV633 = 'false';
    card.style.display = '';
    card.style.visibility = 'visible';
    card.style.opacity = '1';

    card.classList.remove('is-good','is-attention','is-urgent');
    card.classList.add(tone === 'urgent' ? 'is-urgent' : (tone === 'attention' ? 'is-attention' : 'is-good'));
    if(opts.href) card.setAttribute('href', opts.href);

    var title = card.querySelector('.mh2-alert-title');
    var badge = card.querySelector('.mh2-alert-badge');
    var copy = card.querySelector('.mh2-alert-copy');
    if(title) title.textContent = opts.title || '';
    if(badge) badge.textContent = opts.badge || '';
    if(copy) copy.textContent = opts.copy || '';
  }

  function annualHref(){
    return 'board_member_hub_v2.html#annualApprovalRequestsSection';
  }

  function render(summary){
    if(!summary || summary.stale) return false;

    var boardCount = Number(summary.board || 0);
    var boardOverdue = Number(summary.boardOverdue || 0);
    setCard('mh2AlertBoard', {
      tone: boardOverdue > 0 ? 'urgent' : (boardCount > 0 ? 'attention' : 'good'),
      title:'Board review status',
      badge: boardOverdue > 0 ? (boardOverdue + ' overdue') : (boardCount > 0 ? (boardCount + ' open') : 'Clear'),
      copy: boardCount > 0 ? (boardCount + ' board-submitted item' + (boardCount === 1 ? '' : 's') + ' awaiting review.') : 'No board items need review right now.',
      href:'board_member_hub_v2.html'
    });

    var maintCount = Number(summary.maintenance || 0);
    var maintUrgent = Number(summary.maintenanceUrgent || 0);
    setCard('mh2AlertActivity', {
      tone: maintUrgent > 0 ? 'urgent' : (maintCount > 0 ? 'attention' : 'good'),
      title:'Maintenance activity',
      badge: maintUrgent > 0 ? (maintUrgent + ' urgent') : (maintCount > 0 ? (maintCount + ' open') : 'Quiet'),
      copy: maintCount > 0 ? (maintCount + ' open maintenance item' + (maintCount === 1 ? '' : 's') + ' for this community.') : 'No open maintenance activity for this community.',
      href:'maintenance_updates.html'
    });

    var annualCount = Number(summary.annual || 0);
    var annualOverdue = Number(summary.annualOverdue || 0);
    setCard('mh2AlertApprovals', {
      tone: annualOverdue > 0 ? 'urgent' : (annualCount > 0 ? 'attention' : 'good'),
      title:'Annual meeting approvals',
      badge: annualOverdue > 0 ? (annualOverdue + ' overdue') : (annualCount > 0 ? (annualCount + ' pending') : 'Clear'),
      copy: annualCount > 0 ? (annualCount + ' annual meeting packet approval' + (annualCount === 1 ? '' : 's') + ' active for this community.') : 'No annual meeting packet approvals need attention right now.',
      href:annualHref()
    });

    state.latest = summary;
    state.loadedCommunityId = summary.community && summary.community.id || '';
    state.renderedAt = Date.now();
    window.__ManagerHubSmartCardsSummaryV705 = summary;
    window.__ManagerHubSmartCardsSummaryV702 = summary;
    // Compatibility for older console checks.
    window.__ManagerHubSmartCardsSummaryV701 = summary;
    setReady(true);
    try{ console.info('[Manager Hub v705] smart cards rendered', summary); }catch(_e){}
    return true;
  }

  async function refresh(options){
    options = options || {};
    var community = activeCommunity();
    var communityId = community.id || '';
    var seq = ++state.seq;

    if(options.resetReady) setReady(false);

    state.inFlight = (async function(){
      var summary = await loadSummary(communityId);
      if(seq !== state.seq) return state.latest;
      if(summary && summary.stale) return state.latest;
      if(communityId && summary && summary.community && summary.community.id !== communityId) return state.latest;
      render(summary);
      return summary;
    })().catch(function(err){
      try{ console.warn('[Manager Hub v702] smart-card refresh failed', err); }catch(_e){}
      if(state.latest){ render(state.latest); return state.latest; }
      var fallback = emptySummary(community, { client:null, source:'fatal' });
      fallback.sources = { fatal:err && err.message ? err.message : String(err) };
      render(fallback);
      return fallback;
    }).finally(function(){
      state.inFlight = null;
    });

    return state.inFlight;
  }

  function boot(){
    if(window.__ZummeeManagerHubSmartCardsV705Booted) return;
    window.__ZummeeManagerHubSmartCardsV705Booted = true;
    setReady(false);
    setTimeout(function(){ refresh({ resetReady:false }); }, 80);
  }

  function communityChanged(){
    window.__ZummeeManagerHubSmartCardsV705Booted = false;
    state.seq++;
    state.latest = null;
    setReady(false);
    setTimeout(function(){ boot(); }, 120);
  }

  window.refreshManagerHubCanonicalSmartAlerts = refresh;
  window.refreshManagerHubSmartCardsAuthoritative = refresh;
  window.loadSmartAlerts = refresh;
  window.refreshSmartAlerts = refresh;
  window.refreshAnnualAlert = refresh;
  window.getManagerHubSmartCardsSummary = function(){ return window.__ManagerHubSmartCardsSummaryV702 || state.latest || null; };
  window.getManagerHubSmartCardsDeploymentStatus = function(){
    return {
      build: BUILD,
      singleOwner: true,
      loaded: !!window.__ZummeeManagerHubSmartCardsV705Loaded,
      booted: !!window.__ZummeeManagerHubSmartCardsV705Booted,
      ready: document.documentElement.getAttribute('data-zummee-smart-cards-v705-ready') === '1',
      cardOwners: {
        board: $('mh2AlertBoard') && $('mh2AlertBoard').dataset.smartCardOwner || '',
        maintenance: $('mh2AlertActivity') && $('mh2AlertActivity').dataset.smartCardOwner || '',
        annual: $('mh2AlertApprovals') && $('mh2AlertApprovals').dataset.smartCardOwner || ''
      },
      summary: window.getManagerHubSmartCardsSummary()
    };
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

  window.addEventListener('pageshow', function(){
    if(state.latest) render(state.latest);
    else setTimeout(boot, 80);
  });
  window.addEventListener('focus', function(){
    if(!state.latest) setTimeout(function(){ refresh({ resetReady:false }); }, 120);
  });
  window.addEventListener('zummee:community-changed', communityChanged);
  document.addEventListener('community:changed', communityChanged);
})();
