
    (function(){
      try{
        var activeId = String(localStorage.getItem('zummeeActiveCommunityId') || localStorage.getItem('activeCommunityId') || localStorage.getItem('currentCommunityId') || localStorage.getItem('zummee_selected_community_id') || '').trim();
        var activeName = String(localStorage.getItem('currentCommunityName') || localStorage.getItem('zummeeCurrentCommunityName') || '').trim();
        var zip = '';
        if(activeId){
          zip = String(localStorage.getItem('mh2-weather-zip:' + activeId) || '').trim();
        }
        if(!zip){
          zip = String(localStorage.getItem('mh2-last-weather-zip') || '').trim();
        }
        window.__mh2BootWeather = { communityId:activeId, communityName:activeName, zip:zip };
      }catch(_e){
        window.__mh2BootWeather = { communityId:'', communityName:'', zip:'' };
      }
    })();
  