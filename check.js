

    const DEFAULT_SUPABASE_URL = 'https://slcwuuwyrgnmlmxpcaim.supabase.co';
    const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsY3d1dXd5cmdubWxteHBjYWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMjI5MTAsImV4cCI6MjA4NDU5ODkxMH0.3pZZLufFv5SUHREjgPys-q8SnYVMzHona-yeXMVHuOg';
    const SUPABASE_URL = window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || DEFAULT_SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || DEFAULT_SUPABASE_ANON_KEY;

    const sb = (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storage: window.localStorage,
            storageKey: 'sb-zummee-auth'
          }
        })
      : null;
    window.sb = sb;

    const AUTH_STORAGE_KEYS = ['sb-zummee-auth', 'sb-slcwuuwyrgnmlmxpcaim-auth-token', 'supabase.auth.token'];

    function readAuthPayloadFromStorage(){
      for(const key of AUTH_STORAGE_KEYS){
        try{
          const raw = localStorage.getItem(key);
          if(!raw) continue;
          const parsed = safeJson(raw, null);
          if(parsed) return parsed;
        }catch(_e){}
      }
      return null;
    }

    async function restoreSupabaseSessionFromStorage(){
      if(!sb || !sb.auth) return null;
      try{
        const current = await sb.auth.getSession();
        if(current?.data?.session) return current.data.session;
      }catch(_e){}
      const payload = readAuthPayloadFromStorage();
      const candidate = payload?.currentSession || payload?.session || payload || null;
      const access_token = candidate?.access_token || candidate?.provider_token || '';
      const refresh_token = candidate?.refresh_token || '';
      if(!access_token || !refresh_token || typeof sb.auth.setSession !== 'function') return null;
      try{
        const restored = await sb.auth.setSession({ access_token, refresh_token });
        if(restored?.data?.session) return restored.data.session;
      }catch(err){
        console.warn('restoreSupabaseSessionFromStorage failed', err);
      }
      return null;
    }

    const Store = {
      activeCommunityId: '',
      activeCommunityName: '',
      communities: [],
      userId: '',
      companyId: '',
      cache: { board: new Map(), records: new Map(), reminders: new Map(), quickNotes: new Map(), vendors: new Map(), accessCodes: new Map() },
      editingReminderId: '',
      editingQuickNoteId: '',
      editingVendorId: '',
      editingImportantDateId: '',
      editingAccessCodeId: '',
      currentUserRole: '',
      canAuthorSupervisorComms: false
    };

    function byId(id){ return document.getElementById(id); }
    function safeJson(v, fb){ try{ return JSON.parse(v); }catch(_e){ return fb; } }
    function escapeHtml(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s])); }
    function uniqBy(items, keyFn){ const seen = new Set(); return (items||[]).filter(item => { const k = keyFn(item); if(seen.has(k)) return false; seen.add(k); return true; }); }
    function readCurrentUserId(){
      const candidates = [];
      try{ candidates.push(localStorage.getItem('activeUserId')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('currentUserId')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('zummee_user_id')); }catch(_e){}
      try{ const p = safeJson(localStorage.getItem('zummee_profile_v1')||'{}',{}); candidates.push(p.uid, p.user_id, p.id); }catch(_e){}
      try{ const sess = safeJson(localStorage.getItem('supabase.auth.token')||'{}',{}); candidates.push(sess?.currentSession?.user?.id, sess?.user?.id); }catch(_e){}
      try{
        for(let i=0;i<localStorage.length;i++){
          const key = localStorage.key(i) || '';
          if(!/auth-token/i.test(key)) continue;
          const raw = localStorage.getItem(key) || '{}';
          const tok = safeJson(raw, {});
          candidates.push(tok?.currentSession?.user?.id, tok?.user?.id, tok?.session?.user?.id);
        }
      }catch(_e){}
      return String(candidates.find(Boolean) || '').trim();
    }
    function readCurrentCompanyId(){
      const candidates = [];
      try{ candidates.push(localStorage.getItem('activeCompanyId')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('currentCompanyId')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('zummee_company_id')); }catch(_e){}
      try{ const p = safeJson(localStorage.getItem('zummee_profile_v1')||'{}',{}); candidates.push(p.company_id); }catch(_e){}
      return String(candidates.find(Boolean) || '').trim();
    }
    function readCurrentCompanyName(){
      const candidates = [];
      try{ candidates.push(localStorage.getItem('activeCompanyName')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('currentCompanyName')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('companyName')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('company_name')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('zummee_selected_company_name_v1')); }catch(_e){}
      try{ candidates.push(localStorage.getItem('zummeeActiveCompanyName')); }catch(_e){}
      try{ const p = safeJson(localStorage.getItem('zummee_profile_v1')||'{}',{}); candidates.push(p.companyName, p.company_name); }catch(_e){}
      const direct = String(candidates.find(v => String(v||'').trim()) || '').trim();
      if(direct) return direct;
      try{
        for(let i=0;i<localStorage.length;i++){
          const key = localStorage.key(i) || '';
        }
      }catch(_e){}
      try{
        for(let i=0;i<localStorage.length;i++){
          const key = localStorage.key(i) || '';
          if(key.indexOf('zummee_company_communities_v1__') !== 0) continue;
          const suffix = key.slice('zummee_company_communities_v1__'.length).trim();
          if(suffix) return suffix;
        }
      }catch(_e){}
      return '';
    }
    function readCommunityCandidates(){
      const all = [];
      const pushCommunity = (item) => {
        if(!item || typeof item !== 'object') return;
        const id = String(item.id || item.community_id || item.communityId || '').trim();
        const name = String(item.name || item.community_name || item.communityName || item.label || item.text || '').trim();
        if(id && name) all.push({ id, name });
      };
      const parseValue = (raw) => {
        const val = safeJson(raw, null);
        if(Array.isArray(val)) val.forEach(pushCommunity);
        else if(val && typeof val === 'object'){
          if(Array.isArray(val.communities)) val.communities.forEach(pushCommunity);
          else if(Array.isArray(val.items)) val.items.forEach(pushCommunity);
          else if(Array.isArray(val.data)) val.data.forEach(pushCommunity);
        }
      };
      const keys = new Set();
      const companyName = readCurrentCompanyName();
      if(companyName) keys.add('zummee_company_communities_v1__' + companyName);
      keys.add('zummee_company_communities_v1');
      keys.add('zummee_company_communities');
      try{
        for(let i=0;i<localStorage.length;i++){
          const key = localStorage.key(i) || '';
          if(key.indexOf('zummee_company_communities_v1__') === 0) keys.add(key);
        }
      }catch(_e){}
      Array.from(keys).forEach(key => {
        try{ const raw = localStorage.getItem(key); if(raw) parseValue(raw); }catch(_e){}
      });
      try{
        const currentName = String(localStorage.getItem('activeCommunityName') || localStorage.getItem('currentCommunityName') || '').trim();
        const currentId = String(localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_community_id') || localStorage.getItem('zummee_selected_community_id') || '').trim();
        if(currentName && currentId) all.push({ id: currentId, name: currentName });
      }catch(_e){}
      return uniqBy(all.filter(x => x.id && x.name), x => x.id);
    }
    async function ensureUser(){
      Store.userId = readCurrentUserId();
      Store.companyId = readCurrentCompanyId();
      if((Store.userId && Store.companyId) || !sb) return;
      try{
        const sess = await sb.auth.getSession();
        const user = sess?.data?.session?.user;
        if(!Store.userId) Store.userId = String(user?.id || '').trim();
      }catch(_e){}
      try{
        const res = await sb.auth.getUser();
        const user = res?.data?.user;
        if(!Store.userId) Store.userId = String(user?.id || '').trim();
      }catch(_e){}
    }
    function syncCommunityToStorage(){
      try{ if(Store.activeCommunityId) localStorage.setItem('activeCommunityId', Store.activeCommunityId); }catch(_e){}
      try{ if(Store.activeCommunityName) localStorage.setItem('activeCommunityName', Store.activeCommunityName); }catch(_e){}
      try{ if(Store.activeCommunityId) localStorage.setItem('currentCommunityId', Store.activeCommunityId); }catch(_e){}
      try{ if(Store.activeCommunityName) localStorage.setItem('currentCommunityName', Store.activeCommunityName); }catch(_e){}
      try{ if(Store.activeCommunityId) localStorage.setItem('zummee_community_id', Store.activeCommunityId); }catch(_e){}
      try{ if(Store.activeCommunityId) localStorage.setItem('zummee_selected_community_id', Store.activeCommunityId); }catch(_e){}
    }
    async function fetchCommunitiesFromSupabase(){
      if(!sb) return [];
      await ensureUser();
      const out = [];
      const pushRows = (rows) => {
        (rows||[]).forEach(row => out.push({
          id: String((row && (row.id || row.community_id)) || '').trim(),
          name: String((row && (row.name || row.community_name || row.community)) || '').trim()
        }));
      };
      try{
        const userId = Store.userId;
        if(userId){
          const variants = ['employee_user_id','user_id','employee_id'];
          for(const col of variants){
            try{
              const q = await sb.from('community_assignments').select('community_id, community_name').eq(col, userId).limit(200);
              if(!q.error && q.data?.length) pushRows(q.data);
            }catch(_e){}
          }
        }
      }catch(_e){}
      try{
        const company = Store.companyId;
        if(company){
          for(const col of ['company_id','company_name']){
            try{
              const q = await sb.from('company_communities').select('community_id, community_name').eq(col, company).limit(200);
              if(!q.error && q.data?.length) pushRows(q.data);
            }catch(_e){}
          }
        }
      }catch(_e){}
      try{
        const q3 = await sb.from('communities').select('id,name,community_name').limit(200);
        if(!q3.error) pushRows(q3.data);
      }catch(_e){}
      return uniqBy(out.filter(x => x.id || x.name), x => (x.id || ('name:' + x.name.toLowerCase())));
    }
    function renderCommunityOptions(){
      const select = byId('communitySelect');
      if(!Store.communities.length){
        select.innerHTML = '<option value="">No communities found</option>';
        Store.activeCommunityId = '';
        Store.activeCommunityName = '';
        return;
      }
      const currentId = String(localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_community_id') || localStorage.getItem('zummee_selected_community_id') || '').trim();
      const currentName = String(localStorage.getItem('activeCommunityName') || localStorage.getItem('currentCommunityName') || '').trim().toLowerCase();
      const match = Store.communities.find(c => (c.id && c.id === currentId) || (c.name && c.name.toLowerCase() === currentName)) || Store.communities[0];
      Store.activeCommunityId = match.id || '';
      Store.activeCommunityName = match.name || '';
      select.innerHTML = Store.communities.map(c => {
        const value = encodeURIComponent(JSON.stringify(c));
        const selected = ((c.id && c.id === Store.activeCommunityId) || ((!c.id || !Store.activeCommunityId) && c.name === Store.activeCommunityName)) ? ' selected' : '';
        return `<option value="${value}"${selected}>${escapeHtml(c.name || c.id || 'Community')}</option>`;
      }).join('');
      syncCommunityToStorage();
    }
    function attachCommunitySelect(){
      byId('communitySelect').addEventListener('change', async (e) => {
        const obj = safeJson(decodeURIComponent(e.target.value), {});
        Store.activeCommunityId = String(obj.id || '').trim();
        Store.activeCommunityName = String(obj.name || '').trim();
        syncCommunityToStorage();
        await loadModules();
      });
    }
    function setMetric(id, value){ byId(id).textContent = String(value); }
    function mountEmpty(el, message){ el.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`; }
    function normalizeBoardMembers(rows){
      return (rows||[]).map(row => ({
        name: String(row?.full_name || row?.name || '').trim(),
        position: String(row?.position || '').trim(),
        term_begin: String(row?.term_begin || row?.termBegin || '').trim(),
        term_end: String(row?.term_end || row?.termEnd || '').trim(),
        phone: String(row?.phone || '').trim(),
        email: String(row?.email || '').trim()
      })).filter(r => r.name || r.position || r.phone || r.email || r.term_begin || r.term_end);
    }
    async function loadBoardMembersModule(){
      const mount = byId('boardMount');
      mount.className = 'loader';
      mount.textContent = 'Loading board members…';
      const cacheKey = Store.activeCommunityId || ('name:' + Store.activeCommunityName.toLowerCase());
      if(Store.cache.board.has(cacheKey)){
        renderBoardMembers(Store.cache.board.get(cacheKey));
      }
      if(!sb || !Store.activeCommunityId){
        if(!Store.activeCommunityId) mountEmpty(mount, 'Choose a community to load board members.');
        setMetric('boardMetric', 0); byId('boardCountPill').textContent = '0';
        return;
      }
      try{
        const q = await sb.from('board_member_directory')
          .select('full_name,position,email,phone,term_begin,term_end,created_at')
          .eq('community_id', Store.activeCommunityId)
          .order('created_at', { ascending:true });
        if(q.error) throw q.error;
        const rows = normalizeBoardMembers(q.data || []);
        Store.cache.board.set(cacheKey, rows);
        renderBoardMembers(rows);
      }catch(err){
        console.error('Daily Ops v2 board members failed', err);
        mountEmpty(mount, 'Unable to load board members right now.');
      }
    }
    function renderBoardMembers(rows){
      const mount = byId('boardMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('boardMetric', rows.length);
      byId('boardCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No board members found for this community yet.'); return; }
      mount.className = 'tableWrap';
      mount.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Position</th><th>Term</th><th>Phone</th><th>Email</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td><strong>${escapeHtml(row.name || '—')}</strong></td>
                <td>${escapeHtml(row.position || '—')}</td>
                <td>${escapeHtml((row.term_begin || '—') + (row.term_end ? (' → ' + row.term_end) : ''))}</td>
                <td>
                  ${escapeHtml(row.phone || '—')}
                  ${row.phone ? `<div class="contactActions"><a class="mini" href="tel:${escapeHtml(row.phone.replace(/[^0-9+]/g,''))}">Call</a><a class="mini" href="sms:${escapeHtml(row.phone.replace(/[^0-9+]/g,''))}">Text</a></div>` : ''}
                </td>
                <td>
                  ${escapeHtml(row.email || '—')}
                  ${row.email ? `<div class="contactActions"><a class="mini" href="mailto:${escapeHtml(row.email)}">Email</a></div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }
    async function loadAnnualRecordsModule(){
      const mount = byId('recordsMount');
      if(!mount) return;
      mount.className = 'loader';
      mount.textContent = 'Loading annual meeting records…';
      const cacheKey = Store.activeCommunityId || ('name:' + Store.activeCommunityName.toLowerCase());
      if(Store.cache.records.has(cacheKey)){
        renderAnnualRecords(Store.cache.records.get(cacheKey));
      }
      if(!sb){ mountEmpty(mount, 'Supabase is unavailable on this beta page.'); return; }
      try{
        await ensureUser();
        const q = sb.from('annual_meeting_packet_requests')
          .select('*')
          .eq('status', 'approved')
          .order('approved_at', { ascending:false })
          .limit(20);
        if(Store.companyId) q.eq('company_id', Store.companyId);
        const res = await q;
        if(res.error) throw res.error;
        const rows = (res.data || []).filter(row => {
          const employeeId = String(row?.employee_user_id || '').trim();
          if(Store.userId && employeeId && employeeId !== Store.userId) return false;
          let payload = row?.packet_payload || {};
          if(typeof payload === 'string') payload = safeJson(payload, {});
          const rowCommunityId = String(row?.community_id || row?.communityId || payload?.communityId || payload?.community_id || '').trim();
          const rowCommunityName = String(row?.community_name || row?.communityName || payload?.communityName || payload?.community_name || payload?.associationLegalName || '').trim().toLowerCase();
          if(Store.activeCommunityId) return rowCommunityId === Store.activeCommunityId;
          return !!(Store.activeCommunityName && rowCommunityName === Store.activeCommunityName.toLowerCase());
        });
        Store.cache.records.set(cacheKey, rows);
        renderAnnualRecords(rows);
      }catch(err){
        console.error('Daily Ops v2 annual records failed', err);
        mountEmpty(mount, 'Unable to load annual meeting records right now.');
      }
    }
    function renderAnnualRecords(rows){
      const mount = byId('recordsMount');
      const pill = byId('recordsCountPill');
      if(!mount) return;
      rows = Array.isArray(rows) ? rows : [];
      setMetric('recordsMetric', rows.length);
      if(pill) pill.textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No approved annual meeting records yet for this community.'); return; }
      mount.className = 'recordList';
      mount.innerHTML = rows.map(row => {
        let payload = row?.packet_payload || {};
        if(typeof payload === 'string') payload = safeJson(payload, {});
        const communityName = String(row?.community_name || row?.communityName || payload?.communityName || payload?.associationLegalName || Store.activeCommunityName || 'Community Association').trim();
        const meetingDate = String(payload?.nextAnnualMeetingDate || '—').trim() || '—';
        const meetingTime = String(payload?.meetingTime || '').trim();
        const approvedAt = row?.approved_at ? new Date(row.approved_at).toLocaleString() : '—';
        return `
          <article class="record">
            <div class="eyebrow" style="background:rgba(23,50,77,.06);color:#4d6580;">Archived meeting record</div>
            <div class="recordTitle" style="margin-top:12px;">${escapeHtml(communityName)}</div>
            <div class="cardSub" style="margin-top:8px;">Approved on ${escapeHtml(approvedAt)}</div>
            <div class="recordMeta">
              <div class="metaPill">Meeting ${escapeHtml(meetingDate)}${meetingTime ? ' at ' + escapeHtml(meetingTime) : ''}</div>
              <div class="metaPill" style="background:#dbeafe;border-color:#bfdbfe;color:#17324d;">Approved & Archived</div>
            </div>
            <div class="contactActions" style="margin-top:16px;">
              <button class="btn ghost" type="button" onclick="window.location.href='annual_packet_preview.html'">Open preview page</button>
            </div>
          </article>`;
      }).join('');
    }

    function remindersStorageKey(){
      return `dailyOpsV2:reminders:${Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())}`;
    }
    function readReminderRows(){
      try{
        const arr = safeJson(localStorage.getItem(remindersStorageKey()) || '[]', []);
        return Array.isArray(arr) ? arr : [];
      }catch(_e){ return []; }
    }
    function writeReminderRows(rows){
      try{ localStorage.setItem(remindersStorageKey(), JSON.stringify(rows || [])); }catch(_e){}
    }
    function resetReminderForm(){
      Store.editingReminderId = '';
      byId('reminderTitle').value = '';
      byId('reminderDate').value = '';
      byId('saveReminderBtn').textContent = 'Save reminder';
    }
    function renderReminders(rows){
      const mount = byId('remindersMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('remindersMetric', rows.length);
      byId('remindersCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No reminders for this community yet.'); return; }
      mount.className = 'recordList';
      mount.innerHTML = rows.map(row => `
        <article class="record">
          <div class="recordTitle" style="font-size:18px;">${escapeHtml(row.title || 'Reminder')}</div>
          <div class="recordMeta">
            <div class="metaPill">Due ${escapeHtml(row.date || '—')}</div>
            <div class="metaPill" style="background:${row.overdue ? 'rgba(255,234,234,.95)' : '#f7fafc'};color:${row.overdue ? '#8f2f2f' : '#35516e'};border-color:rgba(23,50,77,.08);">${row.overdue ? 'Overdue' : 'Scheduled'}</div>
          </div>
          <div class="contactActions" style="margin-top:14px;">
            <button class="btn ghost reminder-load" type="button" data-id="${escapeHtml(row.id)}">Load into form</button>
            <button class="btn secondary reminder-delete" type="button" data-id="${escapeHtml(row.id)}">Delete</button>
          </div>
        </article>
      `).join('');
      mount.querySelectorAll('.reminder-load').forEach(btn => btn.addEventListener('click', () => {
        const row = rows.find(r => r.id === btn.dataset.id);
        if(!row) return;
        Store.editingReminderId = row.id;
        byId('reminderTitle').value = row.title || '';
        byId('reminderDate').value = row.date || '';
        byId('saveReminderBtn').textContent = 'Update reminder';
      }));
      mount.querySelectorAll('.reminder-delete').forEach(btn => btn.addEventListener('click', () => {
        const next = rows.filter(r => r.id !== btn.dataset.id);
        writeReminderRows(next);
        if(Store.editingReminderId === btn.dataset.id) resetReminderForm();
        loadRemindersModule();
      }));
    }
    function loadRemindersModule(){
      const mount = byId('remindersMount');
      if(!Store.activeCommunityId && !Store.activeCommunityName){ mountEmpty(mount, 'Choose a community to load reminders.'); setMetric('remindersMetric', 0); byId('remindersCountPill').textContent = '0'; return; }
      const today = new Date().toISOString().slice(0,10);
      const rows = readReminderRows().map(row => ({ ...row, overdue: !!(row.date && row.date < today) }));
      renderReminders(rows);
    }
    function attachRemindersModule(){
      byId('saveReminderBtn').addEventListener('click', () => {
        const title = String(byId('reminderTitle').value || '').trim();
        const date = String(byId('reminderDate').value || '').trim();
        if(!title){ alert('Enter a reminder first.'); return; }
        const rows = readReminderRows();
        const id = Store.editingReminderId || ('rem_' + Date.now());
        const nextRow = { id, title, date, updatedAt: new Date().toISOString() };
        const next = Store.editingReminderId ? rows.map(r => r.id === id ? nextRow : r) : [nextRow, ...rows];
        writeReminderRows(next);
        resetReminderForm();
        loadRemindersModule();
      });
    }
    function quickNotesStorageKey(){
      return `dailyOpsV2:quickNotes:${Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())}`;
    }
    function readQuickNoteRows(){
      try{
        const arr = safeJson(localStorage.getItem(quickNotesStorageKey()) || '[]', []);
        return Array.isArray(arr) ? arr : [];
      }catch(_e){ return []; }
    }
    function writeQuickNoteRows(rows){
      try{ localStorage.setItem(quickNotesStorageKey(), JSON.stringify(rows || [])); }catch(_e){}
    }
    function resetQuickNoteForm(){
      Store.editingQuickNoteId = '';
      byId('quickNoteInput').value = '';
      byId('saveQuickNoteBtn').textContent = 'Save note';
    }
    function renderQuickNotes(rows){
      const mount = byId('quickNotesMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('quickNotesMetric', rows.length);
      byId('quickNotesCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No quick notes for this community yet.'); return; }
      mount.className = 'recordList';
      mount.innerHTML = rows.map(row => `
        <article class="record">
          <div class="recordTitle" style="font-size:18px;white-space:pre-wrap;">${escapeHtml(row.note || 'Quick note')}</div>
          <div class="recordMeta">
            <div class="metaPill">Saved ${escapeHtml(row.updatedAt ? new Date(row.updatedAt).toLocaleString() : 'recently')}</div>
            <div class="metaPill" style="background:#f8fbff;color:#35516e;border-color:rgba(23,50,77,.08);">Community note</div>
          </div>
          <div class="contactActions" style="margin-top:14px;">
            <button class="btn ghost quicknote-load" type="button" data-id="${escapeHtml(row.id)}">Load into form</button>
            <button class="btn secondary quicknote-delete" type="button" data-id="${escapeHtml(row.id)}">Delete</button>
          </div>
        </article>
      `).join('');
      mount.querySelectorAll('.quicknote-load').forEach(btn => btn.addEventListener('click', () => {
        const row = rows.find(r => r.id === btn.dataset.id);
        if(!row) return;
        Store.editingQuickNoteId = row.id;
        byId('quickNoteInput').value = row.note || '';
        byId('saveQuickNoteBtn').textContent = 'Update note';
      }));
      mount.querySelectorAll('.quicknote-delete').forEach(btn => btn.addEventListener('click', () => {
        const next = rows.filter(r => r.id !== btn.dataset.id);
        writeQuickNoteRows(next);
        if(Store.editingQuickNoteId === btn.dataset.id) resetQuickNoteForm();
        loadQuickNotesModule();
      }));
    }
    function loadQuickNotesModule(){
      const mount = byId('quickNotesMount');
      if(!Store.activeCommunityId && !Store.activeCommunityName){ mountEmpty(mount, 'Choose a community to load quick notes.'); setMetric('quickNotesMetric', 0); byId('quickNotesCountPill').textContent = '0'; return; }
      renderQuickNotes(readQuickNoteRows());
    }
    function attachQuickNotesModule(){
      byId('saveQuickNoteBtn').addEventListener('click', () => {
        const note = String(byId('quickNoteInput').value || '').trim();
        if(!note){ alert('Enter a quick note first.'); return; }
        const rows = readQuickNoteRows();
        const id = Store.editingQuickNoteId || ('note_' + Date.now());
        const nextRow = { id, note, updatedAt: new Date().toISOString() };
        const next = Store.editingQuickNoteId ? rows.map(r => r.id === id ? nextRow : r) : [nextRow, ...rows];
        writeQuickNoteRows(next);
        resetQuickNoteForm();
        loadQuickNotesModule();
      });
    }


    function vendorsStorageKey(){
      return `dailyOpsV2:vendors:${Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())}`;
    }
    function readVendorRows(){
      try{
        const arr = safeJson(localStorage.getItem(vendorsStorageKey()) || '[]', []);
        return Array.isArray(arr) ? arr : [];
      }catch(_e){ return []; }
    }
    function writeVendorRows(rows){
      try{ localStorage.setItem(vendorsStorageKey(), JSON.stringify(rows || [])); }catch(_e){}
    }
    function resetVendorForm(){
      Store.editingVendorId = '';
      byId('vendorNameInput').value = '';
      byId('vendorCategoryInput').value = '';
      byId('vendorPhoneInput').value = '';
      byId('vendorEmailInput').value = '';
      byId('saveVendorBtn').textContent = 'Save vendor';
    }
    function renderVendors(rows){
      const mount = byId('vendorsMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('vendorsMetric', rows.length);
      byId('vendorsCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No vendors for this community yet.'); return; }
      mount.className = 'recordList';
      mount.innerHTML = rows.map(row => `
        <article class="record">
          <div class="recordTitle" style="font-size:18px;">${escapeHtml(row.name || 'Vendor')}</div>
          <div class="recordMeta">
            <div class="metaPill">${escapeHtml(row.category || 'General')}</div>
            ${row.phone ? `<div class="metaPill">${escapeHtml(row.phone)}</div>` : ''}
            ${row.email ? `<div class="metaPill">${escapeHtml(row.email)}</div>` : ''}
          </div>
          <div class="contactActions" style="margin-top:14px;">
            <button class="btn ghost vendor-load" type="button" data-id="${escapeHtml(row.id)}">Load into form</button>
            <button class="btn secondary vendor-delete" type="button" data-id="${escapeHtml(row.id)}">Delete</button>
          </div>
        </article>
      `).join('');
      mount.querySelectorAll('.vendor-load').forEach(btn => btn.addEventListener('click', () => {
        const row = rows.find(r => r.id === btn.dataset.id);
        if(!row) return;
        Store.editingVendorId = row.id;
        byId('vendorNameInput').value = row.name || '';
        byId('vendorCategoryInput').value = row.category || '';
        byId('vendorPhoneInput').value = row.phone || '';
        byId('vendorEmailInput').value = row.email || '';
        byId('saveVendorBtn').textContent = 'Update vendor';
      }));
      mount.querySelectorAll('.vendor-delete').forEach(btn => btn.addEventListener('click', () => {
        const next = rows.filter(r => r.id !== btn.dataset.id);
        writeVendorRows(next);
        if(Store.editingVendorId === btn.dataset.id) resetVendorForm();
        loadVendorsModule();
      }));
    }
    function loadVendorsModule(){
      const mount = byId('vendorsMount');
      if(!Store.activeCommunityId && !Store.activeCommunityName){ mountEmpty(mount, 'Choose a community to load vendors.'); setMetric('vendorsMetric', 0); byId('vendorsCountPill').textContent = '0'; return; }
      renderVendors(readVendorRows());
    }
    function attachVendorsModule(){
      byId('saveVendorBtn').addEventListener('click', () => {
        const name = String(byId('vendorNameInput').value || '').trim();
        const category = String(byId('vendorCategoryInput').value || '').trim();
        const phone = String(byId('vendorPhoneInput').value || '').trim();
        const email = String(byId('vendorEmailInput').value || '').trim();
        if(!name){ alert('Enter a vendor name first.'); return; }
        const rows = readVendorRows();
        const id = Store.editingVendorId || ('vendor_' + Date.now());
        const nextRow = { id, name, category, phone, email, updatedAt: new Date().toISOString() };
        const next = Store.editingVendorId ? rows.map(r => r.id === id ? nextRow : r) : [nextRow, ...rows];
        writeVendorRows(next);
        resetVendorForm();
        loadVendorsModule();
      });
    }

    function importantDatesStorageKey(){
      return `dailyOpsV2:importantDates:${Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())}`;
    }
    function readImportantDateRows(){
      try{
        const arr = safeJson(localStorage.getItem(importantDatesStorageKey()) || '[]', []);
        return Array.isArray(arr) ? arr : [];
      }catch(_e){ return []; }
    }
    function writeImportantDateRows(rows){
      try{ localStorage.setItem(importantDatesStorageKey(), JSON.stringify(rows || [])); }catch(_e){}
    }
    function resetImportantDateForm(){
      Store.editingImportantDateId = '';
      byId('importantTypeInput').value = 'Contract Renewal';
      byId('importantVendorInput').value = '';
      byId('importantDescInput').value = '';
      byId('importantDateInput').value = '';
      byId('importantRecurringInput').value = 'yes';
      byId('importantFrequencyInput').value = 'Yearly';
      byId('importantLeadInput').value = '30';
      byId('saveImportantDateBtn').textContent = 'Save important date';
    }
    function computeImportantDateStatus(row){
      const due = String(row.date || '').trim();
      if(!due) return 'Needs Review';
      const lead = Number(row.leadTime || 30);
      const today = new Date();
      today.setHours(0,0,0,0);
      const dueDate = new Date(due + 'T00:00:00');
      if(Number.isNaN(dueDate.getTime())) return 'Needs Review';
      const diffDays = Math.floor((dueDate - today) / 86400000);
      if(diffDays < 0) return 'Overdue';
      if(diffDays <= lead) return 'Due Soon';
      return 'Upcoming';
    }
    function importantStatusPill(status){
      const map = {
        'Overdue': 'background:#ffe6e8;color:#9f2334;border-color:rgba(159,35,52,.16);',
        'Due Soon': 'background:#fff6de;color:#946200;border-color:rgba(148,98,0,.16);',
        'Upcoming': 'background:#e9f6ee;color:#1e7a4c;border-color:rgba(30,122,76,.16);',
        'Needs Review': 'background:#eef5ff;color:#2d5f9a;border-color:rgba(45,95,154,.16);'
      };
      return map[status] || map['Needs Review'];
    }
    function renderImportantDates(rows){
      const mount = byId('importantDatesMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('importantDatesMetric', rows.length);
      byId('importantDatesCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No important dates for this community yet.'); return; }
      const sorted = rows.slice().sort((a,b) => String(a.date||'9999-12-31').localeCompare(String(b.date||'9999-12-31')));
      mount.className = 'recordList';
      mount.innerHTML = sorted.map(row => {
        const status = computeImportantDateStatus(row);
        return `
        <article class="record">
          <div class="recordTitle" style="font-size:18px;">${escapeHtml(row.type || 'Important Date')}</div>
          <div class="recordMeta">
            <div class="metaPill" style="${importantStatusPill(status)}">${escapeHtml(status)}</div>
            ${row.vendor ? `<div class="metaPill">${escapeHtml(row.vendor)}</div>` : ''}
            ${row.date ? `<div class="metaPill">Due ${escapeHtml(new Date(row.date + 'T00:00:00').toLocaleDateString())}</div>` : ''}
            ${row.recurring === 'yes' ? `<div class="metaPill">${escapeHtml(row.frequency || 'Recurring')}</div>` : `<div class="metaPill">One Time</div>`}
            <div class="metaPill">Lead ${escapeHtml(String(row.leadTime || 30))}d</div>
          </div>
          ${row.description ? `<div class="recordSub" style="margin-top:10px;">${escapeHtml(row.description)}</div>` : ''}
          <div class="contactActions" style="margin-top:14px;">
            <button class="btn ghost important-load" type="button" data-id="${escapeHtml(row.id)}">Load into form</button>
            <button class="btn secondary important-delete" type="button" data-id="${escapeHtml(row.id)}">Delete</button>
          </div>
        </article>
      `;}).join('');
      mount.querySelectorAll('.important-load').forEach(btn => btn.addEventListener('click', () => {
        const row = sorted.find(r => r.id === btn.dataset.id);
        if(!row) return;
        Store.editingImportantDateId = row.id;
        byId('importantTypeInput').value = row.type || 'Contract Renewal';
        byId('importantVendorInput').value = row.vendor || '';
        byId('importantDescInput').value = row.description || '';
        byId('importantDateInput').value = row.date || '';
        byId('importantRecurringInput').value = row.recurring || 'yes';
        byId('importantFrequencyInput').value = row.frequency || 'Yearly';
        byId('importantLeadInput').value = String(row.leadTime || 30);
        byId('saveImportantDateBtn').textContent = 'Update important date';
      }));
      mount.querySelectorAll('.important-delete').forEach(btn => btn.addEventListener('click', () => {
        const next = rows.filter(r => r.id !== btn.dataset.id);
        writeImportantDateRows(next);
        if(Store.editingImportantDateId === btn.dataset.id) resetImportantDateForm();
        loadImportantDatesModule();
      loadAccessCodesModule();
      }));
    }
    function loadImportantDatesModule(){
      const mount = byId('importantDatesMount');
      if(!Store.activeCommunityId && !Store.activeCommunityName){ mountEmpty(mount, 'Choose a community to load important dates.'); setMetric('importantDatesMetric', 0); byId('importantDatesCountPill').textContent = '0'; return; }
      renderImportantDates(readImportantDateRows());
    }
    function attachImportantDatesModule(){
      byId('saveImportantDateBtn').addEventListener('click', () => {
        const type = String(byId('importantTypeInput').value || '').trim();
        const vendor = String(byId('importantVendorInput').value || '').trim();
        const description = String(byId('importantDescInput').value || '').trim();
        const date = String(byId('importantDateInput').value || '').trim();
        const recurring = String(byId('importantRecurringInput').value || 'yes').trim();
        const frequency = String(byId('importantFrequencyInput').value || 'Yearly').trim();
        const leadTime = Number(byId('importantLeadInput').value || 30) || 30;
        if(!type){ alert('Choose a type first.'); return; }
        if(!description && !vendor){ alert('Add a vendor/company or a description first.'); return; }
        const rows = readImportantDateRows();
        const id = Store.editingImportantDateId || ('imp_' + Date.now());
        const nextRow = { id, type, vendor, description, date, recurring, frequency, leadTime, updatedAt: new Date().toISOString() };
        const next = Store.editingImportantDateId ? rows.map(r => r.id === id ? nextRow : r) : [nextRow, ...rows];
        writeImportantDateRows(next);
        resetImportantDateForm();
        loadImportantDatesModule();
      loadAccessCodesModule();
      });
    }
    function openAccessCodeText(row){
      const community = Store.activeCommunityName || row.communityName || 'the community';
      const label = String(row && row.name || 'Access code').trim();
      const code = String(row && row.code || '').trim();
      const message = encodeURIComponent(`${community} - ${label} code: ${code}${row && row.notes ? ` (${String(row.notes).trim()})` : ''}`);
      const smsHref = `sms:?body=${message}`;
      try{
        window.location.href = smsHref;
      }catch(_e){
        window.open(smsHref, '_self');
      }
    }

    function supervisorCompanyScopeKey(){
      const company = getSupervisorCompanyKey() || 'default-company';
      return `dailyOpsV2:supervisorComms:company:${String(company).toLowerCase()}`;
    }
    function supervisorCommunityScopeKey(){
      return `dailyOpsV2:supervisorComms:community:${Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())}`;
    }
    function readSupervisorCommRows(scope){
      return [];
    }
    function writeSupervisorCommRows(scope, rows){
      return;
    }
    function supervisorSharedPrefKey(scope){
      const company = String(getSupervisorCompanyKey() || 'default-company').trim().toLowerCase();
      const community = String(Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())).trim();
      return scope === 'Company-wide'
        ? ('daily_ops_v2_supervisor_comms__company__' + company)
        : ('daily_ops_v2_supervisor_comms__community__' + community);
    }
    async function loadSupervisorCommRowsShared(scope){
      return [];
    }
    async function saveSupervisorCommRowsShared(scope, rows){
      return true;
    }
    function readAllSupervisorCommRows(){
      return [];
    }
    function clearLegacySupervisorCommCache(){
      try{ localStorage.removeItem(supervisorCompanyScopeKey()); }catch(_e){}
      try{ localStorage.removeItem(supervisorCommunityScopeKey()); }catch(_e){}
    }
    function resetSupervisorCommForm(){
      Store.editingSupervisorCommId = '';
      Store.editingSupervisorCommScope = '';
      byId('supervisorCommTitleInput').value = '';
      byId('supervisorCommTypeInput').value = 'Required Task';
      byId('supervisorCommScopeInput').value = 'Community';
      byId('supervisorCommRuleInput').value = 'Specific Date';
      byId('supervisorCommNotesInput').value = '';
      byId('supervisorCommDateInput').value = '';
      byId('saveSupervisorCommBtn').textContent = 'Save communication';
    }
    function getSupervisorCommStatus(row){
      if(row.completedAt) return {label:'Completed', tone:'completed'};
      const today = new Date(); today.setHours(0,0,0,0);
      const due = row.date ? new Date(row.date + 'T00:00:00') : null;
      if(!due || isNaN(due)) return {label:'Needs Review', tone:'review'};
      const diff = Math.round((due - today)/86400000);
      if(diff < 0) return {label:'Overdue', tone:'overdue'};
      if(diff <= 7) return {label:'Due Soon', tone:'soon'};
      return {label:'Upcoming', tone:'upcoming'};
    }
    function supervisorStatusPill(status){
      const map = {
        completed:'background:rgba(226,252,236,.95);color:#1b6b3d;border-color:rgba(27,107,61,.12);',
        overdue:'background:rgba(255,234,234,.95);color:#8f2f2f;border-color:rgba(143,47,47,.12);',
        soon:'background:rgba(255,244,214,.95);color:#8b6100;border-color:rgba(139,97,0,.12);',
        review:'background:#eef2f7;color:#35516e;border-color:rgba(23,50,77,.08);',
        upcoming:'background:#eff6ff;color:#234b7a;border-color:rgba(35,75,122,.12);'
      };
      return map[status] || map.upcoming;
    }
    function scopePillStyle(scope){
      return scope === 'Company-wide'
        ? 'background:rgba(255,246,214,.95);color:#8b6100;border:1px solid rgba(139,97,0,.12);'
        : 'background:#eef4fb;color:#29507f;border:1px solid rgba(41,80,127,.10);';
    }
    function formatSupervisorPostedAt(value){
      if(!value) return '';
      try{
        const d = new Date(value);
        if(isNaN(d)) return '';
        return d.toLocaleString([], { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
      }catch(_e){ return ''; }
    }
    function getSupervisorClient(){
      return (window.sb && typeof window.sb.from === 'function' ? window.sb : (typeof sb !== 'undefined' && sb && typeof sb.from === 'function' ? sb : null));
    }
    function getSupervisorActiveCommunityId(){
      return String(
        Store.activeCommunityId
        || window.currentCommunityId
        || localStorage.getItem('activeCommunityId')
        || localStorage.getItem('currentCommunityId')
        || localStorage.getItem('zummee_community_id')
        || localStorage.getItem('zummee_selected_community_id')
        || ''
      ).trim();
    }
    function getSupervisorCompanyKey(){
      try{
        const companyId = String(
          (typeof readCurrentCompanyId === 'function' ? readCurrentCompanyId() : '')
          || localStorage.getItem('zummee_selected_company_id')
          || localStorage.getItem('zummee_active_company_id')
          || localStorage.getItem('activeCompanyId')
          || localStorage.getItem('currentCompanyId')
          || localStorage.getItem('zummee_company_id')
          || ''
        ).trim();
        if(companyId) return companyId.toLowerCase();
        const rawName = String(
          (typeof readCurrentCompanyName === 'function' ? readCurrentCompanyName() : '')
          || localStorage.getItem('zummee_selected_company_name_v1')
          || localStorage.getItem('zummeeActiveCompanyName')
          || localStorage.getItem('company_name')
          || localStorage.getItem('activeCompanyName')
          || localStorage.getItem('currentCompanyName')
          || ''
        ).trim().toLowerCase();
        return rawName || '';
      }catch(_e){ return ''; }
    }
    function getSupervisorDbSelectColumns(){
      return 'id, community_id, scope, company_key, message, type, rule, notes, due_date, created_by, created_at, updated_at';
    }
    async function getSupervisorSessionUser(){
      try{
        const client = getSupervisorClient();
        const sessionRes = client && client.auth && typeof client.auth.getSession === 'function' ? await client.auth.getSession() : null;
        return sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user ? sessionRes.data.session.user : null;
      }catch(_e){ return null; }
    }

    function normalizeZummeeRole(value){
      const role = String(value || '').trim().toLowerCase();
      if(!role) return '';
      if(role.includes('admin')) return 'admin';
      if(role.includes('supervisor')) return 'supervisor';
      if(role.includes('manager')) return 'employee';
      if(role.includes('employee')) return 'employee';
      return role;
    }
    async function resolveCurrentZummeeRole(){
      const client = getSupervisorClient();
      const user = await getSupervisorSessionUser();
      const uid = String(user && user.id || Store.userId || readCurrentUserId() || '').trim();
      const localCandidates = [];
      try{ const p = safeJson(localStorage.getItem('zummee_profile_v1') || '{}', {}); localCandidates.push(p.role, p.user_role, p.account_type, p.type); }catch(_e){}
      try{ localCandidates.push(localStorage.getItem('zummee_role'), localStorage.getItem('userRole'), localStorage.getItem('role'), localStorage.getItem('activeRole')); }catch(_e){}
      for(const candidate of localCandidates){
        const normalized = normalizeZummeeRole(candidate);
        if(normalized) return normalized;
      }
      if(client && uid){
        const checks = [
          { table:'profiles', column:'id' },
          { table:'profiles', column:'user_id' },
          { table:'userdirectory', column:'user_id' },
          { table:'userdirectory', column:'id' }
        ];
        for(const check of checks){
          try{
            const res = await client.from(check.table).select('role,user_role,account_type,type').eq(check.column, uid).maybeSingle();
            if(res && res.data){
              const normalized = normalizeZummeeRole(res.data.role || res.data.user_role || res.data.account_type || res.data.type);
              if(normalized) return normalized;
            }
          }catch(_e){}
        }
      }
      return '';
    }
    async function applySupervisorCommsRoleLock(){
      const role = await resolveCurrentZummeeRole();
      Store.currentUserRole = role;
      Store.canAuthorSupervisorComms = role === 'supervisor' || role === 'admin';
      document.body.classList.toggle('zummee-can-author-supervisor-comms', !!Store.canAuthorSupervisorComms);
      const form = byId('supervisorCommForm');
      if(form){
        form.setAttribute('aria-hidden', Store.canAuthorSupervisorComms ? 'false' : 'true');
        form.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = !Store.canAuthorSupervisorComms; });
      }
      return Store.canAuthorSupervisorComms;
    }
    function ensureSupervisorSaveStatusEl(){
      let el = byId('supervisorCommSaveStatus');
      if(el) return el;
      const btn = byId('saveSupervisorCommBtn');
      if(!btn || !btn.parentNode) return null;
      el = document.createElement('div');
      el.id = 'supervisorCommSaveStatus';
      el.style.marginTop = '8px';
      el.style.fontSize = '13px';
      el.style.fontWeight = '700';
      el.style.letterSpacing = '.01em';
      el.style.color = '#35516e';
      btn.parentNode.insertBefore(el, btn.nextSibling);
      return el;
    }
    function setSupervisorSaveStatus(message, tone){
      const el = ensureSupervisorSaveStatusEl();
      if(!el) return;
      el.textContent = message || '';
      el.style.color = tone || '#35516e';
    }
    async function loadSupervisorDbRows(){
      try{
        const client = getSupervisorClient();
        const communityId = getSupervisorActiveCommunityId();
        const companyKey = getSupervisorCompanyKey();
        if(!client) return [];
        const columns = getSupervisorDbSelectColumns();
        const communityQuery = communityId
          ? client.from('supervisor_messages').select(columns).eq('scope', 'Community').eq('community_id', communityId).order('created_at', { ascending:false }).limit(20)
          : Promise.resolve({ data: [], error: null });
        const companyQuery = companyKey
          ? client.from('supervisor_messages').select(columns).eq('scope', 'Company-wide').eq('company_key', companyKey).order('created_at', { ascending:false }).limit(20)
          : Promise.resolve({ data: [], error: null });
        const [communityResult, companyResult] = await Promise.all([communityQuery, companyQuery]);
        if(communityResult && communityResult.error){
          console.error('loadSupervisorDbRows community error', communityResult.error);
        }
        if(companyResult && companyResult.error){
          console.error('loadSupervisorDbRows company error', companyResult.error);
        }
        const rawRows = []
          .concat(Array.isArray(communityResult && communityResult.data) ? communityResult.data : [])
          .concat(Array.isArray(companyResult && companyResult.data) ? companyResult.data : []);
        return rawRows.map(row => ({
          id: row.id || ('db_' + String(row.created_at || Date.now())),
          _dbId: row.id || '',
          title: row.message || 'Supervisor communication',
          type: row.type || 'Supervisor Message',
          scope: row.scope || (row.company_key ? 'Company-wide' : 'Community'),
          rule: row.rule || 'Needs Review',
          notes: row.notes || '',
          date: row.due_date || '',
          createdAt: row.created_at || '',
          updatedAt: row.updated_at || row.created_at || '',
          createdBy: row.created_by || '',
          _source: 'db',
          _dbCommunityId: row.community_id || '',
          _dbCompanyKey: row.company_key || ''
        }));
      }catch(err){
        console.error('loadSupervisorDbRows fatal', err);
        return [];
      }
    }
    function mergeSupervisorRows(rows){
      const seen = new Set();
      return (Array.isArray(rows) ? rows : []).filter(row => {
        const key = `${row && row._source === 'db' ? 'db' : 'local'}:${String(row && row.id || '')}:${String(row && row.scope || '')}`;
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a,b) => String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    }
    function getSupervisorTargetFromUrl(){
      try{
        const params = new URLSearchParams(window.location.search || '');
        return {
          dbId: String(params.get('supervisor_message_id') || '').trim(),
          localId: String(params.get('supervisor_local_id') || '').trim(),
          scope: String(params.get('supervisor_scope') || '').trim()
        };
      }catch(_e){ return { dbId:'', localId:'', scope:'' }; }
    }
    function applySupervisorDeepLink(){
      const target = getSupervisorTargetFromUrl();
      const mount = byId('supervisorCommsMount');
      if(!mount) return;
      let selector = '';
      if(target.dbId && window.CSS && CSS.escape){ selector = `.supervisor-record[data-db-id="${CSS.escape(target.dbId)}"]`; }
      else if(target.localId && window.CSS && CSS.escape){ selector = `.supervisor-record[data-local-id="${CSS.escape(target.localId)}"][data-scope="${CSS.escape(target.scope || 'Community')}"]`; }
      if(!selector) return;
      const el = mount.querySelector(selector);
      if(!el) return;
      const card = byId('supervisorCommsCard');
      if(card && typeof card.scrollIntoView === 'function') card.scrollIntoView({ behavior:'smooth', block:'start' });
      setTimeout(() => {
        try{ el.scrollIntoView({ behavior:'smooth', block:'center' }); }catch(_e){}
        el.classList.add('supervisor-record--target');
        setTimeout(() => { el.classList.remove('supervisor-record--target'); }, 2600);
      }, 120);
    }

    function ensureZummeePopup(){
      let backdrop = byId('zummeePopupBackdrop');
      if(backdrop) return backdrop;
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div id="zummeePopupBackdrop" class="zummee-popup-backdrop" aria-hidden="true">
          <div class="zummee-popup-card" role="dialog" aria-modal="true" aria-labelledby="zummeePopupTitle" aria-describedby="zummeePopupMessage">
            <div class="zummee-popup-eyebrow">Zummee Notice</div>
            <h3 id="zummeePopupTitle" class="zummee-popup-title">Heads up</h3>
            <p id="zummeePopupMessage" class="zummee-popup-message">Please review this item.</p>
            <div class="zummee-popup-actions">
              <button type="button" id="zummeePopupCancel" class="zummee-popup-btn zummee-popup-btn--secondary">Cancel</button>
              <button type="button" id="zummeePopupOk" class="zummee-popup-btn zummee-popup-btn--primary">OK</button>
            </div>
          </div>
        </div>`;
      document.body.appendChild(wrap.firstElementChild);
      backdrop = byId('zummeePopupBackdrop');
      backdrop.addEventListener('click', (e) => {
        if(e.target === backdrop && typeof backdrop.__resolver === 'function') backdrop.__resolver(false);
      });
      return backdrop;
    }
    function closeZummeePopup(result){
      const backdrop = byId('zummeePopupBackdrop');
      if(!backdrop) return;
      const resolver = backdrop.__resolver;
      backdrop.__resolver = null;
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden','true');
      if(backdrop.__cleanup){
        try{ backdrop.__cleanup(); }catch(_e){}
        backdrop.__cleanup = null;
      }
      if(typeof resolver === 'function') resolver(result);
    }
    function zummeePopupAlert(message, opts){
      opts = opts || {};
      return new Promise(resolve => {
        const backdrop = ensureZummeePopup();
        const titleEl = byId('zummeePopupTitle');
        const msgEl = byId('zummeePopupMessage');
        const okBtn = byId('zummeePopupOk');
        const cancelBtn = byId('zummeePopupCancel');
        titleEl.textContent = opts.title || 'Heads up';
        msgEl.textContent = String(message || '');
        okBtn.textContent = opts.okText || 'OK';
        okBtn.className = 'zummee-popup-btn ' + ((opts.danger ? 'zummee-popup-btn--danger' : 'zummee-popup-btn--primary'));
        cancelBtn.style.display = 'none';
        const onKey = (e) => { if(e.key === 'Escape' || e.key === 'Enter'){ e.preventDefault(); closeZummeePopup(true); } };
        okBtn.onclick = () => closeZummeePopup(true);
        backdrop.__cleanup = () => document.removeEventListener('keydown', onKey);
        document.addEventListener('keydown', onKey);
        backdrop.__resolver = (value) => resolve(!!value);
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden','false');
        setTimeout(() => okBtn.focus(), 20);
      });
    }
    function zummeePopupConfirm(message, opts){
      opts = opts || {};
      return new Promise(resolve => {
        const backdrop = ensureZummeePopup();
        const titleEl = byId('zummeePopupTitle');
        const msgEl = byId('zummeePopupMessage');
        const okBtn = byId('zummeePopupOk');
        const cancelBtn = byId('zummeePopupCancel');
        titleEl.textContent = opts.title || 'Please confirm';
        msgEl.textContent = String(message || '');
        okBtn.textContent = opts.okText || 'OK';
        cancelBtn.textContent = opts.cancelText || 'Cancel';
        okBtn.className = 'zummee-popup-btn ' + ((opts.danger ? 'zummee-popup-btn--danger' : 'zummee-popup-btn--primary'));
        cancelBtn.style.display = '';
        const onKey = (e) => {
          if(e.key === 'Escape'){ e.preventDefault(); closeZummeePopup(false); }
          if(e.key === 'Enter'){ e.preventDefault(); closeZummeePopup(true); }
        };
        okBtn.onclick = () => closeZummeePopup(true);
        cancelBtn.onclick = () => closeZummeePopup(false);
        backdrop.__cleanup = () => document.removeEventListener('keydown', onKey);
        document.addEventListener('keydown', onKey);
        backdrop.__resolver = (value) => resolve(!!value);
        backdrop.classList.add('is-open');
        backdrop.setAttribute('aria-hidden','false');
        setTimeout(() => okBtn.focus(), 20);
      });
    }

    function renderSupervisorComms(rows){
      const mount = byId('supervisorCommsMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('supervisorCommsMetric', rows.length);
      byId('supervisorCommsCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No supervisor communications for this community yet.'); return; }
      mount.className = 'recordList';
      mount.innerHTML = rows.map(row => {
        const status = getSupervisorCommStatus(row);
        const scope = row.scope || 'Community';
        const isDbBacked = row._source === 'db' && String(row._dbId || row.id || '').trim() !== '';
        const metaParts = [row.type || 'Required Task', row.rule || 'Specific Date'];
        if(row.date) metaParts.push('Due ' + row.date);
        if(row.notes) metaParts.push(row.notes);
        if(row._source === 'db'){
          const posted = formatSupervisorPostedAt(row.createdAt);
          if(posted) metaParts.push('Posted ' + posted);
        }
        const actionHtml = `<span class="metaPill" style="background:#eef2f7;color:#35516e;border:1px solid rgba(23,50,77,.08);">From Manager Hub</span>${Store.canAuthorSupervisorComms ? `
              <button class="btn secondary supervisor-delete supervisor-delete-db supervisor-author-action" type="button" data-id="${escapeHtml(row.id)}" data-db-id="${escapeHtml(row._dbId || row.id || '')}" data-scope="${escapeHtml(scope)}" data-db-backed="1">Delete</button>` : ''}`;
        return `
        <article class="record supervisor-record supervisor-record--db" data-local-id="" data-db-id="${escapeHtml(row._dbId || row.id || '')}" data-scope="${escapeHtml(scope)}" data-db-backed="1" style="padding:16px 18px;transition:box-shadow .25s ease,border-color .25s ease,transform .25s ease;">
          <div style="display:grid;grid-template-columns:minmax(180px,1fr) auto auto auto;align-items:center;gap:12px;">
            <div style="min-width:0;">
              <div class="recordTitle" style="font-size:17px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(row.title || 'Supervisor communication')}</div>
              <div style="color:#5b7088;font-size:14px;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(metaParts.join(' · '))}</div>
            </div>
            <div class="metaPill" style="${scopePillStyle(scope)}">${escapeHtml(scope)}</div>
            <div class="metaPill" style="${supervisorStatusPill(status.tone)}">${escapeHtml(status.label)}</div>
            <div class="contactActions" style="margin-top:0;display:flex;gap:8px;flex-wrap:nowrap;justify-self:end;">${actionHtml}</div>
          </div>
        </article>`;
      }).join('');
      mount.querySelectorAll('.supervisor-delete').forEach(btn => btn.addEventListener('click', async () => {
        const scope = btn.dataset.scope || 'Community';
        const dbId = String(btn.dataset.dbId || btn.dataset.id || '').trim();
        if(!dbId) return;
        const okDelete = await zummeePopupConfirm('Delete this supervisor communication everywhere? This cannot be undone.', { title:'Delete supervisor communication', okText:'Delete', cancelText:'Cancel', danger:true });
        if(!okDelete) return;
        const client = getSupervisorClient();
        if(!client){
          setSupervisorSaveStatus('Delete failed: Supabase is not available.', '#8f2f2f');
          await zummeePopupAlert('Supabase is not available right now.', { title:'Supabase unavailable' });
          return;
        }
        try{
          setSupervisorSaveStatus('Deleting supervisor communication…', '#35516e');
          const dbResult = await client.from('supervisor_messages').delete().eq('id', dbId).select('id');
          if(dbResult && dbResult.error){
            console.error('supervisor db delete failed', dbResult.error);
            setSupervisorSaveStatus('Delete failed. The communication is still in Supabase.', '#8f2f2f');
            await zummeePopupAlert('Delete failed. The communication is still in Supabase.', { title:'Delete failed', okText:'OK', danger:true });
            return;
          }
          const deletedRows = Array.isArray(dbResult && dbResult.data) ? dbResult.data : [];
          if(!deletedRows.length){
            setSupervisorSaveStatus('Delete failed. The communication is still in Supabase.', '#8f2f2f');
            await zummeePopupAlert('Delete failed. The communication is still in Supabase.', { title:'Delete failed', okText:'OK', danger:true });
            return;
          }
          if(String(Store.editingSupervisorCommId || '') === dbId) resetSupervisorCommForm();
          setSupervisorSaveStatus('Supervisor communication deleted.', '#1b6b3d');
          await loadSupervisorCommsModule();
          try{ window.dispatchEvent(new Event('storage')); }catch(_e){}
          try{ document.dispatchEvent(new CustomEvent('community:changed')); }catch(_e){}
        }catch(err){
          console.error('supervisor db delete fatal', err);
          setSupervisorSaveStatus('Delete failed due to an unexpected error.', '#8f2f2f');
          await zummeePopupAlert('Delete failed due to an unexpected error.', { title:'Delete failed', okText:'OK', danger:true });
        }
      }));
      setTimeout(() => applySupervisorDeepLink(), 30);
    }
    function mergeSupervisorCommRows(dbRows, localRows){
      return mergeSupervisorRows(Array.isArray(dbRows) ? dbRows : []);
    }
    async function loadSupervisorCommsModule(){
      const mount = byId('supervisorCommsMount');
      if(!Store.activeCommunityId && !Store.activeCommunityName){ mountEmpty(mount, 'Choose a community to load supervisor communications.'); setMetric('supervisorCommsMetric', 0); byId('supervisorCommsCountPill').textContent = '0'; return; }
      clearLegacySupervisorCommCache();
      renderSupervisorComms([]);
      try{
        const dbRows = await loadSupervisorDbRows();
        renderSupervisorComms(mergeSupervisorRows(dbRows));
      }catch(err){
        console.error('loadSupervisorCommsModule error', err);
      }
    }
    async function testSupervisorDBSave(){
      if(!Store.canAuthorSupervisorComms){ await zummeePopupAlert('Only supervisors and admins can create supervisor communications.', { title:'Supervisor access required' }); return; }
      const statusEl = byId('supervisorCommsDebugStatus');
      function setStatus(message, tone){
        if(!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.color = tone || '#35516e';
      }
      try{
        const client = (window.sb && typeof window.sb.from === 'function' ? window.sb : (typeof sb !== 'undefined' && sb && typeof sb.from === 'function' ? sb : null));
        if(!client){
          console.log('testSupervisorDBSave: no Supabase client found');
          setStatus('DB test status: no Supabase client found', '#8f2f2f');
          alert('No Supabase client found');
          return;
        }
        const sessionRes = await client.auth.getSession();
        console.log('testSupervisorDBSave session', sessionRes);
        const user = sessionRes && sessionRes.data && sessionRes.data.session && sessionRes.data.session.user;
        if(!user){
          setStatus('DB test status: no active session', '#8f2f2f');
          alert('No active session');
          return;
        }
        const communityId = Store.activeCommunityId || window.currentCommunityId || localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_community_id') || localStorage.getItem('zummee_selected_community_id') || 'test';
        console.log('testSupervisorDBSave communityId', communityId);
        const result = await client
          .from('supervisor_messages')
          .insert([{ community_id: communityId, message: 'TEST FROM BUTTON', created_by: user.id }])
          .select();
        console.log('testSupervisorDBSave insert result', result);
        if(result && result.error){
          setStatus('DB test status: insert failed', '#8f2f2f');
          alert('Insert failed');
          return;
        }
        setStatus('DB test status: insert success', '#1b6b3d');
        alert('Insert SUCCESS');
      }catch(err){
        console.error('testSupervisorDBSave error', err);
        setStatus('DB test status: error during insert', '#8f2f2f');
        alert('Error during insert');
      }
    }
    function attachSupervisorCommsModule(){
      const testBtn = byId('testSupervisorDbSaveBtn');
      if(testBtn && !testBtn.__bound){
        testBtn.__bound = true;
        testBtn.addEventListener('click', testSupervisorDBSave);
      }
      
      byId('saveSupervisorCommBtn').addEventListener('click', async () => {
        if(!Store.canAuthorSupervisorComms){ await zummeePopupAlert('Only supervisors and admins can create supervisor communications.', { title:'Supervisor access required' }); return; }
        const title = String(byId('supervisorCommTitleInput').value || '').trim();
        const type = String(byId('supervisorCommTypeInput').value || 'Required Task').trim();
        const scope = String(byId('supervisorCommScopeInput').value || 'Community').trim() || 'Community';
        const rule = String(byId('supervisorCommRuleInput').value || 'Specific Date').trim();
        const notes = String(byId('supervisorCommNotesInput').value || '').trim();
        const date = String(byId('supervisorCommDateInput').value || '').trim();
        if(!title){
          setSupervisorSaveStatus('Enter a communication title first.', '#8f2f2f');
          await zummeePopupAlert('Enter a communication title first.', { title:'Title required' });
          return;
        }
        const storeScope = Store.editingSupervisorCommId ? (Store.editingSupervisorCommScope || scope) : scope;
        const rows = readSupervisorCommRows(storeScope);
        const id = Store.editingSupervisorCommId || ('supcomm_' + Date.now());
        const existing = rows.find(r => r.id === id) || null;
        const nextRow = { id, title, type, scope, rule, notes, date, completedAt: existing ? existing.completedAt || '' : '', createdAt: existing ? existing.createdAt || new Date().toISOString() : new Date().toISOString(), updatedAt:new Date().toISOString(), _dbId: existing ? existing._dbId || '' : '', _source: existing ? existing._source || '' : '' };
        const client = getSupervisorClient();
        const communityId = getSupervisorActiveCommunityId();
        const user = await getSupervisorSessionUser();
        setSupervisorSaveStatus('Saving supervisor communication…', '#35516e');
        try{
          if(!client){
            setSupervisorSaveStatus('Save failed: Supabase is not available.', '#8f2f2f');
            await zummeePopupAlert('Supabase is not available right now.', { title:'Supabase unavailable' });
            return;
          }
          if(!user || !user.id){
            setSupervisorSaveStatus('Save failed: no active session found.', '#8f2f2f');
            await zummeePopupAlert('Please sign in again and retry.', { title:'Session required' });
            return;
          }
          if(scope === 'Community' && !communityId){
            setSupervisorSaveStatus('Save failed: no active community selected.', '#8f2f2f');
            await zummeePopupAlert('Choose a community before saving a supervisor communication.', { title:'Community required' });
            return;
          }
          const companyKey = getSupervisorCompanyKey();
          if(scope === 'Company-wide' && !companyKey){
            setSupervisorSaveStatus('Save failed: no company context found for company-wide communication.', '#8f2f2f');
            await zummeePopupAlert('Save failed: no company context found for company-wide communication.', { title:'Company context required', okText:'OK', danger:true });
            return;
          }
          const dbPayload = {
            scope,
            company_key: scope === 'Company-wide' ? companyKey : null,
            community_id: scope === 'Community' ? communityId : null,
            message: title,
            type,
            rule,
            notes,
            due_date: date || null,
            created_by: user.id,
            updated_at: new Date().toISOString()
          };
          let dbResult = null;
          if(nextRow._dbId){
            dbResult = await client.from('supervisor_messages').update({
              scope: dbPayload.scope,
              company_key: dbPayload.company_key,
              community_id: dbPayload.community_id,
              message: dbPayload.message,
              type: dbPayload.type,
              rule: dbPayload.rule,
              notes: dbPayload.notes,
              due_date: dbPayload.due_date,
              updated_at: dbPayload.updated_at
            }).eq('id', nextRow._dbId).select();
          } else {
            dbResult = await client.from('supervisor_messages').insert([dbPayload]).select();
          }
          if(dbResult && dbResult.error){
            console.error('saveSupervisorCommBtn db save error', dbResult.error);
            setSupervisorSaveStatus('Save failed. The communication was not written to Supabase.', '#8f2f2f');
            await zummeePopupAlert('Save failed. The communication was not written to Supabase.', { title:'Save failed', okText:'OK', danger:true });
            return;
          }
          const saved = Array.isArray(dbResult && dbResult.data) ? dbResult.data[0] : (dbResult && dbResult.data ? dbResult.data : null);
          if(!saved || !saved.id){
            setSupervisorSaveStatus('Save failed. Supabase did not return the saved record.', '#8f2f2f');
            await zummeePopupAlert('Save failed. Supabase did not return the saved record.', { title:'Save failed', okText:'OK', danger:true });
            return;
          }
          nextRow._dbId = saved.id;
          nextRow._source = 'db';
          nextRow.scope = saved.scope || scope;
          nextRow.type = saved.type || type;
          nextRow.rule = saved.rule || rule;
          nextRow.notes = saved.notes || notes;
          nextRow.date = saved.due_date || date || '';
          nextRow.createdAt = saved.created_at || nextRow.createdAt;
          nextRow.updatedAt = saved.updated_at || saved.created_at || nextRow.updatedAt;
          nextRow._dbCompanyKey = saved.company_key || '';
          nextRow._dbCommunityId = saved.community_id || '';
          clearLegacySupervisorCommCache();
          setSupervisorSaveStatus(saved.scope === 'Company-wide'
            ? 'Saved company-wide communication to Supabase successfully.'
            : 'Saved to Supabase successfully.', '#1b6b3d');
          resetSupervisorCommForm();
          await loadSupervisorCommsModule();
          try{ window.dispatchEvent(new Event('storage')); }catch(_e){}
          try{ document.dispatchEvent(new CustomEvent('community:changed')); }catch(_e){}
        }catch(err){
          console.error('saveSupervisorCommBtn fatal', err);
          setSupervisorSaveStatus('Save failed due to an unexpected error.', '#8f2f2f');
          await zummeePopupAlert('Save failed due to an unexpected error.', { title:'Save failed', okText:'OK', danger:true });
        }
      });
    }

function accessCodesStorageKey(){
      return `dailyOpsV2:accessCodes:${Store.activeCommunityId || ('name:' + (Store.activeCommunityName || 'unknown').toLowerCase())}`;
    }
    function readAccessCodeRows(){
      try{
        const arr = safeJson(localStorage.getItem(accessCodesStorageKey()) || '[]', []);
        return Array.isArray(arr) ? arr : [];
      }catch(_e){ return []; }
    }
    function writeAccessCodeRows(rows){
      try{ localStorage.setItem(accessCodesStorageKey(), JSON.stringify(rows || [])); }catch(_e){}
    }
    function resetAccessCodeForm(){
      Store.editingAccessCodeId = '';
      byId('accessCodeNameInput').value = '';
      byId('accessCodeValueInput').value = '';
      byId('accessCodeNotesInput').value = '';
      byId('saveAccessCodeBtn').textContent = 'Save access code';
    }
    async function copyAccessCodeValue(code){
      const value = String(code || '').trim();
      if(!value) return;
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(value);
          return;
        }
      }catch(_e){}
      try{
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly','readonly');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }catch(_e){}
    }
    function renderAccessCodes(rows){
      const mount = byId('accessCodesMount');
      rows = Array.isArray(rows) ? rows : [];
      setMetric('accessCodesMetric', rows.length);
      byId('accessCodesCountPill').textContent = String(rows.length);
      if(!rows.length){ mountEmpty(mount, 'No access codes for this community yet.'); return; }
      mount.className = 'recordList';
      mount.innerHTML = rows.map(row => `
        <article class="record" style="padding:16px 18px;">
          <div style="display:grid; grid-template-columns:minmax(110px, 160px) auto minmax(0,1fr) auto; align-items:center; gap:12px;">
            <div class="recordTitle" style="font-size:17px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(row.name || 'Access Code')}</div>
            <button class="metaPill access-copy" type="button" data-code="${escapeHtml(row.code || '')}" style="cursor:pointer; white-space:nowrap; justify-self:start;">${escapeHtml(row.code || '—')}</button>
            <div style="color:#5b7088; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0;">${escapeHtml(row.notes || '')}</div>
            <div class="contactActions" style="margin-top:0; margin-left:auto; display:flex; gap:8px; flex-wrap:nowrap; justify-self:end;">
              <button class="btn ghost access-load" type="button" data-id="${escapeHtml(row.id)}">Edit</button>
              <button class="btn ghost access-text" type="button" data-id="${escapeHtml(row.id)}">Text</button>
              <button class="btn secondary access-delete" type="button" data-id="${escapeHtml(row.id)}">Delete</button>
            </div>
          </div>
        </article>
      `).join('');
      mount.querySelectorAll('.access-copy').forEach(btn => btn.addEventListener('click', async () => {
        await copyAccessCodeValue(btn.dataset.code || '');
      }));
      mount.querySelectorAll('.access-load').forEach(btn => btn.addEventListener('click', () => {
        const row = rows.find(r => r.id === btn.dataset.id);
        if(!row) return;
        Store.editingAccessCodeId = row.id;
        byId('accessCodeNameInput').value = row.name || '';
        byId('accessCodeValueInput').value = row.code || '';
        byId('accessCodeNotesInput').value = row.notes || '';
        byId('saveAccessCodeBtn').textContent = 'Update access code';
      }));
      mount.querySelectorAll('.access-text').forEach(btn => btn.addEventListener('click', () => {
        const row = rows.find(r => r.id === btn.dataset.id);
        if(!row) return;
        openAccessCodeText(row);
      }));
      mount.querySelectorAll('.access-delete').forEach(btn => btn.addEventListener('click', () => {
        const next = rows.filter(r => r.id !== btn.dataset.id);
        writeAccessCodeRows(next);
        if(Store.editingAccessCodeId === btn.dataset.id) resetAccessCodeForm();
        loadAccessCodesModule();
      }));
    }
    function loadAccessCodesModule(){
      const mount = byId('accessCodesMount');
      if(!Store.activeCommunityId && !Store.activeCommunityName){ mountEmpty(mount, 'Choose a community to load access codes.'); setMetric('accessCodesMetric', 0); byId('accessCodesCountPill').textContent = '0'; return; }
      renderAccessCodes(readAccessCodeRows());
    }
    function attachAccessCodesModule(){
      byId('saveAccessCodeBtn').addEventListener('click', () => {
        const name = String(byId('accessCodeNameInput').value || '').trim();
        const code = String(byId('accessCodeValueInput').value || '').trim();
        const notes = String(byId('accessCodeNotesInput').value || '').trim();
        if(!name){ alert('Enter a label for this access code first.'); return; }
        if(!code){ alert('Enter the access code first.'); return; }
        const rows = readAccessCodeRows();
        const id = Store.editingAccessCodeId || ('access_' + Date.now());
        const existing = rows.find(r => r.id === id) || null;
        const nextRow = { id, name, code, notes, createdAt: existing && existing.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), communityName: Store.activeCommunityName || '' };
        const next = Store.editingAccessCodeId ? rows.map(r => r.id === id ? nextRow : r) : [nextRow, ...rows];
        writeAccessCodeRows(next);
        resetAccessCodeForm();
        loadAccessCodesModule();
      });
    }

    async function loadModules(){
      await ensureUser();
      await Promise.all([loadBoardMembersModule()]);
      loadSupervisorCommsModule();
      loadRemindersModule();
      loadQuickNotesModule();
      loadVendorsModule();
      loadImportantDatesModule();
      loadAccessCodesModule();
    }


    function parseDailyOpsLogoRef(raw){
      raw = String(raw || '').trim();
      if(!raw) return null;
      if(/^https?:\/\//i.test(raw)) return { url: raw };
      return { bucket:'company_logos', path: raw };
    }
    function setDailyOpsCompanyLogo(url, alt){
      const logo = byId('dailyOpsCompanyLogo');
      if(!logo) return;
      const finalUrl = String(url || '').trim();
      logo.hidden = true;
      logo.removeAttribute('src');
      if(!finalUrl) return;
      logo.onload = () => { logo.hidden = false; };
      logo.onerror = () => { logo.hidden = true; logo.removeAttribute('src'); };
      logo.alt = String(alt || '').trim() || 'Management company logo';
      logo.src = finalUrl;
    }
    async function loadDailyOpsCompanyLogo(){
      const logo = byId('dailyOpsCompanyLogo');
      if(!logo || !sb) return;
      try{
        await ensureUser();
        const companyId = String(Store.companyId || readCurrentCompanyId() || '').trim();
        if(!companyId) throw new Error('No company id');
        const res = await sb.from('companies').select('logo_path,name').eq('id', companyId).maybeSingle();
        if(res && res.error) throw res.error;
        const row = (res && res.data) || {};
        const ref = parseDailyOpsLogoRef(row.logo_path);
        if(!ref) throw new Error('No company logo');
        let url = String(ref.url || '').trim();
        if(!url && ref.bucket && ref.path && sb.storage && sb.storage.from){
          const pub = sb.storage.from(ref.bucket).getPublicUrl(ref.path);
          url = String(pub && pub.data && pub.data.publicUrl || '').trim();
        }
        if(!url) throw new Error('No logo url');
        setDailyOpsCompanyLogo(url, String(row.name || 'Management company logo'));
      }catch(_err){
        setDailyOpsCompanyLogo('', 'Management company logo');
      }
    }

    async function init(){
      await restoreSupabaseSessionFromStorage();
      await ensureUser();
      loadDailyOpsCompanyLogo();
      Store.communities = readCommunityCandidates();
      if(!Store.communities.length) Store.communities = await fetchCommunitiesFromSupabase();
      renderCommunityOptions();
      attachCommunitySelect();
      await applySupervisorCommsRoleLock();
      attachSupervisorCommsModule();
      attachRemindersModule();
      attachQuickNotesModule();
      attachVendorsModule();
      attachImportantDatesModule();
      attachAccessCodesModule();
      await loadModules();
    }
    init();
  