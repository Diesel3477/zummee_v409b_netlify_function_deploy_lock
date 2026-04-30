/* Zummee shared data layer v403f - cache-proof URL-first + notification_events board submitted authority */
(function(){
  'use strict';
  /* v403f intentionally overwrites older cached data layers */
  var UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  function isUuid(v){return UUID_RE.test(String(v||'').trim());}
  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function parseStore(k){try{var r=localStorage.getItem(k)||sessionStorage.getItem(k)||'';return r?JSON.parse(r):null;}catch(e){return null;}}
  function getSupabase(){try{if(window.supabaseClient&&typeof window.supabaseClient.from==='function')return window.supabaseClient;}catch(e){} try{if(window.getSupabase){var c=window.getSupabase();if(c&&typeof c.from==='function')return c;}}catch(e){} return null;}
  async function requireSupabase(){var c=getSupabase(),s=Date.now();while(!c&&Date.now()-s<6000){await new Promise(r=>setTimeout(r,80));c=getSupabase();} if(!c)throw new Error('Supabase client unavailable'); return c;}
  function localVal(keys){for(var i=0;i<keys.length;i++){try{var v=clean(localStorage.getItem(keys[i])||sessionStorage.getItem(keys[i])||''); if(v)return v;}catch(e){}}return '';}
  function queryVal(keys){try{var p=new URLSearchParams(location.search);for(var i=0;i<keys.length;i++){var v=clean(p.get(keys[i])||'');if(v)return v;}}catch(e){}return '';}
  function selectedCommunityId(){var v=queryVal(['community_id','cid']); if(isUuid(v)) return v; try{var sel=document.getElementById('communitySelect')||document.getElementById('zummeeCommunitySelect')||document.getElementById('communityDropdown')||document.querySelector('select[data-community], select[data-community-select], select[name=community], select'); if(sel&&isUuid(sel.value)) return clean(sel.value);}catch(e){} try{v=clean(window.selectedCommunityId||window.currentCommunityId||window.activeCommunityId||window.zummeeSelectedCommunityId||''); if(isUuid(v)) return v;}catch(e){} return '';}
  function syncCommunityContext(id,name,mode){id=clean(id); name=clean(name); if(!isUuid(id)) return ''; try{['zummee_selected_community_id','zummeeActiveCommunityId','activeCommunityId','currentCommunityId','zummee_community_id'].forEach(function(k){localStorage.setItem(k,id);sessionStorage.setItem(k,id);}); if(name){['zummeeCurrentCommunityName','currentCommunityName','activeCommunityName','zummee_community'].forEach(function(k){localStorage.setItem(k,name);sessionStorage.setItem(k,name);});} window.currentCommunityId=id; window.activeCommunityId=id; window.zummeeSelectedCommunityId=id; var url=new URL(location.href); url.searchParams.set('community_id',id); if(name) url.searchParams.set('community_name',name); if(mode==='push') history.pushState(null,'',url.toString()); else if(mode!=='none') history.replaceState(null,'',url.toString()); }catch(e){} return id;}
  function getStoredUserId(){var v=localVal(['zummee_user_id_v1','zummeeUserId','activeUserId','currentUserId','userId']); if(isUuid(v))return v; var s=parseStore('zummee_session_v1')||{}; v=clean(s.userId||s.id||''); if(isUuid(v))return v; var p=parseStore('zummee_profile_v1')||{}; v=clean(p.id||p.userId||p.employee_id||''); return isUuid(v)?v:'';}
  async function getCurrentUserContext(){var sb=await requireSupabase(); var uid=getStoredUserId(), email=''; try{var au=await sb.auth.getUser();var u=au&&au.data&&au.data.user;if(u){if(isUuid(u.id))uid=u.id;email=clean(u.email).toLowerCase();}}catch(e){} var profile={}; if(isUuid(uid)){try{var q=await sb.from('profiles').select('id,email,company,company_id,selected_community_id,role,disabled,deleted').eq('id',uid).maybeSingle(); if(!q.error&&q.data)profile=q.data;}catch(e){}} if(!email)email=clean(profile.email||(parseStore('zummee_session_v1')||{}).email||(parseStore('zummee_profile_v1')||{}).email||'').toLowerCase(); return {uid:uid,email:email,profile:profile,company_id:clean(profile.company_id||''),company:clean(profile.company||''),role:clean(profile.role||'')};}
  async function hydrateCommunities(sb,rows){var ids=[];rows.forEach(function(r){if(isUuid(r.id)&&ids.indexOf(r.id)<0)ids.push(r.id);}); if(!ids.length)return rows; try{var q=await sb.from('PropertyCommunities').select('*').in('id',ids); if(!q.error&&Array.isArray(q.data)){var by={};q.data.forEach(function(x){by[clean(x.id)]=x;}); rows=rows.map(function(r){var f=by[r.id]||{};return Object.assign({},f,r,{name:clean(f.name||r.name||r.community_name||r.id)});});}}catch(e){} return rows;}
  async function getAssignedCommunities(opts){opts=opts||{}; var sb=await requireSupabase(); var ctx=opts.context||await getCurrentUserContext(); var ids=[],emails=[]; function addId(v){v=clean(v);if(isUuid(v)&&ids.indexOf(v)<0)ids.push(v);} function addEmail(v){v=clean(v).toLowerCase();if(v&&emails.indexOf(v)<0)emails.push(v);} addId(opts.userId);addId(ctx.uid);addEmail(opts.email);addEmail(ctx.email); var sess=parseStore('zummee_session_v1')||{};addId(sess.userId||sess.id);addEmail(sess.email||sess.user_email); var prof=parseStore('zummee_profile_v1')||{};addId(prof.id||prof.userId||prof.employee_id);addEmail(prof.email||prof.employee_email); var seen={},out=[]; function addRow(r){var id=clean((r&&r.community_id)||(r&&r.id)||''), name=clean((r&&r.community_name)||(r&&r.name)||(r&&r.community)||''); if(!isUuid(id)||!name)return; var k=id+'|'+name.toLowerCase(); if(seen[k])return; seen[k]=true; out.push({id:id,name:name,community_id:id,community_name:name,company_id:clean(r.company_id||ctx.company_id||''),company:clean(ctx.company||''),raw:r});}
    async function query(col,val){if(!val)return; try{var r=await sb.from('community_assignments').select('community_id,community_name,company_id,employee_id,employee_name,employee_email,assistant_name,assistant_email').eq(col,val).order('community_name',{ascending:true}); if(!r.error&&Array.isArray(r.data))r.data.forEach(addRow);}catch(e){console.warn('[ZummeeDataLayer] assignment query skipped',col,e);}}
    for(var i=0;i<ids.length;i++)await query('employee_id',ids[i]); for(var j=0;j<emails.length;j++)await query('employee_email',emails[j]); out=await hydrateCommunities(sb,out); out.sort(function(a,b){return clean(a.name).localeCompare(clean(b.name));}); try{localStorage.setItem('zummee_assigned_communities_v1',JSON.stringify(out));sessionStorage.setItem('zummee_assigned_communities_v1',JSON.stringify(out));window.__zummeeAssignedCommunities=out.slice();}catch(e){} return out;}
  function isOpenBoardStatus(row){
    var st=clean(row&&row.status).toLowerCase().replace(/[\s-]+/g,'_');
    if(!st)return true;
    return !(/complete|completed|closed|archived|done|resolved|cancel|reject|rejected|approved_ready|sent_to_admin|mail|mailed/.test(st));
  }
  function normalizeBoardItem(row,source){
    row=row||{};
    var out={};
    Object.keys(row).forEach(function(k){out[k]=row[k];});
    out.id=clean(row.id||row.item_id||row.action_item_id||row.uuid||'');
    out.community_id=clean(row.community_id||row.property_community_id||row.property_id||row.communityId||'');
    out.title=clean(row.title||row.item_title||row.subject||row.name||row.summary||'Review submitted item');
    out.details=clean(row.details||row.description||row.notes||row.body||row.message||row.request||row.status||'Ready for review');
    out.status=clean(row.status||row.item_status||row.state||'open');
    out.due_date=row.due_date||row.due||row.target_date||null;
    out.created_at=row.created_at||row.submitted_at||row.createdAt||row.date_created||null;
    out.created_by=clean(row.created_by||row.user_id||row.submitted_by||'');
    out.__source=source;
    return out;
  }
  async function queryBoardTable(sb,table,communityId){
    var q=await sb.from(table).select('*').eq('community_id',communityId).limit(500);
    if(q.error) throw q.error;
    var rows=Array.isArray(q.data)?q.data:[];
    rows=rows.map(function(r){return normalizeBoardItem(r,table+'.direct');});
    rows.sort(function(a,b){return String(b.created_at||'').localeCompare(String(a.created_at||''));});
    return rows;
  }
  async function queryBoardNotifications(sb,communityId){
    var q=await sb.from('notification_events')
      .select('id,event_type,title,message,source_table,source_id,community_id,metadata,created_at,priority,link_url')
      .eq('community_id',communityId)
      .eq('event_type','board_item_submitted')
      .order('created_at',{ascending:false})
      .limit(500);
    if(q.error) throw q.error;
    var rows=Array.isArray(q.data)?q.data:[];
    rows=rows.filter(function(r){
      var st=clean(r.source_table).toLowerCase();
      return !st || st==='boardmemberactionitems' || st==='board_member_action_items';
    }).map(function(r){
      var meta=(r&&r.metadata&&typeof r.metadata==='object')?r.metadata:{};
      return normalizeBoardItem({
        id:r.source_id||r.id,
        notification_id:r.id,
        community_id:r.community_id,
        title:meta.title||meta.item_title||r.title||'Board Item Submitted',
        details:meta.details||meta.description||meta.message||r.message||'A new board item was submitted and needs review.',
        status:meta.status||'open',
        due_date:meta.due_date||meta.dueDate||null,
        created_at:r.created_at,
        created_by:meta.created_by||meta.user_id||'',
        source_table:r.source_table,
        source_id:r.source_id,
        metadata:meta
      },'notification_events.board_item_submitted');
    });
    return rows;
  }
  async function getBoardItemsForCommunity(communityId,userId,opts){
    opts=opts||{};
    var sb=await requireSupabase();
    communityId=clean(communityId||selectedCommunityId());
    if(!isUuid(communityId)) return {rows:[],source:'shared-board-items.v403f',error:null,community_id:communityId,emptyReason:'missing-community'};
    var tables=['BoardMemberActionItems','board_member_action_items','board_member_hub_items','BoardHubV2Items'];
    var successes=[];
    var failures=[];
    for(var i=0;i<tables.length;i++){
      try{
        var rows=await queryBoardTable(sb,tables[i],communityId);
        successes.push({table:tables[i],rows:rows});
        console.info('[ZummeeDataLayer v403f] board table loaded', tables[i], rows.length, communityId);
      }catch(error){
        failures.push({table:tables[i],error:error});
        console.warn('[ZummeeDataLayer v403f] board table skipped', tables[i], error&&error.message?error.message:error);
      }
    }
    var notificationRows=[];
    var notificationError=null;
    try{
      notificationRows=await queryBoardNotifications(sb,communityId);
      console.info('[ZummeeDataLayer v403f] board notification_events loaded', notificationRows.length, communityId);
    }catch(ne){
      notificationError=ne;
      console.warn('[ZummeeDataLayer v403f] board notification_events skipped', ne&&ne.message?ne.message:ne);
    }
    if(successes.length){
      successes.sort(function(a,b){return (b.rows||[]).length-(a.rows||[]).length;});
      var picked=successes[0];
      var rows=picked.rows||[];
      if((notificationRows||[]).length>rows.length){ rows=notificationRows; picked={table:'notification_events',rows:rows}; }
      if(opts.openOnly) rows=rows.filter(isOpenBoardStatus);
      return {rows:rows,source:(picked.table==='notification_events'?'notification_events.board_item_submitted':picked.table+'.direct'),error:null,community_id:communityId,attempts:successes.map(function(x){return {table:x.table,count:x.rows.length};}).concat([{table:'notification_events',count:notificationRows.length,error:notificationError?String(notificationError.message||notificationError):null}])};
    }
    if(notificationRows.length){
      var nr=opts.openOnly?notificationRows.filter(isOpenBoardStatus):notificationRows;
      return {rows:nr,source:'notification_events.board_item_submitted',error:null,community_id:communityId,attempts:[{table:'notification_events',count:notificationRows.length}]};
    }
    return {rows:[],source:'shared-board-items.v403f',error:null,community_id:communityId,emptyReason:'none-found',failures:failures,notificationError:notificationError};
  }
  async function getOpenBoardItemsForCommunity(communityId,userId){
    return getBoardItemsForCommunity(communityId,userId,{openOnly:true});
  }
  async function countOpenBoardItemsForCommunity(communityId,userId){
    var r=await getOpenBoardItemsForCommunity(communityId,userId);
    return {count:(r.rows||[]).length,source:r.source,error:r.error,community_id:r.community_id};
  }
  async function getBoardItemsForSelectedCommunity(){var cid=selectedCommunityId(); console.info('[ZummeeDataLayer v403f] selected community for board items', cid); return getBoardItemsForCommunity(cid,getStoredUserId());}
  window.ZummeeDataLayer={__version:'v403f-notification-events-board-authority',isUuid:isUuid,getSupabase:getSupabase,requireSupabase:requireSupabase,getCurrentUserContext:getCurrentUserContext,getAssignedCommunities:getAssignedCommunities,selectedCommunityId:selectedCommunityId,syncCommunityContext:syncCommunityContext,getBoardItemsForCommunity:getBoardItemsForCommunity,getOpenBoardItemsForCommunity:getOpenBoardItemsForCommunity,countOpenBoardItemsForCommunity:countOpenBoardItemsForCommunity,getBoardItemsForSelectedCommunity:getBoardItemsForSelectedCommunity};
})();
