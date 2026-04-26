(function (global) {
  "use strict";

  var CONFIG_PATH = "sync-config.json";
  var SYNC_KEY_LS = "household-sync-key-v1";

  var cfg = null;
  var initPromise = null;

  function scriptDir() {
    var scripts = document.getElementsByTagName("script");
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (!s.src) continue;
      if (!/\/sync\.js([?#]|$)/.test(s.src)) continue;
      return s.src.replace(/\/sync\.js(\?.*)?$/, "/");
    }
    return "./shared/";
  }

  function loadConfig() {
    if (initPromise) return initPromise;
    initPromise = fetch(new URL(CONFIG_PATH, scriptDir()).href, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .then(function (j) {
        if (!j || !j.supabaseUrl || !j.supabaseAnonKey) return null;
        cfg = {
          url: String(j.supabaseUrl).replace(/\/$/, ""),
          anonKey: String(j.supabaseAnonKey),
        };
        return cfg;
      })
      .catch(function () {
        return null;
      });
    return initPromise;
  }

  function headers() {
    return {
      apikey: cfg.anonKey,
      Authorization: "Bearer " + cfg.anonKey,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
  }

  function rpc(name, body, prefer) {
    var h = headers();
    if (prefer) h.Prefer = prefer;
    return fetch(cfg.url + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error(t || res.statusText);
        });
      }
      if (res.status === 204) return null;
      var ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) return null;
      return res.json();
    });
  }

  function getLocalSyncKey() {
    try {
      return global.localStorage.getItem(SYNC_KEY_LS) || "";
    } catch (e) {
      return "";
    }
  }

  function setLocalSyncKey(k) {
    try {
      if (!k) global.localStorage.removeItem(SYNC_KEY_LS);
      else global.localStorage.setItem(SYNC_KEY_LS, k);
    } catch (e) {}
  }

  function generateSyncKey() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "hk-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 14);
  }

  /** @returns {Promise<object|null>} payload or null */
  function pull(k) {
    return loadConfig().then(function (c) {
      if (!c || !k) return null;
      return rpc("household_pull", { k: k }, "return=representation").then(function (raw) {
        if (raw == null) return null;
        if (Array.isArray(raw)) {
          if (!raw.length) return null;
          var row = raw[0];
          if (row && Object.prototype.hasOwnProperty.call(row, "household_pull")) {
            return row.household_pull;
          }
          return row;
        }
        if (typeof raw === "object" && Object.prototype.hasOwnProperty.call(raw, "household_pull")) {
          return raw.household_pull;
        }
        return raw;
      });
    });
  }

  function push(k, payload) {
    return loadConfig().then(function (c) {
      if (!c || !k) return Promise.reject(new Error("Sync not configured or missing key"));
      return rpc("household_push", { k: k, p: payload }, "return=minimal").then(function () {
        return true;
      });
    });
  }

  function isConfigured() {
    return !!cfg;
  }

  function ready() {
    return loadConfig().then(function (c) {
      return !!c;
    });
  }

  global.HouseholdSync = {
    loadConfig: loadConfig,
    ready: ready,
    isConfigured: isConfigured,
    pull: pull,
    push: push,
    getLocalSyncKey: getLocalSyncKey,
    setLocalSyncKey: setLocalSyncKey,
    generateSyncKey: generateSyncKey,
  };
})(window);
