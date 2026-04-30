
    window.addEventListener('DOMContentLoaded', function(){
      try{
        if (typeof renderWeatherEmptyState === 'function') {
          var boot = window.__mh2BootWeather || {};
          renderWeatherEmptyState(boot.communityName || 'Weather', 'Loading live weather…');
        }
      }catch(_e){}
      setTimeout(function(){
        if (typeof refreshAll === 'function') refreshAll();
      }, 120);
    });

    window.addEventListener('load', function(){
      try{
        if (typeof refreshAll === 'function') {
          window.refreshAll = refreshAll;
          window.renderWeatherModel = renderWeatherModel;
          window.renderWeatherEmptyState = renderWeatherEmptyState;
          window.loadWeatherHub = loadWeatherHub;
        }
      }catch(_e){}
    });
  