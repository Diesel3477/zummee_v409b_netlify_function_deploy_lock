/* Zummee global company logo sync — v186
   One logo source for every page: companies.logo_path in Supabase Storage bucket company_logos.
   Static Zummee fallback images are intentionally hidden so old logos never show. */
(function(){
  'use strict';
  function s(v){ return String(v == null ? '' : v).trim(); }
  function client(){
    try{ if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient; }catch(_e){}
    try{ if(window.ZummeeSupabaseClient && typeof window.ZummeeSupabaseClient.from === 'function') return window.ZummeeSupabaseClient; }catch(_e){}
    try{ if(window.sb && typeof window.sb.from === 'function') return window.sb; }catch(_e){}
    try{ if(window.getSupabase && typeof window.getSupabase === 'function'){ var c=window.getSupabase(); if(c && typeof c.from === 'function') return c; }}catch(_e){}
    return null;
  }
  function parseLogoRef(raw){
    raw=s(raw);
    if(!raw) return null;
    if(/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw)) return { url: raw };
    if(raw.indexOf('|') !== -1){ var p=raw.split('|'); return { bucket:p.shift() || 'company_logos', path:p.join('|') }; }
    return { bucket:'company_logos', path:raw };
  }
  function getStoredCompanyId(){
    var keys=['activeCompanyId','zummee_company_id','company_id','selectedCompanyId'];
    for(var i=0;i<keys.length;i++){ try{ var v=s(localStorage.getItem(keys[i])); if(v) return v; }catch(_e){} }
    try{ if(window.__supCompanyId) return s(window.__supCompanyId); }catch(_e){}
    try{ if(window.__zummeeProfile && window.__zummeeProfile.company_id) return s(window.__zummeeProfile.company_id); }catch(_e){}
    return '';
  }
  async function getCompanyIdFromProfile(sb){
    var cid=getStoredCompanyId();
    if(cid) return cid;
    var uid='';
    try{ var u=await sb.auth.getUser(); if(u && u.data && u.data.user) uid=s(u.data.user.id); }catch(_e){}
    if(!uid){
      var uKeys=['zummee_user_id_v1','zummee_user_id','user_id','activeUserId','currentUserId'];
      for(var i=0;i<uKeys.length;i++){ try{ uid=s(localStorage.getItem(uKeys[i])); if(uid) break; }catch(_e){} }
    }
    if(!uid) return '';
    var lookups=[['profiles','id'],['userdirectory','auth_user_id'],['user_profiles','id']];
    for(var j=0;j<lookups.length;j++){
      try{
        var r=await sb.from(lookups[j][0]).select('company_id').eq(lookups[j][1],uid).maybeSingle();
        if(r && r.data && r.data.company_id) return s(r.data.company_id);
      }catch(_e){}
    }
    return '';
  }
  function findLogoImages(){
    var selectors=[
      '#pageCompanyLogo','#companyLogo','#heroBrandLogo','#brandLogo','#managerHubLogo',
      '.company-logo','.brand-logo','.hero-brand-logo','.header-logo',
      'img[src*="Zummee.png"]','img[src*="zummee"]','img[alt*="Zummee"]','img[alt*="Company logo"]'
    ];
    var seen=new Set(), out=[];
    selectors.forEach(function(sel){
      try{ document.querySelectorAll(sel).forEach(function(img){ if(img && img.tagName === 'IMG' && !seen.has(img)){ seen.add(img); out.push(img); } }); }catch(_e){}
    });
    return out;
  }
  function hideStaticLogos(){
    findLogoImages().forEach(function(img){
      var src=s(img.getAttribute('src'));
      if(!src || /Zummee\.png/i.test(src) || /zummee/i.test(src)){
        img.removeAttribute('src');
        img.classList.remove('is-visible');
        img.style.visibility='hidden';
        img.style.opacity='0';
      }
    });
  }
  function paint(url, alt){
    findLogoImages().forEach(function(img){
      img.onerror=function(){ img.removeAttribute('src'); img.classList.remove('is-visible'); img.style.visibility='hidden'; img.style.opacity='0'; };
      img.onload=function(){ img.style.visibility='visible'; img.style.opacity='1'; img.classList.add('is-visible','is-company'); };
      img.alt=alt || 'Company logo';
      img.src=url;
      img.style.visibility='visible';
    });
  }
  async function sync(){
    hideStaticLogos();
    var sb=client();
    if(!sb) return;
    var cid=await getCompanyIdFromProfile(sb);
    if(!cid) return;
    try{
      var r=await sb.from('companies').select('name,logo_path').eq('id',cid).maybeSingle();
      if(r && r.data){
        var ref=parseLogoRef(r.data.logo_path);
        if(!ref){ hideStaticLogos(); return; }
        var url=s(ref.url);
        if(!url && ref.bucket && ref.path && sb.storage && sb.storage.from){
          var pub=sb.storage.from(ref.bucket).getPublicUrl(ref.path);
          url=s(pub && pub.data && pub.data.publicUrl);
        }
        if(url) paint(url, s(r.data.name) || 'Company logo');
      }
    }catch(e){ console.warn('Zummee company logo sync failed', e); }
  }
  window.zummeeSyncCompanyLogo = sync;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(sync,250); setTimeout(sync,1200); }, {once:true});
  else { setTimeout(sync,250); setTimeout(sync,1200); }
})();