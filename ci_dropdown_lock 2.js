/*
  ZUMMEE_PATCH — Community Inspections selected-community lock
  File: ci_dropdown_lock.js

  Install:
  1) Put this file next to community_inspections.html
  2) Add before </body>:
     <script src="ci_dropdown_lock.js"></script>
*/

(function(){
  if (window.__ZUMMEE_CI_SELECTED_COMMUNITY_LOCK__) return;
  window.__ZUMMEE_CI_SELECTED_COMMUNITY_LOCK__ = true;

  var LOCK_UNTIL = 0;
  var internalWrite = false;
  var lastUserSelectedValue = "";

  function read(key){
    try { return localStorage.getItem(key) || ""; } catch(_e) { return ""; }
  }

  function write(key, value){
    try {
      if (value !== undefined && value !== null && String(value).trim()) {
        localStorage.setItem(key, String(value));
      }
    } catch(_e) {}
  }

  function selectedKey(){
    try {
      return (
        (window.ZUMMEE_KEYS && window.ZUMMEE_KEYS.SELECTED_COMMUNITY_KEY) ||
        window.SELECTED_COMMUNITY_KEY ||
        "zummee_selected_community_v1"
      );
    } catch(_e) {
      return "zummee_selected_community_v1";
    }
  }

  function currentSavedCommunity(){
    return String(
      read(selectedKey()) ||
      read("zummee_selected_community_v1") ||
      read("zummee_selected_community_id") ||
      read("managerHubSelectedCommunityId") ||
      ""
    ).trim();
  }

  function mirrorSelectedCommunity(value, label){
    value = String(value || "").trim();
    label = String(label || "").trim();
    if (!value) return;

    write(selectedKey(), value);
    write("zummee_selected_community_v1", value);
    write("zummee_selected_community_id", value);
    write("managerHubSelectedCommunityId", value);

    if (label) {
      write("zummee_selected_community_name_v1", label);
      write("zummee_selected_community_label_v1", label);
    }

    try {
      window.dispatchEvent(new CustomEvent("zummee:selected-community-updated", {
        detail: {
          page: "community_inspections",
          communityId: value,
          communityName: label || "",
          source: "ci_dropdown_lock"
        }
      }));
    } catch(_e) {}
  }

  function normalizeText(value){
    return String(value || "").trim().toLowerCase();
  }

  function findDropdown(){
    return (
      document.getElementById("zummeeCommunitySelect") ||
      document.getElementById("communitySelect") ||
      document.getElementById("communityDropdown") ||
      document.querySelector('select[name="communityId"]') ||
      document.querySelector('select[name="community"]') ||
      document.querySelector('select[id*="community" i]') ||
      null
    );
  }

  function getSelectedLabel(select){
    try {
      var option = select.options[select.selectedIndex];
      return option ? String(option.textContent || option.label || "").trim() : "";
    } catch(_e) {
      return "";
    }
  }

  function findOption(select, saved){
    if (!select || !saved) return null;

    var target = String(saved || "").trim();
    var targetNorm = normalizeText(target);
    var options = Array.prototype.slice.call(select.options || []);

    return options.find(function(option){
      return String(option.value || "").trim() === target;
    }) || options.find(function(option){
      return normalizeText(option.textContent) === targetNorm;
    }) || options.find(function(option){
      return normalizeText(option.getAttribute("data-community-name")) === targetNorm;
    }) || null;
  }

  function syncHiddenCommunityFields(value, label){
    value = String(value || "").trim();
    label = String(label || "").trim();

    [
      'input[name="community_id"]',
      'input[name="communityId"]',
      'input[id="community_id"]',
      'input[id="communityId"]',
      'input[name="community_name"]',
      'input[name="communityName"]',
      'input[id="community_name"]',
      'input[id="communityName"]'
    ].forEach(function(selector){
      var input = document.querySelector(selector);
      if (!input) return;

      var key = String(input.name || input.id || "").toLowerCase();
      input.value = key.indexOf("name") >= 0 ? (label || value) : value;
    });
  }

  function restoreSavedSelection(reason, fireChange){
    var select = findDropdown();
    if (!select || !select.options || !select.options.length) return false;

    var saved = lastUserSelectedValue || currentSavedCommunity();

    if (!saved) {
      if (select.value) {
        mirrorSelectedCommunity(select.value, getSelectedLabel(select));
      }
      return false;
    }

    var match = findOption(select, saved);
    if (!match) return false;

    var targetValue = String(match.value || "").trim();
    var targetLabel = String(match.textContent || match.label || "").trim();

    if (String(select.value || "").trim() !== targetValue) {
      internalWrite = true;
      select.value = targetValue;
      syncHiddenCommunityFields(targetValue, targetLabel);
      internalWrite = false;

      if (fireChange) {
        try {
          select.dispatchEvent(new Event("input", { bubbles: true }));
          select.dispatchEvent(new Event("change", { bubbles: true }));
        } catch(_e) {}
      }
    } else {
      syncHiddenCommunityFields(targetValue, targetLabel);
    }

    mirrorSelectedCommunity(targetValue, targetLabel);
    return true;
  }

  function lockFor(ms){
    LOCK_UNTIL = Math.max(LOCK_UNTIL, Date.now() + (ms || 4500));
  }

  function bindDropdown(){
    var select = findDropdown();
    if (!select || select.__zummeeCiDropdownLockBound) return;

    select.__zummeeCiDropdownLockBound = true;

    select.addEventListener("change", function(){
      if (internalWrite) return;

      var value = String(select.value || "").trim();
      var label = getSelectedLabel(select);

      if (!value) return;

      lastUserSelectedValue = value;
      mirrorSelectedCommunity(value, label);
      syncHiddenCommunityFields(value, label);

      lockFor(5000);

      setTimeout(function(){ restoreSavedSelection("post-change-100", false); }, 100);
      setTimeout(function(){ restoreSavedSelection("post-change-500", true); }, 500);
      setTimeout(function(){ restoreSavedSelection("post-change-1500", true); }, 1500);
      setTimeout(function(){ restoreSavedSelection("post-change-3200", true); }, 3200);
    }, true);
  }

  function tick(){
    bindDropdown();
    restoreSavedSelection("tick", false);

    var select = findDropdown();
    if (!select || !lastUserSelectedValue || Date.now() >= LOCK_UNTIL) return;

    var match = findOption(select, lastUserSelectedValue);
    if (match && String(select.value || "").trim() !== String(match.value || "").trim()) {
      restoreSavedSelection("overwrite-guard", true);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){
      bindDropdown();
      setTimeout(function(){ restoreSavedSelection("dom-ready", false); }, 0);
      setTimeout(function(){ restoreSavedSelection("dom-ready-late", false); }, 350);
    });
  } else {
    bindDropdown();
    setTimeout(function(){ restoreSavedSelection("already-ready", false); }, 0);
    setTimeout(function(){ restoreSavedSelection("already-ready-late", false); }, 350);
  }

  window.addEventListener("load", function(){
    bindDropdown();
    restoreSavedSelection("window-load", false);
  });

  try {
    var observer = new MutationObserver(function(){
      bindDropdown();
      restoreSavedSelection("mutation", false);
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "selected"]
    });
  } catch(_e) {}

  var started = Date.now();
  var timer = setInterval(function(){
    tick();
    if (Date.now() - started > 9000) clearInterval(timer);
  }, 250);

  window.ZummeeCommunityInspectionsSelectionLock = {
    restore: function(){
      lockFor(2500);
      return restoreSavedSelection("manual", true);
    },
    currentSavedCommunity: currentSavedCommunity
  };
})();
