
    (function(){
      function $(id){ return document.getElementById(id); }

      window.applyThemeMode = function applyThemeMode(theme){
        var resolved = theme === 'dark' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', resolved);
        try{ localStorage.setItem('mh2-theme', resolved); }catch(_e){}
        var btn = $('mh2ThemeToggleBtn');
        if(btn){
          var isDark = resolved === 'dark';
          btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
          btn.textContent = isDark ? 'Light mode' : 'Dark mode';
        }
      }

      window.wireThemeToggle = function wireThemeToggle(){
        var btn = $('mh2ThemeToggleBtn');
        if(!btn || btn.dataset.themeWired === '1') return;
        btn.dataset.themeWired = '1';
        btn.addEventListener('click', function(){
          var current = String(document.documentElement.getAttribute('data-theme') || 'light').toLowerCase();
          applyThemeMode(current === 'dark' ? 'light' : 'dark');
        });
        var stored = 'light';
        try{ stored = String(localStorage.getItem('mh2-theme') || document.documentElement.getAttribute('data-theme') || 'light'); }catch(_e){}
        applyThemeMode(stored);
      }

      function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]; }); }
      function ensureSb(){
        try{
          if(window.sb && typeof window.sb.from === 'function') return window.sb;
          if(window.supabaseClient && typeof window.supabaseClient.from === 'function') return window.supabaseClient;
          if(window.getSupabase && typeof window.getSupabase === 'function'){
            var c = window.getSupabase();
            if(c && typeof c.from === 'function') return c;
          }
        }catch(_e){}
        return null;
      }
      async function requireSb(){
        var existing = ensureSb();
        if(existing) return existing;
        var start = Date.now();
        while(Date.now() - start < 5000){
          await new Promise(function(r){ setTimeout(r, 80); });
          existing = ensureSb();
          if(existing) return existing;
        }
        throw new Error('Supabase client unavailable');
      }
      async function getUid(){
        var sb = await requireSb();
        try{
          var res = await sb.auth.getUser();
          return String(res && res.data && res.data.user && res.data.user.id || '').trim();
        }catch(_e){ return ''; }
      }
      async function getMyCompany(){
        var sb = await requireSb();
        var uid = await getUid();
        if(!uid) throw new Error('User not signed in');
        var q = await sb.from('profiles').select('company,company_id,selected_community_id').eq('id', uid).maybeSingle();
        if(q.error) throw q.error;
        var d = q.data || {};
        return { uid:uid, company:String(d.company||'').trim(), company_id:String(d.company_id||'').trim(), selected:String(d.selected_community_id||'').trim() };
      }
      async function loadCommunities(){
        var sb = await requireSb();
        var ctx = await getMyCompany();
        var companyId = String(ctx.company_id || '').trim();
        if(!companyId) return [];
        var q = await sb
          .from('PropertyCommunities')
          .select('id,name,company_id,company,created_at')
          .eq('company_id', companyId)
          .order('name',{ascending:true});
        if(q.error) throw q.error;
        var rows = Array.isArray(q.data) ? q.data : [];
        try{
          console.info('[MH2] communities loaded for company_id', companyId, 'count=', rows.length);
        }catch(_e){}
        return rows;
      }
      console.info('[MH2] loadCommunities function defined');
      console.info('[MH2] renderCommunities/global boot hooks exported');

      async function ensureDefaultCommunityCloud(){
        var sb = await requireSb();
        var ctx = await getMyCompany();
        var list = await loadCommunities();
        if(!list.length) return { list:[], selected:'' };

        var validIds = list.map(function(x){ return String(x.id || '').trim(); }).filter(Boolean);
        var stored = String(getStoredCommunityToken() || '').trim();
        var selected = String(ctx.selected || '').trim();

        if(!selected || validIds.indexOf(selected) === -1){
          selected = (stored && validIds.indexOf(stored) >= 0) ? stored : String(list[0].id || '').trim();
          if(selected && selected !== String(ctx.selected || '').trim()){
            var up = await sb.from('profiles').update({ selected_community_id:selected }).eq('id', ctx.uid);
            if(up.error) throw up.error;
          }
        }

        if(stored && validIds.indexOf(stored) === -1){
          try{ localStorage.removeItem('zummee_selected_community_id'); }catch(_e){}
          try{ localStorage.removeItem('activeCommunityId'); }catch(_e){}
          try{ localStorage.removeItem('zummeeActiveCommunityId'); }catch(_e){}
          try{ localStorage.removeItem('currentCommunityId'); }catch(_e){}
        }

        return { list:list, selected:selected };
      }
      var mh2CommunityListCache = [];
      var ctxCache = { id:'', name:'', zip:'', raw:'' };
      function syncCommunityGlobals(ctx){
        ctx = ctx || { id:'', name:'', zip:'', raw:'' };
        ctxCache = {
          id: String(ctx.id || '').trim(),
          name: String(ctx.name || '').trim(),
          zip: String(ctx.zip || '').trim(),
          raw: String(ctx.raw || '').trim()
        };
        try{ window.currentCommunityId = ctxCache.id; }catch(_e){}
        try{ window.activeCommunityId = ctxCache.id; }catch(_e){}
        try{ window.selectedCommunityId = ctxCache.id; }catch(_e){}
        try{ window.currentCommunityName = ctxCache.name; }catch(_e){}
        try{ window.getActiveCommunityId = function(){ return String(ctxCache.id || '').trim(); }; }catch(_e){}
        try{ window.getSelectedCommunityName = function(){ return String(ctxCache.name || '').trim(); }; }catch(_e){}
        return ctxCache;
      }
      function persistSelectedCommunity(v, name){
        v = String(v || '').trim();
        name = String(name || '').trim();
        try{ localStorage.setItem('zummee_selected_community_id', v); }catch(_e){}
        try{ localStorage.setItem('activeCommunityId', v); }catch(_e){}
        try{ localStorage.setItem('zummeeActiveCommunityId', v); }catch(_e){}
        try{ localStorage.setItem('currentCommunityId', v); }catch(_e){}
        if(name){
          try{ localStorage.setItem('currentCommunityName', name); }catch(_e){}
          try{ localStorage.setItem('zummeeCurrentCommunityName', name); }catch(_e){}
        }
      }
      function getStoredCommunityToken(){
        try{
          return String(localStorage.getItem('zummeeActiveCommunityId') || localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_selected_community_id') || '').trim();
        }catch(_e){ return ''; }
      }
      function findCommunityInList(token){
        token = String(token || '').trim();
        if(!token) return null;
        var normalized = token.toLowerCase();
        for(var i=0;i<mh2CommunityListCache.length;i++){
          var row = mh2CommunityListCache[i] || {};
          var id = String(row.id || '').trim();
          var name = String(row.name || '').trim();
          if(id && id === token) return row;
          if(name && name.toLowerCase() === normalized) return row;
        }
        return null;
      }
      function getActiveCommunityContext(){
        var el = $('zummeeCommunitySelect');
        var raw = '';
        var selectedOption = null;
        if(el){
          raw = String(el.value || '').trim();
          if(el.selectedIndex >= 0 && el.options[el.selectedIndex]) selectedOption = el.options[el.selectedIndex];
          if(selectedOption && String(selectedOption.value || '').trim()){
            var selectedId = String(selectedOption.value || '').trim();
            var selectedName = String(selectedOption.textContent || '').trim();
            var selectedZip = String(selectedOption.getAttribute('data-zip') || '').trim();
            if(selectedId){
              if(raw !== selectedId) el.value = selectedId;
              persistSelectedCommunity(selectedId, selectedName);
              return syncCommunityGlobals({ id:selectedId, name:selectedName, zip:selectedZip, raw:raw || selectedId });
            }
          }
        }
        var fallback = findCommunityInList(raw) || findCommunityInList(getStoredCommunityToken());
        if(fallback){
          var id = String(fallback.id || '').trim();
          var name = String(fallback.name || '').trim();
          var zip = String(fallback.zip || '').trim();
          if(el && id){
            if(el.value !== id) el.value = id;
            var opt = null;
            for(var oi=0; oi<el.options.length; oi++){ if(String(el.options[oi].value || '').trim() === id){ opt = el.options[oi]; break; } }
            if(opt) selectedOption = opt;
          }
          if(id) persistSelectedCommunity(id, name);
          return syncCommunityGlobals({ id:id, name:name, zip:zip, raw:raw || id || name });
        }
        return syncCommunityGlobals({ id:'', name:(selectedOption ? String(selectedOption.textContent || '').trim() : ''), zip:(selectedOption ? String(selectedOption.getAttribute('data-zip') || '').trim() : ''), raw:raw });
      }
      function getActiveCommunityId(){
        var winVal = '';
        try{ winVal = String(window.currentCommunityId || window.activeCommunityId || window.selectedCommunityId || '').trim(); }catch(_e){}
        if(winVal) return winVal;
        if(ctxCache && ctxCache.id) return String(ctxCache.id).trim();
        return String((getActiveCommunityContext() || {}).id || '').trim();
      }
      function getSelectedCommunityName(){
        var winVal = '';
        try{ winVal = String(window.currentCommunityName || '').trim(); }catch(_e){}
        if(winVal) return winVal;
        if(ctxCache && ctxCache.name) return String(ctxCache.name).trim();
        return String((getActiveCommunityContext() || {}).name || '').trim();
      }
      
      function weatherZipStorageKey(id){
        return 'mh2-weather-zip:' + String(id || '').trim();
      }
      function getPersistedWeatherZip(id, fallback){
        fallback = String(fallback || '').trim();
        try{
          var key = weatherZipStorageKey(id);
          var stored = localStorage.getItem(key);
          if(stored !== null) return String(stored || '').trim();
          return fallback;
        }catch(_e){ return fallback; }
      }
      function persistWeatherZipForCommunity(id, zip){
        id = String(id || '').trim();
        zip = String(zip || '').replace(/\D+/g,'').slice(0,10);
        if(!id) return;
        try{ localStorage.setItem(weatherZipStorageKey(id), zip); }catch(_e){}
        try{ localStorage.setItem('mh2-last-weather-zip', zip); }catch(_e){}
      }
      function preloadWeatherContextFromBoot(){
        observeWeatherRiskBadge();
        var boot = window.__mh2BootWeather || {};
        var zipInput = $('weatherZipInput');
        var label = $('weatherLocationLabel');
        if(label && boot.communityName){
          label.textContent = boot.communityName + ' · Atlanta area';
          label.classList.add('mh2-is-ready');
        }
        if(zipInput){
          zipInput.value = String(boot.zip || '').trim();
          if(zipInput.value){
            zipInput.classList.add('mh2-is-ready');
          }else{
            zipInput.classList.remove('mh2-is-ready');
          }
        }
      }
      function applyWeatherContext(ctx){
        ctx = ctx || getActiveCommunityContext() || {};
        var communityId = String(ctx.id || '').trim();
        var communityName = String(ctx.name || '').trim();
        var fallbackZip = String(ctx.zip || '').trim();
        var zipInput = $('weatherZipInput');
        var label = $('weatherLocationLabel');
        if(label){
          label.textContent = communityName ? (communityName + ' · Atlanta area') : 'Atlanta area';
          label.classList.add('mh2-is-ready');
        }
        if(zipInput){
          var currentValue = String(zipInput.value || '').trim();
          var resolvedZip = getPersistedWeatherZip(communityId, fallbackZip || currentValue);
          zipInput.value = resolvedZip;
          if(resolvedZip){
            zipInput.classList.add('mh2-is-ready');
          }else{
            zipInput.classList.remove('mh2-is-ready');
          }
        }
        if(communityId){
          try{
            localStorage.setItem('currentCommunityName', communityName || '');
            localStorage.setItem('zummeeCurrentCommunityName', communityName || '');
          }catch(_e){}
        }
        try{
          window.__mh2BootWeather = { communityId:communityId, communityName:communityName, zip:String((zipInput && zipInput.value) || '').trim() };
        }catch(_e){}
        var select = $('zummeeCommunitySelect');
        syncWeatherEmergencyPill();
        if(select && select.selectedIndex >= 0){
          var opt = select.options[select.selectedIndex];
          if(opt && zipInput){
            var currentZip = String(zipInput.value || '').trim();
            if(currentZip) opt.setAttribute('data-zip', currentZip);
          }
        }
      }

      window.renderCommunities = async function renderCommunities(){
        var sb = await requireSb();
        var select = $('zummeeCommunitySelect');
        if(!select) return;
        var zipInput = $('weatherZipInput');
        preloadWeatherContextFromBoot();
        var payload = await ensureDefaultCommunityCloud();
        mh2CommunityListCache = Array.isArray(payload.list) ? payload.list.slice() : [];
        try{
          window.__mh2Communities = mh2CommunityListCache.slice();
          window.__mh2CommunityCount = mh2CommunityListCache.length;
          console.info('[MH2] renderCommunities loaded', mh2CommunityListCache.length, 'communities');
        }catch(_e){}
        select.innerHTML = '';
        (payload.list || []).forEach(function(c){
          var opt = document.createElement('option');
          opt.value = String(c.id);
          opt.setAttribute('data-community-id', String(c.id));
          opt.textContent = c.name;
          if(c.zip) opt.setAttribute('data-zip', String(c.zip));
          select.appendChild(opt);
        });

        var validIds = (payload.list || []).map(function(c){ return String(c.id || '').trim(); }).filter(Boolean);
        var preferredId = String(payload.selected || '').trim();
        var storedId = String(getStoredCommunityToken() || '').trim();
        var resolvedSelected = '';
        if(preferredId && validIds.indexOf(preferredId) >= 0){
          resolvedSelected = preferredId;
        }else if(storedId && validIds.indexOf(storedId) >= 0){
          resolvedSelected = storedId;
        }else if(validIds.length){
          resolvedSelected = validIds[0];
        }

        if(resolvedSelected){
          select.value = resolvedSelected;
        }else{
          select.value = '';
        }

        select.disabled = !(payload.list && payload.list.length);
        persistSelectedCommunity(String(select.value || '').trim(), String((select.options[select.selectedIndex] && select.options[select.selectedIndex].textContent) || '').trim());
        syncCommunityGlobals({ id:String(select.value || '').trim(), name:String((select.options[select.selectedIndex] && select.options[select.selectedIndex].textContent) || '').trim(), zip:String((select.options[select.selectedIndex] && select.options[select.selectedIndex].getAttribute('data-zip')) || '').trim(), raw:String(select.value || '').trim() });
        if(zipInput){
          var opt = select.options[select.selectedIndex];
          zipInput.value = getPersistedWeatherZip(String(select.value || '').trim(), String(opt && opt.getAttribute('data-zip') || '').trim());
          zipInput.addEventListener('input', function(){
            var digits = String(zipInput.value || '').replace(/\D+/g,'').slice(0,5);
            if(zipInput.value !== digits) zipInput.value = digits;
            if(digits){
              zipInput.classList.add('mh2-is-ready');
            }else{
              zipInput.classList.remove('mh2-is-ready');
            }
          });
          zipInput.addEventListener('change', function(){
            var digits = String(zipInput.value || '').replace(/\D+/g,'').slice(0,5);
            zipInput.value = digits;
            persistWeatherZipForCommunity(String(select.value || '').trim(), digits);
            applyWeatherContext(getActiveCommunityContext());
            loadWeatherHub(true);
          });
          zipInput.addEventListener('blur', function(){
            var digits = String(zipInput.value || '').replace(/\D+/g,'').slice(0,5);
            zipInput.value = digits;
            persistWeatherZipForCommunity(String(select.value || '').trim(), digits);
            applyWeatherContext(getActiveCommunityContext());
            loadWeatherHub(true);
          });
        }
        applyWeatherContext(getActiveCommunityContext());
        select.onchange = async function(){
          try{
            var v = String(select.value || '').trim();
            if(!v) return;
            persistSelectedCommunity(v, String((select.options[select.selectedIndex] && select.options[select.selectedIndex].textContent) || '').trim());
            syncCommunityGlobals({ id:v, name:String((select.options[select.selectedIndex] && select.options[select.selectedIndex].textContent) || '').trim(), zip:String((select.options[select.selectedIndex] && select.options[select.selectedIndex].getAttribute('data-zip')) || '').trim(), raw:v });
            var ctx = await getMyCompany();
            var up = await sb.from('profiles').update({ selected_community_id:v }).eq('id', ctx.uid);
            if(up.error) throw up.error;
            var opt = select.options[select.selectedIndex];
            if(zipInput) zipInput.value = getPersistedWeatherZip(v, String(opt && opt.getAttribute('data-zip') || '').trim());
            applyWeatherContext(getActiveCommunityContext());
            loadWeatherHub(true);
            document.dispatchEvent(new CustomEvent('community:changed', { detail:{ community_id:v, community_name:getSelectedCommunityName() } }));
            setTimeout(applySmartAlertStatesAndSort, 40);
            window.dispatchEvent(new CustomEvent('community:changed', { detail:{ community_id:v, community_name:getSelectedCommunityName() } }));
          }catch(e){
            alert('Community select failed: ' + (e && e.message || e));
          }
        };
      }
      function normalizeStatus(s){ return String(s||'').trim().toLowerCase(); }
      function isCompleteRow(r){
        try{
          if(r && r.completed_at) return true;
          var st = normalizeStatus(r && r.status);
          if(['complete','completed','closed','done','resolved'].indexOf(st) !== -1) return true;
          return /__ZUMMEE_BM_STATUS__:\s*COMPLETE\|/i.test(String((r && r.details)||''));
        }catch(_e){ return false; }
      }
      function hasConvertedMarker(r){
        try{ return /__ZUMMEE_BM_CONVERTED__:\s*RWO\|/i.test(String((r && r.details)||'')); }catch(_e){ return false; }
      }
      function shouldCountAsOpenRow(r){ return !isCompleteRow(r) && !hasConvertedMarker(r); }
      function isOverdueRow(r){
        try{
          if(!shouldCountAsOpenRow(r) || !r || !r.due_date) return false;
          var due = new Date(String(r.due_date) + 'T00:00:00');
          if(isNaN(due.getTime())) return false;
          var now = new Date();
          var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          return due < today;
        }catch(_e){ return false; }
      }
      function stripMarkers(details){
        var t = String(details || '');
        t = t.replace(/\n\n__ZUMMEE_BM_STATUS__:[\s\S]*$/i,'');
        t = t.replace(/\n\n__ZUMMEE_BM_PHOTO__:[^\n]+\s*/ig,'');
        t = t.replace(/\n\n__ZUMMEE_BM_CONVERTED__:[^\n]+\s*/ig,'');
        return t.trim();
      }
      
      function setAlertCard(id, cfg){
        var el = $(id);
        if(!el) return;
        cfg = cfg || {};
        var tone = String(cfg.tone || 'good').toLowerCase();
        el.classList.remove('is-urgent','is-attention','is-good');
        el.classList.add(tone === 'urgent' ? 'is-urgent' : (tone === 'attention' ? 'is-attention' : 'is-good'));
        if(cfg.href) el.setAttribute('href', cfg.href);
        el.innerHTML = '<div class="mh2-alert-top"><div class="mh2-alert-title">' + esc(String(cfg.title || 'Alert')) + '</div><div class="mh2-alert-badge">' + esc(String(cfg.badge || 'Status')) + '</div></div>' +
          '<div class="mh2-alert-copy">' + esc(String(cfg.copy || '')) + '</div>';
      }
      function daysUntil(dateStr){
        if(!dateStr) return null;
        var d = new Date(dateStr);
        if(isNaN(d.getTime())) return null;
        var now = new Date();
        now.setHours(0,0,0,0);
        d.setHours(0,0,0,0);
        return Math.round((d.getTime()-now.getTime())/86400000);
      }

      function fmtAgo(iso){
        try{
          var d = new Date(iso);
          if(isNaN(d.getTime())) return '';
          var diff = Math.max(0, Date.now() - d.getTime());
          var mins = Math.round(diff/60000);
          if(mins < 1) return 'Now';
          if(mins < 60) return mins + ' min';
          var hrs = Math.round(mins/60);
          if(hrs < 24) return hrs + ' hr';
          var days = Math.round(hrs/24);
          if(days < 7) return days + ' day';
          return d.toLocaleDateString();
        }catch(_e){ return ''; }
      }
      function setText(id, value){ var el=$(id); if(el) el.textContent = value; }
      function setHtml(id, value){ var el=$(id); if(el) el.innerHTML = value; }
      function updateBoardSummary(rows){
        rows = Array.isArray(rows) ? rows : [];
        var open = rows.filter(shouldCountAsOpenRow);
        var overdue = open.filter(isOverdueRow);
        setText('mh2BoardItemsPill', String(open.length));
        setText('mh2BoardStatusPill', overdue.length ? 'Overdue ' + overdue.length : (open.length ? 'Open ' + open.length : 'Clear'));
        setText('mh2BoardOverdueCount', String(overdue.length));
        setText('mh2BoardOverdueNote', overdue.length ? ('Needs review in ' + (ctxCache && ctxCache.name ? ctxCache.name : 'selected community') + '.') : 'Past-due board items for the selected community.');
        var statusBody = $('managerBoardHubStatusBody');
        if(statusBody){
          if(!open.length){
            statusBody.innerHTML = '<div class="mh2-placeholder">No open board-submitted items for this community.</div>';
          }else{
            statusBody.innerHTML = '<div class="mh2-list">' +
              '<article class="mh2-list-item"><div><div class="mh2-item-title">Open board items</div><div class="mh2-item-copy">Current submitted items waiting for manager review or conversion into work orders.</div></div><div class="mh2-item-tag">' + esc(String(open.length)) + '</div></article>' +
              '<article class="mh2-list-item"><div><div class="mh2-item-title">Overdue board items</div><div class="mh2-item-copy">Items past the local due date for the selected community.</div></div><div class="mh2-item-tag">' + esc(String(overdue.length)) + '</div></article>' +
              '</div>';
          }
        }
        setAlertCard('mh2AlertBoard', {
          tone: overdue.length ? 'urgent' : (open.length ? 'attention' : 'good'),
          title: overdue.length ? 'Board review overdue' : 'Board review status',
          badge: overdue.length ? 'URGENT' : (open.length ? 'OPEN' : 'STABLE'),
          copy: open.length
            ? (esc(String(open.length)) + ' open item' + (open.length===1?'':'s') + (overdue.length ? ', ' + esc(String(overdue.length)) + ' overdue.' : ' ready for review.'))
            : 'No open board items for the selected community.',
          href: 'board_member_hub.html'
        });
        var staticCard = $('boardItemsStaticCard');
        if(staticCard){ staticCard.setAttribute('data-open-count', String(open.length)); }
      }
      async function loadBoardItemsPanel(){
        var body = $('managerBoardItemsBody');
        if(!body) return;
        var ctx = await getActiveCommunityContext();
        var communityId = ctx.id;
        if(!communityId){
          body.innerHTML = '<div class="mh2-placeholder">Select a community to see board-submitted items.</div>';
          updateBoardSummary([]);
          return;
        }
        body.innerHTML = '<div class="mh2-placeholder"></div>';
        try{
          var sb = await requireSb();
          var q = await sb.from('BoardMemberActionItems').select('id,community_id,title,created_at,status').eq('community_id', communityId).order('created_at',{ascending:false}).limit(50);
          if(q.error) throw q.error;
          var rows = Array.isArray(q.data) ? q.data : [];
          var active = rows.filter(shouldCountAsOpenRow);
          updateBoardSummary(rows);
          setText('mh2BoardItemNote', active.length ? ('Last refresh for ' + (ctx.name || 'selected community')) : 'No open board-submitted items for this community.');
          if(!active.length){
            body.innerHTML = '<div class="mh2-placeholder">No new board-submitted items for this community.</div>';
            return;
          }
          body.innerHTML = active.slice(0,5).map(function(row){
            var meta = [];
            if(row.created_at) meta.push('Submitted ' + fmtAgo(row.created_at));
            if(row.due_date) meta.push('Due ' + esc(String(row.due_date)));
            if(row.status) meta.push('Status ' + esc(String(row.status)));
            var desc = esc(stripMarkers(row.details || '')).slice(0, 180);
            if(desc.length >= 180) desc += '…';
            var overdue = isOverdueRow(row);
            return '<article class="mh2-list-item">' +
              '<div><div class="mh2-item-title">' + esc(row.title || 'Untitled item') + '</div>' +
              '<div class="mh2-board-meta">' + meta.map(function(item){ return '<span class="mh2-chip">' + item + '</span>'; }).join('') + '</div>' +
              '<div class="mh2-item-copy">' + (desc || 'Open board-submitted item ready for review.') + '</div></div>' +
              '<a class="mh2-item-tag mh2-board-tag' + (overdue ? ' is-overdue' : '') + '" href="board_member_hub.html">' + (overdue ? 'Overdue' : 'Open') + '</a>' +
            '</article>';
          }).join('');
        }catch(err){
          body.innerHTML = '<div class="mh2-placeholder">Unable to load board items.</div>';
          setText('mh2BoardItemNote', 'Board feed unavailable right now.');
          updateBoardSummary([]);
        }
      }
      function mapNotificationHref(event){
        var type = String((event && event.type) || '').toLowerCase();
        var msg = String((event && event.message) || '').toLowerCase();
        if(event && event.link_url) return String(event.link_url);
        if((type === 'maintenance' || type === 'resident_work_order' || type === 'new_work_order' || type === 'work_order_sent_to_vendor' || type === 'vendor_accepted_job' || type === 'vendor_in_progress' || type === 'vendor_completed_job') && event.request_id) return 'resident_work_orders.html?open_work_order_id=' + encodeURIComponent(String(event.request_id));
        if(type === 'maintenance' || type === 'resident_work_order') return 'resident_work_orders.html';
        if(type === 'board_item' && event.board_item_id) return 'board_member_hub.html';
        if(type === 'annual_meeting') return 'annual_meetings.html';
        if(type === 'community_alert') return 'emergency_texting.html';
        if(type === 'compliance_drive') return 'mileage.html';
        if(msg.indexOf('board') !== -1) return 'board_member_hub.html';
        if(msg.indexOf('work order') !== -1 || msg.indexOf('maintenance') !== -1) return 'resident_work_orders.html';
        return null;
      }
      function eventPriority(event){
        var t = String((event && event.type) || '').toLowerCase();
        var p = String((event && event.priority) || '').toLowerCase();
        var msg = String((event && event.message) || '').toLowerCase();
        var isMaintenanceDomain = (t === 'maintenance' || t === 'resident_work_order');
        if(isMaintenanceDomain && (p === 'urgent' || msg.indexOf('urgent') !== -1 || msg.indexOf('overdue') !== -1)) return 'urgent';
        if(msg.indexOf('accepted') !== -1 || msg.indexOf('active') !== -1 || msg.indexOf('completed') !== -1 || msg.indexOf('scheduled') !== -1) return 'active';
        if(isMaintenanceDomain || t === 'annual_meeting') return 'attention';
        if(msg.indexOf('submitted') !== -1 || msg.indexOf('approval') !== -1 || msg.indexOf('awaiting') !== -1) return 'attention';
        return 'neutral';
      }
      async function loadLiveActivity(){
        var list = $('activityFeedList');
        if(!list) return;
        var ctx = await getActiveCommunityContext();
        var communityId = ctx.id;
        var communityName = ctx.name;
        list.innerHTML = '<div class="mh2-placeholder"></div>';
        setText('mh2LiveActivityNote', 'Refreshing live feed' + (communityName ? ' for ' + communityName : '') + '.');
        try{
          var sb = await requireSb();
          var events = [];
          function maybePush(time, message, extra){
            if(!time || !message) return;
            events.push(Object.assign({ time:time, message:message }, extra || {}));
          }
          try{
            var notifQ = sb.from('notification_events').select('id,created_at,event_type,priority,title,message,link_url,community_id,source_table,source_id,metadata').order('created_at',{ascending:false}).limit(20);
            if(communityId) notifQ = notifQ.eq('community_id', communityId);
            var notif = await notifQ;
            if(!notif.error && Array.isArray(notif.data)){
              notif.data.forEach(function(row){
                var md = row && row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
                var msg = String(row.message || row.title || 'Notification update').trim();
                if(/board item|board member|board-submitted/i.test(msg)) return;
                events.push({ time:row.created_at, message:msg, type:String(row.event_type||'').toLowerCase(), priority:String(row.priority||'').toLowerCase(), link_url:row.link_url || null, request_id:md.work_order_id || md.request_id || null, board_item_id:md.board_item_id || null, community_id:row.community_id || null });
              });
            }
          }catch(_e){}
          try{
            var annual = await sb.from('annual_meeting_activity_events').select('*').order('created_at',{ascending:false}).limit(12);
            if(!annual.error && Array.isArray(annual.data)){
              annual.data.forEach(function(row){
                if(communityId && String((row && row.community_id) || '') !== communityId) return;
                maybePush(row.created_at, String(row.title || row.detail || row.event_type || 'Annual meeting update').trim(), { type:'annual_meeting', community_id:row.community_id || null });
              });
            }
          }catch(_e2){}
          try{
            var rwo = await sb.from('resident_work_orders').select('id,community_id,submitted_at,created_at,priority,status,unit_number').order('submitted_at',{ascending:false}).limit(20);
            if(!rwo.error && Array.isArray(rwo.data)){
              rwo.data.forEach(function(row){
                if(communityId && String((row && row.community_id) || '') !== communityId) return;
                var priority = String(row.priority || '').toLowerCase();
                var status = String(row.status || '').toLowerCase();
                var unit = String(row.unit_number || '').trim().toLowerCase();
                var label = unit === 'inspection' ? 'Inspection work order created' : 'Employee work order created';
                if(priority === 'urgent') label = 'Urgent ' + label;
                else if(['in_progress','assigned_to_vendor','active'].indexOf(status) !== -1) label = 'Employee work order in progress';
                maybePush(row.submitted_at || row.created_at, label, { type:'resident_work_order', community_id:row.community_id || null, request_id:row.id });
              });
            }
          }catch(_e3){}
          try{
            var maint = await sb.from('maintenance_request_events').select('*').order('created_at',{ascending:false}).limit(20);
            if(!maint.error && Array.isArray(maint.data)){
              maint.data.forEach(function(row){
                if(communityId && String((row && row.community_id) || '') !== communityId) return;
                var eventType = String(row.event_type || '').toLowerCase();
                var label = 'Maintenance update';
                if(eventType === 'created') label = 'Maintenance request created';
                else if(eventType === 'updated') label = 'Maintenance request updated';
                else if(eventType === 'completed') label = 'Maintenance request completed';
                maybePush(row.created_at || row.submitted_at, label, { type:'maintenance', community_id:row.community_id || null, request_id:row.request_id || row.maintenance_request_id || null });
              });
            }
          }catch(_e4){}
          try{
            var bm = await sb.from('BoardMemberActionItems').select('id,community_id,title,created_at,status').order('created_at',{ascending:false}).limit(12);
            if(!bm.error && Array.isArray(bm.data)){
              bm.data.forEach(function(row){
                if(communityId && String((row && row.community_id) || '') !== communityId) return;
                if(!shouldCountAsOpenRow(row)) return;
                maybePush(row.created_at, String(row.title || 'Board item submitted').trim(), { type:'board_item', community_id:row.community_id || null, board_item_id:row.id || null, priority:isOverdueRow(row) ? 'urgent' : 'attention' });
              });
            }
          }catch(_e5){}
          events.sort(function(a,b){ return new Date(b.time).getTime() - new Date(a.time).getTime(); });
          events = events.slice(0,8);
          setText('mh2LiveActivityCount', String(events.length));
          var urgentEvents = events.filter(function(e){ return eventPriority(e) === 'urgent'; }).length;
          /* legacy maintenance alert writer removed */
          if(!events.length){
            try{ window.__mh2LiveEvents = []; }catch(_e){}
            list.innerHTML = '<div class="mh2-placeholder">No recent activity for this community.</div>';
            setText('mh2LiveActivityNote', 'Connected, but no recent events were found' + (communityName ? ' for ' + communityName : '') + '.');
            return;
          }
          try{ window.__mh2LiveEvents = events.slice(); }catch(_e){}
          list.innerHTML = events.map(function(event){
            var href = mapNotificationHref(event);
            var priority = eventPriority(event);
            var ageMs = Math.max(0, Date.now() - new Date(event.time).getTime());
            var rowClass = priority === 'urgent' ? 'mh2-feed-item is-urgent' : (priority === 'attention' ? 'mh2-feed-item is-attention' : (priority === 'active' ? 'mh2-feed-item is-active' : 'mh2-feed-item'));
            var dot = priority === 'urgent' ? 'mh2-dot mh2-dot--urgent' : (priority === 'attention' ? 'mh2-dot mh2-dot--gold' : (priority === 'active' ? 'mh2-dot mh2-dot--green' : 'mh2-dot'));
            if(ageMs <= 60 * 60 * 1000) dot += ' is-recent';
            var tagClass = ageMs <= 60 * 60 * 1000 ? 'mh2-item-tag is-recent' : (ageMs <= 24 * 60 * 60 * 1000 ? 'mh2-item-tag is-fresh' : 'mh2-item-tag is-stale');
            var inner = '<article class="' + rowClass + '">' +
              '<div class="' + dot + '"></div>' +
              '<div><div class="mh2-item-title">' + esc(event.message || 'Activity update') + '</div><div class="mh2-item-copy">' + esc(communityName || getSelectedCommunityName() || 'Selected community') + '</div></div>' +
              '<div class="' + tagClass + '">' + esc(fmtAgo(event.time)) + '</div>' +
            '</article>';
            return href ? '<a href="' + esc(href) + '" style="text-decoration:none;color:inherit;display:block">' + inner + '</a>' : inner;
          }).join('');
          setText('mh2LiveActivityNote', 'Showing the latest ' + String(events.length) + ' event' + (events.length===1?'':'s') + (communityName ? ' for ' + communityName : '') + '.');
        }catch(err){
          try{ window.__mh2LiveEvents = []; }catch(_e){}
          list.innerHTML = '<div class="mh2-placeholder">Unable to load live activity.</div>';
          setText('mh2LiveActivityCount', '0');
          setText('mh2LiveActivityNote', 'Live feed unavailable right now.');
        }
      }
      function approvalStatusLabel(status){
        return String(status || 'pending').replace(/_/g,' ').replace(/\w/g, function(ch){ return ch.toUpperCase(); });
      }
      async function loadApprovalSummary(){
        var body = $('annualApprovalBody');
        var communityId = getActiveCommunityId();
        if(!body) return;
        try{
          var sb = await requireSb();
          var q = await sb.from('annual_meeting_packet_requests').select('id,community_id,community_name,status,submitted_at').in('status', ['approved_ready_to_send','sent_to_admin','mailed']).order('submitted_at',{ascending:false});
          if(q.error) throw q.error;
          var rows = (q.data || []).filter(function(item){ return !communityId || String((item && item.community_id) || '') === communityId; });
          setText('mh2ApprovalPill', String(rows.length));
          setText('mh2ApprovalNote', rows.length ? ('Current approval items for ' + (getSelectedCommunityName() || 'the selected community') + '.') : 'No approval items for this community.');
          setText('mh2ApprovalFoot', rows.length ? ('Showing the latest ' + String(Math.min(rows.length, 4)) + ' approval item' + (rows.length===1?'':'s') + ' for ' + (getSelectedCommunityName() || 'the selected community') + '.') : 'Open annual approval items for the selected community.');
          setAlertCard('mh2AlertApprovals', {
            tone: rows.length ? 'attention' : 'good',
            title: 'Annual meeting approvals',
            badge: rows.length ? (String(rows.length) + ' open') : 'Clear',
            copy: rows.length ? (String(rows.length) + ' approval item' + (rows.length===1?'':'s') + ' in progress for ' + (getSelectedCommunityName() || 'the selected community') + '.') : 'No active items',
            href: 'annual_meeting_approvals.html'
          });
          if(!rows.length){
            body.innerHTML = '<div class="mh2-placeholder">No annual approval items for this community.</div>';
            return;
          }
          body.innerHTML = rows.slice(0,4).map(function(row){
            var href = 'annual_meeting_approvals.html';
            var community = row.community_name || getSelectedCommunityName() || 'Community';
            var status = approvalStatusLabel(row.status);
            var inner = '<article class="mh2-list-item">' +
              '<div><div class="mh2-item-title">' + esc(community) + '</div><div class="mh2-item-copy">Approval status: ' + esc(status) + '</div></div>' +
              '<div class="mh2-item-tag">' + esc(fmtAgo(row.submitted_at)) + '</div>' +
            '</article>';
            return '<a href="' + esc(href) + '" style="text-decoration:none;color:inherit">' + inner + '</a>';
          }).join('');
        }catch(_e){
          setText('mh2ApprovalPill', '0');
          setText('mh2ApprovalNote', 'Approval data unavailable right now.');
          setText('mh2ApprovalFoot', 'Open annual approval items for the selected community.');
          body.innerHTML = '<div class="mh2-placeholder">Unable to load annual approvals.</div>';
        }
      }
      function setToolCardState(cardId, opts){
        var card = $(cardId);
        if(!card) return;
        opts = opts || {};
        var tone = String(opts.tone || '').trim();
        var toneEl = card.querySelector('[data-role="tone"]');
        var m1 = card.querySelector('[data-role="metric1"]');
        var m2 = card.querySelector('[data-role="metric2"]');
        if(toneEl){ toneEl.textContent = String(opts.badge || tone || 'Ready'); toneEl.className = 'mh2-tool-pill' + (tone === 'urgent' ? ' is-urgent' : tone === 'good' ? ' is-good' : tone === 'gold' ? ' is-gold' : ''); }
        if(m1 && opts.metric1 != null) m1.textContent = String(opts.metric1);
        if(m2 && opts.metric2 != null) m2.textContent = String(opts.metric2);
        card.classList.remove('mh2-tool-card--gold','mh2-tool-card--urgent');
        if(tone === 'urgent'){ card.classList.add('mh2-tool-card--urgent'); }
        else if(tone === 'gold'){ card.classList.add('mh2-tool-card--gold'); }
      }
      function getHubCardStorage(){
        try{ return JSON.parse(localStorage.getItem('zummee_manager_hub_v2_cards') || '{}') || {}; }catch(_e){ return {}; }
      }
      function saveHubCardStorage(v){
        try{ localStorage.setItem('zummee_manager_hub_v2_cards', JSON.stringify(v || {})); }catch(_e){}
      }
      async function getMyProfile(){
        var sb = await requireSb();
        var uid = await getUid();
        if(!uid) return {};
        var q = await sb.from('profiles').select('role,user_role,access_level,access,department,dept,is_supervisor,is_admin,is_companyadmin,company_id').eq('id', uid).maybeSingle();
        if(q.error) throw q.error;
        return q.data || {};
      }
      function isPrivilegedProfile(p){
        var role = String((p && (p.role || p.user_role || p.access_level || p.access)) || '').toLowerCase().trim();
        var dept = String((p && (p.department || p.dept)) || '').toLowerCase().trim();
        var authRole = String(window && window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.role || '').toLowerCase().trim();
        var authDept = String(window && window.ZUMMEE_AUTH && window.ZUMMEE_AUTH.department || '').toLowerCase().trim();
        var s = [role,dept,authRole,authDept].filter(Boolean).join(' ');
        var flag = !!(p && (p.is_supervisor || p.is_admin || p.is_companyadmin));
        return flag || /\b(companyadmin|admin|supervisor)\b/.test(s) || /(company\s*admin)/.test(s);
      }
      async function applyRoleVisibility(){
        var page = document.querySelector('.mh2-page');
        if(!page) return false;
        var priv = false;
        try{ priv = isPrivilegedProfile(await getMyProfile()); }catch(_e){ priv = false; }
        page.classList.toggle('is-privileged', !!priv);
        Array.prototype.forEach.call(document.querySelectorAll('.mh2-tool-card[data-role-scope]'), function(card){
          var scope = String(card.getAttribute('data-role-scope') || '').trim();
          card.style.display = (scope === 'supervisor' && !priv) ? 'none' : '';
        });
        try{ window.mh2IsPrivileged = !!priv; }catch(_e){}
        return priv;
      }
      function updateVisibleHubCardCount(){
        var count = Array.prototype.filter.call(document.querySelectorAll('#hubCards .mh2-tool-card[data-card-key]'), function(card){ return getComputedStyle(card).display !== 'none'; }).length;
        setText('mh2HubCardCount', String(count));
      }
      window.testManagerHubSupervisorCards = async function(){
        var priv = false;
        try{ priv = await applyRoleVisibility(); }catch(_e){ priv = !!window.mh2IsPrivileged; }
        var section = document.getElementById('employeeHubSection');
        var cards = Array.prototype.slice.call(document.querySelectorAll('#employeeHubCards .mh2-tool-card[data-role-scope="supervisor"]'));
        var visibleCards = cards.filter(function(card){ return getComputedStyle(card).display !== 'none'; }).map(function(card){ return card.id || card.getAttribute('data-card-key'); });
        var result = { isPrivileged: !!priv, sectionExists: !!section, sectionDisplay: section ? getComputedStyle(section).display : '', supervisorCardCount: cards.length, visibleCards: visibleCards };
        try{ console.table([result]); }catch(_e){}
        return result;
      };
      function parseCompanyLogoRef(raw){
        raw = String(raw || '').trim();
        if(!raw) return null;
        if(/^https?:\/\//i.test(raw)) return { url: raw };
        return { bucket:'company_logos', path: raw };
      }
      function getBrandLogoCacheKey(companyId){
        return 'mh2_brand_logo_v1_' + String(companyId || '').trim();
      }
      function readBrandLogoCache(companyId){
        try{
          var raw = sessionStorage.getItem(getBrandLogoCacheKey(companyId));
          if(!raw) return null;
          var parsed = JSON.parse(raw);
          if(!parsed || !parsed.url) return null;
          return parsed;
        }catch(_e){ return null; }
      }
      function writeBrandLogoCache(companyId, payload){
        try{
          sessionStorage.setItem(getBrandLogoCacheKey(companyId), JSON.stringify({
            url:String(payload && payload.url || '').trim(),
            alt:String(payload && payload.alt || '').trim(),
            isCompany:!!(payload && payload.isCompany)
          }));
        }catch(_e){}
      }
      function preloadImage(url){
        return new Promise(function(resolve, reject){
          var img = new Image();
          img.decoding = 'async';
          img.onload = function(){ resolve(url); };
          img.onerror = function(err){ reject(err || new Error('Image preload failed')); };
          img.src = url;
        });
      }
      async function paintBrandLogo(payload){
        var logo = $('mh2BrandLogo');
        if(!logo) return;
        var url = String(payload && payload.url || '').trim();
        var alt = String(payload && payload.alt || '').trim() || 'Zummee logo';
        var isCompany = !!(payload && payload.isCompany);
        if(!url) url = 'Zummee.png';
        try{ await preloadImage(url); }catch(_e){
          url = 'Zummee.png';
          alt = 'Zummee logo';
          isCompany = false;
          try{ await preloadImage(url); }catch(_e2){}
        }
        logo.classList.remove('is-visible');
        logo.src = url;
        logo.alt = alt;
        logo.classList.toggle('is-company', isCompany);
        requestAnimationFrame(function(){ logo.classList.add('is-visible'); });
      }
      async function resolveCompanyLogoPayload(companyId){
        if(!companyId) return { url:'Zummee.png', alt:'Zummee logo', isCompany:false };
        var cached = readBrandLogoCache(companyId);
        if(cached && cached.url){
          paintBrandLogo(cached);
        }
        var sb = await requireSb();
        var res = await sb.from('companies').select('logo_path,name').eq('id', String(companyId)).maybeSingle();
        if(res.error) throw res.error;
        var row = res.data || {};
        var ref = parseCompanyLogoRef(row.logo_path);
        if(!ref) throw new Error('No company logo');
        var url = ref.url || '';
        if(!url && ref.bucket && ref.path && sb.storage && sb.storage.from){
          var pub = sb.storage.from(ref.bucket).getPublicUrl(ref.path);
          url = String(pub && pub.data && pub.data.publicUrl || '').trim();
        }
        if(!url) throw new Error('No logo URL');
        var payload = { url:url, alt:String(row.name || 'Company logo'), isCompany:true };
        writeBrandLogoCache(companyId, payload);
        return payload;
      }
      window.loadBrandLogo = async function loadBrandLogo(){
        var logo = $('mh2BrandLogo');
        if(!logo) return;
        try{
          var ctx = await getMyCompany();
          var payload = await resolveCompanyLogoPayload(ctx.company_id);
          await paintBrandLogo(payload);
        }catch(_e){
          await paintBrandLogo({ url:'Zummee.png', alt:'Zummee logo', isCompany:false });
        }
      }

      function getDefaultCardOrder(){
        return Array.prototype.map.call(document.querySelectorAll('#hubCards .mh2-tool-card[data-card-key]'), function(el){ return String(el.getAttribute('data-card-key') || ''); }).filter(Boolean);
      }
      function ensureHubCardPrefs(){
        var prefs = getHubCardStorage();
        var defaults = getDefaultCardOrder();
        if(!Array.isArray(prefs.order) || !prefs.order.length) prefs.order = defaults.slice();
        defaults.forEach(function(key){ if(prefs.order.indexOf(key) === -1) prefs.order.push(key); });
        prefs.order = prefs.order.filter(function(key, idx){ return defaults.indexOf(key) !== -1 && prefs.order.indexOf(key) === idx; });
        if(!Array.isArray(prefs.favorites)) prefs.favorites = ['daily_ops','board_hub','resident_work_orders'];
        prefs.favorites = prefs.favorites.filter(function(key, idx){ return defaults.indexOf(key) !== -1 && prefs.favorites.indexOf(key) === idx; });
        saveHubCardStorage(prefs);
        return prefs;
      }
      function applyHubCardPreferences(){
        var wrap = $('hubCards');
        if(!wrap) return;
        var prefs = ensureHubCardPrefs();
        var cards = Array.prototype.slice.call(wrap.querySelectorAll('.mh2-tool-card[data-card-key]'));
        cards.sort(function(a,b){
          var ka = a.getAttribute('data-card-key');
          var kb = b.getAttribute('data-card-key');
          var fa = prefs.favorites.indexOf(ka) !== -1 ? 0 : 1;
          var fb = prefs.favorites.indexOf(kb) !== -1 ? 0 : 1;
          if(fa !== fb) return fa - fb;
          return prefs.order.indexOf(ka) - prefs.order.indexOf(kb);
        }).forEach(function(card){ wrap.appendChild(card); });
        cards.forEach(function(card){
          var key = card.getAttribute('data-card-key');
          card.setAttribute('data-favorite', prefs.favorites.indexOf(key) !== -1 ? '1' : '0');
          var favBtn = card.querySelector('[data-action="favorite"]');
          if(favBtn){ favBtn.classList.toggle('is-favorite', prefs.favorites.indexOf(key) !== -1); favBtn.textContent = prefs.favorites.indexOf(key) !== -1 ? '★' : '☆'; }
        });
        applyHubCardDragState();
      }
      function applyHubCardDragState(){
        var page = document.querySelector('.mh2-page');
        var wrap = $('hubCards');
        if(!page || !wrap) return;
        var canDrag = page.classList.contains('is-customizing');
        Array.prototype.forEach.call(wrap.querySelectorAll('.mh2-tool-card[data-card-key]'), function(card){
          card.setAttribute('draggable', canDrag ? 'true' : 'false');
        });
      }
      function reorderHubCardsByDrop(sourceKey, targetKey){
        if(!sourceKey || !targetKey || sourceKey === targetKey) return;
        var prefs = ensureHubCardPrefs();
        var order = Array.isArray(prefs.order) ? prefs.order.slice() : [];
        var fromIdx = order.indexOf(sourceKey);
        var toIdx = order.indexOf(targetKey);
        if(fromIdx === -1 || toIdx === -1) return;
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, sourceKey);
        prefs.order = order;
        saveHubCardStorage(prefs);
        applyHubCardPreferences();
      }
      function toggleCustomizeCards(){
        var page = document.querySelector('.mh2-page');
        if(!page) return;
        page.classList.toggle('is-customizing');
        var btn = $('mh2CustomizeCardsBtn');
        if(btn) btn.textContent = page.classList.contains('is-customizing') ? 'Done customizing' : 'Customize cards';
        applyHubCardDragState();
      }
      function mutateCardOrder(key, direction){
        var prefs = ensureHubCardPrefs();
        var idx = prefs.order.indexOf(key);
        if(idx === -1) return;
        var swap = direction === 'up' ? idx - 1 : idx + 1;
        if(swap < 0 || swap >= prefs.order.length) return;
        var temp = prefs.order[swap]; prefs.order[swap] = prefs.order[idx]; prefs.order[idx] = temp;
        saveHubCardStorage(prefs); applyHubCardPreferences();
      }
      function toggleFavoriteCard(key){
        var prefs = ensureHubCardPrefs();
        var idx = prefs.favorites.indexOf(key);
        if(idx === -1) prefs.favorites.push(key); else prefs.favorites.splice(idx,1);
        saveHubCardStorage(prefs); applyHubCardPreferences();
      }
      function resetHubCards(){
        saveHubCardStorage({ order:getDefaultCardOrder(), favorites:['daily_ops','board_hub','resident_work_orders'] });
        applyHubCardPreferences();
      }
      function bindHubCardControls(){
        var wrap = $('hubCards');
        if(!wrap || wrap.getAttribute('data-controls-bound') === '1') return;
        wrap.setAttribute('data-controls-bound','1');

        wrap.addEventListener('click', function(e){
          var btn = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
          if(!btn) return;
          e.preventDefault(); e.stopPropagation();
          var card = btn.closest('.mh2-tool-card[data-card-key]');
          if(!card) return;
          var key = card.getAttribute('data-card-key');
          var action = btn.getAttribute('data-action');
          if(action === 'favorite') toggleFavoriteCard(key);
          if(action === 'up' || action === 'down') mutateCardOrder(key, action);
        });

        wrap.addEventListener('dragstart', function(e){
          var card = e.target && e.target.closest ? e.target.closest('.mh2-tool-card[data-card-key]') : null;
          var page = document.querySelector('.mh2-page');
          if(!card || !page || !page.classList.contains('is-customizing')) return;
          var key = String(card.getAttribute('data-card-key') || '');
          if(!key) return;
          wrap.setAttribute('data-drag-key', key);
          card.classList.add('is-dragging');
          if(e.dataTransfer){
            e.dataTransfer.effectAllowed = 'move';
            try{ e.dataTransfer.setData('text/plain', key); }catch(_e){}
          }
        });

        wrap.addEventListener('dragover', function(e){
          var card = e.target && e.target.closest ? e.target.closest('.mh2-tool-card[data-card-key]') : null;
          var dragKey = wrap.getAttribute('data-drag-key');
          if(!card || !dragKey) return;
          e.preventDefault();
          if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          Array.prototype.forEach.call(wrap.querySelectorAll('.mh2-tool-card.is-drop-target'), function(el){ el.classList.remove('is-drop-target'); });
          var targetKey = String(card.getAttribute('data-card-key') || '');
          if(targetKey && targetKey !== dragKey) card.classList.add('is-drop-target');
        });

        wrap.addEventListener('drop', function(e){
          var card = e.target && e.target.closest ? e.target.closest('.mh2-tool-card[data-card-key]') : null;
          var dragKey = wrap.getAttribute('data-drag-key');
          if(!card || !dragKey) return;
          e.preventDefault();
          var targetKey = String(card.getAttribute('data-card-key') || '');
          Array.prototype.forEach.call(wrap.querySelectorAll('.mh2-tool-card.is-drop-target'), function(el){ el.classList.remove('is-drop-target'); });
          Array.prototype.forEach.call(wrap.querySelectorAll('.mh2-tool-card.is-dragging'), function(el){ el.classList.remove('is-dragging'); });
          wrap.removeAttribute('data-drag-key');
          reorderHubCardsByDrop(dragKey, targetKey);
        });

        wrap.addEventListener('dragend', function(){
          Array.prototype.forEach.call(wrap.querySelectorAll('.mh2-tool-card.is-drop-target'), function(el){ el.classList.remove('is-drop-target'); });
          Array.prototype.forEach.call(wrap.querySelectorAll('.mh2-tool-card.is-dragging'), function(el){ el.classList.remove('is-dragging'); });
          wrap.removeAttribute('data-drag-key');
        });

        var customBtn = $('mh2CustomizeCardsBtn');
        if(customBtn) customBtn.addEventListener('click', toggleCustomizeCards);
        var resetBtn = $('mh2ResetCardsBtn');
        if(resetBtn) resetBtn.addEventListener('click', resetHubCards);
      }
      async function loadManagerActionCards(){
        bindHubCardControls();
        await applyRoleVisibility();
        applyHubCardPreferences();
        updateVisibleHubCardCount();

        var ctx = await getActiveCommunityContext();
        var communityId = ctx.id;

        var boardOpen = 0;
        var boardOverdue = 0;
        var approvals = 0;
        var liveEvents = 0;
        var urgentActivity = 0;
        var openWorkOrders = 0;
        var urgentWorkOrders = 0;
        var inspectionWos = 0;

        window.__mh2MaintenanceSummary = { openWorkOrders: 0, urgentWorkOrders: 0, liveMaintenanceEvents: 0, urgentLiveMaintenance: 0 };

        if(communityId){
          try{
            var sb = await requireSb();

            var boardQ = await sb.from('BoardMemberActionItems')
              .select('id,community_id,title,created_at,status')
              .eq('community_id', communityId)
              .order('created_at',{ascending:false})
              .limit(200);
            if(!boardQ.error && Array.isArray(boardQ.data)){
              var openRows = boardQ.data.filter(shouldCountAsOpenRow);
              boardOpen = openRows.length;
              boardOverdue = openRows.filter(isOverdueRow).length;
            }

            var approvalQ = await sb.from('annual_meeting_packet_requests')
              .select('id,community_id,status,submitted_at')
              .eq('community_id', communityId)
              .in('status', ['approved_ready_to_send','sent_to_admin','mailed'])
              .order('submitted_at',{ascending:false})
              .limit(100);
            if(!approvalQ.error && Array.isArray(approvalQ.data)){
              approvals = approvalQ.data.length;
            }

            var rwo = await sb.from('resident_work_orders')
              .select('id,community_id,status,priority,unit_number')
              .eq('community_id', communityId)
              .limit(200);
            if(!rwo.error && Array.isArray(rwo.data)){
              var closedStates = ['completed','closed','cancelled'];
              openWorkOrders = rwo.data.filter(function(row){
                return closedStates.indexOf(String(row.status||'').toLowerCase()) === -1;
              }).length;
              urgentWorkOrders = rwo.data.filter(function(row){
                return String(row.priority||'').toLowerCase() === 'urgent' &&
                  closedStates.indexOf(String(row.status||'').toLowerCase()) === -1;
              }).length;
              inspectionWos = rwo.data.filter(function(row){
                return String(row.unit_number||'').trim().toLowerCase() === 'inspection' &&
                  closedStates.indexOf(String(row.status||'').toLowerCase()) === -1;
              }).length;
            }
          }catch(_e){}
        }

        try{
          var feedList = Array.isArray(window.__mh2LiveEvents) ? window.__mh2LiveEvents : [];
          var maintenanceEvents = feedList.filter(function(e){
            var t = String((e && (e.type || e.event_type || e.kind || e.category)) || '').toLowerCase().trim();
            return t === 'maintenance' || t === 'resident_work_order';
          });
          liveEvents = Number(maintenanceEvents.length || 0);
          urgentActivity = Number(maintenanceEvents.filter(function(e){ return eventPriority(e) === 'urgent'; }).length || 0);
        }catch(_e){
          liveEvents = 0;
          urgentActivity = 0;
        }

        setToolCardState('dailyOpsCard', {
          tone: boardOverdue ? 'urgent' : (boardOpen || liveEvents ? 'gold' : 'good'),
          badge: boardOverdue ? 'Needs attention' : (boardOpen || liveEvents ? 'Active' : 'Ready'),
          metric1: boardOpen,
          metric2: boardOverdue + urgentWorkOrders
        });
        setToolCardState('boardMemberHubCard', {
          tone: boardOverdue ? 'urgent' : (boardOpen ? 'gold' : 'good'),
          badge: boardOverdue ? 'Overdue' : (boardOpen ? 'Open' : 'Clear'),
          metric1: boardOpen,
          metric2: boardOverdue
        });
        setToolCardState('residentWorkOrdersCard', {
          tone: urgentWorkOrders ? 'urgent' : (openWorkOrders ? 'gold' : 'good'),
          badge: urgentWorkOrders ? 'Urgent' : (openWorkOrders ? 'Open' : 'Clear'),
          metric1: openWorkOrders,
          metric2: urgentWorkOrders
        });
        setToolCardState('liveMaintenanceUpdatesCard', {
          tone: urgentActivity ? 'urgent' : (liveEvents ? 'gold' : 'good'),
          badge: urgentActivity ? 'Urgent activity' : (liveEvents ? 'Live' : 'Quiet'),
          metric1: liveEvents,
          metric2: urgentActivity
        });

        window.__mh2MaintenanceSummary = {
          openWorkOrders: Number(openWorkOrders || 0),
          urgentWorkOrders: Number(urgentWorkOrders || 0),
          liveMaintenanceEvents: Number(liveEvents || 0),
          urgentLiveMaintenance: Number(urgentActivity || 0)
        };

        var totalUrgentMaintenance = Number(urgentWorkOrders || 0);
        var totalOpenMaintenance = Number(openWorkOrders || 0);
        var totalLiveMaintenance = Number(liveEvents || 0);

        setAlertCard('mh2AlertActivity', {
          tone: totalUrgentMaintenance > 0
            ? 'urgent'
            : ((totalOpenMaintenance > 0 || totalLiveMaintenance > 0) ? 'attention' : 'good'),
          title: 'Maintenance activity',
          badge: totalUrgentMaintenance > 0
            ? (String(totalUrgentMaintenance) + ' urgent')
            : (totalOpenMaintenance > 0
              ? (String(totalOpenMaintenance) + ' open')
              : (totalLiveMaintenance > 0 ? (String(totalLiveMaintenance) + ' live') : 'Quiet')),
          copy: totalUrgentMaintenance > 0
            ? (String(totalUrgentMaintenance) + ' urgent maintenance signal' + (totalUrgentMaintenance === 1 ? '' : 's'))
            : (totalOpenMaintenance > 0
              ? (String(totalOpenMaintenance) + ' open maintenance item' + (totalOpenMaintenance === 1 ? '' : 's'))
              : (totalLiveMaintenance > 0
                ? (String(totalLiveMaintenance) + ' live maintenance event' + (totalLiveMaintenance === 1 ? '' : 's'))
                : 'No open maintenance items')),
          href: 'maintenance_updates.html'
        });

        var today = new Date();
        var dayOfMonth = today.getDate();
        var mileageTone = dayOfMonth >= 28 ? 'gold' : 'good';
        var mileageBadge = dayOfMonth >= 28 ? 'Month end' : 'Monthly';

        setToolCardState('mileageCard', { tone: mileageTone, badge: mileageBadge, metric1: dayOfMonth >= 28 ? 'Due soon' : 'Ready', metric2: '25th' });
        setToolCardState('inspectionsCard', { tone: inspectionWos ? 'gold' : 'good', badge: inspectionWos ? 'Inspection open' : 'Field ready', metric1: inspectionWos, metric2: inspectionWos ? 'Follow-up' : 'Ready' });
        setToolCardState('annualMeetingsCard', { tone: approvals ? 'gold' : 'good', badge: approvals ? 'Open approvals' : 'Ready', metric1: approvals, metric2: approvals ? 'In progress' : 'Clear' });
        setToolCardState('preferredVendorsCard', { tone: 'good', badge: 'Directory ready', metric1: 'Ready', metric2: 'On' });
        setToolCardState('remindersCard', { tone: boardOverdue ? 'urgent' : (boardOpen ? 'gold' : 'good'), badge: boardOverdue ? 'Overdue' : (boardOpen ? 'Due soon' : 'Clear'), metric1: boardOpen, metric2: boardOverdue });
        setToolCardState('communityTextingCard', { tone: 'good', badge: 'Text ready', metric1: 'Ready', metric2: 'Live' });
        setToolCardState('companyDirectoryCard', { tone: 'good', badge: 'Directory', metric1: 'Ready', metric2: 'Company' });
        setToolCardState('managerTrainingCard', { tone: 'good', badge: 'Guide', metric1: 'Ready', metric2: 'Reference' });
        setToolCardState('onlineVotingCard', { tone: 'good', badge: 'Voting ready', metric1: 'Ready', metric2: 'Live' });
        setToolCardState('boardMeetingsCard', { tone: boardOpen ? 'gold' : 'good', badge: boardOpen ? 'Agenda items' : 'Ready', metric1: boardOpen, metric2: 'Agenda' });
        setToolCardState('residentPortalPreviewCard', { tone: 'good', badge: 'Preview', metric1: 'Preview', metric2: 'Manager' });
        setToolCardState('residentDirectoryCard', { tone: 'good', badge: 'Directory', metric1: 'Ready', metric2: 'Roster' });
        setToolCardState('annualPresentationHubCard', { tone: approvals ? 'gold' : 'good', badge: approvals ? 'Prep active' : 'Ready', metric1: approvals, metric2: 'Slides' });
        setToolCardState('maintenanceControlCenterCard', { tone: urgentWorkOrders ? 'urgent' : (openWorkOrders ? 'gold' : 'good'), badge: urgentWorkOrders ? 'Urgent' : (openWorkOrders ? 'Active' : 'Clear'), metric1: openWorkOrders, metric2: liveEvents });
        setToolCardState('poolOpsCard', { tone: 'good', badge: 'Seasonal', metric1: 'Ready', metric2: 'Pool' });
        setToolCardState('supervisorHubMainCard', { tone: 'gold', badge: 'Supervisor', metric1: 'On', metric2: 'Access' });
        setToolCardState('employeePerformanceCard', { tone: 'good', badge: 'Report', metric1: 'Team', metric2: 'KPIs' });
        setToolCardState('annualMeetingApprovalsCard', { tone: approvals ? 'gold' : 'good', badge: approvals ? 'Queue active' : 'Clear', metric1: approvals, metric2: 'Review' });
        setToolCardState('dailyTasksCard', { tone: 'good', badge: 'Supervisor', metric1: 'Ready', metric2: 'Today' });
        setToolCardState('communityAssignmentsCard', { tone: 'good', badge: 'Assignments', metric1: 'Company', metric2: 'Routing' });
        setToolCardState('employeeAccountActivationsCard', { tone: 'good', badge: 'Review', metric1: 'Queue', metric2: 'Users' });
        setToolCardState('companyBrandingTextingCard', { tone: 'good', badge: 'Branding', metric1: 'Company', metric2: 'Admin' });
        updateVisibleHubCardCount();
      }
      function syncWeatherEmergencyPill(){
        var pill = $('weatherEmergencyTextPill');
        var badge = $('weatherRiskBadge');
        if(!pill || !badge) return;
        var riskText = String((badge.textContent || '')).toLowerCase();
        var riskClass = String(badge.className || '').toLowerCase();
        var severe = /high|severe|storm|warning|danger|extreme/.test(riskText) || /is-high|is-severe|is-danger/.test(riskClass);
        var moderate = severe || /moderate|watch|elevated/.test(riskText) || /is-medium|is-moderate|is-watch/.test(riskClass);
        if(moderate){
          pill.classList.remove('is-hidden');
          pill.classList.toggle('is-pulse', severe);
        }else{
          pill.classList.add('is-hidden');
          pill.classList.remove('is-pulse');
        }
      }

      function observeWeatherRiskBadge(){
        var badge = $('weatherRiskBadge');
        if(!badge || badge.__mh2Observed) return;
        badge.__mh2Observed = true;
        try{
          var obs = new MutationObserver(function(){ syncWeatherEmergencyPill(); });
          obs.observe(badge, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class'] });
        }catch(_e){}
        syncWeatherEmergencyPill();
      }


      function weatherCacheKey(zip){
        return 'mh2-weather-cache:' + String(zip || '').trim();
      }
      function getCachedWeather(zip, maxAgeMs){
        zip = String(zip || '').trim();
        if(!zip) return null;
        maxAgeMs = Number(maxAgeMs || 0) || 900000;
        try{
          var raw = sessionStorage.getItem(weatherCacheKey(zip)) || localStorage.getItem(weatherCacheKey(zip)) || '';
          if(!raw) return null;
          var parsed = JSON.parse(raw);
          if(!parsed || !parsed.ts || !parsed.data) return null;
          if((Date.now() - Number(parsed.ts || 0)) > maxAgeMs) return null;
          return parsed.data;
        }catch(_e){ return null; }
      }
      function setCachedWeather(zip, data){
        zip = String(zip || '').trim();
        if(!zip || !data) return;
        var payload = JSON.stringify({ ts:Date.now(), data:data });
        try{ sessionStorage.setItem(weatherCacheKey(zip), payload); }catch(_e){}
        try{ localStorage.setItem(weatherCacheKey(zip), payload); }catch(_e){}
      }
      function miles(v){
        var n = Number(v || 0);
        if(!isFinite(n)) return 0;
        return Math.max(0, Math.round((n / 1609.34) * 10) / 10);
      }
      function weatherCodeSummary(code){
        var c = Number(code);
        if(c === 0) return 'Clear skies and stable conditions.';
        if([1,2].indexOf(c) >= 0) return 'Partly cloudy with manageable conditions.';
        if(c === 3) return 'Cloudy conditions across the community.';
        if([45,48].indexOf(c) >= 0) return 'Fog may reduce visibility around the property.';
        if([51,53,55,56,57].indexOf(c) >= 0) return 'Light rain possible. Monitor walkways and entries.';
        if([61,63,65,66,67,80,81,82].indexOf(c) >= 0) return 'Rain is likely. Watch for slick surfaces and resident concerns.';
        if([71,73,75,77,85,86].indexOf(c) >= 0) return 'Winter weather may affect access and safety.';
        if([95,96,99].indexOf(c) >= 0) return 'Storm activity is possible. Be ready to notify residents quickly.';
        return 'Conditions are changing. Review the forecast before sending crews or alerts.';
      }
      function weatherCodeShort(code){
        var c = Number(code);
        if(c === 0) return 'Clear';
        if(c === 1) return 'Mostly clear';
        if(c === 2) return 'Partly cloudy';
        if(c === 3) return 'Cloudy';
        if([45,48].indexOf(c) >= 0) return 'Fog';
        if([51,53,55,56,57].indexOf(c) >= 0) return 'Drizzle';
        if([61,63,65,66,67,80,81,82].indexOf(c) >= 0) return 'Rain';
        if([71,73,75,77,85,86].indexOf(c) >= 0) return 'Snow';
        if([95,96,99].indexOf(c) >= 0) return 'Storms';
        return 'Forecast';
      }
      function evaluateWeatherRisk(model){
        model = model || {};
        var hero = $('weatherHeroCard') || document.querySelector('.mh2-weather-hero');
        if(hero){ hero.classList.remove('wx-empty'); }
        setWeatherVisualClass(model);
        var rainChance = Number(model.rainChance || 0);
        var wind = Number(model.windMph || 0);
        var gust = Number(model.gustMph || 0);
        var code = Number(model.weatherCode || 0);
        var severeCode = [95,96,99].indexOf(code) >= 0;
        var rainCode = [51,53,55,56,57,61,63,65,66,67,80,81,82].indexOf(code) >= 0;
        var snowCode = [71,73,75,77,85,86].indexOf(code) >= 0;
        if(severeCode || gust >= 35 || wind >= 28 || rainChance >= 70){
          return { level:'high', text:'High risk' };
        }
        if(rainCode || snowCode || gust >= 25 || wind >= 20 || rainChance >= 40){
          return { level:'moderate', text:'Moderate risk' };
        }
        return { level:'low', text:'Low risk' };
      }
      function updateWeatherRiskBadge(risk){
        var badge = $('weatherRiskBadge');
        if(!badge) return;
        risk = risk || { level:'low', text:'Low risk' };
        badge.textContent = risk.text || 'Low risk';
        badge.classList.remove('is-low','is-moderate','is-high','is-severe','is-danger');
        badge.classList.add(risk.level === 'high' ? 'is-high' : (risk.level === 'moderate' ? 'is-moderate' : 'is-low'));
        syncWeatherEmergencyPill();
      }
      function setForecastChip(id, label, value, sub){
        var el = $(id);
        if(!el) return;
        var parts = el.children || [];
        if(parts[0]) parts[0].textContent = label || '';
        if(parts[1]) parts[1].textContent = value || '';
        if(parts[2]) parts[2].textContent = sub || '';
      }
      function buildEmergencyHref(zip, communityName, riskText, summary){
        var params = new URLSearchParams();
        if(zip) params.set('weather_zip', String(zip));
        if(communityName) params.set('community', String(communityName));
        if(riskText) params.set('risk', String(riskText));
        if(summary) params.set('weather_summary', String(summary));
        return 'emergency_texting.html?' + params.toString();
      }

      function setWeatherVisualClass(model){
        var hero = $('weatherHeroCard') || document.querySelector('.mh2-weather-hero');
        if(!hero) return;
        hero.classList.remove('wx-day','wx-night','wx-cloudy','wx-clear','wx-rain','wx-empty','wx-sunrise','wx-sunset','wx-overcast','wx-rain-overcast','wx-thunder');

        var summary = String((model && model.summary) || '').toLowerCase();
        var sunriseRaw = String((model && model.sunrise) || '');
        var sunsetRaw = String((model && model.sunset) || '');
        var mRise = sunriseRaw.match(/(\d{1,2}):(\d{2})/);
        var mSet = sunsetRaw.match(/(\d{1,2}):(\d{2})/);
        var now = new Date();
        var currentMins = now.getHours() * 60 + now.getMinutes();
        var scene = 'wx-day';

        if(mRise && mSet){
          var riseMins = Number(mRise[1]) * 60 + Number(mRise[2]);
          var setMins = Number(mSet[1]) * 60 + Number(mSet[2]);
          var isSunriseWindow = currentMins >= (riseMins - 45) && currentMins <= (riseMins + 75);
          var isSunsetWindow = currentMins >= (setMins - 75) && currentMins <= (setMins + 45);
          var isNight = currentMins < (riseMins - 45) || currentMins > (setMins + 45);
          if(isSunriseWindow){
            scene = 'wx-sunrise';
          }else if(isSunsetWindow){
            scene = 'wx-sunset';
          }else if(isNight){
            scene = 'wx-night';
          }
        }else{
          if(now.getHours() < 6 || now.getHours() >= 19){
            scene = 'wx-night';
          }else if(now.getHours() === 6 || now.getHours() === 7){
            scene = 'wx-sunrise';
          }else if(now.getHours() === 18){
            scene = 'wx-sunset';
          }
        }

        var isCloudy = /cloud|overcast|fog|mist|haze/.test(summary);
        var isRain = /rain|storm|shower|drizzle|thunder/.test(summary);
        hero.classList.add(scene);
        hero.classList.add(isRain ? 'wx-rain' : (isCloudy ? 'wx-cloudy' : 'wx-clear'));
      }

      function renderWeatherEmptyState(communityName, message){
        var tempEl = $('weatherTempValue');
        var summaryEl = $('weatherSummaryText');
        var sunriseEl = $('weatherSunriseText');
        var sunsetEl = $('weatherSunsetText');
        var feelsChip = $('weatherFeelsLikeChip');
        var rainChip = $('weatherRainChip');
        var windChip = $('weatherWindChip');
        var humidityEl = $('weatherHumidityValue');
        var visibilityEl = $('weatherVisibilityValue');
        var windEl = $('weatherWindValue');
        var rainEl = $('weatherRainValue');
        var labelEl = $('weatherLocationLabel');
        var hero = $('weatherHeroCard') || document.querySelector('.mh2-weather-hero');
        var side = $('weatherSideCard');
        if(hero){
          hero.classList.remove('wx-day','wx-night','wx-cloudy','wx-clear','wx-rain','wx-sunrise','wx-sunset');
          hero.classList.add('wx-empty');
          hero.classList.add('mh2-is-ready');
        }
        if(side){ side.classList.add('mh2-is-ready'); }
        if(labelEl){
          labelEl.textContent = String(communityName || 'Weather');
          labelEl.classList.add('mh2-is-ready');
        }
        if(tempEl) tempEl.textContent = '--';
        if(summaryEl) summaryEl.textContent = String(message || 'Add a ZIP code to load live weather for this community.');
        if(sunriseEl) sunriseEl.textContent = 'Sunrise --';
        if(sunsetEl) sunsetEl.textContent = 'Sunset --';
        if(feelsChip) feelsChip.textContent = 'Feels like --';
        if(rainChip) rainChip.textContent = 'Rain --';
        if(windChip) windChip.textContent = 'Wind --';
        if(humidityEl) humidityEl.textContent = '--';
        if(visibilityEl) visibilityEl.textContent = '--';
        if(windEl) windEl.textContent = '--';
        if(rainEl) rainEl.textContent = '--';
        setForecastChip('weatherForecastNow', 'Now', '--', 'Weather unavailable');
        setForecastChip('weatherForecastLater', 'Later', '--', 'Add ZIP');
        setForecastChip('weatherForecastTonight', 'Tonight', '--', 'Add ZIP');
      }

      function renderWeatherModel(model){

        model = model || {};
        var tempEl = $('weatherTempValue');
        var summaryEl = $('weatherSummaryText');
        var sunriseEl = $('weatherSunriseText');
        var sunsetEl = $('weatherSunsetText');
        var feelsChip = $('weatherFeelsLikeChip');
        var rainChip = $('weatherRainChip');
        var windChip = $('weatherWindChip');
        var humidityEl = $('weatherHumidityValue');
        var visibilityEl = $('weatherVisibilityValue');
        var windEl = $('weatherWindValue');
        var rainEl = $('weatherRainValue');
        var labelEl = $('weatherLocationLabel');
        var pill = $('weatherEmergencyTextPill');
        var hero = $('weatherHeroCard') || document.querySelector('.mh2-weather-hero');
        var side = $('weatherSideCard');
        if(hero){ hero.classList.add('mh2-is-ready'); }
        if(side){ side.classList.add('mh2-is-ready'); }
        if(tempEl) tempEl.textContent = String(model.tempDisplay || '--');
        if(summaryEl) summaryEl.textContent = String(model.summary || 'Weather details are loading for this community.');
        if(sunriseEl) sunriseEl.textContent = model.sunrise ? ('Sunrise ' + model.sunrise) : 'Sunrise --';
        if(sunsetEl) sunsetEl.textContent = model.sunset ? ('Sunset ' + model.sunset) : 'Sunset --';
        if(feelsChip) feelsChip.textContent = 'Feels like ' + String(model.feelsLikeDisplay || '--');
        if(rainChip) rainChip.textContent = 'Rain ' + String(model.rainChanceDisplay || '--');
        if(windChip) windChip.textContent = 'Wind ' + String(model.windDisplay || '--');
        if(humidityEl) humidityEl.textContent = String(model.humidityDisplay || '--');
        if(visibilityEl) visibilityEl.textContent = String(model.visibilityDisplay || '--');
        if(windEl) windEl.textContent = String(model.windDisplay || '--');
        if(rainEl) rainEl.textContent = String(model.rainChanceDisplay || '--');
        if(labelEl && model.locationLabel){
          labelEl.textContent = String(model.locationLabel);
          labelEl.classList.add('mh2-is-ready');
        }
        setForecastChip('weatherForecastNow', 'Now', String(model.tempDisplay || '--'), String(model.nowSub || 'Live forecast'));
        setForecastChip('weatherForecastLater', String(model.laterLabel || 'Later'), String(model.laterTempDisplay || '--'), String(model.laterSub || 'Watch conditions'));
        setForecastChip('weatherForecastTonight', 'Tonight', String(model.tonightTempDisplay || '--'), String(model.tonightSub || 'Evening outlook'));
        updateWeatherRiskBadge(model.risk || { level:'low', text:'Low risk' });
        if(pill){
          pill.href = buildEmergencyHref(model.zip || '', model.communityName || '', model.risk && model.risk.text || '', model.summary || '');
          pill.title = (model.risk && model.risk.level === 'high') ? 'Open Emergency Texting for severe weather' : 'Open Emergency Texting';
        }
      }
      async function fetchWeatherByZip(zip, communityName){
        zip = String(zip || '').replace(/\D+/g,'').slice(0,5);
        if(!zip) return null;
        var locRes = await fetch('https://api.zippopotam.us/us/' + encodeURIComponent(zip));
        if(!locRes.ok) throw new Error('Unable to resolve weather ZIP');
        var locJson = await locRes.json();
        var place = (locJson.places && locJson.places[0]) || {};
        var lat = Number(place.latitude || (place.latitude === 0 ? 0 : NaN));
        var lon = Number(place.longitude || (place.longitude === 0 ? 0 : NaN));
        if(!isFinite(lat) || !isFinite(lon)) throw new Error('Weather coordinates unavailable');
        var weatherUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + encodeURIComponent(lat) +
          '&longitude=' + encodeURIComponent(lon) +
          '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,visibility' +
          '&hourly=temperature_2m,precipitation_probability,weather_code' +
          '&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
          '&forecast_days=2&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto';
        var wxRes = await fetch(weatherUrl);
        if(!wxRes.ok) throw new Error('Unable to load weather forecast');
        var wx = await wxRes.json();
        var current = wx.current || {};
        var hourly = wx.hourly || {};
        var times = hourly.time || [];
        var temps = hourly.temperature_2m || [];
        var probs = hourly.precipitation_probability || [];
        var codes = hourly.weather_code || [];
        var idxLater = Math.min(4, Math.max(1, times.length - 1));
        var idxTonight = Math.min(11, Math.max(0, times.length - 1));
        var baseRain = Number((wx.daily && wx.daily.precipitation_probability_max && wx.daily.precipitation_probability_max[0]) || probs[0] || 0);
        var riskBase = {
          weatherCode: Number(current.weather_code || 0),
          rainChance: baseRain,
          windMph: Number(current.wind_speed_10m || 0),
          gustMph: Number(current.wind_gusts_10m || 0)
        };
        var risk = evaluateWeatherRisk(riskBase);
        var placeName = [place['place name'], place['state abbreviation']].filter(Boolean).join(', ');
        var locationLabel = communityName ? (String(communityName) + (placeName ? ' • ' + placeName : '')) : (placeName || ('ZIP ' + zip));
        return {
          zip: zip,
          communityName: String(communityName || ''),
          locationLabel: locationLabel,
          tempDisplay: Math.round(Number(current.temperature_2m || 0)) + '°',
          feelsLikeDisplay: Math.round(Number(current.apparent_temperature || current.temperature_2m || 0)) + '°',
          rainChanceDisplay: Math.round(baseRain) + '%',
          windDisplay: Math.round(Number(current.wind_speed_10m || 0)) + ' mph',
          humidityDisplay: Math.round(Number(current.relative_humidity_2m || 0)) + '%',
          visibilityDisplay: miles(current.visibility || 0) + ' mi',
          summary: weatherCodeSummary(current.weather_code || 0),
          sunrise: (wx.daily && wx.daily.sunrise && wx.daily.sunrise[0]) ? String(wx.daily.sunrise[0]).split('T')[1].slice(0,5) : '',
          sunset: (wx.daily && wx.daily.sunset && wx.daily.sunset[0]) ? String(wx.daily.sunset[0]).split('T')[1].slice(0,5) : '',
          weatherCode: Number(current.weather_code || 0),
          rainChance: baseRain,
          windMph: Number(current.wind_speed_10m || 0),
          gustMph: Number(current.wind_gusts_10m || 0),
          risk: risk,
          nowSub: weatherCodeShort(current.weather_code || 0),
          laterLabel: (times[idxLater] ? new Date(times[idxLater]).toLocaleTimeString([], { hour:'numeric' }) : 'Later').replace(':00',''),
          laterTempDisplay: (temps[idxLater] != null ? Math.round(Number(temps[idxLater])) + '°' : '--'),
          laterSub: weatherCodeShort(codes[idxLater] || current.weather_code || 0),
          tonightTempDisplay: (temps[idxTonight] != null ? Math.round(Number(temps[idxTonight])) + '°' : '--'),
          tonightSub: weatherCodeShort(codes[idxTonight] || current.weather_code || 0)
        };
      }
      window.loadWeatherHub = async function loadWeatherHub(force){
        var ctx = getActiveCommunityContext();
        var zipInput = $('weatherZipInput');
        var zip = String((zipInput && zipInput.value) || ctx.zip || '').replace(/\D+/g,'').slice(0,5);
        var communityName = String(ctx.name || '');
        if(!zip){
          renderWeatherModel({
            zip:'',
            communityName:communityName,
            locationLabel:communityName || 'Weather',
            tempDisplay:'--',
            feelsLikeDisplay:'--',
            rainChanceDisplay:'--',
            windDisplay:'--',
            humidityDisplay:'--',
            visibilityDisplay:'--',
            summary:'Add a ZIP code to load live weather conditions for this community.',
            sunrise:'',
            sunset:'',
            risk:{ level:'low', text:'Low risk' },
            nowSub:'Forecast unavailable',
            laterLabel:'Later',
            laterTempDisplay:'--',
            laterSub:'Add ZIP',
            tonightTempDisplay:'--',
            tonightSub:'Add ZIP'
          });
          return;
        }
        var cached = !force ? getCachedWeather(zip, 20 * 60 * 1000) : null;

        if(cached){
          cached.communityName = communityName || cached.communityName || '';
          renderWeatherModel(cached);
        }
        try{
          var model = await fetchWeatherByZip(zip, communityName);
          renderWeatherModel(model);
          setCachedWeather(zip, model);
        }catch(err){
          console.warn('weather load failed', err);
          if(!cached){
            renderWeatherModel({
              zip:zip,
              communityName:communityName,
              locationLabel:communityName ? (communityName + ' • ZIP ' + zip) : ('ZIP ' + zip),
              tempDisplay:'--',
              feelsLikeDisplay:'--',
              rainChanceDisplay:'--',
              windDisplay:'--',
              humidityDisplay:'--',
              visibilityDisplay:'--',
              summary:'Live weather could not be loaded right now. You can still use this community ZIP for weather texting.',
              sunrise:'',
              sunset:'',
              risk:{ level:'low', text:'Low risk' },
              nowSub:'Weather unavailable',
              laterLabel:'Later',
              laterTempDisplay:'--',
              laterSub:'Retry soon',
              tonightTempDisplay:'--',
              tonightSub:'Retry soon'
            });
          }
        }
      }

      window.bootstrapCommunityGlobals = function bootstrapCommunityGlobals(){
        var select = $('zummeeCommunitySelect');
        var opt = select && select.options && select.selectedIndex >= 0 ? select.options[select.selectedIndex] : null;
        var seedId = String((select && select.value) || getStoredCommunityToken() || '').trim();
        var seedName = String((opt && opt.textContent) || '').trim();
        var seedZip = String((opt && opt.getAttribute && opt.getAttribute('data-zip')) || '').trim();
        syncCommunityGlobals({ id:seedId, name:seedName, zip:seedZip, raw:seedId || seedName });
      }

      function applySmartAlertStatesAndSort(){
        applyCanonicalSmartAlerts();
      }


      function getAlertTone(el){
        if(!el) return 'missing';
        if(el.classList.contains('is-urgent')) return 'urgent';
        if(el.classList.contains('is-attention')) return 'attention';
        if(el.classList.contains('is-good')) return 'good';
        return 'unset';
      }

      function renderAlertDebugOverlay(payload){
        var body = $('mh2DebugBody');
        if(!body) return;
        function line(label, value){
          return '<div class="mh2-debug-line"><strong>' + esc(label) + ':</strong> <code>' + esc(String(value)) + '</code></div>';
        }
        var html = '';
        html += '<div class="mh2-debug-card"><h4>Community</h4>' +
          line('Selected', payload.communityName || 'Unknown') +
          line('Community ID', payload.communityId || 'Unknown') +
          line('ZIP', payload.zip || 'Blank') +
          '</div>';

        html += '<div class="mh2-debug-card"><h4>Board Alert</h4>' +
          line('Open board items', payload.boardOpen) +
          line('Overdue board items', payload.boardOverdue) +
          line('Rendered tone', payload.boardTone) +
          '</div>';

        html += '<div class="mh2-debug-card"><h4>Activity Alert</h4>' +
          line('Total live events scanned', payload.eventsScanned) +
          line('Allowed activity types', payload.allowedTypes.join(', ')) +
          line('Open work orders', payload.openWorkOrders) +
          line('Live maintenance events', payload.liveMaintenanceEvents) +
          line('Maintenance/work-order events', payload.activityEvents) +
          line('Urgent activity events', payload.urgentActivityEvents) +
          line('Rendered tone', payload.activityTone) +
          '</div>';

        html += '<div class="mh2-debug-card"><h4>Approvals Alert</h4>' +
          line('Rendered tone', payload.approvalsTone) +
          '</div>';

        if(payload.sampleTypes && payload.sampleTypes.length){
          html += '<div class="mh2-debug-card"><h4>Sample Event Types</h4>';
          payload.sampleTypes.forEach(function(item, idx){
            html += line('Event ' + (idx + 1), item);
          });
          html += '</div>';
        }

        body.innerHTML = html;
      }

      function wireAlertDebugOverlay(){
        var fab = $('mh2DebugFab');
        var panel = $('mh2DebugPanel');
        var closeBtn = $('mh2DebugClose');
        if(!fab || !panel || fab.__wired) return;
        fab.__wired = true;
        fab.addEventListener('click', function(){
          panel.classList.toggle('is-hidden');
          fab.style.display = panel.classList.contains('is-hidden') ? 'inline-flex' : 'none';
        });
        closeBtn.addEventListener('click', function(){
          panel.classList.add('is-hidden');
          fab.style.display = 'inline-flex';
        });
      }

      function getEventTypeNormalized(e){
        return String((e && (e.type || e.event_type || e.kind || e.category)) || '').toLowerCase().trim();
      }
      function getEventPriorityNormalized(e){
        return String((e && (e.priority || e.severity || e.level)) || '').toLowerCase().trim();
      }

      function applySmartAlertStatesAndSort(debugMeta){
        var board = $('mh2AlertBoard');
        var activity = $('mh2AlertActivity');
        var approvals = $('mh2AlertApprovals');
        var strip = document.querySelector('.mh2-alert-strip, .mh2-smart-strip');

        if(board && debugMeta){
          board.classList.remove('is-good','is-attention','is-urgent');
          if(Number(debugMeta.boardOverdue || 0) > 0){
            board.classList.add('is-urgent');
          }else if(Number(debugMeta.boardOpen || 0) > 0){
            board.classList.add('is-attention');
          }else{
            board.classList.add('is-good');
          }
        }

        if(activity){
          var summary = window.__mh2MaintenanceSummary || {};
          var urgentOpenCount = Number(summary.urgentWorkOrders || 0);
          var openCount = Number(summary.openWorkOrders || 0);
          var liveCount = Number(summary.liveMaintenanceEvents || 0);

          activity.classList.remove('is-good','is-attention','is-urgent');

          if(urgentOpenCount > 0){
            activity.classList.add('is-urgent');
          }else if(openCount > 0 || liveCount > 0){
            activity.classList.add('is-attention');
          }else{
            activity.classList.add('is-good');
          }

          var badge = activity.querySelector('.mh2-alert-badge');
          var title = activity.querySelector('.mh2-alert-title');
          var copy = activity.querySelector('.mh2-alert-copy');

          if(urgentOpenCount > 0){
            if(title) title.textContent = 'Maintenance activity';
            if(badge) badge.textContent = String(urgentOpenCount) + ' urgent';
            if(copy) copy.textContent = String(urgentOpenCount) + ' urgent maintenance signal' + (urgentOpenCount === 1 ? '' : 's');
            activity.setAttribute('href', 'maintenance_updates.html');
          }else if(openCount > 0){
            if(title) title.textContent = 'Maintenance activity';
            if(badge) badge.textContent = String(openCount) + ' open';
            if(copy) copy.textContent = String(openCount) + ' open maintenance item' + (openCount === 1 ? '' : 's');
            activity.setAttribute('href', 'maintenance_updates.html');
          }else if(liveCount > 0){
            if(title) title.textContent = 'Maintenance activity';
            if(badge) badge.textContent = String(liveCount) + ' live';
            if(copy) copy.textContent = String(liveCount) + ' live maintenance event' + (liveCount === 1 ? '' : 's');
            activity.setAttribute('href', 'maintenance_updates.html');
          }else{
            if(title) title.textContent = 'Maintenance activity';
            if(badge) badge.textContent = 'Quiet';
            if(copy) copy.textContent = 'No open maintenance items';
            activity.setAttribute('href', 'maintenance_updates.html');
          }
        }

        if(debugMeta){
          debugMeta.boardTone = getAlertTone(board);
          debugMeta.activityTone = getAlertTone(activity);
          debugMeta.approvalsTone = getAlertTone(approvals);
          if (typeof renderAlertDebugOverlay === 'function') renderAlertDebugOverlay(debugMeta);
        }
      }

      async function refreshAll(){
        bootstrapCommunityGlobals();
        await renderCommunities();
        bootstrapCommunityGlobals();
        await Promise.all([loadBoardItemsPanel(), loadLiveActivity(), loadApprovalSummary(), loadBrandLogo(), applyRoleVisibility(), loadWeatherHub()]);
        await loadManagerActionCards();
        applyCanonicalSmartAlerts();
      }
      document.addEventListener('community:changed', async function(){
        bootstrapCommunityGlobals();
        applyWeatherContext(getActiveCommunityContext());
        await Promise.all([loadWeatherHub(true), loadBoardItemsPanel(), loadLiveActivity(), loadApprovalSummary(), loadBrandLogo()]);
        wireThemeToggle();
        await loadManagerActionCards();
      });
      window.addEventListener('focus', async function(){
        bootstrapCommunityGlobals();
        applyWeatherContext(getActiveCommunityContext());
        await Promise.all([loadWeatherHub(true), loadBoardItemsPanel(), loadLiveActivity(), loadApprovalSummary(), loadBrandLogo()]);
        wireThemeToggle();
        await loadManagerActionCards();
      });
    })();
  