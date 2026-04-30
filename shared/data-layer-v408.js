/* Zummee shared data layer v408 - board item photo attachments + work order authority
   Long-term rules:
   1) URL community_id is authority.
   2) Assigned communities come from community_assignments only.
   3) Board submitted items come from notification_events only.
   4) No BoardMemberActionItems/legacy table probes. No frontend schema guessing.
*/
(function(){
  'use strict';
  var VERSION='v408-board-item-photo-attachments';
  var UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function isUuid(v){return UUID_RE.test(String(v||'').trim());}
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function parseStore(k){try{var r=localStorage.getItem(k)||sessionStorage.getItem(k)||'';return r?JSON.parse(r):null;}catch(e){return null;}}
  function getSupabase(){try{if(window.supabaseClient&&typeof window.supabaseClient.from==='function')return window.supabaseClient;}catch(e){} try{if(window.getSupabase){var c=window.getSupabase();if(c&&typeof c.from==='function')return c;}}catch(e){} try{if(window.ensureSupabaseSync){var s=window.ensureSupabaseSync();if(s&&typeof s.from==='function')return s;}}catch(e){} return null;}
  async function requireSupabase(){var c=getSupabase(),s=Date.now();while(!c&&Date.now()-s<7000){await new Promise(function(r){setTimeout(r,80)});c=getSupabase();} if(!c)throw new Error('Supabase client unavailable'); return c;}
  function localVal(keys){for(var i=0;i<keys.length;i++){try{var v=clean(localStorage.getItem(keys[i])||sessionStorage.getItem(keys[i])||''); if(v)return v;}catch(e){}}return '';}
  function queryVal(keys){try{var p=new URLSearchParams(location.search);for(var i=0;i<keys.length;i++){var v=clean(p.get(keys[i])||'');if(v)return v;}}catch(e){}return '';}
  function selectedCommunityId(){var v=queryVal(['community_id','cid']); if(isUuid(v)) return v; try{var sel=document.getElementById('communitySelect')||document.getElementById('zummeeCommunitySelect')||document.getElementById('communityDropdown')||document.querySelector('select[data-community], select[data-community-select], select[name=community], select'); if(sel&&isUuid(sel.value)) return clean(sel.value);}catch(e){} try{v=clean(window.selectedCommunityId||window.currentCommunityId||window.activeCommunityId||window.zummeeSelectedCommunityId||''); if(isUuid(v)) return v;}catch(e){} return '';}
  function syncCommunityContext(id,name,mode){id=clean(id); name=clean(name); if(!isUuid(id)) return ''; try{['zummee_active_community_id','zummee_selected_community_id','zummeeActiveCommunityId','activeCommunityId','currentCommunityId','zummee_community_id'].forEach(function(k){localStorage.setItem(k,id);sessionStorage.setItem(k,id);}); if(name){['zummeeCurrentCommunityName','currentCommunityName','activeCommunityName','zummee_community'].forEach(function(k){localStorage.setItem(k,name);sessionStorage.setItem(k,name);});} window.currentCommunityId=id; window.activeCommunityId=id; window.zummeeSelectedCommunityId=id; var url=new URL(location.href); url.searchParams.set('community_id',id); if(name) url.searchParams.set('community_name',name); if(mode==='push') history.pushState(null,'',url.toString()); else if(mode!=='none') history.replaceState(null,'',url.toString());}catch(e){} return id;}
  function getStoredUserId(){var v=localVal(['zummee_user_id_v1','zummeeUserId','activeUserId','currentUserId','userId']); if(isUuid(v))return v; var s=parseStore('zummee_session_v1')||{}; v=clean(s.userId||s.id||''); if(isUuid(v))return v; var p=parseStore('zummee_profile_v1')||{}; v=clean(p.id||p.userId||p.employee_id||''); return isUuid(v)?v:'';}
  async function getCurrentUserContext(){var sb=await requireSupabase(); var uid=getStoredUserId(), email=''; try{var au=await sb.auth.getUser();var u=au&&au.data&&au.data.user;if(u){if(isUuid(u.id))uid=u.id;email=clean(u.email).toLowerCase();}}catch(e){} var profile={}; if(isUuid(uid)){try{var q=await sb.from('profiles').select('id,email,company,company_id,selected_community_id,role,disabled,deleted').eq('id',uid).maybeSingle(); if(!q.error&&q.data)profile=q.data;}catch(e){}} if(!email)email=clean(profile.email||(parseStore('zummee_session_v1')||{}).email||(parseStore('zummee_profile_v1')||{}).email||'').toLowerCase(); return {uid:uid,email:email,profile:profile,company_id:clean(profile.company_id||''),company:clean(profile.company||''),role:clean(profile.role||'')};}
  async function hydrateCommunities(sb,rows){var ids=[];rows.forEach(function(r){if(isUuid(r.id)&&ids.indexOf(r.id)<0)ids.push(r.id);}); if(!ids.length)return rows; try{var q=await sb.from('PropertyCommunities').select('*').in('id',ids); if(!q.error&&Array.isArray(q.data)){var by={};q.data.forEach(function(x){by[clean(x.id)]=x;}); rows=rows.map(function(r){var f=by[r.id]||{};return Object.assign({},f,r,{name:clean(f.name||r.name||r.community_name||r.id)});});}}catch(e){} return rows;}
  async function getAssignedCommunities(opts){opts=opts||{}; var sb=await requireSupabase(); var ctx=opts.context||await getCurrentUserContext(); var ids=[],emails=[]; function addId(v){v=clean(v);if(isUuid(v)&&ids.indexOf(v)<0)ids.push(v);} function addEmail(v){v=clean(v).toLowerCase();if(v&&emails.indexOf(v)<0)emails.push(v);} addId(opts.userId);addId(ctx.uid);addEmail(opts.email);addEmail(ctx.email); var sess=parseStore('zummee_session_v1')||{};addId(sess.userId||sess.id);addEmail(sess.email||sess.user_email); var prof=parseStore('zummee_profile_v1')||{};addId(prof.id||prof.userId||prof.employee_id);addEmail(prof.email||prof.employee_email); var seen={},out=[]; function addRow(r){var id=clean((r&&r.community_id)||(r&&r.id)||''), name=clean((r&&r.community_name)||(r&&r.name)||(r&&r.community)||''); if(!isUuid(id)||!name)return; var k=id+'|'+name.toLowerCase(); if(seen[k])return; seen[k]=true; out.push({id:id,name:name,community_id:id,community_name:name,company_id:clean(r.company_id||ctx.company_id||''),company:clean(ctx.company||''),raw:r});} async function query(col,val){if(!val)return; try{var r=await sb.from('community_assignments').select('community_id,community_name,company_id,employee_id,employee_name,employee_email,assistant_name,assistant_email').eq(col,val).order('community_name',{ascending:true}); if(!r.error&&Array.isArray(r.data))r.data.forEach(addRow);}catch(e){console.warn('[ZummeeDataLayer '+VERSION+'] assignment query skipped',col,e);}} for(var i=0;i<ids.length;i++)await query('employee_id',ids[i]); for(var j=0;j<emails.length;j++)await query('employee_email',emails[j]); out=await hydrateCommunities(sb,out); out.sort(function(a,b){return clean(a.name).localeCompare(clean(b.name));}); try{localStorage.setItem('zummee_assigned_communities_v1',JSON.stringify(out));sessionStorage.setItem('zummee_assigned_communities_v1',JSON.stringify(out));window.__zummeeAssignedCommunities=out.slice();}catch(e){} return out;}
  function isOpenBoardStatus(row){var st=clean(row&&row.status).toLowerCase().replace(/[\s-]+/g,'_'); if(!st)return true; return !(/complete|completed|closed|archived|done|resolved|cancel|reject|rejected|approved_ready|sent_to_admin|mail|mailed|converted/.test(st));}
  function normalizeBoardNotification(r){r=r||{}; var meta=(r.metadata&&typeof r.metadata==='object')?r.metadata:{}; var title=clean(meta.title||meta.item_title||meta.subject||r.title||'Board Item Submitted'); var details=clean(meta.details||meta.description||meta.message||r.message||'A new board item was submitted and needs review.'); var status=clean(meta.status||meta.workflow_status||meta.state||'open'); var workOrderId=clean(meta.work_order_id||meta.workOrderId||meta.rwo_id||meta.open_work_order_id||''); return {id:clean(r.source_id||r.id||meta.id||''),notification_id:clean(r.id||''),community_id:clean(r.community_id||meta.community_id||''),title:title,details:details,status:status,due_date:meta.due_date||meta.dueDate||meta.target_date||null,created_at:r.created_at||meta.created_at||meta.submitted_at||null,created_by:clean(meta.created_by||meta.user_id||meta.submitted_by||''),source_table:clean(r.source_table||meta.source_table||''),source_id:clean(r.source_id||meta.source_id||''),work_order_id:workOrderId,photos:Array.isArray(meta.photos)?meta.photos:[],metadata:meta,__source:'notification_events.board_item_submitted'};}
  async function getBoardItemsForCommunity(communityId,userId,opts){opts=opts||{}; var sb=await requireSupabase(); communityId=clean(communityId||selectedCommunityId()); if(!isUuid(communityId)) return {rows:[],source:'notification_events.board_item_submitted',error:null,community_id:communityId,emptyReason:'missing-community'}; try{var q=await sb.from('notification_events').select('id,event_type,title,message,source_table,source_id,community_id,metadata,created_at,priority,link_url').eq('community_id',communityId).eq('event_type','board_item_submitted').order('created_at',{ascending:false}).limit(500); if(q.error) throw q.error; var rows=(Array.isArray(q.data)?q.data:[]).map(normalizeBoardNotification); if(opts.openOnly) rows=rows.filter(isOpenBoardStatus); console.info('[ZummeeDataLayer '+VERSION+'] board notification_events loaded', rows.length, communityId); return {rows:rows,source:'notification_events.board_item_submitted',error:null,community_id:communityId};}catch(error){console.error('[ZummeeDataLayer '+VERSION+'] board notification_events failed', error); return {rows:[],source:'notification_events.board_item_submitted',error:error,community_id:communityId};}}
  async function getOpenBoardItemsForCommunity(communityId,userId){return getBoardItemsForCommunity(communityId,userId,{openOnly:true});}
  async function countOpenBoardItemsForCommunity(communityId,userId){var r=await getOpenBoardItemsForCommunity(communityId,userId); return {count:(r.rows||[]).length,source:r.source,error:r.error,community_id:r.community_id};}
  async function getBoardItemsForSelectedCommunity(){var cid=selectedCommunityId(); console.info('[ZummeeDataLayer '+VERSION+'] selected community for board items', cid); return getBoardItemsForCommunity(cid,getStoredUserId());}
  async function createBoardItemForCommunity(communityId,payload){var sb=await requireSupabase(); communityId=clean(communityId||selectedCommunityId()); payload=payload||{}; if(!isUuid(communityId)) return {data:null,error:new Error('Missing community_id')}; var title=clean(payload.title||'Board Item Submitted'); var message=clean(payload.details||payload.message||'A new board item was submitted and needs review.'); var meta=Object.assign({},payload,{title:title,details:message,status:clean(payload.status||'open')}); try{var q=await sb.from('notification_events').insert({community_id:communityId,event_type:'board_item_submitted',title:title,message:message,source_table:'BoardMemberActionItems',metadata:meta}).select('id,event_type,title,message,source_table,source_id,community_id,metadata,created_at').single(); return {data:q.data,error:q.error};}catch(e){return {data:null,error:e};}}

  async function createWorkOrderFromBoardItem(row,opts){
    opts=opts||{}; row=row||{}; var sb=await requireSupabase();
    var communityId=clean(opts.communityId||row.community_id||selectedCommunityId());
    if(!isUuid(communityId)) return {data:null,error:new Error('Missing community_id')};
    var meta=(row.metadata&&typeof row.metadata==='object')?row.metadata:{};
    var existing=clean(row.work_order_id||meta.work_order_id||meta.workOrderId||meta.rwo_id||'');
    if(existing) return {data:{work_order_id:existing,existing:true},error:null};
    var title=clean(row.title||meta.title||'Board Action Item');
    var details=clean(row.details||meta.details||row.message||meta.message||'Created from Board Member Hub action item.');
    var uid=clean(opts.userId||getStoredUserId());
    try{var au=await sb.auth.getUser(); if(au&&au.data&&au.data.user&&isUuid(au.data.user.id)) uid=au.data.user.id;}catch(e){}
    var payload={community_id:communityId,resident_name:'Board Member Hub',resident_email:'board-item@zummee.local',resident_phone:'N/A',unit_number:'Board Item',subject:title,description:details||'Created from Board Member Hub action item.',category:'general',priority:'normal',status:'submitted',employee_user_id:isUuid(uid)?uid:null,source_table:'notification_events',source_id:clean(row.notification_id||row.id||'')||null};
    try{
      var ins=await sb.from('resident_work_orders').insert([payload]).select('id,community_id').single();
      if(ins.error) throw ins.error;
      var created=ins.data||{}; if(!created.id) throw new Error('Work order insert did not return an id.');
      var notificationId=clean(row.notification_id||'');
      var nextMeta=Object.assign({},meta,{status:'converted_to_work_order',workflow_status:'converted_to_work_order',work_order_id:created.id,converted_to_work_order_at:new Date().toISOString(),converted_to_work_order_by:isUuid(uid)?uid:null});
      if(notificationId){var up=await sb.from('notification_events').update({metadata:nextMeta}).eq('id',notificationId).select('id,metadata').maybeSingle(); if(up.error) console.warn('[ZummeeDataLayer '+VERSION+'] board notification metadata update skipped', up.error);}
      try{await sb.from('notification_events').insert({community_id:communityId,event_type:'new_work_order',title:'Board Item Converted to Work Order',message:'A board action item was converted into a work order.',source_table:'resident_work_orders',source_id:String(created.id),priority:'high',link_url:'resident_work_orders.html?open_work_order_id='+encodeURIComponent(String(created.id)),metadata:{work_order_id:created.id,board_notification_id:notificationId||null,board_item_title:title}});}catch(noteErr){console.warn('[ZummeeDataLayer '+VERSION+'] work order notification insert skipped', noteErr);}
      return {data:{work_order_id:created.id,community_id:created.community_id||communityId,existing:false},error:null};
    }catch(error){console.error('[ZummeeDataLayer '+VERSION+'] createWorkOrderFromBoardItem failed', error); return {data:null,error:error};}
  }


  function safeFileName(name){return clean(name||'photo').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').slice(0,90)||'photo';}
  async function uploadBoardItemPhoto(row,file,opts){
    opts=opts||{}; row=row||{}; var sb=await requireSupabase();
    if(!file) return {data:null,error:new Error('Missing photo file')};
    if(!/^image\//i.test(file.type||'')) return {data:null,error:new Error('Please choose an image file')};
    var communityId=clean(opts.communityId||row.community_id||selectedCommunityId());
    if(!isUuid(communityId)) return {data:null,error:new Error('Missing community_id')};
    var notificationId=clean(row.notification_id||row.id||opts.notificationId||'');
    if(!isUuid(notificationId)) return {data:null,error:new Error('Missing board item notification id')};
    var meta=(row.metadata&&typeof row.metadata==='object')?row.metadata:{};
    var uid=clean(opts.userId||getStoredUserId());
    try{var au=await sb.auth.getUser(); if(au&&au.data&&au.data.user&&isUuid(au.data.user.id)) uid=au.data.user.id;}catch(e){}
    var bucket='board-item-photos';
    var ext=(safeFileName(file.name).split('.').pop()||'jpg').toLowerCase();
    if(ext.length>5) ext='jpg';
    var path=communityId+'/'+notificationId+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
    try{
      var up=await sb.storage.from(bucket).upload(path,file,{cacheControl:'31536000',upsert:false,contentType:file.type||'image/jpeg'});
      if(up.error) throw up.error;
      var pub=sb.storage.from(bucket).getPublicUrl(path);
      var publicUrl=pub&&pub.data&&pub.data.publicUrl?pub.data.publicUrl:'';
      var photo={bucket:bucket,path:path,url:publicUrl,name:safeFileName(file.name),type:file.type||'',size:file.size||0,uploaded_at:new Date().toISOString(),uploaded_by:isUuid(uid)?uid:null};
      var photos=Array.isArray(meta.photos)?meta.photos.slice():[];
      photos.push(photo);
      var nextMeta=Object.assign({},meta,{photos:photos,photo_count:photos.length,updated_at:new Date().toISOString(),updated_by:isUuid(uid)?uid:null});
      var q=await sb.from('notification_events').update({metadata:nextMeta}).eq('id',notificationId).select('id,metadata').maybeSingle();
      if(q.error) throw q.error;
      return {data:{photo:photo,photos:photos,notification_id:notificationId},error:null};
    }catch(error){
      console.error('[ZummeeDataLayer '+VERSION+'] uploadBoardItemPhoto failed', error);
      return {data:null,error:error};
    }
  }

  window.ZummeeDataLayer={version:VERSION,__version:VERSION,isUuid:isUuid,getSupabase:getSupabase,requireSupabase:requireSupabase,getCurrentUserContext:getCurrentUserContext,getAssignedCommunities:getAssignedCommunities,selectedCommunityId:selectedCommunityId,syncCommunityContext:syncCommunityContext,getBoardItemsForCommunity:getBoardItemsForCommunity,getOpenBoardItemsForCommunity:getOpenBoardItemsForCommunity,countOpenBoardItemsForCommunity:countOpenBoardItemsForCommunity,getBoardItemsForSelectedCommunity:getBoardItemsForSelectedCommunity,createBoardItemForCommunity:createBoardItemForCommunity,createWorkOrderFromBoardItem:createWorkOrderFromBoardItem,uploadBoardItemPhoto:uploadBoardItemPhoto};
})();
