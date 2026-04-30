
window.__MH_VERSION = 'v2_stable';

    (function(){
      try{
        var stored = localStorage.getItem('mh2-theme') || 'light';
        var resolved = stored === 'auto' ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light') : stored;
        document.documentElement.setAttribute('data-theme', resolved);
      }catch(_e){
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
