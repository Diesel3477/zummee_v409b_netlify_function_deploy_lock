(function(){
  'use strict';
  const VERSION='v518-board-route-lock-canonical-v2';
  const UUID_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const CLOSED_STATUSES=new Set(['reviewed','completed','closed','archived','converted','work_order_created','complete']);

  function cleanUuidCandidate(v){
    return String(v||'')
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g,'')
      .replace(/[‐‑‒–—―]/g,'-');
  }
  function isUuid(v){
    return UUID_RE.test(cleanUuidCandidate(v));
  }
  function pushCandidate(list, value){
    if(value == null) return;
    list.push(value);
    if(typeof value === 'object'){
      list.push(value.communityId, value.selectedCommunityId, value.community_id, value.id, value.value);
      if(value.target) list.push(value.target.value);
      if(value.detail) list.push(value.detail.communityId, value.detail.community_id, value.detail.id, value.detail.value);
      try{
        Object.keys(value).forEach(function(k){
          if(/community|id|value/i.test(k)) list.push(value[k]);
        });
      }catch(_e){}
    }
  }
  function resolveCommunityId(communityId, opts){
    const candidates=[];
    pushCandidate(candidates, communityId);
    pushCandidate(candidates, opts);
    pushCandidate(candidates, window.selectedCommunityId);
    pushCandidate(candidates, window.activeCommunityId);
    pushCandidate(candidates, window.__zummeeActiveCommunityId);
    const sel=document.querySelector('#communitySelect');
    pushCandidate(candidates, sel && sel.value);
    pushCandidate(candidates, localStorage.getItem('zummeeActiveCommunityId'));
    pushCandidate(candidates, localStorage.getItem('activeCommunityId'));
    pushCandidate(candidates, localStorage.getItem('currentCommunityId'));
    pushCandidate(candidates, localStorage.getItem('zummee_selected_community_id'));
    pushCandidate(candidates, sessionStorage.getItem('zummeeActiveCommunityId'));
    pushCandidate(candidates, sessionStorage.getItem('activeCommunityId'));
    pushCandidate(candidates, sessionStorage.getItem('currentCommunityId'));
    pushCandidate(candidates, sessionStorage.getItem('zummee_selected_community_id'));
    for(const v of candidates){
      const clean=cleanUuidCandidate(v);
      if(isUuid(clean)) return clean;
    }
    console.warn('[ZummeeBoardData '+VERSION+'] could not resolve communityId', {communityId, opts, selectValue:sel && sel.value, localStorageActive:localStorage.getItem('zummeeActiveCommunityId')});
    return '';
  }
  function parseMetadata(meta){
    if(!meta) return {};
    if(typeof meta==='object') return meta;
    if(typeof meta==='string'){
      try{ return JSON.parse(meta)||{}; }catch(_e){ return {}; }
    }
    return {};
  }
  function normalizedStatus(row){
    const meta=parseMetadata(row && row.metadata);
    // Canonical board status lives in notification_events.metadata.status.
    // Row-level status is only a fallback because many notification rows do not have a real status column.
    const raw=meta.status || meta.workflow_status || meta.board_status || (row && row.status) || '';
    const s=String(raw).toLowerCase().trim().replace(/[\s-]+/g,'_');
    return s || 'legacy_archived';
  }
  function isActiveBoardReviewItem(row){
    if(!row) return false;
    if(row.deleted_at) return false;
    // v511: Needs Attention must show only explicitly-open current board items.
    // Legacy notification rows with no metadata.status are history/archive, not live work.
    return normalizedStatus(row) === 'open';
  }
  function isArchivedBoardReviewItem(row){
    if(!row) return false;
    if(row.deleted_at) return true;
    return normalizedStatus(row) !== 'open';
  }
  function normalizeRow(row){
    const meta=parseMetadata(row && row.metadata);
    const title=String((row && row.title) || meta.title || 'Board item submitted').trim();
    const message=String((row && row.message) || meta.details || meta.description || 'A new board item was submitted and needs review.').trim();
    return Object.assign({}, row, {
      title,
      message,
      metadata:meta,
      status:normalizedStatus(row),
      details:meta.details || meta.description || message,
      notification_id:String(row && row.id || '').trim(),
      source_table:'notification_events',
      __source:'notification_events.board_item_submitted',
      __boardLiveOpen: normalizedStatus(row) === 'open'
    });
  }
  function getClient(opts){
    return (opts && opts.client) || window.supabaseClient || (window.getSupabase && window.getSupabase()) || null;
  }
  async function fetchNotificationRows(communityId, opts){
    // v505: use Supabase select('*') first so the loader cannot break when optional
    // columns such as updated_at are absent from notification_events. The live queue
    // only requires id/title/message/metadata/community_id/event_type/created_at.
    const sb=getClient(opts);
    if(sb && typeof sb.from==='function'){
      const r=await sb.from('notification_events')
        .select('*')
        .eq('community_id',communityId)
        .eq('event_type','board_item_submitted')
        .order('created_at',{ascending:false})
        .limit(500);
      if(!r.error) return Array.isArray(r.data)?r.data:[];
      console.warn('[ZummeeBoardData '+VERSION+'] native notification_events load failed; trying REST fallback', r.error);
    }

    const path='notification_events?select=*&community_id=eq.'+encodeURIComponent(communityId)+'&event_type=eq.board_item_submitted&order=created_at.desc&limit=500';
    if(window.ZummeeAuth && typeof window.ZummeeAuth.fetchRest==='function'){
      const rows=await window.ZummeeAuth.fetchRest(path);
      return Array.isArray(rows)?rows:[];
    }
    if(!sb || typeof sb.from!=='function') throw new Error('Supabase client unavailable');
    throw new Error('notification_events board source unavailable');
  }
  async function getBoardReviewItems(communityId, opts){
    communityId=resolveCommunityId(communityId, opts);
    const empty={error:null,rows:[],raw:[],count:0,overdue:0,source:'notification_events.board_item_submitted',version:VERSION};
    if(!isUuid(communityId)) return Object.assign({}, empty, {error:new Error('Missing or invalid communityId')});
    try{
      const raw=(await fetchNotificationRows(communityId, opts)).map(normalizeRow);
      const rows=raw.filter(isActiveBoardReviewItem);
      return {error:null,rows,raw,count:rows.length,overdue:rows.length,source:'notification_events.board_item_submitted',version:VERSION};
    }catch(error){
      console.error('[ZummeeBoardData '+VERSION+'] getBoardReviewItems failed', error);
      return Object.assign({}, empty, {error});
    }
  }
  window.ZummeeBoardData=Object.assign({}, window.ZummeeBoardData||{}, {
    version:VERSION,
    getBoardReviewItems,
    isActiveBoardReviewItem,
    isArchivedBoardReviewItem,
    normalizedStatus,
    normalizeRow
  });
  console.info('[ZummeeBoardData '+VERSION+'] installed');
  console.log('🚀 ZummeeBoardData v516 loaded');
})();
