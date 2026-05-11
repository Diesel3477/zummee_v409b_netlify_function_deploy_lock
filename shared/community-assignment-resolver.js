/*
  Zummee Community Assignment Resolver v746
  Long-term Manager Hub guard:
  - community_assignments uses employee_id / employee_email only
  - rewrites legacy user_id/auth_user_id filters for this page before Supabase sends them; avoids missing userdirectory columns
  - resolves assigned communities once and publishes one canonical list/state
  - exposes diagnostics for Manager Hub testing
*/
(function(){
  'use strict';
  if (window.__ZUMMEE_COMMUNITY_ASSIGNMENT_RESOLVER_V746__) return;
  window.__ZUMMEE_COMMUNITY_ASSIGNMENT_RESOLVER_V746__ = true;

  var BUILD = '2026-05-11-v746-community-assignment-resolver-clean-400s';
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  var state = {
    build: BUILD,
    ok: false,
    loadedAt: null,
    userId: '',
    userEmail: '',
    role: '',
    company: '',
    company_id: '',
    count: 0,
    communities: [],
    source: '',
    errors: [],
    rewrites: []
  };

  function isUuid(v){ return UUID_RE.test(String(v || '').trim()); }
  function s(v){ return String(v == null ? '' : v).trim(); }
  function lower(v){ return s(v).toLowerCase(); }
  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function read(k){ try { return s(localStorage.getItem(k) || sessionStorage.getItem(k) || ''); } catch(_e){ return ''; } }
  function write(k,v){ try { if(v != null && v !== '') { localStorage.setItem(k, String(v)); sessionStorage.setItem(k, String(v)); } } catch(_e){} }
  function parse(raw){ try { return raw ? JSON.parse(raw) : null; } catch(_e){ return null; } }
  function pushError(label, err){
    var msg = label + ': ' + (err && (err.message || err.details || err.code) ? (err.message || err.details || err.code) : String(err || 'unknown'));
    state.errors.push(msg);
    try { console.warn('[Zummee Community Assignment Resolver]', msg, err); } catch(_e){}
  }

  // This is intentionally narrow: only fix old Manager Hub assignment calls that hit
  // community_assignments with user_id/auth_user_id. The real production columns are
  // employee_id and employee_email.
  (function patchFetchForLegacyAssignmentColumns(){
    if (window.__ZUMMEE_COMMUNITY_ASSIGNMENT_FETCH_PATCH_V746__) return;
    window.__ZUMMEE_COMMUNITY_ASSIGNMENT_FETCH_PATCH_V746__ = true;
    var originalFetch = window.fetch;
    if (typeof originalFetch !== 'function') return;
    window.fetch = function(input, init){
      try{
        var rawUrl = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (rawUrl && rawUrl.indexOf('/rest/v1/community_assignments') !== -1 && (rawUrl.indexOf('user_id=eq.') !== -1 || rawUrl.indexOf('auth_user_id=eq.') !== -1)){
          var fixedUrl = rawUrl.replace(/([?&])auth_user_id=eq\./g, '$1employee_id=eq.').replace(/([?&])user_id=eq\./g, '$1employee_id=eq.');
          if (fixedUrl !== rawUrl){
            state.rewrites.push({ at: new Date().toISOString(), from: rawUrl, to: fixedUrl });
            if (typeof input === 'string') input = fixedUrl;
            else input = new Request(fixedUrl, input);
          }
        }
      }catch(err){ pushError('fetch rewrite failed', err); }
      return originalFetch.call(this, input, init);
    };
  })();

  function getClientSync(){
    try { if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient; } catch(_e){}
    try { if(window.sb && typeof window.sb.from === 'function') return window.sb; } catch(_e){}
    try { if(typeof window.ensureSupabaseSync === 'function'){ var c = window.ensureSupabaseSync(); if(c && typeof c.from === 'function') return c; } } catch(_e){}
    try { if(typeof window.getSupabase === 'function'){ var g = window.getSupabase(); if(g && typeof g.from === 'function') return g; } } catch(_e){}
    return null;
  }
  async function getClient(){
    for(var i=0;i<60;i++){
      var c = getClientSync();
      if(c) return c;
      try { if(typeof window.ensureSupabase === 'function'){ var a = await window.ensureSupabase(); if(a && typeof a.from === 'function') return a; } } catch(_e){}
      await sleep(100);
    }
    throw new Error('Supabase client unavailable');
  }

  async function getSessionUser(sb){
    var user = null;
    try{
      if(sb && sb.auth && typeof sb.auth.getSession === 'function'){
        var res = await sb.auth.getSession();
        user = res && res.data && res.data.session && res.data.session.user;
      }
    }catch(err){ pushError('auth.getSession failed', err); }
    var uid = s(user && user.id) || read('zummee_user_id_v1') || read('zummeeUserId') || read('activeUserId') || read('currentUserId');
    var email = lower(user && user.email);
    if(isUuid(uid)){
      ['zummee_user_id_v1','zummeeUserId','activeUserId','currentUserId'].forEach(function(k){ write(k, uid); });
    }
    return { id: isUuid(uid) ? uid : '', email: email };
  }

  async function resolveProfile(sb, sessionUser){
    var ctx = { userId: sessionUser.id || '', email: sessionUser.email || '', role: '', company: '', company_id: '' };
    var uid = ctx.userId;
    if(!isUuid(uid)) return ctx;

    // userdirectory is the most useful on this app because it has the staff role/company.
    try{
      var ud = await sb.from('userdirectory')
        .select('auth_user_id,role,company_id,company_name,approved,email')
        .eq('auth_user_id', uid)
        .maybeSingle();
      if(ud && ud.error) throw ud.error;
      if(ud && ud.data){
        ctx.role = s(ud.data.role) || ctx.role;
        ctx.company_id = s(ud.data.company_id) || ctx.company_id;
        ctx.company = s(ud.data.company_name) || ctx.company;
        ctx.email = lower(ud.data.email) || ctx.email;
      }
    }catch(err){ pushError('userdirectory context lookup failed', err); }

    // Profiles is fallback only. Some builds use profiles.id = auth user id.
    try{
      var pr = await sb.from('profiles')
        .select('id,role,company,company_id,email')
        .eq('id', uid)
        .maybeSingle();
      if(pr && pr.error) throw pr.error;
      if(pr && pr.data){
        ctx.role = s(pr.data.role) || ctx.role;
        ctx.company_id = s(pr.data.company_id) || ctx.company_id;
        ctx.company = s(pr.data.company) || ctx.company;
        ctx.email = lower(pr.data.email) || ctx.email;
      }
    }catch(err){ pushError('profiles context lookup failed', err); }

    // Local session/profile cache may have email/name if RLS blocks one of the above.
    try{
      var sess = parse(localStorage.getItem('zummee_session_v1') || sessionStorage.getItem('zummee_session_v1') || '');
      if(sess){ ctx.email = lower(sess.email || sess.user_email) || ctx.email; }
    }catch(_e){}
    try{
      var prof = parse(localStorage.getItem('zummee_profile_v1') || sessionStorage.getItem('zummee_profile_v1') || '');
      if(prof){
        ctx.email = lower(prof.email || prof.employee_email) || ctx.email;
        ctx.company_id = s(prof.company_id) || ctx.company_id;
        ctx.company = s(prof.company || prof.company_name) || ctx.company;
        ctx.role = s(prof.role) || ctx.role;
      }
    }catch(_e){}

    return ctx;
  }

  function normalizeCommunityRow(row){
    row = row || {};
    var id = s(row.community_id || row.id);
    var name = s(row.community_name || row.name || row.community);
    if(!isUuid(id)) return null;
    return {
      id: id,
      community_id: id,
      name: name,
      community_name: name,
      company_id: s(row.company_id),
      employee_id: s(row.employee_id),
      employee_name: s(row.employee_name || row.assistant_name),
      employee_email: lower(row.employee_email || row.assistant_email)
    };
  }

  async function fetchAssignments(sb, ctx){
    var rows = [];
    var seen = {};
    async function addQuery(label, col, value){
      value = s(value);
      if(!value) return;
      try{
        var q = await sb.from('community_assignments')
          .select('id,community_id,community_name,company_id,employee_id,employee_name,employee_email,assistant_name,assistant_email')
          .eq(col, value)
          .order('community_name', { ascending:true });
        if(q && q.error) throw q.error;
        (Array.isArray(q.data) ? q.data : []).forEach(function(raw){
          var c = normalizeCommunityRow(raw);
          if(!c) return;
          var key = c.id;
          if(!seen[key]){ seen[key] = true; rows.push(c); }
        });
      }catch(err){ pushError('assignment lookup '+label+' failed', err); }
    }

    // Production column strategy: employee_id / employee_email only.
    await addQuery('employee_id', 'employee_id', ctx.userId);
    await addQuery('employee_email', 'employee_email', ctx.email);
    return rows;
  }

  async function fetchCompanyCommunities(sb, ctx){
    var rows = [];
    var seen = {};
    if(!ctx.company_id) return rows;
    var tables = ['communities','PropertyCommunities'];
    for(var i=0;i<tables.length;i++){
      try{
        var q = await sb.from(tables[i]).select('id,name,community_name,company_id').eq('company_id', ctx.company_id).order('name', { ascending:true });
        if(q && q.error) throw q.error;
        (Array.isArray(q.data) ? q.data : []).forEach(function(raw){
          var c = normalizeCommunityRow(raw);
          if(!c) return;
          if(!seen[c.id]){ seen[c.id] = true; rows.push(c); }
        });
        if(rows.length) break;
      }catch(err){ pushError('company communities lookup '+tables[i]+' failed', err); }
    }
    return rows;
  }

  function publishCommunities(list, ctx, source){
    list = (Array.isArray(list) ? list : []).filter(function(c){ return c && isUuid(c.id); });
    list.sort(function(a,b){ return s(a.name).localeCompare(s(b.name)); });
    state.ok = true;
    state.loadedAt = new Date().toISOString();
    state.userId = ctx.userId || '';
    state.userEmail = ctx.email || '';
    state.role = ctx.role || '';
    state.company = ctx.company || '';
    state.company_id = ctx.company_id || '';
    state.count = list.length;
    state.communities = list;
    state.source = source || 'community_assignments';

    try{
      localStorage.setItem('zummee_assigned_communities_v1', JSON.stringify(list));
      sessionStorage.setItem('zummee_assigned_communities_v1', JSON.stringify(list));
    }catch(_e){}
    window.__zummeeAssignedCommunities = list;

    // Keep selected community canonical if current selection is missing or unassigned.
    var selected = read('zummee_active_community_id') || read('zummee_selected_community_id') || read('activeCommunityId') || read('currentCommunityId') || '';
    var hasSelected = list.some(function(c){ return c.id === selected; });
    if((!isUuid(selected) || !hasSelected) && list[0]){
      var first = list[0];
      ['zummee_active_community_id','zummee_selected_community_id','zummeeActiveCommunityId','activeCommunityId','currentCommunityId','zummee_community_id','zummee_selected_community_v1'].forEach(function(k){ write(k, first.id); });
      ['zummee_active_community_name','zummeeCurrentCommunityName','currentCommunityName','activeCommunityName','zummee_community','zummee_selected_community_name'].forEach(function(k){ write(k, first.name); });
      try{
        var canonical = { id:first.id, name:first.name, updatedAt:Date.now(), source:'community-assignment-resolver-v745' };
        localStorage.setItem('zummee_active_community_v601', JSON.stringify(canonical));
        sessionStorage.setItem('zummee_active_community_v601', JSON.stringify(canonical));
      }catch(_e){}
      window.currentCommunityId = first.id;
      window.activeCommunityId = first.id;
      window.zummeeSelectedCommunityId = first.id;
      window.currentCommunityName = first.name;
    }

    return list;
  }

  async function getAssignedCommunities(opts){
    opts = opts || {};
    state.errors = [];
    var sb = opts.client || await getClient();
    var sessionUser = await getSessionUser(sb);
    var ctx = await resolveProfile(sb, sessionUser);
    ctx.userId = opts.userId && isUuid(opts.userId) ? opts.userId : (ctx.userId || sessionUser.id || '');
    ctx.email = lower(opts.email) || ctx.email || sessionUser.email || '';

    var role = lower(ctx.role);
    var list = await fetchAssignments(sb, ctx);
    var source = 'community_assignments.employee_id_or_email';

    // Admins/supervisors may legitimately need company-wide access if no explicit assignment rows exist.
    // Employees/managers stay assignment-only.
    if(!list.length && /admin|supervisor/.test(role)){
      var companyList = await fetchCompanyCommunities(sb, ctx);
      if(companyList.length){ list = companyList; source = 'company_communities.supervisor_fallback'; }
    }

    return publishCommunities(list, ctx, source);
  }

  function installOverrides(){
    try{
      window.ZummeeCommunityAssignmentResolver = api;
      window.getZummeeAssignedCommunities = function(opts){ return api.getAssignedCommunities(opts); };
      if(!window.ZummeeDataLayer) window.ZummeeDataLayer = {};
      window.ZummeeDataLayer.getAssignedCommunities = function(opts){ return api.getAssignedCommunities(opts || {}); };
    }catch(err){ pushError('install overrides failed', err); }
  }

  var api = {
    build: BUILD,
    state: state,
    getAssignedCommunities: getAssignedCommunities,
    reload: function(){ return getAssignedCommunities({ force:true }); },
    status: function(){ return JSON.parse(JSON.stringify(state)); },
    installOverrides: installOverrides
  };
  installOverrides();
  setTimeout(installOverrides, 250);
  setTimeout(installOverrides, 1000);
  setTimeout(installOverrides, 2500);

  window.getManagerHubCommunityAssignmentStatus = function(){ return api.status(); };

  // Warm the canonical cache shortly after boot, but do not block the page.
  function warm(){ getAssignedCommunities({ warm:true }).catch(function(err){ pushError('warm resolver failed', err); state.ok = false; state.loadedAt = new Date().toISOString(); }); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(warm, 50); });
  else setTimeout(warm, 50);
})();
