/*
  Zummee Global Input / Undo Guard
  Build: 2026-05-07-v615-stronger-ipad-undo-guard

  Purpose:
  - Reduce accidental iPadOS/Safari "Undo Typing" prompts caused by app chrome,
    cards, buttons, non-text controls, long-press selection, or three-finger/gesture side effects.
  - Keep normal typing and editing available inside actual text fields.

  Important:
  - iPadOS native Undo Typing from system shake / three-finger gestures cannot be fully disabled by any website.
  - This file prevents Zummee's non-text UI from contributing to that prompt.
*/
(function(){
  if(window.__zummeeInputUndoGuardV615) return;
  window.__zummeeInputUndoGuardV615 = true;

  function closest(el, selector){
    try{ return el && el.closest ? el.closest(selector) : null; }catch(_e){ return null; }
  }

  function isEditable(el){
    if(!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    if(tag === "textarea") return true;
    if(tag === "input"){
      const type = String(el.type || "text").toLowerCase();
      return !["button","submit","reset","checkbox","radio","file","range","color","date","datetime-local","month","week","time"].includes(type);
    }
    if(el.isContentEditable) return true;
    return !!closest(el, 'textarea, input[type="text"], input[type="email"], input[type="tel"], input[type="search"], input[type="url"], input[type="password"], input:not([type]), [contenteditable="true"], [contenteditable=""]');
  }

  function isNativeControl(el){
    return !!closest(el, 'select, option, input[type="date"], input[type="datetime-local"], input[type="file"], input[type="checkbox"], input[type="radio"]');
  }

  function isAppChrome(el){
    return !!closest(el, [
      'button',
      'a',
      '[role="button"]',
      '.btn',
      '.card',
      '.hero',
      '.pills',
      '.pill',
      '.metric',
      '.sectionShell',
      '.record',
      '.item',
      '.snap',
      '.snapshot',
      '.tableWrap',
      'tr',
      'td',
      'th',
      '.calendarMini',
      '.calendarEvents',
      '.modalActions',
      '.headerActions',
      '.controls',
      '.maintenance-native-controls'
    ].join(','));
  }

  function cancel(e){
    try{ e.preventDefault(); }catch(_e){}
    try{ e.stopPropagation(); }catch(_e){}
  }

  // Stop accidental text selection/edit menu on non-text UI.
  document.addEventListener("selectstart", function(e){
    if(isEditable(e.target)) return;
    cancel(e);
  }, { capture:true });

  document.addEventListener("dragstart", function(e){
    if(isEditable(e.target)) return;
    cancel(e);
  }, { capture:true });

  // Long press/context menu can trigger edit/undo UI on iPad when the target is app chrome.
  document.addEventListener("contextmenu", function(e){
    if(isEditable(e.target)) return;
    if(isAppChrome(e.target) || isNativeControl(e.target)) cancel(e);
  }, { capture:true });

  // iOS Safari gesture events.
  ["gesturestart","gesturechange","gestureend"].forEach(function(type){
    document.addEventListener(type, function(e){
      if(isEditable(e.target)) return;
      cancel(e);
    }, { capture:true, passive:false });
  });

  // Prevent browser/app undo commands outside real editable fields.
  document.addEventListener("beforeinput", function(e){
    const type = String(e.inputType || "").toLowerCase();
    if(type === "historyundo" || type === "historyredo"){
      if(!isEditable(document.activeElement) && !isEditable(e.target)){
        cancel(e);
      }
    }
  }, { capture:true });

  document.addEventListener("input", function(e){
    // Defensive: if a non-editable area somehow gets an undo/redo input event, stop it.
    const type = String(e.inputType || "").toLowerCase();
    if((type === "historyundo" || type === "historyredo") && !isEditable(e.target)){
      cancel(e);
    }
  }, { capture:true });

  document.addEventListener("keydown", function(e){
    const key = String(e.key || "").toLowerCase();
    const isUndoRedo = (key === "z" && (e.metaKey || e.ctrlKey)) || (key === "y" && (e.metaKey || e.ctrlKey));
    if(isUndoRedo && !isEditable(document.activeElement)){
      cancel(e);
    }
  }, { capture:true });

  // After tapping app chrome, make sure no hidden input remains focused.
  document.addEventListener("pointerdown", function(e){
    if(isEditable(e.target)) return;
    if(isAppChrome(e.target) || isNativeControl(e.target)){
      try{
        const active = document.activeElement;
        if(active && isEditable(active) && typeof active.blur === "function") active.blur();
      }catch(_e){}
    }
  }, { capture:true, passive:true });

  // Touch selection/callout suppression for non-editable UI. Avoid blocking scroll.
  document.addEventListener("touchstart", function(e){
    if(isEditable(e.target)) return;
    if(isAppChrome(e.target) || isNativeControl(e.target)){
      try{
        const active = document.activeElement;
        if(active && isEditable(active) && typeof active.blur === "function") active.blur();
      }catch(_e){}
    }
  }, { capture:true, passive:true });

  try{
    const style = document.createElement("style");
    style.id = "zummee-input-undo-guard-v615-style";
    style.textContent = `
      html, body {
        -webkit-tap-highlight-color: transparent !important;
      }

      body,
      button, a, [role="button"], .btn, .card, .hero, .pills, .pill,
      .metric, .sectionShell, .record, .item, .snap, .snapshot,
      .tableWrap, tr, td, th, .calendarMini, .calendarEvents,
      .modalActions, .headerActions, .controls {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }

      button, a, [role="button"], .btn, .item, .card, .pill {
        touch-action: manipulation !important;
      }

      input, textarea, select, option,
      [contenteditable="true"], [contenteditable=""],
      .allow-text-select, [data-allow-select] {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
    `;
    document.head.appendChild(style);
  }catch(_e){}

  try{ console.info("[Zummee] input undo guard v615 active"); }catch(_e){}
})();
