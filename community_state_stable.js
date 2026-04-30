
(function(){
  var KEY_ORDER = [
    'zummee_selected_community_id',
    'activeCommunityId',
    'zummeeActiveCommunityId',
    'currentCommunityId'
  ];
  var LEGACY_KEYS = ['selectedCommunityId','zummee_selected_community_v1','zummee_community_id','activeCommunity'];
  function safeGet(key){ try{ return String(localStorage.getItem(key)||'').trim(); }catch(_e){ return ''; } }
  function safeSet(key,val){ try{ localStorage.setItem(key, String(val||'')); }catch(_e){} }
  function candidates(){
    return [
      document.getElementById('communitySelect'),
      document.querySelector('#communitySelect'),
      document.querySelector('.community-select select'),
      document.querySelector('.community-select'),
      document.querySelector('select[data-community-select]'),
      document.querySelector('select[name="community"]'),
      document.querySelector('select[id*="community"]')
    ].filter(Boolean);
  }
  function getDropdownValue(){
    var list = candidates();
    for(var i=0;i<list.length;i++){
      var el=list[i];
      try{
        var v = String(el && 'value' in el ? el.value : '').trim();
        if(v) return v;
      }catch(_e){}
    }
    return '';
  }
  function getActiveCommunityId(){
    return String(
      getDropdownValue() ||
      safeGet('zummee_selected_community_id') ||
      safeGet('activeCommunityId') ||
      safeGet('zummeeActiveCommunityId') ||
      safeGet('currentCommunityId') ||
      safeGet('selectedCommunityId') ||
      safeGet('zummee_selected_community_v1') ||
      safeGet('zummee_community_id') ||
      ''
    ).trim();
  }
  function sync(val, opts){
    opts = opts || {};
    var id = String(val || getActiveCommunityId() || '').trim();
    if(!id) return '';
    KEY_ORDER.concat(LEGACY_KEYS).forEach(function(key){ safeSet(key, id); });
    try{ window.activeCommunityId = id; }catch(_e){}
    try{ window.currentCommunityId = id; }catch(_e){}
    if(!opts.silent){
      try{ document.dispatchEvent(new CustomEvent('community:changed', { detail:{ communityId:id, source: opts.source || 'community_state_stable' } })); }catch(_e){}
    }
    return id;
  }
  function refreshFromDropdown(source){
    var v = getDropdownValue();
    if(v) sync(v, { source: source || 'dropdown' });
  }
  function bindSelect(el){
    if(!el || el.__zummeeCommunityBound) return;
    el.__zummeeCommunityBound = true;
    ['change','input','blur','touchend'].forEach(function(evt){
      el.addEventListener(evt, function(){
        setTimeout(function(){ refreshFromDropdown(evt); }, evt === 'touchend' ? 120 : 0);
        setTimeout(function(){ refreshFromDropdown(evt + ':late'); }, 220);
      }, { passive:true });
    });
  }
  function bindAll(){ candidates().forEach(bindSelect); }
  function init(){
    bindAll();
    var id = sync('', { silent:true, source:'init' });
    if(!id) return;
    setTimeout(function(){ bindAll(); refreshFromDropdown('init:late'); }, 250);
  }
  window.getActiveCommunityId = getActiveCommunityId;
  window.setActiveCommunityId = function(id){ return sync(id, { source:'manual' }); };
  window.syncActiveCommunityState = function(){ return sync('', { source:'manualSync' }); };
  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('pageshow', function(){ bindAll(); setTimeout(function(){ sync('', { silent:true, source:'pageshow' }); }, 80); });
  document.addEventListener('visibilitychange', function(){ if(!document.hidden){ bindAll(); setTimeout(function(){ sync('', { silent:true, source:'visible' }); }, 60); } });
  window.addEventListener('focus', function(){ bindAll(); setTimeout(function(){ sync('', { silent:true, source:'focus' }); }, 60); });
})();
