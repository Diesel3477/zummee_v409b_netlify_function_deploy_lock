/*
  Zummee Shared Community State
  Build: 2026-05-07-v600-community-persistence

  Purpose:
  - One app-wide selected community that persists across pages.
  - No page should default back to Biltmore Parc unless there is no saved active community.
  - Assigned communities are loaded once from community_assignments and then hydrated into page dropdowns.
  - Legacy keys are still written for backwards compatibility while the app migrates.

  Canonical keys:
  - zummee_active_community_id
  - zummee_active_community_name
*/
(function(){
  if(window.ZummeeCommunityState && window.ZummeeCommunityState.version === "2026-05-07-v600") return;

  const VERSION = "2026-05-07-v600";
  const SUPABASE_URL = window.SUPABASE_URL || "https://slcwuuwyrgnmlmxpcaim.supabase.co";
  const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || "sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864";

  const ID_KEYS = [
    "zummee_active_community_id",
    "zummeeActiveCommunityId",
    "activeCommunityId",
    "currentCommunityId",
    "zummee_selected_community_id",
    "zummee_selected_community_v1",
    "zummee_community_id"
  ];

  const NAME_KEYS = [
    "zummee_active_community_name",
    "zummeeActiveCommunityName",
    "activeCommunityName",
    "currentCommunityName",
    "zummeeCurrentCommunityName",
    "zummee_selected_community_name"
  ];

  let assignedCache = null;
  let assignedCacheAt = 0;
  let hydrationInProgress = new WeakSet();

  function str(v){ return String(v ?? "").trim(); }
  function safeJson(raw, fallback=null){ try{ return raw ? JSON.parse(raw) : fallback; }catch(_e){ return fallback; } }
  function uniqueById(rows){
    const out = [];
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const id = str(row && (row.id || row.community_id || row.communityId || row.value));
      if(!id || seen.has(id)) return;
      seen.add(id);
      const name = str(row.name || row.community_name || row.communityName || row.label || row.text || row.title || id);
      out.push({ id, name, raw: row });
    });
    return out;
  }

  async function getClient(){
    try{ if(window.sb && typeof window.sb.from === "function") return window.sb; }catch(_e){}
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient; }catch(_e){}
    try{ if(typeof window.ensureSupabase === "function"){ const c = await window.ensureSupabase(); if(c && typeof c.from === "function") return c; } }catch(_e){}
    try{
      if(window.supabase && typeof window.supabase.createClient === "function"){
        const c = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false }
        });
        try{ window.supabaseClient = window.supabaseClient || c; window.sb = window.sb || c; }catch(_e){}
        return c;
      }
    }catch(_e){}
    return null;
  }

  async function maybeRefreshSessionObject(parsed, sourceKey){
    try{
      const exp = Number(parsed?.expires_at || parsed?.currentSession?.expires_at || parsed?.session?.expires_at || 0);
      const refreshToken = str(parsed?.refresh_token || parsed?.currentSession?.refresh_token || parsed?.session?.refresh_token);
      const now = Math.floor(Date.now() / 1000);
      if(!refreshToken) return parsed;
      if(exp && exp > (now + 60)) return parsed;

      const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const raw = await res.text();
      const next = safeJson(raw, null);
      if(res.ok && next && next.access_token){
        const merged = Object.assign({}, parsed || {}, next);
        try{ localStorage.setItem(sourceKey, JSON.stringify(merged)); }catch(_e){}
        return merged;
      }
    }catch(_e){}
    return parsed;
  }

  function tokenFromObject(obj){
    if(!obj || typeof obj !== "object") return "";
    return str(
      obj.access_token ||
      obj.accessToken ||
      obj?.currentSession?.access_token ||
      obj?.session?.access_token ||
      obj?.data?.session?.access_token
    );
  }

  async function getAccessToken(){
    try{
      if(window.ZummeeAuth && typeof window.ZummeeAuth.getAccessToken === "function"){
        const t = await window.ZummeeAuth.getAccessToken({ redirect:false, timeoutMs:1600 });
        if(t) return str(t);
      }
    }catch(_e){}

    const keys = [
      "sb-zummee-auth",
      "sb-slcwuuwyrgnmlmxpcaim-auth-token",
      "supabase.auth.token",
      "zummee_supabase_session",
      "zummee_session_v1"
    ];

    async function readKey(key){
      try{
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || "";
        if(!raw) return "";
        let parsed = safeJson(raw, null);
        parsed = await maybeRefreshSessionObject(parsed, key);
        return tokenFromObject(parsed);
      }catch(_e){ return ""; }
    }

    for(const key of keys){
      const t = await readKey(key);
      if(t) return t;
    }

    for(const store of [localStorage, sessionStorage]){
      try{
        for(let i=0; i<store.length; i++){
          const key = store.key(i);
          if(!key) continue;
          if(/auth/i.test(key) && /supabase|zummee|sb-/i.test(key)){
            const t = await readKey(key);
            if(t) return t;
          }
        }
      }catch(_e){}
    }

    try{
      const c = await getClient();
      if(c?.auth?.getSession){
        const sess = await c.auth.getSession();
        const t = sess?.data?.session?.access_token;
        if(t) return str(t);
      }
    }catch(_e){}
    return "";
  }

  async function rest(path, opts={}){
    const token = await getAccessToken();
    const headers = Object.assign({
      apikey: SUPABASE_ANON_KEY,
      "Content-Type":"application/json"
    }, opts.headers || {});
    if(token) headers.Authorization = "Bearer " + token;

    const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, Object.assign({}, opts, { headers }));
    const raw = await res.text();
    const data = safeJson(raw, raw);
    if(!res.ok){
      const err = new Error((data && (data.message || data.error)) || raw || ("REST failed: " + res.status));
      err.status = res.status;
      err.response = data;
      throw err;
    }
    return data;
  }

  async function getCurrentUserId(){
    try{
      const c = await getClient();
      if(c?.auth?.getSession){
        const sess = await c.auth.getSession();
        const id = sess?.data?.session?.user?.id;
        if(id) return str(id);
      }
    }catch(_e){}
    try{
      const token = await getAccessToken();
      if(token){
        const res = await fetch(SUPABASE_URL + "/auth/v1/user", {
          headers:{ apikey: SUPABASE_ANON_KEY, Authorization:"Bearer " + token }
        });
        const data = await res.json();
        if(data && data.id) return str(data.id);
      }
    }catch(_e){}
    try{
      const raw = localStorage.getItem("zummee_session_v1") || sessionStorage.getItem("zummee_session_v1") || "";
      const parsed = safeJson(raw, null);
      return str(parsed?.userId || parsed?.user?.id || parsed?.id);
    }catch(_e){}
    return "";
  }

  function readStoredId(){
    for(const key of ID_KEYS){
      try{
        const v = str(localStorage.getItem(key) || sessionStorage.getItem(key));
        if(v) return v;
      }catch(_e){}
    }
    return "";
  }

  function readStoredName(){
    for(const key of NAME_KEYS){
      try{
        const v = str(localStorage.getItem(key) || sessionStorage.getItem(key));
        if(v) return v;
      }catch(_e){}
    }
    return "";
  }

  function setActiveCommunity(id, name, opts={}){
    id = str(id);
    name = str(name);
    if(!id) return null;

    const previousId = readStoredId();

    ID_KEYS.forEach(key => {
      try{ localStorage.setItem(key, id); sessionStorage.setItem(key, id); }catch(_e){}
    });
    if(name){
      NAME_KEYS.forEach(key => {
        try{ localStorage.setItem(key, name); sessionStorage.setItem(key, name); }catch(_e){}
      });
    }

    try{
      window.currentCommunityId = id;
      window.activeCommunityId = id;
      window.zummeeActiveCommunityId = id;
      window.__zummeeActiveCommunityId = id;
      if(name){
        window.currentCommunityName = name;
        window.activeCommunityName = name;
        window.__zummeeActiveCommunityName = name;
      }
    }catch(_e){}

    const detail = { id, name, previousId, source: opts.source || "unknown" };
    if(!opts.silent && previousId !== id){
      try{ window.dispatchEvent(new CustomEvent("zummee:community-changed", { detail })); }catch(_e){}
      try{ document.dispatchEvent(new CustomEvent("zummee:community-changed", { detail })); }catch(_e){}
      try{ localStorage.setItem("zummee_community_change_ping", JSON.stringify({ id, name, at: Date.now() })); }catch(_e){}
    }
    return { id, name };
  }

  function getActiveCommunity(){
    const id = readStoredId();
    const name = readStoredName();
    return id ? { id, name } : null;
  }

  async function lookupCommunityNames(ids){
    ids = [...new Set((ids || []).map(str).filter(Boolean))];
    if(!ids.length) return [];

    const fallback = ids.map(id => ({ id, name:id }));

    const tableAttempts = [
      "PropertyCommunities",
      "Communities"
    ];

    for(const table of tableAttempts){
      try{
        const rows = await rest(table + "?select=*&id=in.(" + ids.map(encodeURIComponent).join(",") + ")");
        const byId = new Map();
        (Array.isArray(rows) ? rows : []).forEach(c => {
          const id = str(c.id || c.community_id || c.value);
          if(!id) return;
          byId.set(id, {
            id,
            name: str(c.community_name || c.name || c.label || c.title || c.property_name || id),
            raw: c
          });
        });
        if(byId.size) return ids.map(id => byId.get(id) || { id, name:id });
      }catch(err){
        console.warn("[ZummeeCommunityState] name lookup failed for", table, err);
      }
    }

    return fallback;
  }

  async function loadAssignedCommunities(opts={}){
    const now = Date.now();
    if(!opts.force && assignedCache && (now - assignedCacheAt) < 30000){
      return assignedCache.slice();
    }

    const userId = await getCurrentUserId();
    let communities = [];

    if(userId){
      const assignmentQueries = [
        "community_assignments?select=community_id&user_id=eq." + encodeURIComponent(userId),
        "community_assignments?select=community_id&auth_user_id=eq." + encodeURIComponent(userId),
        "community_assignments?select=community_id&employee_id=eq." + encodeURIComponent(userId)
      ];

      for(const q of assignmentQueries){
        try{
          const rows = await rest(q);
          const ids = uniqueById((Array.isArray(rows) ? rows : []).map(r => ({ id:r.community_id }))).map(c => c.id);
          if(ids.length){
            communities = await lookupCommunityNames(ids);
            break;
          }
        }catch(err){
          // Try the next known assignment key. Do not fail hard.
          console.warn("[ZummeeCommunityState] assignment query skipped", q, err);
        }
      }
    }

    // Fallback to existing local/header communities only if assignment source returns nothing.
    if(!communities.length){
      const localRows = [];
      try{
        const keys = ["zummee_header_communities","zummee_communities_v1","communities","assignedCommunities"];
        keys.forEach(key => {
          const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || "";
          const parsed = safeJson(raw, []);
          const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.communities) ? parsed.communities : []);
          arr.forEach(c => localRows.push(c));
        });
      }catch(_e){}
      communities = uniqueById(localRows);
    }

    assignedCache = uniqueById(communities).sort((a,b) =>
      str(a.name || a.id).localeCompare(str(b.name || b.id), undefined, { sensitivity:"base" })
    );
    assignedCacheAt = now;

    try{ localStorage.setItem("zummee_assigned_communities_cache_v600", JSON.stringify(assignedCache)); }catch(_e){}
    return assignedCache.slice();
  }

  async function ensureActiveCommunity(opts={}){
    const assigned = await loadAssignedCommunities({ force: !!opts.force });
    const current = getActiveCommunity();

    if(current && assigned.some(c => c.id === current.id)){
      const matched = assigned.find(c => c.id === current.id);
      if(matched && matched.name && matched.name !== current.name){
        setActiveCommunity(matched.id, matched.name, { source:"ensure-name-sync", silent:true });
        return { id: matched.id, name: matched.name };
      }
      return current;
    }

    if(current && !assigned.length){
      return current;
    }

    if(assigned.length){
      const first = assigned[0];
      return setActiveCommunity(first.id, first.name, { source:"ensure-first-assigned", silent: !!opts.silent });
    }

    return null;
  }

  async function hydrateCommunityDropdown(selectOrSelector, opts={}){
    const select = typeof selectOrSelector === "string"
      ? document.querySelector(selectOrSelector)
      : selectOrSelector;

    if(!select || hydrationInProgress.has(select)) return null;
    hydrationInProgress.add(select);

    try{
      const assigned = await loadAssignedCommunities({ force: !!opts.force });
      const active = await ensureActiveCommunity({ force: false, silent:true });

      if(!assigned.length){
        select.innerHTML = '<option value="">No assigned communities found</option>';
        return null;
      }

      const prior = str(select.value || active?.id || readStoredId());
      select.innerHTML = assigned.map(c =>
        '<option value="' + c.id.replace(/"/g,"&quot;") + '">' +
        str(c.name || c.id).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") +
        '</option>'
      ).join("");

      const chosen = assigned.find(c => c.id === prior) || assigned.find(c => c.id === active?.id) || assigned[0];
      select.value = chosen.id;
      setActiveCommunity(chosen.id, chosen.name, { source: opts.source || "hydrate", silent:true });

      if(!select.__zummeeCommunityStateBound){
        select.__zummeeCommunityStateBound = true;
        select.addEventListener("change", function(){
          const opt = select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0] : null;
          const id = str(select.value);
          const name = str(opt ? opt.textContent : "");
          setActiveCommunity(id, name, { source: opts.source || "dropdown" });
        });
      }

      return { active: chosen, assigned };
    }finally{
      hydrationInProgress.delete(select);
    }
  }

  function bindExistingDropdowns(){
    const selectors = [
      "#zummeeCommunitySelect",
      "#maintenanceCommunitySelect",
      "#communitySelect",
      'select[id*="community" i]'
    ];

    const seen = new Set();
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(node => {
        if(!node || seen.has(node)) return;
        seen.add(node);
        hydrateCommunityDropdown(node, { source:"auto-bind" }).catch(err => {
          console.warn("[ZummeeCommunityState] dropdown hydrate failed", err);
        });
      });
    });
  }

  function listenForCrossTabChanges(){
    window.addEventListener("storage", function(e){
      if(!e || e.key !== "zummee_community_change_ping" || !e.newValue) return;
      const data = safeJson(e.newValue, null);
      if(!data || !data.id) return;
      setActiveCommunity(data.id, data.name || "", { source:"storage", silent:true });
      try{ window.dispatchEvent(new CustomEvent("zummee:community-changed", { detail:{ id:data.id, name:data.name || "", source:"storage" } })); }catch(_e){}
    });
  }

  window.ZummeeCommunityState = {
    version: VERSION,
    getActiveCommunity,
    setActiveCommunity,
    ensureActiveCommunity,
    loadAssignedCommunities,
    hydrateCommunityDropdown,
    bindExistingDropdowns,
    getActiveCommunityId(){ return readStoredId(); },
    getActiveCommunityName(){ return readStoredName(); },
    getSelectedCommunityId(){ return readStoredId(); },
    clearCache(){ assignedCache = null; assignedCacheAt = 0; },
    rest,
    getAccessToken,
    getCurrentUserId
  };

  // Legacy global helpers some pages already call.
  window.getActiveCommunityId = window.getActiveCommunityId || function(){ return readStoredId(); };
  window.setActiveCommunityId = window.setActiveCommunityId || function(id, name){ return setActiveCommunity(id, name || ""); };

  listenForCrossTabChanges();

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", bindExistingDropdowns, { once:true });
  }else{
    setTimeout(bindExistingDropdowns, 50);
  }
})();
