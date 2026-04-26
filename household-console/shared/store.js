(function (global) {
  "use strict";

  var STORAGE_KEY = "household-console-v1";
  var THEME_IDS = {
    "sailor-moon-prism": 1,
    "academia-night": 1,
    "vegas-street": 1,
  };

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function defaultData() {
    return {
      version: 1,
      householdName: "Home",
      vegasTickerText: "Welcome home, leave a message for us",
      members: [
        { id: uid(), name: "Alex", color: "#5b8def" },
        { id: uid(), name: "Jordan", color: "#6bcf7f" },
      ],
      events: [],
      chores: [
        {
          id: uid(),
          title: "Recycling night",
          assigneeId: null,
          dueWeekday: 3,
          done: false,
        },
      ],
      meals: {},
      dayMessages: {},
      shoppingColumns: [[], []],
      weatherLocation: { lat: 40.7128, lon: -74.006, preset: "us-eastern" },
      uiTheme: "sailor-moon-prism",
    };
  }

  function normalizeHouseholdData(data) {
    if (!data || typeof data !== "object") return data;
    if (typeof data.vegasTickerText !== "string") {
      data.vegasTickerText = "Welcome home, leave a message for us";
    }
    data.vegasTickerText = String(data.vegasTickerText || "").trim();
    if (!data.vegasTickerText) data.vegasTickerText = "Welcome home, leave a message for us";
    if (data.vegasTickerText) {
      var words = data.vegasTickerText.split(/\s+/).filter(Boolean);
      if (words.length > 150) {
        data.vegasTickerText = words.slice(0, 150).join(" ").trim();
      }
    }
    if (!Array.isArray(data.shoppingColumns)) data.shoppingColumns = [[], []];
    while (data.shoppingColumns.length < 2) data.shoppingColumns.push([]);
    data.shoppingColumns = data.shoppingColumns.slice(0, 2).map(function (col) {
      if (!Array.isArray(col)) return [];
      return col.map(function (it) {
        if (!it || typeof it !== "object") return { id: uid(), text: "", checked: false };
        return {
          id: it.id || uid(),
          text: String(it.text || ""),
          checked: !!it.checked,
        };
      });
    });
    if (!data.weatherLocation || typeof data.weatherLocation !== "object") {
      data.weatherLocation = { lat: 40.7128, lon: -74.006, preset: "us-eastern" };
    }
    var lat = Number(data.weatherLocation.lat);
    var lon = Number(data.weatherLocation.lon);
    if (!Number.isFinite(lat)) lat = 40.7128;
    if (!Number.isFinite(lon)) lon = -74.006;
    var preset = data.weatherLocation.preset;
    if (typeof preset !== "string") preset = undefined;
    data.weatherLocation = { lat: lat, lon: lon };
    if (preset) data.weatherLocation.preset = preset;

    if (data.uiTheme === "sailor-day") {
      data.uiTheme = "sailor-moon-prism";
    }
    if (!data.uiTheme || !THEME_IDS[data.uiTheme]) {
      var fromLs = "";
      try {
        fromLs = global.localStorage.getItem("household-ui-theme") || "";
      } catch (e) {}
      data.uiTheme = THEME_IDS[fromLs] ? fromLs : "sailor-moon-prism";
    }

    if (!data.dayMessages || typeof data.dayMessages !== "object") data.dayMessages = {};
    var dm = {};
    Object.keys(data.dayMessages).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
      var t = String(data.dayMessages[k] || "").trim();
      if (t) dm[k] = t;
    });
    data.dayMessages = dm;

    if (!data.meals || typeof data.meals !== "object") data.meals = {};
    Object.keys(data.meals).forEach(function (iso) {
      var m = data.meals[iso];
      if (!m || typeof m !== "object") {
        delete data.meals[iso];
        return;
      }
      var merged =
        String(m.dinner || "").trim() ||
        String(m.lunch || "").trim() ||
        String(m.breakfast || "").trim() ||
        "";
      if (merged) data.meals[iso] = { dinner: merged };
      else delete data.meals[iso];
    });
    return data;
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return normalizeHouseholdData(defaultData());
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return normalizeHouseholdData(defaultData());
      if (!Array.isArray(data.members)) data.members = defaultData().members;
      if (!Array.isArray(data.events)) data.events = [];
      if (!Array.isArray(data.chores)) data.chores = [];
      if (!data.householdName) data.householdName = "Home";
      return normalizeHouseholdData(data);
    } catch (e) {
      return normalizeHouseholdData(defaultData());
    }
  }

  function save(data) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function exportJson(data) {
    return JSON.stringify(data, null, 2);
  }

  function importJson(text) {
    var data = JSON.parse(text);
    if (!data || typeof data !== "object") throw new Error("Invalid file");
    normalizeHouseholdData(data);
    save(data);
    return data;
  }

  function memberById(data, id) {
    var list = data.members || [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === id) return list[i];
    }
    return undefined;
  }

  function isValidPayload(o) {
    return !!(o && typeof o === "object" && Array.isArray(o.members));
  }

  global.HouseholdStore = {
    STORAGE_KEY: STORAGE_KEY,
    uid: uid,
    defaultData: defaultData,
    load: load,
    save: save,
    exportJson: exportJson,
    importJson: importJson,
    memberById: memberById,
    isValidPayload: isValidPayload,
  };
})(window);
