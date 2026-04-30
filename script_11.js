
document.addEventListener('DOMContentLoaded', async function(){
  try{
    if (typeof renderCommunities === 'function') {
      await renderCommunities();
    }
    var select = document.getElementById('zummeeCommunitySelect');
    if (select && select.value) {
      try{
        select.dispatchEvent(new Event('change', { bubbles:true }));
      }catch(_e){
        var ev = document.createEvent('Event');
        ev.initEvent('change', true, true);
        select.dispatchEvent(ev);
      }
    }
  }catch(err){
    console.warn('[MH2] initial community dispatch failed', err);
  }
});
