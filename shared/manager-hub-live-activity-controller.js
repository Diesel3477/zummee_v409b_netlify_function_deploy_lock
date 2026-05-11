
(function(){
  'use strict';
  var BUILD = '2026-05-11-v748-live-activity-single-controller';
  var state = {
    build: BUILD,
    mode: 'supabase-only-live-activity-controller',
    loading: false,
    loadedAt: null,
    community_id: '',
    community_name: '',
    count: 0,
    sources: [],
    rawSources: {},
    errors: [],
    lastItems: []
  };
  window.__mh2LiveActivityControllerState = state;

  function $(id){ return document.getElementById(id); }
  function compact(v){ return String(v == null ? '' : v).replace(/\s+/g,' ').trim(); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }
  function setText(id, value){ var el=$(id); if(el) el.textContent = String(value == null ? '' : value); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||'')); }
  function parse(raw){ try{return raw?JSON.parse(raw):null;}catch(_e){return null;} }
  function getSb(){
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient; }catch(_e){}
    try{ if(window.sb && typeof window.sb.from === 'function') return window.sb; }catch(_e){}
    try{ if(window.getSupabase && typeof window.getSupabase === 'function'){ var c=window.getSupabase(); if(c && typeof c.from === 'function') return c; } }catch(_e){}
    try{ if(window.supabase && typeof window.supabase.from === 'function') return window.supabase; }catch(_e){}
    return null;
  }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  async function requireSb(){
    var sb = getSb();
    var started = Date.now();
    while(!sb && Date.now() - started < 6000){ await wait(80); sb = getSb(); }
    if(!sb) throw new Error('Supabase client unavailable');
    return sb;
  }
  function currentCommunity(){
    var id = compact(window.currentCommunityId || window.activeCommunityId || window.selectedCommunityId || window.zummeeSelectedCommunityId);
    var name = compact(window.currentCommunityName || window.zummeeCurrentCommunityName);
    var obj = parse(localStorage.getItem('zummee_active_community_v601') || sessionStorage.getItem('zummee_active_community_v601') || '');
    if(obj && isUuid(obj.id)){ id = id || compact(obj.id); name = name || compact(obj.name); }
    var keys = ['zummee_active_community_id','zummee_selected_community_id','zummeeActiveCommunityId','activeCommunityId','currentCommunityId'];
    for(var i=0;i<keys.length && !id;i++){ try{ id = compact(localStorage.getItem(keys[i]) || sessionStorage.getItem(keys[i])); }catch(_e){} }
    var nameKeys = ['zummee_active_community_name','zummeeCurrentCommunityName','currentCommunityName','activeCommunityName'];
    for(var j=0;j<nameKeys.length && !name;j++){ try{ name = compact(localStorage.getItem(nameKeys[j]) || sessionStorage.getItem(nameKeys[j])); }catch(_e){} }
    var sel = $('zummeeCommunitySelect');
    if(sel && sel.selectedIndex >= 0){
      var opt = sel.options[sel.selectedIndex];
      id = isUuid(sel.value) ? sel.value : (id || compact(opt && opt.getAttribute('data-community-id')));
      name = name || compact(opt && opt.textContent);
    }
    return { id:id, name:name || 'selected community' };
  }
  function timeOf(row){ return compact(row && (row.updated_at || row.created_at || row.submitted_at || row.sent_at || row.completed_at || row.approved_at || row.event_date || row.date)) || new Date().toISOString(); }
  function statusOf(row){ return compact(row && (row.status || row.workflow_status || row.approval_status || row.current_status || row.state || row.type)).toLowerCase(); }
  function isClosed(st){ return /^(closed|archived|complete|completed|deleted|cancelled|canceled|mailed|done)$/i.test(compact(st)); }
  function short(v){ v = compact(v || 'Activity update'); return v.length > 96 ? v.slice(0,93)+'…' : v; }
  function priorityFrom(text, fallback){
    text = compact(text).toLowerCase();
    if(/urgent|emergency|overdue|failed|rejected|late/.test(text)) return 'urgent';
    if(/active|completed|complete|approved|resolved|sent to vendor|in progress|ready/.test(text)) return 'active';
    if(/submitted|pending|review|approval|waiting|needs|new/.test(text)) return 'attention';
    return fallback || 'neutral';
  }
  function hrefFor(type, row){
    type = compact(type).toLowerCase();
    if(row && row.link_url) return row.link_url;
    if(/work|maintenance|vendor/.test(type)) return 'resident_work_orders.html';
    if(/board/.test(type)) return 'board_member_hub_v2.html';
    if(/annual/.test(type)) return 'annual_meetings.html';
    if(/supervisor/.test(type)) return 'supervisor_communications.html';
    return null;
  }
  function makeEvent(ev){
    if(!ev) return null;
    ev.source = compact(ev.source || 'activity');
    ev.id = compact(ev.id || (ev.source + ':' + ev.title + ':' + ev.time));
    ev.title = short(ev.title);
    ev.copy = short(ev.copy || state.community_name || 'Selected community');
    ev.time = timeOf(ev);
    ev.priority = ev.priority || priorityFrom(ev.title + ' ' + ev.copy, 'neutral');
    return ev.id && ev.title ? ev : null;
  }
  function normalizeNotification(rows){
    return (rows||[]).map(function(r){
      var type = compact(r.event_type || r.type || r.source_table).replace(/_/g,' ');
      var title = compact(r.title || r.message) || (type ? ('New ' + type + ' update') : 'Activity update');
      return makeEvent({id:'notification:'+compact(r.id), source:'notification_events', time:timeOf(r), title:title, copy:type || 'Live update', priority:priorityFrom((r.priority||'')+' '+title, 'attention'), href:hrefFor(type,r), community_id:r.community_id});
    }).filter(Boolean);
  }
  function normalizeWorkOrders(rows){
    return (rows||[]).map(function(r){
      var st = statusOf(r) || 'open';
      var titleBase = compact(r.subject || r.title || r.category || r.issue_type || r.description) || 'Work order update';
      var who = compact(r.resident_name || r.owner_name || r.submitted_by);
      var vendor = compact(r.vendor_name || r.assigned_vendor_name);
      return makeEvent({id:'work_order:'+compact(r.id), source:'resident_work_orders', time:timeOf(r), title:'Work order: '+titleBase, copy:[who, vendor ? 'Vendor: '+vendor : '', st.replace(/_/g,' ')].filter(Boolean).join(' • ') || 'Maintenance activity', priority:priorityFrom((r.priority||'')+' '+st+' '+titleBase, 'attention'), href:'resident_work_orders.html', community_id:r.community_id});
    }).filter(Boolean);
  }
  function normalizeAnnual(rows){
    return (rows||[]).filter(function(r){ var st=statusOf(r); return !isClosed(st) && !(r.archived_at || r.completed_at || r.mailed_at || r.deleted_at); }).map(function(r){
      var st = compact(r.workflow_status || r.approval_status || r.status || r.current_step) || 'pending';
      var assoc = compact(r.association_legal_name || r.community_name || r.annual_meeting_name);
      return makeEvent({id:'annual:'+compact(r.annual_meeting_settings_id || r.packet_id || r.request_id || r.id), source:'annual_meeting_approval_requests', time:timeOf(r), title:'Annual meeting update', copy:(assoc ? assoc + ' • ' : '') + st.replace(/_/g,' '), priority:priorityFrom(st, 'attention'), href:'annual_meetings.html', community_id:r.community_id});
    }).filter(Boolean);
  }
  function normalizeSupervisor(rows){
    return (rows||[]).map(function(r){
      var title = compact(r.title || r.subject || r.message || r.directive) || 'Supervisor communication';
      var st = compact(r.status || r.priority || r.type);
      return makeEvent({id:'supervisor:'+compact(r.id), source:'supervisor_communications', time:timeOf(r), title:title, copy:st ? 'Supervisor communication • '+st.replace(/_/g,' ') : 'Supervisor communication', priority:priorityFrom(st+' '+title, 'attention'), href:'supervisor_communications.html', community_id:r.community_id});
    }).filter(Boolean);
  }
  function normalizeBoard(rows){
    return (rows||[]).map(function(r){
      var title = compact(r.title || r.subject || r.message) || 'A new board item was submitted and needs review.';
      return makeEvent({id:'board:'+compact(r.id), source:'board_data_layer', time:timeOf(r), title:title, copy:'Board item submitted for review', priority:'attention', href:'board_member_hub_v2.html', community_id:r.community_id});
    }).filter(Boolean);
  }
  async function queryTable(sb, table, limit, normalizer){
    var variants = [];
    function build(order, filter){
      return function(){ var q = sb.from(table).select('*'); if(filter && state.community_id) q = q.eq('community_id', state.community_id); if(order) q = q.order(order,{ascending:false}); return q.limit(limit || 24); };
    }
    variants.push(build('updated_at', true), build('created_at', true), build(null, true), build('updated_at', false), build('created_at', false), build(null, false));
    var lastErr = null;
    for(var i=0;i<variants.length;i++){
      try{
        var res = await Promise.race([variants[i](), new Promise(function(resolve){ setTimeout(function(){ resolve({data:[], error:{message:'timeout'}}); }, 6500); })]);
        if(res && res.error){ lastErr = res.error; continue; }
        var rows = Array.isArray(res && res.data) ? res.data : [];
        state.rawSources[table] = rows.length;
        return normalizer(rows);
      }catch(e){ lastErr = e; }
    }
    state.rawSources[table] = 0;
    state.errors.push({source:table, message:String(lastErr && (lastErr.message || lastErr.details || lastErr.code) || lastErr || 'unknown')});
    return [];
  }
  function uniqueLatest(items){
    var seen = Object.create(null);
    return (items||[]).filter(function(e){
      if(!e) return false;
      if(state.community_id && e.community_id && String(e.community_id) !== String(state.community_id)) return false;
      var key = compact(e.id || e.title+':'+e.time);
      if(!key || seen[key]) return false;
      seen[key] = true;
      return true;
    }).sort(function(a,b){
      var at = new Date(a.time).getTime() || 0;
      var bt = new Date(b.time).getTime() || 0;
      return bt - at;
    }).slice(0,8);
  }
  function fmtAgo(raw){
    var t = new Date(raw).getTime();
    if(!t) return 'Now';
    var diff = Math.max(0, Date.now() - t);
    var min = Math.floor(diff/60000);
    if(min < 1) return 'Now';
    if(min < 60) return min + 'm';
    var hrs = Math.floor(min/60);
    if(hrs < 24) return hrs + 'h';
    var days = Math.floor(hrs/24);
    return days + 'd';
  }
  function render(items){
    var list = $('activityFeedList');
    if(!list) return;
    items = uniqueLatest(items);
    state.count = items.length;
    state.lastItems = items.slice();
    state.sources = Array.from(new Set(items.map(function(e){ return e.source; }).filter(Boolean)));
    state.loadedAt = new Date().toISOString();
    try{ window.__mh2LiveEvents = items.slice(); }catch(_e){}
    setText('mh2LiveActivityCount', String(items.length));
    setText('mh2LiveActivityNote', items.length ? ('Showing the latest ' + items.length + ' live updates' + (state.community_name ? ' for ' + state.community_name : '') + '.') : ('Connected, but no recent updates were found' + (state.community_name ? ' for ' + state.community_name : '') + '.'));
    if(!items.length){ list.innerHTML = '<div class="mh2-placeholder">No recent activity for this community.</div>'; return; }
    list.innerHTML = items.map(function(e){
      var priority = compact(e.priority).toLowerCase();
      var ageMs = Math.max(0, Date.now() - (new Date(e.time).getTime() || Date.now()));
      var rowClass = priority === 'urgent' ? 'mh2-feed-item is-urgent' : (priority === 'attention' ? 'mh2-feed-item is-attention' : (priority === 'active' ? 'mh2-feed-item is-active' : 'mh2-feed-item'));
      var dot = priority === 'urgent' ? 'mh2-dot mh2-dot--urgent' : (priority === 'attention' ? 'mh2-dot mh2-dot--gold' : (priority === 'active' ? 'mh2-dot mh2-dot--green' : 'mh2-dot'));
      if(ageMs <= 3600000) dot += ' is-recent';
      var tagClass = ageMs <= 3600000 ? 'mh2-item-tag is-recent' : (ageMs <= 86400000 ? 'mh2-item-tag is-fresh' : 'mh2-item-tag is-stale');
      var inner = '<article class="'+rowClass+'"><div class="'+dot+'"></div><div><div class="mh2-item-title">'+esc(e.title)+'</div><div class="mh2-item-copy">'+esc(e.copy)+'</div></div><div class="'+tagClass+'">'+esc(fmtAgo(e.time))+'</div></article>';
      return e.href ? '<a href="'+esc(e.href)+'" style="text-decoration:none;color:inherit;display:block">'+inner+'</a>' : inner;
    }).join('');
  }
  async function load(){
    if(state.loading) return;
    state.loading = true;
    state.errors = [];
    state.rawSources = {};
    try{
      var ctx = currentCommunity();
      state.community_id = ctx.id;
      state.community_name = ctx.name;
      var sb = await requireSb();
      var promises = [
        queryTable(sb, 'notification_events', 40, normalizeNotification),
        queryTable(sb, 'resident_work_orders', 32, normalizeWorkOrders),
        queryTable(sb, 'annual_meeting_approval_requests', 24, normalizeAnnual),
        queryTable(sb, 'supervisor_communications', 16, normalizeSupervisor)
      ];
      promises.push((async function(){
        try{
          if(window.ZummeeBoardData && typeof window.ZummeeBoardData.getBoardReviewItems === 'function'){
            var result = await Promise.race([window.ZummeeBoardData.getBoardReviewItems(state.community_id), new Promise(function(resolve){ setTimeout(function(){ resolve({rows:[]}); }, 5500); })]);
            var rows = Array.isArray(result && result.rows) ? result.rows : [];
            state.rawSources.board_data_layer = rows.length;
            return normalizeBoard(rows);
          }
        }catch(e){ state.errors.push({source:'board_data_layer', message:String(e && e.message || e)}); }
        state.rawSources.board_data_layer = 0;
        return [];
      })());
      var settled = await Promise.allSettled(promises);
      var all = [];
      settled.forEach(function(r){ if(r.status === 'fulfilled' && Array.isArray(r.value)) all = all.concat(r.value); });
      render(all);
    }catch(e){
      state.errors.push({source:'controller', message:String(e && e.message || e)});
      render([]);
    }finally{
      state.loading = false;
    }
  }
  window.loadManagerHubLiveActivity = load;
  window.getManagerHubLiveActivityStatus = function(){
    return {
      build: BUILD,
      mode: state.mode,
      count: state.count,
      loadedAt: state.loadedAt,
      community_id: state.community_id,
      community_name: state.community_name,
      sources: state.sources,
      rawSources: state.rawSources,
      errors: state.errors,
      cached: state.lastItems.length
    };
  };
  function boot(){ setTimeout(load, 350); setTimeout(load, 1600); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('pageshow', function(){ setTimeout(load, 300); });
  document.addEventListener('community:changed', function(){ setTimeout(load, 250); });
  setInterval(function(){ if(!document.hidden) load(); }, 30000);
})();
