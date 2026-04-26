(function (global) {
  "use strict";

  var CONFIG_PATH = "sync-config.json";
  var SYNC_KEY_LS = "dashboard-sync-key-v1";

  var cfg = null;
  var initPromise = null;

  function scriptDir() {
    var scripts = document.getElementsByTagName("script");
    var i;
    for (i = 0; i < scripts.length; i++) {
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
    };
  }

  function rpc(name, body) {
    var h = headers();
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
      if (ct.indexOf("application/json") === -1) return null;
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
    return "key-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function ready() {
    return loadConfig().then(function (c) {
      return !!c;
    });
  }

  function pull(syncKey) {
    return loadConfig().then(function (c) {
      if (!c || !syncKey) return null;
      return rpc("dashboard_pull", { sync_key: String(syncKey) }).then(function (raw) {
        if (raw == null) return null;
        if (Array.isArray(raw)) {
          if (raw.length === 0) return null;
          raw = raw.length === 1 ? raw[0] : raw;
        }
        if (typeof raw === "object" && raw !== null && Object.prototype.hasOwnProperty.call(raw, "dashboard_pull")) {
          return raw.dashboard_pull;
        }
        return raw;
      });
    });
  }

  function push(syncKey, payload) {
    return loadConfig().then(function (c) {
      if (!c || !syncKey) return Promise.reject(new Error("Sync not configured or missing key"));
      return rpc("dashboard_push", {
        sync_key: String(syncKey),
        payload: payload,
      }).then(function () {
        return true;
      });
    });
  }

  global.DashboardSync = {
    loadConfig: loadConfig,
    ready: ready,
    pull: pull,
    push: push,
    getLocalSyncKey: getLocalSyncKey,
    setLocalSyncKey: setLocalSyncKey,
    generateSyncKey: generateSyncKey,
  };
})(window);
