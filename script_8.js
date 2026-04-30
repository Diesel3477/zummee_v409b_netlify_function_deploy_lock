
(function(){
  function mh2SafeBoot(){
    try{
      if (typeof renderCommunities === 'function') {
        renderCommunities().then(function(){
          try{
            if (typeof bootstrapCommunityGlobals === 'function') bootstrapCommunityGlobals();
            if (typeof loadBrandLogo === 'function') loadBrandLogo();
            if (typeof loadWeatherHub === 'function') loadWeatherHub();
          }catch(_e){}
        }).catch(function(err){
          console.error('[MH2] renderCommunities boot failed', err);
        });
      } else {
        console.warn('[MH2] renderCommunities is not available at boot');
      }
    }catch(err){
      console.error('[MH2] safe boot failed', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mh2SafeBoot, { once:true });
  } else {
    mh2SafeBoot();
  }
})();
