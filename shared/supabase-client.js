/* Zummee canonical Supabase boot v325 - persistent session restore */
(function(){
  var URL = window.SUPABASE_URL || 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var KEY = window.SUPABASE_ANON_KEY || window.SUPABASE_KEY || 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  window.SUPABASE_URL = URL;
  window.SUPABASE_ANON_KEY = KEY;
  window.SUPABASE_KEY = KEY;

  var STORAGE_KEY = 'sb-zummee-auth';
  var VERSION = 'v327-force-iframe-session';
  var restorePromise = null;

  function has(c){ return !!(c && typeof c.from === 'function' && c.auth); }

  function make(){
    if(has(window.supabaseClient)) return window.supabaseClient;
    if(has(window.sb)){ window.supabaseClient = window.sb; return window.sb; }
    if(window.supabase && typeof window.supabase.createClient === 'function'){
      var c = window.supabase.createClient(URL, KEY, {
        auth: {
          storageKey: STORAGE_KEY,
          storage: window.localStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      window.supabaseClient = c;
      window.sb = c;
      return c;
    }
    return null;
  }

  function readStoredTokens(){
    try{
      var at = localStorage.getItem('sb_access_token') || localStorage.getItem('zummee_sb_access_token') || sessionStorage.getItem('sb_access_token') || '';
      var rt = localStorage.getItem('sb_refresh_token') || localStorage.getItem('zummee_sb_refresh_token') || sessionStorage.getItem('sb_refresh_token') || '';
      if(at && rt) return { access_token: at, refresh_token: rt };
    }catch(_e){}

    try{
      var raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        var parsed = JSON.parse(raw);
        var session = parsed && (parsed.currentSession || parsed.session || parsed);
        if(session && session.access_token && session.refresh_token){
          return { access_token: session.access_token, refresh_token: session.refresh_token };
        }
      }
    }catch(_e2){}

    try{
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i);
        if(!k || k.indexOf('auth-token') === -1) continue;
        var raw2 = localStorage.getItem(k);
        if(!raw2) continue;
        var p = JSON.parse(raw2);
        var s = p && (p.currentSession || p.session || p);
        if(s && s.access_token && s.refresh_token){
          return { access_token: s.access_token, refresh_token: s.refresh_token };
        }
      }
    }catch(_e3){}
    return null;
  }

  function persistSession(session){
    if(!session || !session.access_token || !session.refresh_token) return;
    try{
      localStorage.setItem('sb_access_token', session.access_token);
      localStorage.setItem('sb_refresh_token', session.refresh_token);
      localStorage.setItem('zummee_sb_access_token', session.access_token);
      localStorage.setItem('zummee_sb_refresh_token', session.refresh_token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ currentSession: session, session: session, access_token: session.access_token, refresh_token: session.refresh_token, user: session.user || null, expiresAt: session.expires_at || null }));
      sessionStorage.setItem('sb_access_token', session.access_token);
      sessionStorage.setItem('sb_refresh_token', session.refresh_token);
    }catch(_e){}
  }

  async function restoreSession(client){
    if(!has(client)) return null;
    try{
      var cur = await client.auth.getSession();
      var existing = cur && cur.data && cur.data.session;
      if(existing){ persistSession(existing); return existing; }
    }catch(_e){}

    var tokens = readStoredTokens();
    if(!tokens || !tokens.access_token || !tokens.refresh_token){
      console.warn('[Zummee supabase-client] no stored Supabase tokens to restore');
      return null;
    }

    try{
      var res = await client.auth.setSession(tokens);
      var session = res && res.data && res.data.session;
      if(session){
        persistSession(session);
        console.log('[Zummee supabase-client] session restored from stored tokens');
        return session;
      }
      if(res && res.error) console.warn('[Zummee supabase-client] setSession failed', res.error);
    }catch(e){
      console.warn('[Zummee supabase-client] session restore error', e);
    }
    return null;
  }

  window.ZUMMEE_SUPABASE_CLIENT_VERSION = VERSION;
  window.ensureSupabaseSync = function(){ return make(); };
  window.zummeePersistSupabaseSession = persistSession;
  window.zummeeRestoreSupabaseSession = function(){
    var c = make();
    if(!restorePromise) restorePromise = restoreSession(c).finally(function(){ restorePromise = null; });
    return restorePromise;
  };

  window.ensureSupabase = async function(){
    var c = make();
    var start = Date.now();
    while(!c && Date.now()-start < 5000){
      await new Promise(function(r){ setTimeout(r,50); });
      c = make();
    }
    if(!c){ console.warn('[Zummee supabase-client] unavailable'); return null; }
    await window.zummeeRestoreSupabaseSession();
    return c;
  };
  window.getSupabase = function(){ return make(); };

  var initial = make();
  if(initial){ window.zummeeRestoreSupabaseSession(); }
})();
