/* Zummee canonical Supabase boot v500 - production auth foundation */
(function(){
  'use strict';
  var URL = window.SUPABASE_URL || 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var KEY = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  var PROJECT_REF = 'slcwuuwyrgnmlmxpcaim';
  var STORAGE_KEY = 'sb-zummee-auth';
  var VERSION = 'v500-production-auth-foundation';
  var client = null;
  var restorePromise = null;

  window.SUPABASE_URL = URL;
  window.SUPABASE_ANON_KEY = KEY;
  window.SUPABASE_KEY = KEY;
  window.ZUMMEE_SUPABASE_CLIENT_VERSION = VERSION;

  function isClient(c){ return !!(c && typeof c.from === 'function' && c.auth && typeof c.auth.getSession === 'function'); }
  function parse(raw){ try{ return raw ? JSON.parse(raw) : null; }catch(_e){ return null; } }
  function safeGet(store, key){ try{ return store.getItem(key); }catch(_e){ return null; } }
  function safeSet(store, key, val){ try{ store.setItem(key, val); }catch(_e){} }

  function sessionFromObject(obj){
    if(!obj || typeof obj !== 'object') return null;
    var s = obj.currentSession || obj.session || (obj.data && obj.data.session) || obj;
    if(s && s.access_token) return s;
    return null;
  }

  function collectAuthKeys(){
    var keys = [
      STORAGE_KEY,
      'sb-' + PROJECT_REF + '-auth-token',
      'supabase.auth.token',
      'zummee_supabase_session',
      'sb_access_token',
      'zummee_sb_access_token'
    ];
    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(k && keys.indexOf(k) === -1 && (k.indexOf('sb-') === 0 || k.indexOf('supabase') !== -1 || k.indexOf('zummee') !== -1)) keys.push(k);
      }
    }catch(_e){}
    try{
      for(var j=0;j<sessionStorage.length;j++){
        var ks = sessionStorage.key(j);
        if(ks && keys.indexOf(ks) === -1 && (ks.indexOf('sb-') === 0 || ks.indexOf('supabase') !== -1 || ks.indexOf('zummee') !== -1)) keys.push(ks);
      }
    }catch(_e2){}
    return keys;
  }

  function readStoredSession(){
    var stores = [];
    try{ stores.push(localStorage); }catch(_e){}
    try{ stores.push(sessionStorage); }catch(_e2){}
    var keys = collectAuthKeys();

    for(var sIdx=0; sIdx<stores.length; sIdx++){
      var store = stores[sIdx];
      for(var i=0;i<keys.length;i++){
        var key = keys[i];
        var raw = safeGet(store, key);
        if(!raw) continue;
        var obj = parse(raw);
        var sess = sessionFromObject(obj);
        if(sess && sess.access_token && sess.refresh_token) return sess;
      }
    }

    var access = '';
    var refresh = '';
    try{ access = localStorage.getItem('sb_access_token') || localStorage.getItem('zummee_sb_access_token') || sessionStorage.getItem('sb_access_token') || ''; }catch(_e3){}
    try{ refresh = localStorage.getItem('sb_refresh_token') || localStorage.getItem('zummee_sb_refresh_token') || sessionStorage.getItem('sb_refresh_token') || ''; }catch(_e4){}
    if(access && refresh) return { access_token:access, refresh_token:refresh };
    return null;
  }

  function persistSession(session){
    if(!session || !session.access_token) return;
    var payload = JSON.stringify({
      currentSession: session,
      session: session,
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      user: session.user || null,
      expires_at: session.expires_at || null,
      saved_at: new Date().toISOString(),
      version: VERSION
    });
    safeSet(localStorage, STORAGE_KEY, payload);
    safeSet(localStorage, 'sb-' + PROJECT_REF + '-auth-token', payload);
    safeSet(localStorage, 'zummee_supabase_session', payload);
    safeSet(localStorage, 'sb_access_token', session.access_token || '');
    safeSet(localStorage, 'zummee_sb_access_token', session.access_token || '');
    safeSet(sessionStorage, 'sb_access_token', session.access_token || '');
    if(session.refresh_token){
      safeSet(localStorage, 'sb_refresh_token', session.refresh_token || '');
      safeSet(localStorage, 'zummee_sb_refresh_token', session.refresh_token || '');
      safeSet(sessionStorage, 'sb_refresh_token', session.refresh_token || '');
    }
    if(session.user && session.user.id){
      safeSet(localStorage, 'zummee_user_id_v1', session.user.id);
      safeSet(sessionStorage, 'zummee_user_id_v1', session.user.id);
      var legacy = { userId: session.user.id, email: session.user.email || '', name: (session.user.user_metadata && (session.user.user_metadata.name || session.user.user_metadata.full_name)) || '' };
      safeSet(localStorage, 'zummee_session_v1', JSON.stringify(legacy));
      safeSet(sessionStorage, 'zummee_session_v1', JSON.stringify(legacy));
    }
    window.zummeeSession = session;
  }

  function makeClient(){
    if(isClient(client)) return client;
    if(isClient(window.supabaseClient)){ client = window.supabaseClient; window.sb = client; return client; }
    if(isClient(window.sb)){ client = window.sb; window.supabaseClient = client; return client; }
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      client = window.supabase.createClient(URL, KEY, {
        auth: {
          storageKey: STORAGE_KEY,
          storage: window.localStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      });
      window.supabaseClient = client;
      window.sb = client;
      try{
        client.auth.onAuthStateChange(function(_event, session){ if(session) persistSession(session); });
      }catch(_e){}
      return client;
    }
    return null;
  }

  async function refreshWithToken(refreshToken){
    if(!refreshToken) return null;
    try{
      var res = await fetch(URL.replace(/\/$/,'') + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      var body = await res.json().catch(function(){ return null; });
      if(res.ok && body && body.access_token){ persistSession(body); return body; }
    }catch(e){ console.warn('[Zummee auth '+VERSION+'] refresh token restore failed', e); }
    return null;
  }

  async function restoreSession(){
    var c = makeClient();
    if(!isClient(c)) return null;

    try{
      var existing = await c.auth.getSession();
      var s = existing && existing.data && existing.data.session;
      if(s && s.access_token){ persistSession(s); return s; }
    }catch(_e){}

    var stored = readStoredSession();
    if(stored && stored.access_token && stored.refresh_token){
      try{
        var set = await c.auth.setSession({ access_token: stored.access_token, refresh_token: stored.refresh_token });
        var ss = set && set.data && set.data.session;
        if(ss && ss.access_token){ persistSession(ss); return ss; }
      }catch(e){ console.warn('[Zummee auth '+VERSION+'] setSession restore failed', e); }
      var refreshed = await refreshWithToken(stored.refresh_token);
      if(refreshed && refreshed.access_token){
        try{
          var set2 = await c.auth.setSession({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token });
          var ss2 = set2 && set2.data && set2.data.session;
          if(ss2 && ss2.access_token){ persistSession(ss2); return ss2; }
        }catch(_e2){}
      }
    }
    return null;
  }

  async function ensureSupabase(){
    var c = makeClient();
    var start = Date.now();
    while(!isClient(c) && Date.now() - start < 5000){
      await new Promise(function(r){ setTimeout(r, 50); });
      c = makeClient();
    }
    if(!isClient(c)){ console.warn('[Zummee auth '+VERSION+'] Supabase client unavailable'); return null; }
    if(!restorePromise){ restorePromise = restoreSession().finally(function(){ restorePromise = null; }); }
    await restorePromise;
    return c;
  }

  async function requireSupabaseSession(opts){
    opts = opts || {};
    var c = await ensureSupabase();
    if(!isClient(c)) return null;
    var session = await restoreSession();
    if(!session && opts.redirect !== false){
      var target = opts.loginUrl || 'login.html';
      try{ window.location.replace(target); }catch(_e){ window.location.href = target; }
      return null;
    }
    return session;
  }

  async function getZummeeUserId(opts){
    var s = await requireSupabaseSession(Object.assign({ redirect:false }, opts || {}));
    return s && s.user && s.user.id ? String(s.user.id) : '';
  }

  window.ensureSupabaseSync = makeClient;
  window.ensureSupabase = ensureSupabase;
  window.getSupabase = makeClient;
  window.zummeePersistSupabaseSession = persistSession;
  window.zummeeRestoreSupabaseSession = function(){
    if(!restorePromise){ restorePromise = restoreSession().finally(function(){ restorePromise = null; }); }
    return restorePromise;
  };
  window.zummeeRequireSupabaseSession = requireSupabaseSession;
  window.zummeeGetAuthUserId = getZummeeUserId;

  var initial = makeClient();
  if(initial){ window.zummeeRestoreSupabaseSession(); }
})();
