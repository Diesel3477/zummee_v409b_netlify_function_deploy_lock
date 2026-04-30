
/* v87 Manager Hub sign-out hardening: real logout + login redirect */
(function(){
  if (window.__MH2_SIGNOUT_HARDENED_V87__) return;
  window.__MH2_SIGNOUT_HARDENED_V87__ = true;
  function getSb(){
    try{
      if (window.sb && window.sb.auth && typeof window.sb.auth.signOut === 'function') return window.sb;
      if (window.supabaseClient && window.supabaseClient.auth && typeof window.supabaseClient.auth.signOut === 'function') return window.supabaseClient;
      if (typeof window.ensureSupabaseSync === 'function'){
        var c = window.ensureSupabaseSync();
        if (c && c.auth && typeof c.auth.signOut === 'function') return c;
      }
    }catch(_e){}
    return null;
  }
  function clearZummeeSessionHints(){
    var keepPrefixes = ['mh2-theme','mh2-favorite','mh2-card-order','mh2-weather-zip:','mh2-last-weather-zip'];
    var removeExact = {'sb-zummee-auth':1,'sb-slcwuuwyrgnmlmxpcaim-auth-token':1,'zummeeAuth':1,'zummee_user':1,'ZUMMEE_AUTH':1,'zummeeCurrentUser':1,'zummeeCurrentProfile':1,'currentUser':1,'currentProfile':1};
    try{
      for (var i = localStorage.length - 1; i >= 0; i--){
        var k = localStorage.key(i) || '';
        var keep = keepPrefixes.some(function(prefix){ return k === prefix || k.indexOf(prefix) === 0; });
        if (keep) continue;
        var lk = k.toLowerCase();
        if (removeExact[k] || k.indexOf('supabase.auth.token') >= 0 || k.indexOf('sb-') === 0 || lk.indexOf('auth') >= 0){
          try{ localStorage.removeItem(k); }catch(_e){}
        }
      }
    }catch(_e){}
    try{ sessionStorage.clear(); }catch(_e){}
  }
  function showZummeeSignOutConfirm(){
    return new Promise(function(resolve){
      var overlay = document.getElementById('mh2SignOutModalOverlay');
      try{ if (overlay) overlay.remove(); }catch(_e){}
      overlay = document.createElement('div');
      overlay.id = 'mh2SignOutModalOverlay';
      overlay.className = 'mh2-signout-modal-overlay';
      overlay.innerHTML = '<div class="mh2-signout-modal" role="dialog" aria-modal="true" aria-labelledby="mh2SignOutTitle"><div class="mh2-signout-modal-kicker">Zummee</div><h2 id="mh2SignOutTitle">Sign out?</h2><p>Are you sure you want to sign out of the Manager Hub?</p><div class="mh2-signout-modal-actions"><button type="button" class="mh2-signout-cancel">Cancel</button><button type="button" class="mh2-signout-confirm">Sign out</button></div></div>';
      document.body.appendChild(overlay);
      var cancel = overlay.querySelector('.mh2-signout-cancel');
      var confirm = overlay.querySelector('.mh2-signout-confirm');
      function close(val){
        try{ document.removeEventListener('keydown', onKey, true); }catch(_e){}
        try{ overlay.classList.add('closing'); setTimeout(function(){ overlay.remove(); }, 120); }catch(_e){ try{ overlay.remove(); }catch(_e2){} }
        resolve(!!val);
      }
      function onKey(e){ if(e && e.key === 'Escape'){ e.preventDefault(); close(false); } }
      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('click', function(e){ if(e.target === overlay) close(false); });
      cancel.addEventListener('click', function(){ close(false); });
      confirm.addEventListener('click', function(){ close(true); });
      setTimeout(function(){ try{ confirm.focus(); }catch(_e){} }, 40);
    });
  }
  async function performManagerHubSignOut(evt){
    try{ if(evt){ evt.preventDefault(); evt.stopPropagation(); if(evt.stopImmediatePropagation) evt.stopImmediatePropagation(); } }catch(_e){}
    var ok = await showZummeeSignOutConfirm();
    if (!ok) return false;
    var btn = document.getElementById('mh2SignOutBtn');
    try{ if(btn){ btn.disabled = true; btn.textContent = 'Signing out...'; btn.setAttribute('aria-busy','true'); } }catch(_e){}
    try{
      var sb = getSb();
      if (sb && sb.auth && typeof sb.auth.signOut === 'function') await sb.auth.signOut({ scope:'global' });
    }catch(err){ try{ console.warn('[MH2] Supabase signOut warning', err); }catch(_e){} }
    clearZummeeSessionHints();
    var dest = 'login.html?logged_out=1&t=' + Date.now();
    try{ window.__ZUMMEE_SIGNING_OUT__ = true; }catch(_e){}
    try{ window.location.replace(dest); }catch(_e){ try{ window.location.href = dest; }catch(_e2){} }
    setTimeout(function(){ try{ window.location.assign(dest); }catch(_e){} }, 150);
    setTimeout(function(){ try{ window.top.location.href = dest; }catch(_e){} }, 500);
    return false;
  }
  window.zummeeManagerHubSignOut = performManagerHubSignOut;
  window.zummeePerformSignOut = performManagerHubSignOut;
  function wire(){
    var btn = document.getElementById('mh2SignOutBtn');
    if (!btn) return;
    btn.setAttribute('type','button');
    btn.onclick = performManagerHubSignOut;
    if (btn.dataset.signoutV85 === '1') return;
    btn.dataset.signoutV85 = '1';
    btn.addEventListener('click', performManagerHubSignOut, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  window.addEventListener('load', wire);
  document.addEventListener('click', function(evt){
    var target = evt.target && evt.target.closest ? evt.target.closest('#mh2SignOutBtn') : null;
    if (target) performManagerHubSignOut(evt);
  }, true);
})();
