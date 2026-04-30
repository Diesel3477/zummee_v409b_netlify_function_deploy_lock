(function(){
  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; });
  }
  function byId(id){ return document.getElementById(id); }
  function getPanel(){ return byId('managerSupervisorCommsPanel'); }
  function getBody(){ return byId('managerSupervisorCommsBody'); }
  function forcePanelVisible(){
    var panel = getPanel();
    if(!panel) return;
    try{ panel.style.setProperty('display', 'block', 'important'); }catch(_e){ panel.style.display = 'block'; }
    panel.hidden = false;
    panel.setAttribute('data-supervisor-comms-visible', '1');
  }
  function getActiveCommunityIdSafe(){
    try{
      var el = document.getElementById('zummeeCommunitySelect') || document.querySelector('#communitySelect') || document.querySelector('[data-community-select]');
      var val = el && el.value ? String(el.value).trim() : '';
      if(val) return val;
    }catch(_e){}
    try{
      var winVal = String(window.selectedCommunityId || window.currentCommunityId || '').trim();
      if(winVal) return winVal;
    }catch(_e1){}
    try{ return String(localStorage.getItem('zummee_active_community_id_v1') || localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_selected_community_id') || '').trim(); }catch(_e2){ return ''; }
  }
  function getCompanyNameSafeLocal(){
    try{
      var direct = String(localStorage.getItem('zummee_selected_company_name_v1') || localStorage.getItem('zummeeActiveCompanyName') || localStorage.getItem('company_name') || '').trim();
      if(direct) return direct;
      for(var i=0;i<localStorage.length;i++){
        var key = localStorage.key(i) || '';
        var prefix = 'zummee_company_communities_v1__';
        if(key.indexOf(prefix) === 0){
          return key.slice(prefix.length).trim();
        }
      }
    }catch(_e){}
    return '';
  }
  function companyKey(){
    var company = getCompanyNameSafeLocal() || 'default-company';
    return 'dailyOpsV2:supervisorComms:company:' + String(company).toLowerCase();
  }
  function communityKey(){
    var communityId = getActiveCommunityIdSafe();
    return 'dailyOpsV2:supervisorComms:community:' + String(communityId || '').trim();
  }
  function sharedCompanyPrefKey(){
    var company = getCompanyNameSafeLocal() || 'default-company';
    return 'daily_ops_v2_supervisor_comms__company__' + String(company).toLowerCase();
  }
  function sharedCommunityPrefKey(){
    var communityId = getActiveCommunityIdSafe();
    return 'daily_ops_v2_supervisor_comms__community__' + String(communityId || '').trim();
  }
  async function loadSharedRows(scope){
    try{
      if(!(window.sb && typeof window.sb.from === 'function')) return null;
      if(typeof getUserId !== 'function') return null;
      var uid = String(getUserId() || '').trim();
      if(!uid) return null;
      var res = await window.sb.from('user_ui_prefs')
        .select('pref_value')
        .eq('user_id', uid)
        .eq('pref_key', scope === 'Company-wide' ? sharedCompanyPrefKey() : sharedCommunityPrefKey())
        .maybeSingle();
      var value = res && res.data && res.data.pref_value;
      var rows = value && Array.isArray(value.rows) ? value.rows : (Array.isArray(value) ? value : null);
      return Array.isArray(rows) ? rows : null;
    }catch(_e){ return null; }
  }
  async function loadDbRows(){
    try{
      var sb = window.sb && typeof window.sb.from === 'function' ? window.sb : null;
      var communityId = getActiveCommunityIdSafe();
      console.log('[SupervisorComms] db load start');
      console.log('[SupervisorComms] selected community id =', communityId || null);
      if(!sb || !communityId) return [];
      var result = await sb
        .from('supervisor_messages')
        .select('id, community_id, message, created_by, created_at')
        .eq('community_id', communityId)
        .order('created_at', { ascending:false })
        .limit(10);
      if(result && result.error){
        console.error('[SupervisorComms] db query error =', result.error);
        return [];
      }
      var rows = Array.isArray(result && result.data) ? result.data : [];
      console.log('[SupervisorComms] db rows returned =', rows.length);
      console.log('[SupervisorComms] db rows =', rows);
      return rows.map(function(row){
        return {
          id: row.id || ('db_' + String(row.created_at || Date.now())),
          title: row.message || 'Supervisor communication',
          type: 'Supervisor Message',
          scope: 'Community',
          rule: 'Needs Review',
          notes: '',
          date: '',
          createdAt: row.created_at || '',
          updatedAt: row.created_at || '',
          createdBy: row.created_by || '',
          _source: 'db',
          _dbCommunityId: row.community_id || ''
        };
      });
    }catch(err){
      console.error('[SupervisorComms] db fatal load error =', err);
      return [];
    }
  }
  function safeJson(raw, fallback){ try{ var v = JSON.parse(raw); return v == null ? fallback : v; }catch(_e){ return fallback; } }
  function getStatus(row){
    if(row && row.completedAt) return { label:'Completed', tone:'completed' };
    if(row && row._source === 'db') return { label:'Needs Review', tone:'review' };
    var due = row && row.date ? new Date(String(row.date) + 'T00:00:00') : null;
    if(!due || isNaN(due)) return { label:'Needs Review', tone:'review' };
    var today = new Date(); today.setHours(0,0,0,0);
    var diff = Math.round((due - today)/86400000);
    if(diff < 0) return { label:'Overdue', tone:'overdue' };
    if(diff <= 7) return { label:'Due Soon', tone:'soon' };
    return { label:'Upcoming', tone:'upcoming' };
  }
  function actionable(rows){
    return (rows || []).filter(function(row){
      if(row && row._source === 'db') return true;
      var status = getStatus(row);
      return status.tone === 'overdue' || status.tone === 'soon' || status.tone === 'review';
    });
  }
  function readRows(){
    var companyRows = safeJson(localStorage.getItem(companyKey()) || '[]', []);
    var communityRows = safeJson(localStorage.getItem(communityKey()) || '[]', []);
    companyRows = Array.isArray(companyRows) ? companyRows.map(function(r){ return Object.assign({}, r, { scope:'Company-wide' }); }) : [];
    communityRows = Array.isArray(communityRows) ? communityRows.map(function(r){ return Object.assign({}, r, { scope:'Community' }); }) : [];
    return actionable(companyRows.concat(communityRows)).sort(function(a,b){
      return String(a.date || '').localeCompare(String(b.date || '')) || String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''));
    });
  }
  function scopeTone(scope){
    return scope === 'Company-wide'
      ? 'background:rgba(255,246,214,.95);color:#8b6100;border:1px solid rgba(139,97,0,.12);'
      : 'background:#eef4fb;color:#29507f;border:1px solid rgba(41,80,127,.10);';
  }
  function statusTone(tone){
    var map = {
      overdue:'background:rgba(255,234,234,.95);color:#8f2f2f;border:1px solid rgba(143,47,47,.12);',
      soon:'background:rgba(255,244,214,.95);color:#8b6100;border:1px solid rgba(139,97,0,.12);',
      review:'background:#eef2f7;color:#35516e;border:1px solid rgba(23,50,77,.08);',
      completed:'background:rgba(226,252,236,.95);color:#1b6b3d;border:1px solid rgba(27,107,61,.12);',
      upcoming:'background:#eff6ff;color:#234b7a;border:1px solid rgba(35,75,122,.12);'
    };
    return map[tone] || map.upcoming;
  }
  function formatWhen(value){
    if(!value) return '';
    try{
      var d = new Date(value);
      if(isNaN(d)) return '';
      return d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
    }catch(_e){ return ''; }
  }
  function mergeRows(dbRows, localRows){
    var seen = {};
    var merged = [];
    (dbRows || []).concat(localRows || []).forEach(function(row){
      var key = String((row && row._source === 'db' ? 'db:' + (row.id || row.createdAt || row.title) : 'local:' + (row.id || row.title || row.date || Math.random())) || '');
      if(seen[key]) return;
      seen[key] = true;
      merged.push(row);
    });
    return merged.sort(function(a,b){
      return String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')) || String(a.date||'').localeCompare(String(b.date||''));
    });
  }
  async function render(){
    var panel = getPanel();
    var body = getBody();
    if(!body || !panel) return;
    forcePanelVisible();
    console.log('[SupervisorComms] render start');
    console.log('[SupervisorComms] panel found =', !!panel);
    console.log('[SupervisorComms] body found =', !!body);
    var localRows = readRows();
    if(!localRows.length){
      try{
        var sharedCompany = await loadSharedRows('Company-wide');
        var sharedCommunity = await loadSharedRows('Community');
        if(Array.isArray(sharedCompany)) localStorage.setItem(companyKey(), JSON.stringify(sharedCompany));
        if(Array.isArray(sharedCommunity)) localStorage.setItem(communityKey(), JSON.stringify(sharedCommunity));
        localRows = readRows();
      }catch(_e){}
    }
    var dbRows = await loadDbRows();
    var rows = mergeRows(dbRows, localRows);
    console.log('[SupervisorComms] final render count =', rows.length);
    if(!rows.length){
      body.innerHTML = '<div class="board-items-panel__empty">No supervisor communications need attention for this community right now.</div>';
      console.log('[SupervisorComms] rendered empty state');
      return;
    }
    body.innerHTML = rows.slice(0,6).map(function(row){
      var status = getStatus(row);
      var meta = [row.type || 'Required Task'];
      if(row.rule) meta.push(row.rule);
      if(row.date) meta.push('Due ' + row.date);
      if(row._source === 'db'){
        var when = formatWhen(row.createdAt);
        if(when) meta.push('Posted ' + when);
      }
      return '<div class="board-items-row">'
        + '<div>'
          + '<div class="board-items-row__title">' + esc(row.title || 'Supervisor communication') + '</div>'
          + '<div class="board-items-row__meta">' + esc(meta.join(' • ')) + '</div>'
          + (row.notes ? '<div class="board-items-row__desc">' + esc(row.notes) + '</div>' : '')
        + '</div>'
        + '<div class="board-items-row__actions">'
          + '<div class="metaPill" style="' + scopeTone(row.scope || 'Community') + '">' + esc(row.scope || 'Community') + '</div>'
          + '<div class="metaPill" style="' + statusTone(status.tone) + '">' + esc(status.label) + '</div>'
          + '<a class="board-items-btn primary" href="daily_ops_rebuild.html#supervisorCommsCard">Open</a>'
        + '</div>'
      + '</div>';
    }).join('');
    console.log('[SupervisorComms] rendered rows into DOM');
    console.log('[SupervisorComms] final HTML length =', body.innerHTML.length);
  }
  function scheduleRender(delay){ setTimeout(function(){ Promise.resolve(render()).catch(function(err){ console.error('[SupervisorComms] render error =', err); }); }, delay || 0); }
  function bindCommunitySelect(){
    try{
      var el = document.getElementById('zummeeCommunitySelect') || document.querySelector('#communitySelect') || document.querySelector('[data-community-select]');
      if(!el || el.__supervisorCommsBound) return;
      el.__supervisorCommsBound = true;
      el.addEventListener('change', function(){
        console.log('[SupervisorComms] community dropdown changed to', el.value || null);
        scheduleRender(20);
      });
    }catch(_e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', function(){ bindCommunitySelect(); scheduleRender(0); scheduleRender(300); scheduleRender(900); });
  else { bindCommunitySelect(); scheduleRender(0); scheduleRender(300); scheduleRender(900); }
  document.addEventListener('community:changed', function(){ bindCommunitySelect(); scheduleRender(40); });
  window.addEventListener('focus', function(){ bindCommunitySelect(); scheduleRender(40); });
  window.addEventListener('storage', function(){ bindCommunitySelect(); scheduleRender(40); });
})();
