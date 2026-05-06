// Zummee v514 Community Selection Lock
// One parser for every page. Supports direct UUID values, JSON values, and URL-encoded JSON values.
(function(){
  'use strict';

  function safeDecode(value){
    value = String(value || '').trim();
    if(!value) return '';
    try { return decodeURIComponent(value); } catch(_e) { return value; }
  }

  function parseValue(value){
    var raw = String(value || '').trim();
    if(!raw) return { id:'', name:'', raw:'' };
    var decoded = safeDecode(raw);
    var parsed = null;
    if(decoded.charAt(0) === '{'){
      try { parsed = JSON.parse(decoded); } catch(_e) { parsed = null; }
    }
    if(parsed && typeof parsed === 'object'){
      return {
        id: String(parsed.id || parsed.community_id || parsed.value || '').trim(),
        name: String(parsed.name || parsed.community_name || parsed.label || '').trim(),
        raw: raw,
        object: parsed
      };
    }
    return { id: decoded, name:'', raw: raw };
  }

  function getSelect(preferredId){
    if(preferredId && document.getElementById(preferredId)) return document.getElementById(preferredId);
    return document.getElementById('zummeeCommunitySelect') || document.getElementById('communitySelect') || document.querySelector('[data-community-select]') || null;
  }

  function getSelectedCommunityContext(preferredId){
    var select = getSelect(preferredId);
    var ctx = { id:'', name:'', select:select || null, option:null };
    if(select){
      var option = select.selectedOptions && select.selectedOptions[0] ? select.selectedOptions[0] : null;
      var parsed = parseValue(select.value);
      ctx.id = String((option && (option.dataset.communityId || option.getAttribute('data-community-id'))) || parsed.id || select.value || '').trim();
      ctx.name = String((option && (option.dataset.communityName || option.getAttribute('data-community-name') || option.textContent)) || parsed.name || '').trim();
      ctx.option = option;
    }
    if(!ctx.id){
      ctx.id = String(localStorage.getItem('zummee_selected_community_id') || localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_community_id') || '').trim();
    }
    if(!ctx.name){
      ctx.name = String(localStorage.getItem('zummee_selected_community_name') || localStorage.getItem('activeCommunityName') || localStorage.getItem('currentCommunityName') || '').trim();
    }
    return ctx;
  }

  function getSelectedCommunityId(preferredId){ return getSelectedCommunityContext(preferredId).id; }
  function getSelectedCommunityName(preferredId){ return getSelectedCommunityContext(preferredId).name; }

  function syncSelectedCommunityStorage(preferredId){
    var ctx = getSelectedCommunityContext(preferredId);
    try{
      if(ctx.id){
        localStorage.setItem('zummee_selected_community_id', ctx.id);
        localStorage.setItem('activeCommunityId', ctx.id);
        localStorage.setItem('currentCommunityId', ctx.id);
        localStorage.setItem('zummee_community_id', ctx.id);
      }
      if(ctx.name){
        localStorage.setItem('zummee_selected_community_name', ctx.name);
        localStorage.setItem('activeCommunityName', ctx.name);
        localStorage.setItem('currentCommunityName', ctx.name);
      }
    }catch(_e){}
    return ctx;
  }

  function normalizeSelectOptions(preferredId){
    var select = getSelect(preferredId);
    if(!select) return null;
    Array.from(select.options || []).forEach(function(option){
      var parsed = parseValue(option.value);
      var id = String((option.dataset.communityId || option.getAttribute('data-community-id') || parsed.id || option.value || '')).trim();
      var name = String((option.dataset.communityName || option.getAttribute('data-community-name') || parsed.name || option.textContent || '')).trim();
      if(id) option.dataset.communityId = id;
      if(name) option.dataset.communityName = name;
      // Keep future reads simple and stable: option value should be the UUID, not encoded JSON.
      if(id) option.value = id;
    });
    syncSelectedCommunityStorage(preferredId);
    return select;
  }

  window.ZummeeCommunity = {
    parseValue: parseValue,
    getSelect: getSelect,
    getSelectedCommunityContext: getSelectedCommunityContext,
    getSelectedCommunityId: getSelectedCommunityId,
    getSelectedCommunityName: getSelectedCommunityName,
    syncSelectedCommunityStorage: syncSelectedCommunityStorage,
    normalizeSelectOptions: normalizeSelectOptions
  };
  window.getSelectedCommunityId = window.getSelectedCommunityId || getSelectedCommunityId;
  window.getSelectedCommunityName = window.getSelectedCommunityName || getSelectedCommunityName;
})();
