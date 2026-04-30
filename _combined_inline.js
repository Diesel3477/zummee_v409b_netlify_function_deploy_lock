
// v840: ensureSupabase Promise shim (clean)
function ensureSupabaseSync(){
  try{
    // Prefer the actual Supabase client (has .from). Some builds expose the library as window.supabase (has createClient only).
    if(window.sb && typeof window.sb.from === 'function') return window.sb;
    if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
    if(window.supabase && typeof window.supabase.from === 'function') return window.supabase;
    if(typeof getSupabaseClientSafe === 'function'){
      var c = getSupabaseClientSafe();
      if(c && typeof c.from === 'function') return c;
    }
  }catch(e){}
  return null;
}
function ensureSupabase(){
  return new Promise(function(resolve){
    var c = ensureSupabaseSync();
    if(c) return resolve(c);
    var start = Date.now();
    var t = setInterval(function(){
      var cc = ensureSupabaseSync();
      if(cc){
        clearInterval(t);
        resolve(cc);
      } else if(Date.now() - start > 4000){
        clearInterval(t);
        resolve(null);
      }
    }, 50);
  });
}

// v864: Create company helper (used by Admin-only Create Company UI)
// Keeps DB source-of-truth in `Companies` and updates local activeCompanyId.
window.createCompanyAndSwitch = window.createCompanyAndSwitch || (async function(name){
  var sb = await ensureSupabase();
  if(!sb) throw new Error('Supabase client not ready');
  var companyName = String(name||'').trim();
  if(!companyName) throw new Error('Please enter a company name');

  // Insert new company
  var ins = await sb
    .from('Companies')
    .insert([{ name: companyName }])
    .select('id,name')
    .maybeSingle();
  if(ins && ins.error) throw ins.error;
  var row = ins && ins.data ? ins.data : null;
  if(!row || !row.id) throw new Error('Create company failed');

  try{
    localStorage.setItem('activeCompanyId', row.id);
    localStorage.setItem('activeCompanyName', row.name || companyName);
    // When Admin is creating, switch to the new company; scope stays caller-controlled.
    if(localStorage.getItem('activeCompanyScope') === null){
      localStorage.setItem('activeCompanyScope', 'ONE');
    }
  }catch(_e){}

  try{ window.activeCompanyId = row.id; }catch(_e){}
  try{ window.__activeCompanyId = row.id; }catch(_e){}

  return row;
});

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }





/* v789: toast fallback (prevents ReferenceError if core toast not loaded yet)
   Updated: Use Zummee-style toast instead of browser alert. */
if(typeof window.toast !== 'function'){
  (function(){
    function ensureToastStyles(){
      if(document.getElementById('zm_toast_styles')) return;
      var st = document.createElement('style');
      st.id = 'zm_toast_styles';
      st.textContent = "\
#zm_toast_wrap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:1000001;display:flex;flex-direction:column;gap:10px;align-items:center;pointer-events:none;}\
.zm_toast{min-width:240px;max-width:min(560px,92vw);background:#0f2f4a;color:#fff;border-radius:18px;box-shadow:0 16px 50px rgba(0,0,0,.35);padding:14px 16px;display:flex;align-items:center;gap:12px;opacity:0;transform:translateY(8px) scale(.98);transition:opacity .18s ease, transform .18s ease;}\
.zm_toast.show{opacity:1;transform:translateY(0) scale(1);}\
.zm_toast .dot{width:10px;height:10px;border-radius:50%;background:#98ffb3;box-shadow:0 0 0 4px rgba(152,255,179,.12);}\
.zm_toast .msg{font-weight:800;letter-spacing:.2px;}\
.zm_toast .sub{font-weight:600;opacity:.86;margin-top:2px;font-size:12px;}\
@media(max-width:520px){#zm_toast_wrap{bottom:14px;} .zm_toast{border-radius:16px;padding:12px 14px;}}\
";
      document.head.appendChild(st);
    }
    function ensureWrap(){
      var w = document.getElementById('zm_toast_wrap');
      if(w) return w;
      w = document.createElement('div');
      w.id = 'zm_toast_wrap';
      document.body.appendChild(w);
      return w;
    }
    function buildToast(text){
      var el = document.createElement('div');
      el.className = 'zm_toast';
      var dot = document.createElement('div');
      dot.className = 'dot';
      var box = document.createElement('div');
      var msg = document.createElement('div');
      msg.className = 'msg';
      msg.textContent = String(text || 'Done');
      box.appendChild(msg);
      el.appendChild(dot);
      el.appendChild(box);
      return el;
    }
    window.toast = function(msg){
      try{ console.log('[toast]', msg); }catch(_e){}
      try{
        ensureToastStyles();
        var wrap = ensureWrap();
        var t = buildToast(msg);
        wrap.appendChild(t);
        // animate in
        setTimeout(function(){ try{ t.classList.add('show'); }catch(_e){} }, 10);
        // auto-remove
        setTimeout(function(){
          try{ t.classList.remove('show'); }catch(_e){}
          setTimeout(function(){ try{ t.remove(); }catch(_e){} }, 200);
        }, 1800);
      }catch(e){
        // last resort (should be rare)
        try{ alert(String(msg||'')); }catch(_e){}
      }
    };
  })();
}
/* v694: Guard additional cloud-sync renderer (avoid ReferenceError) */
(function(){
  // v745: init token + syncing guard for race-free company switching
  if(typeof window.__ccLoadToken !== 'number' || !isFinite(window.__ccLoadToken)) window.__ccLoadToken = 0;
  if(typeof window.__ccSyncing !== 'boolean') window.__ccSyncing = false;
  if(typeof window.renderCompanyCommunities !== "function"){
    window.renderCompanyCommunities = function(){ /* no-op */ };
    try{ window.eval('var renderCompanyCommunities = window.renderCompanyCommunities;'); }catch(_e){}
  }
/* v820: Guard Employee Management renderer (prevents ReferenceError if other scripts call it before definition) */
(function(){
  if(typeof window.renderEmployeeManagement !== "function"){
    window.renderEmployeeManagement = function(){ /* no-op */ };
    try{ window.eval('var renderEmployeeManagement = window.renderEmployeeManagement;'); }catch(_e){}
  }
})();

// --- Enterprise header polish patch (V7.1) ---
// Purpose:
// 1) Make Sign out button match Profile pill sizing/shape.
// 2) Ensure community dropdown option text is dark (fix "blank" options on white menu).
// 3) Nudge logo block down slightly so it is vertically centered in the header.
(function(){
  function injectEnterpriseHeaderCSS(){
    try{
      if(document.getElementById('zummeeEnterpriseHeaderCSS')) return;
      var css = `
        /* Header layout */
        header.zummee-header{ padding-top:18px !important; padding-bottom:18px !important; }
        .zummee-header__logo{ margin-top:6px !important; display:flex !important; align-items:center !important; }

        /* Match Sign out button to Profile pill */
        #zummeeSignOut{
          height:52px !important;
          min-height:52px !important;
          padding:0 22px !important;
          border-radius:18px !important;
          font-weight:800 !important;
          font-size:18px !important;
          line-height:52px !important;
          color:#ffffff !important;
          background:rgba(255,255,255,0.18) !important;
          border:1px solid rgba(255,255,255,0.28) !important;
          box-shadow: 0 10px 22px rgba(0,0,0,0.18) !important;
          cursor:pointer !important;
        }
        #zummeeSignOut:hover{ background:rgba(255,255,255,0.24) !important; }
        #zummeeSignOut:active{ transform:translateY(1px); }

        /* Modern community selector – enforce dark text on white dropdown */
        .zCommSelect, .zCommSelect *{ color:#0f2f4a !important; }
        .zCommDrop{ color:#0f2f4a !important; }
        .zCommOpt, .zCommOpt *{ color:#0f2f4a !important; }
        .zCommSearch{ color:#0f2f4a !important; }
        .zCommSearch::placeholder{ color: rgba(15,47,74,0.55) !important; }
      `;
      var style = document.createElement('style');
      style.id = 'zummeeEnterpriseHeaderCSS';
      style.textContent = css;
      document.head.appendChild(style);
    }catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', injectEnterpriseHeaderCSS);
  } else {
    injectEnterpriseHeaderCSS();
  }
})();

// ===== Hub Sign Out (robust) =====
// Some pages use inline onclick="return window.zummeeSignOutNow(event)".
// Ensure the handler always exists and signs out from Supabase, then returns to login.
(function(){
  if(window.zummeeSignOutNow) return;
  window.zummeeSignOutNow = async function(ev){
    try{ if(ev){ ev.preventDefault(); ev.stopPropagation(); } }catch(_e){}

    // If a unified modal exists, use it; otherwise confirm.
    var ok = true;
    try{
      if(window.confirmSignOut){
        // confirmSignOut may open a modal; if it returns a promise, await it.
        var r = window.confirmSignOut();
        if(r && typeof r.then === 'function') ok = await r;
        else return false; // modal flow will continue via its own OK button
      }else if(window.ZConfirm && window.ZConfirm.open){
        // Best-effort modal
        ok = await new Promise(function(resolve){
          try{
            window.ZConfirm.open({
              title:'Sign out',
              message:'Are you sure you want to sign out?',
              okText:'Sign out',
              cancelText:'Cancel',
              focus:'cancel',
              onConfirm:function(){ resolve(true); },
              onCancel:function(){ resolve(false); }
            });
          }catch(_e){ resolve(confirm('Sign out?')); }
        });
      }else{
        ok = confirm('Sign out?');
      }
    }catch(_e2){ ok = confirm('Sign out?'); }

    if(!ok) return false;

    try{
      var sb = window.sb || window.supabaseClient || window.supabase;
      if(!sb && typeof window.ensureSupabase === 'function') sb = await window.ensureSupabase();
      if(sb && sb.auth && sb.auth.signOut) await sb.auth.signOut();
      else if(window.ZummeeAuth && window.ZummeeAuth.signOut) await window.ZummeeAuth.signOut();
    }catch(_e3){}

    // Clear local session hints
    try{
      ['activeCompanyId','activeCompanyName','userRole','role','zummee_admin_selected_company'].forEach(function(k){
        try{ localStorage.removeItem(k); }catch(_e){}
      });
    }catch(_e4){}

    try{ window.location.href = 'login.html'; }catch(_e5){ window.location.href = '/login.html'; }
    return false;
  };
})();

})();

// Company Communities global state (used for correct on-load rendering + debug)
window.__activeCompanyId = window.__activeCompanyId || null;
window.__ccLoadToken = window.__ccLoadToken || 0;

// v744: Ensure CC maps exist (prevents "Cannot set properties of undefined")
window.__companyIdByName = window.__companyIdByName || {};
window.__ccAssignmentsByCompanyId = window.__ccAssignmentsByCompanyId || {};


/* v693: Guard missing cloud-sync helpers (avoid 'cloud sync failed' toast) */
(function(){
  // Provide no-op stubs only if missing; do NOT override real implementations.
  if(typeof window.loadCompaniesForSupervisor !== "function"){
    window.loadCompaniesForSupervisor = function(){ return Promise.resolve([]); }; window.loadCompaniesForSupervisor.__isStub = true;
    try{ window.eval('var loadCompaniesForSupervisor = window.loadCompaniesForSupervisor;'); }catch(_e){}
  }
  if(typeof window.renderCompanyCommunitySelect !== "function"){
    window.renderCompanyCommunitySelect = function(){ /* no-op */ };
    try{ window.eval('var renderCompanyCommunitySelect = window.renderCompanyCommunitySelect;'); }catch(_e){}
  }
  if(typeof window.loadCompanyCommunities !== "function"){
    window.loadCompanyCommunities = function(){ return Promise.resolve([]); };
    try{ window.eval('var loadCompanyCommunities = window.loadCompanyCommunities;'); }catch(_e){}
  }
})();


/* ---- Global toast helper (safe) ---- */
(function(){
  if(window.toast) return;
  let toastTimer = null;
  function ensureToastEl(){
    let el = document.getElementById('toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.style.position = 'fixed';
      el.style.left = '50%';
      el.style.bottom = '22px';
      el.style.transform = 'translate(-50%, 10px)';
      el.style.background = 'rgba(15,47,74,0.92)';
      el.style.color = '#fff';
      el.style.padding = '10px 14px';
      el.style.borderRadius = '12px';
      el.style.fontWeight = '700';
      el.style.fontSize = '14px';
      el.style.boxShadow = '0 10px 24px rgba(0,0,0,0.18)';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.transition = 'opacity .18s ease, transform .18s ease';
      el.style.zIndex = '9999';
      document.body.appendChild(el);
    }
    return el;
  }
  window.toast = function(msg){
    const el = ensureToastEl();
    el.textContent = String(msg ?? '');
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, 0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%, 10px)';
    }, 1800);
  };
})();

/* ---- Global HTML escape helper (esc) ---- */
(function(){
  if(window.esc) return;
  function esc(s){
    return String(s ?? "")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }
  window.esc = esc;
  try{ window.eval('var esc = window.esc;'); }catch(_e){}
})();


/* ---- FIX: prevent assignment select clicks from bubbling to collapse/toggle handlers ---- */
(function(){
  if(window.__ccAssignSelectStopBubble) return;
  window.__ccAssignSelectStopBubble = true;
  function isAssignSelectTarget(t){
    if(!t) return false;
    // Support legacy typo class (assignSelectt) as well as the correct class (assignSelect)
    if(t.matches && t.matches('select.assignSelect, select.assignSelectt')) return true;
    // Some browsers report option elements during interaction
    if(t.closest && t.closest('select.assignSelect, select.assignSelectt')) return true;
    return false;
  }
  function stopper(e){
    const t = e.target;
    if(isAssignSelectTarget(t)){
      // Keep native select behavior, but prevent parent click handlers (collapse) from running
      e.stopPropagation();
      // ensure focus stays on the select
      try{ (t.tagName==='SELECT' ? t : t.closest('select.assignSelect, select.assignSelectt'))?.focus?.(); }catch(_e){}
    }
  }
  document.addEventListener('mousedown', stopper, true);
  document.addEventListener('click', stopper, true);
  document.addEventListener('touchstart', stopper, true);
})();

/* ---- Global audit helpers (safe) ---- */
(function(){
  if(window.loadAudit) return;

  function _slugCompany(c){
    return String(c||'')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'');
  }
  function auditKey(company){
    return 'zummee_company_audit_v1__' + _slugCompany(company);
  }

  window.loadAudit = function loadAudit(company){
    try{
      return (window.loadJSON ? window.loadJSON(auditKey(company), {}) : {});
    }catch(_e){
      return {};
    }
  };

  window.saveAudit = function saveAudit(company, auditObj){
    try{
      if(window.saveJSON) return window.saveJSON(auditKey(company), auditObj||{});
      localStorage.setItem(auditKey(company), JSON.stringify(auditObj||{}));
      return true;
    }catch(_e){
      return false;
    }
  };

  try{ window.eval('var loadAudit = window.loadAudit; var saveAudit = window.saveAudit;'); }catch(_e){}
})();


/* ---- Global JSON storage helpers ---- */
(function(){
  if(window.loadJSON && window.saveJSON) return;
  window.loadJSON = window.loadJSON || function(key, fallback){
    try{
      var raw = localStorage.getItem(String(key||""));
      if(raw==null) return fallback;
      return JSON.parse(raw);
    }catch(_e){ return fallback; }
  };
  window.saveJSON = window.saveJSON || function(key, value){
    try{ localStorage.setItem(String(key||""), JSON.stringify(value)); return true; }catch(_e){ return false; }
  };
  try{ window.eval('var loadJSON = window.loadJSON; var saveJSON = window.saveJSON;'); }catch(_e){}
})();

/* ---- Global companyCommunitiesKey helper ---- */
(function(){
  if(window.companyCommunitiesKey) return;
  function _slugCompany(c){
    return String(c||'')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'');
  }
  function companyCommunitiesKey(company){
    return 'zummee_company_communities_v1__' + _slugCompany(company);
  }

  // v748: store/load company communities by companyId (more stable than name)
  function companyCommunitiesKeyById(companyId){
    return 'sup_company_communities__' + String(companyId||'').trim();
  }

  window.companyCommunitiesKey = companyCommunitiesKey;
  try{ window.eval('var companyCommunitiesKey = window.companyCommunitiesKey;'); }catch(_e){}
})();

/* ---- Global getCompany helper ---- */
(function(){
  if(window.getCompany) return;

  // v802: Treat company UUID as the source of truth for sync/scope.
  // Some UI flows temporarily set localStorage('zummee_company') to placeholder text
  // like "Loading companies..." which must never be used as a real company key.
  function __isUuid(v){
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||"").trim());
  }
  function getActiveCompanyIdSafe(){
    try{
      var v = localStorage.getItem('activeCompanyId') || localStorage.getItem('zummee_company_id') || '';
      v = String(v||'').trim();
      return __isUuid(v) ? v : null;
    }catch(_e){
      return null;
    }
  }
  window.getActiveCompanyIdSafe = getActiveCompanyIdSafe;
  try{ window.eval('var getActiveCompanyIdSafe = window.getActiveCompanyIdSafe;'); }catch(_e){}
  function getCompany(){
    try{
  // Prefer the Company Communities picker (companyadmin/admin) when present.
  // Fallback to the legacy supervisor picker ids.
  var sel = document.getElementById('cc_companySelect') || document.getElementById('sup_companySelect') || document.getElementById('sup_adminCompanyPicker');
      if(sel){
        // v801: company selects now use UUID values; return the *display name* for cache keys.
        try{
          var opt = sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0] : null;
          var txt = opt ? String(opt.textContent||'').trim() : '';
          if(txt) return txt;
        }catch(_e){}
        var v = sel.value || '';
        // If value is not a UUID, it may already be the company name.
        if(v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v))) return String(v).trim();
      }
    }catch(_e){}
    try{
      var ls = localStorage.getItem('zummee_admin_selected_company') || localStorage.getItem('zummee_company') || localStorage.getItem('company') || '';
      ls = String(ls||'').trim();
      // Ignore placeholder values
      if(ls && !/loading\s+companies/i.test(ls)) return ls;
    }catch(_e){}
    try{ if(window.__zummeeCompany) return String(window.__zummeeCompany).trim(); }catch(_e){}
    return '';
  }

  function getSelectedCompanyName(){
    const el = document.getElementById('sup_ccCompanyPicker');
    if(!el) return (localStorage.getItem('zummee_company')||'');
    const opt = el.options && el.selectedIndex>=0 ? el.options[el.selectedIndex] : null;
    return (opt && (opt.textContent||'').trim()) || (el.value||'');
  }

  async function resolveCompanyIdForName(companyName){
    const name=(companyName||'').trim();
    if(!name) return null;
    // v744: map may exist but always ensure it's an object
    if(!window.__companyIdByName) window.__companyIdByName = {};
    if(window.__companyIdByName[name]) return window.__companyIdByName[name];
    const sb = (typeof getSupabaseClientSafe==='function') ? getSupabaseClientSafe() : (typeof getSupabaseClient==='function' ? getSupabaseClient() : null);
    if(!sb || !sb.from) return null;
const { data, error } = await sb.from('Companies').select('id,name').eq('name', name).maybeSingle();
    if(error){ console.warn('[CC] resolveCompanyIdForName failed', error); return null; }
    if(data && data.id){
      window.__companyIdByName[name]=data.id;
      return data.id;
    }
    return null;
  }

  async function loadAssignmentsForCompany(companyId){
    if(!companyId) return {};
    if(!window.__ccAssignmentsByCompanyId) window.__ccAssignmentsByCompanyId = {};
    // always fetch fresh on load to avoid stale/mismatch; caller can cache if needed
    const sb = (typeof getSupabaseClientSafe==='function') ? getSupabaseClientSafe() : (typeof getSupabaseClient==='function' ? getSupabaseClient() : null);
    if(!sb || !sb.from) return {};
const { data, error } = await sb.from('CommunityAssignments').select('community_id,user_id,company_id').eq('company_id', companyId);
    if(error){ console.warn('[CC] loadAssignmentsForCompany failed', error); return {}; }
    const map={};
    (data||[]).forEach(r=>{ if(r && r.community_id) map[r.community_id]=r.user_id||null; });
    window.__ccAssignmentsByCompanyId[companyId]=map;
    return map;
  }

  
  // Fetch company communities from Supabase using the active company id.
  // Project schema (Feb 2026):
  //  - PropertyCommunities.company_id is uuid (FK to Companies.id)
  //  - Communities.company is text (company name)
  async function fetchCompanyCommunitiesByCompanyId(companyId){
    try {
      const sb = window.sb || window.supabaseClient || window.supabase;
      if (!sb || !companyId) return [];

      // Preferred: PropertyCommunities scoped by company_id (uuid)
      let q = await sb.from('PropertyCommunities').select('id,name,company,company_id').eq('company_id', companyId).order('name');
      if (q && q.error) {
        console.warn('[CC] PropertyCommunities query failed (company_id)', q.error);
      }
      let rows = Array.isArray(q && q.data) ? q.data : [];
      if(rows.length){
        window.__ccCompanyFilterMode = 'id';
        return rows.map(r => ({ id:r.id, name:r.name, company:r.company || '' }));
      }

      // Fallback: Communities scoped by company *name* (text)
      let companyName = null;
      try{
        if (typeof window.getCompanyRow === 'function') {
          const crow = await window.getCompanyRow(companyId);
          companyName = (crow && crow.name) ? String(crow.name).trim() : null;
        }
        if(!companyName){
          const pick = document.getElementById('sup_ccCompanyPicker');
          const opt = pick && pick.selectedOptions && pick.selectedOptions[0];
          companyName = opt ? String(opt.textContent||'').trim() : null;
        }
      }catch(_e){}
      if(companyName){
        const q2 = await sb.from('Communities').select('id,name,company').eq('company', companyName).order('name');
        if(q2 && q2.error) console.warn('[CC] Communities query failed (company name)', q2.error);
        const rows2 = Array.isArray(q2 && q2.data) ? q2.data : [];
        if(rows2.length){
          window.__ccCompanyFilterMode = 'name';
          return rows2.map(r=>({ id:r.id, name:r.name, company:r.company || companyName }));
        }
      }
      window.__ccCompanyFilterMode = window.__ccCompanyFilterMode || 'id';
      return [];
    } catch (e) {
      console.warn('[CC] fetchCompanyCommunitiesByCompanyId exception', e);
      return [];
    }
  }




  // Detect which cloud table/columns to use for Company Communities.
  // Project schema (Feb 2026):
  //  - PropertyCommunities: { id(uuid), name(text), company_id(uuid), company(text) }
  //  - Communities:         { id(uuid), name(text), company(text company name) }
  async function getCCSchema(sb, effectiveCompanyId, companyName){
    // Prefer PropertyCommunities by company_id (uuid). Fall back to Communities by company name.
    try{
      const probe = await sb.from('PropertyCommunities').select('id').limit(1);
      if(!probe.error){
        return { ok:true, table:'PropertyCommunities', col:'company_id', nameCol:'name', idCol:'id', mode:'id', note:'Using PropertyCommunities.company_id (uuid)'};
      }
    }catch(_e){}
    return { ok:true, table:'Communities', col:'company', nameCol:'name', idCol:'id', mode:'name', note:'Using Communities.company (company name text)'};
  }


  window.getCCSchema = getCCSchema;


async function refreshCompanyCommunitiesNow(){
    try{
      const sb = getSupabaseClientSafe();
      if(!sb) return [];
      const picker = document.getElementById('sup_ccCompanyPicker');
      // Prefer the CC picker value as source-of-truth. If the picker is present but empty
      // (some legacy builds used name-values), fall back to last known CC company id
      // rather than window.activeCompanyId (which can belong to another section/page).
      let companyId = (picker && picker.value) ? String(picker.value).trim() : '';
      // If picker value isn't a UUID, try mapping the displayed company name -> id.
      if(companyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId)){
        try{
          const nm = (picker && picker.selectedOptions && picker.selectedOptions[0]) ? String(picker.selectedOptions[0].textContent||'').trim() : '';
          if(nm && window.__companiesByName && window.__companiesByName[nm]) companyId = String(window.__companiesByName[nm]);
        }catch(_e){}
      }
      if(!companyId){
        companyId = (picker ? (window.__ccLastCompanyId||'') : (window.activeCompanyId||'')) || '';
      }
      if(!companyId) return [];

      // Keep approved employee cache warm for the assign dropdown (non-fatal).
      try{
        if(typeof window.loadApprovedProfilesForCompanyId === 'function'){
await window.loadApprovedProfilesForCompanyId(companyId);
        }
      }catch(_e){}

      const companyName = (picker && picker.selectedOptions && picker.selectedOptions[0]) ? (picker.selectedOptions[0].textContent || '').trim() : (window.__ccLastCompanyName || '');

      // Cache the last-known CC company selection to keep refreshes stable even if other
      // parts of the page mutate window.activeCompanyId.
      try{ window.__ccLastCompanyId = companyId; }catch(_e){}
      try{ window.__ccLastCompanyName = companyName; }catch(_e){}
      // Communities schema varies: some builds store company as uuid (companyId), others store company as text (companyName).
      let list = await fetchCompanyCommunitiesByCompanyId(companyId);
      if((!list || !list.length) && companyName){
        try{
          const byName = await fetchCompanyCommunitiesByCompanyName(companyName);
          if(byName && byName.length) list = byName;
        }catch(_e){}
      }

      // Cache
      window.companyCommunities = Array.isArray(list) ? list : [];
      window.companyCommunitiesById = {};
      (window.companyCommunities||[]).forEach(c => { if(c && c.id) window.companyCommunitiesById[c.id]=c; });

      // Only render if this is still the active company
      const currentPickerVal = document.getElementById('sup_ccCompanyPicker')?.value || window.activeCompanyId;
      if(currentPickerVal && currentPickerVal !== companyId) return window.companyCommunities;

      if(typeof renderCompanyCommunities === 'function') renderCompanyCommunities(window.companyCommunities);
      return window.companyCommunities;
    }catch(e){
      console.warn('refreshCompanyCommunitiesNow failed', e);
      return [];
    }
  }

    // Export for legacy callers + refreshAll
  window.refreshCompanyCommunitiesNow = refreshCompanyCommunitiesNow;
  window.__refreshCompanyCommunitiesNow = refreshCompanyCommunitiesNow;
  // v750: harden against legacy callers that invoke renderCompanyCommunities(companyName/undefined)
  // and accidentally overwrite the UI with another company's cached list.
  (function(){
    try{
      const origRender = (typeof window.renderCompanyCommunities === 'function') ? window.renderCompanyCommunities : null;
      window.renderCompanyCommunities = function(arg){
        // If we were given a concrete list, render normally.
        if(Array.isArray(arg)){
          try{
            // only render if it matches the currently selected company (prevents cross-company overwrite)
            const picker = document.getElementById('sup_ccCompanyPicker');
            const curId = picker ? String(picker.value||'').trim() : '';
            if(window.__activeCompanyId && curId && window.__activeCompanyId !== curId){
              // ignore stale render
              return;
            }
          }catch(_e){}
          if(typeof window.sup_renderCompanyCommunities === 'function'){
            return window.sup_renderCompanyCommunities(arg);
          }
          return origRender ? origRender(arg) : undefined;
        }
        // Otherwise (name/undefined), do NOT clear UI; instead refresh for current picker.
        try{
          if(typeof window.__refreshCompanyCommunitiesNow === 'function'){
            return window.__refreshCompanyCommunitiesNow();
          }
        }catch(_e){}
        return;
      };
    }catch(_e){}
  })();


  // v745: keep all company pickers in sync and avoid double-renders/race clears.
  function syncCompanyPickers(companyId){
    const ids = ['sup_ccCompanyPicker','sup_companySelect','sup_adminCompanyPicker'];
    ids.forEach(function(id){
      const el = document.getElementById(id);
      if(!el) return;
      // Only set if this <select> actually contains an <option> with that value.
      // (Some legacy pickers used names; forcing a UUID would blank the control.)
      try{
        const has = !!el.querySelector('option[value="'+CSS.escape(String(companyId))+'"]');
        if(has && el.value !== companyId) el.value = companyId;
      }catch(_e){
        // Fallback: best-effort
        if(el.value !== companyId) el.value = companyId;
      }
    });
  }

  document.addEventListener('change', function(ev){
    const t=ev.target;
    if(!t || !t.id) return;
    const isCompanyPicker = (t.id==='sup_ccCompanyPicker' || t.id==='sup_companySelect' || t.id==='sup_adminCompanyPicker');
    if(!isCompanyPicker) return;
    if(window.__ccSyncing) return;
    try{
      window.__ccSyncing = true;
      const v = String(t.value||'').trim();
      if(v){
        syncCompanyPickers(v);
        // Make the selected company authoritative across the page.
        // This prevents render guards from rejecting updates due to stale globals.
        window.activeCompanyId = v;
        window.currentCompanyId = v;
        window.selectedCompanyId = v;
        try{ localStorage.setItem('activeCompanyId', v); }catch(_e){}
      }
    }catch(_e){}
    finally{ window.__ccSyncing = false; }

    refreshCompanyCommunitiesNow();
  });


  window.getCompany = getCompany;
  try{ window.eval('var getCompany = window.getCompany;'); }catch(_e){}
})();


/* ---- Global getSelectedCompanyId helper ---- */
(function(){
  if(window.getSelectedCompanyId) return;
  function getSelectedCompanyId(){
    try{
      var v = (typeof window.getCompany === 'function') ? String(window.getCompany()||'').trim() : '';
      // If the company select stores UUIDs, just use it.
      if(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return v;
      // Otherwise treat it as a company name and map to id.
      if(v && window.__companiesByName){
        if(window.__companiesByName[v]) return String(window.__companiesByName[v]);
        // Case-insensitive fallback
        var key = Object.keys(window.__companiesByName).find(function(k){ return String(k).trim().toLowerCase() === v.toLowerCase(); });
        if(key) return String(window.__companiesByName[key]);
      }
    }catch(_e){}
    try{ if(window.__currentCompanyId) return String(window.__currentCompanyId); }catch(_e){}
    try{ if(window.__supCompanyId!=null) return String(window.__supCompanyId); }catch(_e){}
    try{ if(window.__activeCompanyId) return String(window.__activeCompanyId); }catch(_e){}
    try{
      var picker = document.getElementById('sup_ccCompanyPicker');
      if(picker && picker.value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(picker.value)) return String(picker.value);
    }catch(_e){}
    try{
      var lsId = localStorage.getItem('zummee_admin_company_id') || localStorage.getItem('zummee_active_company_id') || localStorage.getItem('active_company_id');
      if(lsId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lsId)) return String(lsId);
    }catch(_e){}
    return '';
  }
  window.getSelectedCompanyId = getSelectedCompanyId;
  try{ window.eval('var getSelectedCompanyId = window.getSelectedCompanyId;'); }catch(_e){}
})();

/* ---- Global loadCompaniesForSupervisor helper (safe) ---- */
(function(){
  if(window.loadCompaniesForSupervisor && !window.loadCompaniesForSupervisor.__isStub) return;
  async function loadCompaniesForSupervisor(){
    try{
      // Preferred: reuse existing company loader + renderer if present
      if(typeof window.loadAllCompanies === 'function'){
const comps = await window.loadAllCompanies();
        if(typeof window.renderCompanyOptions === 'function'){
          try{ window.renderCompanyOptions(comps); }catch(_e){}
        }
        return comps || [];
      }
    }catch(_e){}
    // Fallback: do nothing (avoid crashing the page). Caller can continue with cached company.
    return [];
  }
  window.loadCompaniesForSupervisor = loadCompaniesForSupervisor;
  try{ window.eval('var loadCompaniesForSupervisor = window.loadCompaniesForSupervisor;'); }catch(_e){}
})();



/* ---- Ensure Supervisor company pickers populate (v743) ---- */
(function(){
  async function fetchCompaniesIdName(){
    try{
      var sb = window.sb || window.supabaseClient || window.supabase;
      if(!sb || !sb.from) return [];

      // v789: wait briefly for auth session (avoids early empty dropdowns)
      try{
        if(sb.auth && sb.auth.getSession){
          var ses = null;
          for(var _i=0; _i<10; _i++){
ses = await sb.auth.getSession();
            if(ses && ses.data && ses.data.session) break;
await new Promise(function(res){ setTimeout(res, 150); });
          }
          // If still no session, continue anyway; some builds rely on anon reads.
        }
      }catch(_e){}

      // ---- v790: Wait briefly for role hydration (index.html sets ZUMMEE_AUTH + localStorage) ----
      // Without this, CompanyAdmin can be misclassified as non-admin on first paint.
      var role = "";
      try{
        for(var _r=0; _r<10; _r++){
          role = String(
            (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role) ||
            window.__zummeeUserRole ||
            window.__supRole ||
            localStorage.getItem("zummee_role") ||
            localStorage.getItem("role") ||
            ""
          ).trim().toLowerCase();
          if(role) break;
await new Promise(function(res){ setTimeout(res, 120); });
        }
      }catch(_e){ role = ""; }

      // v791: If role is still empty, fetch it from profiles (prevents CompanyAdmin mis-scope when landing directly on this page)
      if(!role){
        try{
          if(sb.auth && sb.auth.getUser){
var uu = await sb.auth.getUser();
            var uid2 = uu && uu.data && uu.data.user && uu.data.user.id;
            if(uid2){
var qr = await sb.from('userdirectory').select('role').eq('auth_user_id', uid2).maybeSingle();
              if(qr && qr.data && qr.data.role){
                role = String(qr.data.role||'').trim().toLowerCase();
                try{ localStorage.setItem('zummee_role', role); }catch(_e){}
                try{ window.__zummeeUserRole = role; }catch(_e){}
                try{ window.ZUMMEE_AUTH = window.ZUMMEE_AUTH || {}; window.ZUMMEE_AUTH.role = role; }catch(_e){}
              }
            }
          }
        }catch(_e){}
      }

      var isAdminLike = (role && role.indexOf("admin") !== -1) || (window.__isAdmin===true) || (window.__isPlatformAdmin===true); // includes companyadmin/admin

      if(!isAdminLike){
        // Prefer company_id; fall back to mapping company name -> id.
        var cid = "";
        try{
          cid = String(window.__zummeeCompanyId || localStorage.getItem("zummee_company_id") || localStorage.getItem("company_id") || "").trim();
        }catch(_e){ cid = ""; }

        var looksUuid = cid && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid);

        if(looksUuid){
var q1 = await sb.from('Companies').select('id,name').eq('id', cid).maybeSingle();
          if(q1 && q1.data && q1.data.id) return [q1.data];
          // If company_id is stale, fall through to name mapping.
        }

        var cname = "";
        try{
          cname = String(window.__zummeeCompany || (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.company) || localStorage.getItem("zummee_company") || localStorage.getItem("company") || "").trim();
        }catch(_e){ cname = ""; }

        if(cname){
var q2 = await sb.from('Companies').select('id,name').eq('name', cname).maybeSingle();
          if(q2 && q2.data && q2.data.id){
            try{ localStorage.setItem("zummee_company_id", String(q2.data.id)); }catch(_e){}
            return [q2.data];
          }
        }

      // Fallback: read current user's profiles row to get company name (most reliable)
        try{
          if(sb.auth && sb.auth.getUser){
var u = await sb.auth.getUser();
            var uid = u && u.data && u.data.user && u.data.user.id;
            if(uid){
              // Prefer company name from profiles (field 'company')
var qp = await sb.from('userdirectory').select('company_id').eq('auth_user_id', uid).maybeSingle();
              if(qp && qp.data && qp.data.company_id){
                var cid2 = String(qp.data.company_id||"").trim();
                if(cid2){
var q3 = await sb.from('Companies').select('id,name').eq('id', cid2).maybeSingle();
                  if(q3 && q3.data && q3.data.id){
                    try{ localStorage.setItem("zummee_company", String(q3.data.name)); }catch(_e){}
                    try{ localStorage.setItem("zummee_company_id", String(q3.data.id)); }catch(_e){}
                    return [q3.data];
                  }
                }
              }
            }
          }
        }catch(_e){}

        // Last resort: do not expose all companies to non-admin roles.
        return [];
      }

      // Admin/CompanyAdmin path: show all companies
      try{
var q = await sb.from('Companies').select('id,name').order('name', { ascending: true });
        if(q && q.error) throw q.error;
        return (q && q.data) ? q.data : [];
      }catch(_eAdm){
        // v789: if RLS blocks listing all companies for a "companyadmin", fall back to their own company
        try{
          var cid2 = String(window.__zummeeCompanyId || localStorage.getItem("zummee_company_id") || localStorage.getItem("company_id") || "").trim();
          if(cid2 && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cid2)){
var qa = await sb.from('Companies').select('id,name').eq('id', cid2).maybeSingle();
            if(qa && qa.data && qa.data.id) return [qa.data];
          }
          var cname2 = String(window.__zummeeCompany || (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.company) || localStorage.getItem("zummee_company") || localStorage.getItem("company") || "").trim();
          if(cname2){
var qb = await sb.from('Companies').select('id,name').eq('name', cname2).maybeSingle();
            if(qb && qb.data && qb.data.id) return [qb.data];
          }
        }catch(_e2){}
        return [];
      }
    }catch(_e){
      return [];
    }
  }

  function setOptions(sel, rows){
    if(!sel) return;
    var html = '';
    if(!rows || !rows.length){
      html = '<option value="">' + 'No companies available' + '</option>';
      sel.innerHTML = html;
      sel.disabled = true;
      return;
    }
    for(var i=0;i<rows.length;i++){
      var r = rows[i] || {};
      if(!r.id || !r.name) continue;
      html += '<option value="' + String(r.id) + '">' + String(r.name) + '</option>';
    }
    sel.innerHTML = html;
    sel.disabled = false;
  }

  function getPreferredCompanyId(){
    try{
      var v = '';
      if(typeof window.getSelectedCompanyId === 'function') v = window.getSelectedCompanyId() || '';
      if(!v){
        v = localStorage.getItem('sup_selected_company_id') || localStorage.getItem('selected_company_id') || '';
      }
      return String(v||'');
    }catch(_e){ return ''; }
  }

  function wireChange(sel){
    if(!sel || sel.__wiredChange) return;
    sel.__wiredChange = true;
    sel.addEventListener('change', function(){
      try{
        var id = String(sel.value||'');
        try{ localStorage.setItem('sup_selected_company_id', id); }catch(_e){}
        window.currentCompanyId = id;
        window.activeCompanyId = id;
        window.selectedCompanyId = id;
        // sync other pickers if present
        try{
          var otherIds = ['sup_companySelect','sup_ccCompanyPicker','sup_adminCompanyPicker'];
          otherIds.forEach(function(oid){
            var o = document.getElementById(oid);
            if(o && o !== sel && o.value !== id) o.value = id;
          });
        }catch(_e){}
        // re-render communities assignment UI
        try{ if(window.__refreshCompanyCommunitiesNow) window.__refreshCompanyCommunitiesNow(); else if(typeof refreshCompanyCommunitiesNow==='function') refreshCompanyCommunitiesNow(); }catch(_e){}
      }catch(_e){}
    });
  }

  async function populateOnce(){
    var wrap = document.getElementById('sup_ccCompanyPickerWrap');
    if(wrap){ wrap.style.display = 'block'; }
var rows = await fetchCompaniesIdName();
    var supSel = document.getElementById('sup_companySelect');
    var ccSel  = document.getElementById('sup_ccCompanyPicker');
    var admSel = document.getElementById('sup_adminCompanyPicker');
    setOptions(supSel, rows);
    setOptions(ccSel, rows);
    setOptions(admSel, rows);

    // v786 hotfix: lock company picker for non-admin roles (supervisors)
    try{
      var role = String(
        (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role) ||
        window.__zummeeUserRole ||
        window.__supRole ||
        localStorage.getItem("zummee_role") ||
        localStorage.getItem("role") ||
        ""
      ).trim().toLowerCase();
      var isAdminLike = (role && role.indexOf("admin") !== -1) || (window.__isAdmin===true) || (window.__isPlatformAdmin===true); // includes companyadmin/admin
      if(!isAdminLike){
        // If we resolved exactly one company, don't allow switching.
        if(rows && rows.length === 1){
          if(supSel) supSel.disabled = true;
          if(ccSel)  ccSel.disabled  = true;
          if(admSel) admSel.disabled = true;
        }
      }
    }catch(_e){}
    // choose preferred value if available
    var pref = getPreferredCompanyId();
    if(pref){
      try{
        [supSel, ccSel, admSel].forEach(function(s){ if(s && s.querySelector('option[value="'+pref+'"]')) s.value = pref; });
        window.currentCompanyId = pref;
        window.activeCompanyId = pref;
        window.selectedCompanyId = pref;
        try{ localStorage.setItem('activeCompanyId', pref); }catch(_e){}
        try{ localStorage.setItem('zummee_company_id', pref); }catch(_e){}
        try{ localStorage.setItem('sup_selected_company_id', pref); }catch(_e){}
      }catch(_e){}
    }
    // v800: If no preferred company (or it didn't match), force-select the first available company.
    // Some browsers can leave selectedIndex=-1 after innerHTML replacement; this prevents blank pickers.
    if(!pref){
      try{
        var firstId = (rows && rows[0] && rows[0].id) ? String(rows[0].id) : '';
        if(firstId){
          [supSel, ccSel, admSel].forEach(function(s){
            if(!s) return;
            try{ if(s.querySelector('option[value="'+firstId+'"]')) s.value = firstId; }catch(_e){ s.value = firstId; }
          });
          window.currentCompanyId = firstId;
          window.activeCompanyId = firstId;
          window.selectedCompanyId = firstId;
          try{ localStorage.setItem('activeCompanyId', firstId); }catch(_e){}
          try{ localStorage.setItem('zummee_company_id', firstId); }catch(_e){}
          try{ localStorage.setItem('sup_selected_company_id', firstId); }catch(_e){}
        }
      }catch(_e){}
    }
    wireChange(supSel); wireChange(ccSel); wireChange(admSel);
    return rows.length;
  }

  async function boot(){
    // retry a few times because role/session + sb can hydrate slightly after DOM is ready
    var tries = 0;
    var lastN = 0;
    while(tries < 20){
lastN = await populateOnce();
      if(lastN > 0) break;
      tries++;
await new Promise(function(r){ setTimeout(r, 250); });
    }
    // v749: only refresh AFTER pickers are populated + preferred company applied
    try{
      if(lastN > 0){
        if(window.__refreshCompanyCommunitiesNow) window.__refreshCompanyCommunitiesNow();
        else if(typeof refreshCompanyCommunitiesNow==='function') refreshCompanyCommunitiesNow();
      }
    }catch(_e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
  window.__bootCompanyPickers = boot;
})();


/* ---- Global loadEmployeesForSupervisor helper (safe) ---- */
(function(){
  if(window.loadEmployeesForSupervisor) return;
  async function loadEmployeesForSupervisor(){
    // Single source of truth for Employee Management:
    // query userdirectory + embedded profiles join (profiles.id = userdirectory.auth_user_id)
    // and apply company filtering ONLY for non-admin roles.
    window.__empReqSeq = (window.__empReqSeq||0) + 1;
    var __seq = window.__empReqSeq;

    // Resolve supabase client
    var sb = window.sb || window.supabaseClient || window.supabase;
    if(!sb && typeof window.ensureSupabase === 'function'){
      try{ sb = await window.ensureSupabase(); }catch(_e){}
    }
    if(sb) window.sb = sb;
    if(!sb) return { pending:[], approved:[] };

    // Resolve role + company scope from userdirectory if not already known.
    // IMPORTANT: for supervisors, company scope MUST come from userdirectory (source of truth)
    // because profiles.company_id may differ (or be blocked by RLS / missing table).
    async function __resolveRole(){
      var existing = String(window.__sc_role || window.currentUserRole || window.userRole || '').trim();
      if(existing) return existing;
      try{
        var ures = await sb.auth.getUser();
        var uid = ures && ures.data && ures.data.user && ures.data.user.id;
        if(!uid) return '';
        var rres = await sb.from('userdirectory').select('role').eq('auth_user_id', uid).maybeSingle();
        var role = (rres && rres.data && rres.data.role) ? String(rres.data.role) : '';
        if(role){
          window.currentUserRole = role;
          window.__sc_role = role;
        }
        return role;
      }catch(_e){ return ''; }
    }

    var role = String(await __resolveRole()).toLowerCase();
    var isAdminLike = role.indexOf('admin') !== -1; // admin + companyadmin

    // Determine selected company id (for non-admin roles only)
    var companyId = '';
    try{ companyId = String(localStorage.getItem('activeCompanyId')||'').trim(); }catch(_e){}
    if(!companyId){
      try{ if(typeof window.getSelectedCompanyId==='function') companyId = String(window.getSelectedCompanyId()||'').trim(); }catch(_e){}
    }

    // If still empty AND the user is not admin-like, fallback to the user's userdirectory.company_id.
    if(!isAdminLike && !companyId){
      try{
        var ures2 = await sb.auth.getUser();
        var uid2 = ures2 && ures2.data && ures2.data.user && ures2.data.user.id;
        if(uid2){
          var cRes = await sb.from('userdirectory').select('company_id').eq('auth_user_id', uid2).maybeSingle();
          var cid = cRes && cRes.data && cRes.data.company_id ? String(cRes.data.company_id) : '';
          if(cid){
            companyId = cid;
            // Persist so the rest of the page can use the same scope.
            try{ localStorage.setItem('activeCompanyId', cid); }catch(_e){}
            window.activeCompanyId = cid;
          }
        }
      }catch(_e){}
    }

    // Query userdirectory.
    // IMPORTANT: Do NOT use PostgREST embedded joins here (e.g. profiles:auth_user_id(...)).
    // Many projects do not have an FK relationship defined, which causes hard failures
    // (400/500) and results in an empty UI. We'll do a 2nd query to profiles using .in().
    // NOTE: Do NOT select optional/legacy convenience columns on userdirectory
    // (e.g. profile_name/profile_email). Some environments don't have them and
    // PostgREST hard-fails the whole request with 400.
    // v885: Prefer identity fields from userdirectory when available (profile_name/profile_email),
    // with a safe fallback to the minimal column set if those columns do not exist.
    var rows = [];
    try{
      async function __runUD(selectCols){
        var q = sb.from('userdirectory')
          .select(selectCols)
          .order('created_at', { ascending:false })
          .limit(500);
        if(!isAdminLike && companyId){
          q = q.eq('company_id', companyId);
        }
        return await q;
      }

      var res = await __runUD('auth_user_id, role, approved, company_id, created_at, profile_name, profile_email, company_name');
      if(res && res.error){
        res = await __runUD('auth_user_id, role, approved, company_id, created_at');
      }

      if(__seq !== window.__empReqSeq) return { pending:[], approved:[] }; // stale
      rows = (res && res.data) ? res.data : [];
    }catch(_e){
      if(__seq !== window.__empReqSeq) return { pending:[], approved:[] }; // stale
      rows = [];
    }

    // Normalize cached name/email onto row for renderer first
    for(var i=0;i<rows.length;i++){
      var r0 = rows[i] || {};
      if(!r0.name && r0.profile_name) r0.name = String(r0.profile_name);
      if(!r0.email && r0.profile_email) r0.email = String(r0.profile_email);
      rows[i] = r0;
    }

    // If we still don't have identities for some rows, do a safe 2nd query to profiles.
    // This avoids embedded-join requirements and works with normal RLS policies.
    try{
      var missing = rows.filter(function(r){ return r && ((!r.name || !r.email) || (typeof r.disabled === 'undefined')) && r.auth_user_id; });
      if(missing.length){
        // Only keep real UUIDs. Bad IDs can corrupt the PostgREST URL and cause 400s.
        var ids = missing
          .map(function(r){ return r.auth_user_id; })
          .filter(function(x){ return typeof x === 'string' && /^[0-9a-fA-F-]{36}$/.test(x); });
        // Deduplicate + cap
        var seen = {}; var uniq = [];
        for(var j=0;j<ids.length && uniq.length<200;j++){
          var idj = ids[j];
          if(!seen[idj]){ seen[idj]=1; uniq.push(idj); }
        }

        // Try lowercase profiles first, then fallback to capitalized "Profiles".
        var pres = await sb.from('profiles').select('id,name,email,disabled').in('id', uniq);
        if(pres && pres.error && String(pres.error.message||'').toLowerCase().includes('column')){
          pres = await sb.from('profiles').select('id,name,email').in('id', uniq);
        }

        if(pres && pres.error && String(pres.error.message||'').includes('public.Profiles')){
          pres = await sb.from('Profiles').select('id,name,email,disabled').in('id', uniq);
          if(pres && pres.error && String(pres.error.message||'').toLowerCase().includes('column')){
            pres = await sb.from('Profiles').select('id,name,email').in('id', uniq);
          }

        }

        var pRows = (pres && pres.data) ? pres.data : [];
        var pMap = {};
        for(var k=0;k<pRows.length;k++){
          var p = pRows[k]||{};
          var nm = p.name || p.full_name || [p.first_name,p.last_name].filter(Boolean).join(' ').trim();
          // If we still don't have a name, fall back to the email local-part.
          if(!nm && p.email){
            nm = String(p.email).split('@')[0].replace(/[._-]+/g,' ').trim();
          }
          pMap[p.id] = { name: nm || '', email: p.email || '', disabled: !!p.disabled };
        }

        for(var m=0;m<rows.length;m++){
          var r = rows[m]||{};
          var hit = r.auth_user_id ? pMap[r.auth_user_id] : null;
          if(hit){
            if(!r.name && hit.name) r.name = hit.name;
            if(!r.email && hit.email) r.email = hit.email;
            r.disabled = !!hit.disabled;
          }
          rows[m] = r;
        }
      }
    }catch(_e){ /* best-effort */ }

    // Normalize "approved" to a real boolean when Postgres returns strings/numbers.
    // We treat NULL/undefined as "not explicitly unapproved" so the UI can still populate.
    function __normApproved(v){
      if(v === true) return true;
      if(v === false) return false;
      if(v === 1 || v === '1') return true;
      if(v === 0 || v === '0') return false;
      if(typeof v === 'string'){
        var s = v.trim().toLowerCase();
        if(s === 'true' || s === 't' || s === 'yes' || s === 'y') return true;
        if(s === 'false' || s === 'f' || s === 'no' || s === 'n') return false;
      }
      return null;
    }

    for(var ai=0; ai<rows.length; ai++){
      var rr = rows[ai] || {};
      var nv = __normApproved(rr.approved);
      if(nv !== null) rr.approved = nv;
      rows[ai] = rr;
    }

    // Treat anything not explicitly false as "approved enough" to be selectable.
    // Some environments store approval as NULL (legacy). We still want names to populate.
    var pending = rows.filter(function(r){ return r && r.approved === false; });
    var approved = rows.filter(function(r){ return r && r.approved !== false; });

    return { pending: pending, approved: approved };
  }

  window.loadEmployeesForSupervisor = loadEmployeesForSupervisor;
  try{ window.eval('var loadEmployeesForSupervisor = window.loadEmployeesForSupervisor;'); }catch(_e){}

	// Render Employee Management lists into the Supervisor page.
	// Uses userdirectory rows: { auth_user_id, role, approved, company_id, created_at }
	
  // ===== Employee Management (Rebuilt v2: names + admin edit) =====
  function renderEmployeeManagement(empRes){
    var pending = (empRes && empRes.pending) ? empRes.pending : [];
    var approved = (empRes && empRes.approved) ? empRes.approved : [];
    var hostPending = document.getElementById('sup_approvalsList');
    var hostApproved = document.getElementById('sup_approvedList');

    var companyFilterEl = document.getElementById('sup_employeeCompanyFilter');
    var __companyMap = {};
    function registerCompany(cid, label){
      cid = cid ? String(cid) : '';
      label = label ? String(label).trim() : '';
      if(!cid || !label) return;
      if(!__companyMap[cid]) __companyMap[cid] = label;
    }
    function populateCompanyFilter(){
      if(!companyFilterEl) return;
      var prev = companyFilterEl.value || '';
      var entries = Object.keys(__companyMap).map(function(k){ return {id:k, name:__companyMap[k]}; });
      entries.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
      var html = '<option value="">All companies</option>';
      entries.forEach(function(e){
        html += '<option value="'+esc(e.id)+'">'+esc(e.name)+'</option>';
      });
      companyFilterEl.innerHTML = html;
      // restore selection if still present
      if(prev && __companyMap[prev]) companyFilterEl.value = prev;
      try{ localStorage.setItem('sup_employeeCompanyFilter', companyFilterEl.value || ''); }catch(_e){}
    }
    function getSelectedCompanyFilter(){
      if(!companyFilterEl) return '';
      var v = companyFilterEl.value || '';
      return String(v);
    }
    if(!hostPending && !hostApproved) return;

    function esc(s){
      return String(s==null?'':s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // Robust admin check: use resolved scope role first, then fall back to stored role.
    function isAdmin(){
      try{
        var r = String(window.__sc_role || window.currentUserRole || localStorage.getItem('userRole') || localStorage.getItem('role') || '').toLowerCase();
        return r === 'admin' || (r.includes('admin') && !r.includes('supervisor'));
      }catch(e){ return false; }
    }

    // Cache company names to show friendly labels (best-effort)
    if(!window.__companyNameCache) window.__companyNameCache = {};
    async function getCompanyName(companyId){
      if(!companyId) return '';
      if(window.__companyNameCache[companyId]) return window.__companyNameCache[companyId];
      try{
        var sb = window.sb || window.supabaseClient || window.supabase;
        if(!sb) return companyId;

        // Try lowercase first (recommended), then fallback to legacy capitalized table.
        // NOTE: Our canonical companies table uses column "name" (not company_name).
        var res = await sb.from('companies').select('id,name').eq('id', companyId).maybeSingle();
        if(res && res.error){
          // If the table name is different in this project, try legacy "Companies".
          res = await sb.from('Companies').select('id,name').eq('id', companyId).maybeSingle();
        }
        var nm = (res && res.data && res.data.name) ? res.data.name : companyId;
        window.__companyNameCache[companyId] = nm;
        return nm;
      }catch(e){
        return companyId;
      }
    }

    function displayName(x){
      // Supabase embedded relation may come back as an object OR as a 1-item array
      var prof = (x && x.profiles != null) ? x.profiles : null;
      if(Array.isArray(prof)) prof = prof[0] || null;

      // Prefer the flattened identity fields stored on userdirectory
      // (these are available even when profiles join is blocked/missing).
      var udName = x && x.profile_name ? String(x.profile_name).trim() : '';
      var udEmail = x && x.profile_email ? String(x.profile_email).trim() : '';

      var nm0 = prof && prof.name ? String(prof.name).trim() : '';
      var full = prof && prof.full_name ? String(prof.full_name).trim() : '';
      var first = prof && prof.first_name ? String(prof.first_name).trim() : '';
      var last  = prof && prof.last_name ? String(prof.last_name).trim() : '';
      var nm = nm0 || full || [first,last].filter(Boolean).join(' ').trim();

      // Fall back to normalized flat fields (set by loadEmployeesForSupervisor)
      if(!nm && x && x.name) nm = String(x.name).trim();

      var em = udEmail || (prof && prof.email ? String(prof.email).trim() : '') || (x && x.email ? String(x.email).trim() : '');

      return udName || nm || em || (x && x.auth_user_id ? ('User ' + String(x.auth_user_id).slice(0,8) + '…' + String(x.auth_user_id).slice(-4)) : (x && (x.id||'')));
    }

    function badge(txt){
      return '<span style="display:inline-block; padding:2px 8px; border-radius:999px; background:rgba(15,47,74,0.08); font-weight:800; font-size:12px;">'+esc(txt)+'</span>';
    }

    function applyEmployeeSearchFilter(){
  var qEl = document.getElementById('sup_employeeSearch');
  var q = qEl ? String(qEl.value||'').trim().toLowerCase() : '';
  var companySel = getSelectedCompanyFilter();
  var cards = [];
  try{
    if(hostPending) cards = cards.concat([].slice.call(hostPending.querySelectorAll('.empCard')));
    if(hostApproved) cards = cards.concat([].slice.call(hostApproved.querySelectorAll('.empCard')));
  }catch(_e){}
  if(!cards.length) return;

  // Persist selection (nice UX across refreshes)
  try{ if(companyFilterEl) localStorage.setItem('sup_employeeCompanyFilter', companyFilterEl.value || ''); }catch(_e){}

  cards.forEach(function(c){
    var hay = String(c.getAttribute('data-search')||'').toLowerCase();
    var cid = String(c.getAttribute('data-company-id')||'');
    var okQ = (!q) || (hay.indexOf(q) !== -1);
    var okC = (!companySel) || (cid === companySel);
    c.style.display = (okQ && okC) ? '' : 'none';
  });
}

    function buttons(uid, showApproveReject, isDisabled){
      var b = '<div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">';

      if(showApproveReject){
        b += '<button class="btn" data-action="approve" data-uid="'+esc(uid)+'" style="padding:8px 10px; font-weight:900;">Approve</button>';
        b += '<button class="btn" data-action="reject" data-uid="'+esc(uid)+'" style="padding:8px 10px; font-weight:900; background:#fff; color:#0f2f4a; border:1px solid rgba(15,47,74,0.25);">Reject</button>';
      } else {
        // Supervisors/Admins: disable or enable employees (keeps account but blocks access)
        var dis = !!isDisabled;
        b += '<button class="btn btn--ghost" data-action="toggle_disabled" data-uid="'+esc(uid)+'" data-disabled="'+(dis?'1':'0')+'" style="padding:8px 10px; font-weight:900; border:1px solid rgba(15,47,74,0.25);">'+(dis?'Enable':'Disable')+'</button>';
      }

      if(isAdmin()){
        b += '<button class="btn btn--ghost" data-action="editname_v2" data-uid="'+esc(uid)+'" style="padding:8px 10px; font-weight:900; border:1px dashed rgba(15,47,74,0.35);">Edit Name</button>';
        // v862: Role assignment controls
        b += '<div class="roleEditor" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; justify-content:flex-end; margin-top:8px;">'
           +   '<label class="muted tiny" style="font-weight:900;">Role</label>'
           +   '<select data-role-select="'+esc(uid)+'" style="padding:6px 8px; border-radius:10px; border:1px solid rgba(15,47,74,0.18); background:rgba(255,255,255,0.95)">'
           +     '<option value="Employee">Employee</option>'
           +     '<option value="Supervisor">Supervisor</option>'
           +     '<option value="Admin">Admin</option>'
           +   '</select>'
           +   '<button data-role-save="1" data-uid="'+esc(uid)+'" style="padding:6px 10px; border-radius:10px; border:1px solid rgba(15,47,74,0.22); background:rgba(15,47,74,0.08); font-weight:900; cursor:pointer;">Save Role</button>'
           + '</div>';
      }

      b += '</div>';
      return b;
    }

    async function cardHtml(x, isPending){
      var uid = x.auth_user_id || x.user_id || x.id;
      var role = x.role || 'Employee';
      var created = x.created_at ? new Date(x.created_at).toLocaleString() : '';
      var cid = x.company_id || '';
      // Prefer pre-flattened/cached company name from userdirectory, then fallback to lookup by id.
      var companyLabel = '';
      try{ companyLabel = String((x && (x.company_name || x.company)) || '').trim(); }catch(e){ companyLabel=''; }
      if(!companyLabel && cid) companyLabel = await getCompanyName(cid);
      registerCompany(cid, companyLabel);
      var title = displayName(x);
      var email = '';
      if(x.profiles && typeof x.profiles === 'object'){
        var p = x.profiles;
        if(Array.isArray(p)) p = p[0] || null;
        if(p && p.email) email = p.email;
      }
      if(!email) email = x.email || x.profile_email || '';

      return (
        '<div class="empCard'+(x.disabled?' empCard--disabled':'')+'" data-company-id="'+esc(cid)+'" data-company-name="'+esc(companyLabel)+'" data-search="'+esc(String((title||'')+' '+(email||'')+' '+(companyLabel||'')+' '+(role||'')+' '+(uid||'')).toLowerCase())+'" style="padding:10px; margin:10px 0; border:1px solid rgba(15,47,74,0.18); border-radius:12px; background:rgba(255,255,255,0.92)">' +
          '<div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:flex-start;">' +
            '<div style="min-width:220px; flex:1;">' +
              '<div style="font-weight:900; color:#0f2f4a;">'+esc(title)+'</div>' +
              (x.disabled ? '<div class="tiny" style="margin-top:6px; display:inline-block; padding:2px 8px; border-radius:999px; background:rgba(220,38,38,0.12); color:#991b1b; font-weight:900;">Disabled</div>' : '') +
              '<div class="muted tiny" style="margin-top:4px;">Role: '+badge(role)+' ' + (companyLabel?(' &nbsp; Company: <code>'+esc(companyLabel)+'</code>'):'') + '</div>' +
              (email ? ('<div class="muted tiny" style="margin-top:4px;">Email: <code>'+esc(email)+'</code></div>') : '') +
              (created ? ('<div class="muted tiny" style="margin-top:4px;">Created: '+esc(created)+'</div>') : '') +
            '</div>' +
            '<div>' + buttons(uid, !!isPending, !!x.disabled) + '</div>' +
          '</div>' +
        '</div>'
      );
    }

    async function renderLists(){
      if(hostPending){
        if(!pending.length){
          hostPending.innerHTML = '<div class="muted">No pending approvals.</div>';
        } else {
          var parts = [];
          for(var i=0;i<pending.length;i++){
parts.push(await cardHtml(pending[i], true));
          }
          hostPending.innerHTML = parts.join('');
        }
      }
      if(hostApproved){
        if(!approved.length){
          hostApproved.innerHTML = '<div class="muted">No approved employees.</div>';
        } else {
          // Sort: enabled first, disabled last, then name/email
          try{
            approved.sort(function(a,b){
              var ad = (a && a.disabled===true) ? 1 : 0;
              var bd = (b && b.disabled===true) ? 1 : 0;
              if(ad!==bd) return ad-bd;
              var an = (a && (a.name||a.profile_name||a.profile_email||a.email||'')) ? String(a.name||a.profile_name||a.profile_email||a.email||'').toLowerCase() : '';
              var bn = (b && (b.name||b.profile_name||b.profile_email||b.email||'')) ? String(b.name||b.profile_name||b.profile_email||b.email||'').toLowerCase() : '';
              return an.localeCompare(bn);
            });
          }catch(_e){}
          var parts2 = [];
          for(var j=0;j<approved.length;j++){
parts2.push(await cardHtml(approved[j], false));
          }
          hostApproved.innerHTML = parts2.join('');
        }
      }
      // Build company filter options and apply current filters
      try{ populateCompanyFilter(); }catch(_e){}
      try{ applyEmployeeSearchFilter();
      try{ document.getElementById('sup_pendingCount').textContent = pending.length; }catch(_e){}
      try{ document.getElementById('sup_approvedCount').textContent = approved.length; }catch(_e){}
      try{ var sc=document.getElementById('sup_approvalsStickyCount'); if(sc) sc.textContent = '('+pending.length+')'; }catch(_e){}
      try{ var ac=document.getElementById('sup_approvedStickyCount'); if(ac) ac.textContent = '('+approved.length+')'; }catch(_e){}

      // v919: enhance pending cards with bulk-approve checkboxes + toolbar wiring
      try{ window.__pendingSelectedUids = window.__pendingSelectedUids || new Set(); }catch(_e){}
      function getUidFromPendingCard(card){
        try{
          const btn = card.querySelector('[data-approve-id]') || card.querySelector('[data-reject-id]') || card.querySelector('[data-role-uid]') || card.querySelector('[data-uid]');
          if(btn){
            return btn.getAttribute('data-approve-id') || btn.getAttribute('data-reject-id') || btn.getAttribute('data-role-uid') || btn.getAttribute('data-uid') || '';
          }
        }catch(_e){}
        return '';
      }
      function renderPendingCheckboxes(){
        try{
          if(!hostPending) return;
          // remove old wraps
          hostPending.querySelectorAll('.sup_pendingPickWrap').forEach(n=>n.remove());
          const cards = hostPending.querySelectorAll('.empCard');
          cards.forEach(function(card){
            const uid = getUidFromPendingCard(card);
            if(!uid) return;
            const wrap = document.createElement('div');
            wrap.className = 'sup_pendingPickWrap';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'sup_pendingPick';
            cb.setAttribute('data-pending-uid', uid);
            cb.checked = window.__pendingSelectedUids && window.__pendingSelectedUids.has(uid);
            wrap.appendChild(cb);
            var nameEl = card.querySelector('.name');
            if(nameEl){ nameEl.prepend(wrap); }
            else{ card.appendChild(wrap); }
          });
        }catch(e){ console.warn('renderPendingCheckboxes failed', e); }
      }
      function updatePendingBulkUi(){
        try{
          const selAll = document.getElementById('sup_pendingSelectAll');
          const selCount = document.getElementById('sup_pendingSelectedCount');
          const btnA = document.getElementById('sup_bulkApproveBtn');
          const n = window.__pendingSelectedUids ? window.__pendingSelectedUids.size : 0;
          if(selCount) selCount.textContent = n + ' selected';
          if(btnA) btnA.disabled = (n===0);
          if(selAll){
            const boxes = hostPending ? Array.from(hostPending.querySelectorAll('input.sup_pendingPick')) : [];
            const visible = boxes.filter(b=> b && b.closest('.empCard') && b.closest('.empCard').style.display !== 'none');
            const checked = visible.filter(b=>b.checked);
            selAll.checked = (visible.length>0 && checked.length===visible.length);
            selAll.indeterminate = (checked.length>0 && checked.length<visible.length);
          }
        }catch(_e){}
      }
      function wirePendingBulk(){
        try{
          const selAll = document.getElementById('sup_pendingSelectAll');
          const btnA = document.getElementById('sup_bulkApproveBtn');
          if(!hostPending || !selAll || !btnA) return;

          // Avoid double-wiring
          if(hostPending.__bulkWired) return;
          hostPending.__bulkWired = true;

          hostPending.addEventListener('change', function(ev){
            const b = ev.target;
            if(!b || !b.classList || !b.classList.contains('sup_pendingPick')) return;
            const uid = b.getAttribute('data-pending-uid') || '';
            if(!uid) return;
            if(!window.__pendingSelectedUids) window.__pendingSelectedUids = new Set();
            if(b.checked) window.__pendingSelectedUids.add(uid);
            else window.__pendingSelectedUids.delete(uid);
            updatePendingBulkUi();
          });

          selAll.addEventListener('change', function(){
            const want = !!selAll.checked;
            const boxes = hostPending ? Array.from(hostPending.querySelectorAll('input.sup_pendingPick')) : [];
            if(!window.__pendingSelectedUids) window.__pendingSelectedUids = new Set();
            boxes.forEach(function(b){
              const card = b.closest('.empCard');
              if(card && card.style.display === 'none') return;
              b.checked = want;
              const uid = b.getAttribute('data-pending-uid') || '';
              if(!uid) return;
              if(want) window.__pendingSelectedUids.add(uid);
              else window.__pendingSelectedUids.delete(uid);
            });
            updatePendingBulkUi();
          });

          btnA.addEventListener('click', async function(){
            const uids = window.__pendingSelectedUids ? Array.from(window.__pendingSelectedUids) : [];
            if(!uids.length) return;
            if(!confirm('Approve ' + uids.length + ' selected user(s)?')) return;

            const origText = btnA.textContent;
            btnA.disabled = true; selAll.disabled = true;
            try{
              let sb = window.sb || window.supabaseClient || window.supabase;
              if(!sb && typeof ensureSupabase === 'function') sb = await ensureSupabase();
              if(!sb){ alert('Supabase client not ready. Please refresh and try again.'); return; }

              const approveFn = window.__empMgmtApprove || (async function(_sb,_uid){
                // In this environment, approvals must be reflected in the readable `profiles` table
                // so the assign dropdown can see them.
                let res = await _sb.from('profiles').update({approved:true}).eq('id', _uid);

                // Some builds store the auth id in user_id/auth_user_id; best-effort fallback
                if(res && res.error){
                  try{
                    const msg = String(res.error.message||'').toLowerCase();
                    if(msg.includes('column') || msg.includes('does not exist') || msg.includes('relation')){
                      // If 'id' isn't the right key, try common alternates
                      res = await _sb.from('profiles').update({approved:true}).eq('user_id', _uid);
                      if(res && res.error){
                        res = await _sb.from('profiles').update({approved:true}).eq('auth_user_id', _uid);
                      }
                    }
                  }catch(_e){}
                }
                if(res && res.error) throw res.error;

                // Clear approved cache so dropdown refreshes immediately
                try{
                  if(window.__approvedProfilesByCompanyId) window.__approvedProfilesByCompanyId = {};
                  if(window.__approvedProfilesByCompanyId_ts) window.__approvedProfilesByCompanyId_ts = {};
                }catch(_e){}
              });

              for(let i=0;i<uids.length;i++){
                btnA.textContent = 'Approving ' + (i+1) + '/' + uids.length + '…';
                await approveFn(sb, uids[i]);
              }

              window.__pendingSelectedUids.clear();
              btnA.textContent = 'Approved ✓';
              setTimeout(()=>{ try{ btnA.textContent = origText; }catch(_e){} }, 800);

              if(typeof refreshEmployeesUI === 'function') await refreshEmployeesUI();
          try{ if(typeof refreshCompanyCommunitiesNow === 'function'){ await refreshCompanyCommunitiesNow(); } }catch(_e){}
            }catch(e){
              console.warn('bulk approve failed', e);
              alert('Bulk approve failed: ' + (e && e.message ? e.message : e));
              try{ btnA.textContent = origText; }catch(_e){}
            }finally{
              selAll.disabled = false;
              updatePendingBulkUi();
            }
          });

        }catch(e){ console.warn('wirePendingBulk failed', e); }
      }

      renderPendingCheckboxes();
      wirePendingBulk();
      updatePendingBulkUi();
 }catch(_e){}
    }


    // Bind search box once
    try{
      if(!window.__empSearchBound){
        window.__empSearchBound = true;
        var qEl = document.getElementById('sup_employeeSearch');
        if(qEl){
          qEl.addEventListener('input', function(){ applyEmployeeSearchFilter();
      try{ document.getElementById('sup_pendingCount').textContent = pending.length; }catch(_e){}
      try{ document.getElementById('sup_approvedCount').textContent = approved.length; }catch(_e){} });
          qEl.addEventListener('search', function(){ applyEmployeeSearchFilter();
      try{ document.getElementById('sup_pendingCount').textContent = pending.length; }catch(_e){}
      try{ document.getElementById('sup_approvedCount').textContent = approved.length; }catch(_e){} });

        var cfEl = document.getElementById('sup_employeeCompanyFilter');
        if(cfEl){
          try{
            var prevC = localStorage.getItem('sup_employeeCompanyFilter') || '';
            if(prevC) cfEl.value = prevC;
          }catch(_e){}
          cfEl.addEventListener('change', function(){ applyEmployeeSearchFilter();
      try{ document.getElementById('sup_pendingCount').textContent = pending.length; }catch(_e){}
      try{ document.getElementById('sup_approvedCount').textContent = approved.length; }catch(_e){} });
        }

        }
      }
    }catch(_e){}

    renderLists().catch(function(e){
      console.warn('renderEmployeeManagement v2 failed', e);
    });
  }
  window.renderEmployeeManagement = renderEmployeeManagement;
  try{ window.eval('var renderEmployeeManagement = window.renderEmployeeManagement;'); }catch(_e){}


// Expose renderer for other scripts / inline handlers
window.renderEmployeeManagement = renderEmployeeManagement;
try{ window.eval('var renderEmployeeManagement = window.renderEmployeeManagement;'); }catch(_e){}


/* v752: Load approved profiles for a specific companyId (used by Company Communities assign dropdowns).
   NOTE: In Zummee, approval lives in `userdirectory.approved` (NOT in profiles), so we must
   fetch approved users from userdirectory and join to profiles for display fields. */
async function loadApprovedProfilesForCompanyId(companyId){
  try{
    if(!companyId) return [];

    // Ensure supabase client
    try{
      if(!window.sb){
        if(typeof window.ensureSupabase === 'function'){
          const sb = await window.ensureSupabase(); if(sb) window.sb = sb;
        } else if(typeof ensureSupabase === 'function'){
          const sb2 = await ensureSupabase(); if(sb2) window.sb = sb2;
        }
      }
    }catch(_e){}
    if(!window.sb) return [];

    // Cache w/ TTL (so newly-approved show up quickly)
    window.__approvedProfilesByCompanyId = window.__approvedProfilesByCompanyId || {};
    window.__approvedProfilesByCompanyId_ts = window.__approvedProfilesByCompanyId_ts || {};
    const cacheKey = String(companyId);
    const cached = window.__approvedProfilesByCompanyId[cacheKey] || [];
    const ts = window.__approvedProfilesByCompanyId_ts[cacheKey] || 0;
    const TTL_MS = 15000;
    if(Array.isArray(cached) && cached.length && (Date.now() - ts) < TTL_MS) return cached;

    const PROFILES_TBL = 'profiles';
    const USERDIR_TBL  = 'userdirectory';

    // IMPORTANT: do NOT enumerate columns here.
    // Supabase REST returns 400 if you request a column that doesn't exist (e.g. full_name, user_id).
    const sel = '*';

    // 1) Source of truth for approvals: userdirectory.approved
    let udRows = [];
    try{
      let udRes = await window.sb
        .from(USERDIR_TBL)
        .select('*')
        .eq('approved', true)
        .eq('company_id', companyId)
        .limit(5000);
      if(udRes && udRes.error){
        const msg = (udRes.error.message || '').toLowerCase();
        if(udRes.status === 400 || msg.includes('invalid') || msg.includes('does not exist')){
          const udRes2 = await window.sb
            .from(USERDIR_TBL)
            .select('*')
            .eq('approved', true)
            .limit(5000);
          if(udRes2 && !udRes2.error && Array.isArray(udRes2.data)){
            udRows = udRes2.data.filter(r => String(r.company_id||'') === String(companyId));
          }
        }
      }
      if(!udRows.length && udRes && !udRes.error && Array.isArray(udRes.data)){
        udRows = udRes.data;
      }
    }catch(_e){}

    // Extract the approved auth IDs from userdirectory (auth_user_id EXISTS; user_id DOES NOT)
    let approvedIds = (udRows || [])
      .filter(r => {
        const role = String(r && r.role || '').toLowerCase();
        // Exclude admin-ish roles from the "assign employee" dropdown
        if(role.includes('admin')) return false;
        return true;
      })
      .map(r => r && r.auth_user_id)
      .filter(Boolean);

    // 2) Fetch profile display data for those IDs
    let profiles = [];
    if(approvedIds.length){
      const chunks = [];
      const chunkSize = 100; // keep URL size reasonable
      for(let i=0;i<approvedIds.length;i+=chunkSize){
        chunks.push(approvedIds.slice(i, i+chunkSize));
      }

      for(const ch of chunks){
        try{
          const pRes = await window.sb
            .from(PROFILES_TBL)
            .select(sel)
            .in('id', ch)
            .limit(1000);
          if(pRes && !pRes.error && Array.isArray(pRes.data)){
            profiles = profiles.concat(pRes.data);
          }
        }catch(_e){}
      }

      // If some approved IDs have no profiles row yet, create lightweight placeholders for display
      try{
        const have = new Set((profiles||[]).map(p => String(p && (p.id || p.user_id || p.auth_user_id) || '')));
        (udRows||[]).forEach(r => {
          const id = r && r.auth_user_id;
          if(!id) return;
          if(have.has(String(id))) return;
          const email = (r.profile_email || '').trim();
          let name = email ? email.split('@')[0] : 'User';
          profiles.push({ id, name, email });
        });
      }catch(_e){}
    } else {
      // Fallback: if userdirectory isn't available / returns none, fall back to profiles.approved
      try{
        const pRes = await window.sb
          .from(PROFILES_TBL)
          .select(sel)
          .eq('company_id', companyId)
          .eq('approved', true)
          .limit(1000);
        if(pRes && !pRes.error && Array.isArray(pRes.data)) profiles = pRes.data;
      }catch(_e){}
    }

    // Normalize + filter out disabled/deleted when those fields exist
    const out = (profiles || []).filter(p => {
      if(!p) return false;
      if(p.disabled === true) return false;
      if(p.deleted === true) return false;
      return true;
    }).map(p => {
      // Provide consistent label fields for dropdown rendering
      p._sort = String(p.name || p.full_name || p.email || p.profile_email || '').toLowerCase();
      return p;
    }).sort((a,b)=> (a._sort||'').localeCompare(b._sort||''));

    window.__approvedProfilesByCompanyId[cacheKey] = out;
    window.__approvedProfilesByCompanyId_ts[cacheKey] = Date.now();
    return out;
  }catch(_e){
    return [];
  }
}
try{ window.loadApprovedProfilesForCompanyId = loadApprovedProfilesForCompanyId; }catch(_e){}

})();


/* ---- Employee active helpers ---- */
(function(){
  if(window.ZUMMEE_isEmployeeActive) return;
  window.ZUMMEE_isEmployeeActive = function(emp){
    if(!emp) return false;
    if(emp.deleted === true) return false;
    if(emp.disabled === true) return false;
    return true;
  };
  window.ZUMMEE_filterActiveEmployees = function(list){
    try{ return (list||[]).filter(window.ZUMMEE_isEmployeeActive); }catch(_e){ return []; }
  };
})();

/* ---- Global assignmentsKey helper (safe) ---- */
(function(){
  if(window.assignmentsKey) return;
  function _slugCompany(c){
    return String(c||'')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'_')
      .replace(/^_+|_+$/g,'');
  }
  function assignmentsKey(company){
    // Storage for per-company assignments map
    return 'zummee_company_assignments_v2__' + _slugCompany(company);
  }
  window.assignmentsKey = assignmentsKey;
  // also expose as unqualified identifier for inline scripts in this file
  try{ window.eval('var assignmentsKey = window.assignmentsKey;'); }catch(_e){}
})();

/* ---- Global normalizeCommunity helper (safe) ---- */
(function(){
  if(window.normalizeCommunity) return;
  function normalizeCommunity(v){
    try{
      if(v==null) return '';
      if(typeof v==='object'){
        // normalize a community object
        var name = String(v.name || v.community_name || v.communityName || v.label || v.text || '').trim();
        var id = String(v.id || v.communityId || v.value || '').trim();
        return {
          id: id || undefined,
          name: name,
          _norm: name.toLowerCase().replace(/\s+/g,' ').trim()
        };
      }
      var s = String(v);
      return s.toLowerCase().replace(/\s+/g,' ').trim();
    }catch(_e){ return ''; }
  }
  window.normalizeCommunity = normalizeCommunity;
  // also expose as unqualified identifier for inline scripts in this file
  try{ window.eval('var normalizeCommunity = window.normalizeCommunity;'); }catch(_e){}
})();

/** v9_STABLE_REWRITE_2026-01-21
 * Global constants + safety net. Kept minimal to avoid breaking legacy inline scripts.
 */
(function() {
  // Shared keys (some scripts reference these identifiers directly)
  window.ZUMMEE_KEYS = {
    COMMUNITIES_KEY: "zummee_communities_v1",
    SELECTED_COMMUNITY_KEY: "zummee_selected_community_v1",
    USERS_KEY: "zummee_users_v1",
    SESSION_KEY: "zummee_session_v1"
  };
  // Provide legacy globals for compatibility
  window.COMMUNITIES_KEY = window.ZUMMEE_KEYS.COMMUNITIES_KEY;
  window.SELECTED_COMMUNITY_KEY = window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY;

  // Scope communities + selected community per user so users only see their own communities.
  // This keeps data from bleeding across users on shared devices/browsers.
  window.ZUMMEE_applyUserScope = function(userId){
    try{
      var uid = String(userId||"").trim();
      if(!uid) return;
      var baseComms = "zummee_communities_v1";
      var baseSel = "zummee_selected_community_v1";
      var commKey = baseComms + "__user__" + uid;
      var selKey  = baseSel  + "__user__" + uid;

      

      // One-time migration: move legacy global communities/selected community into user-scoped keys.
      try{
        var legacyCommsKey = baseComms;
        var legacySelKey = baseSel;
        var hasScoped = false;
        try{ hasScoped = !!localStorage.getItem(commKey); }catch(e){}
        if(!hasScoped){
          var legacy = null;
          try{ legacy = localStorage.getItem(legacyCommsKey); }catch(e2){}
          if(legacy){
            try{ localStorage.setItem(commKey, legacy); }catch(e3){}
            try{ localStorage.removeItem(legacyCommsKey); }catch(e4){}
          }
        }
        var hasScopedSel = false;
        try{ hasScopedSel = !!localStorage.getItem(selKey); }catch(e5){}
        if(!hasScopedSel){
          var legacySel = null;
          try{ legacySel = localStorage.getItem(legacySelKey); }catch(e6){}
          if(legacySel){
            try{ localStorage.setItem(selKey, legacySel); }catch(e7){}
            try{ localStorage.removeItem(legacySelKey); }catch(e8){}
          }
        }
      }catch(_m){}

      if(!window.ZUMMEE_KEYS) window.ZUMMEE_KEYS = {};

// Merge supervisor-assigned company communities into this user's scoped community list.
window.ZUMMEE_mergeAssignedCommunities = function(userId, companyName){
  try{
    var uid = String(userId||"").trim();
    var company = String(companyName||"").trim();
    if(!uid || !company) return;

    // Read assignments map: { communityId: userId }
    var assignKey = (window.assignmentsKey ? window.assignmentsKey(company) : ('zummee_company_assignments_v2__' + company));
    var raw = null;
    try{ raw = localStorage.getItem(assignKey); }catch(_e){ raw = null; }
    if(!raw) return;

    var map = {};
    try{ map = JSON.parse(raw) || {}; }catch(_e){ map = {}; }

    // Collect community ids assigned to this user
    var assignedIds = [];
    Object.keys(map||{}).forEach(function(cid){
      if(String(map[cid]||"") === uid) assignedIds.push(String(cid));
    });
    if(!assignedIds.length) return;

    // Get community names from company master list
    var companyCommsKey = (window.companyCommunitiesKey ? window.companyCommunitiesKey(company) : ('zummee_company_communities_v1__' + company));
    var companyComms = [];
    try{ companyComms = JSON.parse(localStorage.getItem(companyCommsKey)||"[]") || []; }catch(_e){ companyComms = []; }
    var nameById = {};
    companyComms.forEach(function(c){
      if(!c) return;
      var id = String(c.id || c.communityId || c.value || "").trim();
      var name = String(c.name || c.communityName || c.label || c.text || "").trim();
      if(id) nameById[id] = name || id;
    });

    // User-scoped communities key
    // Must match ZUMMEE_applyUserScope() which uses "__user__" (double underscore)
    var commKey = "zummee_communities_v1__user__" + uid;
    var existing = [];
    try{ existing = JSON.parse(localStorage.getItem(commKey)||"[]") || []; }catch(_e){ existing = []; }

    var seen = {};
    existing.forEach(function(c){
      var id = (c && (c.id || c.communityId || c.value)) ? String(c.id || c.communityId || c.value) : "";
      if(id) seen[id]=true;
    });

    var changed = false;
    assignedIds.forEach(function(id){
      if(!id || seen[id]) return;
      existing.push({ id: id, name: nameById[id] || id });
      seen[id]=true;
      changed=true;
    });

    if(changed){
      try{ localStorage.setItem(commKey, JSON.stringify(existing)); }catch(_e){}
      try{ localStorage.setItem("zummee_communities_v1", JSON.stringify(existing)); }catch(_e){}
      try{ window.dispatchEvent(new CustomEvent("communities:updated", { detail: { userId: uid } })); }catch(_e){}
    }
  }catch(e){ console.warn("mergeAssignedCommunities failed:", e); }
};

      window.ZUMMEE_KEYS.COMMUNITIES_KEY = commKey;
      window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY = selKey;

      window.COMMUNITIES_KEY = commKey;
      window.SELECTED_COMMUNITY_KEY = selKey;

      try{ COMMUNITIES_KEY = commKey; }catch(_e){}
      try{ SELECTED_COMMUNITY_KEY = selKey; }catch(_e){}

      try{ localStorage.setItem("zummee_user_id_v1", uid); }catch(_e){}
    }catch(_e){}
  };


  // Non-fatal error banner (helps debug without white-screen)
  window.addEventListener("error", function(e) {
    try {
      var msg = (e && e.message) ? e.message : "Unknown error";
      console.error("Zummee error:", e.error || e);
      var bar = document.getElementById("zummeeErrorBar");
      if(!bar) {
        bar = document.createElement("div");
        bar.id = "zummeeErrorBar";
        bar.style.position = "fixed";
        bar.style.top = "0";
        bar.style.left = "0";
        bar.style.right = "0";
        bar.style.zIndex = "1000000";
        bar.style.background = "#b91c1c";
        bar.style.color = "#fff";
        bar.style.padding = "10px 14px";
        bar.style.fontFamily = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial";
        bar.style.fontSize = "13px";
        bar.style.boxShadow = "0 4px 14px rgba(0,0,0,.25)";
        bar.style.cursor = "pointer";
        bar.title = "Click to dismiss";
        bar.addEventListener("click", function(){ bar.remove(); });
        document.documentElement.appendChild(bar);
      }
      bar.textContent = "Page error: " + msg;
    } catch(_) {}
  }, true);

  window.addEventListener("unhandledrejection", function(e) {
    try {
      var msg = (e && e.reason && (e.reason.message || e.reason)) ? (e.reason.message || String(e.reason)) : "Unhandled promise rejection";
      console.error("Zummee rejection:", e.reason);
      var bar = document.getElementById("zummeeErrorBar");
      if(!bar) {
        bar = document.createElement("div");
        bar.id = "zummeeErrorBar";
        bar.style.position = "fixed";
        bar.style.top = "0";
        bar.style.left = "0";
        bar.style.right = "0";
        bar.style.zIndex = "1000000";
        bar.style.background = "#b91c1c";
        bar.style.color = "#fff";
        bar.style.padding = "10px 14px";
        bar.style.fontFamily = "ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial";
        bar.style.fontSize = "13px";
        bar.style.boxShadow = "0 4px 14px rgba(0,0,0,.25)";
        bar.style.cursor = "pointer";
        bar.title = "Click to dismiss";
        bar.addEventListener("click", function(){ bar.remove(); });
        document.documentElement.appendChild(bar);
      }
      bar.textContent = "Page error: " + msg;
    } catch(_) {}
  });
})();

// deleteProfile injected

// ---- truthyFlag helper (hoisted global) ----
function truthyFlag(v){
  if(v === true) return true;
  if(v === false || v == null) return false;
  if(typeof v === 'number') return v !== 0;
  if(typeof v === 'string'){
    const s = v.trim().toLowerCase();
    if(!s) return false;
    return (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on');
  }
  return !!v;
}
window.truthyFlag = window.truthyFlag || truthyFlag;

// v728: show locked company pill for supervisors (keeps select disabled with one option)
document.addEventListener("DOMContentLoaded", function(){
  ensureSupabase().then(function(sb){
    return resolveRoleCompany(sb).then(function(sc){
      try{ window.__sc_role = sc && sc.role ? sc.role : window.__sc_role; }catch(_e){}

      try{ if(sc && sc.role){ window.currentUserRole = sc.role; localStorage.setItem('userRole', sc.role); } }catch(_e){}

      if(sc && sc.role && sc.role !== "companyadmin" && sc.companyId){
        var sel = document.getElementById("sup_adminCompanyPicker");
        if(!sel) return;
        // ensure only one option
        sel.innerHTML = "";
        var o = document.createElement("option");
        o.value = sc.companyId;
        o.textContent = sc.companyName || "My Company";
        sel.appendChild(o);
        sel.value = sc.companyId;
        sel.disabled = true;
        // hide select but show pill
        var pillId="sup_lockedCompanyPill";
        var pill=document.getElementById(pillId);
        if(!pill){
          pill=document.createElement("div");
          pill.id=pillId;
          pill.style.display="inline-flex";
          pill.style.alignItems="center";
          pill.style.padding="10px 12px";
          pill.style.border="1px solid rgba(15,47,74,0.25)";
          pill.style.borderRadius="12px";
          pill.style.background="rgba(255,255,255,0.85)";
          pill.style.fontWeight="800";
          pill.style.minWidth="280px";
        }
        pill.textContent = sc.companyName || "My Company";
        sel.style.display="none";
        if(sel.parentNode && pill.parentNode!==sel.parentNode){
          sel.parentNode.insertBefore(pill, sel);
        }
      }
    });
  }).catch(function(){});
});


function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




/* v756: Branded Create Company modal (match Add Community style) */
(function(){
  function qs(id){ return document.getElementById(id); }

  function init(){
    const modal = qs("zummeeCreateCompanyModal");
    if(!modal) return false; // modal markup appears later in the HTML; retry after DOM is ready

    const input = qs("zummeeCreateCompanyName");
    const errBox = qs("zummeeCreateCompanyError");
    const btnCancel = qs("zummeeCreateCompanyCancel");
    const btnGo = qs("zummeeCreateCompanyGo");

  function showError(msg){
    if(!msg){ errBox.textContent=""; errBox.classList.remove("is-show"); return; }
    errBox.textContent = msg;
    errBox.classList.add("is-show");
  }

  function open(prefill){
    showError("");
    modal.setAttribute("aria-hidden","false");
    input.value = String(prefill||"");
    setTimeout(()=>{ try{ input.focus(); input.select(); }catch(_e){} }, 0);
    window.__zummeeCreateCompanyOpen = true;
  }
  function close(){
    modal.setAttribute("aria-hidden","true");
    showError("");
    window.__zummeeCreateCompanyOpen = false;
    try{ btnGo.disabled = false; }catch(_e){}
    try{ btnGo.textContent = "Create & Switch"; }catch(_e){}
  }

  // Expose opener
  window.openCreateCompanyModal = open;

  // Close on backdrop click
  modal.addEventListener("click", (e)=>{ if(e.target === modal) close(); });

  document.addEventListener("keydown", (e)=>{
    if(!window.__zummeeCreateCompanyOpen) return;
    if(e.key === "Escape") close();
    if(e.key === "Enter"){
      if(!e.shiftKey){ e.preventDefault(); btnGo.click(); }
    }
  });

  btnCancel.addEventListener("click", close);

    btnGo.addEventListener("click", async ()=>{
    const name = String(input.value||"").trim();
    if(!name){ showError("Please enter a company name."); return; }
    if(btnGo.dataset.busy === "1") return;
    btnGo.dataset.busy = "1";
    showError("");
    try{
      btnGo.disabled = true;
      btnGo.textContent = "Working...";
    }catch(_e){}
    try{
      if(typeof window.createCompanyAndSwitch === "function"){
await window.createCompanyAndSwitch(name);
        // createCompanyAndSwitch reloads on success
        close();
        return;
      }
      showError("Create function not available on this build.");
    }catch(e){
      showError(e?.message || String(e));
      try{ btnGo.disabled = false; btnGo.textContent = "Create & Switch"; }catch(_e){}
    } finally {
      btnGo.dataset.busy = "0";
    }
    });
    return true;
  }

  // Attempt init immediately; if markup isn't parsed yet, init on DOMContentLoaded.
  if(!init()){
    document.addEventListener("DOMContentLoaded", ()=>{ init(); }, { once:true });
    // Also try a short retry for cases where scripts execute before DOMContentLoaded fires.
    setTimeout(()=>{ try{ init(); }catch(_e){} }, 0);
  }
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// Global company resolver (used across Supervisor/Admin flows)
// Some modules previously defined getCompany() inside closures; assignment scripts need a true global.
(function(){
  if(typeof window.getCompany === "function") return;

  function safeGet(k){ try{ return localStorage.getItem(k)||""; }catch(e){ return ""; } }

  window.getCompany = function(){
    try{
      // 1) If a company dropdown exists on the page, trust it first.
      var sel = document.getElementById("sup_companySelect") || document.getElementById("admin_companySelect") || document.getElementById("companySelect");
      if(sel && sel.value){
        var v = String(sel.value||"").trim();
        if(v) return v;
      }

      // 2) Admins can pick a company explicitly
      var auth = window.ZUMMEE_AUTH || {};
      var role = String(auth.role || window.__zummeeUserRole || "").trim();
      if(role === "Admin"){
        var picked = String(safeGet("zummee_admin_selected_company")||"").trim();
        if(picked) return picked;
      }

      // 3) Fallbacks used across the app
      return String(window.__zummeeCompany || safeGet("zummee_company") || "").trim();
    }catch(e){
      return String(safeGet("zummee_company")||"").trim();
    }
  };
})();

// Global key helper used by Supervisor community assignment + caching flows.
// Some scripts call companyCommunitiesKey(company) directly.
if(typeof window.companyCommunitiesKey !== "function"){
  function companyCommunitiesKey(company){
    var c = String(company || (typeof window.getCompany === "function" ? window.getCompany() : "") || "").trim();
    if(!c) c = "__no_company__";
    var slug = c.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
    return "zummee_company_communities__" + slug;
  }
  window.companyCommunitiesKey = companyCommunitiesKey;
}

// JSON localStorage helpers (used across Supervisor modules)
if(typeof window.loadJSON !== "function"){
  window.loadJSON = function loadJSON(key, fallback){
    try{
      var raw = localStorage.getItem(String(key||""));
      if(raw === null || raw === undefined || raw === "") return fallback;
      return JSON.parse(raw);
    }catch(e){
      return fallback;
    }
  };
}
if(typeof window.saveJSON !== "function"){
  window.saveJSON = function saveJSON(key, value){
    try{
      localStorage.setItem(String(key||""), JSON.stringify(value));
      return true;
    }catch(e){
      return false;
    }
  };
}

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




  // Global community keys (some scripts reference these identifiers directly)
  var COMMUNITIES_KEY = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || "zummee_communities_v1";
  var SELECTED_COMMUNITY_KEY = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY) || "zummee_selected_community_v1";
  var ZUMMEE_SELECTED_COMMUNITY_KEY = "zummee_selected_community_v1";

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  async function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

  function normRole(r){
    return String(r||"").toLowerCase().replace(/\s+/g, "").trim();
  }
  function isAllowedRole(role, department){
    const r = normRole(role);
    const d = normRole(department);
    // Allow Admin in all cases (including any string containing 'admin')
    if(r === "admin" || r === "companyadmin" || (r && r.indexOf("admin") >= 0)) return true;
    // roles can be stored in either role or department (older builds used department = "Supervisor")
    return (r === "supervisor" || d === "supervisor");
  }

  async function ensureSB(){
    // Supabase init can be slightly delayed depending on script load order.
    // Retry briefly before giving up.
    const start = Date.now();
    while(Date.now() - start < 2500){
      if(window.sb) return true;
      if(typeof window.ensureSupabase === "function"){
try{ await window.ensureSupabase(); }catch(_e){}
      }
      if(window.sb) return true;
await new Promise(r => setTimeout(r, 150));
    }
    return !!window.sb;
  }

  function getLocalRole(){
    try{
      return (
        (window.ZUMMEE_AUTH && (window.ZUMMEE_AUTH.role || window.ZUMMEE_AUTH.department)) ||
        localStorage.getItem('zummee_role') ||
        localStorage.getItem('role') ||
        ''
      );
    }catch(_e){ return ''; }
  }

  async function loadServerRole(){
    // Get current auth user id from supabase
if(!(await ensureSB())) return null;
    try{
const s = await window.sb.auth.getSession();
      const uid = s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null;
      if(!uid) return null;
      // Try userdirectory table
const q = await window.sb.from('userdirectory').select('role,approved,company_id').eq('auth_user_id', uid).maybeSingle();
      if(q && q.data) return q.data;
    }catch(e){
      console.warn('Supervisor guard: failed to read server role', e);
    }
    return null;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try{
      // Prefer server truth, but don't hard-fail if Supabase hasn't initialized yet.
      let p = await loadServerRole();

      if(p){
        try{ if(p.role){ localStorage.setItem('userRole', p.role); window.currentUserRole = p.role; } }catch(_e){}
        const ok = isAllowedRole(p.role, p.department) && (p.approved === true);
        if(!ok){
          alert('Access denied.');
          location.href = "manager_hub.html";
          return;
        }
      } else {
        // Fallback: only deny when we *know* the cached role is not allowed.
        // If role isn't cached yet, don't block navigation; Supabase role check will run shortly.
        const lr = getLocalRole();
        if(lr && !isAllowedRole(lr, null)){
          alert('Access denied.');
          location.href = "manager_hub.html";
          return;
        }
        console.warn('Supervisor guard: proceeding with local role fallback (Supabase not ready to verify).');
      }

      // NOTE: Employee Management/Directory section is intentionally kept on Supervisor Access.
    }catch(e){
      // If something truly unexpected happens, fail CLOSED for safety
      console.warn("Supervisor guard error:", e);
      alert("Access denied.");
      location.href = "manager_hub.html";
    }
  });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




  // Build marker (for debugging/caching verification)
  window.__ZUMMEE_BUILD = 'v806';
  window.__ZUMMEE_DISABLE_CC_LIST = true; // disable legacy CC community list renderer
  console.log('Zummee build v879_SUPERVISOR_EMPLOYEE_MGMT_ROLE_UI_NAMES loaded');

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v844: admin scope helpers
function getActiveCompanyScope(){
  try{
    var s = localStorage.getItem('activeCompanyScope');
    return (s === 'COMPANY') ? 'COMPANY' : 'ALL';
  }catch(e){ return 'ALL'; }
}
function getScopedCompanyId(role){
  try{
    var r = String(role||'').toLowerCase();
    if(r.indexOf('admin')>=0){
      // default ALL unless explicitly set to COMPANY
      if(!localStorage.getItem('activeCompanyScope')) localStorage.setItem('activeCompanyScope','ALL');
      return (getActiveCompanyScope()==='COMPANY') ? (localStorage.getItem('activeCompanyId')||null) : null;
    }
    return localStorage.getItem('activeCompanyId')||null;
  }catch(e){ return localStorage.getItem('activeCompanyId')||null; }
}

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v845: ensure admin scope default
(function(){
  try{
    var r = String(window.currentUserRole || window.userRole || '').toLowerCase();
    if(r.indexOf('admin')>=0){
      if(!localStorage.getItem('activeCompanyScope')) localStorage.setItem('activeCompanyScope','ALL');
    }
  }catch(e){}
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  function applyPageTitle(){
    try{
      var t = (document.body && document.body.dataset && document.body.dataset.pageTitle) ? document.body.dataset.pageTitle : "";
      if(!t) return;
      // Update browser tab title
      document.title = t;
      // Update on-page header (prefer the primary page H1)
      var h1 = document.querySelector('.wrap > h1') || document.querySelector('.wrap h1');
      if(h1) h1.textContent = t;
    }catch(e){ /* no-op */ }
  }
  document.addEventListener('DOMContentLoaded', applyPageTitle);
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




  // --- Cloud Communities (company-wide) ---
  (function(){
    const SUPABASE_URL = "https://slcwuuwyrgnmlmxpcaim.supabase.co";
    const SUPABASE_KEY = "sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864";

    async function ensureSupabase() {
      if(window.sb) return window.sb;
      if(!window.supabase) throw new Error("Supabase library not loaded");
      window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { storageKey:'sb-zummee-auth', storage: window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true  }
      });

      // --- Auth bootstrap fallback ---
      // If we already have an sb-zummee-auth payload in localStorage but supabase-js
      // hasn't hydrated the session yet, force-hydrate it so getSession/getUser works.
      try {
        const raw = window.localStorage.getItem('sb-zummee-auth');
        if(raw) {
          const s = JSON.parse(raw);
          const access_token = s?.access_token || s?.currentSession?.access_token;
          const refresh_token = s?.refresh_token || s?.currentSession?.refresh_token;
          if(access_token && refresh_token) {
await window.sb.auth.setSession({ access_token, refresh_token });
          }

          // Also cache uid for pages that rely on it.
          if(!window.localStorage.getItem('zummee_user_id_v1') && access_token) {
            const payload = JSON.parse(atob(access_token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
            if(payload?.sub) window.localStorage.setItem('zummee_user_id_v1', payload.sub);
          }
        }
      } catch(_e) {}
      return window.sb;
    }

    // Back-compat helper used by newer patches.
    // Synchronous: returns the initialized Supabase client.
    // (Initialization happens earlier via ensureSupabase during boot.)
    function getSupabaseClientSafe(){
      if(window.sb) return window.sb;
      throw new Error('Supabase client not initialized');
    }

    // Expose these helpers globally (this block lives inside an IIFE).
    // Other script blocks call getSupabaseClientSafe/ensureSupabase.
    window.ensureSupabase = window.ensureSupabase || ensureSupabase;
    window.getSupabaseClientSafe = window.getSupabaseClientSafe || getSupabaseClientSafe;

    async function getSessionSafe(sb, ms){
      ms = ms || 5000;
return await Promise.race([
        sb.auth.getSession(),
        new Promise((resolve) => {
          let done = false;
          const sub = sb.auth.onAuthStateChange((event, session) => {
            if(done) return;
            if(event === 'INITIAL_SESSION' || session){
              done = true;
              try{ sub.data.subscription.unsubscribe(); }catch(_e){}
              resolve({ data: { session } });
            }
          });
          setTimeout(() => {
            if(done) return;
            done = true;
            try{ sub.data.subscription.unsubscribe(); }catch(_e){}
            resolve({ data: { session: null }, error: new Error('session timeout') });
          }, ms);
        })
      ]);
    }

    // Expose safe auth helpers globally so other script blocks can avoid auth.getUser() hangs.
    try{
      if(!window.ZUMMEE_AUTH) window.ZUMMEE_AUTH = {};
      window.ZUMMEE_AUTH.getSessionResultSafe = async function(ms){
const client = await ensureSupabase();
return await getSessionSafe(client, ms || 5000);
      };
      window.ZUMMEE_AUTH.getUserResultSafe = async function(ms){
const s = await window.ZUMMEE_AUTH.getSessionResultSafe(ms || 5000);
        const user = (s && s.data && s.data.session) ? (s.data.session.user || null) : null;
        return { data: { user } };
      };
      window.ZUMMEE_AUTH.requireUidSafe = async function(ms){
const r = await window.ZUMMEE_AUTH.getUserResultSafe(ms || 5000);
        const uid = r && r.data && r.data.user ? r.data.user.id : null;
        if(!uid) throw new Error('Not signed in');
        return uid;
      };

      // Back-compat: some script blocks call a global getSessionSafe(timeoutMs)
      // that should return a session object (or null). Provide a global wrapper.
      if(!window.getSessionSafe){
        window.getSessionSafe = async function(timeoutMs){
          try{
const res = await window.ZUMMEE_AUTH.getSessionResultSafe(timeoutMs || 3500);
            return (res && res.data) ? (res.data.session || null) : null;
          }catch(_e){
            return null;
          }
        };
      }
    }catch(_e){}

    function safeLocalSet(k,v){ try{ localStorage.setItem(k,v); }catch(_e){} }
    function safeLocalGet(k){ try{ return localStorage.getItem(k)||""; }catch(_e){ return ""; } }


// --- Company helpers (Supabase) ---
// DB uses a "Companies" table (capital C) and PropertyCommunities has company_id + company.
const __companyCache = new Map(); // name -> { id, name }

async function getCompanyRowByName(sb, companyName){
  const key = (companyName||"").trim();
  if(!key) throw new Error('No company selected');
  if(__companyCache.has(key)) return __companyCache.get(key);

  // Try Companies table first
let r = await sb.from('Companies').select('id,name').eq('name', key).maybeSingle();
  if(r.error){
    // Some projects used a lowercase companies table; fallback.
r = await sb.from('companies').select('id,name').eq('name', key).maybeSingle();
  }
  if(r.error) throw r.error;
  if(!r.data) throw new Error('Company not found in Companies table: '+key);
  __companyCache.set(key, r.data);
  return r.data;
}

// Back-compat helper: some code paths call window.getCompanyRow(companyName)
// without passing an sb client. Keep this wrapper so cloud sync does not
// crash and spam render loops.
window.getCompanyRow = async function(companyKey){
const sb = await ensureSupabase();
	const key = String(companyKey||"").trim();
	if(!key) throw new Error("Company key missing");
	// Accept either company NAME or company UUID
	if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)){
const r = await sb.from('Companies').select('id,name,code').eq('id', key).maybeSingle();
		if(r.error) throw r.error;
		if(!r.data) throw new Error('Company not found in Companies table: '+key);
		return r.data;
	}
return await getCompanyRowByName(sb, key);
}
async function getCompanyIdByName(sb, companyName){
const row = await getCompanyRowByName(sb, companyName);
  return row.id;
}

    async function requireUid() {
const sb = await ensureSupabase();
const s = await getSessionSafe(sb, 5000);
      const uid = s.data?.session?.user?.id;
      if(uid) return uid;
      const cached = localStorage.getItem('zummee_user_id_v1');
      if(cached) {
        console.warn("Auth session not available yet; using cached uid.", cached);
        return cached;
      }

	      // Fallback: pull uid from the persisted sb-zummee-auth payload
	      try{
	        const raw = localStorage.getItem('sb-zummee-auth');
	        if(raw){
	          const s2 = JSON.parse(raw);
	          const token = s2?.access_token || s2?.currentSession?.access_token;
	          if(token && token.includes('.')){
	            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
	            const sub = payload?.sub;
	            if(sub){
	              localStorage.setItem('zummee_user_id_v1', String(sub));
	              console.warn("Auth session missing; derived uid from sb-zummee-auth.", sub);
	              return String(sub);
	            }
	          }
	        }
	      }catch(_e){}

      throw new Error("Not signed in");
    }

    async function getProfile() {
const sb = await ensureSupabase();
const uid = await requireUid();

      // Defaults from session (works even if Profiles table read fails)
      let company0 = "";
      let selected0 = "";
      let dept = "";
      let role = "";
      let name = "";

      let email = "";
      try{
const sess = (await sb.auth.getSession()).data?.session;
        email = String(sess?.user?.email||"").toLowerCase();
      }catch(_e){}

      // Try Profiles table (best source of truth)
      // NOTE: Some databases don't have selected_community_id yet; request it separately to avoid 400s.
      try{
const q = await sb.from("userdirectory").select(`
id,
auth_user_id,
company_id,
role,
approved,
created_at,
profiles:auth_user_id ( name, email, phone )
`).eq("id", uid).maybeSingle();
        if(!q.error && q.data){
          company0 = (q.data.company||"").trim();
          dept = (q.data.department||"").trim();
          role = (q.data.role||"").trim();
          name = (q.data.name||"").trim();
        }
      }catch(_e){ /* fall back to session + local */ }

      // selected community (optional column)
      // If your Profiles table doesn't have this column yet, PostgREST will return 400.
      // We memoize that and stop requesting it to avoid noisy console errors.
      try{
        const hasCol = safeLocalGet('zummee_profiles_has_selected_community_id');
        if(hasCol !== '0'){
const q2 = await sb.from("userdirectory").select(`
id,
auth_user_id,
company_id,
role,
approved,
created_at,
profiles:auth_user_id ( name, email, phone )
`).eq("id", uid).maybeSingle();
          if(!q2.error && q2.data){
            selected0 = (q2.data.selected_community_id||"").trim();
            safeLocalSet('zummee_profiles_has_selected_community_id','1');
          } else if(q2.error){
            safeLocalSet('zummee_profiles_has_selected_community_id','0');
          }
        }
      }catch(_e){ safeLocalSet('zummee_profiles_has_selected_community_id','0'); }

      // Fallback to local selected community if DB column isn't present
      if(!selected0){
        try{ selected0 = String(localStorage.getItem("zummee_selected_community_id")||"").trim(); }catch(_e){}
      }

      // Bootstrap Admin fallback + local company fallback
      if(email === "companyadmin@zummee.local"){
        if(!role) role = "Admin";
        if(!dept) dept = "Supervisor";
        if(!name) name = "CompanyAdmin";
      }

      let company = company0;
      if(!company){
        try{ company = String(localStorage.getItem("zummee_company")||"").trim(); }catch(_e){}
      }

      // Global auth state: single source of truth for UI gates
      try{
        window.ZUMMEE_AUTH = window.ZUMMEE_AUTH || {};
        window.ZUMMEE_AUTH.isLoggedIn = true;
        window.ZUMMEE_AUTH.userId = uid;
        window.ZUMMEE_AUTH.email = email;
        window.ZUMMEE_AUTH.name = name || window.ZUMMEE_AUTH.name || "";
        window.ZUMMEE_AUTH.company = company || window.ZUMMEE_AUTH.company || "";
        window.ZUMMEE_AUTH.department = dept || window.ZUMMEE_AUTH.department || "";
        window.ZUMMEE_AUTH.role = role || window.ZUMMEE_AUTH.role || "";
      }catch(_e){}

      // Expose legacy globals + notify listeners (Supervisor Access, badges, etc.)
      try{
        window.__zummeeCompany = company;
        window.__zummeeUserDepartment = dept;
        window.__zummeeUserRole = role;
        window.__zummeeUserName = name;
        window.dispatchEvent(new CustomEvent("profile:loaded", { detail: { userId: uid, company: company, department: dept, role: role, name: name, id: uid } }));
        window.dispatchEvent(new CustomEvent("auth:ready", { detail: window.ZUMMEE_AUTH }));
      }catch(_e){}

      return { uid, company: company, selected: selected0, department: dept, role: role, name: name };
    }

    function els() {
      return {
        select: document.getElementById("zummeeCommunitySelect"),
        swatch: document.getElementById("zummeeCommunitySwatch"),
        btnAdd: document.getElementById("zummeeCommunityAdd"),
        btnRename: document.getElementById("zummeeCommunityRename"),
        btnRemove: document.getElementById("zummeeCommunityRemove"),
      };
    }

    function setSwatch(company){
      const e = els().swatch;
      if(!e) return;
      let h=0; for(let i=0;i<company.length;i++) h=(h*31 + company.charCodeAt(i))>>>0;
      const hue = h % 360;
      e.style.background = `hsl(${hue} 70% 45%)`;
      e.title = company || "No company";
    }


    function rebindButton(btn, handler){
      if(!btn || !btn.parentNode) return btn;
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.onclick = handler;
      return clone;
    }


    function hardBind(btn, handler){
      if(!btn) return btn;
      // remove inline onclick if any
      try{ btn.onclick = null; btn.removeAttribute("onclick"); }catch(_e){}
      // Remove any previously attached listeners by replacing node (inline attrs will be re-applied below if present in HTML, so also remove onclick)
      const clone = btn.cloneNode(true);
      try{ clone.onclick = null; clone.removeAttribute("onclick"); }catch(_e){}
      btn.parentNode && btn.parentNode.replaceChild(clone, btn);
      // Capture-phase handler to prevent any other handlers from firing (old + new)
      clone.addEventListener("click", function(ev){
        try{ ev.preventDefault(); }catch(_e){}
        try{ ev.stopImmediatePropagation(); }catch(_e){}
        return handler();
      }, true);
      return clone;
    }

    function bindSelect(select) {
      if(!select) return;
      select.onchange = async ()=>{
        const val = String(select.value||"").trim();
        safeLocalSet("zummee_selected_community_id", val);
        try{
const sb = await ensureSupabase();
const uid = await requireUid();
await sb.from("userdirectory").update({ selected_community_id: val || null }).eq("id", uid);
        }catch(_e){}
        document.dispatchEvent(new CustomEvent("community:changed", { detail: { community_id: val } }));
      };
    }

    function getLocalCommunitiesKey(profile){
      // Communities are stored per-user (scoped via ZUMMEE_applyUserScope).
      return (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || ("zummee_communities_v1__user__" + profile.uid);
    }

    function readLocalCommunities(profile){
      try{
        const raw = localStorage.getItem(getLocalCommunitiesKey(profile)) || "[]";
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr : [];
      }catch(_e){
        return [];
      }
    }

    function writeLocalCommunities(profile, list){
      try{ localStorage.setItem(getLocalCommunitiesKey(profile), JSON.stringify(list||[])); }catch(_e){}
    }

    async function listCommunities(profile) {
      // User-only communities (no company-wide list on this screen).
      const list = readLocalCommunities(profile);
      // Ensure stable shape + sort by name
      return list
        .filter(c=>c && c.id && c.name)
        .map(c=>({ id:String(c.id), name:String(c.name) }))
        .sort((a,b)=>a.name.localeCompare(b.name));
    }

    function renderSelect(select, list, selectedId) {
      if(!select) return;
      const desired = String(selectedId||"").trim() || safeLocalGet("zummee_selected_community_id");
      select.innerHTML = "";
      const o0 = document.createElement("option");
      o0.value = "";
      o0.textContent = list.length ? "Select a community" : "No communities yet";
      select.appendChild(o0);

      list.forEach(c=>{
        const o=document.createElement("option");
        o.value = String(c.id);
        o.textContent = c.name;
        select.appendChild(o);
      });

      if(desired && list.some(c=>String(c.id)===String(desired))) {
        select.value = String(desired);
      } else {
        // No saved selection for this company.
        // Keep the placeholder option, but on supervisor_access auto-select the first community (if available)
        // so the control never looks "stuck" or blank.
        select.value = "";
        try{ safeLocalSet("zummee_selected_community_id",""); }catch(_e){}
        try{
          var role = String((profile && profile.role) || '').trim().toLowerCase();
var approved = !!(profile && profile.approved);
var isSup = approved && (role === 'supervisor' || role === 'admin' || role === 'companyadmin');
          var firstId = (list && list.length && list[0] && list[0].id) ? String(list[0].id) : "";
          if(isSup && firstId){
            // Defer setting the value until after the browser has committed the new <option> nodes.
            requestAnimationFrame(()=> {
              try{
                select.value = firstId;
                try{ safeLocalSet("zummee_selected_community_id", firstId); }catch(_e){}
                // Fire change on next tick for any dependent UI, but never let it break rendering.
                setTimeout(()=>{ try{ select.dispatchEvent(new Event("change",{bubbles:true})); }catch(_e){} }, 0);
              }catch(_e){}
            });
          }
        }catch(_e){}
      }
    }

    async function addCommunity(){
const profile = await getProfile();
      if(!profile.company) return alert("Set your Management Company in Profile first.");
      const name = prompt("Community name:");
      if(!name) return;
      const clean = name.trim();
      if(!clean) return;

      const list = readLocalCommunities(profile);
      const exists = list.some(c=>String(c.name||"").trim().toLowerCase() === clean.toLowerCase());
      if(exists) return alert("That community already exists in your list.");

      const id = String(Date.now()) + "_" + Math.random().toString(16).slice(2);
      list.push({ id, name: clean });
      writeLocalCommunities(profile, list);

      document.dispatchEvent(new CustomEvent("communities:changed"));
      // refreshUI lives in the main Supervisor script scope; call it defensively from this closure.
try{ await (window.refreshUI ? window.refreshUI() : Promise.resolve()); }catch(_e){}
      const {select} = els();
      if(select){ select.value = String(id); select.dispatchEvent(new Event("change")); }
    }

    async function renameCommunity(){
      const e = els();
const profile = await getProfile();
      const id = String(e.select?.value||"").trim();
      if(!id) return alert("Select a community first.");
      const cur = e.select.options[e.select.selectedIndex]?.textContent || "";
      const name = prompt("New community name:", cur);
      if(!name) return;
      const clean = name.trim();
      if(!clean) return;

      const list = readLocalCommunities(profile);
      const idx = list.findIndex(c=>String(c.id)===String(id));
      if(idx === -1) return;
      list[idx].name = clean;
      writeLocalCommunities(profile, list);

      document.dispatchEvent(new CustomEvent("communities:changed"));
try{ await (window.refreshUI ? window.refreshUI() : Promise.resolve()); }catch(_e){}
      if(e.select) e.select.value = id;
    }

    async function removeCommunity(){
      const e = els();
const profile = await getProfile();
      const id = String(e.select?.value||"").trim();
      if(!id) return alert("Select a community first.");
      if(!confirm("Remove this community from your list?")) return;

      const list = readLocalCommunities(profile).filter(c=>String(c.id)!==String(id));
      writeLocalCommunities(profile, list);

      // Clear selected if it was removed
      try{
const sb = await ensureSupabase();
await sb.from("userdirectory").update({ selected_community_id: null }).eq("id", profile.uid);
      }catch(_e){}
      safeLocalSet("zummee_selected_community_id","");

      document.dispatchEvent(new CustomEvent("communities:changed"));
try{ await (window.refreshUI ? window.refreshUI() : Promise.resolve()); }catch(_e){}
      document.dispatchEvent(new CustomEvent("community:changed", { detail: { community_id: "" } }));
    }

    document.addEventListener("DOMContentLoaded", ()=>{
      const e = els();
      bindSelect(e.select);
      if(e.btnAdd) e.btnAdd = rebindButton(e.btnAdd, addCommunity);
      if(e.btnRename) e.btnRename = rebindButton(e.btnRename, renameCommunity);
      if(e.btnRemove) e.btnRemove = rebindButton(e.btnRemove, removeCommunity);
      try{ window.refreshUI && window.refreshUI(); }catch(_e){}
      try{ window.__zummeeCommunityMgmtV2Bound = true; }catch(_e){}
    });

    document.addEventListener("communities:changed", ()=>{ try{ window.refreshUI && window.refreshUI(); }catch(_e){} });
  })();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }



(()=>{ if(window.ZummeeAuth) window.ZummeeAuth.requireAuth(); })();
function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




  // Supabase init (shared)
  var SUPABASE_URL = "https://slcwuuwyrgnmlmxpcaim.supabase.co";
  var SUPABASE_KEY = "sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864";
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { storageKey:'sb-zummee-auth', storage: window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true  }
  });

  // --- Cloud Communities (Hub) ---
  async function requireUid(){
const u = await (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.getUserResultSafe ? window.ZUMMEE_AUTH.getUserResultSafe(5000) : window.sb.auth.getUser());
    const uid = u.data?.user?.id;
    if(!uid) throw new Error("Not signed in");
    return uid;
  }


// --- Cloud communities + assignments helpers (schema-aware) ---
// PropertyCommunities: id, name, company_id, company (text)
// CommunityAssignments: id, company (text), community_id (uuid), user_id (uuid)

async function syncCompanyFromCloud(company){
  // Guard: "All companies" is a UI-only scope option (not a real company row)
  // Also guard against placeholder strings like "Loading companies...".
  var companyKey = String(company||'').trim();
  if (!companyKey || companyKey === 'All companies' || /loading\s+companies/i.test(companyKey)) {
    // If we already have a valid activeCompanyId, use it; otherwise skip silently.
    var cid = (typeof getActiveCompanyIdSafe === 'function') ? getActiveCompanyIdSafe() : null;
    if(cid) companyKey = cid;
    else return true;
  }
    function __safeCall(fn, args){
      try{
        if(typeof fn === "function") return fn.apply(null, args||[]);
      }catch(e){}
      return null;
    }

  try{
const sb = await ensureSupabase();
const crow = await window.getCompanyRow(companyKey);
    const companyId = crow && crow.id ? crow.id : null;
    const companyName = String((crow && crow.name) ? crow.name : '').trim();
    const companyForKeys = companyName || companyKey;
    if(!companyId) throw new Error('Could not resolve company_id for: ' + companyKey);

    // Load all communities for this company
const qc = await sb
      .from('PropertyCommunities')
      .select('id,name,company_id,company,created_at')
      .eq('company_id', companyId)
      .order('name', { ascending:true });
    if(qc.error) throw qc.error;


    // v792: Cache PropertyCommunities id->name map for this company_id (used by renderCompanyCommunities when cached rows lack names)
    try{
      var __pcNameMap = {};
      (qc.data||[]).forEach(function(r){
        try{
          if(r && r.id){
            __pcNameMap[String(r.id)] = String(r.name||"").trim();
          }
        }catch(_e){}
      });
      localStorage.setItem("zummee_pc_namebyid__"+companyId, JSON.stringify(__pcNameMap));
      window.__pcNameById = window.__pcNameById || {};
      window.__pcNameById[String(companyId)] = __pcNameMap;
    }catch(_e){}
    // v698: cache communities by companyId for instant switching
    try{
      var names = (qc.data||[]).map(function(r){ return String(r && r.name ? r.name : "").trim(); }).filter(Boolean);
      localStorage.setItem("zummee_company_communities_by_companyid__"+companyId, JSON.stringify(names));
    }catch(_e){}


    // Load assignments for the communities in this company (avoid brittle company-text matching)
    const ids = (qc.data||[]).map(r=>r.id).filter(Boolean);
    let qa = { data: [] };
    if(ids.length){
qa = await sb
        .from('CommunityAssignments')
        .select('community_id,user_id,created_at,company_id,company')
        .in('community_id', ids)
        .order('created_at', { ascending:false });
      if(qa.error) throw qa.error;
    }

    // Build map: community_id -> user_id (latest wins)
    const map = {};
    (qa.data || []).forEach(r => { if(map[r.community_id] === undefined) map[r.community_id] = r.user_id; });

    // Store in local (keep legacy + new keys in sync)
    try{ localStorage.setItem(companyCommunitiesKey(companyForKeys), JSON.stringify(qc.data||[])); }catch(_e){}
    try{ localStorage.setItem(companyAssignmentsKey(companyForKeys), JSON.stringify(map)); }catch(_e){}
    // Legacy key used by parts of the UI
    try{
      if(typeof assignmentsKey === "function"){
        localStorage.setItem(assignmentsKey(companyForKeys), JSON.stringify(map));
      }
    }catch(_e){}

    // Refresh UI
    __safeCall(window.loadCompaniesForSupervisor, []);
    loadEmployeesForSupervisor();
    // currentCompany is typically a display name; tolerate either name or id comparisons
    if(window.currentCompany === companyForKeys || window.currentCompany === companyKey){
      __safeCall(window.loadCompanyCommunities, [companyForKeys]);
      __safeCall(window.renderCompanyCommunities, [companyForKeys]);
      __safeCall(window.renderCompanyCommunitySelect, [companyForKeys]);
      __safeCall(window.renderCommunityAssignmentTable, [companyForKeys]);
    }

    return true;
  }catch(e){
    console.warn('syncCompanyFromCloud failed:', e);
    toast('Cloud sync failed. See console.');
    return false;
  }
}

async function addCommunityToCloud(company, name){
    const sb = getSupabaseClientSafe();
    if(!sb) throw new Error('No Supabase client');

    const crow = (typeof window.getCompanyRow === 'function') ? await window.getCompanyRow(company) : null;
    const companyId = crow?.id || (typeof company === 'string' ? company : null);
    const companyName = (crow?.name || (typeof company === 'string' ? company : '') || '').trim();
    const effectiveCompanyId = companyId || null;

    const schema = await getCCSchema(sb, effectiveCompanyId, companyName);
    const table = schema.table;
    const col = schema.col;
    const nameCol = schema.nameCol || 'name';

    const filterVal = (schema && schema.mode === 'name') ? companyName : effectiveCompanyId;
    if(!filterVal) throw new Error('Missing company scope');

    // duplicate check
    const exists = await sb.from(table).select('id').eq(col, filterVal).ilike(nameCol, name).limit(1);
    if(exists?.error) throw exists.error;
    if(exists?.data && exists.data.length){
      toast('Community already exists in this company.');
      return true;
    }

    const row = {};
    row[nameCol] = name;
    row[col] = filterVal;

    const ins = await sb.from(table).insert(row).select('id').maybeSingle();
    if(ins?.error) throw ins.error;
    toast('Community created.');
    return true;
  }


  // v965: Rename an existing community in the cloud (Supabase) using detected CC schema mode.
  async function doRenameCommunity(company, id, oldName, newName){
    const sb = getSupabaseClientSafe();
    if(!sb) throw new Error('No Supabase client');

    const crow = (typeof window.getCompanyRow === 'function') ? await window.getCompanyRow(company) : null;
    const companyId = crow?.id || (typeof company === 'string' ? company : null);
    const companyName = (crow?.name || (typeof company === 'string' ? company : '') || '').trim();
    const effectiveCompanyId = companyId || null;

    const schema = await getCCSchema(sb, effectiveCompanyId, companyName);
    const table = schema.table;
    const col = schema.col;
    const nameCol = schema.nameCol || 'name';

    const filterVal = (schema && schema.mode === 'name') ? companyName : effectiveCompanyId;
    if(!filterVal) throw new Error('Missing company scope');

    // Only rename within the selected company scope
    const upd = await sb.from(table)
      .update({ [nameCol]: newName })
      .eq('id', id)
      .eq(col, filterVal)
      .select('id')
      .maybeSingle();

    if(upd?.error) throw upd.error;
    if(!upd?.data) throw new Error('Rename failed (not found).');

    return true;
  }
  window.doRenameCommunity = doRenameCommunity;






async function deleteCommunityFromCloud(id, passedCompanyId, skipConfirm){
  const sb = getSupabaseClientSafe();
  if(!sb) return;
  if(skipConfirm === undefined) skipConfirm = false;

  // Determine the active company filter BEFORE schema selection.
  const picker = document.getElementById('sup_ccCompanyPicker');
  const activeCompanyId = (picker && picker.value) ? String(picker.value).trim() : (window.activeCompanyId || null);
  const companyName = (picker && picker.selectedOptions && picker.selectedOptions[0]) ? String(picker.selectedOptions[0].textContent||'').trim() : null;

  // Canonical company id for cloud operations.
  // Some older code referenced `effectiveCompanyId` without declaring it.
  let effectiveCompanyId = passedCompanyId || activeCompanyId || window.activeCompanyId || null;
  // Ensure we have a UUID company_id for tables that require it (PropertyCommunities, CommunityAssignments.company_id).
  // Some legacy pickers used company *name* as the option value, which causes 22P02 / 400s.
  if(effectiveCompanyId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(effectiveCompanyId))){
    try{
      const nm = String(companyName||effectiveCompanyId||'').trim();
      const resolved = (typeof resolveCompanyIdForName==='function') ? await resolveCompanyIdForName(nm) : null;
      if(resolved) effectiveCompanyId = String(resolved);
    }catch(_e){}
  }

  // Get current community name (best-effort) for nicer copy + undo.
  let currentName = null;
  try{
    const list = (typeof loadJSON==='function') ? (loadJSON(window.ccStorageKey||'cc_list', [])||[]) : [];
    const hit = Array.isArray(list) ? list.find(x => String(x.id)===String(id)) : null;
    currentName = hit ? (hit.name||hit.community_name||null) : null;
  }catch(e){}

  const msg = 'Remove this community?' + (currentName ? ('\n\n"' + currentName + '"') : '') + '\n\nThis will also clear any employee assignments for it.';
  const ok = skipConfirm ? true : await (window.zummeeConfirmDeleteCommunity
    ? window.zummeeConfirmDeleteCommunity(msg, { title: 'Delete community', confirmText: 'Delete', danger: true })
    : Promise.resolve(confirm(msg)));
if(!ok) return false;

  const schema = await getCCSchema(sb, effectiveCompanyId, companyName);
  const table = schema.table;
  const col = schema.col;
  const filterVal = (schema && schema.mode === 'name') ? companyName : effectiveCompanyId;

  // Animate row removal immediately for responsiveness.
  try{
    const row = document.querySelector('[data-id="'+String(id)+'"]');
    if(row){
      row.classList.add('is-removing');
      // Ensure height transition has a starting point.
      const h = row.offsetHeight;
      row.style.height = h + 'px';
      // next tick
      setTimeout(()=>{ try{ row.style.height = '0px'; }catch(_e){} }, 10);
    }
  }catch(e){}

  // Best-effort: remove any assignments pointing to this community id (if audit table exists)
  try{
    if(window.companyCommunitiesAuditKey){
      await sb.from('CompanyCommunitiesAudit').delete().eq('community_id', id);
    }
  }catch(e){ /* ignore */ }

  // Delete by primary key only.
  // Some deployments store Communities.company as company *name* (text) while others store company *id* (uuid).
  // Adding an extra company filter can turn a delete into a "successful" no-op (0 rows affected),
  // which makes the row disappear and then pop back on refresh.
  let del = sb.from(table).delete().eq('id', id);
  const r = await del;

  if(r?.error){
    toast('Delete failed: '+r.error.message);
    // undo animation if possible
    try{ const row = document.querySelector('[data-id="'+String(id)+'"]'); if(row){ row.classList.remove('is-removing'); row.style.height=''; } }catch(e){}
    return;
  }

  toast('Deleted.');

  // Also remove from the other possible communities table so it doesn't repopulate (best-effort).
  // IMPORTANT: Communities.id and PropertyCommunities.id are NOT guaranteed to match.
  // So we:
  //  - try delete by id
  //  - AND try delete by (company_id + name) when we can
  try{
    const other = (table === 'Communities') ? 'PropertyCommunities' : 'Communities';
    // attempt 1: by id
    try{ await sb.from(other).delete().eq('id', id); }catch(_e){}

    // attempt 2: by scope + name
    const nm = String(currentName || '').trim();
    if(nm){
      if(other === 'PropertyCommunities'){
        if(effectiveCompanyId){
          await sb.from('PropertyCommunities').delete().eq('company_id', effectiveCompanyId).eq('name', nm);
        }
      }else{
        // Communities.company is company NAME (text) in this project
        const cname = String(companyName||'').trim();
        if(cname){
          await sb.from('Communities').delete().eq('company', cname).eq('name', nm);
        }
      }
    }
  }catch(_e){}

  // Clear employee assignments pointing at this community id (best-effort).
  try{ await sb.from('CommunityAssignments').delete().eq('community_id', id); }catch(_e){}


  // Optimistic UI update so the list stays consistent immediately.
  try{
    if(Array.isArray(window.companyCommunities)){
      window.companyCommunities = window.companyCommunities.filter(c => c && String(c.id) !== String(id));
      if(window.companyCommunitiesById) delete window.companyCommunitiesById[id];
      if(typeof window.renderCompanyCommunities === 'function') window.renderCompanyCommunities(window.companyCommunities);
    }
  }catch(e){}

  // Offer Undo (best-effort)
  try{
    const undoPayload = { id: id, name: currentName, companyId: effectiveCompanyId, companyName: companyName, schema: schema };
    if(window.__zum_showToast && undoPayload.name){
      window.__zum_showToast('Community deleted: '+undoPayload.name, 'Undo', async function(){
        try{
          const s = undoPayload.schema || (await getCCSchema(sb, undoPayload.companyId, undoPayload.companyName));
          const t = s.table;
          const compCol = s.col;
          const compVal = (s && s.mode==='name') ? undoPayload.companyName : undoPayload.companyId;
          const insRow = { id: undoPayload.id, name: undoPayload.name };
          if(compVal) insRow[compCol] = compVal;
          const ins = await sb.from(t).insert([insRow]);
          if(ins?.error) throw ins.error;
          toast('Restored.');
          await refreshCompanyCommunitiesNow();
        }catch(e){
          toast('Undo failed: '+(e?.message||e));
        }
      }, 6000);
    }
  }catch(e){}

  // Refresh after a short delay (non-blocking) to confirm cloud state.
  try{ setTimeout(()=>{ try{ refreshCompanyCommunitiesNow(); }catch(e){} }, 200); }catch(e){}

  return true;
}

// Expose for UI handlers
window.deleteCommunityFromCloud = deleteCommunityFromCloud;



  async function getMyCompany(){
    // Derive company + selected community from local state (userdirectory no longer stores these fields)
const uid = await requireUid();
    const companyId = localStorage.getItem("activeCompanyId") || localStorage.getItem("zummee_company_id") || "";
    const companyName = localStorage.getItem("zummee_company") || "";
    const selectedCommunityId = localStorage.getItem("activeCommunityId") || localStorage.getItem("activeCommunity") || localStorage.getItem("currentCommunityId") || "";
    return { uid, companyId, companyName, company: companyName, selectedCommunityId, selected: selectedCommunityId };
  };

  async function loadCommunities(){
const ctx = await getMyCompany();

    // Prefer explicit companyId (works even when company name isn't set yet, e.g. Employee / Mileage auto-load)
    let companyId = (ctx.companyId||'').trim() || (localStorage.getItem("activeCompanyId")||'').trim() || (localStorage.getItem("zummee_company_id")||'').trim();

    let companyName = (ctx.company||ctx.companyName||'').trim() || (localStorage.getItem("zummee_company")||'').trim();

    // Fallback: resolve companyId from company name if needed
    if(!companyId){
      const cname = (ctx.company||ctx.companyName||'').trim() || (localStorage.getItem("zummee_company")||'').trim();
      companyName = cname;
      if(!cname) return [];
      try{
        const crow = await window.getCompanyRow(cname);
        companyId = crow && crow.id ? String(crow.id).trim() : "";
      }catch(_e){ companyId = ""; }
    }

    if(!companyId) return [];

    // Employees should only see explicitly assigned communities
    const role = String(localStorage.getItem('zummee_role')||'').toLowerCase();
    if(role==='employee'){
      try{
        const qa = await window.sb
          .from('CommunityAssignments')
          .select('community_id')
          .eq('user_id', ctx.uid)
          .eq('company_id', companyId);
        if(qa.error) throw qa.error;
        const ids = (qa.data||[]).map(r=>String(r.community_id||'').trim()).filter(Boolean);
        if(!ids.length) return [];
        const qc = await window.sb
          .from('PropertyCommunities')
          .select('id,name')
          .eq('company_id', companyId)
          .in('id', ids)
          .order('name', {ascending:true});
        if(qc.error) throw qc.error;
        return qc.data || [];
      }catch(e){
        console.warn('Employee community assignment fetch failed:', e);
        return [];
      }
    }

const schema = await (window.getCCSchema ? window.getCCSchema(window.sb) : (async (sb)=>{ 
      const cached = window.__ccSchema;
      if(cached && cached.table && cached.col) return cached;
      let schema = { table:"Communities", col:"company_id" };
      // detect table
      try{
const t = await sb.from(schema.table).select("id").limit(1);
        if(t.error && (String(t.error.message||"").includes("Could not find the table") || String(t.error.code||"")==="PGRST205")) schema.table="communities";
      }catch(e){ schema.table="communities"; }
      // detect column
      try{
const c = await sb.from(schema.table).select("id").limit(1).eq(schema.col, "00000000-0000-0000-0000-000000000000");
        if(c.error && String(c.error.message||"").toLowerCase().includes("company_id") && String(c.error.message||"").toLowerCase().includes("does not exist")) schema.col="company";
      }catch(e){}
      window.__ccSchema = schema;
      return schema;
    })(window.sb));
    const companyKey = (schema.col === "company") ? companyName : companyId;
const q = await window.sb.from(schema.table)
      .select("id,name")
      .eq(schema.col, companyKey)
      .order("name", { ascending:true });
    if(q.error) throw q.error;
    return q.data || [];
  }

  async function ensureDefaultCommunityCloud(){
const ctx = await getMyCompany();
const list = await loadCommunities();
    if(!list.length) return { list:[], selected:"" };
    let selected = ctx.selected;
    if(!selected || !list.find(x => String(x.id) === selected)){
      selected = String(list[0].id);
const up = await window.sb.from("userdirectory")
        .update({ selected_community_id: selected })
        .eq("id", ctx.uid);
      if(up.error) throw up.error;
    }
    return { list, selected };
  }

  
  // --- Modern Community Selector (keeps native <select> for compatibility) ---
  function ensureModernCommunitySelector(select){
    try{
      if(!select || select.dataset.zModernApplied==="1") {
        // even if already applied, refresh option list
        if(select && select.dataset.zModernApplied==="1") refreshModernCommunitySelector(select);
        return;
      }
      const parent = select.parentElement;
      if(!parent) return;

      // Inject styles once
      if(!document.getElementById("zModernCommunityStyle")){
        const st = document.createElement("style");
        st.id = "zModernCommunityStyle";
        st.textContent = `
          .zCommWrap{ position:relative; display:inline-block; min-width:240px; }
          .zCommBtn{
            width:100%;
            display:flex; align-items:center; justify-content:space-between;
            gap:10px;
            padding:8px 12px;
            border-radius:999px;
            border:1px solid rgba(0,0,0,0.12);
            background:#fff;
            color:#0f2f4a;
            font-weight:800;
            cursor:pointer;
            box-shadow:0 2px 8px rgba(0,0,0,0.10);
          }
          .zCommBtn:focus{ outline:2px solid rgba(123,224,0,0.45); outline-offset:2px; }
          .zCommBtn .zCommLabel{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
          .zCommBtn .zCommChevron{ opacity:0.55; font-size:14px; }
          .zCommDrop{
            position:absolute; top:calc(100% + 8px); left:0; right:0;
            background:#fff;
            border:1px solid rgba(0,0,0,0.12);
            border-radius:14px;
            box-shadow:0 18px 42px rgba(0,0,0,0.18);
            z-index:9999;
            padding:10px;
            display:none;
          }
          .zCommDrop.open{ display:block; }
          .zCommSearch{
            width:100%;
            padding:10px 12px;
            border-radius:12px;
            border:1px solid rgba(0,0,0,0.12);
            font-weight:700;
            color:#0f2f4a;
            background:#fff;
          }
          .zCommList{ margin-top:8px; max-height:280px; overflow:auto; }
          .zCommOpt{
            padding:10px 10px;
            border-radius:12px;
            cursor:pointer;
            display:flex; align-items:center; justify-content:space-between;
            gap:10px;
            color:#0f2f4a;
            font-weight:750;
          }
          .zCommOpt:hover{ background:rgba(15,47,74,0.06); }
          .zCommOpt.selected{ background:rgba(123,224,0,0.14); }
          .zCommOpt .zCommCheck{ opacity:0.75; }
        `;
        document.head.appendChild(st);
      }

      // Wrap & hide native select (but keep it in DOM for existing logic)
      const wrap = document.createElement("div");
      wrap.className = "zCommWrap";
      // Insert wrapper before select, then move select into wrapper
      parent.insertBefore(wrap, select);
      wrap.appendChild(select);

      select.style.display = "none";
      select.setAttribute("aria-hidden","true");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zCommBtn";
      btn.id = "zCommBtn";
      btn.innerHTML = `<span class="zCommLabel" id="zCommLabel"></span><span class="zCommChevron">▾</span>`;

      const drop = document.createElement("div");
      drop.className = "zCommDrop";
      drop.id = "zCommDrop";
      drop.innerHTML = `
        <input class="zCommSearch" id="zCommSearch" type="text" placeholder="Search communities..." />
        <div class="zCommList" id="zCommList"></div>
      `;

      wrap.appendChild(btn);
      wrap.appendChild(drop);

      function setLabelFromSelect(){
        const opt = select.selectedOptions && select.selectedOptions[0];
        const label = (opt && opt.textContent || "Select community").trim();
        const labelEl = drop.parentElement.querySelector("#zCommLabel");
        if(labelEl) labelEl.textContent = label;
      }

      function buildList(filterText){
        const listEl = drop.querySelector("#zCommList");
        if(!listEl) return;
        const ft = (filterText||"").toLowerCase().trim();
        const opts = Array.from(select.options || []).filter(o => (o.value||"").trim() !== "");
        listEl.innerHTML = "";
        for(const o of opts){
          const t = (o.textContent||"").trim();
          if(ft && !t.toLowerCase().includes(ft)) continue;
          const row = document.createElement("div");
          row.className = "zCommOpt" + (o.value===select.value ? " selected" : "");
          row.dataset.value = o.value;
          row.innerHTML = `<span>${escapeHtml(t)}</span><span class="zCommCheck">${o.value===select.value ? "✓" : ""}</span>`;
          row.addEventListener("click", () => {
            select.value = o.value;
            setLabelFromSelect();
            // Dispatch change so existing handlers fire
            select.dispatchEvent(new Event("change", { bubbles:true }));
            drop.classList.remove("open");
          });
          listEl.appendChild(row);
        }
        if(!listEl.children.length){
          const empty = document.createElement("div");
          empty.className = "zCommOpt";
          empty.style.cursor = "default";
          empty.style.opacity = "0.65";
          empty.textContent = "No matches";
          listEl.appendChild(empty);
        }
      }

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        drop.classList.toggle("open");
        if(drop.classList.contains("open")){
          setLabelFromSelect();
          buildList(drop.querySelector("#zCommSearch")?.value || "");
          drop.querySelector("#zCommSearch")?.focus();
        }
      });

      drop.querySelector("#zCommSearch")?.addEventListener("input", (e) => {
        buildList(e.target.value);
      });

      document.addEventListener("click", (e) => {
        if(!wrap.contains(e.target)) drop.classList.remove("open");
      });

      // Keep label synced if select changes elsewhere
      select.addEventListener("change", () => {
        setLabelFromSelect();
        buildList(drop.querySelector("#zCommSearch")?.value || "");
      });

      select.dataset.zModernApplied = "1";
      setLabelFromSelect();
      buildList("");
    }catch(_e){
      // fail silently
    }
  }

  
  try{ window.ensureModernCommunitySelector = ensureModernCommunitySelector; }catch(_e){}
function refreshModernCommunitySelector(select){
    try{
      const wrap = select.closest(".zCommWrap");
      if(!wrap) return;
      const drop = wrap.querySelector("#zCommDrop");
      if(!drop) return;
      const search = drop.querySelector("#zCommSearch");
      const btnLabel = wrap.querySelector("#zCommLabel");
      if(btnLabel){
        const opt = select.selectedOptions && select.selectedOptions[0];
        btnLabel.textContent = ((opt && opt.textContent) || "Select community").trim();
      }
      // rebuild list
      const listEl = drop.querySelector("#zCommList");
      if(!listEl) return;
      const ft = (search && search.value || "").toLowerCase().trim();
      const opts = Array.from(select.options || []).filter(o => (o.value||"").trim() !== "");
      listEl.innerHTML = "";
      for(const o of opts){
        const t = (o.textContent||"").trim();
        if(ft && !t.toLowerCase().includes(ft)) continue;
        const row = document.createElement("div");
        row.className = "zCommOpt" + (o.value===select.value ? " selected" : "");
        row.dataset.value = o.value;
        row.innerHTML = `<span>${escapeHtml(t)}</span><span class="zCommCheck">${o.value===select.value ? "✓" : ""}</span>`;
        row.addEventListener("click", () => {
          select.value = o.value;
          select.dispatchEvent(new Event("change", { bubbles:true }));
          drop.classList.remove("open");
        });
        listEl.appendChild(row);
      }
    }catch(_e){}
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

async function renderCommunities(){
    const select = document.getElementById("zummeeCommunitySelect");
    const swatch = document.getElementById("zummeeCommunitySwatch");
    if(!select) return;

const payload = await ensureDefaultCommunityCloud();
    select.innerHTML = "";
    (payload.list||[]).forEach((c, i)=>{
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    if(payload.selected) select.value = payload.selected;
    select.disabled = !(payload.list && payload.list.length);

    // simple swatch
    if(swatch){
      const idx = Math.max(0, Array.from(select.options).findIndex(o => o.value===select.value));
      const colors = ["#2563eb","#16a34a","#d97706","#7c3aed","#dc2626","#0891b2","#9333ea","#4b5563"];
      swatch.style.width="12px"; swatch.style.height="12px"; swatch.style.borderRadius="999px";
      swatch.style.border="1px solid rgba(15,47,74,0.25)";
      swatch.style.background = colors[idx % colors.length];
    }

    select.onchange = async ()=>{
      try{
const ctx = await getMyCompany();
        const v = String(select.value||"").trim();
        if(!v) return;
const up = await window.sb.from("userdirectory")
          .update({ selected_community_id: v })
          .eq("id", ctx.uid);
        if(up.error) throw up.error;
        // let other parts of the app react
        document.dispatchEvent(new Event("community:changed"));
      }catch(e){
        alert("Community select failed: " + (e?.message || e));
      }
    };
    // Apply modern selector UI (keeps native select for existing logic)
    ensureModernCommunitySelector(select);

  }

  window.addCommunity = async function(){
    try{
      const name = (prompt("New community name:") || "").trim();
      if(!name) return;
const ctx = await getMyCompany();
      if(!ctx.company) return alert("Set your Management Company in Profile first.");
const crow = await window.getCompanyRow(ctx.company);
      const companyId = crow && crow.id ? crow.id : null;
      if(!companyId) return alert("Could not resolve company_id for this company.");
const ins = await window.sb.from("PropertyCommunities")
        .insert([{ company: ctx.company, company_id: companyId, name }])
        .select("id")
        .single();
      if(ins.error) throw ins.error;
      // set as selected
const up = await window.sb.from("userdirectory")
        .update({ selected_community_id: String(ins.data.id) })
        .eq("id", ctx.uid);
      if(up.error) throw up.error;
await renderCommunities();
      document.dispatchEvent(new Event("community:changed"));
      alert("Community added.");
    }catch(e){
      alert("Add community failed: " + (e?.message || e));
    }
  };

  window.renameCommunity = async function(){
    try{
      const sel = document.getElementById("zummeeCommunitySelect");
      const id = sel ? String(sel.value||"").trim() : "";
      if(!id) return alert("Select a community first.");
      const currentName = sel.options[sel.selectedIndex]?.textContent || "";
      const name = (prompt("Rename community:", currentName) || "").trim();
      if(!name) return;
const ctx = await getMyCompany();
const up = await window.sb.from("PropertyCommunities")
        .update({ name })
        .eq("id", id)
        .eq("company", ctx.company)
.eq("company_id", (await window.getCompanyRow(ctx.company)).id);
      if(up.error) throw up.error;
await renderCommunities();
      if(sel) sel.value = id;
      document.dispatchEvent(new Event("community:changed"));
      alert("Community renamed.");
    }catch(e){
      alert("Rename failed: " + (e?.message || e));
    }
  };

  window.removeCommunity = async function(){
    try{
      const sel = document.getElementById("zummeeCommunitySelect");
      const id = sel ? String(sel.value||"").trim() : "";
      if(!id) return alert("Select a community first.");
      const name = sel.options[sel.selectedIndex]?.textContent || "this community";
      if(!confirm('Remove "'+name+'"?')) return;
const ctx = await getMyCompany();
const del = await window.sb.from("PropertyCommunities")
        .delete()
        .eq("id", id)
.eq("company_id", (await window.getCompanyRow(ctx.company)).id);
      if(del.error) throw del.error;

      // choose new default
      let nextId = "";
const q = await window.sb.from("PropertyCommunities")
        .select("id")
.eq("company_id", (await window.getCompanyRow(ctx.company)).id)
        .order("name", { ascending:true })
        .limit(1);
      if(q.error) throw q.error;
      if(q.data && q.data.length) nextId = String(q.data[0].id);

const up = await window.sb.from("userdirectory")
        .update({ selected_community_id: nextId || null })
        .eq("id", ctx.uid);
      if(up.error) throw up.error;

await renderCommunities();
      document.dispatchEvent(new Event("community:changed"));
      alert("Community removed.");
    }catch(e){
      alert("Remove failed: " + (e?.message || e));
    }
  };

  document.addEventListener("DOMContentLoaded", ()=>{
    if(window.__zummeeCommunityMgmtV2Bound) return; // prevent double prompts
    // wire buttons
    const btnAdd = document.getElementById("zummeeCommunityAdd");
    const btnRen = document.getElementById("zummeeCommunityRename");
    const btnRem = document.getElementById("zummeeCommunityRemove");
    if(btnAdd) btnAdd.addEventListener("click", ()=> window.addCommunity && window.addCommunity());
    if(btnRen) btnRen.addEventListener("click", ()=> window.renameCommunity && window.renameCommunity());
    if(btnRem) btnRem.addEventListener("click", ()=> window.removeCommunity && window.removeCommunity());
    // load dropdown (robust init: supabase auth + header widgets may not be ready at DOMContentLoaded)
    function __tryRenderCommunitiesOnce(){
      try{
        renderCommunities().catch(e=>{
          console.warn(e);
          const sel=document.getElementById("zummeeCommunitySelect");
          if(sel) sel.disabled=true;
        });
      }catch(e){
        console.warn(e);
      }
    }

    // Attempt immediately
    __tryRenderCommunitiesOnce();

    // Re-attempt when auth/profile/company context becomes ready
    try{
      window.addEventListener("auth:ready", ()=>{ setTimeout(__tryRenderCommunitiesOnce, 0); });
      window.addEventListener("profile:loaded", ()=>{ setTimeout(__tryRenderCommunitiesOnce, 0); });
      document.addEventListener("company:changed", ()=>{ setTimeout(__tryRenderCommunitiesOnce, 0); });
    }catch(_e){}

    // Safety retries for slow loads
    try{
      let tries=0;
      const maxTries=10;
      const tick=()=>{
        tries++;
        const sel=document.getElementById("zummeeCommunitySelect");
        const hasOptions = sel && sel.options && sel.options.length>1;
        if(hasOptions) return;
        if(tries>maxTries) return;
        __tryRenderCommunitiesOnce();
        setTimeout(tick, 250*tries);
      };
      setTimeout(tick, 250);
    }catch(_e){}
  });

  // If another page (e.g., Mileage Tracker) sets company context programmatically,
  // refresh the header community dropdown immediately.
  document.addEventListener('company:changed', ()=>{
    try{
      renderCommunities().catch(e=>console.warn(e));
    }catch(_e){}
  });

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  var el = document.getElementById("hubRoleBadges");
  if(!el) return;
  function chip(text){
    var s = document.createElement("span");
    s.textContent = text;
    s.style.display = "inline-flex";
    s.style.alignItems = "center";
    s.style.padding = "5px 10px";
    s.style.borderRadius = "999px";
    s.style.border = "1px solid rgba(15,47,74,0.25)";
    s.style.background = "rgba(255,255,255,0.85)";
    s.style.fontSize = "12px";
    s.style.fontWeight = "800";
    s.style.color = "#0f2f4a";
    return s;
  }
  function render(d){
    el.innerHTML = "";
    if(!d) return;
    var role = String(d.role||window.__zummeeUserRole||"").trim();
    var dept = '';
    var company = String(d.company||window.__zummeeCompany||"").trim();

    // Admin view should not display a specific company name in the header.
    if(role === "Admin"){
      el.appendChild(chip("Admin Mode"));
      el.appendChild(chip("Admin"));
    }else{
      if(company) el.appendChild(chip(company));
      if(role) el.appendChild(chip(role));
    }

    if(dept) el.appendChild(chip(dept));
  }
  window.addEventListener("profile:loaded", function(ev){ render(ev && ev.detail); });
  // If profile already loaded
  render({ company: window.__zummeeCompany, role: window.__zummeeUserRole, department: window.__zummeeUserDepartment });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  var box = document.getElementById("supervisorBox");
  var hubCard = document.getElementById("supervisorHubCard");
  if(!box) return;

  function $(id){ return document.getElementById(id); }

  // Cache key UI nodes (declared up-front so missing elements never crash the page)
  var elList = $("sup_companyCommunityList");
  var elStatus = $("sup_status");
  var elAssign = $("sup_perCommunityAssign");
  var elPreview = $("sup_assignmentPreview");

  // Selected community (used by the Communities editor UI)
  var _selectedCommunityId = "";
  var _selectedCommunityName = "";
  function setSelectedCommunity(id, name){
    _selectedCommunityId = String(id||"");
    _selectedCommunityName = String(name||"");
    try{
      localStorage.setItem("zummee_sup_selectedCommunityId", _selectedCommunityId);
      localStorage.setItem("zummee_sup_selectedCommunityName", _selectedCommunityName);
    }catch(e){}
  }
  // Restore last selection (best-effort)
  try{
    _selectedCommunityId = localStorage.getItem("zummee_sup_selectedCommunityId") || "";
    _selectedCommunityName = localStorage.getItem("zummee_sup_selectedCommunityName") || "";
  }catch(e){}

  
  function updateAuthStatus(msg){
    var el = document.getElementById("sup_authStatus");
    if(el) el.textContent = msg;
  }

  async function probeAuthOnce(){
    try{
      if(!window.sb){ updateAuthStatus("Auth: Supabase client not ready (window.sb missing)"); return false; }
var sres = await window.sb.auth.getSession();
      var sess = (sres && sres.data) ? sres.data.session : null;
var ures = await (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.getUserResultSafe ? window.ZUMMEE_AUTH.getUserResultSafe(5000) : window.sb.auth.getUser());
      var user = (ures && ures.data) ? ures.data.user : null;
      var uid = user && user.id ? user.id : "(none)";
      var email = user && user.email ? user.email : "(none)";
      updateAuthStatus("Auth: session=" + (sess ? "yes" : "no") + " • uid=" + uid + " • email=" + email);

      return true;
    }catch(e){
      var msg = (e && e.message) ? e.message : String(e);
      updateAuthStatus("Auth check failed: " + msg);
      return false;
    }
  }

  // NOTE: this function is called from multiple places.
  // Some callers pass the *company name* (string) and expect us to load from cache.
  // Other callers (older code) may pass a list array directly.
  async function renderCompanyCommunities(companyOrList){
    var list = [];
    var companyName = "";

    // v746: Robust active-company resolution + guard against late empty renders clearing the UI.
    function __getActiveCompanyNameFallback(){
      try{
        var cc = document.getElementById('sup_ccCompanyPicker');
        if(cc && cc.selectedOptions && cc.selectedOptions[0]) return String(cc.selectedOptions[0].textContent||"").trim();
      }catch(_e){}
      try{
        var s = document.getElementById('sup_companySelect');
        if(s && s.selectedOptions && s.selectedOptions[0]) return String(s.selectedOptions[0].textContent||"").trim();
      }catch(_e){}
      try{
        var a = document.getElementById('sup_adminCompanyPicker');
        if(a && a.selectedOptions && a.selectedOptions[0]) return String(a.selectedOptions[0].textContent||"").trim();
      }catch(_e){}
      try{ return String((getCompany && getCompany()) || "").trim(); }catch(_e){}
      return "";
    }
    try{
      if(Array.isArray(companyOrList)){
        list = companyOrList || [];
        companyName = String(__getActiveCompanyNameFallback() || "");
      }else{
        companyName = String(companyOrList || "").trim();
        if(!companyName) companyName = String(__getActiveCompanyNameFallback() || "");
        if(companyName){
          list = loadJSON(companyCommunitiesKey(companyName), []);
        }else{
          list = [];
        }
      }
    }catch(_e){
      list = [];
    }

    // v746: If we still don't have a company name, do not clear the list (prevents "flash then disappear").
    if(!companyName){
      return;
    }
    // v746: If called with an empty array but we have cached data for the active company, prefer cached data.
    // v991: However, when we *expect* an empty result (e.g., user just deleted the last community),
    // allow the empty render so the list doesn't "flash" back from stale cache.
    if(Array.isArray(companyOrList) && (!list || !list.length)){
      try{
        var _allowEmpty = false;
        try{ _allowEmpty = !!(window.__CC_ALLOW_EMPTY_RENDER && (Date.now() - window.__CC_ALLOW_EMPTY_RENDER < 6000)); }catch(_e){ _allowEmpty = false; }
        if(!_allowEmpty){
          var cached = loadJSON(companyCommunitiesKey(companyName), null);
          if(Array.isArray(cached) && cached.length) list = cached;
          else return; // don't wipe UI with an empty render
        }
      }catch(_e){ return; }
    }



    // v792: Hydrate community names when cached list items are strings or missing .name
    var __nameMap = {};
    try{
      var __cid = '';
      try{ __cid = (getSelectedCompanyId && String(getSelectedCompanyId()||'')) || ''; }catch(_e){ __cid=''; }
      if(!__cid) __cid = (window.__supCompanyId && String(window.__supCompanyId)) || '';
      if(__cid){
        // prefer in-memory map
        try{ if(window.__pcNameById && window.__pcNameById[__cid]) __nameMap = window.__pcNameById[__cid]||{}; }catch(_e){}
        // fallback to localStorage map
        if(!__nameMap || typeof __nameMap!=='object' || Array.isArray(__nameMap)){
          try{ __nameMap = JSON.parse(localStorage.getItem("zummee_pc_namebyid__"+__cid)||"{}")||{}; }catch(_e){ __nameMap = {}; }
        }
      }
    }catch(_e){ __nameMap = {}; }
    function __resolveNameById(id){
      try{ return (__nameMap && __nameMap[String(id)]) ? String(__nameMap[String(id)]) : ""; }catch(_e){ return ""; }
    }
    try{
      list = (list||[]).map(function(x){
        if(!x) return x;
        if(typeof x === "string"){
          var id = String(x);
          return { id:id, name: __resolveNameById(id) || id };
        }
        if(typeof x === "object"){
          if(!x.name && x.id){
            x.name = __resolveNameById(x.id) || x.name || x.id;
          }
        }
        return x;
      }).filter(Boolean);
    }catch(_e){}
    // Always show communities in alphabetical order (by name)
    list = (list||[]).slice().sort(function(a,b){
      var na = String((a && a.name) || "").trim().toLowerCase();
      var nb = String((b && b.name) || "").trim().toLowerCase();
      return na.localeCompare(nb);
    });

    // Reset selection if selected id no longer exists
    if(_selectedCommunityId){
      var still = (list||[]).some(function(c){ return String(c.id)===String(_selectedCommunityId); });
      if(!still) setSelectedCommunity("", "");
    }

    elList.innerHTML = "";
    if(!list.length){
      elList.innerHTML = '<div class="muted">No company communities yet.</div>';
      return;
    }

    // Use explicit companyName when available so we don't flicker/reset when switching.
    var company = (companyName || (getCompany && getCompany()) || "").trim();
    var audit = company ? loadAudit(company) : {};

    // Build employee options for assignment dropdowns (Approved users for the *currently selected* company)
    // Admins can switch companies; the dropdown must follow that selection.
    var companyId = '';
    try{
      companyId = (getSelectedCompanyId && String(getSelectedCompanyId()||'')) || '';
    }catch(_e){ companyId = ''; }
    if(!companyId) companyId = (window.__supCompanyId && String(window.__supCompanyId)) || '';
    var approved = (window.__approvedProfilesByCompanyId && companyId) ? (window.__approvedProfilesByCompanyId[companyId] || []) : [];
    // Normalize approved list into {id,label}
    var empOpts = (approved||[]).map(function(u){
      var id = u.id || u.user_id || u.auth_user_id || '';
      var name = u.full_name || u.name || u.display_name || [u.first_name, u.last_name].filter(Boolean).join(' ');
      var email = u.email || '';
      var label = String(name||email||id||'').trim();
      if(email && label && String(label).indexOf(email) === -1) label = label + ' (' + email + ')';
      return { id: String(id||''), label: String(label||'').trim() };
    }).filter(function(o){ return o.id && o.label; });
    // Sort by label
    empOpts.sort(function(a,b){ return a.label.localeCompare(b.label); });

    // Load existing assignments map
    var assignMap = (company ? loadJSON(assignmentsKey(company), {}) : {});

    list.forEach(function(c){
      var row = document.createElement("div");
      row.className = "item";
      row.setAttribute("data-id", String(c.id));
      row.setAttribute("data-name", String(c.name||""));

      var auditLine = "";
      var a = audit && audit[String(c.id)];
      if(a && (a.renamedAt || a.renamedBy)){
        var when = "";
        try{
          when = new Date(a.renamedAt).toLocaleString();
        }catch(_e){ when = String(a.renamedAt||""); }
        auditLine = '<div class="muted tiny" style="margin-top:2px;">Last renamed by <strong>'+esc(a.renamedBy||"")+'</strong>' + (when?(' on '+esc(when)):'') + '</div>';
      }

      // assignment dropdown (per community)
      var currentAssigned = assignMap ? String(assignMap[String(c.id)] || '') : '';
      var assignHtml = '';
      assignHtml += '<select class="assignSelect" data-community-id="'+esc(c.id)+'" style="min-width:220px; max-width:320px;">';
      assignHtml += '<option value="">Unassigned…</option>';
      empOpts.forEach(function(o){
        assignHtml += '<option value="'+esc(o.id)+'"'+(String(o.id)===currentAssigned?' selected':'')+'>'+esc(o.label)+'</option>';
      });
      assignHtml += '</select>';

      row.innerHTML =
        '<div style="flex:1; min-width:0;">' +
          '<div class="sup-name" style="font-weight:800; cursor:text;">'+esc((c && c.name) ? c.name : (c && c.id ? c.id : ""))+'</div>' +
          auditLine +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          assignHtml +
        '</div>' +
        '<div class="cc-actions">' +
          '<button class="cc-btn" data-inline-rename="'+esc(c.id)+'" type="button" title="Rename community" aria-label="Rename community">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>' +
          '</button>' +
          '<button class="cc-btn cc-del" data-remove="'+esc(c.id)+'" type="button" title="Remove community" aria-label="Remove community">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
          '</button>' +
        '</div>';

      // selected styling
      if(String(_selectedCommunityId) === String(c.id)){
        row.style.outline = "2px solid rgba(15,47,74,0.35)";
        row.style.background = "rgba(15,47,74,0.04)";
      }

      // Click row to select
      row.addEventListener("click", function(ev){
        // Avoid selecting when clicking buttons (but still select for convenience)
        setSelectedCommunity(String(c.id), String(c.name||""));
        // Re-render selection highlight
        renderCompanyCommunities(list);
      });

      elList.appendChild(row);
    });

        // Wire assignment dropdowns (prevent row click + persist to Supabase)
    // NOTE: use delegated handlers so dynamically re-rendered dropdowns still work.
    (function(){
      // 1) Keep selects usable (don't bubble to row click/selection)
      elList.querySelectorAll('select.assignSelect, select.assignSelectt').forEach(function(sel){
        ['mousedown','click','touchstart','pointerdown'].forEach(function(evt){
          sel.addEventListener(evt, function(e){ e.stopPropagation(); }, true);
        });
      });

      // 2) Delegated change handler (attach once)
      if(!elList.__assignDelegated){
        elList.__assignDelegated = true;

        elList.addEventListener('change', async function(e){
          var sel = e && e.target && (e.target.matches && e.target.matches('select.assignSelect, select.assignSelectt') ? e.target : (e.target.closest ? e.target.closest('select.assignSelect, select.assignSelectt') : null));
          if(!sel) return;

          try{ e.stopPropagation(); }catch(_e){}

          var cid = sel.getAttribute('data-community-id') || (sel.dataset ? sel.dataset.communityId : '') || '';

          // IMPORTANT: do NOT rely on getCompany() here. When the company picker changes,
          // the legacy "scope" helper can lag behind, causing assignments to save under
          // the wrong company. Always read the CC company picker as source-of-truth.
          var __ccCtx = (function(){
            var ctx = { id:null, name:null };
            try{
              var picker = $("sup_ccCompanyPicker");
              if(picker){
                var v = (picker.value||"").trim();
                if(v && /^[0-9a-fA-F-]{36}$/.test(v)) ctx.id = v;
                var opt = picker.options[picker.selectedIndex];
                if(opt) ctx.name = (opt.textContent||"").trim();
              }
            }catch(_e){}
            try{
              if(!ctx.name && typeof getCompany === 'function') ctx.name = String(getCompany()||'').trim();
            }catch(_e2){}
            return ctx;
          })();

          var companyNow = String(__ccCtx.name||'').trim();
          if(!companyNow || !cid) return;

          // Resolve company_id (required by CommunityAssignments table)
          var companyIdNow = (__ccCtx.id && /^[0-9a-fA-F-]{36}$/.test(__ccCtx.id)) ? String(__ccCtx.id) : null;
          if(!companyIdNow){
            try{
var crowNow = (window.getCompanyRow) ? await window.getCompanyRow(companyNow) : null;
              companyIdNow = (crowNow && crowNow.id) ? String(crowNow.id) : null;
            }catch(_e3){ companyIdNow = null; }
          }
          if(!companyIdNow){
            console.warn("[ASSIGN] Missing company_id for company:", companyNow, __ccCtx);
            try{ toast("Cannot save: missing company id."); }catch(_e4){}
            return;
          }

          var uid = String(sel.value || '').trim(); // empty = // empty => unassign

          // Optimistically update local cache (keeps UI stable immediately)
          try{
            var map = loadJSON(assignmentsKey(companyNow), {});
            if(!map || typeof map !== 'object') map = {};
            if(uid) map[String(cid)] = uid; else delete map[String(cid)];
            saveJSON(assignmentsKey(companyNow), map);
            // Keep other legacy assignment keys in sync (other pages read these)
            try{ if(typeof companyAssignmentsKey === "function") localStorage.setItem(companyAssignmentsKey(companyNow), JSON.stringify(map)); }catch(_e2){}
            try{ if(typeof window.companyAssignmentsKey === "function") localStorage.setItem(window.companyAssignmentsKey(companyNow), JSON.stringify(map)); }catch(_e3){}

          }catch(_e){}

          // Persist to Supabase (single source of truth)
          if(window.sb){
            sel.disabled = true;
            try{
              if(!companyIdNow){
                throw new Error("Missing company_id for current company. Cannot save assignment.");
              }

              if(uid){
                // Preferred: use the security-definer RPC so we upsert safely against UNIQUE(company_id, community_id)
var r = await window.sb.rpc('set_community_assignment', {
                  p_company_id: companyIdNow,
                  p_company: companyNow,
                  p_community_id: cid,
                  p_user_id: uid
                });

                if(r && r.error){
                  console.warn("[ASSIGN] RPC set_community_assignment failed; attempting direct upsert fallback.", r.error);
                  // Fallback: direct upsert (works in dev environments where RPC/schema drift exists)
var up = await window.sb.from("CommunityAssignments").upsert({
                    company_id: companyIdNow,
                    company: companyNow,
                    community_id: cid,
                    user_id: uid
                  }, { onConflict: "company_id,community_id" });

                  if(up && up.error){
                    console.error("[ASSIGN] fallback upsert failed:", up.error);
                    throw up.error;
                  }
                }

                try{ toast("Assignment saved."); }catch(_e){}
              }else{
                // Unassign = delete
var r2 = await window.sb.rpc('set_community_assignment', {
                  p_company_id: companyIdNow,
                  p_company: companyNow,
                  p_community_id: cid,
                  p_user_id: null
                });

                if(r2 && r2.error){
                  console.warn("[ASSIGN] RPC unassign failed; attempting direct delete fallback.", r2.error);
var del = await window.sb.from("CommunityAssignments")
                    .delete()
                    .eq("company_id", companyIdNow)
                    .eq("community_id", cid);

                  if(del && del.error){
                    console.error("[ASSIGN] fallback delete failed:", del.error);
                    throw del.error;
                  }
                }

                try{ toast("Assignment cleared."); }catch(_e){}
              }
            }catch(err){
              console.error("Assignment save exception:", err);
              try{ toast("Save failed: " + ((err && err.message) ? err.message : "See console.")); }catch(_e){}
              // Re-render from source of truth (cloud/local) so UI doesn't lie
              try{ refreshAll(); }catch(_e){}
            }finally{
              sel.disabled = false;
            }
          }else{
            try{ toast("Saved locally (offline)."); }catch(_e){}
          }
        }, true);
      }
    })();

// Inline rename handler (button)
    elList.querySelectorAll("button[data-inline-rename]").forEach(function(btn){
      btn.addEventListener("click", async function(ev){
        ev.stopPropagation();
        var id = btn.getAttribute("data-inline-rename");
        // Resolve company context (prevents mismatches on load/refresh)
    var __ctx = (function(){
      var ctx = { id:null, name:null };
      try{
        var picker = $("sup_ccCompanyPicker");
        if(picker && picker.value && /^[0-9a-fA-F-]{36}$/.test(picker.value)){
          ctx.id = picker.value;
          var opt = picker.options[picker.selectedIndex];
          if(opt) ctx.name = (opt.textContent||"").trim();
        }
      }catch(_e){}
      try{
        if(!ctx.id){
          var lsId = localStorage.getItem("zummee_admin_company_id") || localStorage.getItem("zummee_active_company_id") || localStorage.getItem("active_company_id");
          if(lsId && /^[0-9a-fA-F-]{36}$/.test(lsId)) ctx.id = lsId;
        }
      }catch(_e2){}
      if(!ctx.name){
        ctx.name = getCompany();
      }
      return ctx;
    })();
    var company = __ctx.name;
    var companyIdHint = __ctx.id;
    if(companyIdHint) window.__activeCompanyId = companyIdHint;
    if(typeof window.__ccLoadToken !== 'number') window.__ccLoadToken = 0;
 if(!company) return;
        var currentName = "";
        try{
          var row = btn.closest(".item");
          currentName = row ? (row.getAttribute("data-name")||"") : "";
        }catch(_e){}
        if(!currentName){
          // fallback from cache
          var key = companyCommunitiesKey(company);
          var list0 = loadJSON(key, []);
          var found = (list0||[]).find(function(c){ return String(c.id)===String(id); });
          currentName = found ? String(found.name||"") : "";
        }

        // In-place editor UI
        var rowEl = null;
        try{ rowEl = btn.closest(".item"); }catch(_e){}
        if(!rowEl) return;

        var nameHost = rowEl.querySelector(".sup-name");
        if(!nameHost) return;

        var oldName = String(currentName||nameHost.textContent||"").trim();
        var input = document.createElement("input");
        input.value = oldName;
        input.style.width = "100%";
        input.style.padding = "6px 8px";
        input.style.borderRadius = "10px";
        input.style.border = "1px solid rgba(15,47,74,0.25)";

        var actions = document.createElement("div");
        actions.style.display = "flex";
        actions.style.gap = "8px";
        actions.style.marginTop = "6px";

        var bSave = document.createElement("button");
        bSave.type = "button";
        bSave.className = "btn";
        bSave.textContent = "Save";

        var bCancel = document.createElement("button");
        bCancel.type = "button";
        bCancel.className = "btn btn--ghost";
        bCancel.textContent = "Cancel";

        actions.appendChild(bSave);
        actions.appendChild(bCancel);

        // Replace nameHost content
        nameHost.innerHTML = "";
        nameHost.appendChild(input);
        nameHost.appendChild(actions);

        input.focus();
        input.select();

        async function finish(save){
          if(!save){
            // restore
            nameHost.textContent = oldName;
            // Cancel should not trigger refreshAll() because it can rehydrate list with mismatched company key.
            return;
          }
          var newName = String(input.value||"").trim();
          if(!newName){ alert("Enter a community name."); return; }
          if(newName === oldName){ nameHost.textContent = oldName; return; }

          // Prevent duplicates within the company
          var key = companyCommunitiesKey(company);
          var list0 = loadJSON(key, []);
          var dup = (list0||[]).some(function(c){ return String(c.id)!==String(id) && String(c.name||"").trim().toLowerCase()===newName.toLowerCase(); });
          if(dup){ alert("A community with that name already exists for this company."); return; }

          bSave.disabled = true;
          bCancel.disabled = true;
          try{
            await doRenameCommunity(company, id, oldName, newName);

            // Update local cache immediately so UI stays consistent even if a reload is delayed.
            try{
              var key2 = companyCommunitiesKey(company);
              var list2 = loadJSON(key2, []);
              (list2||[]).forEach(function(c){ if(String(c.id)===String(id)) c.name = newName; });
              saveJSON(key2, list2);
            }catch(_e){}

            // Immediately reflect change in-row (prevents "greyed out" stuck edit state)
            nameHost.textContent = newName;
            try{ rowEl.querySelector('button[data-edit]')?.setAttribute('data-current-name', newName); }catch(_e){}
            setSelectedCommunity(id, newName);

            // v966: Avoid refreshAll() here; it can rehydrate CC state using a different company key and "jump" the list.
            // Instead, preserve current company picker value and reload only the CC list (non-blocking).
            (async function(){
              try{
                var __pv = document.getElementById('sup_ccCompanyPicker')?.value;
                await loadCompanyCommunities(true);
                if(__pv && document.getElementById('sup_ccCompanyPicker')) document.getElementById('sup_ccCompanyPicker').value = __pv;
              }catch(_e){}
            })();
          }catch(e){
            console.warn('Rename community failed:', e);
            alert('Could not rename community. Check permissions (RLS) and try again.');
            try{ bSave.disabled = false; bCancel.disabled = false; }catch(_e){}
          }
}

        bSave.addEventListener("click", function(e){ e.stopPropagation(); finish(true); });
        bCancel.addEventListener("click", function(e){ e.stopPropagation(); finish(false); });
        input.addEventListener("keydown", function(e){
          if(e.key === "Enter"){ e.preventDefault(); finish(true); }
          if(e.key === "Escape"){ e.preventDefault(); finish(false); }
        });
      });
    });

    // Remove handler
    elList.querySelectorAll("button[data-remove]").forEach(function(btn){
      btn.addEventListener("click", async function(ev){
        ev.stopPropagation();
        try{
          var id = btn.getAttribute("data-remove");
          var company = getCompany(); if(!company) return;

var okConfirm = await (window.zummeeConfirmDeleteCommunity ? window.zummeeConfirmDeleteCommunity("Remove this community? This will also clear any employee assignments for it.", {title:"Delete Community", confirmText:"Delete", danger:true}) : Promise.resolve(confirm("Remove this community? This will also clear any employee assignments for it.")));
          if(!okConfirm) return;

          btn.disabled = true;
          var oldText = btn.textContent;
          btn.textContent = "Removing…";

          // Cloud-first delete (source of truth)
var okCloud = await deleteCommunityFromCloud(id, company, true);
          if(!okCloud){
            btn.textContent = oldText;
            btn.disabled = false;
            return;
          }

          // Update local cache
          var key = companyCommunitiesKey(company);
          var list = loadJSON(key, []);
          list = list.filter(function(c){ return String(c.id)!==String(id); });
          saveJSON(key, list);

          // v991: If we just deleted the last community, explicitly allow an empty render.
          // This prevents a brief "flash" where an empty render falls back to stale cached data
          // while the cloud refresh is in-flight.
          try{
            if(!list || !list.length){
              window.__CC_ALLOW_EMPTY_RENDER = Date.now();
              window.companyCommunities = [];
            }
          }catch(_e){}

          // Clear local assignment cache for this community
          var aKey = assignmentsKey(company);
          var map = loadJSON(aKey, {});
          if(map && typeof map === "object"){
            try{ delete map[String(id)]; }catch(_e){}
            saveJSON(aKey, map);
          }

          // Clear selection if needed
          if(String(_selectedCommunityId) === String(id)) setSelectedCommunity("", "");

          btn.textContent = okCloud ? "Removed" : "Removed (local)";
          setTimeout(function(){ try{ btn.textContent = oldText; }catch(_e){} try{ btn.disabled = false; }catch(_e){} }, 800);

          refreshAll();
        }catch(e){
          console.warn("Remove community failed:", e);
          try{ btn.disabled = false; btn.textContent = "Remove"; }catch(_e){}
          alert("Could not remove community. Check permissions (RLS) and try again.");
        }
      });
    });
  }

  function buildEmployeeOptions(users, selectedId){
    // Only show *assignable* users: not disabled + not deleted.
    // NOTE: Approval can be stored inconsistently (NULL/missing vs true) depending on query shape.
    // We treat explicit false as not approved, but allow NULL/missing.
    // Also de-dupe by id (guards against legacy caches / double-fetch behavior).
    var html = "<option value=\"\">Unassigned…</option>";
    var seen = {};
    (users||[]).forEach(function(u){
      if(!u) return;
      // Do not allow legacy cached strings into the assignment UI.
      if(typeof u === "string") return;

      var id = String((u.id || u.user_id || u.auth_user_id || u.uid || "")).trim();
      if(!id || seen[id]) return;
      seen[id] = true;
      // deleted/disabled may be booleans or legacy strings
      if(truthyFlag(u.deleted) === true) return;
      if(truthyFlag(u.disabled) === true) return;

      // Only exclude when approval is explicitly false.
      if(u.approved === false || u.approved === 0 || u.approved === "false") return;

      var name = (u.full_name || u.name || u.display_name || u.email || id);
      html += '<option value="' + esc(id) + '"'+ (String(selectedId||"")===id ? " selected" : "") + '>' + esc(name) + '</option>';
    });
    return html;
  }

  // Backward-compatible alias (some parts of the UI call buildUserOptions)
  function buildUserOptions(users, selectedId){
    return buildEmployeeOptions(users, selectedId);
  }


  function renderPerCommunityAssign(communities, users, map){
    if(!elAssign) return;
    elAssign.innerHTML = "";

    // Always reset bulk employee dropdown on each render so it never shows employees
    // from a previously selected company (especially when switching companies).
    var _bulkEmpEl = document.getElementById("sup_bulkEmployeeSelect");
    var _bulkAssignBtnEl = document.getElementById("sup_bulkAssignBtn");
    if(_bulkEmpEl){
      _bulkEmpEl.value = "";
      // Keep only the placeholder until we repopulate below.
      _bulkEmpEl.innerHTML = "<option value=\"\">Select employee…</option>";
    }
    if(_bulkAssignBtnEl){
      _bulkAssignBtnEl.disabled = true;
    }
    communities = (communities||[]).slice().sort(function(a,b){
      var na = String((a&&a.name)||"").trim().toLowerCase();
      var nb = String((b&&b.name)||"").trim().toLowerCase();
      return na.localeCompare(nb);
    });
    if(!communities.length){
      elAssign.innerHTML = '<div class="muted">No company communities to assign.</div>';
      return;
    }
    map = map || {};
    // Build user lookup + options
    var usersById2 = {};
    (users||[]).forEach(function(u){
      if(!u) return;
      var _uid = String((u.id || u.user_id || u.auth_user_id || u.uid || "")).trim();
      if(_uid) usersById2[_uid] = u;
    });

    // Bulk controls (if present)
    var bulkBox = document.getElementById("sup_bulkBox");
    var bulkEmp = document.getElementById("sup_bulkEmployeeSelect");
    var bulkAssignBtn = document.getElementById("sup_bulkAssignBtn");
    var bulkSelAll = document.getElementById("sup_selectAllBtn");
    var bulkClear = document.getElementById("sup_clearSelBtn");

    function getSelectedCommunityIds(){
      return Array.from(elAssign.querySelectorAll('input[type="checkbox"][data-cid]:checked'))
        .map(function(cb){ return cb.getAttribute("data-cid"); })
        .filter(Boolean);
    }
    function updateBulkState(){
      if(!bulkAssignBtn || !bulkEmp) return;
      var ids = getSelectedCommunityIds();
      var uid = String(bulkEmp.value||"");
      // allow bulk unassign via special value
      bulkAssignBtn.disabled = !(ids.length && (uid || uid==="__UNASSIGN__"));
      if(bulkBox){
        bulkBox.querySelector(".tiny-status") && (bulkBox.querySelector(".tiny-status").textContent =
          ids.length ? (ids.length + " selected") : "Select communities to bulk assign.");
      }
    }

    if(bulkEmp){
      // Populate employee dropdown once per render
      bulkEmp.innerHTML = '<option value="">Select employee…</option><option value="__UNASSIGN__">Unassign selected…</option>' + buildUserOptions(users, "");
      // Use direct handler assignment to avoid stacking multiple listeners across refreshes.
      bulkEmp.onchange = updateBulkState;
    }
    if(bulkSelAll){
      bulkSelAll.onclick = function(){
        elAssign.querySelectorAll('input[type="checkbox"][data-cid]').forEach(function(cb){ cb.checked = true; });
        updateBulkState();
      };
    }
    if(bulkClear){
      bulkClear.onclick = function(){
        elAssign.querySelectorAll('input[type="checkbox"][data-cid]').forEach(function(cb){ cb.checked = false; });
        updateBulkState();
      };
    }
    if(bulkAssignBtn){
      bulkAssignBtn.onclick = async function(){
        var company = getCompany(); if(!company) return;

        // Resolve company_id (required by CommunityAssignments table)
        var companyIdBulk = null;
        try{
var crowBulk = (window.getCompanyRow) ? await window.getCompanyRow(company) : null;
          companyIdBulk = (crowBulk && crowBulk.id) ? String(crowBulk.id) : null;
        }catch(_e){ companyIdBulk = null; }

        var uid = String(bulkEmp && bulkEmp.value || "");
        var ids = getSelectedCommunityIds();
        if((!uid && uid!=="__UNASSIGN__") || !ids.length) return;
        if(elStatus) elStatus.textContent = "Assigning " + ids.length + " community" + (ids.length===1?"":"ies") + "…";
        // Write to cloud first (preferred), then local cache.
        if(window.sb){
          try{
var sb = await ensureSupabase();
            if(!companyIdBulk){
              throw new Error("Missing company_id for current company. Cannot bulk assign.");
            }

            for(var i=0;i<ids.length;i++){
              var cid = ids[i];

              if(uid === "__UNASSIGN__"){
var del = await sb
                  .from("CommunityAssignments")
                  .delete()
                  .eq("company_id", companyIdBulk)
                  .eq("community_id", cid);
                if(del && del.error) throw del.error;
              }else{
var r = await sb.rpc('set_community_assignment', {
                  p_company_id: companyIdBulk,
                  p_company: company,
                  p_community_id: cid,
                  p_user_id: uid
                });
                if(r && r.error) throw r.error;
              }
            }
          }catch(e){
            console.warn("bulk assign failed:", e);
            if(elStatus) elStatus.textContent = "Bulk assign failed: " + ((e && e.message) ? e.message : "check permissions");
            return;
          }
        }
        // Update local cache map
        var akey = assignmentsKey(company);
        var map2 = loadJSON(akey, {});
        ids.forEach(function(cid){ if(uid==="__UNASSIGN__") delete map2[String(cid)]; else map2[String(cid)] = uid; });
        saveJSON(akey, map2);
        if(elStatus) elStatus.textContent = "Assigned " + ids.length + " community" + (ids.length===1?"":"ies") + ".";
        refreshAll();
      };
    }

    // Render rows
  var company = getCompany();
  // Keep the "currentCompany" source-of-truth aligned with the visible picker.
  window.currentCompany = company;
    var communitiesById2 = {};
    communities.forEach(function(c){ communitiesById2[String(c.id)] = c; });

    communities.forEach(function(c){
      var cid = String(c.id);
      var assignedUid = String(map[cid]||"");
      var row = document.createElement("div");
      row.className = "item";
      // left side: checkbox + name + status pill
      var left = document.createElement("div");
      left.style.flex = "1";
      left.style.minWidth = "0";
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "10px";

      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.setAttribute("data-cid", cid);
      cb.addEventListener("change", updateBulkState);

      var nameWrap = document.createElement("div");
      nameWrap.style.minWidth = "0";
      nameWrap.innerHTML = '<div style="font-weight:800;">' + esc(c.name||"") + '</div>' +
        '<div class="muted tiny" data-assign-status></div>';

      left.appendChild(cb);
      left.appendChild(nameWrap);

      // right: employee select
      var right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "8px";

      var sel = document.createElement("select");
      sel.innerHTML = buildUserOptions(users, assignedUid);
      sel.addEventListener("change", async function(){
        var company = getCompany(); if(!company) return;
        var uid = String(sel.value||"");
        if(elStatus) elStatus.textContent = "Saving assignment…";
        var ok = true;
        if(window.sb){
ok = await setAssignmentInCloud(company, cid, uid);
        }
        // Update local cache
        var akey = assignmentsKey(company);
        var map2 = loadJSON(akey, {});
        if(uid) map2[cid] = uid; else delete map2[cid];
        saveJSON(akey, map2);
        if(elStatus) elStatus.textContent = ok ? "Assignment saved." : "Saved locally (cloud failed).";
        refreshAll();
      });

      right.appendChild(sel);
      // Unassign button (explicit)
      var unBtn = document.createElement("button");
      unBtn.type = "button";
      unBtn.className = "btn small ghost";
      unBtn.textContent = "Unassign";
      unBtn.title = "Remove this community assignment";
      unBtn.onclick = function(){
        sel.value = "";
        // trigger change handler
        try{ sel.dispatchEvent(new Event("change")); }catch(e){
          // fallback
          if(typeof sel.onchange === "function") sel.onchange();
        }
      };
      right.appendChild(unBtn);

      row.appendChild(left);
      row.appendChild(right);

      // status pill text
      var st = row.querySelector('[data-assign-status]');
      if(st){
        if(assignedUid){
          var uu = usersById2[assignedUid] || {};
          var nm2 = String(uu.name || uu.full_name || uu.email || 'Employee').trim();
          var role2 = String(uu.role || '').trim();
          var dept = '';
          var pill2 = (role2==='Admin') ? '<span class="pill pill--admin">Admin</span>' : (dept2==='Supervisor' ? '<span class="pill">Supervisor</span>' : '<span class="pill pill--employee">Employee</span>');
          st.innerHTML = 'Assigned: ' + esc(nm2) + ' ' + pill2;
        }else{
          st.innerHTML = '<span class="pill pill--warn">Unassigned</span>';
        }
      }

      elAssign.appendChild(row);
    });

    updateBulkState();
  }

  function renderAssignmentsPreview(map, usersById, communitiesById){
    elPreview.innerHTML = "";
    map = map || {};
    communitiesById = communitiesById || {};
    var cids = Object.keys(map);
    // Build list of unassigned communities (those present in company list but not mapped)
    var allCids = Object.keys(communitiesById || {});
    var unassigned = allCids.filter(function(cid){
      var uid = String(map[cid]||"").trim();
      return !uid;
    }).map(function(cid){ return (communitiesById[cid] && communitiesById[cid].name) ? communitiesById[cid].name : cid; })
      .sort(function(a,b){ return String(a).toLowerCase().localeCompare(String(b).toLowerCase()); });

    if(!cids.length){
      // No assignments yet, but we can still show unassigned if communities exist
      if(unassigned.length){
        elPreview.innerHTML = '<div class="item"><div><strong>Unassigned</strong> <span class="pill pill--warn">Needs manager</span><div class="muted tiny">' + esc(unassigned.join(", ")) + '</div></div></div>';
      }else{
        elPreview.innerHTML = '<div class="muted">No assignments yet.</div>';
      }
      return;
    }

    // If there are some assignments, show unassigned summary first (if any)
    if(unassigned.length){
      var uRow = document.createElement("div");
      uRow.className = "item";
      uRow.innerHTML = '<div><strong>Unassigned</strong> <span class="pill pill--warn">Needs manager</span><div class="muted tiny">' + esc(unassigned.join(", ")) + '</div></div>';
      elPreview.appendChild(uRow);
    }

    // Invert: userId -> [communityName]
    var byUser = {};
    cids.forEach(function(cid){
      var uid = String(map[cid]||"");
      if(!uid) return;
      if(!byUser[uid]) byUser[uid]=[];
      var cn = (communitiesById[cid] && communitiesById[cid].name) ? communitiesById[cid].name : cid;
      byUser[uid].push(cn);
    });
    var uids = Object.keys(byUser);
    if(!uids.length){
      elPreview.innerHTML = '<div class="muted">No assignments yet.</div>';
      return;
    }
    uids.sort(function(a,b){
      var ua = usersById[a] || {};
      var ub = usersById[b] || {};
      var na = (ua.name || ua.full_name || ua.email || a).toLowerCase();
      var nb = (ub.name || ub.full_name || ub.email || b).toLowerCase();
      return na.localeCompare(nb);
    });
    uids.forEach(function(uid){
      var u = usersById[uid] || { id: uid };
      var uname = (u.name || u.full_name || u.email || uid);
      var commNames = byUser[uid] || [];
      var row = document.createElement("div");
      row.className = "item";
      var role2 = String(u.role || "").trim();
      var dept = '';
      var pill2 = (role2==="Admin") ? "<span class=\"pill pill--admin\">Admin</span>" : (dept2==="Supervisor" ? "<span class=\"pill\">Supervisor</span>" : "<span class=\"pill pill--employee\">Employee</span>");
      row.innerHTML = "<div><strong>"+esc(uname)+"</strong> "+pill2+"<div>"+esc(commNames.join(", "))+"</div></div>" +
        "<button class=\"btn btn--ghost\" data-clear-user=\""+esc(uid)+"\">Clear</button>";
      elPreview.appendChild(row);
    });
    elPreview.querySelectorAll("button[data-clear-user]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var uid = btn.getAttribute("data-clear-user");
        var company = getCompany(); if(!company) return;
        var akey = assignmentsKey(company);
        var map2 = loadJSON(akey, {});
        Object.keys(map2||{}).forEach(function(cid){ if(String(map2[cid]||"")===String(uid)) delete map2[cid]; });
        saveJSON(akey, map2);
        refreshAll();
      });
    });
  }

  function ensureSupervisorVisible(profile){
  var auth = window.ZUMMEE_AUTH || {};
  var dept = '';
  var role = String((profile && profile.role) || auth.role || window.__zummeeUserRole || "").trim();
  // Admins should always see Supervisor Access; supervisors see it too.
  var role = String((profile && profile.role) || '').trim().toLowerCase();
var approved = !!(profile && profile.approved);
var isSup = approved && (role === 'supervisor' || role === 'admin' || role === 'companyadmin');
  box.style.display = isSup ? "" : "none";
  if(hubCard) hubCard.style.display = isSup ? "" : "none";
    if(isSup){
      // Ensure company picker (and name->id mapping) is ready before the first refresh.
      // Otherwise initial render can fall back to __supCompanyId and dropdowns may show
      // only "Unassigned" until a manual refresh.
      try{
        var p = initAdminCompanyPicker();
        if(p && typeof p.then==='function'){
          p.then(function(){
            try{ refreshAll(); }catch(_e){}
          }).catch(function(){
            try{ refreshAll(); }catch(_e){}
          });
        }else{
          refreshAll();
        }
      }catch(_e){
        refreshAll();
      }
    }
}

  

  var elCompanySelect = $("sup_companySelect");
  var elCompanyAdminPicker = document.getElementById("sup_companyAdminPicker");
  var elCompanySetter = document.getElementById("sup_companySetter");
  var elEmpList = document.getElementById("sup_employeeList");
  var elEmailServiceBox = document.getElementById("sup_emailServiceBox");
  var elEmailServiceSelect = document.getElementById("sup_emailServiceSelect");
  var elEmailServiceHint = document.getElementById("sup_emailServiceHint");
  var btnResetEmailService = document.getElementById("sup_resetEmailServiceBtn");

  function emailServiceKey(company){
    return "zummee_company_email_service_v1__" + String(company||"").trim();
  }
  function loadEmailService(company){
    var c = String(company||"").trim();
    if(!c) return "copy";
    try{ return String(localStorage.getItem(emailServiceKey(c)) || "copy"); }catch(_e){ return "copy"; }
  }
  function saveEmailService(company, mode){
    var c = String(company||"").trim();
    if(!c) return;
    var v = String(mode||"").trim() || "copy";
    try{ localStorage.setItem(emailServiceKey(c), v); }catch(_e){}
  }
  function syncEmailServiceUI(company){
    if(!elEmailServiceBox) return;
    var c = String(company||"").trim();
    // Always show the box; disable it until a company is selected.
    elEmailServiceBox.style.display = "";
    if(!c){
      if(elEmailServiceSelect){ elEmailServiceSelect.disabled = true; elEmailServiceSelect.value = "copy"; }
      if(btnResetEmailService) btnResetEmailService.disabled = true;
      if(elEmailServiceHint) elEmailServiceHint.textContent = "Set/select a company above to enable this setting.";
      return;
    }
    if(elEmailServiceSelect){
      elEmailServiceSelect.disabled = false;
      var v = loadEmailService(c);
      elEmailServiceSelect.value = v;
    }
    if(btnResetEmailService) btnResetEmailService.disabled = false;
    if(elEmailServiceHint) elEmailServiceHint.textContent = "Used for Mileage & Reimbursements emails for this company.";
  }

  function isAdmin(){
    var auth = window.ZUMMEE_AUTH || {};
    var role = String(auth.role || window.__zummeeUserRole || "").trim();
    return role === "Admin";
  }

  // v801: Company dropdowns must use company UUID as option.value.
  // Many downstream systems rely on company NAME (for cache keys), so callers should use
  // selected option textContent when they need the name.
  function renderCompanyOptions(companies){
    if(!elCompanySelect) return;
    elCompanySelect.innerHTML = '<option value="">Select a company…</option>';
    (companies||[]).forEach(function(c){
      if(!c) return;
      var id = (typeof c === 'string') ? '' : (c.id || c.company_id || c.companyId || '');
      var nm = (typeof c === 'string') ? c : (c.name || c.company_name || c.company || c.title || '');
      id = String(id||'').trim();
      nm = String(nm||'').trim();
      if(!id || !nm) return;
      var opt=document.createElement('option');
      opt.value=id;
      opt.textContent=nm;
      elCompanySelect.appendChild(opt);
    });

    // Prefer selecting by activeCompanyId (UUID), then fallback to first non-empty option.
    var desired = '';
    try{ desired = String(localStorage.getItem('activeCompanyId') || localStorage.getItem('zummee_company_id') || localStorage.getItem('zummee_admin_company_id') || '').trim(); }catch(_e){}
    var has = false;
    try{ has = desired ? Array.from(elCompanySelect.options||[]).some(function(o){ return String(o.value||'')===desired; }) : false; }catch(_e){}
    if(desired && has){
      elCompanySelect.value = desired;
    } else {
      // first non-empty
      var firstNonEmpty = null;
      try{ firstNonEmpty = Array.from(elCompanySelect.options||[]).find(function(o){ return String(o.value||'').trim(); }) || null; }catch(_e){}
      if(firstNonEmpty) elCompanySelect.value = String(firstNonEmpty.value||'');
    }
  }


  // Ensure supervisor/company dropdown refresh helper exists (used by syncCompanyFromCloud and assignment UI refresh).
  async function loadCompaniesForSupervisor(){
    try{
      // Load from Companies table (active only) and render into supervisor company select.
var companies = await loadAllCompanies();
      renderCompanyOptions(companies);

      // Keep current selection stable when possible (UUID-based)
      if(elCompanySelect){
        var picked = (elCompanySelect.value||"").trim();
        var remembered = "";
        try{ remembered = String(localStorage.getItem('activeCompanyId') || localStorage.getItem('zummee_company_id') || localStorage.getItem('zummee_admin_company_id') || '').trim(); }catch(_e){}
        var use = picked || remembered || (window.__supCompanyId ? String(window.__supCompanyId) : '') || (window.currentCompanyId ? String(window.currentCompanyId) : '');
        use = String(use||'').trim();
        if(use){
          var found=false;
          for(var i=0;i<elCompanySelect.options.length;i++){
            if(String(elCompanySelect.options[i].value||'') === use){ found=true; break; }
          }
          if(found) elCompanySelect.value = use;
        }
        // If still blank, select first non-empty option
        if(!String(elCompanySelect.value||'').trim()){
          try{
            var firstNonEmpty = Array.from(elCompanySelect.options||[]).find(function(o){ return String(o.value||'').trim(); }) || null;
            if(firstNonEmpty) elCompanySelect.value = String(firstNonEmpty.value||'');
          }catch(_e){}
        }
      }
    }catch(_e){
      // no-op: keep UI usable even if Companies table fetch fails
    }
  }

  async function loadAllCompanies(){
    // v801: Pull id + name so dropdowns can use UUID values.
    if(!window.sb) return [];
    try{
var q = await window.sb.from('Companies')
        .select('id,name,active')
        .eq('active', true)
        .order('name', { ascending: true });
      if(q && q.error) throw q.error;
      var rows = (q && q.data) ? q.data : [];
      var out = [];
      for(var i=0;i<rows.length;i++){
        var r = rows[i] || {};
        var id = String(r.id || r.company_id || r.companyId || '').trim();
        var nm = String(r.name || r.company_name || r.company || r.title || '').trim();
        if(id && nm) out.push({ id:id, name:nm });
      }
      // De-dupe by id defensively
      var seen = {}; var uniq = [];
      out.forEach(function(r){ if(r && r.id && !seen[r.id]){ seen[r.id]=true; uniq.push(r); } });
      return uniq;
    }catch(_e){
      return [];
    }
  }

  
  function truthyApproved(v){
    if(v === true) return true;
    if(v === false) return false;
    if(v === 1 || v === 0) return !!v;
    var s = String(v||"").trim().toLowerCase();
    if(!s) return null; // unknown / column missing
    if(s === "true" || s === "yes" || s === "approved") return true;
    if(s === "false" || s === "no" || s === "pending") return false;
    return null;
  }

  // Generic truthy/falsey normalizer for boolean-ish flags coming from
  // mixed sources (db booleans, legacy cached strings, etc.)
  function truthyFlag(v){
    if(v === true) return true;
    if(v === false) return false;
    if(v === 1 || v === 0) return !!v;
    var s = String(v||"").trim().toLowerCase();
    if(!s) return null;
    if(s === "true" || s === "yes" || s === "1") return true;
    if(s === "false" || s === "no" || s === "0") return false;
    return null;
  }

  function isPrivilegedRow(u){
    var role = String(u.role||"").trim();
    return (role === "Supervisor") || (role === "Admin");
  }

  async function approveEmployee(uid){
    if(!window.sb) { if(elStatus) elStatus.textContent='Approvals require database connection.'; return; }
    if(!uid) return;
    if(elStatus) elStatus.textContent='Approving account…';
    try{
      // Stamp approved=true. If the row has no company_id yet, stamp the current activeCompanyId
      // so it will show under that company's Approved Employees list.
      var companyId = window.activeCompanyId || safeLocalGet('activeCompanyId') || safeLocalGet('zummee_company_id') || null;
      var payload = { approved: true };
      if(companyId) payload.company_id = companyId;
var up = await window.sb.from("userdirectory").update(payload).eq("id", uid);
      if(up && up.error){
        // Some schemas may not have the 'approved' column; fall back gracefully.
        throw up.error;
      }
      if(elStatus) elStatus.textContent='Account approved.';
      setTimeout(function(){ try{ if(elStatus && elStatus.textContent==='Account approved.') elStatus.textContent=''; }catch(_e){} }, 1400);
      refreshAll();
    }catch(e){
      var msg = String((e && e.message) || e || '');
      if(msg && msg.toLowerCase().indexOf('column') !== -1 && msg.toLowerCase().indexOf('approved') !== -1){
        if(elStatus) elStatus.textContent="Approval column not found in userdirectory. Add a boolean 'approved' column to enable approvals.";
      } else {
        if(elStatus) elStatus.textContent='Could not approve: ' + msg;
      }
    }
  }

  function renderApprovals(users, company){

  function getUserDisplay(u){
    if(!u) return "";
    // Prefer denormalized fields on userdirectory when present
    var dn = String(u.profile_name || '').trim();
    if(dn) return dn;
    var de = String(u.profile_email || '').trim();
    if(de) return de;
    var p = u.profiles || u.profile || null;
    var full = "";
    if(p){
      full = String(p.full_name || "").trim();
      if(!full){
        var fn = String(p.first_name || "").trim();
        var ln = String(p.last_name || "").trim();
        full = (fn && ln) ? (fn + " " + ln) : (fn || ln || "");
      }
      if(!full){
        full = String(p.email || "").trim();
      }
    }
    return full || String(u.email || "").trim() || String(u.name || "").trim() || String(u.auth_user_id || u.id || "").trim();
  }


    var box = document.getElementById('sup_approvalsList');
    if(!box) return;
    box.innerHTML = '';
    if(!users || !users.length){
      box.innerHTML = '<div class="muted">No employees found.</div>';
      return;
    }
    var pending = users.filter(function(u){
      if(!u) return false;
      if(isPrivilegedRow(u)) return false;
      var ap = truthyApproved(u.approved);
      if(ap === null) return false; // unknown schema => don't block / don't show
      return ap === false;
    });

    if(!pending.length){
      box.innerHTML = '<div class="muted">No pending approvals.</div>';
      return;
    }

    pending.forEach(function(u){
      var row=document.createElement('div');
      row.className='emp';
      var display = getUserDisplay(u);
      var email = String(u.profile_email || (u.profile && u.profile.email) || (u.profiles && u.profiles.email) || u.email || '').trim();
      var comp = String(u.company_name || u.company || '').trim() || (u.company_id ? String(u.company_id) : '');
      var sub = "Role: "+(u.role||'Employee') + (comp?('  •  Company: '+comp):'') + (email?('  •  '+email):'');
      row.innerHTML =
        '<div class="meta"><div class="name">'+esc(display)+'<span class="pill pill--pending" style="margin-left:8px;">Pending</span></div>' +
        '<div class="sub">'+esc(sub||'')+'</div></div>' +
        '<div class="sup-row" style="gap:8px; justify-content:flex-end">' +
          '<button class="btn" data-approve="'+esc(u.id)+'">Approve</button>' +
        '</div>';
      box.appendChild(row);
    });

    box.querySelectorAll('button[data-approve]').forEach(function(btn){
      btn.addEventListener('click', function(){
        approveEmployee(btn.getAttribute('data-approve'));
      });
    });
  }


function renderEmployees(users, company){
    if(!elEmpList) return;
    elEmpList.innerHTML='';
    if(!users.length){
      elEmpList.innerHTML='<div class="muted">No users found for this company.</div>';
      return;
    }
    users.forEach(function(u){
      var role=String(u.role||'').trim();
      var row=document.createElement('div');
      row.className='emp';
      var display = getUserDisplay(u);
      var comp = String(u.company_name || u.company || '').trim() || (u.company_id ? String(u.company_id) : '');
      var sub = (comp?('Company: '+comp):'');
      var pill = (role==='Supervisor') ? '<span class="pill">Supervisor</span>' : '';
      var ap = truthyApproved(u.approved);
      var statusPill = (ap === false) ? '<span class="pill pill--pending" style="margin-left:8px;">Pending</span>' : (ap === true ? '<span class="pill pill--approved" style="margin-left:8px;">Approved</span>' : '');
      var pill = (role==='Supervisor') ? '<span class="pill">Supervisor</span>' : '';
      var canApprove = !isPrivilegedRow(u) && (ap === false);
      var approveBtn = canApprove ? '<button class="btn" data-approve="'+esc(u.id)+'">Approve</button>' : '';
      var supToggleBtn = (isAdmin()) ? '<button class="btn btn--ghost" data-toggle-sup="'+esc(u.id)+'">'+(role==='Supervisor'?'Remove Supervisor':'Make Supervisor')+'</button>' : '';
      row.innerHTML = '<div class="meta"><div class="name">'+esc(display)+pill+statusPill+'</div>' +
        '<div class="sub">'+esc(sub||'')+'</div></div>' +
        '<div class="sup-row" style="gap:8px; justify-content:flex-end">' +
        approveBtn + supToggleBtn +
        '</div>';
      elEmpList.appendChild(row);
    });
    elEmpList.querySelectorAll('button[data-toggle-sup]').forEach(function(btn){
      btn.addEventListener('click', async function(){
        if(!window.sb) { if(elStatus) elStatus.textContent='Supervisor toggles require database connection.'; return; }
        var uid = btn.getAttribute('data-toggle-sup');
        var u = _usersById[String(uid)] || {};
        var cur = String(u.role||'').trim();
        var next = (cur==='Supervisor') ? 'Employee' : 'Supervisor';
        if(elStatus) elStatus.textContent=(next==='Supervisor'?'Granting':'Removing') + ' Supervisor…';
        try{
await window.sb.from('userdirectory').update({ role: next }).eq('id', uid);
        }catch(e){
          if(elStatus) elStatus.textContent='Could not update user. Check permissions.';
          return;
        }
        if(elStatus) elStatus.textContent='Updated.';
u.role = next; btn.textContent = (next==='Supervisor'?'Remove Supervisor':'Make Supervisor'); if(elStatus) elStatus.textContent='Updated.';
      });
    });
  }

  async function initAdminCompanyPicker(){
    if(!elCompanyAdminPicker) return;
    if(!isAdmin()){
      elCompanyAdminPicker.style.display='none';
      return;
    }
    elCompanyAdminPicker.style.display='';
var companies = await loadAllCompanies();
    renderCompanyOptions(companies);
  }
var _cacheUsers = [];
  var _usersById = {};
  var _communities = [];
  // Supervisor/company scope company_id (UUID). Keep mirrored on window so other modules can read it.
  var __supCompanyId = "";
  function setSupCompanyId(id){
    __supCompanyId = (id==null?"":String(id));
    try{ window.__supCompanyId = __supCompanyId; }catch(e){}
  }

  try{ window.__supCompanyId = ""; }catch(_e){}
  var __supCompanyName = "";


  
  async function renderGlobalApprovals(){
    try{
      var box = document.getElementById('sup_approvalsList');
      if(!box) return;
      box.innerHTML = '<div class="muted">Loading pending approvals…</div>';
      if(!window.sb){ box.innerHTML = '<div class="muted">Not connected.</div>'; return; }
		  // Render pending approvals across all companies.
		  // NOTE: userdirectory does NOT store profile_name/profile_email, so we
		  // enrich from the profiles table (best effort; RLS may restrict this).
		// Prefer denormalized company_name when present; fall back safely if the column
		// does not exist in this environment.
		var q = await window.sb
		  .from("userdirectory")
		  .select(`id,auth_user_id,company_id,company_name,role,approved,created_at`)
		  .order("created_at", { ascending:false });
		if(q && q.error){
		  q = await window.sb
		    .from("userdirectory")
		    .select(`id,auth_user_id,company_id,role,approved,created_at`)
		    .order("created_at", { ascending:false });
		}
	      var users = (q && q.data) ? q.data : [];

	      try{
	        var ids = Array.from(new Set(users.map(u=>u.auth_user_id).filter(Boolean)));
	        if(ids.length){
	          var pr = await window.sb.from('profiles').select('id,name,email,disabled').in('id', ids);
          if(pr && pr.error && String(pr.error.message||'').toLowerCase().includes('column')){
            pr = await window.sb.from('profiles').select('id,name,email').in('id', ids);
          }
	          if(pr && !pr.error && Array.isArray(pr.data)){
	            var map = {};
	            pr.data.forEach(p => { map[p.id] = p; });
	            users.forEach(u => {
	              var p = map[u.auth_user_id];
	              if(p){ u.profile_name = p.name || ''; u.profile_email = p.email || ''; }
	            });
	          } else if(pr && pr.error){
	            console.warn('[EMP] profiles enrich failed', pr.error);
	          }
	        }
	      }catch(e){ console.warn('[EMP] profiles enrich exception', e); }

	      renderApprovals(users, "__ALL__");
    }catch(_e){
      var b = document.getElementById('sup_approvalsList');
      if(b) b.innerHTML = '<div class="muted">Could not load pending approvals.</div>';
    }
  }

async function refreshAll(){
    // Prevent overlapping refreshes from finishing out-of-order.
    // Company switching can trigger multiple async refresh cycles; an older
    // refresh finishing last can overwrite caches and leave dropdowns stuck on
    // "Unassigned" until a manual page refresh.
    try{
      window.__ZUMMEE_REFRESH_SEQ = (window.__ZUMMEE_REFRESH_SEQ||0) + 1;
      window.__ZUMMEE_REFRESH_ACTIVE = window.__ZUMMEE_REFRESH_SEQ;
      var __token = window.__ZUMMEE_REFRESH_ACTIVE;
    }catch(_e){
      var __token = 0;
    }
    function __stale(){
      try{ return window.__ZUMMEE_REFRESH_ACTIVE !== __token; }catch(_e){ return false; }
    }

    var company = getCompany();

    // Ensure global state is correct before any sync/render.
// This prevents "Unassigned" on first load and prevents company/community mismatch after refresh.
try{
  if(company){
    window.currentCompany = company;

    // Prefer the company picker UUID value (source of truth) over name->id maps,
    // since name maps can be stale and cause cross-company community lists after edits.
    var __ccPicker = document.getElementById('sup_ccCompanyPicker');
    var __pickedId = (__ccPicker && __ccPicker.value) ? String(__ccPicker.value).trim() : "";
    var cid0 = "";
    if(__pickedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(__pickedId)){
      cid0 = __pickedId;
    }else{
      cid0 = (typeof getCompanyIdForName === 'function') ? (getCompanyIdForName(company) || "") : "";
    }
    if(cid0){
      window.__activeCompanyId = cid0;
      window.__currentCompanyId = cid0;
    }
    window.__ccLoadToken = (window.__ccLoadToken||0) + 1;
  }
}catch(_eState){}
    // Keep selected company id in sync whenever we refresh (drives employee scoping + assignment dropdown options)
    try{ setSupCompanyId(getSelectedCompanyId?.() || window.__companiesByName?.[String(company||"").trim()] || null); }catch(_eSync){}
    var setter = elCompanySetter;
    // Admins pick a company from the dropdown; Supervisors set their own company once.
    if(!company){
      if(isAdmin()){
        if(setter) setter.style.display="none";
        if(elCompanyAdminPicker) elCompanyAdminPicker.style.display="";
        if(elStatus) elStatus.textContent="Admin: showing global pending approvals. Select a company to manage assignments.";
        // Render global pending approvals even without a selected company
        await renderGlobalApprovals();
        // Hide per-company email settings until a company is selected.
        syncEmailServiceUI("");
        return;
      }

      // Supervisor: there may be no company *name* to set (no dropdown). If we already
      // know the supervisor's company_id, resolve the name and continue.
      if(window.__supCompanyId && (window.sb || window.supabaseClient || window.supabase)){
        try{
          const sb = window.sb || window.supabaseClient || window.supabase;
          const c = await sb.from('companies').select('name').eq('id', String(window.__supCompanyId)).maybeSingle();
          if(c && !c.error && c.data && c.data.name){
            company = String(c.data.name).trim();
            try{ localStorage.setItem('activeCompanyName', company); }catch(_e){}
            try{ localStorage.setItem('activeCompanyId', String(window.__supCompanyId)); }catch(_e){}
            // Keep internal id in sync
            try{ setSupCompanyId(String(window.__supCompanyId)); }catch(_e){}
          }
        }catch(_e){}
      }

      if(!company){
        if(setter) setter.style.display="";
        if(elStatus) elStatus.textContent="Set company to manage assignments.";
        // Hide per-company email settings until a company is selected.
        syncEmailServiceUI("");
        return;
      }
    }
    if(isAdmin() && elCompanyAdminPicker) elCompanyAdminPicker.style.display="";
    if(setter) setter.style.display = "none";

    // Show and load per-company email service setting.
    syncEmailServiceUI(company);

    // Sync from cloud first (writes to local cache keys)
await syncCompanyFromCloud(company);
    if(__stale()) return;

    var commKey = companyCommunitiesKey(company);
    _communities = loadJSON(commKey, []).map(normalizeCommunity).filter(Boolean);
    // Keep UI consistent: sort communities alphabetically
    _communities.sort(function(a,b){
      var na = String((a && a.name) || "").trim().toLowerCase();
      var nb = String((b && b.name) || "").trim().toLowerCase();
      return na.localeCompare(nb);
    });

    var communitiesById = {};
    _communities.forEach(function(c){ communitiesById[String(c.id)] = c; });

    // IMPORTANT: do NOT render the Company Communities assignment dropdowns
    // until employees are loaded for the selected company. Rendering here
    // causes dropdowns to show only "Unassigned" until a manual refresh.

    if(window.sb){
      try{
        // Use the same, reliable employee loader used by Community Assignments.
        // This avoids schema drift (missing columns like full_name) and keeps the
        // assignment dropdown in sync with the approvals cache.
        if(typeof loadEmployeesForSupervisor === 'function'){
          // userdirectory-backed employee lists (pending + approved)
var empRes = await loadEmployeesForSupervisor();
          if(__stale()) return;

          // Cache: include BOTH approved and pending (Employee Management needs both)
          // Company Communities dropdown should still use approved-only via __approvedProfilesByCompanyId below.
          var _approved = (empRes && empRes.approved) ? empRes.approved : [];
          var _pending  = (empRes && empRes.pending)  ? empRes.pending  : [];
          _cacheUsers = _approved.concat(_pending);

          // Render Employee Management lists.
          try{ renderEmployeeManagement(empRes); }catch(_e2){}
        }else{
          // Fallback: minimal select with resilient retries
          var q;
          var sel = `id,auth_user_id,company_id,role,approved,created_at,profiles:auth_user_id ( name, email, phone )`;
          if(__supCompanyId){
q = await window.sb.from("userdirectory").select(sel).eq("company_id", __supCompanyId);
          }else{
q = await window.sb.from("userdirectory").select(sel).eq("company", company);
          }
           if(__stale()) return;
          _cacheUsers = (q && q.data) ? q.data : [];
          _cacheUsers = (_cacheUsers||[]).filter(function(u){ return truthyFlag(u && u.deleted) !== true; });
        }
      }catch(_e){ _cacheUsers = []; }
    }

    window._cacheUsers = _cacheUsers;

    _usersById = {};
    _cacheUsers.forEach(function(u){ _usersById[String(u.id)] = u; });

    // Render Company Communities AFTER employees are loaded so each community's
    // assignment dropdown has the correct employee options without requiring a
    // manual page refresh.
     if(__stale()) return;
     try{ renderCompanyCommunities(company); }catch(_eRCC){}

    // Employee Management now renders via userdirectory (pending + approved).
    // The legacy renderApprovals/renderEmployees were tied to a non-existent DOM host.

    var akey = assignmentsKey(company);
    var map = loadJSON(akey, {});
     if(__stale()) return;
     renderPerCommunityAssign(_communities, _cacheUsers, map);
     renderAssignmentsPreview(map, _usersById, communitiesById);

    // Preferred Vendors list depends on company
    try{ pvRender(); }catch(_e){}
  }

    // Admin company picker wiring
  if(elCompanySelect){
// IMPORTANT: company switching must await company-id resolution and employee reload.
    // Otherwise assignment dropdowns render with only "Unassigned" until a hard refresh.
    var __companyChangeTimer = null;
    elCompanySelect.addEventListener('change', function(){
      var v = String(elCompanySelect.value||'').trim();
      try{ localStorage.setItem('zummee_admin_selected_company', v); }catch(_e){}
      syncEmailServiceUI(v);
      try{ if(__companyChangeTimer) clearTimeout(__companyChangeTimer); }catch(_e){}
      __companyChangeTimer = setTimeout(async function(){
        try{
          if(typeof window.loadCompaniesForSupervisor==='function'){
try{ await window.loadCompaniesForSupervisor(); }catch(_e2){}
          }
          // Keep selected company id in sync for scoping (employee lists + assignment dropdowns).
          // DO NOT call getSelectedCompanyId() here because it may return the *previous* __supCompanyId,
          // which makes the UI look stale until a hard refresh.
          try{ setSupCompanyId(window.__companiesByName?.[v] || null); }catch(_e3){}
          var r = refreshAll();
if(r && typeof r.then==='function') await r;
        }catch(_e4){}
      }, 50);
    });
  }

  // Company Email Service wiring
  if(elEmailServiceSelect){
    elEmailServiceSelect.addEventListener('change', function(){
      var company = getCompany();
      if(!company) return;
      var mode = String(elEmailServiceSelect.value||'copy').trim() || 'copy';
      saveEmailService(company, mode);
      if(elStatus) elStatus.textContent = 'Email service saved for ' + company + '.';
      setTimeout(function(){ try{ if(elStatus && elStatus.textContent.indexOf('Email service saved')===0) elStatus.textContent=''; }catch(_e){} }, 1600);
    });
  }
  if(btnResetEmailService){
    btnResetEmailService.addEventListener('click', function(){
      var company = getCompany();
      if(!company) return;
      saveEmailService(company, 'copy');
      syncEmailServiceUI(company);
      if(elStatus) elStatus.textContent = 'Email service reset for ' + company + '.';
      setTimeout(function(){ try{ if(elStatus && elStatus.textContent.indexOf('Email service reset')===0) elStatus.textContent=''; }catch(_e){} }, 1600);
    });
  }
  var btnRefreshCompanies = $("sup_refreshCompaniesBtn");
  if(btnRefreshCompanies){
    btnRefreshCompanies.addEventListener('click', async function(){
      if(elStatus) elStatus.textContent='Refreshing companies…';
await initAdminCompanyPicker();
      if(elStatus) elStatus.textContent='';
      refreshAll();
    });
  }

var btnSetCompany = $("sup_setCompanyBtn");
  if(btnSetCompany){
    btnSetCompany.addEventListener("click", async function(){
      var v = String($("sup_companyInput").value||"").trim();
      if(!v){ if(elStatus) elStatus.textContent="Enter a company name."; return; }
      if(elStatus) elStatus.textContent="Saving company…";
var ok = await setCompanyName(v);
      if(ok){
        document.getElementById("sup_companySetter").style.display = "none";
        if(elStatus) elStatus.textContent="Company set to " + v + ".";
        refreshAll();
      }else{
        if(elStatus) elStatus.textContent="Could not set company.";
      }
    });
  }

  
  // v937: Add Community UX - keep the "Add community name" input visible and support Enter key
  try{
    var _addNameEl = document.getElementById('sup_newCommunityName');
    if(_addNameEl){
      _addNameEl.style.display = '';
      _addNameEl.addEventListener('keydown', function(ev){
        if(ev.key === 'Enter'){
          ev.preventDefault();
          try{ document.getElementById('sup_addCommunityBtn')?.click(); }catch(_e){}
        }
      });
    }
  }catch(_e){}

var btnAddCommunity = $("sup_addCommunityBtn");
  if(btnAddCommunity){
    btnAddCommunity.addEventListener("click", async function(){
      const setter = document.getElementById("sup_companySetter");
      try{
        // Only Supervisor/Admin should be able to add communities (employees can't see this section anyway)
        var company = getCompany();
        if(!company){
          if(setter) setter.style.display="";
          if(elStatus) elStatus.textContent="Select or set a company first.";
          return;
        }
        if(setter) setter.style.display="none";

        var nameEl = $("sup_newCommunityName") || $("sup_addCommunityModalName");
        var name = String(nameEl && nameEl.value ? nameEl.value : "").trim();
        if(!name){
          if(elStatus) elStatus.textContent="Enter a community name.";
          return;
        }

        if(elStatus) elStatus.textContent="Adding community…";
        let ok = false;
        try{
          ok = await addCommunityToCloud(company, name);
        }catch(e){
          console.error("[CC] addCommunityToCloud failed", e);
          ok = false;
        }
        if(!ok){
          if(elStatus) elStatus.textContent="Could not add community. Check Supabase permissions (RLS).";
          alert("Could not add community. If this keeps happening, open DevTools > Console and share the first red error.");
          return;
        }

        if(nameEl) nameEl.value = "";
        if(elStatus) elStatus.textContent="Community added.";

        // Refresh just the CC list
        try{ await loadCompanyCommunities(true); }catch(_e){}
      }catch(err){
        console.error("[CC] Add community failed", err);
        if(elStatus) elStatus.textContent="Add failed.";
      }
    });
  }
// --- Import Communities (CSV) - companyadmin only ---
  (function(){
    // v999: Supervisor page now implements a premium Import Communities modal inline.
    // Avoid binding a second, older handler (which can cause close/reopen flicker
    // especially when the OS file picker is canceled).
    if (window.__ZUMMEE_IMPORT_COMM_V2) return;
    function qs(id){ return document.getElementById(id); }
    var btn = qs("sup_importCommunitiesBtn");
    if(!btn) return;

    // Show only for companyadmin account
    (async function(){
      try{
var u = await getUserSafe();
        if(u && isCompanyAdminEmail(u)) btn.style.display = "";
      }catch(_e){}
    })();

    var modal = qs("zummeeImportCommModal");
    var fileIn = qs("zummeeImportCommFile");
    var info = qs("zummeeImportCommInfo");
    var errBox = qs("zummeeImportCommError");
    var cancelBtn = qs("zummeeImportCommCancel");
    var runBtn = qs("zummeeImportCommRun");

    var parsedNames = [];

    function open(){
      if(!modal) return;
      errBox.textContent = "";
      errBox.classList.remove("is-show");
      info.textContent = "";
      runBtn.disabled = true;
      parsedNames = [];
      if(fileIn) fileIn.value = "";
      modal.classList.add("is-show");
      modal.setAttribute("aria-hidden","false");
    }
    function close(){
      if(!modal) return;
      modal.classList.remove("is-show");
      modal.setAttribute("aria-hidden","true");
    }

    btn.addEventListener("click", open);
    cancelBtn && cancelBtn.addEventListener("click", close);
    modal && modal.addEventListener("click", function(e){ if(e.target===modal) close(); });

    function showErr(msg){
      errBox.textContent = msg;
      errBox.classList.add("is-show");
    }

    function parseCsvText(text){
      // Simple CSV parser: supports quoted fields and commas
      var rows = [];
      var i=0, cur="", row=[], inQ=false;
      while(i<text.length){
        var ch=text[i];
        if(ch === '"'){
          if(inQ && text[i+1]==='"'){ cur+='"'; i+=2; continue; }
          inQ = !inQ; i++; continue;
        }
        if(!inQ && (ch === ',')){
          row.push(cur); cur=""; i++; continue;
        }
        if(!inQ && (ch === '\n' || ch === '\r')){
          // handle CRLF
          if(ch === '\r' && text[i+1]==='\n') i++;
          row.push(cur); cur="";
          // ignore empty trailing last line
          if(row.length>1 || (row.length===1 && row[0].trim()!=="")) rows.push(row);
          row=[]; i++; continue;
        }
        cur += ch; i++;
      }
      if(cur.length || row.length){
        row.push(cur);
        if(row.length>1 || (row.length===1 && row[0].trim()!=="")) rows.push(row);
      }
      return rows;
    }

    function extractNames(rows){
      if(!rows || !rows.length) return [];
      var headers = rows[0].map(function(h){ return String(h||"").trim().toLowerCase(); });
      var nameIdx = headers.indexOf("community name");
      if(nameIdx < 0) nameIdx = headers.indexOf("name");
      if(nameIdx < 0) nameIdx = headers.indexOf("community");
      if(nameIdx < 0) return null;

      var names = [];
      for(var r=1;r<rows.length;r++){
        var v = rows[r][nameIdx];
        var nm = String(v||"").trim();
        if(!nm) continue;
        names.push(nm);
      }
      // de-dupe in file (case-insensitive)
      var seen = new Set();
      var out = [];
      names.forEach(function(n){
        var k = n.toLowerCase();
        if(seen.has(k)) return;
        seen.add(k);
        out.push(n);
      });
      return out;
    }

    fileIn && fileIn.addEventListener("change", function(){
      errBox.textContent = "";
      errBox.classList.remove("is-show");
      parsedNames = [];
      runBtn.disabled = true;
      info.textContent = "";

      var f = fileIn.files && fileIn.files[0];
      if(!f) return;
      if(!/\.csv$/i.test(f.name)){
        showErr("Please upload a .csv file.");
        return;
      }
      var reader = new FileReader();
      reader.onload = function(){
        try{
          var text = String(reader.result||"");
          var rows = parseCsvText(text);
          var names = extractNames(rows);
          if(!names){
            showErr('CSV must include a header column named "Community Name" (or "Name").');
            return;
          }
          if(!names.length){
            showErr("No community names found in the CSV.");
            return;
          }
          parsedNames = names;
          info.textContent = "Ready to import: " + names.length + " communities.";
          runBtn.disabled = false;
        }catch(e){
          showErr("Could not read CSV. " + (e && e.message ? e.message : String(e)));
        }
      };
      reader.readAsText(f);
    });

    runBtn && runBtn.addEventListener("click", async function(){
      try{
        errBox.textContent = "";
        errBox.classList.remove("is-show");
        if(!parsedNames.length){
          showErr("Select a CSV file first.");
          return;
        }

        var company = getCompany();
        if(!company){
          showErr("No company selected.");
          return;
        }

        runBtn.disabled = true;
        runBtn.textContent = "Importing…";

var sb = await ensureSupabase();
var companyRow = await getCompanyRowByName(sb, company);
        var companyId = companyRow && companyRow.id;

        // Load existing community names for this company to avoid duplicates
var existing = await sb.from("PropertyCommunities")
          .select("id,name")
          .eq("company_id", companyId);

        var existingSet = new Set((existing.data||[]).map(function(r){ return String(r.name||"").trim().toLowerCase(); }));

        var toInsert = [];
        parsedNames.forEach(function(n){
          var k = n.toLowerCase();
          if(existingSet.has(k)) return;
          toInsert.push({ name: n, company: company, company_id: companyId });
        });

        if(!toInsert.length){
          info.textContent = "Nothing to import — all communities already exist.";
          runBtn.textContent = "Import";
          close();
try{ u.role = next; btn.textContent = (next==='Supervisor'?'Remove Supervisor':'Make Supervisor'); if(elStatus) elStatus.textContent='Updated.'; }catch(_e){}
          return;
        }

        // Insert in chunks to avoid payload limits
        var inserted = 0;
        for(var i=0;i<toInsert.length;i+=100){
          var chunk = toInsert.slice(i,i+100);
var r = await sb.from("PropertyCommunities").insert(chunk);
          if(r.error) throw r.error;
          inserted += chunk.length;
        }

        info.textContent = "Imported " + inserted + " communities. Skipped " + (parsedNames.length - inserted) + " duplicates.";
        runBtn.textContent = "Import";
        close();

        // Refresh UI lists
try{ u.role = next; btn.textContent = (next==='Supervisor'?'Remove Supervisor':'Make Supervisor'); if(elStatus) elStatus.textContent='Updated.'; }catch(_e){}
      }catch(e){
        showErr("Import failed: " + (e && e.message ? e.message : String(e)));
      }finally{
        runBtn.disabled = false;
        runBtn.textContent = "Import";
      }
    });
  

  // Public helpers (debug + manual refresh)
  // Guard exports so we don't throw ReferenceError if a function is defined later.
  window.loadEmployeesForSupervisor = loadEmployeesForSupervisor;
  if (typeof renderEmployeeManagement === 'function') window.renderEmployeeManagement = renderEmployeeManagement;
  if (typeof refreshEmployees === 'function') window.refreshEmployees = refreshEmployees;

  // Company Communities
  if (typeof renderCompanyCommunities === 'function') window.renderCompanyCommunities = renderCompanyCommunities;
  // Company Communities refresh helpers.
  // Use a guarded resolver so we never hard-crash if a symbol is missing due to script order.
  async function __ccRefreshSafe(){
    if (typeof window.refreshCompanyCommunitiesNow === 'function') return window.refreshCompanyCommunitiesNow();
    if (typeof refreshCompanyCommunitiesNow === 'function') return refreshCompanyCommunitiesNow();
    if (typeof window.refreshCompanyCommunities === 'function') return window.refreshCompanyCommunities();
    return [];
  }

  window.refreshCompanyCommunities = async function(){
await __ccRefreshSafe();
    return window.companyCommunities || [];
  };

  window.refreshAll = async function(){
const emp = (typeof refreshEmployees === 'function') ? await refreshEmployees() : null;
await __ccRefreshSafe();
    return { emp, companyCommunities: window.companyCommunities || [] };
  };
})();


  var btnEditCommunity = $("sup_editCommunityBtn");
  if(btnEditCommunity){
    btnEditCommunity.addEventListener("click", async function(){
      try{
        var company = getCompany();
        var setter = document.getElementById("sup_companySetter");
        if(!company){
          if(setter) setter.style.display="";
          setStatusText("Select or set a company first.");
          return;
        }
        if(!_selectedCommunityId){
          setStatusText("Select a community from the list to edit.");
          return;
        }
        var id = _selectedCommunityId;
        var current = _selectedCommunityName;
        var proposed = String((($("sup_newCommunityName")||$("sup_addCommunityModalName"))||{}).value||"").trim();
        var newName = proposed || prompt("Rename community:", current);
        if(newName === null) return; // cancelled
        newName = String(newName||"").trim();
        if(!newName){ alert("Enter a community name."); return; }
        if(newName === current){ setStatusText("No changes."); return; }

        // Prevent duplicates
        var key = companyCommunitiesKey(company);
        var list0 = loadJSON(key, []);
        var dup = (list0||[]).some(function(c){ return String(c.id)!==String(id) && String(c.name||"").trim().toLowerCase()===newName.toLowerCase(); });
        if(dup){ alert("A community with that name already exists for this company."); return; }

        setStatusText("Renaming…");
await doRenameCommunity(company, id, current, newName);
        setSelectedCommunity(id, newName);
$("sup_newCommunityName").value = newName;
// v966: Avoid refreshAll() here; it can rehydrate CC state using a different company key and "jump" the list.
// Instead, preserve current company picker value and reload only the CC list.
try{
  var __pv2 = document.getElementById('sup_ccCompanyPicker')?.value;
  await loadCompanyCommunities(true);
  if(__pv2 && document.getElementById('sup_ccCompanyPicker')) document.getElementById('sup_ccCompanyPicker').value = __pv2;
}catch(_e){}
}catch(e){
        console.warn("Edit community failed:", e);
        setStatusText("Rename failed.");
        alert("Could not rename community. Check permissions (RLS) and try again.");
      }
    });
  }

// Assign per-community: on change, persist { communityId: userId }
  if(elAssign){
    elAssign.addEventListener("change", async function(e){
      var tgt = e && e.target;
      if(!tgt || !tgt.matches || !tgt.matches("select[data-community]")) return;
      var company = getCompany();
      var setter = document.getElementById("sup_companySetter");
      if(!company){ if(setter) setter.style.display=""; if(elStatus) elStatus.textContent="Set company to manage assignments."; return; }
      if(setter) setter.style.display="none";
      var cid = String(tgt.getAttribute("data-community")||"");
      var uid = String(tgt.value||"");

      if(elStatus) elStatus.textContent="Saving…";
var ok = await setAssignmentInCloud(company, cid, uid || "");
      if(!ok){ if(elStatus) elStatus.textContent="Could not save assignment."; return; }

      // Update local cache immediately for UI + legacy pages
      var akey = assignmentsKey(company);
      var map = loadJSON(akey, {});
      if(uid){ map[cid]=uid; } else { delete map[cid]; }
      try{ saveJSON(akey, map); }catch(_e){}
      if(elStatus) elStatus.textContent="Saved.";

      try{ window.dispatchEvent(new CustomEvent("communities:updated", { detail: { userId: uid } })); }catch(_e){}
u.role = next; btn.textContent = (next==='Supervisor'?'Remove Supervisor':'Make Supervisor'); if(elStatus) elStatus.textContent='Updated.';
    });
  }

  // Show/hide based on profile department
  window.addEventListener("profile:loaded", function(ev){
    var d = (ev && ev.detail) || {};
    var dept = '';
    if(!dept && window.__zummeeUserDepartment) dept = String(window.__zummeeUserDepartment).trim();

    (async function(){
      try{
        var company = String(d.company||"").trim();
        if(window.sb && d.userId){
var q = await window.sb.from("userdirectory").select(`
id,
auth_user_id,
company_id,
role,
approved,
created_at,
profiles:auth_user_id ( name, email, phone )
`).eq("id", d.userId).maybeSingle();
          if(q && q.data){
            window.__zummeeCompany = (q.data.company||company||"").trim();
            window.__zummeeUserDepartment = (q.data.department||"").trim();
            ensureSupervisorVisible({ department: window.__zummeeUserDepartment });
          } else {
            ensureSupervisorVisible({ department: dept });
          }
        } else {
          ensureSupervisorVisible({ department: dept });
        }
      }catch(_e){
        ensureSupervisorVisible({ department: dept });
      }
    })();
  });
// ---- Supervisor Access: tabs (Assignments / Employees / Current) ----
function initSupervisorTabs(){
  var box = document.getElementById('supervisorBox');
  if(!box) return;
  var tabs = Array.prototype.slice.call(box.querySelectorAll('.sup-tab'));
  if(!tabs.length) return;

  var panels = {
    assign: document.getElementById('sup_tab_assign'),
    employees: document.getElementById('sup_tab_employees'),
    current: document.getElementById('sup_tab_current'),
    vendors: document.getElementById('sup_tab_vendors')
  };

  function activate(name){
    tabs.forEach(function(t){
      var on = (t.getAttribute('data-sup-tab') === name);
      t.classList.toggle('is-active', on);
    });
    Object.keys(panels).forEach(function(k){
      if(!panels[k]) return;
      panels[k].style.display = (k === name) ? '' : 'none';
    });
  }

  tabs.forEach(function(btn){
    btn.addEventListener('click', function(){
      activate(btn.getAttribute('data-sup-tab'));
    });
  });

  // Default tab
  activate('assign');
}
  function isGlobalAdmin(){
    // Admin accounts have global visibility/approval scope
    return isAdmin();
  }


// v738: Expose Company Communities renderer globally.
// refreshAll() and other modules call window.renderCompanyCommunities(...).
try{
  window.renderCompanyCommunities = renderCompanyCommunities;
  // Provide legacy var binding for older inline handlers (best-effort)
  try{ window.eval('var renderCompanyCommunities = window.renderCompanyCommunities;'); }catch(_e){}
}catch(_e){}



document.addEventListener('DOMContentLoaded', async function(){
  // Ensure company pickers reflect persisted selection (prevents blank picker / blank lists on load)
  try{
    const saved = localStorage.getItem('activeCompanyId') || localStorage.getItem('zummee_company_id') || '';
    if(saved){
      ['sup_companySelect','sup_adminCompanyPicker','sup_ccCompanyPicker','cm_companySelect'].forEach(function(id){
        const s = document.getElementById(id);
        if(!s || !s.options || !s.options.length) return;
        const idx = Array.from(s.options).findIndex(o => String(o.value) === String(saved));
        if(idx >= 0){
          s.selectedIndex = idx;
          s.value = saved;
        }
      });
      try{ window.__supCompanyId = saved; }catch(_e){}
      try{ window.activeCompanyId = saved; }catch(_e){}
    }
  }catch(_e){}
  setTimeout(initSupervisorTabs, 0);
  try{ pvBind(); }catch(_e){}
  try{ pvRender(); }catch(_e){}

  // Auto-detect company/company_id from supervisor profile so approvals populate automatically
  try{
    if(window.sb){
var uRes = await (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.getUserResultSafe ? window.ZUMMEE_AUTH.getUserResultSafe(5000) : window.sb.auth.getUser());
      var user = (uRes && uRes.data && uRes.data.user) ? uRes.data.user : null;
      if(user && user.id){
var qp = await window.sb.from("userdirectory").select("company_id,role,approved,created_at,auth_user_id").or("auth_user_id.eq."+user.id+",id.eq."+user.id).maybeSingle();
        if(qp && qp.data){
          __supCompanyId = String(qp.data.company_id || "").trim();
          try{ window.__supCompanyId = __supCompanyId; }catch(_e){}
          __supCompanyName = String(qp.data.company || "").trim();
          var dept = '';
          var role = String(qp.data.role || "").trim();
          if((dept === "Supervisor" || role === "Admin") && !getCompany() && __supCompanyName){
            setCompany(__supCompanyName);
          }
        }
      }
    }
  }catch(_e){}

try{ await initAdminCompanyPicker(); }catch(_e){}
try{ u.role = next; btn.textContent = (next==='Supervisor'?'Remove Supervisor':'Make Supervisor'); if(elStatus) elStatus.textContent='Updated.'; }catch(_e){}
});

})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(() => {
  function applyTagline(){
    const el = document.querySelector(".zummee-header__subtitle");
    if(!el) return;
    // Store full text once
    if(!el.dataset.fullText) el.dataset.fullText = (el.textContent || "").trim();
    // Default short text (you can change this later)
    const shortText = el.dataset.shortText || "Property Assistant";
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    el.textContent = isMobile ? shortText : el.dataset.fullText;
    el.classList.remove("zummee-tagline-animate");
    // reflow to restart animation
    void el.offsetWidth;
    el.classList.add("zummee-tagline-animate");
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyTagline();
    window.addEventListener("resize", () => {
      // Debounce-ish
      clearTimeout(window.__zummeeTaglineT);
      window.__zummeeTaglineT = setTimeout(applyTagline, 120);
    });
  });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(() => {
  const btn = document.getElementById("zummeeSignOut");
  if(!btn) return;

  async function doSignOut(){
    // Sign out should always end at login.html with a cleared session.
    try{
      // Prefer shared auth helper if present
      if(window.ZummeeAuth && typeof window.ZummeeAuth.signOut === 'function'){
        await window.ZummeeAuth.signOut();
      }else{
        // Fallback: Supabase auth signOut
        const sb = await (typeof ensureSupabase === 'function' ? ensureSupabase() : Promise.resolve(null));
        if(sb && sb.auth && typeof sb.auth.signOut === 'function'){
          await sb.auth.signOut();
        }
      }

      // Clear cached role/company/community hints
      try{ localStorage.removeItem('activeCompanyId'); }catch(_e){}
      try{ localStorage.removeItem('activeCommunityId'); }catch(_e){}
      try{ localStorage.removeItem('activeRole'); }catch(_e){}

      // Aggressively clear Supabase auth tokens (prevents "still logged in" after redirect)
      try{
        Object.keys(localStorage || {}).forEach((k)=>{
          const kl = String(k||'').toLowerCase();
          if(kl.includes('supabase') || kl.includes('auth-token') || kl.startsWith('sb-') || kl.includes('gotrue')){
            try{ localStorage.removeItem(k); }catch(_e){}
          }
        });
      }catch(_e){}
      try{
        Object.keys(sessionStorage || {}).forEach((k)=>{
          const kl = String(k||'').toLowerCase();
          if(kl.includes('supabase') || kl.includes('auth-token') || kl.startsWith('sb-') || kl.includes('gotrue')){
            try{ sessionStorage.removeItem(k); }catch(_e){}
          }
        });
      }catch(_e){}
    }catch(e){
      console.warn('[SignOut] failed', e);
    }finally{
      // Always route back to the login screen (not the hub)
      try{ window.location.replace('login.html?signed_out=1'); }
      catch(_e){ try{ window.location.href = 'login.html?signed_out=1'; }catch(_e2){ window.location.reload(); } }
    }
  }

  function zOpenConfirmModal(opts){
    // opts: { modalId, title, message, okText, cancelText, onConfirm, focus: 'ok'|'cancel' }
    try{
      const modalId = (opts && opts.modalId) ? opts.modalId : 'sup_signOutModal';
      const m = document.getElementById(modalId);
      if(!m) return;

      // Update text if placeholders exist
      try{
        const t = m.querySelector('[data-zmodal-title]');
        if(t && opts && opts.title) t.textContent = opts.title;
      }catch(_e){}
      try{
        const msg = m.querySelector('[data-zmodal-message]');
        if(msg && opts && opts.message) msg.textContent = opts.message;
      }catch(_e){}
      try{
        const ok = m.querySelector('[data-zmodal-ok]');
        if(ok && opts && opts.okText) ok.textContent = opts.okText;
      }catch(_e){}
      try{
        const cancel = m.querySelector('[data-zmodal-cancel]');
        if(cancel && opts && opts.cancelText) cancel.textContent = opts.cancelText;
      }catch(_e){}

      // Store confirm callback
      m.__zOnConfirm = (opts && typeof opts.onConfirm === 'function') ? opts.onConfirm : null;

      // Show
      m.style.display = 'block';

      // Autofocus
      setTimeout(() => {
        try{
          const ok = m.querySelector('[data-zmodal-ok]');
          const cancel = m.querySelector('[data-zmodal-cancel]');
          const focus = (opts && opts.focus) ? opts.focus : 'ok';
          if(focus === 'cancel' && cancel && cancel.focus) cancel.focus();
          else if(ok && ok.focus) ok.focus();
        }catch(_e){}
      }, 30);

    }catch(_e){}
  }
  function zCloseConfirmModal(modalId){
    try{
      const m = document.getElementById(modalId || 'sup_signOutModal');
      if(!m) return;
      m.style.display = 'none';
      m.__zOnConfirm = null;
    }catch(_e){}
  }

  btn.addEventListener("click", () => {
    zOpenConfirmModal({
      modalId: 'sup_signOutModal',
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      okText: 'Sign out',
      cancelText: 'Cancel',
      focus: 'ok',
      onConfirm: doSignOut
    });
  });

  // modal wiring (generic)
  
  // v925: backward-compatible shims (some older handlers still call these)
  function closeSignOutModal(){ try{ (window.ZConfirm && window.ZConfirm.close) ? window.ZConfirm.close('sup_signOutModal') : (document.getElementById('sup_signOutModal').style.display='none'); }catch(_e){} }
  function openSignOutModal(){ try{ (window.ZConfirm && window.ZConfirm.open) ? window.ZConfirm.open({modalId:'sup_signOutModal', title:'Sign out', message:'Are you sure you want to sign out?', okText:'Sign out', cancelText:'Cancel', focus:'ok', onConfirm: doSignOut}) : (document.getElementById('sup_signOutModal').style.display='block'); }catch(_e){} }

document.addEventListener('click', (ev) => {
    const t = ev.target;
    if(!t) return;
    const m = document.getElementById('sup_signOutModal');
    if(!m || m.style.display !== 'block') return;

    if(t.id === 'sup_signOutCancel' || t.getAttribute('data-zmodal-cancel') !== null){
      zCloseConfirmModal('sup_signOutModal');
      return;
    }
    if(t.id === 'sup_signOutOk' || t.getAttribute('data-zmodal-ok') !== null){
      const fn = m.__zOnConfirm;
      zCloseConfirmModal('sup_signOutModal');
      try{ fn && fn(); }catch(_e){}
      return;
    }
    if(t.id === 'sup_signOutModal'){
      zCloseConfirmModal('sup_signOutModal');
      return;
    }
  });

  document.addEventListener('keydown', (ev) => {
    if(ev.key === 'Escape'){
      const m = document.getElementById('sup_signOutModal');
      if(m && m.style.display === 'block') zCloseConfirmModal('sup_signOutModal');
    }
  });

  // Expose for future destructive actions (optional use)
  window.ZConfirm = window.ZConfirm || { open: zOpenConfirmModal, close: zCloseConfirmModal };
("click", () => {
    openSignOutModal();
  });

  // modal wiring
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    if(!t) return;
    if(t.id === 'sup_signOutCancel'){
      closeSignOutModal();
      return;
    }
    if(t.id === 'sup_signOutOk'){
      closeSignOutModal();
      doSignOut();
      return;
    }
    // click outside card closes
    if(t.id === 'sup_signOutModal'){
      closeSignOutModal();
      return;
    }
  });

  document.addEventListener('keydown', (ev) => {
    if(ev.key === 'Escape'){
      const m = document.getElementById('sup_signOutModal');
      if(m && m.style.display === 'block') closeSignOutModal();
    }
  });

})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(() => {
  function safeParse(raw){ try { return JSON.parse(raw); } catch(e){ return null; } }
  function hashToHue(str){
    let h = 0;
    for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) >>> 0; }
    return h % 360;
  }
  function getAccent(seed){
    const hue = hashToHue(seed || "community");
    // Pleasant, brand-consistent blue-green range
    const base = 190 + (hue % 70); // 190-259
    return {
      bg: `hsl(${base} 55% 78%)`,
      border: `hsl(${base} 55% 55%)`
    };
  }

  function getSelectedCommunity(){
    const commKey = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || "zummee_communities_v1";
    const selKey = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY) || window.SELECTED_COMMUNITY_KEY || "zummee_selected_community_v1";
    let selectedId = "";
    try { selectedId = localStorage.getItem(selKey) || ""; } catch(e) {}
    let list = [];
    try { list = safeParse(localStorage.getItem(commKey) || "[]") || []; } catch(e) {}
    const match = list.find(c => c && (c.id === selectedId || c.name === selectedId));
    return match || (selectedId ? { id:selectedId, name:selectedId } : null);
  }

  function applyAccent(){
    const sw = document.getElementById("zummeeCommunitySwatch");
    const select = document.getElementById("zummeeCommunitySelect");
    const c = getSelectedCommunity();

    if(!c){
      document.documentElement.style.removeProperty("--communityAccent");
      document.documentElement.style.removeProperty("--communityAccentBorder");
      if(sw) sw.style.background = "#ffffff";
      return;
    }

    const seed = String(c.id || c.name || "");
    const a = getAccent(seed);
    document.documentElement.style.setProperty("--communityAccent", a.bg);
    document.documentElement.style.setProperty("--communityAccentBorder", a.border);
    if(sw) sw.style.background = a.bg;

    // Add a dot to each option label (cross-browser).
    if(select){
      Array.from(select.options || []).forEach(opt => {
        if(!opt) return;
        const baseText = (opt.dataset.baseText || opt.textContent || "").replace(/^●\s+/, "");
        opt.dataset.baseText = baseText;
        opt.textContent = baseText;
        // Some browsers ignore option background; harmless where unsupported.
        const ao = getAccent(opt.value || baseText);
        opt.style.backgroundColor = ao.bg;
        opt.style.color = "#0f2f4a";
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyAccent();

    const select = document.getElementById("zummeeCommunitySelect");
    if(select){
      select.addEventListener("change", () => setTimeout(applyAccent, 0));
    }

    // If other scripts repopulate the dropdown a moment later.
    setTimeout(applyAccent, 250);
  });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  if(window.__zummeeMergeAssignedOnce) return;
  window.__zummeeMergeAssignedOnce = true;
  window.addEventListener("profile:loaded", function(ev){
    try{
      var d = (ev && ev.detail) || {};
      if(window.ZUMMEE_mergeAssignedCommunities){
        window.ZUMMEE_mergeAssignedCommunities(d.userId || d.id, d.company || d.companyName || "");
      }
    }catch(_e){}
  });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




  // Ensure Supervisor box is visible at top on this page
  document.addEventListener("DOMContentLoaded", function(){
    var el = document.getElementById("supervisorBox");
    if(el) el.scrollIntoView({behavior:"auto", block:"start"});
  });

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




/* Preferred Vendors (Supervisor-only CRUD)
   Storage key must match preferred_vendors.html (view-only page):
   "zummee_preferred_vendors_v1__" + <company>
*/
(function(){
  function safeGet(k){ try{ return localStorage.getItem(k)||""; }catch(e){ return ""; } }
  function safeSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function safeJSON(k, def){ try{ return JSON.parse(safeGet(k)||"") || def; }catch(e){ return def; } }

  function getCompany(){
    try{
      var auth = window.ZUMMEE_AUTH || {};
      var role = String(auth.role || window.__zummeeUserRole || '').trim();
      if(role === 'Admin'){
        var picked = String(safeGet('zummee_admin_selected_company')||'').trim();
        if(picked) return picked;
      }
      return String(window.__zummeeCompany || safeGet('zummee_company') || "").trim();
    }catch(e){ return String(safeGet('zummee_company')||"").trim(); }
  }
  function vendorsKey(company){
    return "zummee_preferred_vendors_v1__" + String(company||"").trim();
  }
  function uid(){
    return "pv_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
  }
  function normalizePhone(p){
    return String(p||"").trim();
  }
  function esc(s){
    return String(s||"").replace(/[&<>"']/g, function(c){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]);
    });
  }

  var pvEditId = null;

  function getEls(){
    return {
      name: document.getElementById("pv_vendorName"),
      type: document.getElementById("pv_vendorType"),
      contact: document.getElementById("pv_contactName"),
      phone: document.getElementById("pv_phone"),
      email: document.getElementById("pv_email"),
      notes: document.getElementById("pv_notes"),
      addBtn: document.getElementById("pv_addBtn"),
      clearBtn: document.getElementById("pv_clearBtn"),
      search: document.getElementById("pv_search"),
      list: document.getElementById("pv_list"),
      count: document.getElementById("pv_count")
    };
  }

  function readRows(company){
    var rows = safeJSON(vendorsKey(company), []);
    if(!Array.isArray(rows)) rows = [];
    return rows;
  }
  function writeRows(company, rows){
    safeSet(vendorsKey(company), JSON.stringify(rows||[]));
  }

  function render(){
    var els = getEls();
    if(!els.list) return;
    var company = getCompany();
    var rows = readRows(company);

    var q = String((els.search && els.search.value) || "").toLowerCase().trim();
    var filtered = rows.filter(function(v){
      if(!q) return true;
      var hay = [v.vendorName,v.vendorType,v.contactName,v.phone,v.email,v.notes].map(function(x){
        return String(x||"").toLowerCase();
      }).join(" ");
      return hay.indexOf(q) !== -1;
    });

    if(!filtered.length){
      els.list.innerHTML = '<tr><td colspan="6" class="muted tiny" style="padding:12px">No vendors yet.</td></tr>';
      if(els.count) els.count.textContent = "0 vendors";
      return;
    }

    els.list.innerHTML = filtered.map(function(v){
      var phone = String(v.phone||"").trim();
      var email = String(v.email||"").trim();
      var phoneCell = phone ? ('<a href="tel:'+encodeURIComponent(phone)+'" style="font-weight:800; color:#0f2f4a; text-decoration:none">'+esc(phone)+'</a>') : '—';
      var emailCell = email ? ('<a href="mailto:'+esc(email)+'" style="font-weight:800; color:#0f2f4a; text-decoration:none">'+esc(email)+'</a>') : '—';
      return (
        '<tr data-pv-id="'+esc(v.id||"")+'">'+
          '<td style="padding:10px 12px"><div style="font-weight:900">'+esc(v.vendorName||"")+'</div>'+(v.notes?('<div class="muted tiny" style="margin-top:2px">'+esc(v.notes)+'</div>'):'')+'</td>'+
          '<td style="padding:10px 12px">'+esc(v.vendorType||"—")+'</td>'+
          '<td style="padding:10px 12px">'+esc(v.contactName||"—")+'</td>'+
          '<td style="padding:10px 12px">'+phoneCell+'</td>'+
          '<td style="padding:10px 12px">'+emailCell+'</td>'+
          '<td style="padding:10px 12px; text-align:right">'+
            '<button class="btn btn--ghost pv-edit" type="button" data-pv-edit="'+esc(v.id||"")+'" style="padding:8px 10px; margin-right:6px">Edit</button>'+
            '<button class="btn btn--ghost pv-del btn--icon" type="button" data-pv-del="'+esc(v.id||"")+'" title="Delete" aria-label="Delete" style="padding:8px 10px">🗑</button>'+
          '</td>'+
        '</tr>'
      );
    }).join("");

    if(els.count) els.count.textContent = filtered.length + " vendor" + (filtered.length===1?"":"s");
  }

  function clearFields(){
    var els = getEls();
    if(!els.name) return;
    // If we're editing, 'Clear Fields' acts as 'Cancel Edit'
    if(pvEditId){
      pvEditId = null;
      if(els.addBtn) els.addBtn.textContent = "Add Vendor";
      if(els.clearBtn) els.clearBtn.textContent = "Clear Fields";
    }
    els.name.value = "";
    els.type.value = "";
    els.contact.value = "";
    els.phone.value = "";
    els.email.value = "";
    els.notes.value = "";
    els.name.focus();
  }

  function startEdit(id){
    var els = getEls();
    var company = getCompany();
    var rows = readRows(company);
    var v = rows.find(function(r){ return String(r.id||"") === String(id||""); });
    if(!v){ alert("Vendor not found."); return; }
    pvEditId = String(v.id||"");
    els.name.value = v.vendorName || "";
    els.type.value = v.vendorType || "";
    els.contact.value = v.contactName || "";
    els.phone.value = v.phone || "";
    els.email.value = v.email || "";
    els.notes.value = v.notes || "";
    if(els.addBtn) els.addBtn.textContent = "Save Changes";
    if(els.clearBtn) els.clearBtn.textContent = "Cancel Edit";
    els.name.focus();
  }


  
  
  // --- Preferred Vendors: Zummee branded modal (matches Add Community) ---
  function pvEnsureModal(){
    if(document.getElementById("zummeeVendorModal")) return;

    var wrap = document.createElement("div");
    wrap.innerHTML = `
<style>
/* Vendor modal uses the same Zummee modal classes defined for Add Community.
   We only add a small grid helper for 2-column layout on desktop. */
.zummee-modal__grid2{
  display:grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 12px;
}
@media (max-width: 720px){
  .zummee-modal__grid2{ grid-template-columns: 1fr; }
}
</style>

<div id="zummeeVendorModal" class="zummee-modal__backdrop" aria-hidden="true">
  <div class="zummee-modal__card" role="dialog" aria-modal="true" aria-labelledby="zummeeVendorTitle">
    <div class="zummee-modal__header">
      <div class="zummee-modal__icon" aria-hidden="true">+</div>
      <div>
        <div id="zummeeVendorTitle" class="zummee-modal__title">Add Vendor</div>
        <div class="zummee-modal__subtitle">Add a company-wide preferred vendor.</div>
      </div>
    </div>

    <div class="zummee-modal__body">
      <div class="zummee-modal__label">Vendor Name <span style="color:#ff5b5b">*</span></div>
      <input id="zummeeVendor_name" class="zummee-modal__input" type="text" placeholder="e.g., ABC Plumbing" autocomplete="off" />

      <div class="zummee-modal__grid2" style="margin-top:10px;">
        <div>
          <div class="zummee-modal__label">Vendor Type</div>
          <select id="zummeeVendor_type" class="zummee-modal__input" style="height:46px;">
<option value="">Select type...</option>
<option value="Plumbing">Plumbing</option>
<option value="Electrical">Electrical</option>
<option value="HVAC">HVAC</option>
<option value="Landscaping">Landscaping</option>
<option value="Pool">Pool</option>
<option value="Pest Control">Pest Control</option>
<option value="Cleaning / Janitorial">Cleaning / Janitorial</option>
<option value="Security">Security</option>
<option value="Roofing">Roofing</option>
<option value="Painting">Painting</option>
<option value="Flooring">Flooring</option>
<option value="General Contractor">General Contractor</option>
<option value="Fire Alarm / Sprinkler">Fire Alarm / Sprinkler</option>
<option value="Locksmith">Locksmith</option>
<option value="IT / Low Voltage">IT / Low Voltage</option>
<option value="Waste / Trash">Waste / Trash</option>
<option value="Snow Removal">Snow Removal</option>
<option value="Other">Other</option>
</select>
        </div>
        <div>
          <div class="zummee-modal__label">Contact Name</div>
          <input id="zummeeVendor_contact" class="zummee-modal__input" type="text" placeholder="e.g., Jane Doe" autocomplete="off" />
        </div>
        <div>
          <div class="zummee-modal__label">Phone</div>
          <input id="zummeeVendor_phone" class="zummee-modal__input" type="text" placeholder="e.g., 555-555-5555" autocomplete="off" />
        </div>
        <div>
          <div class="zummee-modal__label">Email</div>
          <input id="zummeeVendor_email" class="zummee-modal__input" type="text" placeholder="e.g., vendor@email.com" autocomplete="off" />
        </div>
      </div>

      <div class="zummee-modal__label" style="margin-top:10px;">Notes</div>
      <textarea id="zummeeVendor_notes" class="zummee-modal__input" style="min-height:84px; resize:vertical;" placeholder="Optional notes"></textarea>

      <div id="zummeeVendorError" class="zummee-modal__error" role="alert" aria-live="polite"></div>
    </div>

    <div class="zummee-modal__footer">
      <button id="zummeeVendorCancel" type="button" class="zummee-btn zummee-btn--ghost">Cancel</button>
      <button id="zummeeVendorSave" type="button" class="zummee-btn zummee-btn--primary">Save Vendor</button>
    </div>
  </div>
</div>
`;
    document.body.appendChild(wrap);

    // wire buttons
    var modal = document.getElementById("zummeeVendorModal");
    var cancel = document.getElementById("zummeeVendorCancel");
    var save = document.getElementById("zummeeVendorSave");

    function close(){
      modal.classList.remove("is-show");
      modal.setAttribute("aria-hidden","true");
      modal._onSave = null;
    }
    cancel.addEventListener("click", close);

    modal.addEventListener("click", function(e){
      if(e.target === modal) close();
    });

    save.addEventListener("click", function(){
      if(typeof modal._onSave === "function") modal._onSave();
    });

    // ESC closes
    document.addEventListener("keydown", function(ev){
      if(ev.key === "Escape" && modal.classList.contains("is-show")) close();
    });
  }

  function pvOpenVendorModal(prefill, onSave){
    pvEnsureModal();

    var modal = document.getElementById("zummeeVendorModal");
    var titleEl = document.getElementById("zummeeVendorTitle");
    var errBox = document.getElementById("zummeeVendorError");

    titleEl.textContent = (prefill && prefill._mode === "edit") ? "Edit Vendor" : "Add Vendor";
    errBox.textContent = "";
    errBox.classList.remove("is-show");

    function setVal(id, v){
      var el = document.getElementById(id);
      if(!el) return;
      el.value = v || "";
    }
    setVal("zummeeVendor_name", prefill && prefill.vendorName);
    setVal("zummeeVendor_type", prefill && prefill.vendorType);
    setVal("zummeeVendor_contact", prefill && prefill.contactName);
    setVal("zummeeVendor_phone", prefill && prefill.phone);
    setVal("zummeeVendor_email", prefill && prefill.email);
    setVal("zummeeVendor_notes", prefill && prefill.notes);

    modal._onSave = function(){
      var vendorName = (document.getElementById("zummeeVendor_name").value||"").trim();
      if(!vendorName){
        errBox.textContent = "Vendor Name is required.";
        errBox.classList.add("is-show");
        return;
      }

      var vendorType = (document.getElementById("zummeeVendor_type").value||"").trim();
      var contactName = (document.getElementById("zummeeVendor_contact").value||"").trim();
      var phone = normalizePhone(document.getElementById("zummeeVendor_phone").value||"");
      var email = (document.getElementById("zummeeVendor_email").value||"").trim();
      var notes = (document.getElementById("zummeeVendor_notes").value||"").trim();

      onSave({ vendorName, vendorType, contactName, phone, email, notes });

      modal.classList.remove("is-show");
      modal.setAttribute("aria-hidden","true");
      modal._onSave = null;
    };

    modal.classList.add("is-show");
    modal.setAttribute("aria-hidden","false");
    setTimeout(function(){ document.getElementById("zummeeVendor_name")?.focus(); }, 0);
  }

  function addVendorPrompt(){
    var company = getCompany();
    var rows = readRows(company);

    pvOpenVendorModal(null, function(v){
      rows.unshift({
        id: uid(),
        createdAt: new Date().toISOString(),
        vendorName: v.vendorName,
        vendorType: v.vendorType,
        contactName: v.contactName,
        phone: v.phone,
        email: v.email,
        notes: v.notes
      });
      writeRows(company, rows);
      render();
    });
  }

  function addVendorClick(){
    // If we're editing, use modal prefill and update that record.
    if(pvEditId){
      var company = getCompany();
      var rows = readRows(company);
      var row = rows.find(function(r){ return r.id === pvEditId; });
      pvOpenVendorModal(Object.assign({_mode:"edit"}, row || {}), function(v){
        if(!row) return;
        row.vendorName = v.vendorName;
        row.vendorType = v.vendorType;
        row.contactName = v.contactName;
        row.phone = v.phone;
        row.email = v.email;
        row.notes = v.notes;
        writeRows(company, rows);
        pvEditId = null;
        // clear inline fields if they exist (legacy)
        try{ }catch(e){}
        render();
      });
      return;
    }
    addVendorPrompt();
  }

  function addVendorClick___sentinel(){}


  function addVendorClick(){
    // If we're editing, keep the existing inline edit workflow.
    if(pvEditId){
      addVendor();
      return;
    }
    addVendorPrompt();
  }

  function addVendor(){
    var els = getEls();
    var company = getCompany();
    var vendorName = String(els.name.value||"").trim();
    if(!vendorName){
      alert("Vendor Name is required.");
      els.name.focus();
      return;
    }
    var rows = readRows(company);
    var payload = {
      vendorName: vendorName,
      vendorType: String(els.type.value||"").trim(),
      contactName: String(els.contact.value||"").trim(),
      phone: normalizePhone(els.phone.value),
      email: String(els.email.value||"").trim(),
      notes: String(els.notes.value||"").trim()
    };
    if(pvEditId){
      // Update existing
      var id = pvEditId;
      var idx = rows.findIndex(function(v){ return String(v.id||"") === String(id||""); });
      if(idx === -1){ alert("Vendor not found."); pvEditId = null; render(); return; }
      rows[idx] = Object.assign({}, rows[idx], payload, { updatedAt: new Date().toISOString() });
      writeRows(company, rows);
      pvEditId = null;
      if(els.addBtn) els.addBtn.textContent = "Add Vendor";
      if(els.clearBtn) els.clearBtn.textContent = "Clear Fields";
      // Keep the selected company id in sync so all downstream filters/scopes (employees, assignments)
      // use the currently selected company, not a stale cached id.
      try{ window.__supCompanyId = (getSelectedCompanyId?.() || window.__supCompanyId || null); }catch(_e2){}
      render();
      return;
    }
    // Add new
    rows.unshift(Object.assign({
      id: uid(),
      createdAt: new Date().toISOString()
    }, payload));
    writeRows(company, rows);
    render();
  }

  function deleteVendor(id){
    var company = getCompany();
    var rows = readRows(company);
    var next = rows.filter(function(v){ return String(v.id||"") !== String(id||""); });
    writeRows(company, next);
    render();
  }

  function wire(){
    var els = getEls();
    if(!els.addBtn || !els.list) return;

    els.addBtn.addEventListener("click", addVendorClick);
    els.clearBtn && els.clearBtn.addEventListener("click", clearFields);
    els.search && els.search.addEventListener("input", function(){ render(); });

    els.list.addEventListener("click", function(e){
      var editBtn = e.target && e.target.closest ? e.target.closest("[data-pv-edit]") : null;
      if(editBtn){
        var eid = editBtn.getAttribute("data-pv-edit");
        if(eid) startEdit(eid);
        return;
      }
      var delBtn = e.target && e.target.closest ? e.target.closest("[data-pv-del]") : null;
      if(!delBtn) return;
      var id = delBtn.getAttribute("data-pv-del");
      if(!id) return;
      if(confirm("Delete this vendor?")) deleteVendor(id);
    });

    // Re-render when switching tabs (some builds hide panels with display:none)
    document.addEventListener("click", function(e){
      var tab = e.target && e.target.closest ? e.target.closest(".sup-tab[data-sup-tab='vendors']") : null;
      if(tab) setTimeout(render, 30);
    });

    render();
  }

  document.addEventListener("DOMContentLoaded", wire);
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  var KEY_BASE = "zummee_nonnegotiables_template_v1";
  var TEMPLATE_ITEMS_TABLE = "daily_ops_template_items";
  function sbClient(){
    try{
      var c = window.sb || window.supabaseClient || (typeof window.ensureSupabaseSync==="function" ? window.ensureSupabaseSync() : null) || null;
      if(c && typeof c.from === "function") return c;
    }catch(e){}
    try{ if(typeof window.getSupabaseClientSafe==="function"){ var d = window.getSupabaseClientSafe(); if(d && typeof d.from==="function") return d; } }catch(e2){}
    return null;
  }

  function getCommunityId(){
    try{
      return (window.ZummeeAuth && typeof window.ZummeeAuth.getSelectedCommunityId === "function")
        ? (window.ZummeeAuth.getSelectedCommunityId() || "")
        : (localStorage.getItem("zummee_selected_community_id") || localStorage.getItem(window.SELECTED_COMMUNITY_KEY) || "");
    }catch(e){ return ""; }
  }
  function key(){
    // Company-wide (applies to all communities)
    return KEY_BASE;
  }
  function normalize(lines){
    var out = [];
    var seen = {};
    for(var i=0;i<lines.length;i++){
      var s = String(lines[i]||"").trim();
      if(!s) continue;
      if(seen[s]) continue;
      seen[s]=1;
      out.push(s);
    }
    return out;
  }
  function setMeta(msg){
    var el = document.getElementById("nonneg_template_meta");
    if(el) el.textContent = msg || "";
  }
  async function load(){
    var ta = document.getElementById("nonneg_template_text");
    if(!ta) return;
    // Prefer cloud as the single source of truth
    try{
      var sb = sbClient();
      var companyId = (window.activeCompanyId || localStorage.getItem("activeCompanyId") || "").trim();
      if(sb && companyId){
        var resp = await sb.from(TEMPLATE_ITEMS_TABLE)
          .select("label,sort_order,is_active")
          .eq("company_id", companyId)
          .eq("template_type", "nonneg")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        if(resp && resp.error){ throw resp.error; }
        var rows = (resp && resp.data) ? resp.data : [];
        if(rows.length){
          var arrCloud = rows.map(function(r){ return String(r.label||"").trim(); }).filter(Boolean);
          ta.value = arrCloud.join("\n");
          try{ localStorage.setItem(key(), JSON.stringify(arrCloud)); }catch(_e){}
          setMeta("Saved company-wide • " + arrCloud.length + " item" + (arrCloud.length===1?"":"s"));
          return;
        }else{
          // No active items in cloud => clear local cache + textarea
          ta.value = "";
          try{ localStorage.removeItem(key()); }catch(_e2){}
          setMeta("No company-wide Non‑Negotiables are set yet.");
          return;
        }
      }
    }catch(_e3){
      // fall back to local storage below
    }
    // Fallback: local cache (offline)
    try{
      var raw = localStorage.getItem(key());
      if(raw){
        var arr = JSON.parse(raw);
        if(Array.isArray(arr)){
          ta.value = arr.join("\n");
          setMeta("Saved company-wide • " + arr.length + " item" + (arr.length===1?"":"s"));
          return;
        }
      }
    }catch(e){}
    setMeta("Not yet set company-wide. You can save a list, or use the default list.");
  }
  function save(useDefault){
    var ta = document.getElementById("nonneg_template_text");
    if(!ta) return;
    var DEFAULTS = [
      "Approve invoices",
      "Inspect property",
      "Confirm previous day emails answered",
      "Check monthly action items",
      "Check work order system",
      "Evaluate contractor work performance",
      "Check contractor & visitor check-in book",
      "Manage amenity reservations",
      "Maintain on-site files",
      "Department check-ins",
      "Prepare for monthly board meeting"
    ];
    var arr = useDefault ? DEFAULTS : normalize(String(ta.value||"").split(/\r?\n/));
    if(!arr.length){
      alert("Please enter at least one item (one per line).");
      return;
    }
    try{
      localStorage.setItem(key(), JSON.stringify(arr));
      ta.value = arr.join("\n");
      setMeta("Saved company-wide • " + arr.length + " item" + (arr.length===1?"":"s"));
      // Cloud sync (structured template items)
      try{
        var sb = sbClient();
        var companyId = (window.activeCompanyId || localStorage.getItem("activeCompanyId") || "").trim();
        if(sb && companyId){
          (async function(){
            try{
              // Soft-sync template items (no hard deletes):
              // - Items present in the new list => ensure is_active=true + update sort_order
              // - Items missing from the new list => set is_active=false
              var existingResp = await sb.from(TEMPLATE_ITEMS_TABLE)
                .select("id,label,is_active")
                .eq("company_id", companyId)
                .eq("template_type", "nonneg");
              var existing = (existingResp && existingResp.data) ? existingResp.data : [];

              // Build maps
              var nextSet = {};
              for(var i=0;i<arr.length;i++){ nextSet[String(arr[i])] = i; }

              var existingByLabel = {};
              for(var j=0;j<existing.length;j++){
                var lab = String(existing[j].label||"");
                if(lab) existingByLabel[lab] = existing[j];
              }

              // Upsert active items
              var inserts = [];
              for(var k=0;k<arr.length;k++){
                var labelK = String(arr[k]);
                var ex = existingByLabel[labelK];
                if(ex && ex.id){
                  await sb.from(TEMPLATE_ITEMS_TABLE)
                    .update({ is_active: true, sort_order: k })
                    .eq("id", ex.id);
                }else{
                  inserts.push({ company_id: companyId, template_type: "nonneg", label: labelK, sort_order: k, is_active: true });
                }
              }
              if(inserts.length){
                await sb.from(TEMPLATE_ITEMS_TABLE).insert(inserts);
              }

              // Deactivate removed items
              var removedIds = [];
              for(var r=0;r<existing.length;r++){
                var labR = String(existing[r].label||"");
                if(!labR) continue;
                if(nextSet[labR] === undefined && existing[r].id){
                  removedIds.push(existing[r].id);
                }
              }
              if(removedIds.length){
                await sb.from(TEMPLATE_ITEMS_TABLE)
                  .update({ is_active: false })
                  .in("id", removedIds);
              }
            }catch(_e){}
          })();
        }
      }catch(_e2){}
      alert("Non‑Negotiables saved. Everyone will see this list on Daily Ops for all communities.");
    }catch(e){
      alert("Could not save. " + (e && e.message ? e.message : ""));
    }
  }

  // Show the box (this page is supervisor-only, but keep consistent)
  var box = document.getElementById("nonNegotiablesAdminBox");
  if(box) box.style.display = "block";

  document.getElementById("nonneg_template_save") && document.getElementById("nonneg_template_save").addEventListener("click", function(){ save(false); });
  document.getElementById("nonneg_template_default") && document.getElementById("nonneg_template_default").addEventListener("click", function(){ save(true); });

  // Reload when community changes (if other scripts fire a custom event, also listen)
  try{
    window.addEventListener("storage", function(ev){
      if(!ev) return;
      if(String(ev.key||"").indexOf(KEY_BASE+"::")===0) load();
    });
  }catch(e){}



  // Clear all company-wide items + signal everyone to reset progress on next open.
  document.getElementById("nonneg_template_clearall") && document.getElementById("nonneg_template_clearall").addEventListener("click", async function(){
    if(!confirm("Delete ALL Non‑Negotiables company‑wide? This will remove the shared list and reset everyone\'s progress (next time they open Daily Ops).")) return;
    try{
      // signal reset for any legacy cache readers
      localStorage.setItem("zummee_nonnegotiables_reset_token_v1", String(Date.now()));

      // Cloud soft-delete: mark all nonneg template items inactive for this company (single source of truth)
      var sb = sbClient();
      var companyId = (window.activeCompanyId || localStorage.getItem("activeCompanyId") || "").trim();
      var deactivated = 0;
      if(sb && companyId){
        var upd = await sb.from(TEMPLATE_ITEMS_TABLE)
          .update({ is_active: false })
          .eq("company_id", companyId)
          .eq("template_type", "nonneg")
          .eq("is_active", true)
          .select("id");
        if(upd && upd.error){ throw upd.error; }
        deactivated = (upd && upd.data) ? upd.data.length : 0;
      }

      // Clear local cache + UI
      // NOTE: Daily Ops has per-user/per-community caches that can keep showing stale Non‑Neg items
      // even after the company-wide list is cleared in the cloud. We clear them broadly to force
      // a clean re-hydration from the cloud source of truth.
      try{ localStorage.removeItem(KEY_BASE); }catch(_e){}
      try{
        var delKeys = [];
        for(var i=0;i<localStorage.length;i++){
          var k = localStorage.key(i) || "";
          if(
            /^daily_ops_manager(_ui)?_v\d+/i.test(k) ||
            /^zummee_nonnegotiables_/i.test(k) ||
            /nonneg/i.test(k)
          ){
            delKeys.push(k);
          }
        }
        for(var j=0;j<delKeys.length;j++) localStorage.removeItem(delKeys[j]);
      }catch(_eCache){}
      var ta = document.getElementById("nonneg_template_text");
      if(ta) ta.value = "";
      setMeta("Cleared company‑wide list. Deactivated " + deactivated + " item" + (deactivated===1?"":"s") + ".");

      // Re-sync textarea from cloud (should be empty now)
      try{ await load(); }catch(_e2){}
      // Use Zummee modal if available, otherwise fallback
      if(window.zOpenAlertModal){ window.zOpenAlertModal("Non‑Negotiables cleared", "Removed " + deactivated + " item" + (deactivated===1?"":"s") + " company‑wide."); }
      else { alert("Non‑Negotiables cleared. Removed " + deactivated + " item" + (deactivated===1?"":"s") + " company‑wide."); }
    }catch(e){
      if(window.zOpenAlertModal){ window.zOpenAlertModal("Could not clear", String((e && e.message) ? e.message : e)); }
      else { alert("Could not clear. " + (e && e.message ? e.message : e)); }
      console.error("Nonneg clear-all failed:", e);
    }
  });

  // Completion report
  function setReportStatus(msg){ var el=document.getElementById("nonneg_report_status"); if(el) el.textContent = msg||""; }
  function renderRows(rows){
    var tbody = document.querySelector("#nonneg_report_table tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    (rows||[]).forEach(function(r){
      var tr=document.createElement("tr");
      function td(txt){ var d=document.createElement("td"); d.style.padding="8px"; d.style.borderBottom="1px solid var(--line)"; d.textContent = txt||""; return d; }
      tr.appendChild(td(r.user_email || r.user_id || ""));
      tr.appendChild(td(r.completed_at ? "Yes" : "No"));
      tr.appendChild(td(r.completed_at ? r.completed_at : ""));
      tbody.appendChild(tr);
    });
  }
  var lastReportRows = [];
  async function runReport(){
    var inp = document.getElementById("nonneg_report_date");
    var dateKey = inp && inp.value ? inp.value : "";
    if(!dateKey){ alert("Choose a date first."); return; }
    setReportStatus("Loading...");
    try{
const sb = await ensureSupabase();
const prof = await getProfile();
      const company = (prof.company||"").trim();
const q = await sb.from("daily_ops_nonneg_completion").select("*").eq("company", company).eq("date_key", dateKey);
      if(q.error) throw q.error;
      lastReportRows = (q.data||[]).sort((a,b)=> String(a.user_email||"").localeCompare(String(b.user_email||"")));
      renderRows(lastReportRows);
      setReportStatus("Loaded " + lastReportRows.length + " record" + (lastReportRows.length===1?"":"s") + ".");
    }catch(e){
      setReportStatus("Could not load report. If the table doesn't exist yet, it needs to be created in Supabase.");
      renderRows([]);
    }
  }
  document.getElementById("nonneg_report_run") && document.getElementById("nonneg_report_run").addEventListener("click", function(){ runReport(); });

  document.getElementById("nonneg_report_export") && document.getElementById("nonneg_report_export").addEventListener("click", function(){
    if(!lastReportRows.length){ alert("Run the report first."); return; }
    var dateKey = (document.getElementById("nonneg_report_date")||{}).value || "";
    var lines = ["user,completed,completed_at"];
    lastReportRows.forEach(function(r){
      var user = (r.user_email || r.user_id || "").replace(/"/g,'""');
      var completed = r.completed_at ? "Yes" : "No";
      var at = (r.completed_at || "").replace(/"/g,'""');
      lines.push('"' + user + '","' + completed + '","' + at + '"');
    });
    var blob = new Blob([lines.join("\\n")], {type:"text/csv;charset=utf-8"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href=url;
    a.download = "nonneg_completion_" + (dateKey || "report") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // Default date = today
  try{
    var d = new Date();
    var iso = d.toISOString().slice(0,10);
    var inp = document.getElementById("nonneg_report_date");
    if(inp && !inp.value) inp.value = iso;
  }catch(_e){}
  load();
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




/* v276 stable: Company Communities enhanced list (scroll, assign, notes, under review, lock, delete) */
(function(){
  if(window.__ZUMMEE_DISABLE_CC_LIST){ try{ console.log('[ASSIGN] legacy CC list renderer disabled'); }catch(e){} return; }
  function $(id){ return document.getElementById(id); }

  // Supabase auth can occasionally hang on some browsers/pages when calling auth.getUser().
  // Use a session-first strategy with a hard timeout and an INITIAL_SESSION fallback.
  async function getSessionSafe(timeoutMs){
    timeoutMs = (typeof timeoutMs === 'number' && timeoutMs > 0) ? timeoutMs : 3500;
    try{
      if(!window.sb || !window.sb.auth) return null;
      var sb = window.sb;
return await new Promise(function(resolve){
        var done = false;
        var sub = null;
        function finish(sess){
          if(done) return;
          done = true;
          try{ if(sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe(); }catch(_e){}
          resolve(sess || null);
        }
        var t = setTimeout(function(){ finish(null); }, timeoutMs);

        // 1) Try normal getSession()
        Promise.resolve()
          .then(function(){ return sb.auth.getSession(); })
          .then(function(r){
            clearTimeout(t);
            finish(r && r.data ? r.data.session : null);
          })
          .catch(function(){
            // keep waiting for INITIAL_SESSION
          });

        // 2) Fallback: wait for INITIAL_SESSION from auth state change
        try{
          sub = sb.auth.onAuthStateChange(function(evt, session){
            if(evt === 'INITIAL_SESSION' || evt === 'SIGNED_IN' || evt === 'TOKEN_REFRESHED'){
              clearTimeout(t);
              finish(session || null);
            }
          });
        }catch(_e){}
      });
    }catch(e){
      return null;
    }
  }
  function safeTrim(v){ return String(v||"").trim(); }
  function keyForCompany(company){ return "zummee_company_communities_v1__" + company; }
  function empKey(company){ return "zummee_company_employees_v1__" + company; }
  function setStatus(msg){
    var el = $("sup_status");
    if(el) el.textContent = msg || "";
  }

  function getCompany(){
    // Company scope for Company Communities:
    // - Supervisors: always locked to their own company (never see others)
    // - CompanyAdmin/Admin: chosen from the Company dropdown (defaults to last used)
    var role = "";
    try{
      role = String((window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role) || window.__zummeeUserRole || window.__supRole || "").trim().toLowerCase();
    }catch(_e){ role = ""; }

    // Admin path: use the Company picker (company name)
    if(role === "admin"){
      var pick = $("sup_ccCompanyPicker") || $("sup_adminCompanyPicker");
      var picked = pick ? safeTrim(pick.value) : "";
      if(picked) return picked;

      try{
        var last = safeTrim(localStorage.getItem("zummee_admin_selected_company"));
        if(last) return last;
      }catch(e){}
      return "";
    }

    // Supervisor path: company comes from existing app state / storage
    try{
      var c0 = safeTrim(window.__zummeeCompany || "");
      if(c0) return c0;
    }catch(_e){}

    var keys = ["zummee_company","zummee_selected_company","zummee_management_company","selectedCompany","zummee_company_name","managementCompanyName"];
    for(var i=0;i<keys.length;i++){
      try{
        var t = safeTrim(localStorage.getItem(keys[i]));
        if(t) return t;
      }catch(e){}
    }
    return "";
  }

  function persistCompany(company){
    if(!company) return;
    try{ localStorage.setItem("zummee_selected_company", company); }catch(e){}
    // Important: do NOT auto-fill the inline search box.
    // (Users should be able to clear it and have it stay cleared.)
  }

  
  async function initCompanyPicker(){
    var wrap = $("sup_ccCompanyPickerWrap");
    var pick = $("sup_ccCompanyPicker");
    if(!wrap || !pick) return;

    // Always keep the picker visible in the UI (next to Search).
    // For non-admin roles we'll populate it with the current company only and disable it.
    // This prevents the control from disappearing when role/auth hydration is slow.
    wrap.style.display = "block";

    var role = "";
    try{
      role = String((window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role) || window.__zummeeUserRole || window.__supRole || "").trim().toLowerCase();
    }catch(_e){ role = ""; }

    // Supervisors never choose companies
    // Admin / CompanyAdmin should be able to pick any company (Zummee staff)
    // Some older builds may not reliably hydrate role; treat any role containing "admin" as admin.
    // Also treat the special support account as admin by email.
    var isAdmin = (role.indexOf("admin") !== -1);
    if(!isAdmin){
      try{
        // best-effort email check
        var em = "";
        em = String((window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.email) || (window.__zummeeUserEmail) || "").trim().toLowerCase();
        if(!em && window.sb && window.sb.auth && window.sb.auth.getSession){
          try{
var s = await window.sb.auth.getSession();
            em = String(s && s.data && s.data.session && s.data.session.user && s.data.session.user.email || "").trim().toLowerCase();
          }catch(_e){}
        }
        if(em === "companyadmin@zummee.local") isAdmin = true;
      }catch(_e2){}
    }

    // If role is not admin, show the current company (if known) and disable.
    // This keeps the UI consistent for supervisors/company users.
    if(!isAdmin){
      try{
        var c = safeTrim(getCompany());
        if(c){
          pick.innerHTML = '<option value="'+esc(c)+'" selected>'+esc(c)+'</option>';
          pick.value = c;
        }else{
          pick.innerHTML = '<option value="" selected>Company</option>';
        }
      }catch(_e3){
        pick.innerHTML = '<option value="" selected>Company</option>';
      }
      try{ pick.disabled = true; }catch(_e4){}
      return;
    }

    // Admin: enable and populate from master company list.
    try{ pick.disabled = false; }catch(_e5){}

    // If Supabase client isn't ready yet, retry shortly (auth hydration race).
    if(!window.sb){
      pick.innerHTML = '<option value="" selected>Loading companies…</option>';
      window.__ccCompanyPickerRetries = (window.__ccCompanyPickerRetries||0) + 1;
      if(window.__ccCompanyPickerRetries <= 10){
        setTimeout(initCompanyPicker, 400);
      }
      return;
    }

    // Build company list from Companies master list (via view CompanyList)
    // (PropertyCommunities can be incomplete; Companies reflects your full list.)
    var companies = [];
    try{
      if(window.sb){
        // Prefer the view created in Supabase SQL: public."CompanyList" (columns: company)
var q = await window.sb.from("CompanyList").select("company");
        if((!q || !Array.isArray(q.data)) && window.sb.from){
          // Fallback: read directly from Companies table if the view isn't present
q = await window.sb.from("Companies").select("name");
        }
        if(q && Array.isArray(q.data)){
          var seen = {};
          q.data.forEach(function(r){
            var c = safeTrim(r && (r.company || r.name));
            if(!c) return;
            var k = c.toLowerCase();
            if(seen[k]) return;
            seen[k]=1;
            companies.push(c);
          });
        }
      }
    }catch(e){}

    companies.sort(function(a,b){ return a.localeCompare(b, undefined, {sensitivity:"base"}); });

    if(!companies.length) return;

    var last = "";
    try{ last = safeTrim(localStorage.getItem("zummee_admin_selected_company")); }catch(e){}
    if(!last) last = companies[0];

    pick.innerHTML = companies.map(function(c){
      var sel = (c === last) ? ' selected' : '';
      return '<option value="'+esc(c)+'"'+sel+'>'+esc(c)+'</option>';
    }).join("");

    pick.addEventListener("change", function(){
      try{ localStorage.setItem("zummee_admin_selected_company", safeTrim(pick.value)); }catch(e){}
      // keep Employee Management picker aligned if present
      var emPick = $("sup_adminCompanyPicker");
      if(emPick){ try{ emPick.value = pick.value; }catch(_e){} }
      render();
    });

    // If Employee Management picker exists, mirror its selection into this one
    var emPick2 = $("sup_adminCompanyPicker");
    if(emPick2){
      try{
        if(emPick2.value && emPick2.value !== pick.value){
          pick.value = emPick2.value;
        }
      }catch(_e){}
    }
  }

function loadCommunities(company){
    if(!company) return [];
    var raw = null;
    try{ raw = localStorage.getItem(keyForCompany(company)); }catch(e){ raw = null; }
    if(!raw) return [];
    try{
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){
      return [];
    }
  }

  function saveCommunities(company, arr){
    try{ localStorage.setItem(keyForCompany(company), JSON.stringify(arr||[])); }catch(e){}
  }

  function normalizeCommunity(obj){
    var o = obj || {};
    // Support multiple schema variants:
    // - legacy local objects: {id,name}
    // - cloud rows: {community_id, community_name}
    // - other fallbacks: {communityId, communityName}
    var id = safeTrim(o.id || o.community_id || o.communityId || o.communityID || o.property_community_id || o.propertyCommunityId);
    if(!id) id = ("cc_" + Math.random().toString(36).slice(2,10));
    var name = safeTrim(o.name || o.community_name || o.communityName || o.community || o.title);
    return {
      id: id,
      name: name,
      locked: !!o.locked,
      underReview: !!o.underReview,
      note: safeTrim(o.note),
      assignedTo: safeTrim(o.assignedTo || o.assignedUserId || o.assignedEmployeeId)
    };
  }

  async function loadEmployees(company){
    const companyName = (typeof company === "string" ? company : getCompany?.());
    if(!companyName) return [];

    // Prefer using the selected company id (fast + avoids name mismatch),
    // but fall back to name→id resolution if needed.
    const selectedId = getSelectedCompanyId?.() || null;

    // If we already loaded/cached for this company, use it.
    const cached = (window.__approvedProfilesByCompanyId && (window.__approvedProfilesByCompanyId[selectedId] || window.__approvedProfilesByCompanyId[window.__supCompanyId])) || null;
    if(cached && Array.isArray(cached) && cached.length) return cached;

    // Query Supabase directly.
    const sb = (typeof getSupabaseClientSafe === "function") ? getSupabaseClientSafe() : null;
    if(!sb) return [];

    let companyId = selectedId;
    if(!companyId){
      try{
companyId = await getCompanyIdByName(sb, companyName);
      }catch(e){
        companyId = null;
      }
    }
    if(!companyId) return [];

    try{
const { data, error } = await sb
        .from("profiles")
        // profiles schema in this project does not include full_name
        .select("id, user_id, auth_user_id, email, name, display_name, first_name, last_name, company, company_id, role, status, supervisor, disabled, deleted")
        .eq("company_id", companyId);

      if(error) throw error;

      // Store so the rest of the page can reuse without re-querying.
      window.__approvedProfilesByCompanyId = window.__approvedProfilesByCompanyId || {};
      window.__approvedProfilesByCompanyId[companyId] = (Array.isArray(data) ? data : []);

      return window.__approvedProfilesByCompanyId[companyId];
    }catch(e){
      console.warn("loadEmployees query failed", e);
      return [];
    }
  }

  function employeesToOptions(employees){
    // Accept either strings or objects
    var opts = [{value:"", label:"Unassigned…"}];
    (employees||[]).forEach(function(e){
      if(!e) return;
      // If employee is a plain string (email or id), use it directly.
      if(typeof e === "string"){
        var s = safeTrim(e);
        if(!s) return;
        opts.push({value:s, label:s});
        return;
      }
      // Support many possible field names/casings coming from local cache or Supabase.
      // Value should be a stable identifier (prefer UUID id, then email).
      var email = safeTrim(e.email || e.Email || e.user_email || e.userEmail);
      // IMPORTANT: For assignments, we must use the user's AUTH uid.
      // Many schemas store the auth uid in user_id, while id may be a separate pk.
      // Prefer user_id over id to ensure communities show for the employee after assignment.
      var id = safeTrim(
        // Current userdirectory schema
        e.auth_user_id || e.authUserId ||
        // Common/legacy shapes
        e.user_id || e.userId || e.auth_id || e.auth_uid || e.authUid ||
        e.uid || e.user_uid ||
        // Fallbacks
        e.id ||
        email
      );

      // Human label: prefer explicit name fields, then first+last, then email, then id.
      var name = safeTrim(
        e.name || e.fullName || e.full_name || e.displayName || e.display_name ||
        e.employeeName || e.employee_name || e.contact_name || e.ContactName
      );
      var first = safeTrim(e.first_name || e.firstName || e.FirstName);
      var last  = safeTrim(e.last_name  || e.lastName  || e.LastName);
      var fl = safeTrim((first + " " + last).trim());
      var label = name || fl || email ||
        (e.auth_user_id ? ('User ' + String(e.auth_user_id).slice(0,8) + '…' + String(e.auth_user_id).slice(-4)) : '') ||
        safeTrim(e.id);
      if(!label && id) label = id;
      if(!id && label) id = label;
      if(!id) return;
      opts.push({value:id, label:label});
    });
    // De-dup by value
    var seen = {};
    opts = opts.filter(function(o){
      if(!o.value) return true;
      if(seen[o.value]) return false;
      seen[o.value] = true;
      return true;
    });
    return opts;
  }

  function render(){
    var listEl = $("sup_companyCommunityList");
    if(!listEl) return;

    var company = getCompany();
    if(!company){
      var role2 = "";
      try{ role2 = String((window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role) || window.__zummeeUserRole || window.__supRole || "").trim().toLowerCase(); }catch(_e){ role2=""; }
      listEl.innerHTML = (role2==="admin")
        ? '<div class="muted tiny">Select a company to view communities.</div>'
        : '<div class="muted tiny">No company found for this account.</div>';
      return;
    }
    persistCompany(company);

    
var communitiesLocal = loadCommunities(company).map(normalizeCommunity).filter(function(c){ return c.name; });
var communities = communitiesLocal;

// Sync master list + assignments from Supabase so we always show ALL communities
// for the scoped company (not just what's cached locally).
// We merge cloud list with local metadata (locked/underReview/note) and cloud assignment (assignedTo).
if(window.sb){
  if(!window.__ccCommSync) window.__ccCommSync = {};
  var syncKey = String(company||"").toLowerCase();
  var lastSync = window.__ccCommSync[syncKey] || 0;
  var now = Date.now();
  if(!window.__ccCommFetchInFlight && (now - lastSync > 4000)){
    window.__ccCommFetchInFlight = true;
    (async function(){
      try{
        var myToken = ++window.__ccLoadToken;
        var companyId = companyIdHint || null;
        if(!companyId){
var crow = await window.getCompanyRow(company);
          companyId = crow && crow.id ? crow.id : null;
        }
        if(!companyId) throw new Error("Could not resolve company_id for: " + company);
        // Abort if user switched companies while we were loading
        try{
          var pickerNow = $("sup_ccCompanyPicker");
          if(pickerNow && pickerNow.value && /^[0-9a-fA-F-]{36}$/.test(pickerNow.value) && pickerNow.value !== companyId) return;
        }catch(_e){}

const schema = await (window.getCCSchema ? window.getCCSchema(window.sb) : (async (sb)=>{ 
          const cached = window.__ccSchema;
          if(cached && cached.table && cached.col) return cached;
          let schema = { table:"Communities", col:"company_id" };
          try{
const t = await sb.from(schema.table).select("id").limit(1);
            if(t.error && (String(t.error.message||"").includes("Could not find the table") || String(t.error.code||"")==="PGRST205")) schema.table="communities";
          }catch(e){ schema.table="communities"; }
          try{
const c = await sb.from(schema.table).select("id").limit(1).eq(schema.col, "00000000-0000-0000-0000-000000000000");
            if(c.error && String(c.error.message||"").toLowerCase().includes("company_id") && String(c.error.message||"").toLowerCase().includes("does not exist")) schema.col="company";
          }catch(e){}
          window.__ccSchema = schema;
          return schema;
        })(window.sb));
        // Some deployments store Communities.company as a UUID (Companies.id), others as company name text.
        // Respect schema.mode when choosing the filter value.
        const companyKey = (schema && schema.mode === "name") ? company : companyId;
var q = await window.sb
          .from(schema.table)
          // Avoid selecting non-existent columns (e.g. company_id) which causes 400 spam.
          .select("id,name,community_name,company")
          .eq(schema.col, companyKey);

        var rows = (q && Array.isArray(q.data)) ? q.data : [];
        // Normalize row name/id across possible schemas
        rows = rows.map(function(r){
          if(!r || typeof r!=='object') return r;
          if(!r.name && r.community_name) r.name = r.community_name;
          if(!r.id && r.community_id) r.id = r.community_id;
          return r;
        });
        var cloud = rows.map(function(r){
          return normalizeCommunity({
            id: r.id,
            name: r.name || r.community || r.title,
            locked: false,
            underReview: false,
            note: "",
            assignedTo: ""
          });
        }).filter(function(c){ return !!c.name; });

        // Pull latest assignments for these communities and apply to assignedTo.
        // CommunityAssignments: community_id -> user_id (latest wins)
        var ids = cloud.map(function(c){ return c.id; }).filter(Boolean);
        var map = {};
        try{
          if(ids.length){
var qa = await window.sb
              .from("CommunityAssignments")
              .select("community_id,user_id,created_at")
              .in("community_id", ids)
              .order("created_at", {ascending:false});
            if(!(qa && qa.error)){
              (qa.data||[]).forEach(function(r){
                var cid2 = String(r.community_id||"");
                if(cid2 && map[cid2] == null) map[cid2] = String(r.user_id||"");
              });
            }
          }
        }catch(_e){ /* non-fatal */ }

        // Map local by id for metadata merge
        var localById = {};
        (communitiesLocal||[]).forEach(function(c){ localById[String(c.id)] = c; });

        var merged = cloud.map(function(c){
          var prev = localById[String(c.id)];
          if(prev){
            c.locked = !!prev.locked;
            c.underReview = !!prev.underReview;
            c.note = safeTrim(prev.note);
            // Prefer cloud assignment; fall back to local if none.
            c.assignedTo = safeTrim(map[String(c.id)] || prev.assignedTo);
          }else{
            c.assignedTo = safeTrim(map[String(c.id)] || "");
          }
          return c;
        });

        // Keep the assignments map cached locally for other pages/modules.
        try{
          if(typeof companyAssignmentsKey === "function") localStorage.setItem(companyAssignmentsKey(company), JSON.stringify(map||{}));
        }catch(_e){}
        try{
          // Legacy key used by some older modules
          if(typeof assignmentsKey === "function") localStorage.setItem(assignmentsKey(company), JSON.stringify(map||{}));
        }catch(_e){}

        // Also keep any purely-local entries that are not in cloud (edge cases)
        var cloudIds = {};
        merged.forEach(function(c){ cloudIds[String(c.id)] = 1; });
        (communitiesLocal||[]).forEach(function(c){
          if(!cloudIds[String(c.id)]){
            merged.push(c);
          }
        });

        if(myToken !== window.__ccLoadToken) return;
        try{
          var selNow = $("cc_companySelect");
          if(selNow && selNow.value && String(selNow.value) !== String(company)) return;
        }catch(_e){}
        saveCommunities(company, merged);
        window.__ccCommSync[syncKey] = Date.now();
      }catch(e){
        console.warn("CompanyCommunities sync failed:", e);
      }
      window.__ccCommFetchInFlight = false;
      try{ render(); }catch(_e){}
    })();
  }
}

  // Keep local/in-memory employee caches in sync when a profile is disabled/enabled
  // so assignment dropdowns immediately reflect changes.
  function __ccUpdateEmployeeDisabledCaches(profileId, disabledFlag){
    try{
      var company = (window.__zummeeCompany || (localStorage.getItem('zummee_company')||'')).trim();
      var cid = (window.__zummeeCompanyId || (localStorage.getItem('zummee_company_id')||'')).trim();

      function patchArr(arr){
        if(!Array.isArray(arr)) return arr;
        for(var i=0;i<arr.length;i++){
          var e = arr[i];
          if(e && (e.id === profileId || e.user_id === profileId)){
            e.disabled = disabledFlag;
          }
        }
        return arr;
      }

      // in-memory caches
      try{
        if(window.__approvedEmployeesByCompanyName && company){
          window.__approvedEmployeesByCompanyName[company] = patchArr(window.__approvedEmployeesByCompanyName[company] || []);
        }
      }catch(_e){}
      try{
        if(window.__approvedProfilesByCompanyId && cid){
          window.__approvedProfilesByCompanyId[cid] = patchArr(window.__approvedProfilesByCompanyId[cid] || []);
        }
      }catch(_e){}

      // localStorage fallback cache
      try{
        if(company){
          var k = empKey(company);
          var raw = localStorage.getItem(k);
          if(raw){
            var arr = JSON.parse(raw);
            patchArr(arr);
            localStorage.setItem(k, JSON.stringify(arr));
          }
        }
      }catch(_e){}

      // Cache bust for dropdown sources
      // Some parts of the UI load employees from cached storage on first render.
      // After disabling a user, we force a fresh pull next render so disabled users
      // never show in assignment dropdowns.
      try{
        if(company){
          if(window.__approvedEmployeesByCompanyName && window.__approvedEmployeesByCompanyName[company]){
            delete window.__approvedEmployeesByCompanyName[company];
          }
          try{ localStorage.removeItem(empKey(company)); }catch(_e2){}
        }
        if(cid && window.__approvedProfilesByCompanyId && window.__approvedProfilesByCompanyId[cid]){
          delete window.__approvedProfilesByCompanyId[cid];
        }
      }catch(_e){}

      // Rerender Company Communities card immediately (assignment dropdowns)
      try{
        if(typeof window.sup_renderCompanyCommunities === 'function' && company){
          setTimeout(function(){ window.sup_renderCompanyCommunities(company); }, 0);
        }
      }catch(_e){}

      // Proactively rerender relevant UI
      try{ if(typeof render === 'function') setTimeout(render, 0); }catch(_e){}
    }catch(e){}
  }

    // Alphabetize A-Z
    communities.sort(function(a,b){
      return a.name.localeCompare(b.name, undefined, {numeric:true, sensitivity:"base"});
    });


    // v747: Preserve last non-empty community list per company to prevent late empty renders wiping UI.
    window.__ccLastCommunitiesByCompany = window.__ccLastCommunitiesByCompany || {};
    var __baseCommunities = (communities||[]).slice();
    if(__baseCommunities.length){ window.__ccLastCommunitiesByCompany[company] = __baseCommunities; }

    // Client-side filter (search box)
    var qtxt = "";
    try{
      var inline = $("sup_companyInline");
      qtxt = inline ? safeTrim(inline.value).toLowerCase() : "";
    }catch(_e){ qtxt = ""; }
    if(qtxt){
      communities = communities.filter(function(c){
        return String(c.name||"").toLowerCase().indexOf(qtxt) !== -1;
      });
    }



    // v747: Do NOT persist filtered/empty lists during render; this can wipe storage and cause "flash then disappear".
    // Only persist when no search filter is active and we have a non-empty unfiltered base list.
    try{ if(!qtxt && __baseCommunities && __baseCommunities.length){ saveCommunities(company, __baseCommunities); } }catch(_e){}

    // v747: If a late render hits with an empty list (common during async switching), fall back to last known list.
    if(!communities.length && !qtxt){
      try{
        var __cached = window.__ccLastCommunitiesByCompany ? window.__ccLastCommunitiesByCompany[company] : null;
        if(Array.isArray(__cached) && __cached.length){ communities = __cached.slice(); }
      }catch(_e){}
    }


    if(!communities.length){
      listEl.innerHTML = '<div class="muted tiny">No company communities yet.</div>';
      return;
    }

    // Build the employee list for the Assign-to dropdown.
    // Source of truth: approved employee profiles for the scoped company.
    // If the in-memory cache isn't ready yet, we lazily fetch and then re-render.
    var cid = "";
    try{
      // Supervisors use their own company_id
      // Prefer the mirrored window value, but fall back to local var if needed.
      if(window.__supCompanyId) cid = String(window.__supCompanyId||"").trim();
      if(!cid && typeof __supCompanyId !== 'undefined' && __supCompanyId) cid = String(__supCompanyId||"").trim();

      // Fallback: if the approvals panel already cached approved employees by company_id,
      // but we don't yet have a company_id in this module, infer it.
      if(!cid && window.__approvedProfilesByCompanyId){
        try{
          var ks = Object.keys(window.__approvedProfilesByCompanyId || {}).filter(function(k){ return !!String(k||"").trim(); });
          if(ks.length === 1) cid = String(ks[0]||"").trim();
        }catch(_e){}
      }

      // Another fallback: use the loaded profile scope if present.
      if(!cid && window.__zummeeProfile && window.__zummeeProfile.company_id){
        cid = String(window.__zummeeProfile.company_id||"").trim();
      }

      // Extra fallbacks: the approvals panel reliably resolves scope.company_id and
      // caches approved profiles by company_id. If this module runs before the
      // supervisor bootstrap sets __supCompanyId, we can still infer the company_id
      // from that cache.
      if(!cid && window.__approvedProfilesByCompanyId){
        try{
          var keys = Object.keys(window.__approvedProfilesByCompanyId||{}).filter(function(k){ return String(k||"").trim(); });
          if(keys.length === 1) cid = String(keys[0]||"").trim();
        }catch(_e){}
      }

      // Admins: respect the admin company picker when present
      var picker = document.getElementById("sup_adminCompanyPicker");
      if(picker && picker.value){
        var pv = String(picker.value||"").trim();
        // Only treat picker value as company_id if it looks like a UUID.
        if(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pv)){
          cid = pv;
        }
      }

      // IMPORTANT: For CompanyAdmin/Admin, the company picker is a company *name* (not a UUID).
      // Using the current user's company_id (often Sixes) would incorrectly scope employee queries.
      // If the picker value isn't a UUID, clear cid so we fall back to filtering by company name.
      try{
        var roleNow = String((window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role) || window.__zummeeUserRole || window.__supRole || "").trim().toLowerCase();
        if(roleNow && roleNow.indexOf("admin") !== -1){
          var pick2 = document.getElementById("sup_ccCompanyPicker") || document.getElementById("sup_adminCompanyPicker");
          var pv2 = pick2 ? String(pick2.value||"").trim() : "";
          if(pv2 && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pv2)){
            cid = "";
          }
        }
      }catch(_e){}
    }catch(e){}

    if(!window.__ccEmpFetchInFlight) window.__ccEmpFetchInFlight = {};

    // Helper to compute a stable display label for sorting
    function empLabel(e){
      if(!e) return "";
      if(typeof e === "string") return safeTrim(e);
      var name = safeTrim(e.name || e.fullName || e.full_name || e.displayName || e.display_name);
      var first = safeTrim(e.first_name || e.firstName || e.FirstName);
      var last  = safeTrim(e.last_name  || e.lastName  || e.LastName);
      var fl = safeTrim((first + " " + last).trim());
      var email = safeTrim(e.email || e.Email || e.user_email || e.userEmail);
      return name || fl || email || safeTrim(e.id);
    }

    var employees = [];
    // Pull the approved employee list from the in-memory cache.
    // IMPORTANT: In Admin mode, the company picker holds a *name* (not a UUID),
    // and earlier logic may intentionally clear `cid`. In that case, fall back
    // to the selected company id we already track globally.
    try{
      var __empKey = cid || window.__supCompanyId || "";
      if(__empKey && window.__approvedProfilesByCompanyId && Array.isArray(window.__approvedProfilesByCompanyId[__empKey])){
        employees = window.__approvedProfilesByCompanyId[__empKey].slice();
      } else {
        employees = [];
      }
    }catch(e){ employees = []; }

    // If we have no employees yet but we do know the company_id and have Supabase,
    // fetch approved employees once and then rerender.
    try{
      if((!employees || !employees.length) && (cid || company) && window.sb && !window.__ccEmpFetchInFlight[cid || ("name:"+company)]){
        var __ccKey = cid || ("name:"+company);
        window.__ccEmpFetchInFlight[__ccKey] = true;
        (async function(){
          try{
            // Pull minimal fields used by the UI.
            // Prefer an RPC (security definer) to avoid RLS edge-cases across companies.
            var q = null;
            try{
              if(company && window.sb && window.sb.rpc){
q = await window.sb.rpc("list_approved_employees", { p_company: company });
              }
            }catch(__rpcErr){
              q = null;
            }

            // Fallback to direct select if RPC is unavailable
            if(!q || (!q.data && !q.error)){
              var qb = window.sb
                .from("userdirectory")
                .select(`id,auth_user_id,company_id,role,approved,created_at,profiles:auth_user_id ( name, email, phone )`)
                .eq("approved", true);
              if(company){
                qb = qb.eq("company", company);
              } else if(cid){
                qb = qb.eq("company_id", cid);
              }
q = await qb;
            }

            if(q && q.data && Array.isArray(q.data)){
              if(!window.__approvedProfilesByCompanyId) window.__approvedProfilesByCompanyId = {};
              if(!window.__approvedProfilesByCompanyId) window.__approvedProfilesByCompanyId = {};
              if(cid) window.__approvedProfilesByCompanyId[cid] = q.data.slice();
}
          }catch(_e){
            // ignore
          } finally {
            try{ delete window.__ccEmpFetchInFlight[__ccKey]; }catch(__e){ window.__ccEmpFetchInFlight[__ccKey]=false; }
            // Re-render so dropdowns populate (but do not interrupt an in-progress user interaction).
            try{
              var ae = document.activeElement;
              var interacting = ae && ae.matches && ae.matches("select.assignSelect, select.assignSelectt");
              if(!interacting){
                var anySel = document.querySelector("#sup_perCommunityAssign select.assignSelect, #sup_perCommunityAssign select.assignSelectt");
                var alreadyPopulated = anySel && anySel.options && anySel.options.length > 1;
                if(!alreadyPopulated){ setTimeout(render, 0); }
              }
            }catch(__e){ try{ setTimeout(render,0); }catch(_e){} }
          }
        })();
      }
    }catch(e){}

    // Only show *active, approved* employees for assignment.
    // IMPORTANT: require explicit flags so legacy cached objects/strings never sneak in.
    const seenEmp = new Set();
    // NOTE: The approved employee list is already scoped to the selected company.
    // Some legacy profile rows have missing/mismatched company_id values; do NOT
    // exclude them here or the assignment dropdown will collapse to only "Unassigned".
    employees = (employees||[]).filter(function(e){
      if(!e || typeof e !== 'object') return false;
      // Legacy rows frequently store NULL for flags; treat only explicit truthy values as "on".
      // This avoids excluding valid employees when deleted/disabled is NULL.
      if(truthyFlag(e.deleted)) return false;
// Some legacy/derived employee objects may omit the approved flag
// (they are already in the approved list). Treat only explicit false as unapproved.
if(e.approved === false) return false;
      if(truthyFlag(e.disabled)) return false;
      // Don't hard-filter by company_id here (can be NULL/incorrect in legacy rows)
      // if(cid && e.company_id && String(e.company_id) !== String(cid)) return false;
      var r = String(e.role||"").trim().toLowerCase();
      if(r === "admin") return false;
      var em = String(e.email||"").trim().toLowerCase();
      if(em === "companyadmin@zummee.local") return false;
      var k = (String(e.id||"")) + "|" + em;
      if(seenEmp.has(k)) return false;
      seenEmp.add(k);
      return true;
    });

    // Sort employees alphabetically by display label.
    employees.sort(function(a,b){
      return empLabel(a).localeCompare(empLabel(b), undefined, {numeric:true, sensitivity:"base"});
    });
    var empOpts = employeesToOptions(employees);

    var html = communities.map(function(c){
      var disabled = c.locked ? "disabled" : "";
      var underCls = c.underReview ? " is-under-review" : "";
      var lockLabel = c.locked ? "Unlock" : "Lock";
      var reviewLabel = c.underReview ? "Clear Review" : "Under Review";

      var opts = empOpts.map(function(o){
        var sel = (o.value && o.value === c.assignedTo) ? " selected" : "";
        return '<option value="'+esc(o.value)+'"'+sel+'>'+esc(o.label)+'</option>';
      }).join("");

      return (
        '<div class="cc-item'+underCls+'" data-cc-id="'+esc(c.id)+'">' +
          '<div class="cc-top">' +
            '<div class="cc-name">'+esc((c.name||c.company_name||c.company||c.title||c.id||''))+'</div>' +
            '<select class="assignSelect" data-cc-field="assignedTo" '+disabled+'>'+opts+'</select>' +
            '<div class="cc-actions">' +
              '<button class="btn btn--ghost" data-cc-action="review" type="button" '+(c.locked?'disabled':'')+'>'+reviewLabel+'</button>' +
              '<button class="btn btn--ghost" data-cc-action="lock" type="button">'+lockLabel+'</button>' +
              '<button class="btn btn--icon zummee-danger-icon" data-cc-action="delete" type="button" title="Delete" aria-label="Delete" '+(c.locked?'disabled':'')+'>🗑</button>' +
            '</div>' +
          '</div>' +
          '<textarea class="cc-note" data-cc-field="note" placeholder="Notes…" '+disabled+'>'+esc(c.note)+'</textarea>' +
        '</div>'
      );
    }).join("");

    listEl.innerHTML = html;
  }

  function esc(s){
    return String(s||"")
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#039;");
  }

  function addCommunity(){
    var company = getCompany();
    if(!company){
      var c = prompt("Enter management company name");
      company = safeTrim(c);
      if(!company){ setStatus("Company required."); return; }
      var inline = $("sup_companyInline");
      if(inline) inline.value = company;
      persistCompany(company);
    }

    var nameEl = $("sup_newCommunityName") || $("sup_addCommunityModalName");
    var name = nameEl ? safeTrim(nameEl.value) : "";
    if(!name){
      setStatus("Enter a community name.");
      return;
    }

    var communities = loadCommunities(company).map(normalizeCommunity);

    // Prevent duplicates by name (case-insensitive)
    var exists = communities.some(function(c){ return safeTrim(c.name).toLowerCase() === name.toLowerCase(); });
    if(exists){
      setStatus("Community already exists.");
      if(nameEl) nameEl.value = "";
      render();
      return;
    }

    communities.push(normalizeCommunity({name:name}));
    saveCommunities(company, communities);
    if(nameEl) nameEl.value = "";
    setStatus("Community added.");
    render();
  }

  function updateCommunity(company, id, updater){
    var arr = loadCommunities(company).map(normalizeCommunity);
    var changed = false;
    arr = arr.map(function(c){
      if(c.id !== id) return c;
      changed = true;
      var next = updater(Object.assign({}, c)) || c;
      return normalizeCommunity(next);
    });
    if(changed) saveCommunities(company, arr);
    return changed;
  }

  async function onListClick(e){
    var btn = e.target.closest("[data-cc-action]");
    if(!btn) return;
    var item = e.target.closest(".cc-item");
    if(!item) return;
    var id = item.getAttribute("data-cc-id");
    var company = getCompany();
    if(!company || !id) return;

    var action = btn.getAttribute("data-cc-action");
    if(action === "lock"){
      updateCommunity(company, id, function(c){ c.locked = !c.locked; return c; });
      render();
      return;
    }
    if(action === "review"){
      updateCommunity(company, id, function(c){ c.underReview = !c.underReview; return c; });
      render();
      return;
    }
    if(action === "delete"){
      if(!confirm("Delete this community?")) return;
      // Optimistic local removal first (keeps UI snappy)
      var arr = loadCommunities(company).map(normalizeCommunity).filter(function(c){ return c.id !== id; });
      saveCommunities(company, arr);
      setStatus("Deleting...");
      render();

      // Then delete from Supabase so it doesn't repopulate on the next sync.
      try{
        var passedCompanyId = null;
        try{
          if(typeof window.getCompanyRow === 'function'){
            var crow = await window.getCompanyRow(company);
            passedCompanyId = crow && crow.id ? crow.id : null;
          }
        }catch(_e){}

        if(typeof window.deleteCommunityFromCloud === 'function'){
          await window.deleteCommunityFromCloud(id, passedCompanyId || null, true);
          setStatus("Community deleted.");
        }else{
          setStatus("Deleted locally (cloud delete unavailable).");
        }
      }catch(err){
        console.warn('Cloud delete failed', err);
        setStatus("Delete failed (cloud). Refreshing...");
        try{ if(typeof window.refreshCompanyCommunitiesNow === 'function') await window.refreshCompanyCommunitiesNow(); }catch(_e){}
      }
      return;
    }
  }

  async function onListChange(e){
    var fieldEl = e.target.closest("[data-cc-field]");
    if(!fieldEl) return;
    var item = e.target.closest(".cc-item");
    if(!item) return;
    var id = item.getAttribute("data-cc-id");
    var company = getCompany();
    if(!company || !id) return;

    var field = fieldEl.getAttribute("data-cc-field");
    var val = safeTrim(fieldEl.value);

    updateCommunity(company, id, function(c){
      c[field] = val;
      return c;
    });

    // Persist assignment changes to CommunityAssignments immediately
    if(field === "assignedTo"){
      try{
await setAssignmentInCloud(company, id, val || null);
        setStatus("Assignment saved.");
      }catch(err){
        console.warn("Assignment save failed", err);
        setStatus("Assignment save failed.");
      }
    }
    // Don't re-render on every keystroke for textarea; only on blur.
  }

  function onListBlur(e){
    var fieldEl = e.target.closest("[data-cc-field]");
    if(!fieldEl) return;
    if(fieldEl.tagName !== "TEXTAREA") return;
    render();
    setStatus("Saved.");
  }

  function bind(){
    // Remove old listeners by cloning buttons
    ["sup_editCommunityBtn"].forEach(function(id){
      var el = $(id);
      if(!el) return;
      var clone = el.cloneNode(true);
      el.parentNode.replaceChild(clone, el);
    });

    var addBtn = $("sup_addCommunityBtn");
    if(addBtn) addBtn.addEventListener("click", function(ev){
      try{ if(window.openAddCommunityModal){ ev.preventDefault(); ev.stopPropagation(); window.openAddCommunityModal(); return false; } }catch(e){}
      return addCommunity(ev);
    });

    var companyInline = $("sup_companyInline");
    if(companyInline){
      companyInline.addEventListener("input", function(){
        // This field is just a client-side search filter (not the company scope)
        render();
      });
    }

    var listEl = $("sup_companyCommunityList");
    if(listEl){
      listEl.addEventListener("click", onListClick);
      listEl.addEventListener("change", onListChange);
      listEl.addEventListener("input", function(e){
        // Save note on input but don't re-render (keeps typing smooth)
        var fieldEl = e.target.closest("[data-cc-field]");
        if(!fieldEl) return;
        if(fieldEl.tagName === "TEXTAREA") onListChange(e);
      });
      listEl.addEventListener("blur", onListBlur, true);
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    try{ bind(); }catch(e){}
    try{ initCompanyPicker(); }catch(e){}
    try{ render(); }catch(e){}
  });

  // Expose renderer for debugging
  window.sup_renderCompanyCommunities = render;
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  function $(id){ return document.getElementById(id); }

  async function getUser(){
    // Prefer session user (more reliable than auth.getUser in some browser states)
      // Session helper lives in the main bundle; on some builds this script block
      // can execute without that helper in scope. Use the global safe helper when
      // available, otherwise fall back to the raw Supabase call.
var sess = await (
        (window.ZUMMEE_AUTH && typeof window.ZUMMEE_AUTH.getSessionResultSafe === 'function')
          ? window.ZUMMEE_AUTH.getSessionResultSafe(3500)
          : (window.sb && window.sb.auth ? window.sb.auth.getSession() : Promise.resolve({ data: { session: null }, error: null }))
      );
    if(sess && sess.user) return sess.user;
    // As a last resort, try getUser (may hang in some cases; bound by getSessionSafe timeout above)
    try{
      if(!window.sb) return null;
var r = await (window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.getUserResultSafe ? window.ZUMMEE_AUTH.getUserResultSafe(5000) : window.sb.auth.getUser());
      return (r && r.data && r.data.user) ? r.data.user : null;
    }catch(_e){
      return null;
    }
  }

  function isCompanyAdminEmail(user){
    var em = String((user && user.email) ? user.email : "").toLowerCase();
    return em === "companyadmin@zummee.local";
  }

  // Never allow supervisors to disable (or enable) the admin account.
  // Treat profiles with role === 'admin' or the reserved admin email as protected.
  function isProtectedAccount(p){
    try{
      var email = String((p && p.email) ? p.email : "").toLowerCase().trim();
      if(email === "companyadmin@zummee.local") return true;
      var role = String((p && p.role) ? p.role : "").toLowerCase().trim();
      if(role === "admin") return true;
    }catch(_e){}
    return false;
  }

  async function getMyProfile(){
var user = await getUser();
    if(!user || !user.id || !window.sb) return null;
var q = await window.sb
      .from("userdirectory")
      .select(`id,auth_user_id,company_id,role,approved,created_at,profiles:auth_user_id ( name, email, phone )`)
      .or("auth_user_id.eq."+user.id+",id.eq."+user.id)
      .maybeSingle();
    // fallback casing
    if(q && q.error && String(q.error.message||"").toLowerCase().indexOf("relation") !== -1){
q = await window.sb
        .from("UserDirectory")
        .select(`id,auth_user_id,company_id,role,approved,created_at,profiles:auth_user_id ( name, email, phone )`)
        .or("auth_user_id.eq."+user.id+",id.eq."+user.id)
        .maybeSingle();
    }
    return q ? q.data : null;
  }

  async function loadCompanies(){
  const sb = getSupabaseClientSafe();
  if(!sb) return [];

  // Professional rule: never probe for non-existent columns (it spams 400s).
  // Keep the Companies payload minimal + stable.
const { data, error } = await sb
    .from("Companies")
    // Companies table in this project does NOT have `code`.
    // Selecting it triggers 400 errors which cascade into broken UI.
    .select("id,name,active")
    .order("name", { ascending: true });

  if(error){
    console.warn("[COMPANIES] loadCompanies error", error);
    return [];
  }

  const rows = Array.isArray(data) ? data : [];
  // Build lookups so other parts of the page can reliably map name <-> id.
  window.__companiesByName = {};
  window.__companiesById = {};
  rows.forEach(r => {
    if(r && r.name) window.__companiesByName[r.name] = r.id;
    if(r && r.id) window.__companiesById[r.id] = r;
  });

  return rows;
}

  function renderEmployeeRow(p, mode){
    // NOTE: userdirectory schema is minimal: id, auth_user_id, company_id, role, approved, created_at
    var pid = p ? (p.id || null) : null; // use row id for actions
    var authUid = String((p && (p.auth_user_id || p.user_id)) || "").trim();

    // Best-effort display label
    var label = "";
    if(p && p.email) label = String(p.email).trim();
    if(!label && p && p.name) label = String(p.name).trim();
    if(!label && authUid) label = authUid.slice(0, 8) + "…" + authUid.slice(-4);
    if(!label) label = "User";

    // Company name from lookup table
    var company = "";
    if(p && p.company_id && window.__companiesById && window.__companiesById[String(p.company_id)]){
      try{ company = String(window.__companiesById[String(p.company_id)].name || "").trim() || ""; }catch(e){}
    }

    var disabled = (p && (p.disabled === true || p.disabled === 1));

    var pill = "";
    if(mode === "pending"){
      pill = '<span class="pill pill--pending">Pending</span>';
    }else{
      pill = disabled
        ? '<span class="pill pill--disabled">Disabled</span>'
        : '<span class="pill pill--approved">Approved</span>';
    }

    var right = "";
    if(mode==="pending"){
      right = pid ? '<button class="btn small" type="button" data-approve-id="'+pid+'">Approve</button>' : "";
    }else{
      if(isProtectedAccount(p)){
        right = '';
      } else {
        if(window.__disabledSupported === false){
          right = '';
        }else{
          right = disabled
            ? '<button class="btn small" type="button" data-enable-id="'+pid+'">Enable</button>'
            : '<button class="btn small" type="button" data-disable-id="'+pid+'">Disable</button>';
        }
      }
    }

    return (
      '<div class="item" style="display:flex; justify-content:space-between; gap:14px; align-items:flex-start;">'
        + '<div style="min-width:0">'
          + '<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">'
            + '<div style="font-weight:800; color:#0f2f4a; font-size:18px; line-height:1.1;">'+esc(label)+'</div>'
            + pill
          + '</div>'
          + (company ? '<div class="muted" style="margin-top:3px">'+esc(company)+'</div>' : '')
          + (authUid ? '<div class="muted tiny" style="margin-top:2px">UID: '+esc(authUid)+'</div>' : '')
        + '</div>'
        + (right ? '<div style="flex:0 0 auto;">'+right+'</div>' : '')
      + '</div>'
    );
  }
  function esc(s){
      return String(s||"")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;");
    }

    async function queryProfilesForApprovals(scope){
    const sb = window.sb;
    if(!sb) return { pending: [], approved: [], approvedProfilesByCompanyId: {} };

    // schema: id, auth_user_id, company_id, role, approved, created_at
    let q = sb
      .from("userdirectory")
      .select(`id,auth_user_id,company_id,role,approved,created_at,profiles:auth_user_id ( name, email, phone )`)
      .order("created_at", { ascending: false })
      .limit(1000);

    if(scope && scope.companyId){
      q = q.eq("company_id", scope.companyId);
    }

    // exclude current user
    try{
const u = await sb.auth.getUser();
      const me = u && u.data && u.data.user ? u.data.user : null;
      if(me && me.id) q = q.neq("auth_user_id", me.id);
    }catch(e){}

let r = await q;
    if(r && r.error){
      // fallback casing
      let q2 = sb
        .from("UserDirectory")
        .select(`id,auth_user_id,company_id,role,approved,created_at,profiles:auth_user_id ( name, email, phone )`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if(scope && scope.companyId) q2 = q2.eq("company_id", scope.companyId);
      try{
const u2 = await sb.auth.getUser();
        const me2 = u2 && u2.data && u2.data.user ? u2.data.user : null;
        if(me2 && me2.id) q2 = q2.neq("auth_user_id", me2.id);
      }catch(e){}
r = await q2;
    }

    if(r && r.error) throw r.error;

    const rows = (r && r.data) ? r.data : [];
    const pending = rows.filter(x => x && x.approved === false);
    const approved = rows.filter(x => x && x.approved === true);

    // Build lookup by company for other UI sections
    const approvedProfilesByCompanyId = {};
    approved.forEach(p => {
      const cid = p.company_id || "";
      if(!cid) return;
      (approvedProfilesByCompanyId[cid] = approvedProfilesByCompanyId[cid] || []).push(p);
    });

    return { pending, approved, approvedProfilesByCompanyId };
  }

  async function getScope(){
var user = await getUser();
var prof = await getMyProfile();
    var isAdmin = isCompanyAdminEmail(user);
    var pickerWrap = $("sup_adminCompanyPickerWrap");
    var picker = $("sup_adminCompanyPicker");

    if(isAdmin){
      // Global by default; if a company is selected, scope to that company for convenience
      if(pickerWrap) pickerWrap.style.display = "inline-flex";
      var sel = picker ? picker.value : "";
      if(sel){
        return { global:false, company_id: sel };
      }
      return { global:true, company_id:null };
    }

    // Supervisor must be scoped to their company_id
    var cid = prof ? String(prof.company_id||"").trim() : "";
    return { global:false, company_id: cid || null };
  }


// v728: role+company scope resolver (metadata + userdirectory fallback)
function _zLower(x){ return (x==null?"":String(x)).toLowerCase().trim(); }
async function resolveRoleCompany(sb){
  try{
    if(!sb) return null;
const sess = await getSessionSafe();
    const meta = (sess && sess.user && sess.user.user_metadata) ? sess.user.user_metadata : {};
    const roleMeta = _zLower(meta.role || meta.user_role || meta.app_role);
    const companyIdMeta = String(meta.company_id || meta.companyId || "").trim();
    const companyNameMeta = String(meta.company || meta.company_name || meta.companyName || "").trim();
    if(roleMeta && companyIdMeta){
      return { role: roleMeta, companyId: effectiveCompanyIdMeta, companyName: companyNameMeta };
    }

    const uid = sess && sess.user && sess.user.id ? sess.user.id : null;
    if(!uid){
      return { role: roleMeta || "unknown", companyId: effectiveCompanyIdMeta || null, companyName: companyNameMeta };
    }

const r = await sb
      .from("userdirectory")
      .select("auth_company_id,role,approved")
      .eq("auth_user_id", uid)
      .maybeSingle();

    if(r && r.error){
      // If RLS blocks or the table is missing, fall back to metadata-only.
      return { role: roleMeta || "unknown", companyId: effectiveCompanyIdMeta || null, companyName: companyNameMeta };
    }
    const row = r && r.data ? r.data : null;
    return {
      role: _zLower((row && row.role) || roleMeta || "unknown"),
      companyId: (row && row.company_id) ? String(row.company_id) : (companyIdMeta || null),
      companyName: companyNameMeta
    };
  }catch(e){
    return null;
  }
}

// Collapsible section toggles (Tap to collapse/expand)
(function bindSupCollapsibles(){
  function isInteractive(target){
    return !!(target && target.closest && target.closest('button, a, input, select, textarea, label'));
  }
  function bindOne(sec){
    if(!sec || sec.__supCollapseBound) return;
    sec.__supCollapseBound = true;
    // Some sections have both a title (h2/h3) AND a "Tap to collapse" subhead.
    // Bind to all available header elements so clicking either will toggle.
    const heads = [
      sec.querySelector('.sup-subhead'),
      sec.querySelector('h3'),
      sec.querySelector('h2')
    ].filter(Boolean);
    if(!heads.length) return;
    const toggle = (e) => {
      if(isInteractive(e.target)) return;
      sec.classList.toggle('is-collapsed');
    };
    Array.from(new Set(heads)).forEach(h => {
      h.style.cursor = h.style.cursor || 'pointer';
      h.addEventListener('click', toggle);
    });
  }
  function bindAll(){ document.querySelectorAll('.sup-collapsible').forEach(bindOne); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindAll);
  else bindAll();
})();

  // ---- Public exports (for debugging + UI refresh buttons) ----
  // This page runs inside a bootstrap IIFE to avoid leaking globals.
  // We intentionally export a small, safe surface area to `window`
  // so the UI and console-based tests can invoke the refresh/render
  // paths deterministically.
  try { window.renderEmployeeManagement = renderEmployeeManagement; } catch(e) {}
  try { window.loadEmployeesForSupervisor = loadEmployeesForSupervisor; } catch(e) {}
  try { window.loadCompanyCommunities = loadCompanyCommunities; } catch(e) {}
  try { window.renderCompanyCommunities = renderCompanyCommunities; } catch(e) {}
  try { window.refreshAll = refreshAll; } catch(e) {}

  // Convenience wrappers (non-breaking if underlying funcs change)
  window.refreshEmployees = async function(){
    try {
const out = await (window.loadEmployeesForSupervisor ? window.loadEmployeesForSupervisor() : null);
      if(out && window.renderEmployeeManagement) window.renderEmployeeManagement(out);
      return out;
    } catch (e) {
      console.warn('[EmployeeMgmt] refreshEmployees failed', e);
      return null;
    }
  };
  window.refreshCompanyCommunities = async function(){
    try {
const out = await (window.loadCompanyCommunities ? window.loadCompanyCommunities() : null);
      if(out && window.renderCompanyCommunities) window.renderCompanyCommunities(out);
      return out;
    } catch (e) {
      console.warn('[CompanyCommunities] refreshCompanyCommunities failed', e);
      return null;
    }
  };

  // Wire the Employee Management refresh button (if present)
  (function bindEmployeeRefreshBtn(){
    const btn = document.getElementById('sup_refreshEmployeesBtn');
    if(!btn) return;
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
if(window.refreshEmployees) await window.refreshEmployees();
    });
  })();

  // Wire "Create Company" button (Company Communities) -> opens modal
  (function bindCreateCompanyBtn(){
    const btn = document.getElementById("cm_createSwitchBtn");
    if(!btn) return;
    if(btn.__boundCreateCompany) return;
    btn.__boundCreateCompany = true;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      try {
        if(typeof openCreateCompanyModal === "function") openCreateCompanyModal();
      } catch (err) {
        console.warn("[Company] create company click failed", err);
      }
    });
  })();

  // Initial paint
  (function initialSupervisorRefresh(){
    if(document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { try { window.refreshAll && window.refreshAll(); } catch(e){} });
    } else {
      try { window.refreshAll && window.refreshAll(); } catch(e){}
    }
  })();

	// Close supervisor bootstrap IIFE
	})();


function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  function isAdmin(){
    try{
      var r = String(window.currentUserRole || localStorage.getItem("userRole") || localStorage.getItem("role") || localStorage.getItem("user_role") || '').toLowerCase().trim();
      return (r === 'admin') || (r.includes('admin') && !r.includes('supervisor'));
    }catch(e){ return false; }
  }

  function byId(id){ return document.getElementById(id); }

  var state = { uid:null };

  window.openEditNameModal = function(uid, preset){
    if(!isAdmin()) return;
    state.uid = uid;
    var modal = byId('sup_editNameModal');
    if(!modal) return;

    byId('sup_editUidLabel').textContent = uid || '';
    byId('sup_editFirstName').value = (preset && preset.first_name) ? preset.first_name : '';
    byId('sup_editLastName').value  = (preset && preset.last_name) ? preset.last_name : '';
    byId('sup_editFullName').value  = (preset && preset.full_name) ? preset.full_name : '';

    modal.style.display = 'block';
  };

  function closeModal(){
    var modal = byId('sup_editNameModal');
    if(modal) modal.style.display = 'none';
    state.uid = null;
  }

  function wireClose(){
    var c1 = byId('sup_editNameCloseBtn');
    var c2 = byId('sup_editNameCancelBtn');
    if(c1) c1.onclick = closeModal;
    if(c2) c2.onclick = closeModal;
    var modal = byId('sup_editNameModal');
    if(modal){
      modal.addEventListener('click', function(e){
        if(e.target === modal) closeModal();
      });
    }
  }

  async function save(){
    if(!state.uid) return;
    var sb = window.sb || window.supabaseClient || window.supabase;
    if(!sb){ alert('Supabase client not found.'); return; }

    var first = (byId('sup_editFirstName').value || '').trim();
    var last  = (byId('sup_editLastName').value || '').trim();
    var full  = (byId('sup_editFullName').value || '').trim();
    if(!full){
      full = [first,last].filter(Boolean).join(' ').trim();
    }


    var payload = { name: full || null };

    try{
      // Source of truth for management UI: userdirectory.profile_name
      var udRes = await sb.from('userdirectory')
        .update({ profile_name: full || null })
        .eq('auth_user_id', state.uid)
        .select('auth_user_id');

      if(udRes && udRes.error){
        console.warn('userdirectory name update error', udRes.error);
        alert('Could not save name: ' + (udRes.error.message || 'Unknown error'));
        return;
      }
      if(udRes && Array.isArray(udRes.data) && udRes.data.length === 0){
        alert('Could not save name (no rows updated). Check UPDATE policy on userdirectory.');
        return;
      }

      // Best-effort: also update profiles.name if your policies allow it (ignore failures)
      try{
        var pres = await sb.from('profiles').update(payload).eq('id', state.uid);
        if(pres && pres.error && String(pres.error.message||'').includes('public.Profiles')){
          pres = await sb.from('Profiles').update(payload).eq('id', state.uid);
        }
        if(pres && pres.error) console.warn('profiles name mirror skipped', pres.error);
      }catch(_e2){}

      closeModal();

      // Refresh employee lists (in-place render already uses userdirectory.profile_name)
      if(window.refreshEmployeesUI) window.refreshEmployeesUI();
      else if(window.refreshAll) window.refreshAll();
      else if(window.refreshEmployees) window.refreshEmployees();
      else if(window.refreshSupervisorEmployees) window.refreshSupervisorEmployees();
    }catch(e){
      console.warn('name update failed', e);
      alert('Could not save name.');
    }
  }

  function wireSave(){
    var s = byId('sup_editNameSaveBtn');
    if(s) s.onclick = save;
  }

  // Delegate clicks from employee cards (Approve/Reject/Edit Name)
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t) return;
    var action = t.getAttribute && t.getAttribute('data-action');
    if(action !== 'editname') return;
    if(!isAdmin()) return;

    var uid = t.getAttribute('data-uid');
    if(!uid) return;

    // Try to find the employee record in the last loaded data to prefill
    var preset = null;
    try{
      // Pending/approved lists are stored on window.__approvedProfilesByCompanyId in your code for approved;
      // We'll also check most recent load result cache if present.
      if(window.__lastEmployeeLoad && Array.isArray(window.__lastEmployeeLoad)){
        preset = window.__lastEmployeeLoad.find(function(x){ return String(x.auth_user_id||'') === String(uid); }) || null;
      }
    }catch(_e){}

    window.openEditNameModal(uid, preset);
  });

  // Wire on load
  wireClose();
  wireSave();
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  function byId(id){ return document.getElementById(id); }
  function isAdmin(){
    try{
      var r = String(window.__sc_role || window.currentUserRole || localStorage.getItem('userRole') || localStorage.getItem('role') || '').toLowerCase();
      return r === 'admin' || (r.includes('admin') && !r.includes('supervisor'));
    }catch(e){ return false; }
  }
  var state = { uid:null };

  function open(uid){
    if(!isAdmin()) return;
    state.uid = uid;
    byId('sup_editUidLabel_v2').textContent = uid || '';
    byId('sup_editFirstName_v2').value = '';
    byId('sup_editLastName_v2').value = '';
    byId('sup_editFullName_v2').value = '';
    byId('sup_editNameModal_v2').style.display = 'block';
  }
  function close(){
    var m = byId('sup_editNameModal_v2');
    if(m) m.style.display = 'none';
    state.uid = null;
  }
  async function save(){
    if(!state.uid) return;
    var sb = window.sb || window.supabaseClient || window.supabase;
    if(!sb){ alert('Supabase client not found.'); return; }

    var first = (byId('sup_editFirstName_v2').value || '').trim();
    var last  = (byId('sup_editLastName_v2').value || '').trim();
    var full  = (byId('sup_editFullName_v2').value || '').trim();
    if(!full) full = [first,last].filter(Boolean).join(' ').trim();

    var payload = { first_name: first || null, last_name: last || null, full_name: full || null };

var res = await sb.from('profiles').update(payload).eq('id', state.uid);
    if(res && res.error){
      console.warn('profiles update error', res.error);
      alert('Could not save name: ' + (res.error.message || 'Unknown error'));
      return;
    }
    close();
    if(window.refreshEmployees) window.refreshEmployees();
    else if(window.refreshSupervisorEmployees) window.refreshSupervisorEmployees();
  }

  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t || !t.getAttribute) return;
    var action = t.getAttribute('data-action');
    if(action === 'editname_v2'){
      var uid = t.getAttribute('data-uid');
      open(uid);
    }
  });

  // wire modal buttons
  document.addEventListener('click', function(e){
    var t = e.target;
    if(!t) return;
    if(t.id === 'sup_editNameCloseBtn_v2' || t.id === 'sup_editNameCancelBtn_v2') close();
    if(t.id === 'sup_editNameSaveBtn_v2') save();
    if(t.id === 'sup_editNameModal_v2') close();
  });

  window.__editNameV2 = { open: open, close: close, save: save };
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v845: collapse/expand for .sup-collapsible cards (tap header to collapse)
(function(){
  function isInteractive(el){
    return !!(el && (el.closest('button') || el.closest('select') || el.closest('input') || el.closest('a') || el.closest('textarea') || el.closest('label')));
  }
  function toggle(card){
    var body = card.querySelector('.sup-collapsible-body');
    if(!body) return;
    var isCollapsed = card.classList.contains('is-collapsed');

    // Ensure body is measurable
    body.style.display = 'block';

    if(!isCollapsed){
      // collapse with animation
      var h = body.scrollHeight;
      body.style.maxHeight = h + 'px';
      requestAnimationFrame(function(){
        card.classList.add('is-collapsed');
        body.style.maxHeight = '0px';
      });
    }else{
      // expand with animation
      card.classList.remove('is-collapsed');
      var h2 = body.scrollHeight;
      body.style.maxHeight = h2 + 'px';
      // after transition, let it grow naturally
      setTimeout(function(){
        try{ if(!card.classList.contains('is-collapsed')) body.style.maxHeight = '3000px'; }catch(_e){}
      }, 260);
    }
  }
  document.addEventListener('click', function(e){
    var head = e.target.closest('.sup-collapsible .sup-subhead');
    if(!head) return;
    if(isInteractive(e.target)) return;
    var card = head.closest('.sup-collapsible');
    if(!card) return;
    toggle(card);
  });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v856: Employee Management actions (approve/reject/edit)
(function(){
  function getSbSync(){
    return window.sb || window.supabaseClient || window.supabase || null;
  }
  function getSb(){
    // prefer ensureSupabase() if present (Promise)
    try{
      if(typeof ensureSupabase === 'function'){
        var r = ensureSupabase();
        if(r && typeof r.then === 'function') return r;
        // if shim returns sync, wrap
        return Promise.resolve(r);
      }
    }catch(e){}
    return Promise.resolve(getSbSync());
  }

  async function refreshEmployeesUI(){
    try{
      if(typeof loadEmployeesForSupervisor === 'function'){
        const empRes = await loadEmployeesForSupervisor();
        try{ window.__lastEmployeeLoad = (empRes?.approved||[]).concat(empRes?.pending||[]); }catch(_e){}
        if(typeof renderEmployeeManagement === 'function'){
          renderEmployeeManagement(empRes);
        }
      }
    }catch(e){
      console.warn('[v856] refreshEmployeesUI failed', e);
    }
  }

  // Expose for debugging / manual triggers
  window.refreshEmployees = refreshEmployeesUI;

  async function approveUid(sb, uid){
    const res = await sb.from('userdirectory').update({ approved: true }).eq('auth_user_id', uid);
    if(res.error) throw res.error;
  }

  async function rejectUid(sb, uid){
    const res = await sb.from('userdirectory').delete().eq('auth_user_id', uid);
    if(res.error) throw res.error;
  }

  document.addEventListener('click', async function(e){
    // Employee Management -> Approvals refresh
    const refreshBtn = e.target && e.target.closest ? e.target.closest('#sup_refreshApprovals') : null;
    if(refreshBtn){
      try{ refreshEmployeesUI(); }catch(err){ console.warn('[EmployeeMgmt] refresh click failed', err); }
      return;
    }

    // Approved Employees -> refresh
    const refreshApprovedBtn = e.target && e.target.closest ? e.target.closest('#sup_refreshApproved') : null;
    if(refreshApprovedBtn){
      try{ refreshEmployeesUI(); }catch(err){ console.warn('[ApprovedEmployees] refresh click failed', err); }
      return;
    }
    const btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if(!btn) return;
    const action = btn.getAttribute('data-action');
    if(!action) return;

    const uid = btn.getAttribute('data-uid');
    if((action === 'approve' || action === 'reject' || action === 'editname_v2') && !uid) return;

    if(action === 'editname_v2'){
      // Admin-only edit
      try{
        if(window.__editNameV2 && typeof window.__editNameV2.open === 'function'){
          // Try to prefill from last load cache
          let preset = null;
          try{
            if(window.__lastEmployeeLoad && Array.isArray(window.__lastEmployeeLoad)){
              preset = window.__lastEmployeeLoad.find(x => String(x.auth_user_id||'') === String(uid)) || null;
            }
          }catch(_e){}
          window.__editNameV2.open(uid, preset);
          return;
        }
        if(typeof window.openEditNameModal === 'function'){
          window.openEditNameModal(uid, null);
          return;
        }
      }catch(err){
        console.warn('[v856] editname_v2 failed', err);
      }
      return;
    }

    if(action === 'toggle_disabled'){
      e.preventDefault();
      e.stopPropagation();
      const nowDisabled = btn.getAttribute('data-disabled') === '1';
      const nextDisabled = !nowDisabled;

      // Prevent disabling other supervisors/admins
      let emp = null;
      try{
        if(window.__lastEmployeeLoad && Array.isArray(window.__lastEmployeeLoad)){
          emp = window.__lastEmployeeLoad.find(x => String(x.auth_user_id||x.id||'') === String(uid)) || null;
        }
      }catch(_e){}
      try{
        const r = String(emp && emp.role ? emp.role : '').toLowerCase();
        if(r.includes('supervisor') || r.includes('admin')){
          alert('You cannot disable a Supervisor/Admin account.');
          return false;
        }
      }catch(_e){}

      const msg = (nextDisabled?'Disable':'Enable') + ' this employee? ' + (nextDisabled?'They will not be able to log in.':'They will regain access.');
      const ok = await (window.zummeeConfirmDeleteCommunity
        ? window.zummeeConfirmDeleteCommunity(msg, { title: (nextDisabled?'Disable':'Enable') + ' Employee', confirmText: (nextDisabled?'Disable':'Enable'), danger: !!nextDisabled })
        : Promise.resolve(confirm(msg)));
      if(!ok) return false;
      btn.disabled = true;
      btn.style.opacity = '0.7';
      getSb().then(async function(sb){
        try{
          // Prefer RPC if present; fall back to direct profiles update
          let rpcRes = null;
          try{ rpcRes = await sb.rpc('set_employee_disabled', { p_auth_user_id: uid, p_disabled: nextDisabled }); }catch(_e){}
          if(rpcRes && rpcRes.error){
        const _m = String(rpcRes.error.message||'').toLowerCase();
        const _c = String(rpcRes.error.code||'').toLowerCase();
        const _missing = _m.includes('could not find the function') || _c==='pgrst202';
        if(_missing){
          rpcRes = null; // trigger fallback to direct update
        }else{
          throw rpcRes.error;
        }
      }
          if(!rpcRes){
            // direct update (requires RLS policy)
            let up = await sb.from('profiles').update({ disabled: nextDisabled }).eq('id', uid).select('id,disabled');
            if(up && up.error){
              // some envs might use capital Profiles
              up = await sb.from('Profiles').update({ disabled: nextDisabled }).eq('id', uid).select('id,disabled');
            }
            if(up && up.error) throw up.error;
            // If RLS blocks updates, PostgREST often returns 200 with empty data.
            if(!up || !Array.isArray(up.data) || up.data.length === 0){
              throw new Error('Update was not applied (likely blocked by RLS). Please install the set_employee_disabled() RPC or add an UPDATE policy for profiles.disabled.');
            }
          }
          // Flip the button immediately (even before a full refresh)
          try{
            btn.setAttribute('data-disabled', nextDisabled ? '1' : '0');
            btn.textContent = nextDisabled ? 'Enable' : 'Disable';
          }catch(_e){}

          // Clear dropdown caches
          try{ window.__approvedProfilesByCompanyId = {}; window.__approvedProfilesByCompanyId_ts = {}; }catch(_e){}
          await refreshEmployeesUI();

          // Refresh community assignment UI so employee dropdowns reflect enable/disable immediately
          try{
            if(typeof window.refreshCompanyCommunitiesNow==="function"){
              await window.refreshCompanyCommunitiesNow();
            }else if(typeof window.__refreshCompanyCommunitiesNow==="function"){
              await window.__refreshCompanyCommunitiesNow();
            }else if(typeof refreshCompanyCommunitiesNow==="function"){
              await refreshCompanyCommunitiesNow();
            }
          }catch(_e){}
        }catch(err){
          console.warn('[disable] failed', err);
          alert('Could not ' + (nextDisabled?'disable':'enable') + ' user: ' + (err && err.message ? err.message : err));
        }finally{
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      });
      return;
    }

    if(action === 'approve' || action === 'reject'){
      e.preventDefault();
      e.stopPropagation();

      if(action === 'reject'){
        const ok = confirm('Reject this user? This will remove them from pending approvals.');
        if(!ok) return false;
      }

      // disable button during operation
      btn.disabled = true;
      btn.style.opacity = '0.7';

      getSb().then(async function(sb){
        if(!sb){
          alert('Supabase client not ready. Please refresh and try again.');
          return;
        }
        try{
          if(action === 'approve'){
            await approveUid(sb, uid);
          }else{
            await rejectUid(sb, uid);
          }
          await refreshEmployeesUI();
        }catch(err){
          console.warn('[v856] action failed', err);
          alert('Action failed: ' + (err && err.message ? err.message : String(err)));
        }finally{
          btn.disabled = false;
          btn.style.opacity = '';
        }
      });
      return;
    }
  }, true);
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v861: Role Assignment (Employee / Supervisor / Admin) - robust injection
(function(){
  console.log('[v861] Role assignment script loaded');
  function getSb(){ return window.sb || window.supabaseClient || window.supabase || null; }
  function normRole(r){ return String(r||'').toLowerCase().replace(/\s+/g,''); }
  function isAdminLike(){
    const r = normRole(window.currentUserRole || window.userRole || localStorage.getItem('userRole') || '');
    return r.includes('admin');
  }
    
  function isSupervisorLike(){
    try{
      const r = String(getUserRoleSafe() || window.__supRole || localStorage.getItem('userRole') || localStorage.getItem('role') || '').toLowerCase();
      return r.includes('supervisor') || r.includes('admin');
    }catch(_e){ return false; }
  }

    async function updateRole(uid, newRole){
    const sb = getSb();
    if(!sb) throw new Error('Supabase not ready');

    // Prefer RPC if present (more secure under RLS)
    try{
      const rpcRes = await sb.rpc('set_employee_role', { p_auth_user_id: uid, p_role: newRole });
      if(rpcRes && rpcRes.error){
        const _m = String(rpcRes.error.message||'').toLowerCase();
        const _c = String(rpcRes.error.code||'').toLowerCase();
        const _missing = _m.includes('could not find the function') || _c === 'pgrst202' || _m.includes('not found');
        if(!_missing) throw rpcRes.error;
      }else{
        return true;
      }
    }catch(_e){
      // fall through to direct update
    }

    // Fallback: direct update (may be blocked by RLS)
    const res = await sb
      .from('userdirectory')
      .update({ role: newRole })
      .eq('auth_user_id', uid)
      .select('auth_user_id, role');

    if(res.error) throw res.error;

    if(!res.data || res.data.length === 0){
      throw new Error('Role update was not applied (likely blocked by RLS, or no matching userdirectory row).');
    }
    return true;
  }

  function guessRole(text){
    const t = String(text||'').toLowerCase();
    if(t.includes('supervisor')) return 'Supervisor';
    if(t.includes('admin')) return 'Admin';
    return 'Employee';
  }

  function injectRoleEditors(){
    const canAdmin = isAdminLike();
    const canSup = isSupervisorLike();
    if(!(canAdmin || canSup)) return;
    // employee cards have data-uid on buttons; use those
    const uids = new Set();
    document.querySelectorAll('[data-uid]').forEach(el => {
      const uid = el.getAttribute('data-uid');
      if(uid) uids.add(uid);
    });
    uids.forEach(uid => {
      // find a nearby card container that includes this uid button
      const btn = document.querySelector('[data-uid="'+uid+'"]');
      if(!btn) return;
      const card = btn.closest('.cardRow') || btn.closest('[style*="border-radius"]') || btn.closest('div');
      if(!card) return;
      if(card.querySelector('[data-role-select="'+uid+'"]')) return;

      // try to find role text element
      let roleText = '';
      const roleEl = card.querySelector('.muted.tiny') || null;
      if(roleEl) roleText = roleEl.textContent || '';
      const current = guessRole(roleText);

      const wrap = document.createElement('div');
      wrap.className = 'roleEditor';
      wrap.style.marginTop = '8px';
      wrap.style.display = 'flex';
      wrap.style.gap = '8px';
      wrap.style.alignItems = 'center';
      wrap.innerHTML =
        '<label class="tiny muted" style="font-weight:800;">Role</label>' +
        '<select data-role-select="'+uid+'" style="padding:6px 8px; border-radius:10px; border:1px solid rgba(15,47,74,0.18); background:rgba(255,255,255,0.95)">' +
          '<option value="Employee"'+(current==='Employee'?' selected':'')+'>Employee</option>' +
          '<option value="Supervisor"'+(current==='Supervisor'?' selected':'')+'>Supervisor</option>' +
          '<option value="Admin"'+(current==='Admin'?' selected':'')+'>Admin</option>' +
        '</select>' +
        '<button data-role-save="1" data-uid="'+uid+'" style="padding:6px 10px; border-radius:10px; border:1px solid rgba(15,47,74,0.22); background:rgba(15,47,74,0.08); font-weight:900; cursor:pointer;">Save</button>';
      var nameEl = card.querySelector('.name');
            if(nameEl){ nameEl.prepend(wrap); }
            else{ card.appendChild(wrap); }
    });
  }


  document.addEventListener('click', async function(e){
    const tbtn = e.target && e.target.closest ? e.target.closest('[data-role-toggle]') : null;
    if(!tbtn) return;
    if(!(isAdminLike() || isSupervisorLike())){
      alert('Only Supervisors/Admins can change roles.');
      return;
    }
    const uid = tbtn.getAttribute('data-uid');
    const nextRole = tbtn.getAttribute('data-next-role') || '';
    if(!uid || !nextRole) return;

    // Prevent self-role changes for supervisors (avoid locking themselves out)
    try{
      const me = await (getSb() ? getSb().auth.getUser() : Promise.resolve({data:{user:null}}));
      const myId = me && me.data && me.data.user ? me.data.user.id : null;
      if(myId && String(myId) === String(uid)){
        alert('You cannot change your own role.');
        return;
      }
    }catch(_e){}

    // No admin role from supervisors
    if(!isAdminLike() && String(nextRole) === 'Admin'){
      alert('Supervisors cannot assign Admin role.');
      return;
    }

    tbtn.disabled = true;
    tbtn.style.opacity = '0.6';
    try{
      await updateRole(uid, nextRole);
      // Update button label and nextRole in-place
      try{
        const newNext = (String(nextRole)==='Supervisor') ? 'Employee' : 'Supervisor';
        tbtn.setAttribute('data-next-role', newNext);
        tbtn.textContent = (newNext==='Supervisor') ? 'Promote to Supervisor' : 'Demote to Employee';
      }catch(_e){}
      // best-effort audit
      try{ var cid = window.__activeCompanyId || localStorage.getItem('activeCompanyId') || null; if(typeof window.ZUMMEE_logEmployeeAudit==='function'){ await window.ZUMMEE_logEmployeeAudit('role_change', uid, cid, { role: nextRole }); } }catch(_e){}
      try{ await window.refreshEmployees?.(); }catch(_e){}
      try{ if(typeof window.refreshCompanyCommunitiesNow==='function') await window.refreshCompanyCommunitiesNow(); }catch(_e){}
    }catch(err){
      alert('Role update failed: ' + (err?.message || err));
    }finally{
      tbtn.disabled = false;
      tbtn.style.opacity = '';
    }
  }, true);

  document.addEventListener('click', async function(e){
    const btn = e.target.closest ? e.target.closest('[data-role-save]') : null;
    if(!btn) return;
    if(!(isAdminLike() || isSupervisorLike())){
      alert('Only Supervisors/Admins can change roles.');
      return;
    }
    const uid = btn.getAttribute('data-uid');
    const sel = document.querySelector('[data-role-select="'+uid+'"]');
    if(!uid || !sel) return;


    // Supervisors may only set Employee/Supervisor (never Admin)
    if(!isAdminLike()){
      const nv = String(sel.value||'');
      if(nv !== 'Employee' && nv !== 'Supervisor'){
        alert('Supervisors can only assign Employee or Supervisor roles.');
        return;
      }
    }
    btn.disabled = true;
    btn.style.opacity = '0.6';
    try{
      await updateRole(uid, sel.value);

      // v908: saved animation feedback
      try{
        const prevText = btn.textContent;
        btn.textContent = 'Saved ✓';
        btn.classList.add('btnSavedPulse');
        // transient badge
        const badge = document.createElement('span');
        badge.className = 'roleSavedBadge';
        badge.textContent = 'Saved';
        btn.parentElement && btn.parentElement.appendChild(badge);

        setTimeout(function(){
          try{ btn.textContent = prevText; }catch(_e){}
          try{ btn.classList.remove('btnSavedPulse'); }catch(_e){}
          try{ badge.remove(); }catch(_e){}
        }, 1200);
      }catch(_e){}


// Update UI in-place to avoid full re-render (prevents Create Company box flicker)
const card = btn.closest && (btn.closest('.empCard') || btn.closest('.emp-card') || btn.closest('.emp') || btn.closest('[data-emp-card]'));
if(card){
  try{
    card.setAttribute('data-role', String(sel.value||''));
    // update any visible role pill text if present
    const pills = card.querySelectorAll('.pill');
    pills.forEach(function(p){
      const t = (p.textContent||'').trim().toLowerCase();
      if(t==='employee' || t==='supervisor' || t==='admin'){
        p.textContent = String(sel.value||'');
      }
    });
  }catch(_e){}
}
}catch(err){
      alert('Role update failed: ' + (err?.message || err));
    }finally{
      btn.disabled = false;
      btn.style.opacity = '';
    }
  }, true);

  // Re-inject after common refresh actions
  window.addEventListener('load', function(){
    setTimeout(injectRoleEditors, 700);
    setTimeout(injectRoleEditors, 1500);
  });
  document.addEventListener('click', function(e){
    const t = e.target;
    if(!t) return;
    if(t.id === 'sup_refreshEmployees' || t.closest('#sup_refreshEmployees') || t.id === 'sup_refreshEmployeeManagement'){
      setTimeout(injectRoleEditors, 400);
      setTimeout(injectRoleEditors, 900);
    }
  });

  // If renderEmployeeManagement exists, wrap it to inject after render
  if(typeof window.renderEmployeeManagement === 'function'){
    const orig = window.renderEmployeeManagement;
    window.renderEmployeeManagement = function(data){
      orig(data);
      setTimeout(injectRoleEditors, 250);
    };
  }
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v862: set role dropdown values from displayed role text
(function(){
  function guessRole(text){
    const t = String(text||'').toLowerCase();
    if(t.includes('supervisor')) return 'Supervisor';
    if(t.includes('admin')) return 'Admin';
    return 'Employee';
  }
  function syncRoleSelects(){
    try{
      document.querySelectorAll('select[data-role-select]').forEach(sel => {
        if(sel.__synced) return;
        const uid = sel.getAttribute('data-role-select');
        const card = sel.closest('div[style*="border-radius"]') || sel.closest('div');
        let roleText = '';
        const m = card ? card.querySelector('.muted.tiny') : null;
        if(m) roleText = m.textContent || '';
        sel.value = guessRole(roleText);
        sel.__synced = true;
      });
    }catch(e){}
  }
  window.addEventListener('load', function(){ setTimeout(syncRoleSelects, 800); });
  document.addEventListener('click', function(e){
    const t = e.target;
    if(!t) return;
    if(t.id === 'sup_refreshEmployees' || t.closest('#sup_refreshEmployees')){
      setTimeout(syncRoleSelects, 600);
    }
  });
  // wrap renderEmployeeManagement if exists
  if(typeof window.renderEmployeeManagement === 'function'){
    const orig = window.renderEmployeeManagement;
    window.renderEmployeeManagement = function(data){
      orig(data);
      setTimeout(syncRoleSelects, 300);
    };
  }
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




(function(){
  function getSB(){
    return window.sb || window.supabaseClient || window.supabase;
  }

  async function createCompanyNow(name){
    const sb = getSB();
    if(!sb){
      alert('Supabase client not ready. Please refresh and try again.');
      return null;
    }
    const nm = String(name||'').trim();
    if(!nm) return null;

    // Insert into the same table the picker loads from
    const ins = await sb.from('Companies').insert({ name: nm }).select('id,name').maybeSingle();
    if(ins.error){
      console.warn('[Companies] insert failed', ins.error);
      alert('Could not create company: ' + (ins.error.message || 'Unknown error'));
      return null;
    }
    return ins.data;
  }

  function ensureCreateCompanyModal(){
    if(document.getElementById('zummeeCreateCompanyModal')) return;

    // Uses the same modal styling system already present on this page.
    const host = document.createElement('div');
    host.innerHTML = `
<div id="zummeeCreateCompanyModal" class="zummee-modal__backdrop" aria-hidden="true">
  <div class="zummee-modal__card" role="dialog" aria-modal="true" aria-labelledby="zummeeCreateCompanyTitle">
    <div class="zummee-modal__header">
      <div class="zummee-modal__icon" aria-hidden="true">+</div>
      <div>
        <div id="zummeeCreateCompanyTitle" class="zummee-modal__title">Create Company</div>
        <div class="zummee-modal__subtitle">Enter the company name to add it to Zummee.</div>
      </div>
    </div>
    <div class="zummee-modal__body">
      <div class="zummee-modal__label">Company Name <span style="color:#ff5b5b">*</span></div>
      <input id="zummeeCreateCompany_name" class="zummee-modal__input" type="text" placeholder="e.g., Zummee Test Company 2" autocomplete="off" />
      <div id="zummeeCreateCompanyError" class="zummee-modal__error" role="alert" aria-live="polite"></div>
    </div>
    <div class="zummee-modal__footer">
      <button id="zummeeCreateCompanyCancel" type="button" class="zummee-btn zummee-btn--ghost">Cancel</button>
      <button id="zummeeCreateCompanySave" type="button" class="zummee-btn zummee-btn--primary">Create</button>
    </div>
  </div>
</div>`;
    document.body.appendChild(host);

    const modal = document.getElementById('zummeeCreateCompanyModal');
    const cancel = document.getElementById('zummeeCreateCompanyCancel');
    const save = document.getElementById('zummeeCreateCompanySave');
    const input = document.getElementById('zummeeCreateCompany_name');
    const err = document.getElementById('zummeeCreateCompanyError');

    function close(){
      modal.classList.remove('is-show');
      modal.setAttribute('aria-hidden','true');
      err.textContent = '';
      modal._resolver = null;
    }

    function resolveAndClose(val){
      if(typeof modal._resolver === 'function') modal._resolver(val);
      close();
    }

    cancel.addEventListener('click', function(){ resolveAndClose(null); });
    modal.addEventListener('click', function(e){ if(e.target === modal) resolveAndClose(null); });

    function submit(){
      const name = (input.value || '').trim();
      if(!name){
        err.textContent = 'Please enter a company name.';
        input.focus();
        return;
      }
      resolveAndClose(name);
    }

    save.addEventListener('click', submit);
    input.addEventListener('keydown', function(e){
      if(e.key === 'Enter') submit();
      if(e.key === 'Escape') resolveAndClose(null);
    });
  }

  async function promptCreateCompanyName(){
    ensureCreateCompanyModal();
    const modal = document.getElementById('zummeeCreateCompanyModal');
    const input = document.getElementById('zummeeCreateCompany_name');
    const err = document.getElementById('zummeeCreateCompanyError');

    input.value = '';
    err.textContent = '';
    modal.classList.add('is-show');
    modal.setAttribute('aria-hidden','false');
    setTimeout(function(){ input.focus(); }, 0);

    return await new Promise(function(resolve){
      modal._resolver = resolve;
    });
  }

  async function openCreateCompanyModal(){
    // Admin-only safety guard (even if UI is hidden).
    try{
      const r = (window.__sc_role || window.currentUserRole || window.userRole || (function(){
        try{ return localStorage.getItem('userRole') || localStorage.getItem('role') || ''; }catch(_e){ return ''; }
      })());
      const nr = String(r||'').toLowerCase().replace(/[^a-z]/g,'');
      if(!(nr === 'admin' || nr === 'superadmin')){
        alert('Admins only.');
        return;
      }
    }catch(_e){}

    const nm = await promptCreateCompanyName();
    if(nm == null) return; // cancelled
    const created = await createCompanyNow(nm);
    if(!created) return;

    // Try to refresh the picker if the page has a loader for it
    try{
      if(typeof window.loadCompanyPicker === 'function'){
        await window.loadCompanyPicker();
      } else {
        // Best-effort: append to the picker if present
        const picker = document.getElementById('sup_ccCompanyPicker');
        if(picker){
          const opt = document.createElement('option');
          opt.value = created.id;
          opt.textContent = created.name;
          picker.appendChild(opt);
          picker.value = created.id;
          try{ picker.dispatchEvent(new Event('change', { bubbles:true })); }catch(e){}
        }
      }
    }catch(e){
      console.warn('[Companies] picker refresh failed', e);
    }
    try{ (window.toast||window.__zum_showToast||function(m){console.log(m);})(`Company created: ${created.name}`); }catch(_e){ try{ console.log('Company created:', created.name); }catch(__){} }
  }

  // expose globals (some parts of the page call openCreateCompanyModal() directly)
  window.createCompanyNow = createCompanyNow;
  window.openCreateCompanyModal = openCreateCompanyModal;
  try{ window.openCreateCompanyModal && (window.openCreateCompanyModal.__bound = true); }catch(e){}
  try{ window.eval('var openCreateCompanyModal = window.openCreateCompanyModal;'); }catch(e){}

  // Wire button
  function wire(){
    const btn = document.getElementById('cm_createSwitchBtn');
    if(btn && !btn.__createCompanyWired){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        openCreateCompanyModal();
      });
      btn.__createCompanyWired = true;
    }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// v1005+: Create Company section is Admin-only.
(function(){
  const box = document.getElementById('sup_createCompanyMiniBox');
  if(!box) return;

  function normRole(r){
    return String(r||'').toLowerCase().replace(/[^a-z]/g,''); // strips spaces/_/-
  }
  function canSeeCreateCompany(r){
    const nr = normRole(r);
    // Admin-only (platform admin). Do NOT allow supervisors or company admins.
    return (nr === 'admin' || nr === 'superadmin');
  }

  async function resolveRoleOnce(){
    let role = window.__sc_role || window.currentUserRole || window.userRole
      || (function(){ try{ return localStorage.getItem('userRole') || localStorage.getItem('role') || ''; }catch(_e){ return ''; } })();
    if(role) return String(role);

    const sb = window.sb || window.supabaseClient;
    if(!sb || !sb.auth || !sb.from) return '';
    try{
      const ures = await sb.auth.getUser();
      const uid = ures && ures.data && ures.data.user && ures.data.user.id;
      if(!uid) return '';
      const rres = await sb.from('userdirectory').select('role').eq('auth_user_id', uid).maybeSingle();
      const r = (rres && rres.data && rres.data.role) ? String(rres.data.role) : '';
      if(r){
        window.__sc_role = r;
        window.currentUserRole = r;
        try{ localStorage.setItem('userRole', r); }catch(_e){}
      }
      return r;
    }catch(_e){
      return '';
    }
  }

  async function apply(){
    const role = await resolveRoleOnce();
    const ok = canSeeCreateCompany(role);
    box.style.display = ok ? '' : 'none';

    // Also disable the "Create & Switch" button if present.
    const btn = document.getElementById('cm_createSwitchBtn');
    if(btn){
      btn.style.display = ok ? '' : 'none';
      btn.disabled = !ok;
    }
  }

  // Apply after DOM ready and also after load (role sometimes resolves late)
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  }else{
    apply();
  }
  window.addEventListener('load', function(){
    setTimeout(apply, 250);
    setTimeout(apply, 1000);
  });
})();

function openSignOutModal(){ document.getElementById('signOutModal').style.display='flex'; }
function closeSignOutModal(){ document.getElementById('signOutModal').style.display='none'; }
function confirmSignOut(){ closeSignOutModal(); doSignOut(); }




// Unified confirm modal for deleting a community + optional Undo toast
(function(){
  function qs(id){ return document.getElementById(id); }

  // Simple toast with optional action button (Undo)
  function showToast(message, actionText, actionFn, ttlMs){
    try{
      var host = qs("zum_toastHost");
      if(!host){
        host = document.createElement("div");
        host.id = "zum_toastHost";
        host.style.cssText = "position:fixed; right:14px; bottom:14px; z-index:9999999; display:flex; flex-direction:column; gap:10px;";
        document.body.appendChild(host);
      }
      var t = document.createElement("div");
      t.style.cssText = "background:#0f2f4a; color:#fff; padding:12px 14px; border-radius:14px; box-shadow:0 14px 40px rgba(0,0,0,.25); display:flex; align-items:center; gap:12px; max-width:min(420px,92vw);";
      var msg = document.createElement("div");
      msg.style.cssText = "flex:1; font-weight:700; line-height:1.25;";
      msg.textContent = message;
      t.appendChild(msg);

      var btn = null;
      if(actionText && typeof actionFn === "function"){
        btn = document.createElement("button");
        btn.type = "button";
        btn.className = "zum-btn secondary";
        btn.style.cssText = "background:rgba(255,255,255,.12); color:#fff; border-color:rgba(255,255,255,.28);";
        btn.textContent = actionText;
        btn.addEventListener("click", function(){
          try{ actionFn(); }catch(e){ console.warn(e); }
          try{ host.removeChild(t); }catch(_e){}
        });
        t.appendChild(btn);
      }

      host.appendChild(t);
      var ttl = typeof ttlMs === "number" ? ttlMs : 5200;
      setTimeout(function(){ try{ host.removeChild(t); }catch(_e){} }, ttl);
    }catch(e){ console.warn(e); }
  }

  function ensureModal(){
    var back = qs("ccDeleteConfirmModal");
    if(!back){
      try{
        // Create modal on-demand so we never fall back to browser confirm()
        back = document.createElement("div");
        back.id = "ccDeleteConfirmModal";
        back.className = "zum-modal-backdrop";
        back.style.display = "none";
        back.innerHTML = ''+
          '<div class="zum-modal">'+
            '<div class="zum-modal-header">'+
              '<div class="zum-modal-title" id="ccDeleteConfirmTitle">Delete community</div>'+
            '</div>'+
            '<div class="zum-modal-body" id="ccDeleteConfirmBody">Remove this community?</div>'+
            '<div class="zum-modal-actions">'+
              '<button class="btn" type="button" id="ccDeleteConfirmCancel">Cancel</button>'+
              '<button class="btn primary" type="button" id="ccDeleteConfirmOk">Delete</button>'+
            '</div>'+
          '</div>';
        document.body.appendChild(back);
      }catch(e){
        return null;
      }
    }
    return {
      back: back,
      title: qs("ccDeleteConfirmTitle"),
      body: qs("ccDeleteConfirmBody"),
      ok: qs("ccDeleteConfirmOk"),
      cancel: qs("ccDeleteConfirmCancel")
    };
  }

  var _busy = false;
  window.zummeeConfirmDeleteCommunity = function(message, opts){
    opts = opts || {};
    return new Promise(function(resolve){
      try{
        var m = ensureModal();
        if(!m){ resolve(false); return; }
        if(_busy){ resolve(false); return; }
        _busy = true;

        if(m.title) m.title.textContent = opts.title || "Delete community";
        if(m.body) m.body.textContent = message || "Remove this community?";
        if(m.ok) m.ok.textContent = opts.confirmText || (opts.danger ? "Delete" : "OK");

        // Style OK as danger if requested
        if(m.ok){
          if(opts.danger){
            m.ok.style.background = "#b42318";
            m.ok.style.borderColor = "#b42318";
          }else{
            m.ok.style.background = "";
            m.ok.style.borderColor = "";
          }
        }

        function close(val){
          try{ m.back.style.display = "none"; }catch(_e){}
          _busy = false;
          cleanup();
          resolve(!!val);
        }
        function cleanup(){
          try{ m.cancel && m.cancel.removeEventListener("click", onCancel); }catch(_e){}
          try{ m.ok && m.ok.removeEventListener("click", onOk); }catch(_e){}
          try{ m.back && m.back.removeEventListener("click", onBack); }catch(_e){}
          try{ document.removeEventListener("keydown", onKey); }catch(_e){}
        }
        function onCancel(){ close(false); }
        function onOk(){ close(true); }
        function onBack(ev){ if(ev.target === m.back) close(false); }
        function onKey(ev){ if(m.back.style.display!=="flex") return; if(ev.key==="Escape") close(false); }

        m.cancel && m.cancel.addEventListener("click", onCancel);
        m.ok && m.ok.addEventListener("click", onOk);
        m.back && m.back.addEventListener("click", onBack);
        document.addEventListener("keydown", onKey);

        m.back.style.display = "flex";
      }catch(e){
        _busy = false;
        resolve(false);
      }
    });
  };

  // Expose toast helper for CC remove undo
  window.__zum_showToast = showToast;
})();



// v961: Add Community modal wiring (Supervisor Access)
(function(){
  function qs(id){ return document.getElementById(id); }
  var back = qs("sup_addCommunityModalBack");
  if(!back) return;

  function openModal(){
    try{
      var inp = qs("sup_addCommunityModalName");
      var st = qs("sup_addCommunityModalStatus");
      if(st) st.textContent = "";
      if(inp) inp.value = "";
      back.style.display = "flex";
      back.setAttribute("aria-hidden","false");
      setTimeout(function(){ try{ inp && inp.focus(); }catch(e){} }, 30);
    }catch(e){ console.error(e); }
  }
  function closeModal(){
    back.style.display = "none";
    back.setAttribute("aria-hidden","true");
  }

  function flashCommunityRowByName(name){
    try{
      if(!name) return;
      var list = document.getElementById("sup_companyCommunityList");
      if(!list) return;
      var nodes = list.querySelectorAll(".sup-name");
      var target = null;
      var needle = String(name).trim().toLowerCase();
      nodes.forEach(function(n){
        if(target) return;
        var t = String(n.textContent||"").trim().toLowerCase();
        if(t===needle) target = n;
      });
      if(!target) return;
      var row = target.closest(".sup-item") || target.closest(".cc-item") || target.parentElement;
      if(row && row.classList){
        row.classList.add("cc-flash");
        try{ row.scrollIntoView({block:"center", behavior:"smooth"}); }catch(_e){}
        setTimeout(function(){ try{ row.classList.remove("cc-flash"); }catch(_e){} }, 1400);
      }
    }catch(e){ console.error(e); }
  }

  back.addEventListener("click", function(ev){ if(ev.target === back) closeModal(); });
  document.addEventListener("keydown", function(ev){
    if(back.style.display !== "flex") return;
    if(ev.key === "Escape") closeModal();
    if(ev.key === "Enter"){ ev.preventDefault(); try{ qs("sup_addCommunityModalAdd").click(); }catch(e){} }
  });

  var btnCancel = qs("sup_addCommunityModalCancel");
  if(btnCancel) btnCancel.addEventListener("click", closeModal);

  // Hook Add button (sup_addCommunityBtn) to open modal
  function hookAddBtn(){
    var btn = qs("sup_addCommunityBtn");
    if(!btn) return;
    if(btn.__v961Hooked) return;
    btn.__v961Hooked = true;
    btn.addEventListener("click", function(ev){
      try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
      openModal();
      return false;
    });
  }
  hookAddBtn();

  var btnAdd = qs("sup_addCommunityModalAdd");
  if(btnAdd) btnAdd.addEventListener("click", function(){
    var inp = qs("sup_addCommunityModalName");
    var st = qs("sup_addCommunityModalStatus");
    var name = String(inp && inp.value ? inp.value : "").trim();
    if(!name){ if(st) st.textContent = "Enter a community name."; return; }

    try{
      // Ensure company is selected
      var company = (typeof getCompany === "function") ? getCompany() : null;
      if(!company){ if(st) st.textContent = "Select a company first."; return; }

      // Pass a stable company id into the cloud helper when available.
      // This prevents ReferenceError issues in older builds that relied on
      // an undeclared `effectiveCompanyId` variable.
      var picker = qs('sup_ccCompanyPicker');
      var companyId = (picker && picker.value) ? String(picker.value).trim() : null;

      if(st) st.textContent = "Adding…";
      Promise.resolve()
        .then(function(){ return addCommunityToCloud(company, name, companyId || company); })
        .then(function(ok){
          if(!ok){
            if(st) st.textContent = "Could not add community.";
            alert("Could not add community. If this keeps happening, open DevTools > Console and share the first red error.");
            return;
          }
          var addedName = String(inp.value||"").trim();
          closeModal();
          try{
            var p = loadCompanyCommunities(true);
            // After refresh, highlight the newly added community row
            Promise.resolve(p).then(function(){
              setTimeout(function(){ flashCommunityRowByName(addedName); }, 80);
            });
            return p;
          }catch(e){
            setTimeout(function(){ flashCommunityRowByName(addedName); }, 80);
            return null;
          }
        })
        .catch(function(err){
          console.error("[CC] modal add failed", err);
          if(st) st.textContent = "Add failed.";
        });
    }catch(err){
      console.error(err);
      if(st) st.textContent = "Add failed.";
    }
  });
})();



/* === Zummee Patch v1048: Ensure company/community pickers populate on pages (Mileage) even if header renders late === */
(function(){
  try{
    const already = window.__zummee_auto_fire_company_change_v1048;
    if(already) return;
    window.__zummee_auto_fire_company_change_v1048 = true;
  }catch(_e){}

  function isMileagePage(){
    try{
      const p = (location.pathname||'').toLowerCase();
      if(p.includes('mileage')) return true;
      return !!document.querySelector('img[src*="mileage"], #mileageForm, #mileage_entries, [data-page="mileage"]');
    }catch(_e){ return false; }
  }

  async function fireOnceWhenReady(){
    const companyId = (localStorage.getItem('activeCompanyId')||localStorage.getItem('zummee_company_id')||'').trim();
    if(!companyId) return;
    // If not on mileage, don't force it.
    if(!isMileagePage()) return;

    let fired = false;

    function attempt(){
      if(fired) return;
      const companyPicker = document.getElementById('sup_ccCompanyPicker');
      if(!companyPicker) return;

      // Wait until options are present (company picker often populated async)
      const optCount = companyPicker.options ? companyPicker.options.length : 0;
      if(optCount <= 1) return;

      // If already correct, still dispatch a change once to trigger downstream community loads
      try{
        if(String(companyPicker.value||'') !== String(companyId)){
          companyPicker.value = String(companyId);
        }
      }catch(_e){}

      try{
        companyPicker.dispatchEvent(new Event('change', {bubbles:true}));
        document.dispatchEvent(new CustomEvent('company:changed', {detail:{companyId}}));
      }catch(_e){}
      fired = true;

      // Also try to nudge community picker refresh if a helper exists
      try{ if(typeof window.refreshCommunities === 'function') window.refreshCommunities(); }catch(_e){}
      try{ if(typeof window.refreshCompanyCommunities === 'function') window.refreshCompanyCommunities(); }catch(_e){}
      try{ if(typeof window.refreshUI === 'function') window.refreshUI(); }catch(_e){}
    }

    // Try immediately, then observe DOM for late header insertion, and also poll briefly
    attempt();

    try{
      const mo = new MutationObserver(()=>attempt());
      mo.observe(document.documentElement || document.body, {childList:true, subtree:true});
      // Stop observing after a bit once fired
      const stop = ()=>{ try{ mo.disconnect(); }catch(_e){} };
      const timer = setInterval(()=>{
        if(fired){ clearInterval(timer); stop(); }
        else attempt();
      }, 250);
      setTimeout(()=>{ clearInterval(timer); stop(); }, 8000);
    }catch(_e){
      // Fallback poll
      const t = setInterval(()=>{
        if(fired){ clearInterval(t); return; }
        attempt();
      }, 300);
      setTimeout(()=>clearInterval(t), 8000);
    }
  }

  // Run after DOM ready
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', fireOnceWhenReady, {once:true});
  }else{
    fireOnceWhenReady();
  }

  // Also run when auth/profile announces ready (if those events exist)
  try{
    document.addEventListener('auth:ready', fireOnceWhenReady);
    document.addEventListener('profile:loaded', fireOnceWhenReady);
  }catch(_e){}
})();



// v1211_FORCE: ensure modern community selector always applies on Manager Hub and other pages,
// even if renderCommunities exits early or communities load async.
(function(){
  function force(){
    try{
      var sel = document.getElementById("zummeeCommunitySelect");
      if(!sel) return;
      try{ (window.ensureModernCommunitySelector && window.ensureModernCommunitySelector(sel)); }catch(e){}
      // If still not applied, try again
      if(sel && sel.dataset && sel.dataset.zModernApplied!=="1") return;
    }catch(e){}
  }
  function start(){
    // run immediately and poll briefly
    force();
    var tries=0;
    var t=setInterval(function(){
      tries++;
      force();
      var sel=document.getElementById("zummeeCommunitySelect");
      if(sel && sel.dataset && sel.dataset.zModernApplied==="1"){ clearInterval(t); }
      if(tries>40){ clearInterval(t); } // ~10s
    },250);

    // observe header changes (some pages re-render header)
    try{
      var header = document.querySelector(".zummee-header") || document.body;
      var mo=new MutationObserver(function(){ force(); });
      mo.observe(header,{subtree:true, childList:true});
    }catch(_e){}
  }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", start);
  }else{
    start();
  }
})();
