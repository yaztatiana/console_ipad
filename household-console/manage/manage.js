(function () {
  "use strict";

  (function installFatalHandler() {
    function setStatus(kind, text) {
      var el = document.getElementById("js-status");
      if (!el) return;
      el.className = "js-status js-status--" + kind;
      el.textContent = text || "";
    }
    window.addEventListener("error", function (e) {
      var msg = e && e.message ? String(e.message) : "Unknown error";
      setStatus("err", "JS error:\n" + msg);
    });
    window.addEventListener("unhandledrejection", function (e) {
      var r = e && e.reason ? e.reason : null;
      var msg = r && r.message ? String(r.message) : String(r || "Unknown rejection");
      setStatus("err", "JS rejected:\n" + msg);
    });
    setStatus("ok", "Manage JS loaded");
  })();

  var HC = window.HouseholdCalendar;
  var HS = window.HouseholdStore;
  var HSync = window.HouseholdSync;
  var pushTimer = null;

  /** Representative points for TV weather (Open-Meteo). Not a full TZ database — good enough for forecast. */
  var WEATHER_PRESETS = [
    { id: "us-hawaii", label: "Hawaii", lat: 21.3069, lon: -157.8583 },
    { id: "us-alaska", label: "Alaska (Anchorage area)", lat: 61.2181, lon: -149.9003 },
    { id: "us-pacific", label: "Pacific — US West Coast", lat: 37.7749, lon: -122.4194 },
    { id: "us-mountain", label: "Mountain — Denver area", lat: 39.7392, lon: -104.9903 },
    { id: "us-arizona", label: "Arizona (Phoenix area)", lat: 33.4484, lon: -112.074 },
    { id: "us-central", label: "Central — Chicago area", lat: 41.8781, lon: -87.6298 },
    { id: "us-eastern", label: "Eastern — NYC area", lat: 40.7128, lon: -74.006 },
    { id: "americas-atlantic", label: "Atlantic / Eastern Caribbean", lat: 25.7617, lon: -80.1918 },
    { id: "eu-uk", label: "UK / Ireland", lat: 51.5074, lon: -0.1278 },
    { id: "eu-central", label: "Central Europe (Munich area)", lat: 48.1351, lon: 11.582 },
    { id: "eu-west", label: "Western Europe (Paris)", lat: 48.8566, lon: 2.3522 },
    { id: "asia-tokyo", label: "Japan (Tokyo area)", lat: 35.6762, lon: 139.6503 },
    { id: "asia-seoul", label: "Korea (Seoul area)", lat: 37.5665, lon: 126.978 },
    { id: "aus-sydney", label: "Australia — Sydney area", lat: -33.8688, lon: 151.2093 },
    { id: "nz-auckland", label: "New Zealand (Auckland area)", lat: -36.8485, lon: 174.7633 },
    { id: "custom", label: "Custom — latitude / longitude below", lat: null, lon: null },
  ];

  function weatherPresetById(id) {
    for (var i = 0; i < WEATHER_PRESETS.length; i++) {
      if (WEATHER_PRESETS[i].id === id) return WEATHER_PRESETS[i];
    }
    return null;
  }

  function inferWeatherPresetFromLatLon(lat, lon) {
    var bestId = "custom";
    var bestD = 64;
    WEATHER_PRESETS.forEach(function (p) {
      if (p.id === "custom" || p.lat == null) return;
      var d =
        (p.lat - lat) * (p.lat - lat) + (p.lon - lon) * (p.lon - lon);
      if (d < bestD) {
        bestD = d;
        bestId = p.id;
      }
    });
    return bestId;
  }

  function applyWeatherPresetToData(data, presetId) {
    if (!data.weatherLocation || typeof data.weatherLocation !== "object") {
      data.weatherLocation = { lat: 40.7128, lon: -74.006 };
    }
    if (presetId === "custom") {
      data.weatherLocation.preset = "custom";
      return;
    }
    var p = weatherPresetById(presetId);
    if (p && p.lat != null && p.lon != null) {
      data.weatherLocation.lat = p.lat;
      data.weatherLocation.lon = p.lon;
      data.weatherLocation.preset = presetId;
    }
  }

  function updateWeatherCustomVisibility() {
    var block = $("weather-custom-block");
    var sel = $("weather-preset");
    if (!block || !sel) return;
    block.style.display = sel.value === "custom" ? "block" : "none";
  }

  function $(id) {
    return document.getElementById(id);
  }

  /** NodeList#forEach is missing on some TV WebViews; this is safe everywhere. */
  function forEachNode(list, fn) {
    var arr = Array.prototype.slice.call(list || []);
    var i;
    for (i = 0; i < arr.length; i++) fn(arr[i], i);
  }

  function onClick(id, handler) {
    var el = $(id);
    if (!el) return;
    el.addEventListener("click", handler);
  }

  function saveLocalAndSync(data) {
    HS.save(data);
    scheduleCloudPush();
  }

  function scheduleCloudPush() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      pushTimer = null;
      doCloudPush(true);
    }, 1400);
  }

  function doCloudPush(silent) {
    return HSync.ready().then(function (ok) {
      if (!ok) return;
      var k = HSync.getLocalSyncKey();
      if (!k) return;
      var data = HS.load();
      return HSync.push(k, data).then(
        function () {
          if (!silent) toast("Pushed to cloud", "ok");
          updateSyncUi();
        },
        function (e) {
          if (!silent) toast("Push failed: " + (e && e.message ? e.message : "error"), "err");
          updateSyncUi();
        }
      );
    });
  }

  function updateSyncUi() {
    var el = $("sync-status");
    if (!el) return;
    HSync.ready().then(function (ok) {
      var k = HSync.getLocalSyncKey();
      if (!ok) {
        el.textContent =
          "Cloud: not configured — add shared/sync-config.json (see example) and redeploy.";
        el.classList.remove("is-live");
        return;
      }
      if (!k) {
        el.textContent = "Cloud: configured — generate or paste a sync key, then save.";
        el.classList.remove("is-live");
        return;
      }
      el.textContent = "Cloud: live · key " + k.slice(0, 8) + "… (last write wins)";
      el.classList.add("is-live");
    });
  }

  function toast(msg, kind) {
    var el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.className = "toast is-on " + (kind || "");
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(function () {
      el.classList.remove("is-on");
    }, 2400);
  }

  function refreshMemberSelects() {
    var data = HS.load();
    var sel = $("ch-assign");
    if (!sel) return;
    sel.innerHTML = "";
    var o0 = document.createElement("option");
    o0.value = "";
    o0.textContent = "Anyone";
    sel.appendChild(o0);
    (data.members || []).forEach(function (m) {
      var o = document.createElement("option");
      o.value = m.id;
      o.textContent = m.name;
      sel.appendChild(o);
    });
  }

  function renderEventMemberChecks() {
    var data = HS.load();
    var box = $("ev-members");
    if (!box) return;
    box.innerHTML = "";
    (data.members || []).forEach(function (m) {
      var id = "mem-" + m.id;
      var lab = document.createElement("label");
      lab.className = "pill";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = m.id;
      cb.id = id;
      lab.appendChild(cb);
      var sp = document.createElement("span");
      sp.textContent = m.name;
      lab.appendChild(sp);
      box.appendChild(lab);
    });
  }

  function renderMembers() {
    var data = HS.load();
    var ul = $("member-list");
    if (!ul) return;
    ul.innerHTML = "";
    (data.members || []).forEach(function (m) {
      var li = document.createElement("li");
      li.className = "item";
      var left = document.createElement("div");
      left.style.display = "flex";
      left.style.alignItems = "center";
      left.style.gap = "0.5rem";
      var sw = document.createElement("span");
      sw.style.width = "14px";
      sw.style.height = "14px";
      sw.style.borderRadius = "999px";
      sw.style.background = m.color || "#888";
      sw.style.border = "1px solid rgba(255,255,255,0.25)";
      var nm = document.createElement("strong");
      nm.textContent = m.name;
      left.appendChild(sw);
      left.appendChild(nm);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "danger";
      btn.textContent = "Remove";
      btn.addEventListener("click", function () {
        data.members = (data.members || []).filter(function (x) {
          return x.id !== m.id;
        });
        data.events = (data.events || []).map(function (ev) {
          ev.memberIds = (ev.memberIds || []).filter(function (id) {
            return id !== m.id;
          });
          return ev;
        });
        data.chores = (data.chores || []).map(function (c) {
          if (c.assigneeId === m.id) c.assigneeId = null;
          return c;
        });
        saveLocalAndSync(data);
        renderAll();
        toast("Member removed", "ok");
      });
      li.appendChild(left);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function toLocalValue(iso) {
    var d = HC.parseISO(iso);
    if (!d) return "";
    var pad = function (n) {
      var s = String(n);
      return s.length < 2 ? "0" + s : s;
    };
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }

  function fromLocalValue(s) {
    if (!s) return null;
    var d = new Date(s);
    var t = d.getTime();
    if (t !== t) return null;
    return d.toISOString();
  }

  function renderEvents() {
    var data = HS.load();
    var ul = $("event-list");
    if (!ul) return;
    ul.innerHTML = "";
    var evs = (data.events || []).slice();
    evs.sort(function (a, b) {
      return String(a.start).localeCompare(String(b.start));
    });
    if (!evs.length) {
      var li0 = document.createElement("li");
      li0.className = "muted";
      li0.textContent = "No events yet.";
      ul.appendChild(li0);
      return;
    }
    evs.forEach(function (ev) {
      var li = document.createElement("li");
      li.className = "item";
      var left = document.createElement("div");
      var t = document.createElement("div");
      var st = document.createElement("strong");
      st.textContent = ev.title || "Event";
      t.appendChild(st);
      var sub = document.createElement("div");
      sub.className = "muted";
      var dt = HC.parseISO(ev.start);
      sub.textContent = dt ? dt.toLocaleString() : "No start time";
      left.appendChild(t);
      left.appendChild(sub);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "danger";
      btn.textContent = "Delete";
      btn.addEventListener("click", function () {
        data.events = (data.events || []).filter(function (x) {
          return x.id !== ev.id;
        });
        saveLocalAndSync(data);
        renderAll();
        toast("Event deleted", "ok");
      });
      li.appendChild(left);
      li.appendChild(btn);
      ul.appendChild(li);
    });
  }

  function ensureShoppingColumns(data) {
    if (!Array.isArray(data.shoppingColumns)) data.shoppingColumns = [[], []];
    while (data.shoppingColumns.length < 2) data.shoppingColumns.push([]);
    data.shoppingColumns = data.shoppingColumns.slice(0, 2);
  }

  function renderShopping() {
    var data = HS.load();
    ensureShoppingColumns(data);
    [0, 1].forEach(function (colIdx) {
      var ul = $("shop-list-" + colIdx);
      if (!ul) return;
      ul.innerHTML = "";
      (data.shoppingColumns[colIdx] || []).forEach(function (item) {
        var li = document.createElement("li");
        li.className = "item shop-item" + (item.checked ? " is-checked" : "");
        var left = document.createElement("div");
        left.className = "shop-item__main";
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!item.checked;
        cb.setAttribute("aria-label", "Got it");
        cb.addEventListener("change", function () {
          item.checked = cb.checked;
          saveLocalAndSync(data);
          renderShopping();
        });
        var sp = document.createElement("span");
        sp.textContent = item.text || "(empty)";
        left.appendChild(cb);
        left.appendChild(sp);
        var del = document.createElement("button");
        del.type = "button";
        del.className = "danger";
        del.textContent = "Remove";
        del.addEventListener("click", function () {
          data.shoppingColumns[colIdx] = (data.shoppingColumns[colIdx] || []).filter(function (x) {
            return x.id !== item.id;
          });
          saveLocalAndSync(data);
          renderShopping();
          toast("Item removed", "ok");
        });
        li.appendChild(left);
        li.appendChild(del);
        ul.appendChild(li);
      });
    });
  }

  function renderChores() {
    var data = HS.load();
    var ul = $("chore-list");
    if (!ul) return;
    ul.innerHTML = "";
    var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    (data.chores || []).forEach(function (c) {
      var li = document.createElement("li");
      li.className = "item";
      var left = document.createElement("div");
      var t = document.createElement("div");
      var st = document.createElement("strong");
      st.textContent = c.title || "Chore";
      t.appendChild(st);
      var sub = document.createElement("div");
      sub.className = "muted";
      var who =
        c.assigneeId && HS.memberById(data, c.assigneeId)
          ? HS.memberById(data, c.assigneeId).name
          : "Anyone";
      var due =
        typeof c.dueWeekday === "number" && c.dueWeekday >= 0 && c.dueWeekday <= 6
          ? names[c.dueWeekday]
          : "Any day";
      sub.textContent = who + " · " + due + (c.done ? " · done" : "");
      left.appendChild(t);
      left.appendChild(sub);
      var row = document.createElement("div");
      row.style.display = "flex";
      row.style.gap = "0.5rem";
      var b1 = document.createElement("button");
      b1.type = "button";
      b1.textContent = c.done ? "Undo" : "Done";
      b1.addEventListener("click", function () {
        c.done = !c.done;
        saveLocalAndSync(data);
        renderAll();
      });
      var b2 = document.createElement("button");
      b2.type = "button";
      b2.className = "danger";
      b2.textContent = "Delete";
      b2.addEventListener("click", function () {
        data.chores = (data.chores || []).filter(function (x) {
          return x.id !== c.id;
        });
        saveLocalAndSync(data);
        renderAll();
        toast("Chore removed", "ok");
      });
      row.appendChild(b1);
      row.appendChild(b2);
      li.appendChild(left);
      li.appendChild(row);
      ul.appendChild(li);
    });
  }

  function buildDinnerEditor() {
    var data = HS.load();
    var root = $("dinner-week");
    if (!root) return;
    root.innerHTML = "";
    var days = HC.weekDates(new Date());
    days.forEach(function (d) {
      var iso = HC.toISODate(d);
      var col = document.createElement("div");
      col.className = "daycol";
      var h = document.createElement("h3");
      h.textContent =
        d.toLocaleDateString(undefined, { weekday: "short" }) + " " + d.getDate();
      col.appendChild(h);
      var lab = document.createElement("label");
      lab.textContent = "Dinner";
      var inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = "Tonight";
      inp.dataset.date = iso;
      inp.dataset.meal = "dinner";
      var cur = (data.meals && data.meals[iso] && data.meals[iso].dinner) || "";
      inp.value = cur;
      col.appendChild(lab);
      col.appendChild(inp);
      var labMsg = document.createElement("label");
      labMsg.textContent = "TV board note";
      labMsg.style.marginTop = "0.45rem";
      var inpMsg = document.createElement("input");
      inpMsg.type = "text";
      inpMsg.placeholder = "Shows on TV calendar week";
      inpMsg.dataset.dayMessage = iso;
      inpMsg.value =
        data.dayMessages && data.dayMessages[iso] ? String(data.dayMessages[iso]) : "";
      col.appendChild(labMsg);
      col.appendChild(inpMsg);
      root.appendChild(col);
    });
  }

  function saveDinnerFromEditor() {
    var data = HS.load();
    if (!data.meals) data.meals = {};
    if (!data.dayMessages || typeof data.dayMessages !== "object") data.dayMessages = {};
    var root = $("dinner-week");
    if (!root) return;
    forEachNode(root.querySelectorAll("input[data-date]"), function (inp) {
      var iso = inp.getAttribute("data-date");
      var meal = inp.getAttribute("data-meal");
      if (!iso || meal !== "dinner") return;
      if (!data.meals[iso]) data.meals[iso] = {};
      var v = String(inp.value || "").trim();
      if (!v) {
        delete data.meals[iso].dinner;
        if (Object.keys(data.meals[iso]).length === 0) delete data.meals[iso];
      } else {
        data.meals[iso].dinner = v;
      }
    });
    forEachNode(root.querySelectorAll("input[data-day-message]"), function (inp) {
      var iso = inp.getAttribute("data-day-message");
      if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
      var v = String(inp.value || "").trim();
      if (!v) delete data.dayMessages[iso];
      else data.dayMessages[iso] = v;
    });
    saveLocalAndSync(data);
    toast("Dinner and TV notes saved", "ok");
  }

  function renderAll() {
    var data = HS.load();
    if (window.HouseholdThemes && data.uiTheme) {
      window.HouseholdThemes.apply(data.uiTheme);
    }
    var hn = $("house-name");
    if (hn) hn.value = data.householdName || "";
    var wp = $("weather-preset");
    if (wp && data.weatherLocation) {
      var pid = data.weatherLocation.preset;
      if (!pid || !weatherPresetById(pid)) {
        pid = inferWeatherPresetFromLatLon(
          Number(data.weatherLocation.lat),
          Number(data.weatherLocation.lon)
        );
      }
      wp.value = pid;
    }
    var wlat = $("weather-lat");
    var wlon = $("weather-lon");
    if (wlat && data.weatherLocation) wlat.value = String(data.weatherLocation.lat);
    if (wlon && data.weatherLocation) wlon.value = String(data.weatherLocation.lon);
    updateWeatherCustomVisibility();
    var ts = $("theme-select");
    if (ts && window.HouseholdThemes && data.uiTheme) {
      ts.value = data.uiTheme;
    }
    var vt = $("vegas-ticker-input");
    if (vt) vt.value = String(data.vegasTickerText || "");
    updateVegasTickerWordCount();
    renderMembers();
    renderEvents();
    renderChores();
    renderShopping();
    renderEventMemberChecks();
    refreshMemberSelects();
    buildDinnerEditor();
    updateSyncUi();
    var boot = $("js-status");
    if (boot && !boot.dataset.appReady) {
      boot.dataset.appReady = "1";
      boot.className = "js-status js-status--ok";
      boot.textContent = "Manage ready.";
      boot.style.visibility = "";
      boot.removeAttribute("aria-hidden");
      if (!boot.dataset.bootHideScheduled) {
        boot.dataset.bootHideScheduled = "1";
        window.setTimeout(function () {
          if (!boot.classList.contains("js-status--err")) {
            boot.style.visibility = "hidden";
            boot.setAttribute("aria-hidden", "true");
          }
        }, 2200);
      }
    }
  }

  function updateVegasTickerWordCount() {
    var el = $("vegas-ticker-input");
    var out = $("vegas-ticker-count");
    if (!el || !out) return;
    var v = String(el.value || "").trim();
    var words = v ? v.split(/\s+/).filter(Boolean) : [];
    out.textContent = words.length + "/150 words";
  }

  function clampVegasTickerTo150Words() {
    var el = $("vegas-ticker-input");
    if (!el) return;
    var raw = String(el.value || "").trim();
    if (!raw) return;
    var words = raw.split(/\s+/).filter(Boolean);
    if (words.length <= 150) return;
    el.value = words.slice(0, 150).join(" ") + " ";
  }

  /**
   * TV / keyboard: ArrowDown/ArrowUp move focus between controls.
   * Select: when collapsed (size 1), click or Enter/Space expands to a listbox; arrows move focus
   * between fields. When expanded, arrows choose options natively; change/blur collapse to size 1.
   */
  function wireArrowFocusNavigation() {
    var root = document.querySelector(".wrap");
    if (!root || root.dataset.arrowNavWired) return;
    root.dataset.arrowNavWired = "1";
    function listFocusables() {
      var sel =
        "button:not([disabled])," +
        "input:not([disabled]):not([type=hidden])," +
        "select:not([disabled])," +
        "textarea:not([disabled])," +
        "a[href]";
      return Array.prototype.slice.call(root.querySelectorAll(sel)).filter(function (n) {
        if (n.tagName === "INPUT" && String(n.getAttribute("type") || "").toLowerCase() === "file") {
          return false;
        }
        var r = n.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
    }
    function collapseSelect(sel) {
      if (!sel || sel.tagName !== "SELECT") return;
      sel.size = 1;
    }
    function expandSelect(sel) {
      if (!sel || sel.tagName !== "SELECT" || sel.disabled) return;
      var n = sel.options.length;
      if (n < 2) return;
      sel.size = Math.min(12, n);
      try {
        sel.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch (err) {
        try {
          sel.scrollIntoView(true);
        } catch (e2) {
          /* ignore */
        }
      }
    }
    function moveRovingFocus(fromEl, dir) {
      var list = listFocusables();
      var idx = -1;
      var i;
      for (i = 0; i < list.length; i++) {
        if (list[i] === fromEl) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return false;
      var next = idx + dir;
      if (next < 0 || next >= list.length) return false;
      var n = list[next];
      var r = n.getBoundingClientRect();
      if (!r.width && !r.height) return false;
      try {
        n.focus({ preventScroll: true });
      } catch (err) {
        n.focus();
      }
      return true;
    }
    root.addEventListener(
      "click",
      function (e) {
        var t = e.target;
        if (!t || t.tagName !== "SELECT" || !root.contains(t) || t.disabled) return;
        if (t.size <= 1) {
          expandSelect(t);
        }
      },
      true
    );
    root.addEventListener(
      "keydown",
      function (e) {
        var el = e.target;
        if (!el || !root.contains(el)) return;
        if (el.tagName === "SELECT" && !el.disabled && el.size <= 1) {
          if (e.key === "Enter" || e.key === " ") {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault();
              expandSelect(el);
            }
            return;
          }
        }
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (el.tagName === "TEXTAREA") return;
        if (el.tagName === "INPUT") {
          var ty = String(el.getAttribute("type") || "text").toLowerCase();
          if (ty === "checkbox" || ty === "radio") return;
        }
        if (el.tagName === "SELECT") {
          if (el.size > 1) return;
          e.preventDefault();
          moveRovingFocus(el, e.key === "ArrowDown" ? 1 : -1);
          return;
        }
        if (moveRovingFocus(el, e.key === "ArrowDown" ? 1 : -1)) {
          e.preventDefault();
        }
      },
      true
    );
    root.addEventListener(
      "change",
      function (e) {
        var t = e.target;
        if (t && t.tagName === "SELECT" && root.contains(t)) collapseSelect(t);
      },
      true
    );
    root.addEventListener(
      "focusout",
      function (e) {
        var t = e.target;
        if (!t || t.tagName !== "SELECT" || !root.contains(t)) return;
        window.setTimeout(function () {
          if (document.activeElement !== t) collapseSelect(t);
        }, 0);
      },
      true
    );
  }

  function wireWeatherUi() {
    var sp = $("weather-preset");
    if (sp && !sp.dataset.wired) {
      sp.dataset.wired = "1";
      sp.innerHTML = "";
      WEATHER_PRESETS.forEach(function (p) {
        var o = document.createElement("option");
        o.value = p.id;
        o.textContent = p.label;
        sp.appendChild(o);
      });
      sp.addEventListener("change", function () {
        var data = HS.load();
        applyWeatherPresetToData(data, sp.value);
        saveLocalAndSync(data);
        updateWeatherCustomVisibility();
      });
    }
    var btn = $("btn-weather-lookup");
    var inp = $("weather-place-search");
    if (btn && inp && !btn.dataset.wired) {
      btn.dataset.wired = "1";
      btn.addEventListener("click", function () {
        var q = String(inp.value || "").trim();
        if (!q) {
          toast("Enter a city or postal code", "err");
          return;
        }
        var url =
          "https://geocoding-api.open-meteo.com/v1/search?name=" +
          encodeURIComponent(q) +
          "&count=1";
        fetch(url)
          .then(function (r) {
            if (!r.ok) throw new Error("lookup");
            return r.json();
          })
          .then(function (j) {
            if (!j.results || !j.results[0]) {
              toast("No place found — try another spelling", "err");
              return;
            }
            var place = j.results[0];
            var data = HS.load();
            if (!data.weatherLocation || typeof data.weatherLocation !== "object") {
              data.weatherLocation = {};
            }
            data.weatherLocation.lat = place.latitude;
            data.weatherLocation.lon = place.longitude;
            data.weatherLocation.preset = "custom";
            saveLocalAndSync(data);
            var psel = $("weather-preset");
            if (psel) psel.value = "custom";
            updateWeatherCustomVisibility();
            renderAll();
            toast("Weather set — " + (place.name || "location"), "ok");
          })
          .catch(function () {
            toast("Look-up failed — check connection", "err");
          });
      });
    }
  }

  function wire() {
    wireArrowFocusNavigation();
    wireWeatherUi();
    var ski = $("sync-key-input");
    if (ski) ski.value = HSync.getLocalSyncKey() || "";

    onClick("btn-gen-sync-key", function () {
      $("sync-key-input").value = HSync.generateSyncKey();
      toast("New key — save it on every device that shares this home", "ok");
    });

    onClick("btn-save-sync-key", function () {
      var v = String($("sync-key-input").value || "").trim();
      if (v.length < 20) {
        toast("Use at least 20 characters (UUID is best)", "err");
        return;
      }
      HSync.setLocalSyncKey(v);
      updateSyncUi();
      toast("Sync key saved on this device", "ok");
    });

    onClick("btn-pull-cloud", function () {
      var k = HSync.getLocalSyncKey() || String($("sync-key-input").value || "").trim();
      if (k.length < 20) {
        toast("Set a sync key first", "err");
        return;
      }
      HSync.pull(k).then(
        function (remote) {
          if (!remote || !HS.isValidPayload(remote)) {
            toast("Nothing in cloud yet — push from Manage first", "err");
            return;
          }
          HS.save(remote);
          HSync.setLocalSyncKey(k);
          if ($("sync-key-input")) $("sync-key-input").value = k;
          renderAll();
          toast("Loaded from cloud", "ok");
        },
        function (e) {
          toast("Pull failed: " + (e && e.message ? e.message : "error"), "err");
        }
      );
    });

    onClick("btn-push-cloud", function () {
      doCloudPush(false);
    });

    onClick("btn-save-house", function () {
      var data = HS.load();
      data.householdName = String($("house-name").value || "").trim() || "Home";
      if ($("vegas-ticker-input")) {
        clampVegasTickerTo150Words();
        data.vegasTickerText = String($("vegas-ticker-input").value || "").trim();
      }
      var pid = $("weather-preset") ? $("weather-preset").value : "us-eastern";
      if (pid === "custom") {
        var lat = parseFloat(String($("weather-lat").value || "").trim());
        var lon = parseFloat(String($("weather-lon").value || "").trim());
        if (!data.weatherLocation || typeof data.weatherLocation !== "object") {
          data.weatherLocation = { lat: 40.7128, lon: -74.006 };
        }
        if (isFinite(lat)) data.weatherLocation.lat = lat;
        if (isFinite(lon)) data.weatherLocation.lon = lon;
        data.weatherLocation.preset = "custom";
      } else {
        applyWeatherPresetToData(data, pid);
      }
      saveLocalAndSync(data);
      toast("Household saved", "ok");
    });

    onClick("btn-add-member", function () {
      var name = String($("member-name").value || "").trim();
      if (!name) {
        toast("Enter a name", "err");
        return;
      }
      var data = HS.load();
      data.members.push({
        id: HS.uid(),
        name: name,
        color: $("member-color").value || "#5b8def",
      });
      saveLocalAndSync(data);
      $("member-name").value = "";
      renderAll();
      toast("Member added", "ok");
      window.setTimeout(function () {
        var people = document.getElementById("people-section");
        var mn = $("member-name");
        if (people) {
          people.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
        if (mn) {
          try {
            mn.focus({ preventScroll: true });
          } catch (e) {
            mn.focus();
          }
        }
      }, 0);
    });

    onClick("btn-add-event", function () {
      var title = String($("ev-title").value || "").trim();
      var start = fromLocalValue($("ev-start").value);
      if (!title || !start) {
        toast("Title and start time required", "err");
        return;
      }
      var end = fromLocalValue($("ev-end").value);
      var ids = [];
      forEachNode(
        $("ev-members").querySelectorAll("input[type=checkbox]:checked"),
        function (cb) {
          ids.push(cb.value);
        }
      );
      var data = HS.load();
      data.events.push({
        id: HS.uid(),
        title: title,
        start: start,
        end: end,
        memberIds: ids,
      });
      saveLocalAndSync(data);
      $("ev-title").value = "";
      $("ev-end").value = "";
      renderAll();
      toast("Event added", "ok");
    });

    onClick("btn-add-chore", function () {
      var title = String($("ch-title").value || "").trim();
      if (!title) {
        toast("Enter a chore title", "err");
        return;
      }
      var data = HS.load();
      var assign = $("ch-assign").value || null;
      var dayRaw = $("ch-day").value;
      var due = dayRaw === "" ? null : Number(dayRaw);
      data.chores.push({
        id: HS.uid(),
        title: title,
        assigneeId: assign,
        dueWeekday: due,
        done: false,
      });
      saveLocalAndSync(data);
      $("ch-title").value = "";
      renderAll();
      toast("Chore added", "ok");
    });

    onClick("btn-save-dinner", saveDinnerFromEditor);

    function wireAddShop(colIdx) {
      var btn = $("btn-add-shop-" + colIdx);
      var inp = $("shop-input-" + colIdx);
      if (!btn || !inp) return;
      btn.addEventListener("click", function () {
        var text = String(inp.value || "").trim();
        if (!text) {
          toast("Enter an item", "err");
          return;
        }
        var data = HS.load();
        ensureShoppingColumns(data);
        data.shoppingColumns[colIdx].push({
          id: HS.uid(),
          text: text,
          checked: false,
        });
        inp.value = "";
        saveLocalAndSync(data);
        renderShopping();
        toast("Added to list " + (colIdx + 1), "ok");
      });
    }
    wireAddShop(0);
    wireAddShop(1);

    onClick("btn-export", function () {
      var data = HS.load();
      var blob = new Blob([HS.exportJson(data)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "household-console-export.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Download started", "ok");
    });

    (function wireThemeSelect() {
      var sel = $("theme-select");
      if (!sel || !window.HouseholdThemes) return;
      sel.innerHTML = "";
      window.HouseholdThemes.ids.forEach(function (id) {
        var o = document.createElement("option");
        o.value = id;
        o.textContent = window.HouseholdThemes.label(id);
        sel.appendChild(o);
      });
      sel.addEventListener("change", function () {
        var id = window.HouseholdThemes.apply(sel.value);
        var data = HS.load();
        data.uiTheme = id;
        saveLocalAndSync(data);
        toast("Theme: " + window.HouseholdThemes.label(id), "ok");
      });
    })();

    (function wireVegasTicker() {
      var el = $("vegas-ticker-input");
      if (!el || el.dataset.wired) return;
      el.dataset.wired = "1";
      el.addEventListener("input", function () {
        clampVegasTickerTo150Words();
        updateVegasTickerWordCount();
      });
      el.addEventListener("blur", function () {
        updateVegasTickerWordCount();
      });
      updateVegasTickerWordCount();
    })();

    var fi = $("file-import");
    if (fi) {
      fi.addEventListener("change", function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            HS.importJson(String(reader.result || ""));
            renderAll();
            scheduleCloudPush();
            toast("Import complete", "ok");
          } catch (err) {
            toast("Import failed", "err");
          } finally {
            e.target.value = "";
          }
        };
        reader.readAsText(f);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      wire();
      renderAll();
    });
  } else {
    wire();
    renderAll();
  }
})();
