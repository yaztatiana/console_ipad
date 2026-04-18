(function (global) {
  "use strict";

  var STORAGE_KEY = "household-console-v1";

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function defaultData() {
    return {
      version: 1,
      householdName: "Home",
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
    };
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      var data = JSON.parse(raw);
      if (!data || typeof data !== "object") return defaultData();
      if (!Array.isArray(data.members)) data.members = defaultData().members;
      if (!Array.isArray(data.events)) data.events = [];
      if (!Array.isArray(data.chores)) data.chores = [];
      if (!data.meals || typeof data.meals !== "object") data.meals = {};
      if (!data.householdName) data.householdName = "Home";
      return data;
    } catch (e) {
      return defaultData();
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
    save(data);
    return data;
  }

  function memberById(data, id) {
    return (data.members || []).find(function (m) {
      return m.id === id;
    });
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
  };
})(window);
