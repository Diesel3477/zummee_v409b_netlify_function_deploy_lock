(function(){
  'use strict';
  var BUILD = '2026-05-11-v739-preferred-vendors-user-friendly-status';
  var SUPABASE_URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_DqOtjzlLWph7-bFjKlFN0w_kSpPI864';
  var VENDOR_TABLE = 'preferred_vendors_shared';
  var SPONSOR_TABLE = 'zummee_sponsored_vendors';
  var SPONSOR_BUCKET = 'zummee_sponsored_vendor_logos';
  var CATEGORIES = ['Plumbing','Electrical','HVAC','Roofing','Pest Control','Landscaping','Pool','Cleaning / Janitorial','Attorneys','Insurance','Reserve Study','Elevator','Fire Safety','Security','Asphalt / Concrete','Painting','General Contractor','Restoration','Tree Service','Locksmith','Appliance Repair','Waste / Recycling','Other'];
  var state = {
    build: BUILD,
    sb: null,
    booted: false,
    loading: false,
    saving: false,
    context: null,
    vendors: [],
    sponsors: [],
    lastError: '',
    lastSavedAt: null,
    lastLoadedAt: null
  };
  window.__PreferredVendorsV738 = state;

  function $(id){ return document.getElementById(id); }
  function txt(id, value){ var el=$(id); if(el) el.textContent = value || ''; }
  function esc(s){ return String(s||'').replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); }); }
  function clean(s){ return String(s||'').trim(); }
  function lower(s){ return clean(s).toLowerCase(); }
  function local(k){ try{ return localStorage.getItem(k) || ''; }catch(_e){ return ''; } }
  function setLocal(k,v){ try{ if(v) localStorage.setItem(k, String(v)); }catch(_e){} }
  function timeout(promise, ms, label){
    return Promise.race([
      promise,
      new Promise(function(_, reject){ setTimeout(function(){ reject(new Error((label || 'Operation') + ' timed out after ' + Math.round(ms/1000) + ' seconds.')); }, ms); })
    ]);
  }
  function setStatus(msg, type){
    var el = $('pv_manageStatus');
    if(!el) return;
    el.textContent = msg || '';
    el.className = 'pv-status' + (type ? ' ' + type : '');
  }
  function setSaving(isSaving){
    state.saving = !!isSaving;
    var btn = $('pv_saveBtn');
    if(btn){ btn.disabled = !!isSaving; btn.textContent = isSaving ? 'Saving…' : (($('pv_editKey') && $('pv_editKey').value) ? 'Update Vendor' : 'Save Vendor'); }
  }
  function getClient(){
    if(state.sb) return state.sb;
    if(window.sb && window.sb.from) state.sb = window.sb;
    else if(window.supabaseClient && window.supabaseClient.from) state.sb = window.supabaseClient;
    else if(window.supabase && window.supabase.createClient) state.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth:{ storageKey:'sb-zummee-auth', storage: window.localStorage, persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }});
    return state.sb;
  }
  function normalizeRole(v){ return lower(v).replace(/[^a-z]/g,''); }
  function isManagerRole(role){
    var r = normalizeRole(role || (state.context && state.context.role) || local('zummee_role') || local('staff_role'));
    return r.indexOf('supervisor') >= 0 || r.indexOf('admin') >= 0 || r.indexOf('employee') >= 0 || r.indexOf('manager') >= 0 || r.indexOf('companyadmin') >= 0;
  }
  function getStoredCommunityId(){
    var keys = ['zummee_selected_community_id','activeCommunityId','zummee_community_id','zummeeActiveCommunityId','selectedCommunityId','community_id'];
    for(var i=0;i<keys.length;i++){ var v = clean(local(keys[i])); if(v) return v; }
    try{
      if(window.ZummeeCommunityState && typeof window.ZummeeCommunityState.get === 'function'){
        var c = window.ZummeeCommunityState.get();
        if(c && c.id) return clean(c.id);
      }
    }catch(_e){}
    return '';
  }
  function normalizeCategory(v){
    var s = clean(v) || 'Other';
    for(var i=0;i<CATEGORIES.length;i++){ if(lower(CATEGORIES[i]) === lower(s)) return CATEGORIES[i]; }
    return s;
  }
  function generateKey(){ return 'pv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10); }
  function vendorKey(row){
    return clean(row.vendorKey || row.vendor_key || row.id) || generateKey();
  }
  function normalizeVendor(row){
    if(!row || typeof row !== 'object') return null;
    var name = clean(row.vendorName || row.vendor_name || row.name);
    if(!name) return null;
    return {
      vendorKey: vendorKey(row),
      vendorName: name,
      vendorType: normalizeCategory(row.vendorType || row.vendor_type || row.type),
      contactName: clean(row.contactName || row.contact_name || row.contact),
      phone: clean(row.phone || row.phone_number),
      email: clean(row.email),
      notes: clean(row.notes || row.description)
    };
  }
  function normalizeVendorList(rows){
    if(!Array.isArray(rows)) return [];
    var seen = {};
    return rows.map(normalizeVendor).filter(Boolean).filter(function(v){
      var k = v.vendorKey;
      if(seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }
  function phoneDigits(v){
    var d = String(v||'').replace(/\D/g,'');
    if(d.length === 11 && d[0] === '1') d = d.slice(1);
    return d;
  }
  function phoneDisplay(v){
    var d = phoneDigits(v);
    if(d.length === 10) return '(' + d.slice(0,3) + ') ' + d.slice(3,6) + '-' + d.slice(6);
    return clean(v) || '—';
  }
  async function resolveContext(force){
    if(state.context && !force) return state.context;
    var sb = getClient();
    if(!sb || !sb.auth) throw new Error('Supabase client did not initialize.');
    var sessionRes = await timeout(sb.auth.getSession(), 7000, 'Session lookup');
    var session = sessionRes && sessionRes.data && sessionRes.data.session;
    var user = session && session.user;
    if(!user || !user.id) throw new Error('No active Supabase session. Please sign in again.');
    var uid = user.id;
    var email = clean(user.email);
    var ud = null;
    try{
      var udRes = await timeout(sb.from('userdirectory').select('auth_user_id,role,company_id,company_name,approved,profile_name,profile_email').eq('auth_user_id', uid).maybeSingle(), 7000, 'Company lookup');
      if(udRes && udRes.error) throw udRes.error;
      ud = udRes && udRes.data ? udRes.data : null;
    }catch(err){
      console.warn('Preferred Vendors userdirectory lookup fallback:', err && err.message ? err.message : err);
    }
    var profile = null;
    if(!ud || !(ud.company_name || ud.company_id)){
      try{
        var pRes = await timeout(sb.from('profiles').select('id,name,email,company,company_id,role').eq('id', uid).maybeSingle(), 5000, 'Profile company lookup');
        if(pRes && !pRes.error) profile = pRes.data || null;
      }catch(err2){ console.warn('Preferred Vendors profile fallback:', err2 && err2.message ? err2.message : err2); }
    }
    var companyName = clean(ud && ud.company_name) || clean(profile && profile.company) || clean(local('zummee_company')) || clean(local('company_name')) || clean(user.user_metadata && user.user_metadata.company);
    var companyId = clean(ud && ud.company_id) || clean(profile && profile.company_id) || clean(local('zummee_company_id')) || clean(local('company_id'));
    var companyKey = companyName || companyId;
    if(companyName) setLocal('zummee_company', companyName);
    if(companyId) setLocal('zummee_company_id', companyId);
    var communityId = getStoredCommunityId();
    if(!communityId){
      try{
        var caRes = await timeout(sb.from('community_assignments').select('community_id').eq('user_id', uid).limit(1), 4500, 'Community assignment lookup');
        if(caRes && caRes.data && caRes.data[0] && caRes.data[0].community_id) communityId = clean(caRes.data[0].community_id);
      }catch(_e1){}
    }
    if(!communityId){
      try{
        var caRes2 = await timeout(sb.from('community_assignments').select('community_id').eq('auth_user_id', uid).limit(1), 4500, 'Community assignment lookup');
        if(caRes2 && caRes2.data && caRes2.data[0] && caRes2.data[0].community_id) communityId = clean(caRes2.data[0].community_id);
      }catch(_e2){}
    }
    if(communityId){
      setLocal('zummee_selected_community_id', communityId);
      setLocal('activeCommunityId', communityId);
    }
    if(!companyKey) throw new Error('Company context is missing. Your userdirectory row needs company_name or company_id.');
    if(!communityId) throw new Error('Community context is missing. Select a community from the Manager Hub first.');
    state.context = {
      uid: uid,
      email: email,
      role: clean(ud && ud.role) || clean(profile && profile.role) || clean(local('zummee_role')) || '',
      approved: ud ? ud.approved !== false : true,
      company: companyKey,
      company_name: companyName,
      company_id: companyId,
      community_id: communityId,
      source: ud ? 'userdirectory' : (profile ? 'profiles' : 'local/session')
    };
    return state.context;
  }

  function parseCompanyLogoRef(raw){
    raw = clean(raw);
    if(!raw) return null;
    if(/^https?:\/\//i.test(raw)) return { url: raw };
    return { bucket:'company_logos', path: raw };
  }
  function brandLogoCacheKey(companyId){ return 'mh2_brand_logo_v1_' + clean(companyId); }
  function readBrandLogoCache(companyId){
    try{
      var raw = sessionStorage.getItem(brandLogoCacheKey(companyId));
      if(!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && parsed.url ? parsed : null;
    }catch(_e){ return null; }
  }
  function writeBrandLogoCache(companyId, payload){
    try{
      if(!companyId || !payload || !payload.url) return;
      sessionStorage.setItem(brandLogoCacheKey(companyId), JSON.stringify({
        url: clean(payload.url),
        alt: clean(payload.alt) || 'Company logo',
        isCompany: !!payload.isCompany
      }));
    }catch(_e){}
  }
  function preloadImage(url){
    return new Promise(function(resolve, reject){
      var img = new Image();
      img.decoding = 'async';
      img.onload = function(){ resolve(url); };
      img.onerror = function(){ reject(new Error('Company logo image could not load.')); };
      img.src = url;
    });
  }
  async function paintCompanyLogo(payload){
    var logo = $('pvCompanyLogo');
    if(!logo) return;
    var url = clean(payload && payload.url);
    var alt = clean(payload && payload.alt) || 'Company logo';
    logo.classList.remove('is-visible');
    if(!url){ logo.removeAttribute('src'); logo.alt = alt; return; }
    await preloadImage(url);
    logo.src = url;
    logo.alt = alt;
    requestAnimationFrame(function(){ logo.classList.add('is-visible'); });
  }
  async function loadCompanyBrandLogo(){
    var logo = $('pvCompanyLogo');
    if(!logo) return;
    var ctx = state.context || await resolveContext(false);
    var companyId = clean(ctx && ctx.company_id);
    if(!companyId){ logo.removeAttribute('src'); return; }

    var cached = readBrandLogoCache(companyId);
    if(cached && cached.url){
      paintCompanyLogo(cached).catch(function(){ /* ignore stale cached image */ });
    }

    var sb = getClient();
    var res = await timeout(sb.from('companies').select('logo_path,name').eq('id', companyId).maybeSingle(), 7000, 'Company logo lookup');
    if(res && res.error) throw res.error;
    var row = (res && res.data) || {};
    var ref = parseCompanyLogoRef(row.logo_path);
    if(!ref) throw new Error('No company branding logo saved for this company.');
    var url = clean(ref.url);
    if(!url && ref.bucket && ref.path && sb.storage && sb.storage.from){
      var pub = sb.storage.from(ref.bucket).getPublicUrl(ref.path);
      url = clean(pub && pub.data && pub.data.publicUrl);
    }
    if(!url) throw new Error('Company branding logo URL could not be resolved.');
    var payload = { url:url, alt:clean(row.name) || 'Company logo', isCompany:true };
    writeBrandLogoCache(companyId, payload);
    await paintCompanyLogo(payload);
    return payload;
  }
  function extractVendorArray(value){
    if(Array.isArray(value)) return value;
    if(value && Array.isArray(value.rows)) return value.rows;
    if(value && Array.isArray(value.vendors)) return value.vendors;
    return [];
  }
  async function loadVendors(){
    var sb = getClient();
    var ctx = await resolveContext(false);
    var res = await timeout(sb.from(VENDOR_TABLE).select('vendors,updated_at,company,community_id').eq('company', ctx.company).eq('community_id', ctx.community_id).maybeSingle(), 8000, 'Preferred vendor load');
    if(res && res.error) throw res.error;
    var rows = normalizeVendorList(extractVendorArray(res && res.data && res.data.vendors));
    state.vendors = rows;
    state.lastLoadedAt = new Date().toISOString();
    return rows;
  }
  async function saveVendorRows(rows){
    var sb = getClient();
    var ctx = state.context || await resolveContext(false);
    if(!ctx || !ctx.company || !ctx.community_id) throw new Error('Company/community context is not ready.');
    var normalized = normalizeVendorList(rows);
    var payload = { company: ctx.company, community_id: ctx.community_id, vendors: normalized, updated_at: new Date().toISOString() };
    var up = await timeout(sb.from(VENDOR_TABLE).upsert(payload, { onConflict:'company,community_id' }), 9000, 'Preferred vendor save');
    if(up && up.error){
      console.warn('Preferred Vendors upsert failed, trying update/insert fallback:', up.error.message || up.error);
      var existing = await timeout(sb.from(VENDOR_TABLE).select('id').eq('company', ctx.company).eq('community_id', ctx.community_id).maybeSingle(), 6000, 'Preferred vendor save fallback lookup');
      if(existing && existing.error) throw existing.error;
      if(existing && existing.data && existing.data.id){
        var upd = await timeout(sb.from(VENDOR_TABLE).update({ vendors: normalized, updated_at: payload.updated_at }).eq('id', existing.data.id), 9000, 'Preferred vendor update');
        if(upd && upd.error) throw upd.error;
      }else{
        var ins = await timeout(sb.from(VENDOR_TABLE).insert(payload), 9000, 'Preferred vendor insert');
        if(ins && ins.error) throw ins.error;
      }
    }
    state.vendors = normalized;
    state.lastSavedAt = payload.updated_at;
    return normalized;
  }
  function publicSponsorUrl(row){
    var url = clean(row.logo_url);
    if(url) return url;
    var path = clean(row.logo_path);
    if(!path || !state.sb || !state.sb.storage) return '';
    try{ return clean(state.sb.storage.from(SPONSOR_BUCKET).getPublicUrl(path).data.publicUrl); }catch(_e){ return ''; }
  }
  function normalizeSponsor(row){
    if(!row || row.is_active === false) return null;
    return {
      category: normalizeCategory(row.category || row.vendor_type || 'Other'),
      slot: Number(row.slot_number || row.slot || 1) || 1,
      vendor_name: clean(row.vendor_name || row.sponsor_name || 'Featured Sponsor'),
      cta_text: clean(row.cta_text || 'Learn more'),
      cta_link: clean(row.cta_link || ''),
      logo_url: publicSponsorUrl(row)
    };
  }
  async function loadSponsorsDeferred(){
    var sb = getClient();
    if(!sb || !sb.from) return [];
    try{
      var res = await timeout(sb.from(SPONSOR_TABLE).select('category,slot_number,vendor_name,cta_text,cta_link,logo_path,logo_url,is_active,updated_at').eq('is_active', true).order('category',{ascending:true}).order('slot_number',{ascending:true}), 7000, 'Sponsor load');
      if(res && res.error) throw res.error;
      state.sponsors = (res.data || []).map(normalizeSponsor).filter(Boolean);
      renderMarketplace();
    }catch(err){ console.warn('Preferred Vendors sponsor load skipped:', err && err.message ? err.message : err); }
    return state.sponsors;
  }
  function sponsorFor(category, slot){
    for(var i=0;i<state.sponsors.length;i++){
      var s = state.sponsors[i];
      if(lower(s.category) === lower(category) && Number(s.slot) === Number(slot)) return s;
    }
    return null;
  }
  function renderSponsor(category, slot){
    var s = sponsorFor(category, slot);
    if(!s) return '';
    var img = s.logo_url ? '<img loading="lazy" src="'+esc(s.logo_url)+'" alt="'+esc(s.vendor_name)+' logo">' : 'Sponsored<br>Placement';
    var html = '<article class="pv-sponsored"><div class="pv-sponsoredTop"><span class="pv-sponsoredPill">Sponsored</span></div><div class="pv-sponsoredMedia">'+img+'</div><div class="pv-sponsoredFooter"><div class="pv-sponsoredName">'+esc(s.vendor_name)+'</div><span class="pv-sponsoredCta">'+esc(s.cta_text || 'Learn more')+'</span></div></article>';
    if(s.cta_link) return '<a class="pv-sponsoredLink" href="'+esc(s.cta_link)+'" target="_blank" rel="noopener noreferrer">'+html+'</a>';
    return html;
  }
  function renderVendorCard(v){
    var phone = phoneDigits(v.phone);
    var phoneBlock = phone ? '<a class="pv-contactBlock" href="tel:'+esc(phone)+'"><span class="pv-contactLabel">Phone</span><span class="pv-contactValue">'+esc(phoneDisplay(v.phone))+'</span></a>' : '<div class="pv-contactBlock"><span class="pv-contactLabel">Phone</span><span class="pv-contactValue">—</span></div>';
    var emailBlock = v.email ? '<a class="pv-contactBlock" href="mailto:'+esc(v.email)+'"><span class="pv-contactLabel">Email</span><span class="pv-contactValue">'+esc(v.email)+'</span></a>' : '<div class="pv-contactBlock"><span class="pv-contactLabel">Email</span><span class="pv-contactValue">—</span></div>';
    var canManage = isManagerRole();
    return '<article class="pv-vendorCard" data-key="'+esc(v.vendorKey)+'">'
      + '<div class="pv-vendorTop"><div><div class="pv-vendorName">'+esc(v.vendorName)+'</div>'+(v.contactName ? '<div class="pv-vendorContact">Company Contact: '+esc(v.contactName)+'</div>' : '')+'</div><span class="pv-typePill">'+esc(v.vendorType || 'Other')+'</span></div>'
      + '<div class="pv-contactGrid">'+phoneBlock+emailBlock+'</div>'
      + (v.notes ? '<div class="pv-notesBox"><strong>Manager Notes</strong><br>'+esc(v.notes)+'</div>' : '')
      + (canManage ? '<div class="pv-cardActions"><button class="pv-btn" type="button" data-edit="'+esc(v.vendorKey)+'">Edit</button><button class="pv-btn pv-btnDanger" type="button" data-delete="'+esc(v.vendorKey)+'">Delete</button></div>' : '')
      + '</article>';
  }
  function filteredVendors(){
    var q = lower($('pv_search') && $('pv_search').value);
    if(!q) return state.vendors.slice();
    return state.vendors.filter(function(v){
      return [v.vendorName,v.vendorType,v.contactName,v.phone,v.email,v.notes].join(' ').toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderMarketplace(){
    var box = $('pv_marketplace'); if(!box) return;
    var vendors = filteredVendors();
    var grouped = {};
    vendors.forEach(function(v){ var c = normalizeCategory(v.vendorType); if(!grouped[c]) grouped[c] = []; grouped[c].push(v); });
    state.sponsors.forEach(function(s){ if(!grouped[s.category]) grouped[s.category] = []; });
    var categories = Object.keys(grouped).sort(function(a,b){
      var ia = CATEGORIES.indexOf(a), ib = CATEGORIES.indexOf(b);
      if(ia < 0) ia = 999; if(ib < 0) ib = 999;
      return ia === ib ? a.localeCompare(b) : ia - ib;
    });
    if(!categories.length){
      box.innerHTML = '<div class="pv-empty"><strong>No preferred vendors saved yet.</strong><br>Add your first vendor above. Add your first vendor above.</div>';
      txt('pv_count','0 vendors saved for this community');
      return;
    }
    box.innerHTML = categories.map(function(category){
      var rows = grouped[category] || [];
      var cards = [renderSponsor(category,1), renderSponsor(category,2)].filter(Boolean).concat(rows.map(renderVendorCard));
      if(!cards.length) cards.push('<div class="pv-empty">No saved vendors yet.</div>');
      return '<section class="pv-category" data-category="'+esc(category)+'"><div class="pv-categoryHead"><div><div class="pv-categoryTitle">'+esc(category)+'</div></div><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><span class="pv-count">'+rows.length+' saved</span><button class="pv-categoryToggle" type="button" data-toggle-category="'+esc(category)+'">Collapse ▾</button></div></div><div class="pv-grid">'+cards.join('')+'</div></section>';
    }).join('');
    txt('pv_count', vendors.length + ' vendor' + (vendors.length===1?'':'s') + ' showing' + ((state.context && state.context.company) ? ' · ' + state.context.company : ''));
  }
  function resetForm(){
    ['pv_vendorName','pv_contactName','pv_phone','pv_email','pv_notes'].forEach(function(id){ var el=$(id); if(el) el.value=''; });
    if($('pv_vendorType')) $('pv_vendorType').value='';
    if($('pv_editKey')) $('pv_editKey').value='';
    if($('pv_cancelBtn')) $('pv_cancelBtn').classList.add('pv-hidden');
    if($('pv_saveBtn')) $('pv_saveBtn').textContent='Save Vendor';
    setStatus('', '');
  }
  function fillForm(v){
    if(!v) return;
    $('pv_vendorName').value = v.vendorName || '';
    $('pv_vendorType').value = v.vendorType || '';
    $('pv_contactName').value = v.contactName || '';
    $('pv_phone').value = v.phone || '';
    $('pv_email').value = v.email || '';
    $('pv_notes').value = v.notes || '';
    $('pv_editKey').value = v.vendorKey || '';
    $('pv_saveBtn').textContent = 'Update Vendor';
    $('pv_cancelBtn').classList.remove('pv-hidden');
    document.getElementById('pv_manageCard').scrollIntoView({behavior:'smooth', block:'center'});
  }
  async function onSave(e){
    if(e) e.preventDefault();
    if(state.saving) return;
    try{
      setSaving(true); setStatus('Saving vendor…','');
      if(!isManagerRole()) throw new Error('Your role cannot manage preferred vendors.');
      var name = clean($('pv_vendorName').value);
      if(!name) throw new Error('Vendor name is required.');
      var editKey = clean($('pv_editKey').value);
      var row = {
        vendorKey: editKey || generateKey(),
        vendorName: name,
        vendorType: normalizeCategory($('pv_vendorType').value),
        contactName: clean($('pv_contactName').value),
        phone: clean($('pv_phone').value),
        email: clean($('pv_email').value),
        notes: clean($('pv_notes').value)
      };
      var rows = state.vendors.slice();
      if(editKey){
        var updated = false;
        rows = rows.map(function(v){ if(v.vendorKey === editKey){ updated = true; return row; } return v; });
        if(!updated) rows.unshift(row);
      }else{
        rows.unshift(row);
      }
      await saveVendorRows(rows);
      resetForm();
      renderMarketplace();
      setStatus('Vendor saved.','ok');
    }catch(err){
      state.lastError = String(err && err.message || err);
      setStatus('Vendor was not saved: ' + state.lastError, 'error');
      console.error('Preferred Vendors save failed:', err);
    }finally{
      setSaving(false);
    }
  }
  async function onDelete(key){
    var v = state.vendors.find(function(row){ return row.vendorKey === key; });
    if(!v) return;
    if(!confirm('Remove ' + v.vendorName + ' from preferred vendors?')) return;
    try{
      setStatus('Removing vendor…','');
      var rows = state.vendors.filter(function(row){ return row.vendorKey !== key; });
      await saveVendorRows(rows);
      renderMarketplace();
      setStatus('Vendor removed.','ok');
    }catch(err){ setStatus('Vendor was not removed: ' + (err && err.message ? err.message : String(err)), 'error'); }
  }
  function bindEvents(){
    var form = $('pv_form'); if(form && !form.__pv736){ form.__pv736 = true; form.addEventListener('submit', onSave); }
    var search = $('pv_search'); if(search && !search.__pv736){ search.__pv736 = true; search.addEventListener('input', renderMarketplace); }
    var reset = $('pv_resetFormBtn'); if(reset && !reset.__pv736){ reset.__pv736 = true; reset.addEventListener('click', resetForm); }
    var cancel = $('pv_cancelBtn'); if(cancel && !cancel.__pv736){ cancel.__pv736 = true; cancel.addEventListener('click', resetForm); }
    document.addEventListener('click', function(e){
      var t = e.target;
      if(!t) return;
      var edit = t.closest && t.closest('[data-edit]');
      if(edit){ fillForm(state.vendors.find(function(v){ return v.vendorKey === edit.getAttribute('data-edit'); })); return; }
      var del = t.closest && t.closest('[data-delete]');
      if(del){ onDelete(del.getAttribute('data-delete')); return; }
      var tog = t.closest && t.closest('[data-toggle-category]');
      if(tog){ var section = tog.closest('.pv-category'); if(section){ section.classList.toggle('is-collapsed'); tog.textContent = section.classList.contains('is-collapsed') ? 'Expand ▸' : 'Collapse ▾'; } }
    });
  }
  async function boot(){
    if(state.booted) return; state.booted = true;
    bindEvents();
    setStatus('Loading preferred vendors…','');
    try{
      await resolveContext(true);
      loadCompanyBrandLogo().catch(function(err){ console.warn('Preferred Vendors company branding logo unavailable:', err && err.message ? err.message : err); });
      var canManage = isManagerRole();
      if($('pv_manageCard')) $('pv_manageCard').style.display = canManage ? '' : 'none';
      await loadVendors();
      renderMarketplace();
      setStatus('Ready.','ok');
      setTimeout(loadSponsorsDeferred, 50);
    }catch(err){
      state.lastError = String(err && err.message || err);
      setStatus('Preferred vendors could not load: ' + state.lastError, 'error');
      txt('pv_count','Preferred vendors unavailable.');
      console.error('Preferred Vendors boot failed:', err);
    }
  }
  window.getPreferredVendorsSupabaseStatus = function(){
    return {
      build: BUILD,
      mode: 'supabase-only-single-controller',
      ok: !state.lastError,
      table: VENDOR_TABLE,
      cloudCount: state.vendors.length,
      company: state.context && state.context.company || '',
      company_id: state.context && state.context.company_id || '',
      companySource: state.context && state.context.source || '',
      community_id: state.context && state.context.community_id || '',
      role: state.context && state.context.role || '',
      loadedAt: state.lastLoadedAt,
      savedAt: state.lastSavedAt,
      error: state.lastError || '',
      sponsorCount: state.sponsors.length,
      brandingLogoLoaded: !!($('pvCompanyLogo') && $('pvCompanyLogo').classList.contains('is-visible')),
      logoSource: 'companies.logo_path / company_logos bucket'
    };
  };
  window.testPreferredVendorSaveClick = async function(){ return onSave({preventDefault:function(){}}).then(function(){ return window.getPreferredVendorsSupabaseStatus(); }); };
  window.reloadPreferredVendors = async function(){ state.lastError=''; await loadVendors(); renderMarketplace(); return window.getPreferredVendorsSupabaseStatus(); };
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true}); else boot();
})();
