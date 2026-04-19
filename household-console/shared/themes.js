(function (win) {
  "use strict";

  var STORAGE_KEY = "household-ui-theme";
  var DEFAULT = "sailor-day";
  var VALID = {
    "sailor-day": 1,
    "academia-night": 1,
    "vegas-street": 1,
  };

  var LABELS = {
    "sailor-day": "Pastel moon (day)",
    "academia-night": "Dark academia (night)",
    "vegas-street": "Vegas street",
  };

  function apply(id) {
    var key = VALID[id] ? id : DEFAULT;
    document.documentElement.setAttribute("data-theme", key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch (e) {}
    return key;
  }

  function current() {
    return document.documentElement.getAttribute("data-theme") || DEFAULT;
  }

  function init() {
    var saved = "";
    try {
      saved = localStorage.getItem(STORAGE_KEY) || "";
    } catch (e) {}
    apply(VALID[saved] ? saved : DEFAULT);
  }

  init();

  function label(id) {
    return LABELS[id] || id;
  }

  win.HouseholdThemes = {
    apply: apply,
    current: current,
    ids: Object.keys(VALID),
    init: init,
    label: label,
    labels: LABELS,
  };
})(window);
