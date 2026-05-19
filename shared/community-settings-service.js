/*
  Zummee Community Settings Service v770
  Long-term owner for community-level settings.

  Source of truth:
    PropertyCommunities.weather_zip

  Rules:
    - No hard-coded ZIP defaults.
    - No shared last-ZIP fallback.
    - LocalStorage is a per-community read-through cache only.
    - Manager Hub pages call this service instead of owning ZIP persistence.
*/
(function(){
  if(window.ZummeeCommunitySettings && window.ZummeeCommunitySettings.__version === 'v770') return;

  var CACHE_PREFIX = 'zummee-community-settings:v770:';
  var LEGACY_ZIP_PREFIX = 'mh2-weather-zip:';

  function s(v){ return String(v == null ? '' : v).trim(); }
  function z(v){ return s(v).replace(/\D+/g, '').slice(0, 5); }
  function uuidish(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s(v)); }
  function cacheKey(id){ return CACHE_PREFIX + s(id); }
  function legacyZipKey(id){ return LEGACY_ZIP_PREFIX + s(id); }

  function getSupabaseClient(){
    try{ if(window.supabaseClient && window.supabaseClient.from) return window.supabaseClient; }catch(_e){}
    try{ if(window.sb && window.sb.from) return window.sb; }catch(_e){}
    try{ if(window.getSupabase){ var c = window.getSupabase(); if(c && c.from) return c; } }catch(_e){}
    try{ if(window.ensureSupabaseSync){ var c2 = window.ensureSupabaseSync(); if(c2 && c2.from) return c2; } }catch(_e){}
    return null;
  }

  function readCache(id){
    id = s(id);
    if(!id) return null;
    try{
      var raw = localStorage.getItem(cacheKey(id));
      if(!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    }catch(_e){ return null; }
  }

  function writeCache(id, patch){
    id = s(id);
    if(!id) return null;
    var current = readCache(id) || { id:id };
    var next = Object.assign({}, current, patch || {}, { id:id, updatedAt:Date.now() });
    if(next.weather_zip) next.weather_zip = z(next.weather_zip);
    try{ localStorage.setItem(cacheKey(id), JSON.stringify(next)); }catch(_e){}
    if(next.weather_zip){
      try{ localStorage.setItem(legacyZipKey(id), next.weather_zip); }catch(_e){}
    }
    try{ localStorage.removeItem('mh2-last-weather-zip'); }catch(_e){}
    return next;
  }

  function getCachedWeatherZip(id){
    var cached = readCache(id);
    var out = z(cached && cached.weather_zip);
    if(out) return out;
    try{ return z(localStorage.getItem(legacyZipKey(id))); }catch(_e){ return ''; }
  }

  async function get(id){
    id = s(id);
    if(!uuidish(id)) return { ok:false, id:id, error:'invalid-community-id' };
    var cached = readCache(id) || { id:id };
    var sb = getSupabaseClient();
    if(!sb){
      return { ok:false, id:id, cached:true, settings:cached, error:'supabase-client-unavailable' };
    }
    try{
      var res = await sb.from('PropertyCommunities').select('id,name,weather_zip,zip,zipcode,zip_code,postal_code,updated_at').eq('id', id).maybeSingle();
      if(res.error) throw res.error;
      var row = res.data || {};
      var weatherZip = z(row.weather_zip || row.zip || row.zipcode || row.zip_code || row.postal_code || cached.weather_zip);
      var settings = writeCache(id, {
        name:s(row.name || cached.name),
        weather_zip:weatherZip,
        source:'supabase'
      });
      return { ok:true, id:id, settings:settings, row:row };
    }catch(err){
      return { ok:false, id:id, cached:true, settings:cached, error:err };
    }
  }

  async function updateWeatherZip(id, zip, meta){
    id = s(id);
    zip = z(zip);
    if(!uuidish(id)) return { ok:false, id:id, zip:zip, error:'invalid-community-id' };
    if(zip.length !== 5) return { ok:false, id:id, zip:zip, error:'invalid-weather-zip' };

    writeCache(id, { weather_zip:zip, pending:true, source:s(meta && meta.source) || 'client' });

    var sb = getSupabaseClient();
    if(!sb){
      return { ok:false, cached:true, id:id, zip:zip, error:'supabase-client-unavailable' };
    }

    try{
      var res = await sb.from('PropertyCommunities').update({ weather_zip:zip }).eq('id', id).select('id,name,weather_zip').maybeSingle();
      if(res.error) throw res.error;
      var savedZip = z((res.data && res.data.weather_zip) || zip);
      writeCache(id, { weather_zip:savedZip, pending:false, savedAt:Date.now(), source:'supabase' });
      return { ok:true, id:id, zip:savedZip, row:res.data || null };
    }catch(err){
      console.warn('[ZummeeCommunitySettings v770] weather_zip update blocked or failed', { id:id, zip:zip, error:err });
      writeCache(id, { weather_zip:zip, pending:true, lastError:String(err && (err.message || err.details || err.code) || err) });
      return { ok:false, cached:true, id:id, zip:zip, error:err };
    }
  }

  async function debugWeatherZip(){
    var sel = document.getElementById('zummeeCommunitySelect');
    var rows = [];
    if(sel){
      for(var i=0;i<sel.options.length;i++){
        var opt = sel.options[i];
        var id = s(opt.value);
        var cached = readCache(id) || {};
        rows.push({
          selected:i === sel.selectedIndex,
          community:s(opt.textContent),
          id:id,
          optionZip:z(opt.getAttribute('data-zip')),
          inputZip:i === sel.selectedIndex ? z(document.getElementById('weatherZipInput') && document.getElementById('weatherZipInput').value) : '',
          serviceZip:z(cached.weather_zip),
          pending:!!cached.pending,
          lastError:s(cached.lastError)
        });
      }
    }
    console.table(rows);
    return rows;
  }

  window.ZummeeCommunitySettings = {
    __version:'v770',
    get:get,
    updateWeatherZip:updateWeatherZip,
    getCachedWeatherZip:getCachedWeatherZip,
    writeCache:writeCache,
    readCache:readCache,
    debugWeatherZip:debugWeatherZip
  };
})();
