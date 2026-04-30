
(function(){
  var mh2LightningTimer = null;

  function stopLightning(hero){
    if(mh2LightningTimer){
      clearTimeout(mh2LightningTimer);
      mh2LightningTimer = null;
    }
    if(hero) hero.classList.remove('flash');
  }

  function scheduleLightning(hero){
    stopLightning(hero);
    if(!hero || !hero.classList.contains('wx-thunder')) return;

    function flashLoop(){
      if(!hero || !hero.classList.contains('wx-thunder')) return;
      if(Math.random() < 0.25){
        hero.classList.add('flash');
        setTimeout(function(){
          if(hero) hero.classList.remove('flash');
        }, 120 + Math.random() * 120);
      }
      mh2LightningTimer = setTimeout(flashLoop, 2000 + Math.random() * 3000);
    }

    mh2LightningTimer = setTimeout(flashLoop, 1200);
  }

  var prevRenderWeatherModel = window.renderWeatherModel;
  window.renderWeatherModel = function(){
    var result = prevRenderWeatherModel && prevRenderWeatherModel.apply(this, arguments);
    try{
      var hero = document.getElementById('weatherHeroCard') || document.querySelector('.mh2-weather-hero');
      if(hero && hero.classList.contains('wx-thunder')){
        scheduleLightning(hero);
      }else{
        stopLightning(hero);
      }
    }catch(_e){}
    return result;
  };

  window.addEventListener('beforeunload', function(){
    stopLightning(document.getElementById('weatherHeroCard') || document.querySelector('.mh2-weather-hero'));
  });
})();
