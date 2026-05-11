(function(){
  'use strict';
  if(window.__BoardHubAnnualOpenWorkflowsRemindersV707) return;
  window.__BoardHubAnnualOpenWorkflowsRemindersV707 = true;

  const BUILD = '2026-05-11-v707-board-hub-open-annual-workflows-reminders';
  const ACTIVE_STEPS = new Set([
    'pending_board','board_review','pending_supervisor','board_approved',
    'pending_admin_mailing','ready_to_mail','supervisor_approved','pending_admin',
    'admin_mailing','sent_to_board','sent_to_supervisor','in_progress','active'
  ]);
  const CLOSED_STEPS = new Set([
    'completed','complete','closed','archived','mailed','mailing_complete',
    'cancelled','canceled','deleted','void','inactive','rejected_final'
  ]);
  const state = { loading:false, rows:[], workflows:[], loadedAt:null, error:null, community:null };

  function byId(id){ return document.getElementById(id); }
  function clean(v){ return String(v == null ? '' : v).trim(); }
  function esc(v){ return clean(v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
  function isUuid(v){ return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean(v)); }
  function lower(v){ return clean(v).toLowerCase().replace(/[\s-]+/g,'_'); }
  function setText(id,val){ const n=byId(id); if(n) n.textContent=String(val); }
  function setStatus(msg,type){ const n=byId('annualApprovalRequestsStatus'); if(!n) return; n.textContent=msg||''; n.classList.toggle('ok',type==='ok'); n.classList.toggle('err',type==='err'); }
  function parseJson(v){ if(!v) return {}; if(typeof v === 'object') return v; try{return JSON.parse(v);}catch(_e){return{};} }
  function dateOnly(value){ const raw=clean(value); if(!raw) return 'Not set'; const d=new Date(raw); if(Number.isNaN(d.getTime())) return raw.slice(0,10); return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
  function ts(row){ const d=new Date(row.updated_at || row.created_at || row.initiated_at || 0); return Number.isNaN(d.getTime()) ? 0 : d.getTime(); }

  function activeCommunity(){
    try{
      if(window.ZummeeCommunityState && typeof window.ZummeeCommunityState.getActiveCommunity === 'function'){
        const c=window.ZummeeCommunityState.getActiveCommunity();
        if(c && isUuid(c.id)) return { id:clean(c.id), name:clean(c.name), source:'ZummeeCommunityState' };
      }
    }catch(_e){}
    const sel=byId('communitySelect');
    if(sel && isUuid(sel.value)){
      const opt=sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
      return { id:clean(sel.value), name:clean(opt && opt.textContent), source:'communitySelect' };
    }
    try{ if(isUuid(window.selectedCommunityId)) return { id:clean(window.selectedCommunityId), name:clean(window.selectedCommunityName), source:'window.selectedCommunityId' }; }catch(_e2){}
    return { id:'', name:'', source:'none' };
  }

  async function getClient(){
    const started=Date.now();
    while(Date.now()-started < 5000){
      try{
        const c=window.supabaseClient || (window.getSupabase && window.getSupabase()) || window.sb || null;
        if(c && typeof c.from === 'function') return c;
      }catch(_e){}
      await new Promise(r=>setTimeout(r,80));
    }
    throw new Error('Supabase client unavailable.');
  }

  function step(row){ return lower(row.current_step || row.approval_status || row.status || row.workflow_status); }
  function isOpen(row){
    if(!row) return false;
    if(row.archived_at || row.completed_at || row.deleted_at || row.closed_at || row.mailed_at) return false;
    const st=step(row);
    if(CLOSED_STEPS.has(st)) return false;
    if(ACTIVE_STEPS.has(st)) return true;
    // Treat rows with a workflow ID and no closed marker as open, but ignore totally blank orphan rows.
    return !!workflowId(row) && !st;
  }
  function workflowId(row){
    return clean(row.annual_meeting_settings_id || row.packet_id || row.request_id || row.annual_meeting_id || row.workflow_id || row.approval_workflow_id || '');
  }
  function fallbackWorkflowId(row){ return workflowId(row) || clean(row.id); }
  function stageRank(st){
    st=lower(st);
    if(st === 'pending_admin_mailing' || st === 'ready_to_mail' || st === 'supervisor_approved' || st === 'pending_admin' || st === 'admin_mailing') return 3;
    if(st === 'pending_supervisor' || st === 'board_approved' || st === 'sent_to_supervisor') return 2;
    if(st === 'pending_board' || st === 'board_review' || st === 'sent_to_board') return 1;
    if(st.indexOf('reject') >= 0) return 1;
    return 0;
  }
  function stepInfoFromRows(rows){
    const counts={board:0,supervisor:0,admin:0,other:0};
    rows.forEach(r=>{
      const st=step(r); const rank=stageRank(st);
      if(rank===1) counts.board++; else if(rank===2) counts.supervisor++; else if(rank===3) counts.admin++; else counts.other++;
    });
    let current='board', cls='is-board', label='Board Review', line='Waiting for Board approval.';
    if(counts.admin){ current='admin'; cls='is-admin'; label='Admin / Mailing'; line='Board and Supervisor steps are active/complete. Waiting for mailing completion.'; }
    else if(counts.supervisor){ current='supervisor'; cls='is-supervisor'; label='Supervisor Review'; line='Board approval is complete. Waiting for Supervisor approval.'; }
    else if(counts.board){ current='board'; cls='is-board'; label='Board Review'; line='Waiting for Board approval.'; }
    else { current='board'; cls='is-supervisor'; label='In Progress'; line='Annual meeting approval is still open.'; }
    return { current, cls, label, line, counts };
  }
  function choosePrimary(rows){
    return rows.slice().sort((a,b)=>{
      const rankDiff=stageRank(step(b))-stageRank(step(a));
      if(rankDiff) return rankDiff;
      return ts(b)-ts(a);
    })[0] || rows[0] || {};
  }
  function groupWorkflows(rows){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).filter(isOpen).forEach(row=>{
      const key=fallbackWorkflowId(row);
      if(!key) return;
      if(!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return Array.from(map.entries()).map(([key,rows])=>{
      const primary=choosePrimary(rows);
      const info=stepInfoFromRows(rows);
      const pendingBoard=rows.find(r=>stageRank(step(r))===1) || null;
      return { key, rows, primary, info, pendingBoard };
    }).sort((a,b)=>ts(b.primary)-ts(a.primary));
  }

  function stepPills(info){
    function pill(id,label){
      let cls='annualRequestStep';
      if(info.current===id) cls+=' current';
      if((info.current==='supervisor' && id==='board') || (info.current==='admin' && (id==='board'||id==='supervisor'))) cls+=' done';
      return '<span class="'+cls+'">'+esc(label)+'</span>';
    }
    return '<div class="annualRequestWorkflow">'+pill('board','Board Review')+pill('supervisor','Supervisor')+pill('admin','Admin / Mailing')+'</div>';
  }
  function workflowCountsLine(w){
    const c=w.info.counts; const bits=[];
    if(c.board) bits.push(c.board+' Board step'+(c.board===1?'':'s'));
    if(c.supervisor) bits.push(c.supervisor+' Supervisor step'+(c.supervisor===1?'':'s'));
    if(c.admin) bits.push(c.admin+' Admin/mailing step'+(c.admin===1?'':'s'));
    if(c.other) bits.push(c.other+' other active step'+(c.other===1?'':'s'));
    return bits.join(' · ');
  }
  function card(w,idx){
    const row=w.primary || {};
    const id=esc(w.key);
    const packetId=esc(row.id || w.key);
    const title=esc(row.association_legal_name || row.association_name || 'Annual Meeting Packet');
    const route=esc(row.approval_route_label || row.approval_route || 'Approval route');
    const meetingDate=esc(dateOnly(row.next_annual_meeting_date));
    const initiated=row.initiated_at || row.created_at ? ('Initiated '+dateOnly(row.initiated_at || row.created_at)) : 'Initiated date unavailable';
    const hasBoard=!!w.pendingBoard;
    const primaryReminder=w.info.current==='supervisor' ? 'supervisor' : 'board';
    return ''+
      '<article class="annualRequestCard '+w.info.cls+'" data-annual-workflow-key="'+id+'" data-annual-approval-id="'+packetId+'">'+
        '<div>'+
          '<h3 class="annualRequestTitle">'+title+'</h3>'+
          '<p class="annualRequestMeta">Route: '+route+' · Meeting date: '+meetingDate+' · '+esc(initiated)+'</p>'+
          '<div class="annualRequestStatusLine">'+esc(w.info.label)+': '+esc(w.info.line)+'</div>'+
          '<p class="annualRequestMeta">'+esc(workflowCountsLine(w) || 'Open approval workflow')+'</p>'+
          stepPills(w.info)+
        '</div>'+
        '<div class="annualRequestActions">'+
          '<button type="button" class="preview" data-annual-v707-action="preview" data-key="'+id+'">Preview Packet</button>'+
          '<button type="button" class="reminder '+(primaryReminder==='board'?'primaryReminder':'')+'" data-annual-v707-action="remind-board" data-key="'+id+'">Email Board Reminder</button>'+
          '<button type="button" class="reminder '+(primaryReminder==='supervisor'?'primaryReminder':'')+'" data-annual-v707-action="remind-supervisor" data-key="'+id+'">Email Supervisors Reminder</button>'+
          (hasBoard ? '<button type="button" class="reject" data-annual-v707-action="toggle-reject" data-key="'+id+'">Reject</button><button type="button" class="approve" data-annual-v707-action="approve" data-key="'+id+'">Approve Packet</button>' : '')+
        '</div>'+
        (hasBoard ? '<div class="annualRequestRejectBox" id="annualRejectBoxV707_'+id+'"><textarea id="annualRejectNoteV707_'+id+'" placeholder="Add the reason this packet needs changes before approval."></textarea><div class="annualRequestActions" style="margin-top:10px;justify-content:flex-start"><button type="button" class="reject" data-annual-v707-action="confirm-reject" data-key="'+id+'">Submit Rejection</button></div></div>' : '')+
      '</article>';
  }

  function render(workflows){
    const list=byId('annualApprovalRequestsList');
    const sub=document.querySelector('#annualApprovalRequestsSection .sub');
    if(sub) sub.textContent='Open annual meeting packet workflows stay visible until completed, mailed, or archived.';
    setText('annualApprovalRequestsCount', workflows.length);
    if(!list) return;
    if(!workflows.length){
      list.innerHTML='<div class="empty">No active annual meeting packet approval workflows for this community.</div>';
      setStatus('', '');
      return;
    }
    list.innerHTML=workflows.map(card).join('');
    const totals=workflows.reduce((acc,w)=>{ acc.board+=w.info.counts.board?1:0; acc.supervisor+=w.info.counts.supervisor?1:0; acc.admin+=w.info.counts.admin?1:0; return acc; }, {board:0,supervisor:0,admin:0});
    const bits=[];
    if(totals.board) bits.push(totals.board+' workflow'+(totals.board===1?'':'s')+' needing Board review');
    if(totals.supervisor) bits.push(totals.supervisor+' needing Supervisor review');
    if(totals.admin) bits.push(totals.admin+' in Admin / mailing');
    setStatus(bits.join(' · ') || (workflows.length+' open workflow'+(workflows.length===1?'':'s')+'.'), 'ok');
  }

  async function load(){
    if(state.loading) return state;
    state.loading=true; state.error=null; state.community=activeCommunity();
    try{
      const list=byId('annualApprovalRequestsList');
      if(list && !state.workflows.length) list.innerHTML='<div class="empty">Loading annual meeting approval workflows…</div>';
      if(!state.community.id) throw new Error('No selected community.');
      const sb=await getClient();
      const res=await sb.from('annual_meeting_approval_requests')
        .select('*')
        .eq('community_id', state.community.id)
        .is('archived_at', null)
        .order('updated_at', { ascending:false })
        .limit(200);
      if(res.error) throw res.error;
      state.rows=Array.isArray(res.data)?res.data:[];
      state.workflows=groupWorkflows(state.rows);
      state.loadedAt=new Date().toISOString();
      render(state.workflows);
    }catch(err){
      state.error=err && err.message ? err.message : String(err);
      const list=byId('annualApprovalRequestsList');
      if(list) list.innerHTML='<div class="empty">Annual meeting approval workflows could not load. '+esc(state.error)+'</div>';
      setText('annualApprovalRequestsCount', 0);
      setStatus(state.error, 'err');
    }finally{
      state.loading=false;
      window.__BoardHubAnnualOpenWorkflowsV707Status = snapshot();
    }
    return state;
  }
  function snapshot(){ return { build:BUILD, ok:!state.error, community:state.community, rows:state.rows, workflows:state.workflows, workflowCount:state.workflows.length, loadedAt:state.loadedAt, error:state.error }; }
  function workflowByKey(key){ return state.workflows.find(w=>clean(w.key)===clean(key)) || null; }
  function setBusy(key,busy){ const card=document.querySelector('[data-annual-workflow-key="'+CSS.escape(key)+'"]'); if(card) card.querySelectorAll('button,textarea').forEach(el=>el.disabled=!!busy); }
  async function currentUserId(client){
    try{ const res=await client.auth.getSession(); return clean(res && res.data && res.data.session && res.data.session.user && res.data.session.user.id); }catch(_e){}
    try{ return clean(localStorage.getItem('zummee_user_id_v1') || sessionStorage.getItem('zummee_user_id_v1')); }catch(_e2){ return ''; }
  }
  function nextAfterBoard(row){
    const route=lower(row && row.approval_route);
    if(route==='board_then_supervisor') return { approval_status:'pending_supervisor', current_step:'pending_supervisor' };
    if(route==='board_only' || route==='supervisor_then_board') return { approval_status:'pending_admin_mailing', current_step:'pending_admin_mailing', admin_ready_at:new Date().toISOString() };
    return { approval_status:'board_approved', current_step:'board_approved' };
  }
  async function approveWorkflow(key){
    const w=workflowByKey(key); if(!w || !w.pendingBoard) return;
    setBusy(key,true); setStatus('Approving packet…','');
    try{
      const sb=await getClient(); const user=await currentUserId(sb); const id=w.pendingBoard.id;
      const patch=Object.assign({}, nextAfterBoard(w.pendingBoard), { board_approved_at:new Date().toISOString(), board_approved_by:user || null, board_response_note:null, updated_at:new Date().toISOString() });
      const res=await sb.from('annual_meeting_approval_requests').update(patch).eq('id', id).select('*').maybeSingle();
      if(res.error) throw res.error;
      setStatus('Packet approved and kept visible in the open workflow list.', 'ok');
      await load();
    }catch(err){ setStatus(err && err.message ? err.message : String(err), 'err'); }
    finally{ setBusy(key,false); }
  }
  async function rejectWorkflow(key){
    const w=workflowByKey(key); if(!w || !w.pendingBoard) return;
    const noteEl=byId('annualRejectNoteV707_'+key); const note=clean(noteEl && noteEl.value);
    if(!note){ alert('Add a rejection note before submitting.'); return; }
    setBusy(key,true); setStatus('Submitting rejection…','');
    try{
      const sb=await getClient(); const user=await currentUserId(sb);
      const res=await sb.from('annual_meeting_approval_requests').update({ approval_status:'board_rejected', current_step:'board_rejected', board_rejected_at:new Date().toISOString(), board_rejected_by:user || null, board_response_note:note, updated_at:new Date().toISOString() }).eq('id', w.pendingBoard.id).select('*').maybeSingle();
      if(res.error) throw res.error;
      setStatus('Packet rejected and returned for changes.', 'ok');
      await load();
    }catch(err){ setStatus(err && err.message ? err.message : String(err), 'err'); }
    finally{ setBusy(key,false); }
  }

  function flattenEmails(value){
    const out=[];
    function add(v){
      clean(v).split(/[;,\s]+/).forEach(x=>{ x=clean(x); if(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x) && !out.includes(x)) out.push(x); });
    }
    if(Array.isArray(value)) value.forEach(v=> typeof v==='string' ? add(v) : add(v && (v.email || v.email_address || v.board_email || v.supervisor_email)));
    else if(value && typeof value==='object') add(value.email || value.email_address || value.board_email || value.supervisor_email);
    else add(value);
    return out;
  }
  function emailsFromSnapshot(row,target){
    const snap=parseJson(row.packet_preview_snapshot || row.metadata || {}); const emails=[];
    const paths = target==='board' ? [snap.boardEmails, snap.board_emails, snap.boardMembers, snap.board_members, snap.recipients && snap.recipients.board] : [snap.supervisorEmail, snap.supervisor_email, snap.supervisorReturnEmail, snap.returnEmail, snap.return_email, snap.recipients && snap.recipients.supervisors, snap.supervisors];
    paths.forEach(v=>flattenEmails(v).forEach(e=>{ if(!emails.includes(e)) emails.push(e); }));
    return emails;
  }
  async function queryRecipientEmails(target){
    const emails=[]; const sb=await getClient(); const communityId=state.community && state.community.id;
    async function tryTable(table, select, filter){
      try{
        let q=sb.from(table).select(select).limit(100);
        if(communityId) q=q.eq('community_id', communityId);
        if(filter) q=filter(q);
        const res=await q;
        if(!res.error && Array.isArray(res.data)) res.data.forEach(r=>flattenEmails(r.email || r.email_address || r.contact_email || r.board_email || r.supervisor_email).forEach(e=>{ if(!emails.includes(e)) emails.push(e); }));
      }catch(_e){}
    }
    if(target==='board'){
      await tryTable('board_members','email,email_address,contact_email,community_id');
      await tryTable('community_board_members','email,email_address,contact_email,community_id');
    }else{
      await tryTable('supervisors','email,email_address,contact_email,community_id');
      await tryTable('community_assignments','email,email_address,contact_email,role,community_id', q=>q.in('role',['supervisor','admin','administrator']));
    }
    return emails;
  }
  function buildMailto(w,target,emails){
    const row=w.primary || {}; const community=(state.community && state.community.name) || clean(row.community_name) || 'the community';
    const association=clean(row.association_legal_name || 'Annual Meeting Packet');
    const stepLabel=target==='board' ? 'Board approval' : 'Supervisor approval';
    const subject='Reminder: '+association+' needs '+stepLabel;
    const body=[
      'Hello,', '',
      'This is a reminder that the annual meeting packet for '+association+' needs '+stepLabel.toLowerCase()+'.', '',
      'Community: '+community,
      'Meeting date: '+dateOnly(row.next_annual_meeting_date),
      'Current status: '+w.info.label, '',
      'Please review and complete the approval when you have a chance.', '',
      'Thank you.'
    ].join('\n');
    return 'mailto:'+encodeURIComponent((emails||[]).join(','))+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
  }
  async function logReminder(w,target,emails){
    try{
      const sb=await getClient(); const user=await currentUserId(sb);
      await sb.from('notification_events').insert({ community_id: state.community && state.community.id, event_type:'annual_approval_reminder_sent', metadata:{ target, emails, workflow_key:w.key, request_ids:w.rows.map(r=>r.id), sent_by:user || null, sent_at:new Date().toISOString() } });
    }catch(_e){}
  }
  async function sendReminder(key,target){
    const w=workflowByKey(key); if(!w) return;
    setBusy(key,true); setStatus('Preparing reminder email…','');
    try{
      let emails=[];
      w.rows.forEach(r=> emailsFromSnapshot(r,target).forEach(e=>{ if(!emails.includes(e)) emails.push(e); }));
      if(!emails.length) emails=await queryRecipientEmails(target);
      await logReminder(w,target,emails);
      window.location.href=buildMailto(w,target,emails);
      setStatus((target==='board'?'Board':'Supervisor')+' reminder email draft opened'+(emails.length ? ' for '+emails.length+' recipient'+(emails.length===1?'':'s')+'.' : '. Add recipients if the draft is blank.'), 'ok');
    }catch(err){ setStatus(err && err.message ? err.message : String(err), 'err'); }
    finally{ setBusy(key,false); }
  }

  function openPreview(key){
    const w=workflowByKey(key); if(!w) return alert('Packet preview is not available yet. Refresh and try again.');
    const row=w.primary || w.rows[0] || {};
    if(typeof window.previewBoardHubAnnualMeetingPacket === 'function'){
      try{ window.__BoardHubAnnualOpenWorkflowsV707Status = snapshot(); window.previewBoardHubAnnualMeetingPacket(row.id); return; }catch(_e){}
    }
    alert('Preview is not available for this packet yet.');
  }

  document.addEventListener('click', function(event){
    const btn=event.target && event.target.closest ? event.target.closest('[data-annual-v707-action][data-key]') : null;
    if(!btn) return;
    event.preventDefault(); event.stopPropagation();
    const action=btn.getAttribute('data-annual-v707-action'); const key=btn.getAttribute('data-key');
    if(action==='preview') return openPreview(key);
    if(action==='remind-board') return sendReminder(key,'board');
    if(action==='remind-supervisor') return sendReminder(key,'supervisor');
    if(action==='approve') return approveWorkflow(key);
    if(action==='toggle-reject'){ const box=byId('annualRejectBoxV707_'+key); if(box) box.classList.toggle('open'); return; }
    if(action==='confirm-reject') return rejectWorkflow(key);
  }, true);

  function boot(){
    window.refreshBoardHubAnnualApprovalRequests = load;
    window.getBoardHubAnnualApprovalRequestsStatus = function(){ return snapshot(); };
    window.getBoardHubAnnualOpenWorkflowsStatus = function(){ return snapshot(); };
    setTimeout(load, 80);
    setTimeout(load, 1450); // win after older scheduled loaders, if cached HTML still has them
    const sel=byId('communitySelect');
    if(sel && !sel.__annualV707Bound){ sel.__annualV707Bound=true; sel.addEventListener('change', function(){ setTimeout(load,220); }); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
  window.addEventListener('pageshow', function(){ setTimeout(load,220); });
  window.addEventListener('zummee:community-changed', function(){ setTimeout(load,260); });
})();
