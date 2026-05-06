/* Zummee Manager Hub canonical data layer v500
   Final owner for Smart Alerts + Operations Portal pill.
   Rules: one load per community, one render pass, no zero prewrites, stale requests cannot overwrite, legacy writers are neutralized.
   v499: operations_alerts is the single canonical source for Operations Portal counts; maintenance remains verified against Live Maintenance.
   v500: Board Review no-flash lock. Board card holds last verified state while notification_events loads and legacy board writers are neutralized. */
(function(){
  'use strict';
  var VERSION='v500-board-review-no-flash-lock';
  var currentLoadId=0;
  var lastState=null;
  var bootDomSnapshot=null;
  var observerTimer=null;
  var renderDepth=0;
  var STORE_PREFIX='zummee_mh_stable_state_v500_';

  function storageKey(ctx){ return STORE_PREFIX + (ctx && ctx.id ? String(ctx.id) : 'default'); }
  function readStoredState(ctx){
    try{
      var raw=sessionStorage.getItem(storageKey(ctx)) || localStorage.getItem(storageKey(ctx));
      if(!raw) return null;
      var parsed=JSON.parse(raw);
      if(!parsed || !parsed.ctx || !parsed.ctx.id || (ctx && ctx.id && parsed.ctx.id!==ctx.id)) return null;
      return parsed;
    }catch(_e){ return null; }
  }
  function writeStoredState(state){
    try{
      if(!state || !state.ctx || !state.ctx.id) return;
      var slim={version:VERSION,ctx:state.ctx,board:state.board,maintenance:state.maintenance,annual:state.annual,ops:state.ops,loadedAt:state.loadedAt};
      sessionStorage.setItem(storageKey(state.ctx), JSON.stringify(slim));
      localStorage.setItem(storageKey(state.ctx), JSON.stringify(slim));
    }catch(_e){}
  }

  function $(id){ return document.getElementById(id); }
  function norm(v){ return String(v||'').trim().toLowerCase(); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||'')); }
  function esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function num(v, fallback){ var n=Number(v); return Number.isFinite(n)?n:(fallback||0); }

  function snapshotDom(){
    function text(id){ var el=$(id); return el ? String(el.textContent||'') : ''; }
    function parseCount(t){ var m=String(t||'').match(/(\d+)/); return m?Number(m[1])||0:null; }
    var opsText = text('mh2OperationsPortalPillBadge')+' '+text('mh2OperationsPortalPillTitle');
    var maintText = $('mh2AlertActivity') ? $('mh2AlertActivity').textContent : '';
    return {
      ops:{ count:parseCount(opsText), overdue:/overdue/i.test(opsText)?parseCount(opsText):0, critical:/5\s*-?\s*day/i.test(opsText)?parseCount(opsText):0, source:'boot-dom', ok:false },
      maintenance:{ count:parseCount(maintText), urgent:/urgent/i.test(maintText)?parseCount(maintText):0, rows:[], source:'boot-dom', ok:false }
    };
  }
  bootDomSnapshot = snapshotDom();

  function getCommunity(){
    var qs = new URLSearchParams(location.search);
    var id = qs.get('community_id') || window.activeCommunityId || window.currentCommunityId || localStorage.getItem('zummeeActiveCommunityId') || localStorage.getItem('activeCommunityId') || localStorage.getItem('zummee_selected_community_id') || localStorage.getItem('zummee_selected_community');
    var name = qs.get('community_name') || window.activeCommunityName || window.currentCommunityName || localStorage.getItem('activeCommunityName') || localStorage.getItem('zummeeActiveCommunityName') || localStorage.getItem('zummee_selected_community_name') || '';
    try{
      var sel = document.querySelector('#mh2CommunitySelect,#zummeeCommunitySelect,select[name*="community" i],select[id*="community" i]');
      if(sel && sel.value && isUuid(sel.value)) id = sel.value;
      if(sel && sel.selectedOptions && sel.selectedOptions[0]) name = sel.selectedOptions[0].textContent || name;
    }catch(_e){}
    if(id) id=String(id).trim();
    if(name) name=String(name).trim();
    return {id:id||'',name:name||'the selected community'};
  }

  async function client(){
    try{ if(window.ensureSupabase) return await window.ensureSupabase(); }catch(_e){}
    return window.supabaseClient || window.sb || null;
  }

  function queryFailed(error){ return !!error; }
  async function read(sb, table, columns, communityId){
    try{
      var q = sb.from(table).select(columns||'*').limit(1000);
      if(communityId){ try{ q=q.eq('community_id', communityId); }catch(_e){} }
      var res = await q;
      if(res.error) throw res.error;
      return {ok:true,table:table,rows:Array.isArray(res.data)?res.data:[],method:'native'};
    }catch(e){ return {ok:false,table:table,rows:[],error:e,method:'native'}; }
  }

  function encodeSelect(cols){ return String(cols||'*').split(',').map(function(part){ return part.trim(); }).filter(Boolean).join(','); }
  async function readRest(table, columns, communityId){
    try{
      if(!window.ZummeeAuth || typeof window.ZummeeAuth.fetchRest !== 'function') throw new Error('ZummeeAuth.fetchRest unavailable');
      var path = String(table) + '?select=' + encodeURIComponent(encodeSelect(columns||'*')) + '&limit=1000';
      if(communityId) path += '&community_id=eq.' + encodeURIComponent(communityId);
      var rows = await window.ZummeeAuth.fetchRest(path);
      return {ok:true,table:table,rows:Array.isArray(rows)?rows:[],method:'rest'};
    }catch(e){ return {ok:false,table:table,rows:[],error:e,method:'rest'}; }
  }
  async function readVerified(sb, table, columns, communityId, opts){
    opts = opts || {};
    // Prefer REST because several Zummee tables are RLS-protected and native client can be anonymous on iPad.
    var rest = await readRest(table, columns, communityId);
    if(rest.ok) return rest;
    if(opts.restOnly) return rest;
    var native = await read(sb, table, columns, communityId);
    if(native.ok) return native;
    return rest;
  }
  function rowCommunity(row,ctx){
    var rid=String(row && (row.community_id||row.communityId||row.property_id||row.association_id)||'').trim();
    var rn=norm(row && (row.community_name||row.community||row.property_name||row.association_name||row.property));
    var cn=norm(ctx.name);
    if(rid && ctx.id && rid===ctx.id) return true;
    if(rn && cn && rn===cn) return true;
    var scope=norm(row && row.scope); return scope==='company' || scope==='company_wide';
  }
  function closed(row){
    var st=norm(row && (row.status||row.state||row.workflow_status||row.completion_status));
    if(row && (row.completed_at||row.archived_at||row.deleted_at||row.closed_at||row.resolved_at)) return true;
    if(row && (row.completed===true||row.is_complete===true||row.is_completed===true||row.is_active===false)) return true;
    return /complete|completed|closed|archived|done|resolved|cancel|cancelled|deleted|inactive|reviewed|converted|approved|rejected/.test(st);
  }
  function val(row, keys){ for(var i=0;i<keys.length;i++){ var v=row&&row[keys[i]]; if(v!==undefined&&v!==null&&String(v).trim()!=='') return v; } return ''; }
  function daysUntil(raw){
    if(!raw) return null; var d=new Date(String(raw).slice(0,10)+'T00:00:00'); if(isNaN(d.getTime())) return null;
    var t=new Date(); t.setHours(0,0,0,0); d.setHours(0,0,0,0); return Math.round((d-t)/86400000);
  }
  function keepPrevious(type, fallback, ctx){
    if(lastState && lastState[type] && lastState[type].count!==null && lastState[type].count!==undefined) return Object.assign({},lastState[type],{kept:true});
    var stored=readStoredState(ctx||getCommunity());
    if(stored && stored[type] && stored[type].count!==null && stored[type].count!==undefined) return Object.assign({},stored[type],{kept:true,source:(stored[type].source||'stored')});
    if(bootDomSnapshot && bootDomSnapshot[type] && bootDomSnapshot[type].count!==null) return bootDomSnapshot[type];
    return fallback;
  }

  async function board(ctx,sb){
    var fallback=keepPrevious('board',{count:null,overdue:null,rows:[],ok:false,source:'none'},ctx);
    // v500: Board Review uses one verified source and never writes zero on load/error.
    // This prevents the refresh flash where legacy scripts briefly rendered STABLE/0 before notification_events returned.
    var res=await readVerified(sb,'notification_events','id,title,message,metadata,created_at,event_type,community_id',ctx.id,{restOnly:false});
    if(!res.ok){
      window.__MH_DEBUG_BOARD = { ok:false, source:'notification_events', error:res.error, kept:!!fallback };
      return fallback;
    }
    var rows=res.rows.filter(function(r){
      var md=(r&&r.metadata&&typeof r.metadata==='object')?r.metadata:{};
      var st=norm(md.status || r.status || 'open');
      return String(r.event_type)==='board_item_submitted' && !/reviewed|complete|completed|closed|archived|converted|cancel|cancelled|deleted|rejected|agenda|minutes/.test(st);
    });
    var summary={count:rows.length,overdue:0,rows:rows,ok:true,source:'notification_events',method:res.method,rule:'board_item_submitted-open-only'};
    window.__MH_DEBUG_BOARD = summary;
    return summary;
  }
  async function maintenance(ctx,sb){
    var fallback=keepPrevious('maintenance',{count:null,urgent:null,rows:[],ok:false,source:'none'},ctx);
    // v497 canonical maintenance source: resident_work_orders via stored-token REST.
    // Rule: match Live Maintenance active pipeline, not raw database totals.
    // Current live stream counts submitted/open pipeline records and true active/in-progress records;
    // it does NOT count manager_review-only review queue records or legacy raw sent_to_vendor rows that are not in the live submitted pipeline.
    var res=await readVerified(sb,'resident_work_orders','*',ctx.id,{restOnly:true});
    if(!res.ok){
      window.__MH_DEBUG_MAINTENANCE = { ok:false, source:'resident_work_orders', method:res.method, error:res.error, kept:!!fallback };
      return fallback;
    }
    function liveMaintenanceStatus(r){
      var st=norm(r.status||r.workflow_status||r.state||'');
      if(st==='in_progress') return 'in_progress';
      if(st==='active') return 'active';
      // Live Maintenance currently treats submitted records as the open live queue.
      if(st==='submitted' || st==='new' || st==='open') return 'submitted';
      // Keep these only when the row has progressed into active work, not the manager-review queue.
      if(st==='vendor_in_progress') return 'in_progress';
      if(st==='vendor_active') return 'active';
      return st;
    }
    var rows=res.rows.filter(function(r){
      if(!rowCommunity(r,ctx) || closed(r)) return false;
      var st=liveMaintenanceStatus(r);
      return st==='submitted' || st==='active' || st==='in_progress';
    });
    var summary={count:rows.length,urgent:rows.filter(function(r){return /urgent|high|emergency/.test(norm(r.priority));}).length,rows:rows,ok:true,source:'resident_work_orders',method:res.method, rule:'submitted-active-in_progress-only'};
    window.__MH_DEBUG_MAINTENANCE = summary;
    return summary;
  }
  async function annual(ctx,sb){
    var fallback=keepPrevious('annual',{count:null,overdue:null,rows:[],ok:false,source:'none'},ctx);
    var res=await read(sb,'annual_meeting_packet_requests','*',ctx.id);
    if(!res.ok) return fallback;
    var rows=res.rows.filter(function(r){ return rowCommunity(r,ctx) && !closed(r); });
    var overdue=rows.filter(function(r){ var raw=r.submitted_at||r.created_at||r.updated_at; var d=new Date(raw); return raw && !isNaN(d.getTime()) && ((Date.now()-d.getTime())/86400000)>2; }).length;
    return {count:rows.length,overdue:overdue,rows:rows,ok:true,source:'annual_meeting_packet_requests'};
  }
  async function operations(ctx,sb){
    var fallback=keepPrevious('ops',{count:null,overdue:null,dueSoon:null,critical:null,items:[],ok:false,source:'none'},ctx);
    // v499 canonical Operations source: operations_alerts only.
    // Rule: one table, one open-status filter, one render. No BoardMembers/Inspections/Calendar inference.
    var res = await readRest('operations_alerts','id,community_id,community_name,alert_type,title,notes,due_date,status,severity,completed_at,archived_at,created_at',ctx.id);
    if(!res.ok){
      console.error('[MH DATA LOCK] operations_alerts source blocked', res);
      window.__MH_DEBUG_OPERATIONS = { ok:false, source:'operations_alerts', error:res.error, kept:!!fallback };
      return fallback;
    }

    var rows=(res.rows||[]).filter(function(r){
      if(!rowCommunity(r,ctx)) return false;
      var st=norm(r.status||'open');
      if(['completed','closed','archived'].indexOf(st)>=0) return false;
      if(r.completed_at || r.archived_at) return false;
      return true;
    });

    var items=[];
    rows.forEach(function(r){
      var raw=r && r.due_date;
      var days=daysUntil(raw);
      if(days===null) return;
      if(days<0 || (days>=0 && days<=5)){
        items.push({
          category:String(r.alert_type||'operations_alert'),
          table:'operations_alerts',
          id:String(r.id||''),
          title:String(r.title||'Operations alert'),
          rawDate:raw,
          days:days,
          severity:String(r.severity||'normal'),
          status:String(r.status||'open')
        });
      }
    });

    items.sort(function(a,b){return a.days-b.days;});
    var overdueItems=items.filter(function(i){return i.days<0;});
    var dueSoonItems=items.filter(function(i){return i.days>=0 && i.days<=5;});
    var critical=items.filter(function(i){return norm(i.severity)==='high' || norm(i.severity)==='critical';}).length;
    var summary={
      count:items.length,
      overdue:overdueItems.length,
      dueSoon:dueSoonItems.length,
      critical:critical,
      items:items,
      overdueItems:overdueItems,
      dueSoonItems:dueSoonItems,
      rawRows:rows,
      ok:true,
      source:'operations_alerts',
      rule:'open alerts where due_date is overdue or within 5 days',
      method:res.method
    };
    window.__MH_DEBUG_OPERATIONS = summary;
    return summary;
  }

  function route(path,ctx){ var p=[]; if(ctx&&isUuid(ctx.id)) p.push('community_id='+encodeURIComponent(ctx.id)); if(ctx&&ctx.name) p.push('community_name='+encodeURIComponent(ctx.name)); return path+(p.length?'?'+p.join('&'):''); }
  function setCard(id,tone,title,badge,copy,href){
    var el=$(id); if(!el) return;
    renderDepth++;
    try{
      el.classList.remove('is-good','is-attention','is-urgent'); el.classList.add(tone);
      var t=el.querySelector('.mh2-alert-title'); if(t) t.textContent=title;
      var b=el.querySelector('.mh2-alert-badge'); if(b) b.textContent=badge;
      var c=el.querySelector('.mh2-alert-copy'); if(c) c.textContent=copy;
      if(href) el.href=href;
      el.setAttribute('data-zummee-owner',VERSION);
    }finally{ renderDepth--; }
  }
  function renderOps(o,ctx){
    if(!o || o.count===null || o.count===undefined) return;
    var pill=$('mh2OperationsPortalPill'), title=$('mh2OperationsPortalPillTitle'), badge=$('mh2OperationsPortalPillBadge'); if(!pill||!title||!badge) return;
    renderDepth++;
    try{
      pill.classList.remove('is-loading','is-clear','is-due');
      var count=num(o.count), overdue=num(o.overdue), critical=num(o.critical);
      if(count>0){
        var dueSoon=num(o.dueSoon), pieces=[];
        pill.classList.add('is-due');
        if(overdue>0) pieces.push(overdue+' overdue');
        if(dueSoon>0) pieces.push(dueSoon+' due soon');
        if(overdue>0 && dueSoon>0){
          badge.textContent=count+' OPEN';
          title.textContent=pieces.join(' • ')+'.';
        }else if(overdue>0){
          badge.textContent=overdue+' OVERDUE';
          title.textContent=overdue+' operations item'+(overdue===1?' is':'s are')+' overdue.';
        }else if(critical>0){
          badge.textContent=critical+' 5-DAY';
          title.textContent=critical+' reminder'+(critical===1?' is':'s are')+' inside the 5-day follow-up window.';
        }else {
          badge.textContent=dueSoon+' DUE SOON';
          title.textContent=dueSoon+' operations item'+(dueSoon===1?' needs':'s need')+' attention soon.';
        }
      }else{ pill.classList.add('is-clear'); badge.textContent='CLEAR'; title.textContent='No board terms, important dates, or reminders need attention.'; }
      pill.href=route('daily_ops_rebuild.html',ctx); pill.setAttribute('data-zummee-owner',VERSION);
    }finally{ renderDepth--; }
  }
  function render(state){
    if(!state || !state.ctx) return;
    var ctx=state.ctx, b=state.board||{}, m=state.maintenance||{}, a=state.annual||{}, o=state.ops||{}, name=ctx.name||'the selected community';
    if(b.count!==null && b.count!==undefined){ setCard('mh2AlertBoard', b.overdue?'is-urgent':(b.count?'is-attention':'is-good'), b.overdue?'Board review overdue':'Board review status', b.overdue?(b.overdue+' OVERDUE'):(b.count?'OPEN':'STABLE'), b.count?(b.count+' current board item'+(b.count===1?'':'s')+' ready for review.'):'No current board items for review.', route('board_member_hub.html',ctx)); }
    if(m.count!==null && m.count!==undefined){ setCard('mh2AlertActivity', m.urgent?'is-urgent':(m.count?'is-attention':'is-good'), 'Maintenance activity', m.urgent?(m.urgent+' URGENT'):(m.count?(m.count+' OPEN'):'QUIET'), m.urgent?(m.urgent+' urgent maintenance item'+(m.urgent===1?'':'s')+' for this community.'):(m.count?(m.count+' open maintenance item'+(m.count===1?'':'s')+'.'):'No open maintenance items.'), route('maintenance_updates.html',ctx)); }
    if(a.count!==null && a.count!==undefined){ setCard('mh2AlertApprovals', a.overdue?'is-urgent':(a.count?'is-attention':'is-good'), 'Annual meeting approvals', a.overdue?(a.overdue+' OVERDUE'):(a.count?(a.count+' OPEN'):'CLEAR'), a.overdue?(a.overdue+' annual meeting approval item'+(a.overdue===1?' has':'s have')+' been open more than 2 days for '+name+'.'):(a.count?(a.count+' annual meeting approval item'+(a.count===1?' is':'s are')+' still in progress for '+name+'.'):'No active annual meeting approval items.'), route(window.mh2IsPrivileged?'annual_meeting_approvals.html':'annual_meeting_status.html',ctx)); }
    renderOps(o,ctx);
    document.documentElement.setAttribute('data-zummee-smart-alerts-ready','1');
    document.documentElement.setAttribute('data-zummee-smart-alerts-v426-ready','1');
    document.documentElement.setAttribute('data-zummee-manager-data-layer',VERSION);
    lastState=state; window.__ZUMMEE_MANAGER_HUB_DATA_LAYER_STATE__=state; writeStoredState(state);
  }
  async function refresh(reason){
    var id=++currentLoadId, ctx=getCommunity(); if(!isUuid(ctx.id)) return null;
    var sb=await client(); if(id!==currentLoadId || !sb) return null;
    // Do not render partials. Wait for the full settled payload, then render once.
    var res=await Promise.allSettled([board(ctx,sb),maintenance(ctx,sb),annual(ctx,sb),operations(ctx,sb)]);
    if(id!==currentLoadId) return null;
    var state={version:VERSION,reason:reason||'manual',ctx:ctx,board:res[0].value,maintenance:res[1].value,annual:res[2].value,ops:res[3].value,loadedAt:new Date().toISOString()};
    render(state);
    try{ console.info('[Zummee Manager Data Layer '+VERSION+']', state); }catch(_e){}
    return state;
  }
  function lockedRefresh(reason){ currentLoadId++; return refresh(reason); }
  function installObserver(){
    if(!window.MutationObserver) return;
    var targets=[$('smartAlertStrip'),$('mh2OperationsPortalPill')].filter(Boolean); if(!targets.length) return;
    var obs=new MutationObserver(function(){
      if(renderDepth || !lastState) return;
      clearTimeout(observerTimer);
      observerTimer=setTimeout(function(){ render(lastState); },40);
    });
    targets.forEach(function(t){ obs.observe(t,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','href']}); });
  }
  function start(){
    installObserver();
    lockedRefresh('start');
    // v498: no delayed verification render; one canonical load writes once.
  }

  window.__MH_DATA_LAYER_VERSION = VERSION;
  window.ZummeeManagerDataLayer={version:VERSION,refresh:lockedRefresh,getCommunity:getCommunity,render:render};
  window.ZummeeSmartData=Object.assign(window.ZummeeSmartData||{}, {
    getBoardReviewCount:function(id){ return client().then(function(sb){ return board({id:id,name:getCommunity().name},sb); }); },
    getMaintenanceOpenCount:function(id){ return client().then(function(sb){ return maintenance({id:id,name:getCommunity().name},sb); }); },
    getAnnualApprovalCount:function(id){ return client().then(function(sb){ return annual({id:id,name:getCommunity().name},sb); }); },
    getOperationsDueSummary:function(id){ return client().then(function(sb){ return operations({id:id,name:getCommunity().name},sb); }); }
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.addEventListener('pageshow',function(){ setTimeout(function(){ lockedRefresh('pageshow'); },120); });
  document.addEventListener('community:changed',function(){ lockedRefresh('community-event'); },true);
  document.addEventListener('change',function(e){ if(e.target && /community/i.test(String(e.target.id||e.target.name||e.target.className||''))) lockedRefresh('community-change'); },true);
})();
