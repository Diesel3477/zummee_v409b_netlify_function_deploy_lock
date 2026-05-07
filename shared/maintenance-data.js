/*
  Zummee Shared Maintenance Data Layer
  Build: 2026-05-07-v500-maintenance-data-layer

  Long-term source of truth:
  - Vendors: public.Vendors filtered by community_id
  - Work Orders: public.resident_work_orders filtered by community_id
  - Vendor email/audit: assign-vendor-email Edge Function
  - Status refresh: Realtime when available + REST polling fallback
*/
(function(){
  if (window.ZummeeMaintenanceData && window.ZummeeMaintenanceData.version === "2026-05-07-v500") return;

  const VERSION = "2026-05-07-v500";
  const DEFAULT_SUPABASE_URL = window.SUPABASE_URL || "https://slcwuuwyrgnmlmxpcaim.supabase.co";
  const DEFAULT_ANON_KEY = window.SUPABASE_ANON_KEY || "sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864";
  const vendorCache = new Map();
  const workOrderDigestByCommunity = new Map();

  function str(v){ return String(v ?? "").trim(); }
  function safeJson(raw, fallback=null){ try{ return raw ? JSON.parse(raw) : fallback; }catch(_e){ return fallback; } }

  async function getClient(){
    try{ if(window.sb && typeof window.sb.from === "function") return window.sb; }catch(_e){}
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === "function") return window.supabaseClient; }catch(_e){}
    try{ if(typeof window.ensureSupabase === "function"){ const c = await window.ensureSupabase(); if(c && typeof c.from === "function") return c; } }catch(_e){}
    try{
      if(window.supabase && typeof window.supabase.createClient === "function"){
        const c = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_ANON_KEY, {
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

      const res = await fetch(DEFAULT_SUPABASE_URL + "/auth/v1/token?grant_type=refresh_token", {
        method:"POST",
        headers:{ "Content-Type":"application/json", "apikey": DEFAULT_ANON_KEY },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      const raw = await res.text();
      const next = safeJson(raw, null);
      if(res.ok && next && next.access_token){
        const merged = Object.assign({}, parsed || {}, next);
        try{ localStorage.setItem(sourceKey || "sb-zummee-auth", JSON.stringify(merged)); }catch(_e){}
        return merged;
      }
    }catch(_e){}
    return parsed;
  }

  function tokenFromObject(obj){
    if(!obj || typeof obj !== "object") return "";
    return str(
      obj.access_token || obj.accessToken ||
      obj?.currentSession?.access_token ||
      obj?.session?.access_token ||
      obj?.data?.session?.access_token
    );
  }

  async function getAccessToken(){
    try{
      if(window.ZummeeAuth && typeof window.ZummeeAuth.getAccessToken === "function"){
        const token = await window.ZummeeAuth.getAccessToken({ redirect:false, timeoutMs:1800 });
        if(token) return str(token);
      }
    }catch(_e){}

    async function readKey(key){
      try{
        const raw = localStorage.getItem(key) || sessionStorage.getItem(key) || "";
        if(!raw) return "";
        let parsed = safeJson(raw, null);
        parsed = await maybeRefreshSessionObject(parsed, key);
        return tokenFromObject(parsed);
      }catch(_e){ return ""; }
    }

    const keys = [
      "sb-zummee-auth",
      "sb-slcwuuwyrgnmlmxpcaim-auth-token",
      "supabase.auth.token",
      "zummee_supabase_session",
      "zummee_session_v1"
    ];

    for(const key of keys){
      const token = await readKey(key);
      if(token) return token;
    }

    for(const store of [localStorage, sessionStorage]){
      try{
        for(let i=0; i<store.length; i++){
          const key = store.key(i);
          if(!key) continue;
          if(/auth/i.test(key) && /supabase|zummee|sb-/i.test(key)){
            const token = await readKey(key);
            if(token) return token;
          }
        }
      }catch(_e){}
    }

    try{
      const c = await getClient();
      if(c?.auth?.getSession){
        const sess = await c.auth.getSession();
        const token = sess?.data?.session?.access_token;
        if(token) return str(token);
      }
    }catch(_e){}
    return "";
  }

  async function rest(path, opts={}){
    const url = DEFAULT_SUPABASE_URL + "/rest/v1/" + path;
    const token = await getAccessToken();
    const headers = Object.assign({
      "apikey": DEFAULT_ANON_KEY,
      "Content-Type": "application/json"
    }, opts.headers || {});
    if(token) headers.Authorization = "Bearer " + token;

    const res = await fetch(url, Object.assign({}, opts, { headers }));
    const raw = await res.text();
    let data = safeJson(raw, raw);
    if(!res.ok){
      const err = new Error((data && (data.message || data.error)) || raw || ("REST request failed: " + res.status));
      err.status = res.status;
      err.response = data;
      throw err;
    }
    return data;
  }

  function getSelectedCommunityId(){
    try{
      const sel = document.getElementById("zummeeCommunitySelect") || document.getElementById("communitySelect") || document.querySelector('select[id*="community" i]');
      if(sel && sel.value) return str(sel.value);
    }catch(_e){}
    const keys = [
      "zummeeActiveCommunityId",
      "activeCommunityId",
      "currentCommunityId",
      "zummee_selected_community_id",
      "zummee_selected_community_v1",
      "community_id"
    ];
    for(const k of keys){
      try{
        const v = str(localStorage.getItem(k) || sessionStorage.getItem(k));
        if(v) return v;
      }catch(_e){}
    }
    return "";
  }

  function setSelectedCommunity(id, name){
    id = str(id); name = str(name);
    if(!id) return;
    const idKeys = ["zummeeActiveCommunityId","activeCommunityId","currentCommunityId","zummee_selected_community_id","zummee_selected_community_v1"];
    const nameKeys = ["zummeeActiveCommunityName","activeCommunityName","currentCommunityName","zummeeCurrentCommunityName"];
    idKeys.forEach(k => { try{ localStorage.setItem(k, id); sessionStorage.setItem(k, id); }catch(_e){} });
    if(name) nameKeys.forEach(k => { try{ localStorage.setItem(k, name); sessionStorage.setItem(k, name); }catch(_e){} });
    try{ window.activeCommunityId = id; window.currentCommunityId = id; window.__rwoActiveCommunityId = id; }catch(_e){}
  }

  function normalizeVendor(row){
    row = row || {};
    return {
      id: str(row.id || row.vendor_id || row.vendorId),
      name: str(row.vendor_name || row.name || row.company_name || row.company || row.title),
      email: str(row.email || row.vendor_email || row.contact_email || row.vendorEmail),
      phone: str(row.phone || row.vendor_phone || row.contact_phone || row.vendorPhone),
      type: str(row.vendor_type || row.type || row.category || row.trade || row.service),
      community_id: str(row.community_id || row.communityId),
      raw: row
    };
  }

  async function getVendorsForCommunity(communityId, opts={}){
    communityId = str(communityId || getSelectedCommunityId());
    if(!communityId) return [];
    const cacheKey = communityId;
    if(!opts.force && vendorCache.has(cacheKey)) return vendorCache.get(cacheKey).slice();

    const path = "Vendors?select=*"
      + "&community_id=eq." + encodeURIComponent(communityId)
      + "&limit=500";

    const rows = await rest(path, { method:"GET" });
    const vendors = (Array.isArray(rows) ? rows : [])
      .map(normalizeVendor)
      .filter(v => v.name)
      .sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity:"base" }));

    vendorCache.set(cacheKey, vendors);
    return vendors.slice();
  }

  function normalizeStatus(row){
    const s = str(row?.status).toLowerCase();
    if(["assigned","assigned_to_vendor"].includes(s)) return "sent_to_vendor";
    if(["in_progress","vendor_accepted","accepted"].includes(s)) return "active";
    if(["submitted","under_review","manager_review"].includes(s)) return "manager_review";
    return s || "manager_review";
  }

  async function getWorkOrdersForCommunity(communityId, opts={}){
    communityId = str(communityId || getSelectedCommunityId());
    if(!communityId) return [];
    const path = "resident_work_orders?select=*"
      + "&community_id=eq." + encodeURIComponent(communityId)
      + "&limit=" + encodeURIComponent(String(opts.limit || 500));
    const rows = await rest(path, { method:"GET" });
    return (Array.isArray(rows) ? rows : []).sort((a,b) => {
      const ad = new Date(a.submitted_at || a.created_at || a.updated_at || 0).getTime() || 0;
      const bd = new Date(b.submitted_at || b.created_at || b.updated_at || 0).getTime() || 0;
      return bd - ad;
    });
  }

  async function updateWorkOrder(id, payload){
    id = str(id);
    if(!id) throw new Error("Missing work order id.");
    const rows = await rest("resident_work_orders?id=eq." + encodeURIComponent(id) + "&select=*", {
      method:"PATCH",
      headers:{ "Prefer":"return=representation" },
      body: JSON.stringify(payload || {})
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async function createWorkOrder(payload){
    const rows = await rest("resident_work_orders?select=*", {
      method:"POST",
      headers:{ "Prefer":"return=representation" },
      body: JSON.stringify(payload || {})
    });
    return Array.isArray(rows) ? rows[0] : rows;
  }

  async function invokeFunction(name, payload){
    const token = await getAccessToken();
    const headers = {
      "apikey": DEFAULT_ANON_KEY,
      "Content-Type": "application/json"
    };
    if(token) headers.Authorization = "Bearer " + token;

    const res = await fetch(DEFAULT_SUPABASE_URL + "/functions/v1/" + name, {
      method:"POST",
      headers,
      body: JSON.stringify(payload || {})
    });
    const raw = await res.text();
    const data = safeJson(raw, raw);
    if(!res.ok){
      const err = new Error((data && (data.message || data.error)) || raw || (name + " failed: " + res.status));
      err.status = res.status;
      err.response = data;
      throw err;
    }
    return data;
  }

  async function sendWorkOrderToVendor(workOrder, vendor, extras={}){
    workOrder = workOrder || {};
    vendor = vendor || {};
    const workOrderId = str(workOrder.id || extras.work_order_id || extras.workOrderId);
    const vendorEmail = str(vendor.email || extras.vendor_email || extras.vendorEmail || workOrder.assigned_vendor_email);
    const vendorName = str(vendor.name || extras.vendor_name || extras.vendorName || workOrder.assigned_vendor_name);

    if(!workOrderId) throw new Error("Missing work order id for vendor email.");
    if(!vendorEmail) throw new Error("Vendor email is required.");

    return invokeFunction("assign-vendor-email", Object.assign({}, extras, {
      work_order_id: workOrderId,
      workOrderId,
      vendor_email: vendorEmail,
      vendor_name: vendorName,
      community_id: workOrder.community_id || extras.community_id || getSelectedCommunityId(),
      resident_name: workOrder.resident_name || extras.resident_name || "",
      resident_email: workOrder.resident_email || extras.resident_email || "",
      resident_phone: workOrder.resident_phone || extras.resident_phone || "",
      unit_number: workOrder.unit_number || extras.unit_number || "",
      subject: workOrder.subject || workOrder.title || extras.subject || "Resident Work Order",
      description: workOrder.description || extras.description || "",
      priority: workOrder.priority || extras.priority || "normal",
      status: "sent_to_vendor"
    }));
  }

  async function routeWorkOrderToVendor(workOrder, vendor, extras={}){
    const updated = await updateWorkOrder(workOrder.id, {
      status: "vendor_email_pending",
      assigned_vendor_name: vendor.name || null,
      assigned_vendor_email: vendor.email || null,
      vendor_email_status: "pending",
      vendor_email_error: null,
      updated_at: new Date().toISOString()
    });
    return sendWorkOrderToVendor(Object.assign({}, workOrder, updated), vendor, extras);
  }

  function digestWorkOrders(rows){
    return (rows || []).map(r => [
      r.id || "",
      normalizeStatus(r),
      r.updated_at || "",
      r.vendor_email_status || "",
      r.assigned_vendor_name || "",
      r.assigned_vendor_email || ""
    ].join(":")).join("|");
  }

  function subscribeToWorkOrders(communityId, callback, options={}){
    communityId = str(communityId || getSelectedCommunityId());
    if(!communityId || typeof callback !== "function") return { unsubscribe(){} };

    let stopped = false;
    let timer = null;
    let channel = null;
    let lastDigest = "";

    async function refresh(reason, force=false){
      if(stopped) return;
      if(document.hidden && !force && options.pauseWhenHidden !== false) return;
      try{
        const rows = await getWorkOrdersForCommunity(communityId, { limit: options.limit || 500 });
        const digest = digestWorkOrders(rows);
        if(force || digest !== lastDigest){
          lastDigest = digest;
          callback(rows, { reason: reason || "refresh" });
        }
      }catch(err){
        if(options.onError) options.onError(err);
        else console.warn("[ZummeeMaintenanceData] work order refresh failed:", err);
      }
    }

    async function startRealtime(){
      try{
        const c = await getClient();
        if(!c || typeof c.channel !== "function") return;
        channel = c.channel("zummee_maintenance_work_orders_" + communityId.replace(/[^a-z0-9]/gi,"_"))
          .on("postgres_changes", { event:"*", schema:"public", table:"resident_work_orders" }, (payload) => {
            const row = payload?.new || payload?.old || {};
            const rowCid = str(row.community_id);
            if(!rowCid || rowCid === communityId) refresh("realtime", true);
          })
          .subscribe();
      }catch(err){
        console.warn("[ZummeeMaintenanceData] realtime skipped:", err);
      }
    }

    refresh("initial", true);
    startRealtime();

    timer = setInterval(() => refresh("poll"), options.intervalMs || 4000);
    const onFocus = () => refresh("focus", true);
    const onVisible = () => { if(!document.hidden) refresh("visible", true); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return {
      refresh: () => refresh("manual", true),
      unsubscribe(){
        stopped = true;
        if(timer) clearInterval(timer);
        window.removeEventListener("focus", onFocus);
        document.removeEventListener("visibilitychange", onVisible);
        try{ if(channel?.unsubscribe) channel.unsubscribe(); }catch(_e){}
      }
    };
  }

  window.ZummeeMaintenanceData = {
    version: VERSION,
    rest,
    getClient,
    getAccessToken,
    getSelectedCommunityId,
    setSelectedCommunity,
    getVendorsForCommunity,
    getWorkOrdersForCommunity,
    createWorkOrder,
    updateWorkOrder,
    invokeFunction,
    sendWorkOrderToVendor,
    routeWorkOrderToVendor,
    subscribeToWorkOrders,
    normalizeVendor,
    normalizeStatus,
    clearVendorCache(){ vendorCache.clear(); }
  };
})();
