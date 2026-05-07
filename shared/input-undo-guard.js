/*
  Zummee Global Input Guard
  Build: 2026-05-07-v605-input-undo-guard

  Purpose:
  - Reduce accidental iPad/Safari Undo Typing popups caused by gestures on non-text UI.
  - Prevent selection/edit-history behavior on buttons, cards, table rows, and app chrome.
  - Keep normal typing/selecting inside actual inputs, textareas, and contenteditable fields.

  Note:
  - iPadOS native system "Undo Typing" from shake/three-finger gestures cannot be fully disabled by a website.
  - This file prevents the app from contributing to accidental undo prompts in non-text UI.
*/
(function(){
  if(window.__zummeeInputUndoGuardV601) return;
  window.__zummeeInputUndoGuardV601 = true;

  function isEditable(el){
    if(!el) return false;
    const tag = String(el.tagName || "").toLowerCase();
    if(tag === "input" || tag === "textarea" || tag === "select") return true;
    if(el.isContentEditable) return true;
    try{ return !!el.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'); }catch(_e){}
    return false;
  }

  function isInteractive(el){
    try{
      return !!el.closest('button, a, select, option, input, textarea, [role="button"], [data-allow-select], .allow-text-select');
    }catch(_e){ return false; }
  }

  document.addEventListener("selectstart", function(e){
    if(isEditable(e.target) || isInteractive(e.target)) return;
    e.preventDefault();
  }, { capture:true });

  document.addEventListener("dragstart", function(e){
    if(isEditable(e.target)) return;
    e.preventDefault();
  }, { capture:true });

  document.addEventListener("contextmenu", function(e){
    if(isEditable(e.target)) return;
    // Prevent long-press edit menu on app chrome/cards/buttons.
    if(isInteractive(e.target)){
      e.preventDefault();
    }
  }, { capture:true });

  document.addEventListener("beforeinput", function(e){
    // Block accidental undo/redo commands when focus is not in a real editable field.
    const type = String(e.inputType || "").toLowerCase();
    if((type === "historyundo" || type === "historyredo") && !isEditable(document.activeElement)){
      e.preventDefault();
    }
  }, { capture:true });

  document.addEventListener("keydown", function(e){
    const key = String(e.key || "").toLowerCase();
    const isUndo = (key === "z" && (e.metaKey || e.ctrlKey));
    if(isUndo && !isEditable(document.activeElement)){
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture:true });

  try{
    const style = document.createElement("style");
    style.id = "zummee-input-undo-guard-v601-style";
    style.textContent = `
      button, .btn, [role="button"], .card, .tableWrap, tr, td, th,
      .statusSummaryChip, .pill, .maintenance-native-hub-btn,
      .openRecordBtn, .detailCloseBtn, .detailAssignBtn {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      input, textarea, select, [contenteditable="true"], .allow-text-select, [data-allow-select] {
        -webkit-user-select: text !important;
        user-select: text !important;
        -webkit-touch-callout: default !important;
      }
    `;
    document.head.appendChild(style);
  }catch(_e){}
})();
