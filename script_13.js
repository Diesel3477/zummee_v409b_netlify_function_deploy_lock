
(function(){
  const btn = document.getElementById('mh2ThemeToggleBtn');
  if (!btn) return;

  function syncThemeBtn(){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                   document.documentElement.classList.contains('dark-mode');
    btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    btn.textContent = isDark ? 'Light mode' : 'Dark mode';
  }

  syncThemeBtn();
  window.addEventListener('focus', syncThemeBtn);
  document.addEventListener('visibilitychange', syncThemeBtn);
  btn.addEventListener('click', function(){
    setTimeout(syncThemeBtn, 0);
    setTimeout(syncThemeBtn, 150);
  });
})();
