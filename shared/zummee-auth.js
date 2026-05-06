(function(){
  'use strict';
  var VERSION = 'v486-login-resource-auth-lock';
  var SUPABASE_URL = window.SUPABASE_URL || 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  var PROJECT_REF = 'slcwuuwyrgnmlmxpcaim';
  var STORAGE_KEY = 'sb-zummee-auth';
  var JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
  var inflightAuth = null;

  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function parseJson(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(_e){ return null; } }
  function isClient(c){ return !!(c && typeof c.from === 'function' && c.auth); }
  function getDeep(obj, names, seen){
    seen = seen || [];
    if(!obj || typeof obj !== 'object') return '';
    if(seen.indexOf(obj) !== -1) return '';
    seen.push(obj);
    for(var i=0;i<names.length;i++){
      var k = names[i];
      if(typeof obj[k] === 'string' && obj[k]) return String(obj[k]).trim();
    }
    var keys = Object.keys(obj);
    for(var j=0;j<keys.length;j++){
      var v = obj[keys[j]];
      if(v && typeof v === 'object'){
        var hit = getDeep(v, names, seen);
        if(hit) return hit;
      }
    }
    return '';
  }
  function tokenFromRaw(raw, obj){
    if(raw && typeof raw === 'string'){
      var m = raw.match(JWT_RE);
      if(m && m[0]) return m[0];
    }
    if(!obj || typeof obj !== 'object') return '';
    return String(
      obj.access_token || obj.accessToken ||
      (obj.currentSession && obj.currentSession.access_token) ||
      (obj.session && obj.session.access_token) ||
      (obj.data && obj.data.session && obj.data.session.access_token) ||
      getDeep(obj, ['access_token','accessToken']) || ''
    ).trim();
  }
  function refreshFromObj(obj){
    if(!obj || typeof obj !== 'object') return '';
    return String(
      obj.refresh_token || obj.refreshToken ||
      (obj.currentSession && obj.currentSession.refresh_token) ||
      (obj.session && obj.session.refresh_token) ||
      (obj.data && obj.data.session && obj.data.session.refresh_token) ||
      getDeep(obj, ['refresh_token','refreshToken']) || ''
    ).trim();
  }
  function userFromObj(obj){
    if(!obj || typeof obj !== 'object') return null;
    return obj.user || (obj.currentSession && obj.currentSession.user) || (obj.session && obj.session.user) || (obj.data && obj.data.session && obj.data.session.user) || null;
  }
  function allKeys(){
    var keys = [
      STORAGE_KEY,
      'sb-' + PROJECT_REF + '-auth-token',
      'sb_access_token','sb_refresh_token','zummee_sb_access_token','zummee_sb_refresh_token',
      'supabase.auth.token','zummee_supabase_session','zummee_auth','zummeeAuth','ZUMMEE_AUTH','currentUser','zummeeCurrentUser'
    ];
    try{ for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k && keys.indexOf(k) < 0) keys.push(k); } }catch(_e){}
    try{ for(var j=0;j<sessionStorage.length;j++){ var ks=sessionStorage.key(j); if(ks && keys.indexOf(ks) < 0) keys.push(ks); } }catch(_e){}
    return keys;
  }
  function readStore(key){
    var raw = null, where = '';
    try{ raw = localStorage.getItem(key); if(raw != null) where = 'localStorage'; }catch(_e){}
    if(raw == null){ try{ raw = sessionStorage.getItem(key); if(raw != null) where = 'sessionStorage'; }catch(_e2){} }
    if(raw == null) return null;
    var obj = parseJson(raw);
    var access = tokenFromRaw(raw, obj);
    var refresh = refreshFromObj(obj);
    return access ? { key:key, where:where, raw:raw, obj:obj, access_token:access, refresh_token:refresh, user:userFromObj(obj) } : null;
  }
  function findStoredToken(){
    var keys = allKeys();
    for(var i=0;i<keys.length;i++){
      var hit = readStore(keys[i]);
      if(hit && hit.access_token) return hit;
    }
    return null;
  }
  function persistSession(session){
    if(!session || !session.access_token) return;
    try{
      if(session.refresh_token){
        localStorage.setItem('sb_refresh_token', session.refresh_token);
        localStorage.setItem('zummee_sb_refresh_token', session.refresh_token);
        sessionStorage.setItem('sb_refresh_token', session.refresh_token);
      }
      localStorage.setItem('sb_access_token', session.access_token);
      localStorage.setItem('zummee_sb_access_token', session.access_token);
      sessionStorage.setItem('sb_access_token', session.access_token);
      var payload = { currentSession:session, session:session, access_token:session.access_token, refresh_token:session.refresh_token || '', user:session.user || null, expires_at:session.expires_at || null, saved_at:new Date().toISOString(), version:VERSION };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem('sb-' + PROJECT_REF + '-auth-token', JSON.stringify(payload));
      window.zummeeSession = session;
    }catch(_e){}
  }
  async function getClient(){
    var c = null;
    try{ if(typeof window.ensureSupabase === 'function') c = await window.ensureSupabase(); }catch(_e){}
    if(isClient(c)) return c;
    try{ if(typeof window.ensureSupabaseSync === 'function') c = window.ensureSupabaseSync(); }catch(_e2){}
    if(isClient(c)) return c;
    if(isClient(window.supabaseClient)) return window.supabaseClient;
    if(isClient(window.sb)) return window.sb;
    try{
      if(window.supabase && typeof window.supabase.createClient === 'function'){
        c = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth:{ storageKey:STORAGE_KEY, storage:window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
        window.supabaseClient = c; window.sb = c;
        return c;
      }
    }catch(_e3){}
    return null;
  }
  async function nativeSession(){
    var c = await getClient();
    if(!isClient(c) || !c.auth || typeof c.auth.getSession !== 'function') return null;
    try{
      var res = await Promise.race([c.auth.getSession(), new Promise(function(resolve){ setTimeout(function(){ resolve({data:{session:null}, error:new Error('getSession timeout')}); }, 3500); })]);
      var s = res && res.data && res.data.session;
      if(s && s.access_token){ persistSession(s); return s; }
    }catch(_e){}
    return null;
  }
  async function hydrateNative(access, refresh){
    if(!access || !refresh) return null;
    var c = await getClient();
    if(!isClient(c) || !c.auth || typeof c.auth.setSession !== 'function') return null;
    try{
      var res = await c.auth.setSession({ access_token:String(access), refresh_token:String(refresh) });
      var s = res && res.data && res.data.session;
      if(s && s.access_token){ persistSession(s); return s; }
    }catch(e){ console.warn('[ZummeeAuth '+VERSION+'] setSession failed', e); }
    return null;
  }
  async function refreshStored(hit){
    if(!hit || !hit.refresh_token) return null;
    try{
      var res = await fetch(SUPABASE_URL.replace(/\/$/,'') + '/auth/v1/token?grant_type=refresh_token', {
        method:'POST',
        headers:{ 'apikey':SUPABASE_ANON_KEY, 'Content-Type':'application/json' },
        body:JSON.stringify({ refresh_token:hit.refresh_token })
      });
      var body = await res.json().catch(function(){ return null; });
      if(res.ok && body && body.access_token){ persistSession(body); return body; }
    }catch(e){ console.warn('[ZummeeAuth '+VERSION+'] refresh failed', e); }
    return null;
  }
  async function getAccessToken(opts){
    opts = opts || {};
    var s = await nativeSession();
    if(s && s.access_token){ window.ZummeeAuth.lastTokenSource = 'native-session'; return s.access_token; }
    var hit = findStoredToken();
    if(hit && hit.access_token){
      window.ZummeeAuth.lastTokenSource = hit.where + ':' + hit.key;
      if(hit.refresh_token) hydrateNative(hit.access_token, hit.refresh_token);
      return hit.access_token;
    }
    if(hit && hit.refresh_token){
      var refreshed = await refreshStored(hit);
      if(refreshed && refreshed.access_token){ window.ZummeeAuth.lastTokenSource = 'refresh:' + hit.key; return refreshed.access_token; }
    }
    window.ZummeeAuth.lastTokenSource = 'none';
    return '';
  }
  async function requireAuth(opts){
    opts = opts || {};
    if(inflightAuth) return inflightAuth;
    inflightAuth = (async function(){
      var token = await getAccessToken(opts);
      var session = await nativeSession();
      var client = await getClient();
      var user = (session && session.user) || null;
      if(!user){ var hit = findStoredToken(); if(hit && hit.user) user = hit.user; }
      var result = { client:client, accessToken:token || '', session:session || null, user:user || null, tokenSource:window.ZummeeAuth.lastTokenSource || 'none', version:VERSION };
      if(opts.redirect && !result.accessToken){ window.location.replace(opts.loginUrl || 'login.html'); }
      return result;
    })().finally(function(){ inflightAuth = null; });
    return inflightAuth;
  }
  async function fetchRest(path, opts){
    opts = opts || {};
    var auth = await requireAuth({ redirect:!!opts.redirect });
    if(!auth || !auth.accessToken){ var err = new Error('No Supabase access token available'); err.status = 401; throw err; }
    var clean = String(path || '').replace(/^\/+/, '');
    var url = clean.indexOf('http') === 0 ? clean : SUPABASE_URL.replace(/\/$/,'') + '/rest/v1/' + clean;
    var headers = Object.assign({ 'apikey':SUPABASE_ANON_KEY, 'Authorization':'Bearer ' + auth.accessToken, 'Content-Type':'application/json' }, opts.headers || {});
    var res = await fetch(url, Object.assign({}, opts, { headers:headers }));
    var raw = await res.text();
    var parsed; try{ parsed = raw ? JSON.parse(raw) : null; }catch(_e){ parsed = raw; }
    if(!res.ok){ var e = new Error((parsed && (parsed.message || parsed.error_description || parsed.error)) || raw || ('HTTP ' + res.status)); e.status = res.status; e.details = parsed; throw e; }
    return parsed;
  }
  async function debug(){
    var s = await nativeSession();
    var hit = findStoredToken();
    return { version:VERSION, nativeSession:!!s, userId:s && s.user && s.user.id || null, storedToken:!!(hit && hit.access_token), storedKey:hit && hit.key || '', tokenSource:window.ZummeeAuth.lastTokenSource || 'none', fetchRest:typeof fetchRest };
  }

  window.ZummeeAuth = {
    version:VERSION,
    getClient:getClient,
    nativeSession:nativeSession,
    hydrateNative:hydrateNative,
    getAccessToken:getAccessToken,
    requireAuth:requireAuth,
    requireSession:async function(opts){ var a = await requireAuth(opts || {}); return a.session; },
    rest:fetchRest,
    fetchRest:fetchRest,
    persistSession:persistSession,
    refreshSession:async function(){ var hit=findStoredToken(); return refreshStored(hit); },
    debug:debug,
    lastTokenSource:'none'
  };

  try{ window.dispatchEvent(new CustomEvent('zummee-auth-ready', { detail:{ version:VERSION } })); }catch(_e){}
})();
