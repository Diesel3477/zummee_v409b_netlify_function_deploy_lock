/* Zummee Board Work Order Bridge v428
   Canonical board-item -> resident_work_orders creator.
   Long-term rule: never write legacy notification/source_id fields into resident_work_orders.
*/
(function(){
  'use strict';
  const VERSION = 'v428';
  const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function isUuid(v){ return UUID_RE.test(String(v||'').trim()); }
  function clean(v){ return String(v==null?'':v).trim(); }
  function getClient(){
    return window.supabaseClient || (typeof window.getSupabase === 'function' ? window.getSupabase() : null) || (typeof window.ensureSupabaseSync === 'function' ? window.ensureSupabaseSync() : null);
  }
  function stripBoardMarkers(text){
    return clean(text)
      .replace(/__ZUMMEE_BM_PHOTO__:\s*\{[^}]*\}/gi,' ')
      .replace(/__ZUMMEE_BM_PHOTO__:\s*[^\s]+/gi,' ')
      .replace(/__ZUMMEE_BM_STATUS__:[^\n\r]*/gi,' ')
      .replace(/\s{2,}/g,' ')
      .trim();
  }
  async function insertSchemaSafe(sb, table, payload){
    const cleanPayload=Object.assign({}, payload);
    for(let attempt=0; attempt<16; attempt++){
      const res=await sb.from(table).insert(cleanPayload).select('*').single();
      if(!res.error) return res;
      const msg=String(res.error.message||res.error.details||res.error.hint||'');
      const missing=msg.match(/Could not find the '([^']+)' column/i) || msg.match(/column "([^"]+)" does not exist/i);
      if(missing && Object.prototype.hasOwnProperty.call(cleanPayload, missing[1])){
        console.warn('[ZummeeBoardWorkOrders '+VERSION+'] Removing unsupported column and retrying:', missing[1]);
        delete cleanPayload[missing[1]];
        continue;
      }
      return res;
    }
    return {data:null,error:new Error('Schema-safe insert failed after removing unsupported fields.')};
  }
  async function getUserId(sb, opts){
    if(isUuid(opts && opts.userId)) return clean(opts.userId);
    try{
      const keys=['zummee_user_id_v1','zummeeUserId','activeUserId','currentUserId'];
      for(const k of keys){ const v=localStorage.getItem(k)||sessionStorage.getItem(k); if(isUuid(v)) return clean(v); }
    }catch(e){}
    try{ const r=await sb.auth.getUser(); const id=r&&r.data&&r.data.user&&r.data.user.id; if(isUuid(id)) return id; }catch(e){}
    return '';
  }
  async function createFromBoardItem(row, opts){
    opts=opts||{};
    const sb=getClient();
    if(!sb || typeof sb.from !== 'function') return {data:null,error:new Error('Supabase client unavailable')};
    const communityId=clean(opts.communityId || row.community_id || row.communityId || '');
    if(!isUuid(communityId)) return {data:null,error:new Error('Missing valid community id')};
    const uid=await getUserId(sb, opts);
    const boardItemId=clean(row.id || row.board_item_id || '');
    const title=clean(row.title || row.subject || 'Board submitted maintenance item') || 'Board submitted maintenance item';
    const rawDetails=clean(row.details || row.description || row.message || '');
    const details=stripBoardMarkers(rawDetails) || 'Created from Board Member Hub action item.';
    const nowIso=new Date().toISOString();

    // Only fields confirmed in resident_work_orders schema. No source_id/source_table legacy coupling.
    const payload={
      community_id: communityId,
      resident_name: 'Board Member Hub',
      resident_email: clean(opts.residentEmail || 'system@zummee.com'),
      resident_phone: 'N/A',
      unit_number: 'Board Item',
      subject: title,
      description: details,
      category: 'Board Submitted Item',
      priority: 'normal',
      status: 'submitted',
      submitted_at: nowIso,
      employee_user_id: isUuid(uid) ? uid : null,
      internal_notes: JSON.stringify({
        source: 'board_member_action_item',
        source_version: VERSION,
        board_item_id: boardItemId || null,
        board_item_title: title,
        community_id: communityId,
        created_from: 'board_member_hub_v2',
        created_at: nowIso
      })
    };

    const created=await insertSchemaSafe(sb, 'resident_work_orders', payload);
    if(created.error) return {data:null,error:created.error};
    const workOrderId=clean(created.data && (created.data.id || created.data.work_order_id));
    if(!workOrderId) return {data:null,error:new Error('Work order was created without an id')};

    if(boardItemId){
      const marker='__ZUMMEE_BM_STATUS__:WORK_ORDER_CREATED|'+nowIso+'|'+workOrderId;
      const nextDetails=(rawDetails ? rawDetails+'\n\n'+marker : marker);
      const upd=await sb.from('BoardMemberActionItems')
        .update({status:'archived', details:nextDetails})
        .eq('id', boardItemId)
        .select('id,status,details')
        .maybeSingle();
      if(upd.error) console.warn('[ZummeeBoardWorkOrders '+VERSION+'] Board item archive marker failed:', upd.error);
    }

    return {data:{work_order_id:workOrderId, community_id:communityId, row:created.data}, error:null};
  }

  window.ZummeeBoardWorkOrders={version:VERSION, createFromBoardItem, stripBoardMarkers};
  window.ZummeeDataLayer=window.ZummeeDataLayer||{};
  // Override the legacy shared function so every Board Hub caller uses the schema-safe bridge.
  window.ZummeeDataLayer.createWorkOrderFromBoardItem=function(row, opts){ return createFromBoardItem(row, opts || {}); };
})();
