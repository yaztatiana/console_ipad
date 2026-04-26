(function (global) {
  "use strict";

  var STORAGE_KEY = "dashboard-console-v1";

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function defaultData() {
    return {
      version: 1,
      settings: {
        title: "Home dashboard",
        rotationMs: 15000,
      },
      slides: [
        { id: uid(), title: "Slide 1", body: "Welcome. Edit this on the management page." },
        { id: uid(), title: "Slide 2", body: "Connect Supabase so TV and browser stay in sync." },
        { id: uid(), title: "Slide 3", body: "Use Left / Right on the Fire TV remote to change slides." },
        { id: uid(), title: "Slide 4", body: "Open Management in a desktop browser to update settings." },
      ],
    };
  }

  function ensureFourSlides(data) {
    if (!data || typeof data !== "object") return defaultData();
    if (!Array.isArray(data.slides)) data.slides = [];
    while (data.slides.length < 4) {
      data.slides.push({
        id: uid(),
        title: "Slide " + (data.slides.length + 1),
        body: "",
      });
    }
    if (data.slides.length > 4) data.slides = data.slides.slice(0, 4);
    data.slides = data.slides.map(function (s, i) {
      if (!s || typeof s !== "object") {
        return { id: uid(), title: "Slide " + (i + 1), body: "" };
      }
      return {
        id: s.id || uid(),
        title: String(s.title || "Slide " + (i + 1)),
        body: String(s.body || ""),
      };
    });
    if (!data.settings || typeof data.settings !== "object") data.settings = defaultData().settings;
    data.settings.title = String(data.settings.title || "Home dashboard");
    var rot = Number(data.settings.rotationMs);
    data.settings.rotationMs = rot >= 3000 && rot <= 120000 ? rot : 15000;
    data.version = 1;
    return data;
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return ensureFourSlides(defaultData());
      var data = JSON.parse(raw);
      return ensureFourSlides(data);
    } catch (e) {
      return ensureFourSlides(defaultData());
    }
  }

  function save(data) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureFourSlides(data)));
  }

  function exportJson(data) {
    return JSON.stringify(ensureFourSlides(data), null, 2);
  }

  function importJson(text) {
    var data = JSON.parse(text);
    save(ensureFourSlides(data));
    return load();
  }

  function isValidPayload(o) {
    return !!(o && typeof o === "object" && Array.isArray(o.slides) && o.slides.length === 4);
  }

  global.DashboardStore = {
    STORAGE_KEY: STORAGE_KEY,
    load: load,
    save: save,
    exportJson: exportJson,
    importJson: importJson,
    isValidPayload: isValidPayload,
    ensureFourSlides: ensureFourSlides,
    defaultData: defaultData,
  };
})(window);
