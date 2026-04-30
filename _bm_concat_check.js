
// v840: ensureSupabase Promise shim (clean)
function ensureSupabaseSync(){
  try{
    if(window.sb) return window.sb;
    if(window.supabaseClient) return window.supabaseClient;
    if(window.supabase) return window.supabase;
    if(typeof getSupabaseClientSafe === 'function') return getSupabaseClientSafe();
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

;

// New Business company/user store helpers (global, executes)
window.nbCompanyKey = window.nbCompanyKey || function(mid){ return "zummee_board_meeting_new_business_company_v1__meeting__"+String(mid||""); };
window.nbUserKey = window.nbUserKey || function(uid, mid){ return "zummee_board_meeting_new_business_v1__user__"+String(uid||"anon")+"__meeting__"+String(mid||""); };

window.readNewBizCompany = window.readNewBizCompany || function(mid){
  try{ if(typeof readJson==="function") return readJson(window.nbCompanyKey(mid), []); }catch(e){}
  try{ var raw=localStorage.getItem(window.nbCompanyKey(mid))||"[]"; var arr=JSON.parse(raw); return Array.isArray(arr)?arr:[]; }catch(e2){ return []; }
};

window.writeNewBizCompany = window.writeNewBizCompany || function(mid, arr){
  try{ if(typeof writeJson==="function") return writeJson(window.nbCompanyKey(mid), arr||[]); }catch(e){}
  try{ localStorage.setItem(window.nbCompanyKey(mid), JSON.stringify(arr||[])); }catch(e2){}
};

window.readNewBizUser = window.readNewBizUser || function(uid, mid){
  try{ if(typeof readJson==="function") return readJson(window.nbUserKey(uid, mid), []); }catch(e){}
  try{ var raw=localStorage.getItem(window.nbUserKey(uid, mid))||"[]"; var arr=JSON.parse(raw); return Array.isArray(arr)?arr:[]; }catch(e2){ return []; }
};

window.writeNewBizUser = window.writeNewBizUser || function(uid, mid, arr){
  try{ if(typeof writeJson==="function") return writeJson(window.nbUserKey(uid, mid), arr||[]); }catch(e){}
  try{ localStorage.setItem(window.nbUserKey(uid, mid), JSON.stringify(arr||[])); }catch(e2){}
};

;

(() => {
  const SESSION_KEY = "zummee_session_v1";
  function safeParse(raw){ try { return JSON.parse(raw); } catch(e){ return null; } }

  function esc(s){
    return String(s==null?"":s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function getSupabaseSession(){
    try{
      const k="sb-slcwuuwyrgnmlmxpcaim-auth-token";
      let raw=null; try{raw=localStorage.getItem(k);}catch(e){} if(!raw){try{raw=sessionStorage.getItem(k);}catch(e2){}}
      if(!raw) return null; const obj=JSON.parse(raw);
      if(obj && obj.user && obj.user.id){ return {userId:obj.user.id}; }
    }catch(e3){} return null;
  }
  function getSession(){
    const ses=safeParse((sessionStorage.getItem(SESSION_KEY)||localStorage.getItem(SESSION_KEY)||""));
    if(ses && ses.userId) return ses;
    return getSupabaseSession();
  }
  function requireAuth(){
    const ses=getSession();
    if(!ses || !ses.userId){ window.location.href="login.html"; return null; }
    return ses;
  }
  window.ZummeeAuth={
    requireAuth,
    signOut:()=>{
      try{sessionStorage.removeItem(SESSION_KEY);}catch(e){}
      try{localStorage.removeItem(SESSION_KEY);}catch(e2){}
      const sbKey="sb-slcwuuwyrgnmlmxpcaim-auth-token";
      try{localStorage.removeItem(sbKey);}catch(e3){}
      try{sessionStorage.removeItem(sbKey);}catch(e4){}
      window.location.replace("login.html");
    }
  };

  // --- CE Classes (Upcoming + Completed) ---
  function ceKey(uid){ return "zummee_ce_credits_v1__user__" + (uid||"anon"); }
  function ceClassesKey(uid){ return "zummee_ce_classes_v1__user__" + (uid||"anon"); }
  function ceCompletedKey(uid){ return "zummee_ce_completed_v1__user__" + (uid||"anon"); }

  function readJson(key, fallback){
    try{ return safeParse(localStorage.getItem(key) || "") || fallback; }catch(e){ return fallback; }
  }
  function writeJson(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  // --- New Business: company-wide key + helpers (keeps Monthly Action Items consistent) ---
  function nbUserKey(uid, mid){ return "zummee_board_meeting_new_business_v1__user__"+uid+"__meeting__"+mid; }
  function nbCompanyKey(mid){ return "zummee_board_meeting_new_business_company_v1__meeting__"+mid; }

  window.readNewBizUser = function(uid, mid){ return readJson(nbUserKey(uid, mid), []); };
  window.writeNewBizUser = function(uid, mid, arr){ writeJson(nbUserKey(uid, mid), arr||[]); };

  window.readNewBizCompany = function(mid){ return readJson(nbCompanyKey(mid), []); };
  window.writeNewBizCompany = function(mid, arr){ writeJson(nbCompanyKey(mid), arr||[]); };

  function upsertCompanyItem(mid, item){
    try{
      var all = window.readNewBizCompany(mid);
      if(!Array.isArray(all)) all=[];
      var id = String(item && item.id || "");
      if(!id) { all.unshift(item); window.writeNewBizCompany(mid, all); return; }
      var found=false;
      for(var i=0;i<all.length;i++){
        if(all[i] && String(all[i].id||"")===id){ all[i]=item; found=true; break; }
      }
      if(!found) all.unshift(item);
      window.writeNewBizCompany(mid, all);
    }catch(e){}
  }
  function removeCompanyItem(mid, id){
    try{
      var all = window.readNewBizCompany(mid);
      all = (all||[]).filter(function(x){ return String(x.id||"")!==String(id||""); });
      window.writeNewBizCompany(mid, all);
    }catch(e){}
  }
  function updateCompanyItem(mid, id, mut){
    try{
      var all = window.readNewBizCompany(mid);
      if(!Array.isArray(all)) all=[];
      var changed=false;
      for(var i=0;i<all.length;i++){
        if(all[i] && String(all[i].id||"")===String(id||"")){ mut(all[i]); changed=true; }
      }
      if(changed) window.writeNewBizCompany(mid, all);
    }catch(e){}
  }



  function readCeUpcoming(uid){ return readJson(ceClassesKey(uid), []); }
  function writeCeUpcoming(uid, arr){ writeJson(ceClassesKey(uid), arr||[]); }
  function readCeCompleted(uid){ return readJson(ceCompletedKey(uid), []); }
  function writeCeCompleted(uid, arr){ writeJson(ceCompletedKey(uid), arr||[]); }

  function readCE(uid){ return readJson(ceKey(uid), {}); }
  function writeCE(uid, data){ writeJson(ceKey(uid), data||{}); }

  function sanitizeCredits(raw){
    var s = String(raw||"").trim();
    if(!s) return null;
    s = s.replace(/[^\d.]/g,"");
    if(!s) return null;
    var parts = s.split(".");
    if(parts.length>2){ s = parts[0] + "." + parts.slice(1).join(""); }
    if(s === ".") return null;
    var n = Number(s);
    if(!isFinite(n)) return null;
    n = Math.round(n*100)/100;
    return n;
  }
  function fmtCredits(n){
    if(n==null || !isFinite(n)) return "";
    return (Math.round(n) === n) ? String(n.toFixed(0)) : String(n);
  }

  function setMsg(el, msg, isErr){
    if(!el) return;
    if(!msg){ el.style.display="none"; el.textContent=""; el.classList.remove("error"); return; }
    el.style.display="block"; el.textContent=msg;
    if(isErr) el.classList.add("error"); else el.classList.remove("error");
  }

  function updateCeCurrentUI(uid){
    // Keep CE Credits UI in sync if it's on the page
    var ce = readCE(uid);
    var curEl = document.getElementById("ceCurrent");
    if(curEl && (ce.current!=null && ce.current!=="")){
      curEl.value = fmtCredits(Number(ce.current)||0);
    }
    // trigger remaining recalc by dispatching change
    if(curEl){
      try{ curEl.dispatchEvent(new Event("change", {bubbles:true})); }catch(e){}
    }
  }

  function renderUpcoming(uid){
    var tbody = document.getElementById("ceClassesTbody");
    if(!tbody) return;
    var items = readCeUpcoming(uid) || [];
    if(!items.length){
      tbody.innerHTML = '<tr><td colspan="5" class="muted">No upcoming classes added yet.</td></tr>';
      return;
    }
    // keep original indices so we can move the right record
    var mapped = items.map(function(it, idx){ return {it:it, idx:idx}; });
    mapped.sort(function(a,b){
      var ad = (a.it && a.it.date) ? a.it.date : "9999-12-31";
      var bd = (b.it && b.it.date) ? b.it.date : "9999-12-31";
      return ad.localeCompare(bd);
    });
    tbody.innerHTML = mapped.map(function(w){
      var it = w.it || {};
      var d = it.date || "";
      var t = it.title || "";
      var p = it.provider || "";
      var c = (it.credits!=null) ? String(it.credits) : "";
      return '<tr>'
        + '<td>' + esc(d) + '</td>'
        + '<td>' + esc(t) + '</td>'
        + '<td>' + esc(p) + '</td>'
        + '<td>' + esc(c) + '</td>'
        + '<td><button type="button" class="btn ce-mark-complete" data-idx="' + String(w.idx) + '">Mark completed</button></td>'
        + '</tr>';
    }).join("");
  }

  function renderCompleted(uid){
    var tbody = document.getElementById("ceCompletedTbody");
    if(!tbody) return;
    var items = readCeCompleted(uid) || [];
    if(!items.length){
      tbody.innerHTML = '<tr><td colspan="5" class="muted">No completed classes yet.</td></tr>';
      return;
    }
    // newest first
    items.sort(function(a,b){
      var ac = (a && a.completedOn) ? a.completedOn : "0000-00-00";
      var bc = (b && b.completedOn) ? b.completedOn : "0000-00-00";
      if(ac !== bc) return bc.localeCompare(ac);
      var ad = (a && a.date) ? a.date : "0000-00-00";
      var bd = (b && b.date) ? b.date : "0000-00-00";
      return bd.localeCompare(ad);
    });
    tbody.innerHTML = items.map(function(it){
      it = it || {};
      var d = it.date || "";
      var t = it.title || "";
      var p = it.provider || "";
      var c = (it.credits!=null) ? String(it.credits) : "";
      var co = it.completedOn || "";
      return '<tr>'
        + '<td>' + esc(d) + '</td>'
        + '<td>' + esc(t) + '</td>'
        + '<td>' + esc(p) + '</td>'
        + '<td>' + esc(c) + '</td>'
        + '<td>' + esc(co) + '</td>'
        + '</tr>';
    }).join("");
  }

  function markCompleted(uid, idx){
    var upcoming = readCeUpcoming(uid) || [];
    if(idx==null || idx<0 || idx>=upcoming.length) return;

    var it = upcoming[idx] || {};
    upcoming.splice(idx, 1);
    writeCeUpcoming(uid, upcoming);

    var completed = readCeCompleted(uid) || [];
    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = String(today.getMonth()+1).padStart(2,"0");
    var dd = String(today.getDate()).padStart(2,"0");
    var completedOn = yyyy + "-" + mm + "-" + dd;

    completed.unshift({
      date: it.date || "",
      title: it.title || "",
      provider: it.provider || "",
      credits: it.credits != null ? String(it.credits) : "",
      completedOn: completedOn,
      ts: Date.now()
    });
    writeCeCompleted(uid, completed);

    // Auto-add credits to Current Credits
    var addN = sanitizeCredits(it.credits);
    if(addN != null && addN > 0){
      var ce = readCE(uid);
      var cur = Number(ce.current || 0);
      if(!isFinite(cur)) cur = 0;
      var next = Math.round((cur + addN) * 100) / 100;
      ce.current = next;
      ce.history = Array.isArray(ce.history) ? ce.history : [];
      ce.history.unshift({ ts: Date.now(), added: addN, source: "CE class completed", title: it.title || "" });
      writeCE(uid, ce);
      updateCeCurrentUI(uid);
    }

    renderUpcoming(uid);
    renderCompleted(uid);
  }

  function initCeClasses(uid){
    var dateEl = document.getElementById("ceClassDate");
    var titleEl = document.getElementById("ceClassTitle");
    var provEl = document.getElementById("ceClassProvider");
    var credEl = document.getElementById("ceClassCredits");
    var addBtn = document.getElementById("ceClassAddBtn");

    var dateMsg = document.getElementById("ceClassDateMsg");
    var titleMsg = document.getElementById("ceClassTitleMsg");
    var provMsg = document.getElementById("ceClassProviderMsg");
    var credMsg = document.getElementById("ceClassCreditsMsg");

    function clearMsgs(){
      setMsg(dateMsg, "", false); setMsg(titleMsg, "", false); setMsg(provMsg, "", false); setMsg(credMsg, "", false);
    }
    function validate(){
      var ok = true;
      clearMsgs();
      if(!dateEl || !dateEl.value){ setMsg(dateMsg, "Select a date.", true); ok=false; }
      if(!String(titleEl && titleEl.value || "").trim()){ setMsg(titleMsg, "Enter a course title.", true); ok=false; }
      if(!String(provEl && provEl.value || "").trim()){ setMsg(provMsg, "Enter who it's provided by.", true); ok=false; }
      var n = sanitizeCredits(credEl && credEl.value);
      if(n===null){ setMsg(credMsg, "Enter a credit amount (e.g., 2 or 2.5).", true); ok=false; }
      return ok;
    }

    function clearForm(){
      if(dateEl) dateEl.value = "";
      if(titleEl) titleEl.value = "";
      if(provEl) provEl.value = "";
      if(credEl) credEl.value = "";
      clearMsgs();
    }

    if(addBtn){
      addBtn.addEventListener("click", function(){
        if(!validate()) return;
        var items = readCeUpcoming(uid);
        var n = sanitizeCredits(credEl.value);
        var cStr = fmtCredits(n);
        items.push({
          date: dateEl.value,
          title: String(titleEl.value||"").trim(),
          provider: String(provEl.value||"").trim(),
          credits: cStr
        });
        writeCeUpcoming(uid, items);
        clearForm();
        renderUpcoming(uid);
      });
    }

    var upcomingTbody = document.getElementById("ceClassesTbody");
    if(upcomingTbody){
      upcomingTbody.addEventListener("click", function(e){
        var btn = e.target && e.target.closest ? e.target.closest(".ce-mark-complete") : null;
        if(!btn) return;
        var idx = Number(btn.getAttribute("data-idx"));
        if(!isFinite(idx)) return;
        markCompleted(uid, idx);
      });
    }

    renderUpcoming(uid);
    renderCompleted(uid);
  }



  document.addEventListener("DOMContentLoaded",()=>{
    const out=document.getElementById("zummeeSignOut");
    if(out) out.addEventListener("click",()=>window.ZummeeAuth.signOut());

    // Init CE classes after other page scripts hydrate
    setTimeout(()=>{
      const ses = requireAuth();
      if(!ses || !ses.userId) return;
      initCeClasses(ses.userId);
    }, 0);
  });
})();

;
(()=>{ if(window.ZummeeAuth) window.ZummeeAuth.requireAuth(); })();
;

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
      return window.sb;
    }

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

    function safeLocalSet(k,v){ try{ localStorage.setItem(k,v); }catch(_e){} }
    function safeLocalGet(k){ try{ return localStorage.getItem(k)||""; }catch(_e){ return ""; } }

    async function requireUid() {
      const sb = await ensureSupabase();
      const s = await getSessionSafe(sb, 5000);
      const uid = s.data?.session?.user?.id;
      if(!uid) throw new Error("Not signed in");
      return uid;
    }

    async function getProfile() {
      const sb = await ensureSupabase();
      const uid = await requireUid();
      const q = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
      if(q.error) throw q.error;
      return { uid, company:(q.data?.company||"").trim(), selected:(q.data?.selected_community_id||"") };
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
        // Write to all known selected-community keys (incl. user-scoped) so all pages stay in sync.
        safeLocalSet("zummee_selected_community_id", val);
        safeLocalSet("zummee_selected_community_v1", val);
        try{ safeLocalSet((window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY) || SELECTED_COMMUNITY_KEY || "zummee_selected_community_v1", val); }catch(_e){}
        try{
          const sb = await ensureSupabase();
          const uid = await requireUid();
          await sb.from("profiles").update({ selected_community_id: val || null }).eq("id", uid);
        }catch(_e){}
        document.dispatchEvent(new CustomEvent("community:changed", { detail: { community_id: val } }));
      };
    }

    function getLocalCommunitiesKey(profile){
      // Uses user-scoped key if available (set by ZUMMEE_applyUserScope).
      const k = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || "zummee_communities_v1";
      return k;
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
      // Cloud-first communities (PropertyCommunities) so Supabase is the source of truth.
      // Falls back to local cache if cloud is unavailable.
      try{
        const sb = await ensureSupabase();
        const q = await sb
          .from("PropertyCommunities")
          .select("id,name,company")
          .ilike("company", profile.company);
        if(q.error) throw q.error;
        const list = (q.data||[])
          .filter(r=>r && r.id && r.name)
          .map(r=>({ id:String(r.id), name:String(r.name) }))
          .sort((a,b)=>a.name.localeCompare(b.name));
        // Update local cache so offline mode stays consistent across pages.
        writeLocalCommunities(profile, list);
        return list;
      }catch(_e){
        const list = readLocalCommunities(profile);
        return list
          .filter(c=>c && c.id && c.name)
          .map(c=>({ id:String(c.id), name:String(c.name) }))
          .sort((a,b)=>a.name.localeCompare(b.name));
      }
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
        // IMPORTANT: keep localStorage in sync with the visible selection.
        // Some pages (like Daily Ops) scope data by localStorage selected-community id.
        // If we only set the <select> value from the Profile, the UI looks correct
        // but other modules think no community is selected.
        safeLocalSet("zummee_selected_community_id", String(desired));
        safeLocalSet("zummee_selected_community_v1", String(desired));
        try{ safeLocalSet((window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY) || SELECTED_COMMUNITY_KEY || "zummee_selected_community_v1", String(desired)); }catch(_e){}
        // Nudge dependent modules to re-evaluate gated content.
        try{ document.dispatchEvent(new CustomEvent("community:changed", { detail: { community_id: String(desired) } })); }catch(_e){}
      } else {
        select.value = "";
        safeLocalSet("zummee_selected_community_id","");
      }
      select.disabled = false;
      bindSelect(select);
    }

    async function refreshUI() {
      const {select} = els();
      if(!select) return;
      try{
        const profile = await getProfile();
        setSwatch(profile.company);
        if(!profile.company){
          renderSelect(select, [], "");
          // Daily Ops content is gated by community selection.
          // If the dropdown is populated programmatically, the browser won't fire a "change" event.
          // Force a visibility recalculation so the boxes show/hide correctly.
          try{ if(typeof applyCommunityVisibility === "function") applyCommunityVisibility(); }catch(_e){}
          return;
        }
        const list = await listCommunities(profile);
        renderSelect(select, list, profile.selected);
        // Same as above: ensure the gated content reflects the dropdown value.
        try{ if(typeof applyCommunityVisibility === "function") applyCommunityVisibility(); }catch(_e){}
      }catch(e){
        console.error(e);
        renderSelect(select, [], "");
        try{ if(typeof applyCommunityVisibility === "function") applyCommunityVisibility(); }catch(_e){}
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
      await refreshUI();
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
      await refreshUI();
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
        await sb.from("profiles").update({ selected_community_id: null }).eq("id", profile.uid);
      }catch(_e){}
      safeLocalSet("zummee_selected_community_id","");

      document.dispatchEvent(new CustomEvent("communities:changed"));
      await refreshUI();
      document.dispatchEvent(new CustomEvent("community:changed", { detail: { community_id: "" } }));
    }

    document.addEventListener("DOMContentLoaded", ()=>{
      const e = els();
      bindSelect(e.select);
      if(e.btnAdd) e.btnAdd = rebindButton(e.btnAdd, addCommunity);
      if(e.btnRename) e.btnRename = rebindButton(e.btnRename, renameCommunity);
      if(e.btnRemove) e.btnRemove = rebindButton(e.btnRemove, removeCommunity);
      refreshUI();
      // Mark v2 community management as active so legacy wiring blocks don't double-bind.
      try{ window.__zummeeCommunityMgmtV2Bound = true; }catch(_e){}
    });

    document.addEventListener("communities:changed", ()=>refreshUI());
  })();

;

(function bmMeetingsManager(){
  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }
  function getUid(){
    try{
      var k="sb-slcwuuwyrgnmlmxpcaim-auth-token";
      var raw=localStorage.getItem(k) || sessionStorage.getItem(k);
      if(raw){
        var obj=JSON.parse(raw);
        if(obj && obj.user && obj.user.id) return obj.user.id;
      }
    }catch(e){}
    try{
      var sk="zummee_session_v1";
      var ses=safeParse(sessionStorage.getItem(sk) || localStorage.getItem(sk) || "");
      if(ses && ses.userId) return ses.userId;
    }catch(e2){}
    return "anon";
  }
  function getSelectedCommunityId(){
    try{
      var sel=document.getElementById("zummeeCommunitySelect");
      if(sel && sel.value) return String(sel.value).trim();
    }catch(e){}
    try{ return String(localStorage.getItem("zummee_selected_community_id")||"").trim(); }catch(e2){ return ""; }
  }

  function getCommunityNameById(id){
    try{
      var raw = localStorage.getItem("zummee_communities_v1") || "[]";
      var arr = JSON.parse(raw);
      if(Array.isArray(arr)){
        for(var i=0;i<arr.length;i++){
          var c=arr[i]||{};
          if(String(c.id||"")===String(id||"")) return String(c.name||c.communityName||"").trim();
        }
      }
    }catch(e){}
    return "";
  }

  function todayId(){
    var d=new Date();
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+day;
  }

  function indexKey(uid){ return "zummee_board_meetings_index_v1__user__"+(uid||"anon"); }
  function currentKey(uid){ return "zummee_board_meetings_current_v1__user__"+(uid||"anon"); }
  function legacyStartKey(uid){ return "zummee_board_meeting_start_v1__user__"+(uid||"anon"); }

  function readIndex(uid){
    try{
      var arr = safeParse(localStorage.getItem(indexKey(uid))||"");
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function writeIndex(uid, arr){
    try{ localStorage.setItem(indexKey(uid), JSON.stringify(arr||[])); }catch(e){}
  }
  function readCurrent(uid){
    try{ return String(localStorage.getItem(currentKey(uid))||"").trim(); }catch(e){ return ""; }
  }
  function writeCurrent(uid, id){
    try{ localStorage.setItem(currentKey(uid), String(id||"")); }catch(e){}
  }

  function ensureMigration(uid){
    var idx = readIndex(uid);
    if(idx.length) return idx;
    var legacy = "";
    try{ legacy = String(localStorage.getItem(legacyStartKey(uid))||"").trim(); }catch(e){}
    if(legacy){
      idx = [{ id: legacy, started_at: legacy, closed_at: null, title: "" }];
      writeIndex(uid, idx);
      writeCurrent(uid, legacy);
      return idx;
    }
    return idx;
  }

  function ensureCurrent(uid){
    var idx = ensureMigration(uid);
    var cur = readCurrent(uid);
    if(cur && idx.some(function(m){ return m && m.id===cur; })) return cur;
    if(idx.length){
      idx.sort(function(a,b){
        var as = (a && a.started_at) ? a.started_at : "";
        var bs = (b && b.started_at) ? b.started_at : "";
        return (bs||"").localeCompare(as||"");
      });
      cur = idx[0].id;
      writeCurrent(uid, cur);
      return cur;
    }
    // Allow an empty Meeting History. If there are no meetings, do NOT auto-create a draft.
    // The user will create a meeting explicitly via Start Meeting.
    writeCurrent(uid, "");
    return "";
  }

  // Returns the currently selected meeting id if it exists in the index, otherwise "".
  function getValidCurrent(uid){
    var cur = readCurrent(uid);
    if(!cur) return "";
    var idx = readIndex(uid);
    return idx.some(function(m){ return m && m.id===cur; }) ? cur : "";
  }

  function getMeeting(uid, id){
    var idx = readIndex(uid);
    for(var i=0;i<idx.length;i++){
      if(idx[i] && idx[i].id===id) return idx[i];
    }
    return null;
  }

  function upsertMeeting(uid, rec){
    var idx = readIndex(uid);
    var found=false;
    for(var i=0;i<idx.length;i++){
      if(idx[i] && idx[i].id===rec.id){ idx[i]=Object.assign({}, idx[i], rec); found=true; break; }
    }
    if(!found) idx.push(rec);
    idx.sort(function(a,b){
      var as = (a && a.started_at) ? a.started_at : "";
      var bs = (b && b.started_at) ? b.started_at : "";
      if(!!bs !== !!as) return bs ? -1 : 1;
      return (bs||"").localeCompare(as||"");
    });
    writeIndex(uid, idx);
  }

  function formatDT(iso){
    if(!iso) return "";
    var d = new Date(iso);
    if(isNaN(d.getTime())) return iso;
    try{
      return d.toLocaleString(undefined, { weekday:"short", year:"numeric", month:"short", day:"2-digit", hour:"numeric", minute:"2-digit", second:"2-digit" });
    }catch(e){ return d.toString(); }
  }

  function updateNow(){
    var el=document.getElementById("bmDateTime");
    if(!el) return;
    var now=new Date();
    var dateOpts = { weekday:'long', year:'numeric', month:'long', day:'numeric' };
    var timeOpts = { hour:'numeric', minute:'2-digit', second:'2-digit' };
    el.textContent = now.toLocaleDateString(undefined, dateOpts) + " • " + now.toLocaleTimeString(undefined, timeOpts);
  }

  function renderStartPill(){
    var uid=getUid();
    var pill=document.getElementById("bmStartPill");
    if(!pill) return;
    var cur=getValidCurrent(uid);
    if(!cur){
      pill.style.display="none";
      return;
    }
    var m = getMeeting(uid,cur);
    pill.style.display="inline-flex";
    var started = (m && m.started_at) ? ("Meeting Began: " + formatDT(m.started_at)) : "Meeting not started";
    var status = (m && m.closed_at) ? (" • Meeting Adjourned: " + formatDT(m.closed_at)) : "";
    pill.textContent = started + status;
  }

  function renderHistory(){
    var uid=getUid();
    var cur=getValidCurrent(uid);
    var wrap=document.getElementById("bmMeetingsTableWrap");
    if(!wrap) return;
    var idx=readIndex(uid);

    if(!idx.length){
      wrap.innerHTML = '<div class="sub" style="margin:0;">No meetings yet.</div>';
      return;
    }

    var rows = idx.map(function(m){
      m = m || {};
      var started = m.started_at ? formatDT(m.started_at) : (m.id===todayId() ? "Draft (today)" : "Draft");
      var closed = m.closed_at ? formatDT(m.closed_at) : "";
      var st = m.closed_at ? "Closed" : "Open";
      var isCur = (m.id===cur);
      return '<tr>'
        + '<td>' + (isCur ? '✅ ' : '') + '<span style="font-weight:900;">' + started + '</span>' + (closed ? '<div class="muted">Meeting Adjourned: '+closed+'</div>' : '') + '</td>'
        + '<td><span class="nb-badge ' + (m.closed_at ? 'closed' : 'open') + '">' + st + '</span></td>'
        + '<td style="white-space:nowrap;">'
          + '<button class="btn bm-open" data-id="'+m.id+'" type="button">Open</button> '
          + '<button class="btn bm-toggle-close" data-id="'+m.id+'" type="button">' + (m.closed_at ? 'Reopen' : 'Archive') + '</button>'
          + ' <button class="btn bm-delete" data-id="'+m.id+'" type="button" style="border-color:#ffb3b3;color:#b00020;">Delete</button>'
        + '</td>'
      + '</tr>';
    }).join("");

    wrap.innerHTML = '<table class="table">'
      + '<thead><tr><th>Meeting</th><th>Status</th><th>Actions</th></tr></thead>'
      + '<tbody>'+rows+'</tbody></table>';

    var openBtns = wrap.querySelectorAll(".bm-open");
    for(var i=0;i<openBtns.length;i++){
      (function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-id");
          writeCurrent(uid, id);
          try{ window.dispatchEvent(new CustomEvent("zummee:meeting-changed", { detail:{ meetingId:id } })); }catch(e){}
          renderHistory(); renderStartPill(); renderSendQueuedBtn();
        });
      })(openBtns[i]);
    }

    var toggleBtns = wrap.querySelectorAll(".bm-toggle-close");
    for(var j=0;j<toggleBtns.length;j++){
      (function(btn){
        btn.addEventListener("click", function(){
          var id = btn.getAttribute("data-id");
          var m = getMeeting(uid,id) || {id:id};
          if(m.closed_at){ m.closed_at = null; } else { m.closed_at = new Date().toISOString(); }
          upsertMeeting(uid,m);
          try{ window.dispatchEvent(new CustomEvent("zummee:meeting-changed", { detail:{ meetingId:id } })); }catch(e){}
          renderHistory(); renderStartPill();
        });
      })(toggleBtns[j]);
    }

    // Delete meeting (local + cloud record)
    var delBtns = wrap.querySelectorAll(".bm-delete");
    for(var k=0;k<delBtns.length;k++){
      (function(btn){
        btn.addEventListener("click", async function(){
          var id = btn.getAttribute("data-id");
          if(!id) return;
          var msg = "Delete this meeting and all its stored items? This cannot be undone.";
          var proceed = async function(){
                      // If deleting the current meeting, move selection first.
                      var curId = getValidCurrent(uid);
                      if(id === curId){
                        var idxNow = readIndex(uid).filter(function(x){ return x && x.id !== id; });
                        var nextId = (idxNow[0] && idxNow[0].id) ? idxNow[0].id : "";
                        writeCurrent(uid, nextId);
                        try{ window.dispatchEvent(new CustomEvent("zummee:meeting-changed", { detail:{ meetingId:nextId } })); }catch(e){}
                      }

                      // Remove from index
                      var idx = readIndex(uid).filter(function(x){ return x && x.id !== id; });
                      writeIndex(uid, idx);

                      // Remove local stored data for this meeting
                      try{ localStorage.removeItem(nbKey(uid, id)); }catch(e){}
                      try{ localStorage.removeItem(attKey(uid, id)); }catch(e){}
                      try{ localStorage.removeItem("zummee_board_meeting_open_forum_v1__user__" + (uid||"anon") + "__meeting__" + (id||"")); }catch(e){}

                      // Attempt cloud delete (best-effort)
                      try{
                        var cid = getSelectedCommunityId();
                        if(window.sb && window.sb.from && cid && navigator.onLine){
                          await window.sb.from("board_meetings_state")
                            .delete()
                            .match({ user_id: uid, community_id: cid, meeting_key: id });
                        }
                      }catch(_e){}

                      // Re-render
                      renderHistory();
                      renderStartPill();
                      renderSendQueuedBtn();
          };
          if(typeof window.zOpenConfirmModal === "function"){
            window.zOpenConfirmModal({
              modalId: "bm_deleteMeetingModal",
              title: "Delete meeting",
              message: msg,
              okText: "Delete",
              cancelText: "Cancel",
              focus: "cancel",
              onConfirm: function(){ proceed(); }
            });
            return;
          }
          if(!confirm(msg)) return;
          await proceed();
        });
      })(delBtns[k]);
    }
  }

  function startNewMeeting(){
    var uid=getUid();
    var nowIso=new Date().toISOString();
    upsertMeeting(uid, { id: nowIso, started_at: nowIso, closed_at: null, title:"" });
    writeCurrent(uid, nowIso);
    try{ localStorage.setItem(legacyStartKey(uid), nowIso); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent("zummee:meeting-changed", { detail:{ meetingId:nowIso } })); }catch(e){}
    renderHistory(); renderStartPill();
  }

  function endCurrentMeeting(){
    var uid=getUid();
    var cur=getValidCurrent(uid);
    if(!cur){
      alert("No meeting selected. Click Start Meeting first.");
      return;
    }
    var m = getMeeting(uid, cur);
    if(!m){
      alert("No active meeting found. Click Start Meeting first.");
      return;
    }
    if(!m.started_at){
      alert("This meeting hasn't been started yet. Click Start Meeting first.");
      return;
    }
    if(m.closed_at){
      alert("This meeting is already ended.");
      return;
    }
    m.closed_at = new Date().toISOString();
    upsertMeeting(uid, m);
    try{ window.dispatchEvent(new CustomEvent("zummee:meeting-changed", { detail:{ meetingId:cur } })); }catch(e){}
    renderHistory(); renderStartPill(); renderSendQueuedBtn();
  }


  function getCurrentMeetingId(){ var uid=getUid(); return getValidCurrent(uid); }

  // --- Email Outbox ---
  function outboxKey(uid,cid){ return "zummee_email_outbox_v1::"+(uid||"anon")+"::"+(cid||""); }
  function readOutbox(uid,cid){
    try{ var a=safeParse(localStorage.getItem(outboxKey(uid,cid))||""); return Array.isArray(a)?a:[]; }catch(e){ return []; }
  }
  function writeOutbox(uid,cid,a){
    try{ localStorage.setItem(outboxKey(uid,cid), JSON.stringify(a||[])); }catch(e){}
  }
  function renderSendQueuedBtn(){
    var uid=getUid(); var cid=getSelectedCommunityId();
    var btn=document.getElementById("bmSendQueuedBtn");
    if(!btn) return;
    var a=readOutbox(uid,cid).filter(function(x){ return x && x.status==="queued"; });
    btn.textContent = a.length ? ("Send Pending Emails ("+a.length+")") : "Send Pending Emails";
  }
  function queueEmail(payload){
    var uid=getUid(); var cid=getSelectedCommunityId();
    var a=readOutbox(uid,cid);
    payload = payload || {};
    payload.id = payload.id || ("em_"+Date.now()+"_"+Math.random().toString(16).slice(2));
    payload.status = payload.status || "queued";
    payload.created_at = payload.created_at || new Date().toISOString();
    payload.meeting_id = payload.meeting_id || getCurrentMeetingId();
    a.unshift(payload);
    writeOutbox(uid,cid,a);
    renderSendQueuedBtn();
  }
  function sendFirstQueued(){
    var uid=getUid(); var cid=getSelectedCommunityId();
    var a=readOutbox(uid,cid);
    var idx=-1;
    for(var i=0;i<a.length;i++){ if(a[i] && a[i].status==="queued"){ idx=i; break; } }
    if(idx<0){ alert("No pending emails."); renderSendQueuedBtn(); return; }
    var item=a[idx];
    var mailto = "mailto:" + encodeURIComponent(item.to||"") + "?subject=" + encodeURIComponent(item.subject||"") + "&body=" + encodeURIComponent(item.body||"");
    a[idx].status="attempted";
    a[idx].attempted_at=new Date().toISOString();
    writeOutbox(uid,cid,a);
    renderSendQueuedBtn();
    window.location.href = mailto;
  }

  // --- Export minutes (Print to PDF) ---
  function exportMinutes(){
    var uid=getUid();
    var cid=getSelectedCommunityId();
    var mid=getCurrentMeetingId();
    var m=getMeeting(uid,mid)||{id:mid};

    function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
    function readJson(key, fallback){ try{ var o=safeParse(localStorage.getItem(key)||""); return (o==null?fallback:o);}catch(e){ return fallback; } }

    var attendance = readJson("zummee_board_meeting_attendance_v1__user__"+uid+"__meeting__"+mid, {});
    var newbiz = window.readNewBizCompany(mid);
    if(!newbiz || !newbiz.length){ newbiz = window.readNewBizUser(uid, mid); }
    // Filter by selected community
    var __cid = (function(){
      try{
        var sel=document.getElementById("zummeeCommunitySelect");
        if(sel && sel.value) return String(sel.value).trim();
      }catch(e){}
      try{
        return String(getSelectedCommunityId&&getSelectedCommunityId()||"").trim();
      }catch(e2){}
      return "";
    })();
    /*FILTER_BY_COMMUNITY_NEWBIZ*/
    if(__cid){ newbiz = (newbiz||[]).filter(function(it){ return it && String(it.communityId||"")===__cid; }); }
    var forumRaw = readJson("zummee_board_meeting_open_forum_v1__user__"+uid+"__meeting__"+mid, {}) || {};
    var forum = (forumRaw && Array.isArray(forumRaw.entries)) ? forumRaw : (
      (forumRaw && (forumRaw.note || forumRaw.motionMade || forumRaw.motionApproved)) ? { entries: [{ name:"", note:String(forumRaw.note||""), motionMade:!!forumRaw.motionMade, motionApproved:!!forumRaw.motionApproved, motionText:String(forumRaw.motionText||forumRaw.motion||"") }] } : { entries: [] }
    );
    var notes = "";
    try{ notes = String(localStorage.getItem("zummee_board_meetings_notes_v2__user__"+uid+"__meeting__"+mid) || ""); }catch(e){}
    if(!notes){
      try{ notes = String(localStorage.getItem("zummee_board_meetings_notes_v1__user__"+uid) || ""); }catch(e2){}
    }

    var presentNames = Object.keys(attendance||{}).filter(function(k){ return attendance[k]; });
    var open = (newbiz||[]).filter(function(it){ return !(it && (it.closed || it.completed)); });
    var closed = (newbiz||[]).filter(function(it){ return (it && (it.closed || it.completed)); });

    // --- PDF header fields (Community, Date, Begin/Adjourn times) ---
    var commName = "";
    try{
      var commKey = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || "zummee_communities_v1";
      var comms = readJson(commKey, []);
      if(Array.isArray(comms)){
        for(var ci=0; ci<comms.length; ci++){
          var c = comms[ci] || {};
          var id = String(c.id || c.community_id || c.value || c.key || "").trim();
          if(id && id===String(cid||"").trim()){
            commName = String(c.name || c.community_name || c.label || c.title || "").trim();
            break;
          }
        }
      }
    }catch(_e){}
    if(!commName && cid) commName = cid;

    function formatDateOnly(iso){
      if(!iso) return "";
      var d = new Date(iso);
      if(isNaN(d.getTime())) return String(iso);
      try{ return d.toLocaleDateString(undefined, { year:"numeric", month:"long", day:"2-digit" }); }catch(e){ return d.toDateString(); }
    }
    function formatTimeOnly(iso){
      if(!iso) return "";
      var d = new Date(iso);
      if(isNaN(d.getTime())) return String(iso);
      try{ return d.toLocaleTimeString(undefined, { hour:"numeric", minute:"2-digit" }); }catch(e){ return d.toLocaleTimeString(); }
    }

    var beganIso = m.started_at || m.id;
    var dateStr = formatDateOnly(beganIso);
    var beganTime = formatTimeOnly(beganIso);
    var adjTime = m.closed_at ? formatTimeOnly(m.closed_at) : "";

    var html = '<!doctype html><html><head><meta charset="utf-8"><title>Board Meeting Minutes</title>'
      + '<style>body{font-family:Arial,system-ui;padding:24px;color:#111} h1{margin:0 0 6px} .muted{color:#666} .meta{margin:8px 0 14px;padding:10px 12px;border:1px solid #e6e6e6;border-radius:12px} .meta-item{margin:4px 0} .sec{margin-top:18px} .item{border:1px solid #ddd;border-radius:10px;padding:10px;margin:10px 0} pre{white-space:pre-wrap;font-family:inherit}</style>'
      + '</head><body>'
      + '<h1>Board Meeting Minutes</h1>'
      + '<div class="meta">'
      +   '<div class="meta-item"><b>Community:</b> '+ esc(commName||"") + '</div>'
      +   '<div class="meta-item"><b>Date:</b> '+ esc(dateStr||"") + '</div>'
      +   '<div class="meta-item"><b>Meeting Began:</b> '+ esc(beganTime||"") + '</div>'
      +   '<div class="meta-item"><b>Meeting Adjourned:</b> '+ esc(adjTime||"") + '</div>'
      + '</div>'
      + '<div class="sec"><h2>Attendance</h2>'
      + (presentNames.length ? ('<ul>'+presentNames.map(function(n){ return '<li>'+esc(n)+'</li>'; }).join('')+'</ul>') : '<div class="muted">No attendees marked present.</div>')
      + '</div>'
      + '<div class="sec"><h2>Homeowner Open Forum</h2>'
      + (forum.entries && forum.entries.length ? forum.entries.map(function(en,i){
          var title = en.name ? ('Homeowner: '+esc(en.name)) : ('Entry '+(i+1));
          var mm = en.motionMade ? 'Yes' : 'No';
          var ma = en.motionApproved ? 'Yes' : 'No';
          var md = String(en.motionText||en.motion||"").trim();
          var motionLine = md ? ('<div style="margin-top:6px;"><b>Motion:</b> '+esc(md)+'</div>') : '';
          return '<div class="item"><div><b>'+title+'</b></div><div class="muted">Motions made: '+mm+' • Motion approved: '+ma+'</div>'+motionLine+'<pre>'+esc(en.note||"")+'</pre></div>';
        }).join('') : '<div class="muted">No homeowner forum entries.</div>')
      + '</div>'
      + '<div class="sec"><h2>New Business — Open</h2>'
      + (open.length ? open.map(function(it){ var vn = (it.vendorName || it.vendor || it.vendor_name || it.vendorLabel || it.vendor_label || it.vendorId || it.vendor_id || "");
        vn = String(vn||"").trim();
        var nt = (it.note || it.notes || "");
        return '<div class="item">'
          + (vn ? '<div><b>Vendor:</b> '+esc(vn)+'</div>' : '<div class="muted">Vendor: (not assigned)</div>')
          + '<pre style="white-space:pre-line;margin:8px 0 0;">'+esc(nt)+'</pre>'
          + '</div>'; }).join('') : '<div class="muted">No open items.</div>')
      + '</div>'
      + '<div class="sec"><h2>New Business — Closed</h2>'
      + (closed.length ? closed.map(function(it){ var vn = (it.vendorName || it.vendor || it.vendor_name || it.vendorLabel || it.vendor_label || it.vendorId || it.vendor_id || "");
        vn = String(vn||"").trim();
        var nt = (it.note || it.notes || "");
        return '<div class="item">'
          + (vn ? '<div><b>Vendor:</b> '+esc(vn)+'</div>' : '<div class="muted">Vendor: (not assigned)</div>')
          + '<pre style="white-space:pre-line;margin:8px 0 0;">'+esc(nt)+'</pre>'
          + '</div>'; }).join('') : '<div class="muted">No closed items.</div>')
      + '</div>'
      + '<div class="sec"><h2>Notes</h2><pre>'+esc(notes||"")+'</pre></div>'
      + '<script>window.onload=function(){ window.print(); }<\/script>'
      + '</body></html>';

    var w = window.open("", "_blank");
    if(!w){ alert("Pop-up blocked. Please allow pop-ups to export minutes."); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }

  window.ZummeeMeetings = {
    getUid: getUid,
    getSelectedCommunityId: getSelectedCommunityId,
    getCurrentId: getCurrentMeetingId,
    isClosed: function(){
      var uid=getUid(); var mid=getCurrentMeetingId();
      var m=getMeeting(uid,mid); return !!(m && m.closed_at);
    },
    startNewMeeting: startNewMeeting,
    queueEmail: queueEmail,
    sendFirstQueued: sendFirstQueued,
    exportMinutes: exportMinutes,
    render: function(){ renderHistory(); renderStartPill(); renderSendQueuedBtn(); }
  };

  document.addEventListener("DOMContentLoaded", function(){
    updateNow(); setInterval(updateNow, 1000);
    renderHistory(); renderStartPill(); renderSendQueuedBtn();

    var startBtn=document.getElementById("bmStartBtn");
    if(startBtn) startBtn.addEventListener("click", startNewMeeting);

    
    var endBtn=document.getElementById("bmEndBtn");
    if(endBtn) endBtn.addEventListener("click", endCurrentMeeting);
var exp=document.getElementById("bmExportBtn");
    if(exp) exp.addEventListener("click", exportMinutes);

    var send=document.getElementById("bmSendQueuedBtn");
    if(send) send.addEventListener("click", sendFirstQueued);

    window.addEventListener("zummee:meeting-changed", function(){ renderHistory(); renderStartPill(); renderSendQueuedBtn(); });
  });
})();

;

(function bmAttendanceInit(){
  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }

  function getUid(){
    try{
      var k="sb-slcwuuwyrgnmlmxpcaim-auth-token";
      var raw=localStorage.getItem(k) || sessionStorage.getItem(k);
      if(raw){
        var obj=JSON.parse(raw);
        if(obj && obj.user && obj.user.id) return obj.user.id;
      }
    }catch(e){}
    try{
      var sk="zummee_session_v1";
      var ses=safeParse(sessionStorage.getItem(sk) || localStorage.getItem(sk) || "");
      if(ses && ses.userId) return ses.userId;
    }catch(e2){}
    try{
      var id = String(localStorage.getItem("zummee_user_id_v1")||"").trim();
      if(id) return id;
    }catch(e3){}
    return "anon";
  }

  function getSelectedCommunityId(){
    // Prefer the explicit id if present
    try{
      var id = String(localStorage.getItem("zummee_selected_community_id")||"").trim();
      if(id) return id;
    }catch(_e){}
    // Fallback to selected community object (if stored)
    try{
      var raw = localStorage.getItem("zummee_selected_community_v1");
      var obj = safeParse(raw||"");
      if(obj && (obj.id || obj.community_id)) return String(obj.id || obj.community_id);
    }catch(_e2){}
    return "";
  }

  // Daily Ops data key mirrors ops.html scoping (baseKey::uid::communityId)
  var DAILY_OPS_BASE_KEY = "daily_ops_manager_v9";
  function dailyOpsKey(uid, cid){
    uid = String(uid||"").trim();
    cid = String(cid||"").trim();
    if(uid && cid) return DAILY_OPS_BASE_KEY + "::" + uid + "::" + cid;
    if(uid) return DAILY_OPS_BASE_KEY + "::" + uid;
    if(cid) return DAILY_OPS_BASE_KEY + "::" + cid;
    return DAILY_OPS_BASE_KEY;
  }

  function readDailyOpsState(uid, cid){
    try{
      var raw = localStorage.getItem(dailyOpsKey(uid,cid));
      if(!raw) raw = localStorage.getItem(DAILY_OPS_BASE_KEY); // legacy fallback
      if(!raw) return null;
      var st = safeParse(raw);
      if(!st || typeof st !== "object") return null;
      return st;
    }catch(e){ return null; }
  }

  function readMeetingStartIso(uid){
    try{
      var raw = localStorage.getItem("zummee_board_meeting_start_v1__user__" + (uid||"anon"));
      var iso = String(raw||"").trim();
      return iso || "";
    }catch(e){ return ""; }
  }

  function meetingId(uid){
    try{ if(window.ZummeeMeetings && window.ZummeeMeetings.getCurrentId){ return window.ZummeeMeetings.getCurrentId(); } }catch(e){}
    var d=new Date();
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+day;
  }

  var NB_BASE = "zummee_board_meeting_new_business_v1";
  function nbKey(uid, mid){ return NB_BASE + "__user__" + (uid||"anon") + "__meeting__" + (mid||""); }

  function readItems(uid, mid){
    try{
      var raw = localStorage.getItem(nbKey(uid,mid));
      if(!raw) return [];
      var arr = safeParse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function writeItems(uid, mid, arr){
    try{ localStorage.setItem(nbKey(uid,mid), JSON.stringify(arr||[])); }catch(e){}
  }

  function uid2(){ return Math.random().toString(16).slice(2) + Date.now().toString(16); }
  function esc(s){
    return String(s==null?"":s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/\"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function fmtDT(iso){
    try{
      var d = new Date(iso);
      if(isNaN(d.getTime())) return String(iso||"");
      return d.toLocaleString(undefined, { weekday:"short", year:"numeric", month:"short", day:"2-digit", hour:"numeric", minute:"2-digit" , second:"2-digit"});
    }catch(e){ return String(iso||""); }
  }

  // =====================================================
  // Attendance (pull names from Daily Ops → Board Members)
  // Storage: name -> boolean, scoped by user + meeting
  // =====================================================

  var ATT_BASE = "zummee_board_meeting_attendance_v1";
  function attKey(uid, mid){ return ATT_BASE + "__user__" + (uid||"anon") + "__meeting__" + (mid||""); }

  function readAttendance(uid, mid){
    try{
      var raw = localStorage.getItem(attKey(uid, mid));
      var obj = safeParse(raw||"");
      return (obj && typeof obj === "object") ? obj : {};
    }catch(e){ return {}; }
  }
  function writeAttendance(uid, mid, obj){
    try{ localStorage.setItem(attKey(uid, mid), JSON.stringify(obj||{})); }catch(e){}
  }

  function readBoardMemberNames(uid, cid){
    var st = readDailyOpsState(uid, cid);
    // Daily Ops schema stores board members at st.data.boardMembers
    var rows = (st && st.data && st.data.boardMembers) ? st.data.boardMembers : [];
    rows = Array.isArray(rows) ? rows : [];
    var seen = {};
    var names = [];
    for(var i=0;i<rows.length;i++){
      var r = rows[i] || {};
      var nm = String(r.name||"").trim();
      if(!nm) continue;
      var key = nm.toLowerCase();
      if(seen[key]) continue;
      seen[key] = true;
      names.push(nm);
    }
    names.sort(function(a,b){ return a.localeCompare(b); });
    return names;
  }

  function renderAttendance(){
    var uid = getUid();
    var cid = getSelectedCommunityId();
    var mid = meetingId(uid);

    var listEl = document.getElementById("bmAttendanceList");
    var emptyEl = document.getElementById("bmAttendanceEmpty");
    var pillEl = document.getElementById("bmAttendancePill");
    if(!listEl || !emptyEl) return;

    var names = readBoardMemberNames(uid, cid);
    var att = readAttendance(uid, mid);

    // Prune attendance keys that no longer exist
    try{
      var keep = {};
      for(var j=0;j<names.length;j++) keep[names[j]] = true;
      var changed = false;
      Object.keys(att||{}).forEach(function(k){
        if(!keep[k]){ delete att[k]; changed = true; }
      });
      if(changed) writeAttendance(uid, mid, att);
    }catch(_e){}

    if(!names.length){
      listEl.innerHTML = "";
      emptyEl.style.display = "block";
      if(pillEl) pillEl.style.display = "none";
      return;
    }
    emptyEl.style.display = "none";

    var present = 0;
    var html = [];
    for(var i2=0;i2<names.length;i2++){
      var nm2 = names[i2];
      var checked = !!att[nm2];
      if(checked) present++;
      html.push(
        '<div class="bm-att-item" style="display:flex;align-items:center;gap:12px;" data-bm-att-name="' + esc(nm2) + '" role="button" tabindex="0" aria-label="Toggle attendance for ' + esc(nm2) + '">'
        + '<input type="checkbox" class="bm-att-check" style="margin:0;flex:0 0 auto;" data-bm-att-name="' + esc(nm2) + '" ' + (checked ? 'checked' : '') + ' />'
        + '<div style="display:flex;flex-direction:column;gap:2px;">'
        +   '<div class="bm-att-name" style="flex:1;">' + esc(nm2) + '</div>'
        + '</div>'
        + '</div>'
      );
    }
    listEl.innerHTML = html.join("");

    if(pillEl){
      pillEl.style.display = "inline-flex";
      pillEl.textContent = present + " / " + names.length + " present";
    }

    // Bind attendance toggles (delegated)
    if(!listEl.__bmBound){
      listEl.__bmBound = true;

      function commitToggle(name, isPresent){
        var uid3 = getUid();
        var mid3 = meetingId(uid3);
        var cur = readAttendance(uid3, mid3);
        cur[name] = !!isPresent;
        writeAttendance(uid3, mid3, cur);
        try{ renderAttendance(); }catch(_e){}
      }

      listEl.addEventListener("change", function(e){
        var t = e && e.target;
        if(!t) return;
        if(t && t.matches && t.matches('input[data-bm-att-name]')){
          var nm = t.getAttribute("data-bm-att-name");
          if(!nm) return;
          commitToggle(nm, !!t.checked);
        }
      });

      // Click anywhere on the row toggles the checkbox
      listEl.addEventListener("click", function(e){
        var t = e && e.target;
        if(!t) return;
        // If they clicked the checkbox itself, change handler covers it
        if(t.tagName === "INPUT") return;
        var item = t.closest ? t.closest(".bm-att-item") : null;
        if(!item) return;
        var nm = item.getAttribute("data-bm-att-name");
        if(!nm) return;
        var cb = item.querySelector('input[data-bm-att-name]');
        if(!cb) return;
        cb.checked = !cb.checked;
        commitToggle(nm, cb.checked);
      });

      // Keyboard access (Enter/Space)
      listEl.addEventListener("keydown", function(e){
        var t = e && e.target;
        if(!t) return;
        var isItem = t.classList && t.classList.contains("bm-att-item");
        if(!isItem) return;
        if(e.key === "Enter" || e.key === " "){
          e.preventDefault();
          var nm = t.getAttribute("data-bm-att-name");
          var cb = t.querySelector('input[data-bm-att-name]');
          if(!nm || !cb) return;
          cb.checked = !cb.checked;
          commitToggle(nm, cb.checked);
        }
      });
    }
  }


  function setMsg(msg, isErr){
    var el = document.getElementById("nbMsg");
    if(!el) return;
    if(!msg){ el.style.display="none"; el.textContent=""; el.classList.remove("error"); return; }
    el.style.display="block";
    el.textContent = msg;
    if(isErr) el.classList.add("error"); else el.classList.remove("error");
  }

  // Resize images to keep storage sane
  function fileToResizedDataUrl(file){
    return new Promise(function(resolve){
      try{
        if(!file || !file.type || file.type.indexOf("image/") !== 0){ resolve(null); return; }
        var fr = new FileReader();
        fr.onload = function(){
          try{
            var img = new Image();
            img.onload = function(){
              try{
                var max = 1280;
                var w = img.naturalWidth || img.width;
                var h = img.naturalHeight || img.height;
                var scale = Math.min(1, max / Math.max(w,h));
                var cw = Math.round(w*scale);
                var ch = Math.round(h*scale);
                var c = document.createElement("canvas");
                c.width = cw; c.height = ch;
                var ctx = c.getContext("2d");
                ctx.drawImage(img, 0, 0, cw, ch);
                var out = c.toDataURL("image/jpeg", 0.82);
                resolve(out);
              }catch(e3){ resolve(fr.result); }
            };
            img.onerror = function(){ resolve(fr.result); };
            img.src = String(fr.result||"");
          }catch(e2){ resolve(fr.result); }
        };
        fr.onerror = function(){ resolve(null); };
        fr.readAsDataURL(file);
      }catch(e){ resolve(null); }
    });
  }

    function readVendors(uid, cid){
    var st = readDailyOpsState(uid, cid);
    var rows = (st && st.data && st.data.vendors) ? st.data.vendors : [];
    rows = Array.isArray(rows) ? rows : [];
    var out = [];
    for(var i=0;i<rows.length;i++){
      var r = rows[i] || {};
      // Backward-compatible vendor fields
      var company = String(r.name || r.company || r.vendor || "").trim();
      if(!company) continue;

      var contact = String(r.contact || r.contactName || r.person || "").trim();
      var type = String(r.type || "").trim();
      var phone = String(r.phone || "").trim();
      var email = String(r.email || "").trim();
      var id = String(r._id || r.id || r.uuid || company).trim();

      // Display preference: "Company — Contact" (or fallback to type)
      var display = company;
      if(contact) display = company + " — " + contact;
      else if(type) display = company + " — " + type;

      out.push({ id:id, company:company, contact:contact, type:type, phone:phone, email:email, display:display });
    }
    out.sort(function(a,b){ return String(a.display||"").localeCompare(String(b.display||"")); });
    return out;
  }

  
  function showVendorPicker(vendors, currentId, onPick){
    try{
      // Remove any existing picker
      var existing = document.getElementById("zummeeVendorPicker");
      if(existing) existing.remove();

      var overlay = document.createElement("div");
      overlay.id = "zummeeVendorPicker";
      overlay.style.position = "fixed";
      overlay.style.left = "0";
      overlay.style.top = "0";
      overlay.style.right = "0";
      overlay.style.bottom = "0";
      overlay.style.background = "rgba(0,0,0,0.45)";
      overlay.style.zIndex = "9999";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.addEventListener("click", function(e){
        if(e.target === overlay) overlay.remove();
      });

      var panel = document.createElement("div");
      panel.style.background = "var(--panel, #fff)";
      panel.style.border = "1px solid rgba(0,0,0,0.12)";
      panel.style.borderRadius = "14px";
      panel.style.width = "min(520px, calc(100vw - 40px))";
      panel.style.boxShadow = "0 16px 40px rgba(0,0,0,0.25)";
      panel.style.padding = "14px";

      var h = document.createElement("div");
      h.textContent = "Assign Vendor";
      h.style.fontWeight = "900";
      h.style.fontSize = "16px";
      h.style.marginBottom = "10px";
      panel.appendChild(h);

      var label = document.createElement("div");
      label.textContent = "Select a vendor from Daily Ops";
      label.style.fontSize = "12px";
      label.style.color = "var(--muted)";
      label.style.marginBottom = "8px";
      panel.appendChild(label);

      var sel = document.createElement("select");
      sel.className = "input";
      sel.style.width = "100%";
      var opt0 = document.createElement("option");
      opt0.value = "";
      opt0.textContent = "— Choose Vendor —";
      sel.appendChild(opt0);

      for(var i=0;i<vendors.length;i++){
        var v = vendors[i] || {};
        var opt = document.createElement("option");
        opt.value = String(v.id || "");
        opt.textContent = String(v.display || v.company || "Vendor");
        sel.appendChild(opt);
      }
      if(currentId) sel.value = String(currentId);
      panel.appendChild(sel);

      var row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "flex-end";
      row.style.gap = "10px";
      row.style.marginTop = "12px";

      var btnCancel = document.createElement("button");
      btnCancel.className = "btn";
      btnCancel.type = "button";
      btnCancel.textContent = "Cancel";
      btnCancel.addEventListener("click", function(){ overlay.remove(); });

      var btnClear = document.createElement("button");
      btnClear.className = "btn";
      btnClear.type = "button";
      btnClear.textContent = "Clear Vendor";
      btnClear.addEventListener("click", function(){
        overlay.remove();
        onPick && onPick(null);
      });

      var btnSave = document.createElement("button");
      btnSave.className = "btn btn-primary";
      btnSave.type = "button";
      btnSave.textContent = "Assign";
      btnSave.addEventListener("click", function(){
        var chosenId = String(sel.value || "");
        if(!chosenId){
          alert("Please choose a vendor.");
          return;
        }
        var chosen = null;
        for(var j=0;j<vendors.length;j++){
          if(String(vendors[j] && vendors[j].id) === chosenId){ chosen = vendors[j]; break; }
        }
        overlay.remove();
        onPick && onPick(chosen);
      });

      row.appendChild(btnClear);
      row.appendChild(btnCancel);
      row.appendChild(btnSave);
      panel.appendChild(row);

      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      setTimeout(function(){ try{ sel.focus(); }catch(_e){} }, 50);
    }catch(_e){}
  }

function buildMailto(email, subject, body){
    var to = String(email||"").trim();
    if(!to) return "";
    var s = encodeURIComponent(subject||"");
    var b = encodeURIComponent(body||"");
    return "mailto:" + encodeURIComponent(to) + "?subject=" + s + "&body=" + b;
  }


  function buildMailtoBcc(bccList, subject, body){
    var bcc = Array.isArray(bccList) ? bccList.map(function(x){return String(x||"").trim();}) : [];
    var seen = {};
    bcc = bcc.filter(function(e){
      if(!e) return false;
      var k = e.toLowerCase();
      if(seen[k]) return false;
      seen[k] = 1;
      return true;
    });
    var s = encodeURIComponent(subject||"");
    var b = encodeURIComponent(body||"");
    var q = "subject=" + s + "&body=" + b;
    if(bcc.length) q = "bcc=" + encodeURIComponent(bcc.join(",")) + "&" + q;
    return "mailto:?" + q;
  }

    function renderVendorSelect(sel, vendors, placeholder){
    if(!sel) return;
    var cur = String(sel.value||"");
    sel.innerHTML = "";
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = placeholder || ((vendors && vendors.length) ? "Select a vendor" : "No vendors yet");
    sel.appendChild(o0);
    (vendors||[]).forEach(function(v){
      var o = document.createElement("option");
      o.value = String(v.id||"");
      o.textContent = String(v.display || v.name || v.company || "");
      sel.appendChild(o);
    });
    if(cur && (vendors||[]).some(function(v){ return String(v.id)===cur; })) sel.value = cur;
  }

    function refreshVendorDropdowns(){
    try{
      var uid = getUid();
      var cid = getSelectedCommunityId();
      var vendors = readVendors(uid, cid);
      var _nbVend = document.getElementById("nbVendor");
      if(_nbVend) renderVendorSelect(_nbVend, vendors, "Assign a vendor");
      renderVendorSelect(document.getElementById("nbBcc1"), vendors, "Select vendor 1");
      renderVendorSelect(document.getElementById("nbBcc2"), vendors, "Select vendor 2");
      renderVendorSelect(document.getElementById("nbBcc3"), vendors, "Select vendor 3");
      updateBccEnabled();
    }catch(e){}
  }

  function updateBccEnabled(){
    try{
      var s1 = document.getElementById("nbBcc1");
      var s2 = document.getElementById("nbBcc2");
      var s3 = document.getElementById("nbBcc3");
      if(!s1 || !s2 || !s3) return;

      // Enable Vendor 2 only after Vendor 1 chosen; same for Vendor 3.
      var v1 = String(s1.value||"").trim();
      var v2 = String(s2.value||"").trim();

      if(!v1){
        s2.value = "";
        s3.value = "";
      }
      if(!v2){
        s3.value = "";
      }

      s2.disabled = !String(s1.value||"").trim();
      s3.disabled = !String(s2.value||"").trim();
    }catch(e){}
  }

  function clearBccSelections(){
    try{
      var s1 = document.getElementById("nbBcc1");
      var s2 = document.getElementById("nbBcc2");
      var s3 = document.getElementById("nbBcc3");
      if(s1) s1.value = "";
      if(s2) s2.value = "";
      if(s3) s3.value = "";
      updateBccEnabled();
    }catch(e){}
  }

  function wireBccDropdowns(){
    try{
      var s1 = document.getElementById("nbBcc1");
      var s2 = document.getElementById("nbBcc2");
      var s3 = document.getElementById("nbBcc3");
      var clearBtn = document.getElementById("nbClearBcc");
      if(s1) s1.addEventListener("change", updateBccEnabled);
      if(s2) s2.addEventListener("change", updateBccEnabled);
      if(s3) s3.addEventListener("change", updateBccEnabled);
      if(clearBtn) clearBtn.addEventListener("click", function(){ clearBccSelections(); });
      updateBccEnabled();
    }catch(e){}
  }

  function getCommunityNameForHeader(cid){
    try{
      var commKey = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || "zummee_communities_v1";
      var raw = localStorage.getItem(commKey) || "[]";
      var comms = safeParse(raw) || [];
      if(Array.isArray(comms)){
        for(var i=0;i<comms.length;i++){
          var c = comms[i] || {};
          var id = String(c.id || c.community_id || c.value || c.key || "").trim();
          if(id && String(cid||"").trim()===id){
            var nm = String(c.name || c.community_name || c.label || c.title || "").trim();
            if(nm) return nm;
          }
        }
      }
    }catch(_e){}
    return String(cid||"");
  }

  function handleEmailBcc(){
    try{
      var uid = getUid();
      var cid = getSelectedCommunityId();
      if(!cid){ alert("Select a community first."); return; }
      var vendors = readVendors(uid, cid);
      function emailFor(selId){
        var id = String((document.getElementById(selId)||{}).value||"").trim();
        if(!id) return "";
        for(var i=0;i<vendors.length;i++){ if(String(vendors[i].id)===id) return String(vendors[i].email||"").trim(); }
        return "";
      }
      var emails = [emailFor("nbBcc1"), emailFor("nbBcc2"), emailFor("nbBcc3")].filter(function(x){ return String(x||"").trim(); });
      if(!emails.length){ alert("Choose at least one vendor with an email address (set vendor emails in Daily Ops → Vendors)." ); return; }

      var mid = meetingId(uid);
      var commName = getCommunityNameForHeader(cid);
      var beganIso = "";
      try{
        var m = (window.ZummeeMeetings && window.ZummeeMeetings.getCurrent && window.ZummeeMeetings.getCurrent()) || null;
        beganIso = (m && (m.started_at || m.began_at)) ? String(m.started_at || m.began_at) : "";
      }catch(_e){}
      var dateStr = "";
      try{
        var d = beganIso ? new Date(beganIso) : new Date();
        dateStr = d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"2-digit" });
      }catch(_e2){ dateStr = ""; }

      var subj = "Board Meeting – New Business" + (commName ? " – " + commName : "") + (dateStr ? " – " + dateStr : "");

      var items = readItems(uid, mid);
      var open = (items||[]).filter(function(it){ return !(it && it.closed); });
      var body = "Hello,\n\n";
      body += "We have the following New Business items.\n\n";
      if(open.length){
        for(var j=0;j<open.length;j++){
          var it = open[j] || {};
          var vnm = String(it.vendorName||"").trim();
          var note = String(it.note||"").trim();
          body += "• " + (vnm ? (vnm + ": ") : "") + (note || "(no note)") + "\n";
        }
      } else {
        body += "(No open items listed.)\n";
      }
      body += "\nThank you.\n";

      var link = buildMailtoBcc(emails, subj, body);
      window.location.href = link;
    }catch(e){
      console.error(e);
      alert("Could not prepare email.");
    }
  }

  // NEW BUSINESS: add item (supports photos + optional immediate email)
  async function handleAdd(doEmail){
    try{
    var uid = getUid();
    var cid = getSelectedCommunityId();
    var mid = meetingId(uid);

    // Block edits if meeting is archived/closed
    var meetingClosed = false;
    try{ meetingClosed = !!(window.ZummeeMeetings && window.ZummeeMeetings.isClosed && window.ZummeeMeetings.isClosed()); }catch(_e){}
    if(meetingClosed){ setMsg("Meeting is archived. Reopen it in Meeting History to edit.", true); return; }

    var vendors = readVendors(uid, cid);

    var noteEl = document.getElementById("nbNote");
    var vendEl = document.getElementById("nbVendor");
    var photosEl = (document.getElementById("nbPhotos")||document.getElementById("nbPhoto"));
    if(!noteEl || !photosEl){ setMsg("New Business form is missing fields.", true); return; }

    var note = String(noteEl.value||"").trim();
    var vendorId = vendEl ? String(vendEl.value||"").trim() : "";

    var v = null;
    if(vendorId){
      for(var i=0;i<vendors.length;i++){ if(String(vendors[i].id)===vendorId){ v = vendors[i]; break; } }
    }

    var files = Array.from(photosEl.files || []);
    if(!note && !files.length){ setMsg("Add a note or at least one photo.", true); return; }

    var photos = [];
    for(var f=0; f<files.length; f++){
      // eslint-disable-next-line no-await-in-loop
      var dataUrl = await fileToResizedDataUrl(files[f]);
      if(dataUrl) photos.push({ name: files[f].name || ("photo_"+f), dataUrl: dataUrl });
    }

    var items = readItems(uid, mid);
    var nowIso = new Date().toISOString();
    var created = {
      id: uid2(),
      createdAt: nowIso,
      updatedAt: nowIso,
      note: note,
      vendorId: vendorId,
      vendorName: v ? v.name : "",
      vendorEmail: v ? v.email : "",
      communityId: cid,
      communityName: (cid ? (function(id){
        try{
          var arr = safeJSONParse(localStorage.getItem("zummee_communities_v1")||"[]");
          if(Array.isArray(arr)){
            for(var i=0;i<arr.length;i++){
              var c=arr[i]||{};
              if(String(c.id||"")===String(id||"")) return String(c.name||c.communityName||"").trim();
            }
          }
        }catch(e){}
        return "";
      })(cid) : ""),
      photos: photos,
      closed: false,
      closedAt: "",
      emailPending: false,
      lastEmailedAt: "",
      updateLog: note ? [{ at: nowIso, note: "Created: " + note.slice(0, 160) + (note.length>160 ? "…" : "") }] : [{ at: nowIso, note: "Created item" }]
    };
    items.unshift(created);

    try{
      writeItems(uid, mid, items);
      try{ upsertCompanyItem(mid, created); }catch(_e){}
    }catch(e){
      setMsg("Could not save (storage full). Try fewer/smaller photos.", true);
      return;
    }

    // Clear form
    noteEl.value = "";
    if(vendEl) vendEl.value = "";
    photosEl.value = "";
    var prev = document.getElementById("nbPreview");
    if(prev) prev.innerHTML = "";

    setMsg("Added.", false);
    renderNewBusiness();

    if(doEmail){
      var email = String(created.vendorEmail||"").trim();
      if(!email){ setMsg("No vendor email found. Add it in Daily Ops → Vendors.", true); return; }

      // Stamp the "email attempt" so the user can track it even if offline.
      try{
        var emailStamp = new Date().toISOString();
        created.lastEmailedAt = emailStamp;
        created.emailPending = false;
        created.updatedAt = emailStamp;
        created.updateLog = Array.isArray(created.updateLog) ? created.updateLog : [];
        created.updateLog.push({ at: emailStamp, note: "Email prepared" + (created.vendorName ? (" for " + created.vendorName) : "") });
        if(Array.isArray(items) && items.length) items[0] = created;
        writeItems(uid, mid, items);
      }catch(_e){}

      var subj = "Board Meeting New Business";
      var startIso = readMeetingStartIso(uid);
      if(startIso) subj += " (Started " + fmtDT(startIso) + ")";
      var body = "New Business Item\n\n";
      if(created.note) body += created.note + "\n\n";
      body += "From: Zummee Board Meetings\n";
      var link = buildMailto(email, subj, body);
      if(link){
        try{
          var offline = (typeof navigator !== "undefined") ? !navigator.onLine : false;
          if(offline && window.ZummeeMeetings && window.ZummeeMeetings.queueEmail){
            window.ZummeeMeetings.queueEmail({ to: email, subject: subj, body: body, meeting_id: meetingId(uid) });
            setMsg("No internet detected. Email saved to Pending Emails.", false);
          }else{
            window.location.href = link;
          }
        }catch(_e2){
          window.location.href = link;
        }
      }
    }
    }catch(e){
      try{ console.error(e); }catch(_e){}
      setMsg("Could not add item: " + (e && e.message ? e.message : String(e)), true);
      return;
    }
  }

  function renderNewBusiness(){
    
    try{ var o=document.getElementById("nbOpenList"); if(o) o.innerHTML=""; }catch(_e){}
var uid = getUid();
    var mid = meetingId(uid);
    var cid = (function(){
      try{
        var sel=document.getElementById("zummeeCommunitySelect");
        if(sel && sel.value) return String(sel.value).trim();
      }catch(e){}
      try{
        return String(getSelectedCommunityId&&getSelectedCommunityId()||"").trim();
      }catch(e2){}
      return "";
    })();
    // Prefer company-wide store so Monthly Action Items stays in sync
    var items = window.readNewBizCompany(mid);
    if(!items || !items.length){ items = window.readNewBizUser(uid, mid); }
    if(cid){ items = (items||[]).filter(function(it){ return it && String(it.communityId||"")===cid; }); }

    var openWrap = document.getElementById("nbOpen");
    var closedWrap = document.getElementById("nbClosed");
    var openPill = document.getElementById("nbOpenPill");
    var closedPill = document.getElementById("nbClosedPill");
    if(!openWrap || !closedWrap) return;

    var open = [];
    var closed = [];
    for(var i=0;i<items.length;i++){
      (items[i] && items[i].closed) ? closed.push(items[i]) : open.push(items[i]);
    }

    function card(it, isClosed){
      var div = document.createElement("div");
      div.className = "nb-item " + (isClosed ? "nb-closed" : "nb-open");
      div.setAttribute("data-id", it.id);

      var top = document.createElement("div");
      top.className = "nb-item-top";
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      top.style.gap = "10px";

      var left = document.createElement("div");
      left.style.minWidth = "0";

      var title = document.createElement("div");
      title.style.fontWeight = "900";
      title.textContent = it.vendorName ? it.vendorName : "Unassigned Vendor";
      left.appendChild(title);

      var meta = document.createElement("div");
      meta.style.fontSize = "12px";
      meta.style.color = "var(--muted)";
      meta.textContent = (it.updatedAt ? ("Updated " + fmtDT(it.updatedAt)) : "");
      left.appendChild(meta);

      var actions = document.createElement("div");
      actions.style.display = "flex";
      actions.style.flexWrap = "wrap";
      actions.style.gap = "8px";
      actions.style.justifyContent = "flex-end";

      var btnAssign = document.createElement("button");
      btnAssign.className = "btn";
      btnAssign.type = "button";
      btnAssign.textContent = "Assign Vendor";
      btnAssign.setAttribute("data-action","assignVendor");
      btnAssign.setAttribute("data-id", it.id);

      var btnEmail = document.createElement("button");
      btnEmail.className = "btn";
      btnEmail.type = "button";
      btnEmail.textContent = "Email Vendor";
      btnEmail.setAttribute("data-action","email");
      btnEmail.setAttribute("data-id", it.id);

      var btnEdit = document.createElement("button");
      btnEdit.className = "btn";
      btnEdit.type = "button";
      btnEdit.textContent = "Add Update";
      btnEdit.setAttribute("data-action","edit");
      btnEdit.setAttribute("data-id", it.id);

      var btnToggle = document.createElement("button");
      btnToggle.className = "btn";
      btnToggle.type = "button";
      btnToggle.textContent = isClosed ? "Reopen" : "Complete";
      btnToggle.setAttribute("data-action", isClosed ? "reopen" : "complete");
      btnToggle.setAttribute("data-id", it.id);

      var btnDelete = document.createElement("button");
      btnDelete.className = "btn";
      btnDelete.type = "button";
      btnDelete.textContent = "Delete";
      btnDelete.setAttribute("data-action","delete");
      btnDelete.setAttribute("data-id", it.id);

      actions.appendChild(btnAssign);
      actions.appendChild(btnEmail);
      actions.appendChild(btnEdit);
      actions.appendChild(btnToggle);
      actions.appendChild(btnDelete);

      top.appendChild(left);
      top.appendChild(actions);
      div.appendChild(top);

      if(it.note){
        var p = document.createElement("div");
        p.style.marginTop = "8px";
        // Preserve line breaks so each update appears on its own line.
        p.style.whiteSpace = "pre-line";
        p.textContent = it.note;
        div.appendChild(p);
      }

      if(Array.isArray(it.photos) && it.photos.length){
        var ph = document.createElement("div");
        ph.style.marginTop = "10px";
        ph.style.display = "flex";
        ph.style.gap = "8px";
        ph.style.flexWrap = "wrap";
        it.photos.slice(0,6).forEach(function(pp){
          var im = document.createElement("img");
          im.src = pp.dataUrl;
          im.className = "nb-thumb";
          ph.appendChild(im);
        });
        div.appendChild(ph);
      }

      return div;
    }

    openWrap.innerHTML = "";
    closedWrap.innerHTML = "";
    open.forEach(function(it){ openWrap.appendChild(card(it,false)); });
    closed.forEach(function(it){ closedWrap.appendChild(card(it,true)); });

    if(openPill){ openPill.style.display = open.length ? "inline-flex" : "none"; openPill.textContent = open.length + " open"; }
    if(closedPill){ closedPill.style.display = closed.length ? "inline-flex" : "none"; closedPill.textContent = closed.length + " closed"; }
  }

  function handleClearForm(){
    setMsg("", false);
    var noteEl = document.getElementById("nbNote");
    var vendEl = document.getElementById("nbVendor");
    var photosEl = (document.getElementById("nbPhotos")||document.getElementById("nbPhoto"));
    if(noteEl) noteEl.value = "";
    if(vendEl) vendEl.value = "";
    if(photosEl) photosEl.value = "";
    var prev = document.getElementById("nbPreview");
    if(prev) prev.innerHTML = "";
  }

  
  function handleAction(e){
    var t = e.target && e.target.closest ? e.target.closest("[data-action]") : null;
    if(!t) return;

    var action = t.getAttribute("data-action");
    // Buttons live inside a card that carries the item id; keep this robust even if the id
    // isn't on the button itself.
    var id = t.getAttribute("data-id");
    if(!id){
      var host = t.closest ? t.closest('.nb-item[data-id]') : null;
      if(host) id = host.getAttribute('data-id');
    }
    var uid = getUid();
    var mid = meetingId(uid);
    var meetingClosed = false;
    try{ meetingClosed = !!(window.ZummeeMeetings && window.ZummeeMeetings.isClosed && window.ZummeeMeetings.isClosed()); }catch(_e){}
    var cid = getSelectedCommunityId();

    var items = readItems(uid, mid);
    var idx = -1;
    for(var i=0;i<items.length;i++){ if(String(items[i] && items[i].id) === String(id)) { idx = i; break; } }
    if(idx < 0) return;

    // Some actions are on inputs (checkbox) where preventDefault would block toggling,
    // so only prevent default on links/buttons.
    if(t.tagName === "A" || t.tagName === "BUTTON") e.preventDefault();

    function stamp(note){
      try{
        var now = new Date().toISOString();
        items[idx].updatedAt = now;
        items[idx].updateLog = Array.isArray(items[idx].updateLog) ? items[idx].updateLog : [];
        items[idx].updateLog.push({ at: now, note: String(note||"Updated") });
      }catch(_e){}
    }
    if(action === "assignVendor"){
      if(meetingClosed){
        alert("This meeting is ended. Reopen the meeting to make changes.");
        return;
      }
      if(!cid){
        alert("Please select a Community first.");
        return;
      }
      var vendorsList = readVendors(uid, cid);
      if(!vendorsList.length){
        alert("No vendors found. Add vendors on Daily Ops → Vendors, then try again.");
        return;
      }
      showVendorPicker(vendorsList, items[idx].vendorId, function(v){
        // Clear vendor
        if(!v){
          items[idx].vendorId = "";
          items[idx].vendorName = "";
          items[idx].vendorEmail = "";
          stamp("Cleared vendor");
          writeItems(uid, mid, items);
          renderNewBusiness();
          return;
        }
        items[idx].vendorId = String(v.id || "");
        items[idx].vendorName = String(v.display || v.name || v.company || "");
        items[idx].vendorEmail = String(v.email || "");
        stamp("Assigned vendor: " + (items[idx].vendorName || "Vendor"));
        writeItems(uid, mid, items);
        renderNewBusiness();
      });
      return;
    }



    if(action === "toggleEdit"){
      var edit = document.querySelector('.nb-edit[data-edit="'+ String(id).replace(/"/g,'&quot;') +'"]');
      if(edit){
        var isOpen = edit.style.display !== "none";
        edit.style.display = isOpen ? "none" : "block";
        if(!isOpen){
          // hydrate vendor select with current value
          var sel = edit.querySelector('select[data-field="vendorId"][data-id="'+ id +'"]');
          if(sel) sel.value = String(items[idx].vendorId || "");

          // hydrate note textarea with the current note so "Add Update" cannot accidentally
          // overwrite existing lines due to an empty textarea.
          var ta = edit.querySelector('textarea[data-field="note"][data-id="'+ id +'"]');
          if(ta){
            var curNote = String(items[idx].note || "");
            ta.value = curNote;
            ta.setAttribute('data-orig', curNote);
          }
        }
      }
      return;
    }

    if(action === "cancelEdit"){
      var edit2 = document.querySelector('.nb-edit[data-edit="'+ String(id).replace(/"/g,'&quot;') +'"]');
      if(edit2) edit2.style.display = "none";
      return;
    }

    if(action === "saveEdit"){
      var wrap = document.querySelector('.nb-item[data-id="'+ String(id).replace(/"/g,'&quot;') +'"]');
      if(!wrap) return;

      var newNoteEl = wrap.querySelector('textarea[data-field="note"][data-id="'+ id +'"]');
      var updNoteEl = wrap.querySelector('input[data-field="updateNote"][data-id="'+ id +'"]');
      var vendSel   = wrap.querySelector('select[data-field="vendorId"][data-id="'+ id +'"]');

      // IMPORTANT: Preserve existing history.
      // Use a "data-orig" snapshot (set when opening the editor) so an unhydrated/empty
      // textarea can't accidentally overwrite existing notes.
      var origNote = newNoteEl ? String(newNoteEl.getAttribute('data-orig') || String(items[idx].note||"")) : String(items[idx].note||"");
      var newNoteRaw = newNoteEl ? String(newNoteEl.value||"") : String(items[idx].note||"");
      var updNote = updNoteEl ? String(updNoteEl.value||"").trim() : "";
      var newVendorId = vendSel ? String(vendSel.value||"").trim() : String(items[idx].vendorId||"");

      // Apply vendor change
      var vendors = readVendors(uid, cid);

    // Disable editing when meeting is archived/closed
      var v = null;
      if(newVendorId){
        for(var j=0;j<vendors.length;j++){ if(String(vendors[j].id)===String(newVendorId)){ v = vendors[j]; break; } }
      }

      var changed = false;
      var noteChanged = (newNoteRaw !== origNote);
      if(noteChanged) { items[idx].note = newNoteRaw; changed = true; }
      if(newVendorId !== String(items[idx].vendorId||"")) {
        items[idx].vendorId = newVendorId;
        items[idx].vendorName = v ? v.name : "";
        items[idx].vendorEmail = v ? v.email : "";
        changed = true;
      }

      if(!changed && !updNote){
        setMsg("No changes to save.", true);
        return;
      }

      // "Add Update" should append a new line (with timestamp) rather than overwriting prior notes.
      if(updNote){
        var nowIso2 = new Date().toISOString();
        var line = "• " + fmtDT(nowIso2) + " — " + updNote;
        var base = String(items[idx].note || "");
        // Trim trailing whitespace so updates stack neatly.
        base = base.replace(/\s+$/,"");
        items[idx].note = base ? (base + "\n\n" + line) : line;
        if(newNoteEl) newNoteEl.value = items[idx].note;
        stamp("Update added");
      } else {
        stamp(changed ? "Updated item" : "Update note added");
      }
      writeItems(uid, mid, items);

      if(updNoteEl) updNoteEl.value = "";
setMsg("Updated.", false);
      renderNewBusiness();
      return;
    }

    // Lightweight edit for stable builds: prompt for a revised note.
    // Also stamps the update time so the change is visible in the list.
    if(action === "edit"){
      // Append-only updates: preserve all prior activity on the record.
      var upd = prompt("Add update (appends with timestamp):");
      if(upd === null) return; // cancelled
      upd = String(upd || "").trim();
      if(!upd){ setMsg("No update entered.", true); return; }

      var nowIso = new Date().toISOString();
      var line = "• " + fmtDT(nowIso) + " — " + upd;
      var base = String(items[idx].note || "");
      base = base.replace(/\s+$/,"");
      items[idx].note = base ? (base + "\n\n" + line) : line;
      stamp("Update added");
      writeItems(uid, mid, items);
      setMsg("Updated.", false);
      renderNewBusiness();
      return;
    }

    if(action === "queueEmail"){
      items[idx].emailPending = true;
      stamp("Marked email pending");
      writeItems(uid, mid, items);
      renderNewBusiness();
      return;
    }

    if(action === "complete"){
      // This is a button (not a checkbox). Clicking completes the item.
      items[idx].closed = true;
      items[idx].closedAt = new Date().toISOString();
      stamp("Marked complete");
      writeItems(uid, mid, items);
      renderNewBusiness();
      return;
    }

    if(action === "reopen"){
      items[idx].closed = false;
      try{ delete items[idx].closedAt; }catch(_e3){}
      stamp("Reopened");
      writeItems(uid, mid, items);
      renderNewBusiness();
      return;
    }

    if(action === "delete"){
      if(!confirm("Delete this item? This cannot be undone.")) return;
      items.splice(idx, 1);
      writeItems(uid, mid, items);
      renderNewBusiness();
      return;
    }

    if(action === "email"){
      var it = items[idx] || {};
      var vendors2 = readVendors(uid, cid);
      var v2 = null;
      if(it.vendorId){
        for(var k=0;k<vendors2.length;k++){ if(String(vendors2[k].id)===String(it.vendorId)){ v2 = vendors2[k]; break; } }
      }
      var email = String(it.vendorEmail || (v2 ? v2.email : "") || "").trim();
      if(!email){ setMsg("No vendor email found. Add it in Daily Ops → Vendors.", true); return; }

      // Stamp the attempt (supports offline workflow)
      try{
        var now2 = new Date().toISOString();
        items[idx].lastEmailedAt = now2;
        items[idx].emailPending = false;
        stamp("Email prepared");
        writeItems(uid, mid, items);
      }catch(_e2){}

      var subj = "Board Meeting New Business";
      var startIso = readMeetingStartIso(uid);
      if(startIso) subj += " (Started " + fmtDT(startIso) + ")";
      var body = "New Business Item\n\n";
      if(it.note) body += it.note + "\n\n";
      body += "From: Zummee Board Meetings\n";
      var link = buildMailto(email, subj, body);
      if(link){
        try{
          var offline = (typeof navigator !== "undefined") ? !navigator.onLine : false;
          if(offline && window.ZummeeMeetings && window.ZummeeMeetings.queueEmail){
            window.ZummeeMeetings.queueEmail({ to: email, subject: subj, body: body, meeting_id: meetingId(uid) });
            setMsg("No internet detected. Email saved to Pending Emails.", false);
          }else{
            window.location.href = link;
          }
        }catch(_e){
          window.location.href = link;
        }
      }
      return;
    }
  }

  function handlePhotoPreview(){
    var photosEl = (document.getElementById("nbPhotos")||document.getElementById("nbPhoto"));
    var prev = document.getElementById("nbPreview");
    if(!photosEl || !prev) return;
    prev.innerHTML = "";
    var files = Array.from(photosEl.files || []);
    if(!files.length) return;
    files.slice(0, 12).forEach(function(f){
      try{
        var img = document.createElement("div");
        img.className = "nb-thumb";
        img.style.display = "grid";
        img.style.placeItems = "center";
        img.style.fontSize = "10px";
        img.style.fontWeight = "900";
        img.style.color = "var(--muted)";
        img.textContent = "Loading…";
        prev.appendChild(img);
        fileToResizedDataUrl(f).then(function(dataUrl){
          if(!dataUrl) { img.textContent = "(error)"; return; }
          var im = document.createElement("img");
          im.src = dataUrl;
          im.className = "nb-thumb";
          img.replaceWith(im);
        });
      }catch(e){}
    });
  }

  function initNewBusiness(){
    // Bind events in a way that still works even if DOMContentLoaded has already fired.
    var add = document.getElementById("nbAdd");
    var addEmail = document.getElementById("nbAddEmail");
    var clear = document.getElementById("nbClearForm");
    var emailBcc = document.getElementById("nbEmailBcc");
    var photos = (document.getElementById("nbPhotos")||document.getElementById("nbPhoto"));
    var openWrap = document.getElementById("nbOpen");
    var closedWrap = document.getElementById("nbClosed");

    // Avoid double-binding if init runs more than once.
    function once(el, ev, fn){
      if(!el) return;
      var key = "__bmBound_" + ev;
      if(el[key]) return;
      el.addEventListener(ev, fn);
      el[key] = true;
    }

    once(add, "click", function(){ handleAdd(false); });
    once(addEmail, "click", function(){ handleAdd(true); });
    once(clear, "click", handleClearForm);
    once(emailBcc, "click", handleEmailBcc);
    once(photos, "change", handlePhotoPreview);
    once(openWrap, "click", handleAction);
    once(closedWrap, "click", handleAction);

    refreshVendorDropdowns();
    wireBccDropdowns();
    renderNewBusiness();
    window.addEventListener("zummee:meeting-changed", function(){
      try{ refreshVendorDropdowns(); }catch(_e0){}
      try{ updateBccEnabled(); }catch(_e0b){}
      try{ renderNewBusiness(); }catch(_e){}
      try{ renderAttendance(); }catch(_e2){}
    });
  }

  function initAttendance(){
    renderAttendance();
    // Re-render when Daily Ops/Community/Meeting changes (lightweight signature watch)
    setInterval(function(){
      try{
        var sig = getUid() + "|" + getSelectedCommunityId() + "|" + meetingId(getUid());
        if(window.__bmAttSig !== sig){
          window.__bmAttSig = sig;
          renderAttendance();
        }
      }catch(e){}
    }, 1400);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", function(){ initAttendance(); initNewBusiness(); });
  }else{
    initAttendance();
    initNewBusiness();
  }

  // Refresh vendors/new business if Daily Ops changes / community changes
  setInterval(function(){
    try{
      var sig = getUid() + "|" + getSelectedCommunityId() + "|" + meetingId(getUid());
      if(window.__bmNbSig !== sig){
        window.__bmNbSig = sig;
        try{ refreshVendorDropdowns(); }catch(_e0){}
      try{ updateBccEnabled(); }catch(_e0b){}
        renderNewBusiness();
      }
    }catch(e){}
  }, 1400);
})();

;

(function(){
  // --- Supabase bootstrap (matches other pages) ---
  var SUPABASE_URL = "https://slcwuuwyrgnmlmxpcaim.supabase.co";
  var SUPABASE_KEY = "sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864";
  function ensureSupabase(){
    if(window.sb) return window.sb;
    if(!window.supabase || !window.supabase.createClient) throw new Error("Supabase not loaded");
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storageKey:'sb-zummee-auth', storage: window.localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true  }
    });
    return window.sb;
  }

  // Initialize the client immediately so other modules (sync badge, etc.)
  // can detect cloud availability without needing to call ensureSupabase().
  try{ ensureSupabase(); }catch(_e){ /* fall back to local-only */ }

  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }
  function getUid(){
    // Prefer the same auth token key used across the app
    try{
      var k = "sb-slcwuuwyrgnmlmxpcaim-auth-token";
      var raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if(raw){
        var obj = JSON.parse(raw);
        if(obj && obj.user && obj.user.id) return obj.user.id;
      }
    }catch(_e){}
    // Fallback to ZummeeAuth session
    try{
      var sk = "zummee_session_v1";
      var ses = safeParse(sessionStorage.getItem(sk) || localStorage.getItem(sk) || "");
      if(ses && ses.userId) return ses.userId;
    }catch(_e2){}
    return "";
  }

  function licenseKey(uid){ return "zummee_license_info_v1__user__" + (uid||"anon"); }
  function readLicense(uid){
    try{ return safeParse(localStorage.getItem(licenseKey(uid))||"{}") || {}; }catch(e){ return {}; }
  }
  function writeLicense(uid, data){
    try{ localStorage.setItem(licenseKey(uid), JSON.stringify(data||{})); }catch(e){}
  }

  function setLocked(locked){
    var type = document.getElementById("miLicenseType");
    var num = document.getElementById("miLicenseNumber");
    var exp = document.getElementById("miLicenseExp");
    var btn = document.getElementById("miLicenseLock");
    var pill = document.getElementById("miLockState");
    var hasType = !!(type && String(type.value||"").trim());
    // License type is always selectable; only the license details are lockable.
    if(num) num.disabled = !hasType ? true : !!locked;
    if(exp) exp.disabled = !hasType ? true : !!locked;
    if(btn){
      btn.disabled = !hasType;
      btn.style.opacity = hasType ? "1" : "0.55";
      btn.style.cursor = hasType ? "pointer" : "not-allowed";
      btn.textContent = locked ? "Unlock" : "Lock";
    }
    if(pill){
      pill.textContent = locked ? "Locked" : "Editing";
      pill.classList.toggle("locked", !!locked);
    }
  }

  async function loadName(uid){
    var el = document.getElementById("miName");
    if(!el) return;
    try{
      var sb = ensureSupabase();
      var q = await sb.from("profiles").select("*").eq("id", uid).maybeSingle();
      var nm = (q && q.data && q.data.name ? String(q.data.name) : "").trim();
      el.textContent = nm || "(Name not set in Profile)";
    }catch(_e){
      el.textContent = "(Name not available)";
    }
  }

  function hydrate(uid){
    var data = readLicense(uid);
    var type = document.getElementById("miLicenseType");
    var num = document.getElementById("miLicenseNumber");
    var exp = document.getElementById("miLicenseExp");
    if(type) type.value = data.licenseType || "";
    if(num) num.value = data.licenseNumber || "";
    if(exp) exp.value = data.licenseExp || "";
    setLocked(data.locked !== false); // default locked
  }

  function bind(uid){
    var type = document.getElementById("miLicenseType");
    var num = document.getElementById("miLicenseNumber");
    var exp = document.getElementById("miLicenseExp");
    var btn = document.getElementById("miLicenseLock");

    function savePartial(){
      var cur = readLicense(uid);
      cur.licenseType = type ? String(type.value||"") : (cur.licenseType||"");
      cur.licenseNumber = num ? String(num.value||"").trim() : (cur.licenseNumber||"");
      cur.licenseExp = exp ? String(exp.value||"") : (cur.licenseExp||"");
      writeLicense(uid, cur);
    }

    [type,num,exp].forEach(function(el){
      if(!el) return;
      el.addEventListener("change", function(){
        savePartial();
        // Re-evaluate lock gating when license type changes
        var cur = readLicense(uid);
        setLocked(cur.locked !== false);
      });
      el.addEventListener("blur", savePartial);
    });

    if(btn){
      btn.addEventListener("click", function(){
        var cur = readLicense(uid);
        // If no license type, do nothing
        if(!cur.licenseType) return;
        var nextLocked = !(cur.locked !== false); // if currently unlocked, lock; else unlock
        // When locking, persist the latest values.
        if(nextLocked){ savePartial(); }
        cur = readLicense(uid);
        cur.locked = nextLocked;
        writeLicense(uid, cur);
        setLocked(nextLocked);
      });
    }
  }

  // --- CE Credits ---
  function ceKey(uid){ return "zummee_ce_credits_v1__user__" + (uid||"anon"); }

  function ceClassesKey(uid){ return "zummee_ce_classes_v1__user__" + (uid||"anon"); }
  function readCeClasses(uid){
    try{ return safeParse(localStorage.getItem(ceClassesKey(uid))||"[]") || []; }catch(e){ return []; }
  }
  function writeCeClasses(uid, arr){
    try{ localStorage.setItem(ceClassesKey(uid), JSON.stringify(arr||[])); }catch(e){}
  }

  function readCE(uid){
    try{ return safeParse(localStorage.getItem(ceKey(uid))||"{}") || {}; }catch(e){ return {}; }
  }
  function writeCE(uid, data){
    try{ localStorage.setItem(ceKey(uid), JSON.stringify(data||{})); }catch(e){}
  }

  function sanitizeNumber(raw){
    var s = String(raw||"").trim();
    if(!s) return null;
    s = s.replace(/[^\d.]/g,"");
    if(!s) return null;
    var parts = s.split(".");
    if(parts.length>2){ s = parts[0] + "." + parts.slice(1).join(""); }
    if(s === ".") return null;
    var n = Number(s);
    if(!isFinite(n)) return null;
    n = Math.round(n*100)/100;
    return n;
  }
  function fmtNumber(n){
    if(n==null || !isFinite(n)) return "";
    return (Math.round(n) === n) ? String(n.toFixed(0)) : String(n);
  }
  function parseCredits(val){
    return sanitizeNumber(val);
  }

  function showMsg(id, txt, isErr){
    var el = document.getElementById(id);
    if(!el) return;
    if(!txt){ el.style.display = "none"; el.textContent = ""; el.classList.remove("error"); return; }
    el.style.display = "block";
    el.textContent = txt;
    el.classList.toggle("error", !!isErr);
  }

  function ceRecalc(uid){
    var ce = readCE(uid);
    var t = Number(ce.target || 0);
    var c = Number(ce.current || 0);
    if(!isFinite(t)) t = 0;
    if(!isFinite(c)) c = 0;
    var rem = t - c;
    if(rem < 0) rem = 0;
    var remEl = document.getElementById("ceRemaining");
    if(remEl) remEl.value = String(rem);
  }

  function ceSetTargetLocked(locked){
    var target = document.getElementById("ceTarget");
    var btn = document.getElementById("ceTargetLockBtn");
    var pill = document.getElementById("ceTargetLockState");
    if(target) target.disabled = !!locked;
    if(btn) btn.textContent = locked ? "Unlock target" : "Lock target";
    if(pill){
      pill.textContent = locked ? "Target locked" : "Editing target";
      pill.classList.toggle("locked", !!locked);
    }
  }

  function ceHydrate(uid){
    var ce = readCE(uid);
    var target = document.getElementById("ceTarget");
    var current = document.getElementById("ceCurrent");
    if(target) target.value = (ce.target != null && ce.target !== "") ? String(ce.target) : "";
    if(current) current.value = (ce.current != null && ce.current !== "") ? String(ce.current) : "";
    var shouldLock = (ce.targetLocked === true) || ((ce.target != null && ce.target !== "") && ce.targetLocked !== false);
    // If no target set yet, start unlocked so they can enter it.
    if(!(ce.target != null && ce.target !== "")) shouldLock = false;
    ce.targetLocked = shouldLock;
    writeCE(uid, ce);
    ceSetTargetLocked(shouldLock);
    ceRecalc(uid);
  }

  function ceBind(uid){
    var target = document.getElementById("ceTarget");
    var current = document.getElementById("ceCurrent");
    var add = document.getElementById("ceAddHours");
    var addBtn = document.getElementById("ceAddBtn");
    var lockBtn = document.getElementById("ceTargetLockBtn");

    function saveCE(){
      var ce = readCE(uid);

      // Target
      var tVal = parseCredits(target ? target.value : "");
      if(tVal === null){
        ce.target = "";
      }else{
        ce.target = tVal;
      }

      // Current
      var cVal = parseCredits(current ? current.value : "");
      if(cVal === null){
        ce.current = "";
      }else{
        ce.current = cVal;
      }

      writeCE(uid, ce);
      ceRecalc(uid);
    }

    function validateTarget(){
      if(!target) return true;
      var raw = String(target.value||"").trim();
      if(!raw){ showMsg("ceTargetMsg", "", false); return true; }
      var n = parseCredits(raw);
      if(n === null){ showMsg("ceTargetMsg", "Enter a number.", true); return false; }
      showMsg("ceTargetMsg", "", false);
      target.value = fmtNumber(n);
      return true;
    }

    function validateCurrent(){
      if(!current) return true;
      var raw = String(current.value||"").trim();
      if(!raw){ showMsg("ceCurrentMsg", "", false); return true; }
      var n = parseCredits(raw);
      if(n === null){ showMsg("ceCurrentMsg", "Enter a number.", true); return false; }
      showMsg("ceCurrentMsg", "", false);
      current.value = fmtNumber(n);
      return true;
    }

    function validateAdd(){
      if(!add) return false;
      var raw = String(add.value||"").trim();
      if(!raw){ showMsg("ceAddMsg", "Enter credit hours to add.", true); return false; }
      var n = parseCredits(raw);
      if(n === null || n <= 0){ showMsg("ceAddMsg", "Enter a number greater than 0.", true); return false; }
      showMsg("ceAddMsg", "", false);
      add.value = fmtNumber(n);
      return true;
    }

    if(target){
      target.addEventListener("blur", function(){
        if(validateTarget()) saveCE();
      });
      target.addEventListener("change", function(){
        validateTarget();
        saveCE();
      });
      target.addEventListener("input", function(){
        showMsg("ceTargetMsg", "", false);
      });
    }

    if(current){
      current.addEventListener("blur", function(){
        if(validateCurrent()) saveCE();
      });
      current.addEventListener("change", function(){
        validateCurrent();
        saveCE();
      });
      current.addEventListener("input", function(){
        showMsg("ceCurrentMsg", "", false);
      });
    }

    if(add){
      add.addEventListener("input", function(){ showMsg("ceAddMsg", "", false); });
      add.addEventListener("keydown", function(e){
        if(e.key === "Enter"){
          e.preventDefault();
          if(addBtn) addBtn.click();
        }
      });
    }

    if(addBtn){
      addBtn.addEventListener("click", function(){
        if(!validateCurrent()) return;
        if(!validateAdd()) return;
        var ce = readCE(uid);
        var addN = parseCredits(add.value);
        var cur = parseCredits(current ? current.value : "") || 0;
        var next = cur + addN;
        ce.current = next;
        ce.history = Array.isArray(ce.history) ? ce.history : [];
        ce.history.unshift({ ts: Date.now(), added: addN });
        writeCE(uid, ce);
        if(current) current.value = fmtNumber(next);
        if(add) add.value = "";
        ceRecalc(uid);
      });
    }

    if(lockBtn){
      lockBtn.addEventListener("click", function(){
        var ce = readCE(uid);
        // Can't lock without a valid target
        if(!validateTarget()) return;
        var tVal = parseCredits(target ? target.value : "");
        if(tVal === null){
          showMsg("ceTargetMsg", "Enter a target before locking.", true);
          return;
        }
        ce.target = tVal;
        var nextLocked = !(ce.targetLocked === true);
        ce.targetLocked = nextLocked;
        writeCE(uid, ce);
        ceSetTargetLocked(nextLocked);
        ceRecalc(uid);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    var uid = getUid();
    if(!uid) return;
    loadName(uid);
    hydrate(uid);
    bind(uid);

    // CE Credits
    ceHydrate(uid);
    ceBind(uid);
  });
})();

;

// --- Homeowner Open Forum (meeting-scoped, offline-first; multiple entries) ---
(function(){
  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }

  function getUid(){
    try{ if(window.ZummeeAuth && window.ZummeeAuth.getUserId){ return window.ZummeeAuth.getUserId() || ""; } }catch(_e){}
    try{ return String(localStorage.getItem("zummee_user_id_v1")||"").trim(); }catch(_e2){ return ""; }
  }
  function getMid(){
    try{ if(window.ZummeeMeetings && window.ZummeeMeetings.getCurrentId){ return window.ZummeeMeetings.getCurrentId() || ""; } }catch(_e){}
    var d=new Date();
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+day;
  }

  function key(uid, mid){
    uid = String(uid||"anon");
    mid = String(mid||"");
    return "zummee_board_meeting_open_forum_v1__user__"+uid+"__meeting__"+mid;
  }

  var entriesWrap = document.getElementById("hofEntries");
  var addBtn = document.getElementById("hofAddEntry");
  var saveBtn = document.getElementById("hofSaveAll");
  var clearBtn = document.getElementById("hofClearAll");
  var status = document.getElementById("hofStatus");
  var updatedPill = document.getElementById("hofUpdated");
  if(!entriesWrap || !addBtn || !saveBtn || !clearBtn) return;

  function setStatus(msg){
    if(!status) return;
    status.textContent = msg;
    clearTimeout(window.__hofStatusT);
    window.__hofStatusT = setTimeout(function(){ status.textContent=""; }, 1800);
  }

  function renderUpdated(ts){
    if(!updatedPill) return;
    if(!ts){ updatedPill.style.display="none"; updatedPill.textContent=""; return; }
    try{
      var d = new Date(ts);
      updatedPill.textContent = "Last updated: " + d.toLocaleString();
      updatedPill.style.display = "inline-flex";
    }catch(_e){
      updatedPill.textContent = "Last updated";
      updatedPill.style.display = "inline-flex";
    }
  }

  function uidNow(){
    return (Date.now().toString(36) + Math.random().toString(36).slice(2,8)).toUpperCase();
  }

  function normalize(raw){
    // Back-compat: previously stored as {note, motionMade, motionApproved, ...}
    if(raw && Array.isArray(raw.entries)) return raw;
    if(raw && (raw.note || raw.motionMade || raw.motionApproved)){
      return {
        entries: [{
          id: uidNow(),
          name: "",
          note: String(raw.note||""),
          motionMade: !!raw.motionMade,
          motionApproved: !!raw.motionApproved,
          motionText: String(raw.motionText||raw.motion||""),
          updated_at: raw.updated_at || "",
          updates: Array.isArray(raw.updates) ? raw.updates : []
        }],
        updated_at: raw.updated_at || ""
      };
    }
    return { entries: [], updated_at: "" };
  }

  function readState(uid, mid){
    var obj = {};
    try{ obj = safeParse(localStorage.getItem(key(uid,mid))||"") || {}; }catch(_e){}
    return normalize(obj);
  }

  function writeState(uid, mid, state){
    try{ localStorage.setItem(key(uid,mid), JSON.stringify(state)); return true; }catch(_e){ return false; }
  }

  function rowTpl(entry, idx){
    var safeName = String(entry.name||"");
    var safeNote = String(entry.note||"");
    var safeMotionText = String(entry.motionText||entry.motion||"");
    var mm = entry.motionMade ? "checked" : "";
    var ma = entry.motionApproved ? "checked" : "";
    return ''+
      '<div class="nb-item" data-hof-id="'+entry.id+'" style="border:1px solid var(--line);border-radius:14px;padding:12px;background:#fff;">'+
        '<div class="lockrow" style="gap:10px;align-items:flex-start;margin-bottom:8px;">'+
          '<div style="display:flex;flex-direction:column;gap:2px;">'+
            '<div style="font-weight:900;">Homeowner Entry '+(idx+1)+'</div>'+
            '<div class="help" style="margin:0;">Optional: add name to keep notes organized.</div>'+
          '</div>'+
          '<div class="row" style="gap:8px;flex-wrap:wrap;justify-content:flex-end;">'+
            '<button type="button" class="btn hofRemove" data-action="remove">Remove</button>'+
          '</div>'+
        '</div>'+

        '<label>Homeowner name (optional)</label>'+
        '<input class="hofName" type="text" value="'+safeName.replace(/"/g,'&quot;')+'" placeholder="e.g., John Smith" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--line);font-size:14px;margin-bottom:8px;" />'+

        '<label>Notes</label>'+
        '<textarea class="hofNote" placeholder="Enter homeowner comments, questions, or open forum notes…" style="width:100%;min-height:110px;padding:12px;border-radius:12px;border:1px solid var(--line);font-size:14px;resize:vertical;">'+
          safeNote.replace(/</g,"&lt;").replace(/>/g,"&gt;")+
        '</textarea>'+

        '<div class="row" style="margin-top:10px;gap:14px;flex-wrap:wrap;align-items:flex-start;">'+
          '<div style="display:flex;flex-direction:column;gap:8px;min-width:220px;">'+
            '<label style="display:flex;align-items:center;gap:8px;margin:0;">'+
              '<input class="hofMotionMade" type="checkbox" '+mm+' />'+
              '<span>Motion(s) made</span>'+
            '</label>'+
            '<label style="display:flex;align-items:center;gap:8px;margin:0;">'+
              '<input class="hofMotionApproved" type="checkbox" '+ma+' />'+
              '<span>Motion approved</span>'+
            '</label>'+
          '</div>'+
          '<div style="flex:1;min-width:260px;">'+
            '<label style="margin:0 0 6px;display:block;">Motion details</label>'+
            '<textarea class="hofMotionText" placeholder="Describe the exact motion made…" style="width:100%;min-height:64px;padding:10px;border-radius:12px;border:1px solid var(--line);font-size:14px;resize:vertical;">'+
              safeMotionText.replace(/</g,"&lt;").replace(/>/g,"&gt;")+
            '</textarea>'+
          '</div>'+
        '</div>'+
      '</div>';
  }

  function render(state){
    var entries = Array.isArray(state.entries) ? state.entries : [];
    if(!entries.length){
      entriesWrap.innerHTML = '<div class="sub">No homeowner entries yet. Click <b>Add Homeowner</b> to create one.</div>';
    }else{
      entriesWrap.innerHTML = entries.map(function(e,i){ return rowTpl(e,i); }).join('');
    }
    renderUpdated(state.updated_at || "");
  }

  function collectFromDOM(state){
    var entries = [];
    var nodes = entriesWrap.querySelectorAll('[data-hof-id]');
    nodes.forEach(function(node){
      var id = node.getAttribute('data-hof-id') || uidNow();
      var name = (node.querySelector('.hofName')||{}).value || "";
      var note = (node.querySelector('.hofNote')||{}).value || "";
      var mm = !!(node.querySelector('.hofMotionMade')||{}).checked;
      var ma = !!(node.querySelector('.hofMotionApproved')||{}).checked;
      var mt = (node.querySelector('.hofMotionText')||{}).value || "";
      // preserve history if exists
      var prev = (state.entries||[]).find(function(x){ return x.id===id; }) || {};
      var updates = Array.isArray(prev.updates) ? prev.updates : [];
      entries.push({
        id: id,
        name: String(name||""),
        note: String(note||""),
        motionMade: mm,
        motionApproved: ma,
        motionText: String(mt||""),
        updated_at: prev.updated_at || "",
        updates: updates
      });
    });
    return entries;
  }

  function saveAll(){
    var uid=getUid();
    var mid=getMid();
    if(!uid || !mid){ setStatus("Could not save."); return; }
    var state = readState(uid,mid);
    var nowIso = new Date().toISOString();

    var entries = collectFromDOM(state);
    // stamp each entry + keep per-entry history
    entries = entries.map(function(e){
      var prev = (state.entries||[]).find(function(x){ return x.id===e.id; }) || {};
      var updates = Array.isArray(prev.updates) ? prev.updates.slice() : [];
      e.updated_at = nowIso;
      updates.unshift({
        ts: nowIso,
        name: e.name,
        note: e.note,
        motionMade: e.motionMade,
        motionApproved: e.motionApproved,
        motionText: e.motionText
      });
      if(updates.length > 25) updates.length = 25;
      e.updates = updates;
      return e;
    });

    var next = { entries: entries, updated_at: nowIso };
    if(!writeState(uid,mid,next)){ setStatus("Could not save."); return; }
    renderUpdated(nowIso);
    setStatus("Saved.");
  }

  function clearAll(){
    var uid=getUid();
    var mid=getMid();
    try{ localStorage.removeItem(key(uid,mid)); }catch(_e){}
    render({ entries: [], updated_at: "" });
    setStatus("Cleared.");
  }

  function addEntry(){
    var uid=getUid();
    var mid=getMid();
    if(!uid){ alert("Please sign in again. (User not detected)"); setStatus("Could not add."); return; }
    if(!mid){
      // If there is no active meeting yet, default to today so homeowner entries can still be captured.
      mid = (function(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); })();
    }
    var state = readState(uid,mid);
    var entries = collectFromDOM(state);
    entries.push({
      id: uidNow(),
      name: "",
      note: "",
      motionMade: false,
      motionApproved: false,
      motionText: "",
      updated_at: "",
      updates: []
    });
    var next = { entries: entries, updated_at: state.updated_at || "" };
    writeState(uid,mid,next);
    render(next);
    // Bring the new entry into view and focus the Notes box for quick typing.
    setTimeout(function(){
      try{
        var cards = entriesWrap.querySelectorAll('[data-hof-id]');
        var last = cards[cards.length-1];
        if(last){
          last.scrollIntoView({behavior:"smooth", block:"start"});
          var ta = last.querySelector('.hofNote');
          if(ta) ta.focus();
        }
      }catch(_e){}
    }, 50);
    
    setStatus("Added.");
  }

  function removeEntry(id){
    var uid=getUid();
    var mid=getMid();
    var state = readState(uid,mid);
    var entries = collectFromDOM(state).filter(function(e){ return e.id !== id; });
    var next = { entries: entries, updated_at: state.updated_at || "" };
    writeState(uid,mid,next);
    render(next);
    setStatus("Removed.");
  }

  // Delegated events
  entriesWrap.addEventListener("click", function(e){
    var btn = e.target && e.target.closest ? e.target.closest('[data-action="remove"]') : null;
    if(btn){
      var card = e.target.closest('[data-hof-id]');
      if(card){
        var id = card.getAttribute('data-hof-id');
        removeEntry(id);
      }
    }
  });

  addBtn.addEventListener("click", addEntry);
  saveBtn.addEventListener("click", saveAll);
  clearBtn.addEventListener("click", clearAll);

  function load(){
    var uid=getUid();
    var mid=getMid();
    render(readState(uid,mid));
  }

  document.addEventListener("DOMContentLoaded", load);
  window.addEventListener("zummee:meeting-changed", load);
})();

;


(function(){
  const KEY_BASE = "zummee_board_meetings_notes_v2";

  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }
  function getUid(){
    try{
      var k="sb-slcwuuwyrgnmlmxpcaim-auth-token";
      var raw=localStorage.getItem(k) || sessionStorage.getItem(k);
      if(raw){
        var obj=JSON.parse(raw);
        if(obj && obj.user && obj.user.id) return obj.user.id;
      }
    }catch(e){}
    try{
      var ses=safeParse(sessionStorage.getItem("zummee_session_v1") || localStorage.getItem("zummee_session_v1") || "");
      if(ses && ses.userId) return ses.userId;
    }catch(e2){}
    try{ return String(localStorage.getItem("zummee_user_id_v1")||"").trim(); }catch(e3){}
    return "anon";
  }

  function currentCommunityId(){
    try{
      var sel=document.getElementById("zummeeCommunitySelect");
      if(sel && sel.value) return String(sel.value).trim();
    }catch(e){}
    // Fallback to remembered selection, if present
    try{ return String(localStorage.getItem("zummee_selected_community_id_v1")||"").trim(); }catch(e2){}
    return "";
  }

  function currentMeetingId(uid){
    // stored by the meetings manager
    try{
      var k = "zummee_board_meetings_current_v1__user__" + (uid||"anon");
      var v = String(localStorage.getItem(k)||"").trim();
      if(v) return v;
    }catch(e){}
    // fallback to last event detail
    try{ return String(window.__bmActiveMeetingId||"").trim(); }catch(e2){}
    return "";
  }

  function key(){
    var uid = getUid();
    var cid = currentCommunityId() || "all";
    var mid = currentMeetingId(uid) || "current";
    return KEY_BASE + "__user__" + uid + "__community__" + cid + "__meeting__" + mid;
  }

  const ta = document.getElementById("bmNotes");
  const saveBtn = document.getElementById("bmSave");
  const clearBtn = document.getElementById("bmClear");
  const status = document.getElementById("bmStatus");
  if(!ta || !saveBtn || !clearBtn) return;

  function loadNotes(){
    try{ ta.value = localStorage.getItem(key()) || ""; }catch(_e){}
  }

  function setStatus(msg){
    if(!status) return;
    status.textContent = msg;
    clearTimeout(window.__bmStatusT);
    window.__bmStatusT = setTimeout(()=>{ status.textContent=""; }, 1800);
  }

  // Initial load
  loadNotes();

  // When user switches meetings
  window.addEventListener("zummee:meeting-changed", function(ev){
    try{ window.__bmActiveMeetingId = (ev && ev.detail && ev.detail.meetingId) ? String(ev.detail.meetingId) : window.__bmActiveMeetingId; }catch(e){}
    loadNotes();
  });

  // When user switches communities
  document.addEventListener("community:changed", function(){
    loadNotes();
  });

  saveBtn.addEventListener("click", ()=>{
    try{ localStorage.setItem(key(), ta.value||""); setStatus("Saved."); }
    catch(e){ setStatus("Could not save."); }
  });

  clearBtn.addEventListener("click", ()=>{
    ta.value = "";
    try{ localStorage.removeItem(key()); }catch(_e){}
    setStatus("Cleared.");
  });
})();

;

// --- Cloud Sync: Board Meetings (offline-first) ---
(function(){
  var SYNC_TABLE = "board_meetings_state";
  var PENDING_BASE = "zummee_cloud_pending_bm_v1";
  var LASTSYNC_BASE = "zummee_cloud_lastsync_bm_v1";
  var LASTERR_BASE = "zummee_cloud_lasterr_bm_v1";

  function safeParse(raw){ try{ return JSON.parse(raw); }catch(e){ return null; } }

  function getUid(){
    try{ if(window.ZummeeAuth && window.ZummeeAuth.getUserId){ return window.ZummeeAuth.getUserId() || ""; } }catch(_e){}
    try{ return String(localStorage.getItem("zummee_user_id_v1")||"").trim(); }catch(_e2){ return ""; }
  }
  function getCid(){
    try{ if(window.ZummeeAuth && window.ZummeeAuth.getSelectedCommunityId){ return window.ZummeeAuth.getSelectedCommunityId() || ""; } }catch(_e){}
    try{ return String(localStorage.getItem("zummee_selected_community_id")||"").trim(); }catch(_e2){ return ""; }
  }

  function meetingKey(uid){
    try{ if(window.ZummeeMeetings && window.ZummeeMeetings.getCurrentId){ return window.ZummeeMeetings.getCurrentId(); } }catch(e){}
    var d=new Date();
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,"0");
    var day=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+day;
  }

  function pendingKey(uid,cid){
    uid = String(uid||"").trim();
    cid = String(cid||"").trim();
    return uid && cid ? (PENDING_BASE + "::" + uid + "::" + cid) : PENDING_BASE;
  }
  function lastSyncKey(uid,cid){
    uid = String(uid||"").trim();
    cid = String(cid||"").trim();
    return uid && cid ? (LASTSYNC_BASE + "::" + uid + "::" + cid) : LASTSYNC_BASE;
  }

  function lastErrKey(uid,cid){
    uid = String(uid||"").trim();
    cid = String(cid||"").trim();
    return uid && cid ? (LASTERR_BASE + "::" + uid + "::" + cid) : LASTERR_BASE;
  }

  function setPending(uid,cid,val){
    try{ localStorage.setItem(pendingKey(uid,cid), val ? "1" : "0"); }catch(_e){}
    renderSyncStatus();
  }
  function isPending(uid,cid){
    try{ return (localStorage.getItem(pendingKey(uid,cid))||"") === "1"; }catch(_e){ return false; }
  }

  function fmtSync(status){
    if(status === "offline") return "🔴 Offline — changes saved locally";
    if(status === "pending") return "🟡 Pending sync";
    if(status === "synced") return "✅ Synced";
    if(status === "nocloud") return "ℹ️ Cloud unavailable — local only";
    return "";
  }

  function renderSyncStatus(){
    var el = document.getElementById("bmSyncStatus");
    if(!el) return;
    var uid = getUid();
    var cid = getCid();
    var online = (typeof navigator !== "undefined") ? !!navigator.onLine : true;
    var hasCloud = !!(window.sb && window.sb.from);

    var status = "synced";
    if(!hasCloud) status = "nocloud";
    else if(!online) status = "offline";
    else if(isPending(uid,cid)) status = "pending";

    var last = "";
    try{ last = String(localStorage.getItem(lastSyncKey(uid,cid))||"").trim(); }catch(_e){}
    var parts = [fmtSync(status)];
    if(last) parts.push("Last sync: " + last);
    if(status === "pending"){
      var le = "";
      try{ le = String(localStorage.getItem(lastErrKey(uid,cid))||"").trim(); }catch(_e2){}
      if(le) parts.push("Last error: " + le);
    }
    el.textContent = parts.join(" • ");
  }

  function readAttendance(uid, mid){
    try{
      var raw = localStorage.getItem("zummee_board_meeting_attendance_v1__user__" + (uid||"anon") + "__meeting__" + (mid||""));
      var obj = safeParse(raw||"");
      return (obj && typeof obj === "object") ? obj : {};
    }catch(_e){ return {}; }
  }
  function readNewBiz(uid, mid){
    try{
      var raw = localStorage.getItem("zummee_board_meeting_new_business_v1__user__" + (uid||"anon") + "__meeting__" + (mid||""));
      var arr = safeParse(raw||"");
      return Array.isArray(arr) ? arr : [];
    }catch(_e){ return []; }
  }
  function readNotes(uid){
    try{ return String(localStorage.getItem("zummee_board_meetings_notes_v1__user__" + (uid||""))||""); }catch(_e){ return ""; }
  }
  function readForum(uid, mid){
    try{
      var raw = localStorage.getItem("zummee_board_meeting_open_forum_v1__user__" + (uid||"anon") + "__meeting__" + (mid||""));
      var obj = safeParse(raw||"") || {};
      // Normalize: return an array of entries
      if(obj && Array.isArray(obj.entries)) return obj.entries;
      if(obj && (obj.note || obj.motionMade || obj.motionApproved)){
        return [{
          name: String(obj.name||""),
          note: String(obj.note||""),
          motionMade: !!obj.motionMade,
          motionApproved: !!obj.motionApproved,
          updated_at: obj.updated_at || ""
        }];
      }
      return [];
    }catch(_e){ return []; }
  }
  function readStartIso(uid){
    try{ return String(localStorage.getItem("zummee_board_meeting_start_v1__user__" + (uid||"anon"))||"").trim(); }catch(_e){ return ""; }
  }

  function collectMeeting(uid,cid,mid){
    return {
      user_id: uid,
      community_id: cid,
      meeting_key: mid,
      data: {
        started_at: readStartIso(uid) || null,
        attendance: readAttendance(uid, mid),
        homeowner_open_forum_entries: readForum(uid, mid),
        new_business: readNewBiz(uid, mid),
        notes: readNotes(uid, mid) || "",
      },
      updated_at: new Date().toISOString()
    };
  }

  async function pushNow(){
    var uid = getUid();
    var cid = getCid();
    if(!uid || !cid) return;
    if(!(window.sb && window.sb.from)) return;
    if(typeof navigator !== "undefined" && !navigator.onLine) return;

    var mid = meetingKey(uid);
    var payload = collectMeeting(uid,cid,mid);

    setPending(uid,cid,true);
    try{
      try{ localStorage.removeItem(lastErrKey(uid,cid)); }catch(_e0){}
      var res = await window.sb
        .from(SYNC_TABLE)
        .upsert(payload, { onConflict: "user_id,community_id,meeting_key" });
      if(res && res.error) throw res.error;
      setPending(uid,cid,false);
      try{ localStorage.setItem(lastSyncKey(uid,cid), new Date().toLocaleString()); }catch(_e){}
      renderSyncStatus();
    }catch(e){
      // Keep pending true; stay offline-first
      try{
        var msg = (e && (e.message || e.error_description || e.details)) ? String(e.message || e.error_description || e.details) : String(e||"");
        msg = msg.replace(/\s+/g,' ').trim();
        localStorage.setItem(lastErrKey(uid,cid), msg.slice(0,160));
      }catch(_e2){}
      renderSyncStatus();
    }
  }

  var t = null;
  function schedulePush(){
    clearTimeout(t);
    t = setTimeout(pushNow, 900);
  }

  function bindTriggers(){
    // Any interaction in Attendance/New Business/Notes should schedule a push
    var wrap = document.querySelector(".wrap");
    if(wrap){
      wrap.addEventListener("change", function(e){ schedulePush(); }, true);
      wrap.addEventListener("click", function(e){
        var id = (e && e.target && e.target.id) ? e.target.id : "";
        if(id === "bmStartBtn" || id === "bmEndBtn" || id === "bmSave" || id === "bmClear" || id === "hofAddEntry" || id === "hofSaveAll" || id === "hofClearAll" || id === "nbAdd" || id === "nbAddEmail" || id === "nbClear" || id === "nbClearForm") schedulePush();
      }, true);
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    renderSyncStatus();
    bindTriggers();

    window.addEventListener("online", function(){ renderSyncStatus(); schedulePush(); });
    window.addEventListener("offline", function(){ renderSyncStatus(); });

    // Auto-retry pending cloud writes (offline-first)
    setInterval(function(){
      try{
        var uid = getUid(), cid = getCid();
        if(!uid || !cid) return;
        if(!(window.sb && window.sb.from)) return;
        if(typeof navigator !== "undefined" && !navigator.onLine) return;
        if(isPending(uid,cid)) { pushNow(); }
      }catch(_e){}
    }, 10000);
  });

  // Expose for debugging
  window.ZummeeCloudBM = { pushNow: pushNow, schedulePush: schedulePush, render: renderSyncStatus };
})();

;

/* === v114: Board Meetings Community Dropdown Populate (cloud-first) === */
(function(){
  function $(id){ return document.getElementById(id); }

  async function fetchProfileBasics(){
    const sb = await ensureSupabase();
    const s = await getSessionSafe(sb, 5000);
      const uid = s.data?.session?.user?.id;
    if(!uid) throw new Error("Not signed in");
    const q = await sb.from("profiles").select("id,company,role,selected_community_id").eq("id", uid).maybeSingle();
    if(q.error) throw q.error;
    return {
      uid,
      company: String(q.data?.company||"").trim(),
      role: String(q.data?.role||"").trim(),
      selected: String(q.data?.selected_community_id||"")
    };
  }

  function readLocalCommunitiesFallback(){
    // Shared communities key used across pages
    const k = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || "zummee_communities_v1";
    try{
      const raw = localStorage.getItem(k) || "[]";
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(_e){
      return [];
    }
  }

  function writeLocalCommunitiesFallback(list){
    const k = (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.COMMUNITIES_KEY) || window.COMMUNITIES_KEY || "zummee_communities_v1";
    try{ localStorage.setItem(k, JSON.stringify(list||[])); }catch(_e){}
  }

  async function syncLocalCommunitiesToCloud(profile){
    const sb = await ensureSupabase();
    if(!profile.company) throw new Error("No company on profile");

    // Read local communities
    const local = readLocalCommunitiesFallback()
      .map(x => ({ name: (typeof x==='string' ? x : String(x?.name||'')) .trim() }))
      .filter(x => x.name)
      .filter((x,i,arr)=> arr.findIndex(y=>y.name.toLowerCase()===x.name.toLowerCase())===i);

    // Read cloud communities
    // company is stored as TEXT; use case-insensitive match to avoid mismatches across pages
    const cloudQ = await sb.from("PropertyCommunities").select("id,name").ilike("company", profile.company);
    if(cloudQ.error) throw cloudQ.error;
    const cloud = cloudQ.data || [];
    const cloudNames = new Set(cloud.map(c => String(c.name||"").trim().toLowerCase()).filter(Boolean));

    const toInsert = local
      .filter(c => !cloudNames.has(c.name.toLowerCase()))
      .map(c => ({ company: profile.company, name: c.name, owner_id: profile.uid }));

    let inserted = 0;
    if(toInsert.length){
      const ins = await sb.from("PropertyCommunities").insert(toInsert).select("id,name");
      if(ins.error) throw ins.error;
      inserted = (ins.data||[]).length;
    }

    // Reload cloud list and overwrite local cache with cloud IDs for consistency
    const fresh = await sb.from("PropertyCommunities").select("id,name,created_at").ilike("company", profile.company).order("name", { ascending:true });
    if(fresh.error) throw fresh.error;
    const freshList = fresh.data || [];
    writeLocalCommunitiesFallback(freshList.map(c => ({ id:String(c.id), name:c.name })));
    return { inserted, totalCloud: freshList.length };
  }

  async function loadCommunitiesCloud(profile){
    const sb = await ensureSupabase();
    if(!profile.company) return [];

    // Keep communities consistent across legacy/new tables.
    // 1) best-effort merge local-only -> PropertyCommunities
    try{ await syncLocalCommunitiesToCloud(profile); }catch(_e){}

    const norm = (s)=> String(s||"").trim().toLowerCase();

    // Read canonical list
    const pcQ = await sb.from("PropertyCommunities")
      .select("id,name,created_at")
      .ilike("company", profile.company)
      .order("name", { ascending:true });
    if(pcQ.error) throw pcQ.error;
    const pc = pcQ.data || [];
    const pcNames = new Set(pc.map(r=>norm(r.name)).filter(Boolean));

    // Read legacy table (if present) and migrate any missing names
    try{
      const cQ = await sb.from("Communities")
        .select("id,name,created_at")
        .ilike("company", profile.company)
        .order("name", { ascending:true });
      if(!cQ.error){
        const legacy = cQ.data || [];
        const toInsert = legacy
          .map(r=>({ name: String(r.name||"").trim() }))
          .filter(r=>r.name)
          .filter(r=> !pcNames.has(norm(r.name)))
          .map(r=>({ company: profile.company, name: r.name, owner_id: profile.uid }));
        if(toInsert.length){
          await sb.from("PropertyCommunities").insert(toInsert);
        }
      }
    }catch(_e){}

    // Re-read canonical list
    const finalQ = await sb.from("PropertyCommunities")
      .select("id,name,created_at")
      .ilike("company", profile.company)
      .order("name", { ascending:true });
    if(finalQ.error) throw finalQ.error;
    return finalQ.data || [];
  }

  function renderCommunityOptions(select, list, selectedId){
    if(!select) return;
    select.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = list.length ? "Select community…" : "No communities";
    select.appendChild(opt0);

    list.forEach(c => {
      const opt = document.createElement("option");
      opt.value = String(c.id);
      opt.textContent = c.name || ("Community " + String(c.id).slice(0,8));
      select.appendChild(opt);
    });

    if(selectedId && Array.from(select.options).some(o => o.value === String(selectedId))){
      select.value = String(selectedId);
    }else{
      select.value = "";
    }
  }

  async function ensureSelectedCommunity(profile, list){
    const select = $("zummeeCommunitySelect");
    let selected = String(profile.selected || "").trim()
      || (function(){ try{ return localStorage.getItem("zummee_selected_community_id")||""; }catch(_e){ return ""; } })()
      || (function(){ try{ return localStorage.getItem("zummee_selected_community_v1")||""; }catch(_e){ return ""; } })();

    // Support legacy selections where selected_community_id stored the COMMUNITY NAME.
    // If selected isn't an id in the list, try matching by name and migrate to id.
    if(selected && !list.find(x => String(x.id) === selected)){
      const byName = list.find(x => String(x.name||"").trim().toLowerCase() === selected.trim().toLowerCase());
      if(byName){
        const resolved = String(byName.id);
        // Migrate profile selected value to id (best-effort)
        try{ await (await ensureSupabase()).from("profiles").update({ selected_community_id: resolved }).eq("id", profile.uid); }catch(_e){}
        try{ localStorage.setItem("zummee_selected_community_id", resolved); }catch(_e){}
        try{ localStorage.setItem("zummee_selected_community_v1", resolved); }catch(_e){}
        selected = resolved;
      } else {
        selected = "";
      }
    }
    if(!selected && list.length){
      selected = String(list[0].id);
      // Persist selection to profile (cloud) best-effort
      try{
        const sb = await ensureSupabase();
        await sb.from("profiles").update({ selected_community_id: selected }).eq("id", profile.uid);
      }catch(_e){}
      // Persist to local keys so other pages stay in sync
      try{ localStorage.setItem("zummee_selected_community_id", selected); }catch(_e){}
      try{ localStorage.setItem("zummee_selected_community_v1", selected); }catch(_e){}
    }
    renderCommunityOptions(select, list, selected);
    if(selected){
      document.dispatchEvent(new CustomEvent("community:changed", { detail:{ community_id: selected } }));
    }
    return selected;
  }

  async function initCommunityHeaderBM(){
    // If header elements don't exist, skip.
    if(!$("zummeeCommunitySelect")) return;

    try{
      // Make sure we initialize Supabase early so page isn't stuck in "cloud unavailable"
      await ensureSupabase();
    }catch(_e){ /* local-only fallback still ok */ }

    try{
      const profile = await fetchProfileBasics(); // {uid, company, role, selected}
      try{ setSwatch(profile.company || ""); }catch(_e){}
      try{ bindSelect($("zummeeCommunitySelect")); }catch(_e){}
      // Sync Local→Cloud button is configured after communities are loaded (clean UI)
        syncBtn.onclick = async function(){
          syncBtn.disabled = true;
          const oldText = syncBtn.textContent;
          syncBtn.textContent = "Syncing…";
          try{
            const res = await syncLocalCommunitiesToCloud(profile);
            alert(`Synced communities to cloud. Added ${res.inserted}. Cloud total: ${res.totalCloud}.`);
          }catch(err){
            alert("Sync failed: " + (err && err.message ? err.message : String(err||"Unknown error")));
          }finally{
            syncBtn.textContent = oldText;
            syncBtn.disabled = false;
            // Re-run init to refresh dropdown from cloud
            try{ await initCommunityHeaderBM(); }catch(_e){}
          }
        };
      }
    catch(_e){ /* ignore init header errors */ }

      // Auto-sync local community changes to cloud (offline-first)
      try{
        if(!window.__zummeeAutoCommunitySyncBound){
          window.__zummeeAutoCommunitySyncBound = true;
          let __t=null;
          document.addEventListener("communities:changed", ()=>{
            try{
              clearTimeout(__t);
              __t = setTimeout(async ()=>{
                try{
                  if(typeof navigator!=="undefined" && !navigator.onLine) return;
                  if(!(window.sb && window.sb.from)) return;
                  const p = await fetchProfileBasics();
                  await syncLocalCommunitiesToCloud(p);
                  // Refresh dropdown after background sync
                  try{ await initCommunityHeaderBM(); }catch(_e){}
                }catch(_e){}
              }, 500);
            }catch(_e){}
          });
          window.addEventListener("online", ()=>{ try{ document.dispatchEvent(new CustomEvent("communities:changed")); }catch(_e){} });
        }
      }catch(_e){}


// Auto-sync local community changes to cloud (offline-first)
try{
  if(!window.__zummeeAutoCommunitySyncBound){
    window.__zummeeAutoCommunitySyncBound = true;
    let __t = null;
    document.addEventListener("communities:changed", ()=>{
      try{
        clearTimeout(__t);
        __t = setTimeout(async ()=>{
          try{
            if(!(window.sb && window.sb.from)) return;
            if(typeof navigator!=="undefined" && !navigator.onLine) return;
            const profNow = await fetchProfileBasics();
            await syncLocalCommunitiesToCloud(profNow);
            // Refresh dropdown from cloud after auto-sync
            try{ await initCommunityHeaderBM(); }catch(_e){}
          }catch(_e){}
        }, 600);
      }catch(_e){}
    });
    window.addEventListener("online", ()=>{
      try{
        // On reconnect, attempt a merge of any local additions
        document.dispatchEvent(new CustomEvent("communities:changed"));
      }catch(_e){}
    });
  }
}catch(_e){}

      let list = [];
      try{
        list = await loadCommunitiesCloud(profile);
      }catch(_e){
        // Fallback to local communities cache if cloud read fails
        try{ list = readLocalCommunitiesFallback(); }catch(__e){ list = []; }
      }
      // Cache list locally for offline use
      try{ writeLocalCommunitiesFallback(list.map(c => ({ id:String(c.id), name:c.name }))); }catch(_e){}
      // Sync Local→Cloud button (clean UI): hidden unless it can actually help.
      const syncBtn = $("zummeeCommunitySync");
      if(syncBtn){
        syncBtn.style.display = "none";
        syncBtn.disabled = false;
        const role = String(profile.role||"").toLowerCase();
        // Keep prior behavior: if role is blank/missing, leave available.
        const isAdmin = (!role) || (role === "companyadmin" || role === "admin");
        if(!isAdmin){
          syncBtn.style.display = "none";
        }else{
          const online = (typeof navigator!=="undefined") ? !!navigator.onLine : true;
          if(!online){
            syncBtn.style.display = "";
            syncBtn.disabled = true;
            syncBtn.title = "Offline — sync unavailable";
          }else{
            let needsSync = false;
            try{
              const localRaw = readLocalCommunitiesFallback();
              const localNames = new Set((localRaw||[]).map(x => {
                if(typeof x === "string") return x.trim();
                return String(x && x.name || "").trim();
              }).filter(Boolean).map(n=>n.toLowerCase()));
              const cloudNames = new Set((list||[]).map(c => String(c && c.name || "").trim().toLowerCase()).filter(Boolean));
              for(const n of localNames){ if(!cloudNames.has(n)) { needsSync = true; break; } }
              if(!needsSync && (localRaw||[]).some(x => typeof x === "string")) needsSync = true;
            }catch(_e){ needsSync = false; }

            if(needsSync){
              syncBtn.style.display = "";
              syncBtn.title = "Uploads any locally stored communities into Supabase (merge, no deletes).";
            }

            syncBtn.onclick = async function(){
              syncBtn.disabled = true;
              const oldText = syncBtn.textContent;
              syncBtn.textContent = "Syncing…";
              try{
                const res = await syncLocalCommunitiesToCloud(profile);
                alert(`Synced communities to cloud. Added ${res.inserted}. Cloud total: ${res.totalCloud}.`);
              }catch(err){
                alert("Sync failed: " + (err && err.message ? err.message : String(err||"Unknown error")));
              }finally{
                syncBtn.textContent = oldText;
                syncBtn.disabled = false;
                try{ await initCommunityHeaderBM(); }catch(_e){}
              }
            };
          }
        }
      }


      await ensureSelectedCommunity(profile, list);
    }catch(_e){
      // If anything fails, keep dropdown empty but do not crash the page.
      try{ renderCommunityOptions($("zummeeCommunitySelect"), [], ""); }catch(__e){}
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", initCommunityHeaderBM);
  }else{
    initCommunityHeaderBM();
  }
})();


  // Ensure board meeting sections refresh when the header community dropdown changes
  function refreshBoardMeetingsOnCommunityChange(){
    try{
      // Clear containers first to prevent old items from lingering
      var openEl = document.getElementById("nbOpenList");
      var closedEl = document.getElementById("nbClosedList");
      if(openEl) openEl.innerHTML = "";
      if(closedEl) closedEl.innerHTML = "";
    }catch(_e){}
    try{ renderNewBusiness(); }catch(_e2){}
    try{ renderClosed && renderClosed(); }catch(_e3){}
    try{ renderMeetings && renderMeetings(); }catch(_e4){}
  }

  document.addEventListener("community:changed", function(){ refreshBoardMeetingsOnCommunityChange(); });

  // Fallback: if the select exists and dispatch isn't firing for some reason, hook directly
  document.addEventListener("DOMContentLoaded", function(){
    try{
      var sel = document.getElementById("zummeeCommunitySelect");
      if(sel){
        sel.addEventListener("change", function(){ setTimeout(refreshBoardMeetingsOnCommunityChange, 0); });
      }
    }catch(_e){}
  });

