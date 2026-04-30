
(function(){
  'use strict';
  const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const $=(id)=>document.getElementById(id);
  let sb=null, userId='', selectedCommunityId='', selectedCommunityName='', communities=[], submittedRows=[], activeModalItem=null;
  function isUuid(v){ return UUID_RE.test(String(v||'').trim()); }
  function qp(name){ return String(new URLSearchParams(location.search).get(name)||'').trim(); }
  function esc(str=''){ return String(str||'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function getStore(keys){ for(const k of keys){ try{ const v=String(localStorage.getItem(k)||sessionStorage.getItem(k)||'').trim(); if(v) return v; }catch(e){} } return ''; }
  function readAssignedCommunitiesStore(){
    const out=[]; const seen=new Set(); const sources=[];
    try{ if(window.__zummeeAssignedCommunities) sources.push(window.__zummeeAssignedCommunities); }catch(e){}
    try{ sources.push(JSON.parse(sessionStorage.getItem('zummee_assigned_communities_v1')||'[]')); }catch(e){}
    try{ sources.push(JSON.parse(localStorage.getItem('zummee_assigned_communities_v1')||'[]')); }catch(e){}
    try{ sources.push(JSON.parse(sessionStorage.getItem('zummee_assigned_communities')||'[]')); }catch(e){}
    try{ sources.push(JSON.parse(localStorage.getItem('zummee_assigned_communities')||'[]')); }catch(e){}
    sources.forEach(arr=>{ (Array.isArray(arr)?arr:[]).forEach(r=>{ const id=String(r.id||r.community_id||'').trim(); const name=String(r.name||r.community_name||r.community||'').trim(); if(isUuid(id)&&!seen.has(id)){ seen.add(id); out.push({id,name:name||id}); } }); });
    return out;
  }
  function writeAssignedCommunitiesStore(list){ try{ const clean=(Array.isArray(list)?list:[]).filter(c=>isUuid(c.id)); localStorage.setItem('zummee_assigned_communities_v1',JSON.stringify(clean)); sessionStorage.setItem('zummee_assigned_communities_v1',JSON.stringify(clean)); }catch(e){} }
  function putStore(key,val){ try{ if(val) { localStorage.setItem(key,val); sessionStorage.setItem(key,val); } }catch(e){} }
  function setText(id,val){ const el=$(id); if(el) el.textContent=String(val); }
  function setStatus(msg,type){ const el=$('statusLine'); if(!el) return; el.textContent=msg||''; el.classList.toggle('ok',type==='ok'); el.classList.toggle('err',type==='err'); }
  function activeStatus(row){ const s=String(row&&row.status||'').toLowerCase().trim().replace(/[\s-]+/g,'_'); return !(/complete|completed|closed|deleted|archived|converted|cancel|reviewed|agenda/.test(s)); }
  function directContext(){
    // v403: URL is the page-to-page source of truth. Local storage may identify user,
    // but it must not override the community passed in the route.
    const cid=qp('community_id')||qp('cid');
    const uid=qp('user_id')||qp('uid')||getStore(['zummee_user_id_v1','zummeeUserId','activeUserId','currentUserId']);
    const name=decodeURIComponent(qp('community_name')||qp('name')||'');
    return {cid:isUuid(cid)?cid:'', uid:isUuid(uid)?uid:'', name};
  }
  function rememberContext(){
    if(isUuid(userId)){ ['zummee_user_id_v1','zummeeUserId','activeUserId','currentUserId'].forEach(k=>putStore(k,userId)); }
    if(isUuid(selectedCommunityId)){
      if(window.ZummeeDataLayer && typeof window.ZummeeDataLayer.syncCommunityContext==='function') window.ZummeeDataLayer.syncCommunityContext(selectedCommunityId, selectedCommunityName, 'replace');
      else {
        ['zummeeActiveCommunityId','activeCommunityId','currentCommunityId','zummee_selected_community_id','zummee_community_id'].forEach(k=>putStore(k,selectedCommunityId));
        if(selectedCommunityName){ ['zummeeCurrentCommunityName','currentCommunityName','activeCommunityName','zummee_community'].forEach(k=>putStore(k,selectedCommunityName)); }
      }
    }
  }
  function updateBackLink(){
    let href='/manager_hub.html'; const parts=[];
    if(isUuid(selectedCommunityId)) parts.push('community_id='+encodeURIComponent(selectedCommunityId));
    if(selectedCommunityName) parts.push('community_name='+encodeURIComponent(selectedCommunityName));
    if(isUuid(userId)) parts.push('user_id='+encodeURIComponent(userId));
    if(parts.length) href+='?'+parts.join('&');
    const a=$('backToHub'); if(a) a.href=href;
  }
  async function waitForClient(){
    const start=Date.now();
    while(Date.now()-start<6000){
      let c=window.supabaseClient || (window.getSupabase&&window.getSupabase()) || null;
      if(!c && window.ensureSupabaseSync) c=window.ensureSupabaseSync();
      if(c&&typeof c.rpc==='function'&&typeof c.from==='function') return c;
      await new Promise(r=>setTimeout(r,80));
    }
    throw new Error('Supabase client unavailable');
  }
  async function trySessionUser(){
    try{ if(window.zummeeRestoreSupabaseSession) await window.zummeeRestoreSupabaseSession(); }catch(e){}
    try{ const res=await sb.auth.getSession(); const id=res&&res.data&&res.data.session&&res.data.session.user&&res.data.session.user.id; return isUuid(id)?id:''; }catch(e){ return ''; }
  }
  async function loadCommunities(){
    const rows=[];
    const add=(arr)=>{ (arr||[]).forEach(r=>{ const id=String(r.community_id||r.id||'').trim(); const name=String(r.name||r.community_name||r.community||'').trim(); if(isUuid(id)&&!rows.some(x=>x.id===id)) rows.push({id,name:name||id}); }); };

    // v402b: primary source of truth is the shared strict assignment loader.
    // It reads community_assignments by employee id/email, matching Manager Hub's strict source.
    if(window.ZummeeDataLayer && typeof window.ZummeeDataLayer.getAssignedCommunities==='function'){
      try{
        const shared=await window.ZummeeDataLayer.getAssignedCommunities({userId:userId});
        add(shared);
      }catch(e){ console.warn('[BoardHub V2 v408] shared assigned-community loader failed; falling back safely', e); }
    }

    // Fallback only if the shared layer returns nothing. Keep page usable, but do not mix in all company communities.
    if(!rows.length){
      add(readAssignedCommunitiesStore());
      if(isUuid(userId)){
        try{ const r=await sb.rpc('get_user_communities_with_names',{p_user_id:userId}); if(!r.error) add(r.data); else console.warn('[BoardHub V2] get_user_communities_with_names failed',r.error); }catch(e){ console.warn('[BoardHub V2] communities RPC failed',e); }
        if(!rows.length){ try{ const r2=await sb.rpc('get_user_communities',{p_user_id:userId}); if(!r2.error) add(r2.data); }catch(e){} }
      }
    }

    // Hydrate names only for ids we already know are assigned. This does not add extra communities.
    if(rows.length){
      const needsNames=rows.some(r=>r.name===r.id);
      if(needsNames){
        const ids=rows.map(r=>r.id);
        try{ const nr=await sb.from('PropertyCommunities').select('*').in('id',ids); if(!nr.error&&Array.isArray(nr.data)){ nr.data.forEach(row=>{ const id=String(row.id||'').trim(); const nm=String(row.name||row.community_name||row.property_name||row.title||'').trim(); const hit=rows.find(x=>x.id===id); if(hit&&nm) hit.name=nm; }); } }catch(e){}
      }
    }

    // Only add route context if no assigned list exists, otherwise never add unassigned communities.
    if(isUuid(selectedCommunityId)&&!rows.some(r=>r.id===selectedCommunityId)&&!rows.length) rows.unshift({id:selectedCommunityId,name:selectedCommunityName||selectedCommunityId});
    if(isUuid(selectedCommunityId)) rows.sort((a,b)=>a.id===selectedCommunityId?-1:b.id===selectedCommunityId?1:String(a.name||'').localeCompare(String(b.name||'')));
    communities=rows;
    writeAssignedCommunitiesStore(communities);
    console.info('[BoardHub V2 v408] assigned dropdown communities=', communities.length, communities);
    renderCommunitySelect();
  }
  function renderCommunitySelect(){
    const sel=$('communitySelect'); if(!sel) return;
    if(!communities.length){ sel.innerHTML='<option value="">Open from Manager Hub</option>'; return; }
    sel.innerHTML=communities.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name||c.id)+'</option>').join('');
    if(isUuid(selectedCommunityId) && communities.some(c=>c.id===selectedCommunityId)) sel.value=selectedCommunityId;
    else { selectedCommunityId=communities[0].id; sel.value=selectedCommunityId; }
    const opt=sel.options[sel.selectedIndex]; if(opt){ selectedCommunityId=sel.value; selectedCommunityName=opt.textContent.trim(); rememberContext(); }
    sel.onchange=function(){
      selectedCommunityId=sel.value;
      const o=sel.options[sel.selectedIndex]; selectedCommunityName=o?o.textContent.trim():'';
      rememberContext(); updateBackLink();
      const url=new URL(location.href); url.searchParams.set('community_id', selectedCommunityId); if(selectedCommunityName) url.searchParams.set('community_name', selectedCommunityName); if(isUuid(userId)) url.searchParams.set('user_id', userId);
      window.location.href=url.toString();
    };
    updateBackLink();
  }
  function fmtDate(v){ try{ if(!v) return ''; return new Date(v).toLocaleString(); }catch(e){ return String(v||''); } }
  function renderBoardItemPhotos(row){
    const grid=$('boardItemPhotoGrid'); if(!grid) return;
    const photos=Array.isArray(row&&row.photos)?row.photos:(row&&row.metadata&&Array.isArray(row.metadata.photos)?row.metadata.photos:[]);
    if(!photos.length){ grid.innerHTML=''; return; }
    grid.innerHTML=photos.map((p,idx)=>{
      const url=esc(p.url||p.publicUrl||'');
      const name=esc(p.name||('Photo '+(idx+1)));
      return url?'<a href="'+url+'" target="_blank" rel="noopener"><img src="'+url+'" alt="'+name+'"></a>':'';
    }).join('');
  }

  function openBoardItem(row){
    activeModalItem=row||null;
    const shade=$('boardItemModalShade'); if(!shade||!activeModalItem) return;
    setText('boardItemModalTitle', activeModalItem.title||'Board Item');
    const meta=[]; if(selectedCommunityName) meta.push(selectedCommunityName); if(activeModalItem.created_at) meta.push('Submitted '+fmtDate(activeModalItem.created_at));
    setText('boardItemModalMeta', meta.join(' • '));
    const body=$('boardItemModalBody'); if(body) body.textContent=activeModalItem.details||activeModalItem.message||'No additional details were provided.';
    renderBoardItemPhotos(activeModalItem);
    const photoInput=$('boardItemPhotoInput'); if(photoInput) photoInput.value='';
    setText('boardItemModalStatus','');
    const woBtn=$('boardItemWorkOrderBtn'); if(woBtn){ const existing=(activeModalItem.work_order_id||(activeModalItem.metadata&&activeModalItem.metadata.work_order_id)||''); woBtn.textContent=existing?'Open Work Order':'Create Work Order'; woBtn.disabled=false; woBtn.removeAttribute('aria-busy'); }
    shade.classList.add('open'); shade.setAttribute('aria-hidden','false');
  }
  function closeBoardItem(){ const shade=$('boardItemModalShade'); if(shade){ shade.classList.remove('open'); shade.setAttribute('aria-hidden','true'); } activeModalItem=null; }
  async function updateBoardNotificationStatus(status, extra){
    if(!activeModalItem) return;
    const notificationId=String(activeModalItem.notification_id||'').trim();
    if(!notificationId){ setText('boardItemModalStatus','This item is missing a notification id.'); return; }
    const current=(activeModalItem.metadata&&typeof activeModalItem.metadata==='object')?activeModalItem.metadata:{};
    const next=Object.assign({}, current, extra||{}, {status:status, workflow_status:status, updated_at:new Date().toISOString(), updated_by:isUuid(userId)?userId:null});
    const r=await sb.from('notification_events').update({metadata:next}).eq('id',notificationId).select('id,metadata').maybeSingle();
    if(r.error){ console.error('[BoardHub V2 v408] board item workflow update failed', r.error); setText('boardItemModalStatus','Could not update this board item.'); return; }
    closeBoardItem();
    await loadBoardData();
  }

  async function createWorkOrderFromActiveBoardItem(btn){
    if(!activeModalItem) return;
    const existing=String(activeModalItem.work_order_id||(activeModalItem.metadata&&activeModalItem.metadata.work_order_id)||'').trim();
    if(existing){ window.location.href='resident_work_orders.html?open_work_order_id='+encodeURIComponent(existing); return; }
    const ok=window.confirm('Create a maintenance work order from this submitted board item?');
    if(!ok) return;
    const original=btn ? btn.textContent : '';
    if(btn){ btn.disabled=true; btn.setAttribute('aria-busy','true'); btn.textContent='Creating…'; }
    setText('boardItemModalStatus','Creating work order…');
    try{
      if(!window.ZummeeDataLayer || typeof window.ZummeeDataLayer.createWorkOrderFromBoardItem!=='function') throw new Error('Shared work-order creator is unavailable.');
      const result=await window.ZummeeDataLayer.createWorkOrderFromBoardItem(activeModalItem,{userId:userId,communityId:selectedCommunityId,communityName:selectedCommunityName});
      if(result.error) throw result.error;
      const workOrderId=result.data&&result.data.work_order_id;
      if(!workOrderId) throw new Error('Work order was created without an id.');
      setText('boardItemModalStatus','Work order created.');
      activeModalItem.work_order_id=workOrderId;
      activeModalItem.status='converted_to_work_order';
      if(btn){ btn.textContent='Open Work Order'; btn.disabled=false; btn.removeAttribute('aria-busy'); }
      await loadBoardData();
      setTimeout(()=>{ closeBoardItem(); }, 450);
    }catch(err){
      console.error('[BoardHub V2 v408] create work order failed', err);
      setText('boardItemModalStatus','Could not create work order: '+(err&&(err.message||err.details||err.hint||err.code)||'Unknown error'));
      if(btn){ btn.disabled=false; btn.removeAttribute('aria-busy'); btn.textContent=original||'Create Work Order'; }
    }
  }
  function renderSubmitted(rows, source){
    const active=(rows||[]).filter(activeStatus);
    const n=active.length;
    setText('submittedCount',n); setText('snapshotSubmitted',n); setText('attentionCount',n);
    const list=$('attentionList');
    if(!list) return;
    if(!active.length){ submittedRows=[]; list.innerHTML='<div class="empty">No submitted board items for this community.</div>'; return; }
    submittedRows=active;
    list.innerHTML=active.map((r,i)=>'<article class="item" role="button" tabindex="0" data-board-item-idx="'+i+'" aria-label="Open board item '+esc(r.title||'Review submitted item')+'"><div class="n">'+(i+1)+'</div><div><h3>'+esc(r.title||'Review submitted item')+'</h3><p>'+esc((r.details||r.status||'Ready for review')).slice(0,180)+'</p>'+((Array.isArray(r.photos)&&r.photos.length)?'<span class="photoBadge">📷 '+r.photos.length+' photo'+(r.photos.length===1?'':'s')+'</span>':'')+'</div><div class="chev">›</div></article>').join('');
  }
  async function loadBoardData(){
    if(!isUuid(selectedCommunityId)){ setStatus('Open Board Hub from Manager Hub so the community context is included.','err'); return; }
    setStatus('Loading board items…');
    let result=null;
    if(window.ZummeeDataLayer && typeof window.ZummeeDataLayer.getBoardItemsForCommunity==='function'){
      try{ result=await window.ZummeeDataLayer.getBoardItemsForCommunity(selectedCommunityId,userId,{openOnly:false}); }
      catch(e){ result={rows:[],error:e,source:'shared-layer.exception'}; }
    }
    if(!result){ result={rows:[],error:new Error('ZummeeDataLayer.getBoardItemsForCommunity is unavailable'),source:'shared-layer.missing'}; }
    if(result.error){
      console.error('[BoardHub V2 v408] shared board items unavailable', result.error);
      setText('submittedCount',0); setText('snapshotSubmitted',0); setText('attentionCount',0);
      const list=$('attentionList'); if(list) list.innerHTML='<div class="empty">Board items could not load from the shared board-items authority.</div>';
      setStatus('Board items unavailable from shared layer.','err');
      return;
    }
    console.info('[BoardHub V2 v408] submitted loaded', (result.rows||[]).filter(activeStatus).length, selectedCommunityId, 'source=', result.source, 'raw=', (result.rows||[]).length, 'user=', userId);
    renderSubmitted(result.rows||[], result.source);
    setStatus('Loaded '+(selectedCommunityName||'selected community'),'ok');
  }
  async function createItem(){
    const title=($('newItemTitle')&&$('newItemTitle').value||'').trim(); if(!title){ alert('Please enter a title.'); return; }
    if(!isUuid(selectedCommunityId)){ alert('Please select a community.'); return; }
    const payload={community_id:selectedCommunityId,title,details:($('newItemDetails')&&$('newItemDetails').value||'').trim(),due_date:($('newItemDue')&&$('newItemDue').value)||null,status:'open',created_by:isUuid(userId)?userId:null};
    try{ let r=null; if(window.ZummeeDataLayer && typeof window.ZummeeDataLayer.createBoardItemForCommunity==='function'){ r=await window.ZummeeDataLayer.createBoardItemForCommunity(selectedCommunityId,payload); }else{ r=await sb.from('notification_events').insert({community_id:selectedCommunityId,event_type:'board_item_submitted',title:title,message:payload.details||'A new board item was submitted and needs review.',source_table:'BoardMemberActionItems',metadata:payload}).select('*').single(); } if(r && r.error) throw r.error; const created=(r&&r.data)||{}; const photoInput=$('newItemPhoto'); const file=photoInput&&photoInput.files&&photoInput.files[0]; const notificationId=created.id||created.notification_id||''; if(file && window.ZummeeDataLayer && typeof window.ZummeeDataLayer.uploadBoardItemPhoto==='function'){ const photoResult=await window.ZummeeDataLayer.uploadBoardItemPhoto({notification_id:notificationId,id:notificationId,community_id:selectedCommunityId,metadata:created.metadata||payload},file,{userId:userId,communityId:selectedCommunityId}); if(photoResult.error) throw photoResult.error; } $('newItemTitle').value=''; $('newItemDetails').value=''; $('newItemDue').value=''; if(photoInput) photoInput.value=''; await loadBoardData(); alert(file?'Board item created with photo.':'Board item created.'); }catch(err){ console.error('[BoardHub V2] create failed',err); alert('Could not create board item/photo. Check notification_events and board-item-photos storage policies.'); }
  }

  async function uploadPhotoToActiveBoardItem(input){
    if(!activeModalItem||!input||!input.files||!input.files[0]) return;
    const file=input.files[0];
    setText('boardItemModalStatus','Uploading photo…');
    try{
      if(!window.ZummeeDataLayer || typeof window.ZummeeDataLayer.uploadBoardItemPhoto!=='function') throw new Error('Shared photo uploader is unavailable.');
      const result=await window.ZummeeDataLayer.uploadBoardItemPhoto(activeModalItem,file,{userId:userId,communityId:selectedCommunityId});
      if(result.error) throw result.error;
      activeModalItem.photos=result.data.photos||[];
      activeModalItem.metadata=Object.assign({},activeModalItem.metadata||{},{photos:activeModalItem.photos});
      renderBoardItemPhotos(activeModalItem);
      setText('boardItemModalStatus','Photo uploaded.');
      input.value='';
      await loadBoardData();
    }catch(err){
      console.error('[BoardHub V2 v408] photo upload failed',err);
      setText('boardItemModalStatus','Could not upload photo: '+(err&&(err.message||err.details||err.hint||err.code)||'Unknown error'));
    }
  }

  async function init(){
    try{
      setStatus('Connecting…');
      sb=await waitForClient();
      const ctx=directContext();
      userId=ctx.uid; selectedCommunityId=ctx.cid; selectedCommunityName=ctx.name;
      if(!userId){ const sessionUid=await trySessionUser(); if(sessionUid) userId=sessionUid; }
      rememberContext(); updateBackLink();
      await loadCommunities();
      if(!communities.length && !isUuid(userId)) setStatus('Open from Manager Hub to pass user/community context.','err');
      await loadBoardData();
    }catch(err){ console.error('[BoardHub V2] init failed',err); setStatus('Board Hub could not initialize.','err'); }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const btn=$('createItemBtn'); if(btn) btn.addEventListener('click',createItem);
    const list=$('attentionList');
    if(list){
      list.addEventListener('click',e=>{ const item=e.target.closest('[data-board-item-idx]'); if(item) openBoardItem(submittedRows[Number(item.dataset.boardItemIdx)]); });
      list.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ const item=e.target.closest('[data-board-item-idx]'); if(item){ e.preventDefault(); openBoardItem(submittedRows[Number(item.dataset.boardItemIdx)]); } } });
    }
    const close1=$('boardItemModalClose'), close2=$('boardItemCloseBtn'); if(close1) close1.addEventListener('click',closeBoardItem); if(close2) close2.addEventListener('click',closeBoardItem);
    const shade=$('boardItemModalShade'); if(shade) shade.addEventListener('click',e=>{ if(e.target===shade) closeBoardItem(); });
    const rev=$('boardItemReviewedBtn'); if(rev) rev.addEventListener('click',()=>updateBoardNotificationStatus('reviewed',{reviewed_at:new Date().toISOString()}));
    const ag=$('boardItemAgendaBtn'); if(ag) ag.addEventListener('click',()=>updateBoardNotificationStatus('agenda_added',{add_to_agenda:true,agenda_added_at:new Date().toISOString()}));
    const wo=$('boardItemWorkOrderBtn'); if(wo) wo.addEventListener('click',()=>createWorkOrderFromActiveBoardItem(wo));
    const photoInput=$('boardItemPhotoInput'); if(photoInput) photoInput.addEventListener('change',()=>uploadPhotoToActiveBoardItem(photoInput));
    init();
  });
})();
