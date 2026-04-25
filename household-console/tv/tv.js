(function () {
  "use strict";

  var HC = window.HouseholdCalendar;
  var HS = window.HouseholdStore;
  var HSync = window.HouseholdSync;

  var slides = [];
  var idx = 0;
  var rotateMs = 22000;
  var pollMs = 15000;
  var rotateTimer = null;
  var pollTimer = null;
  var weatherState = { at: 0, key: "", data: null, err: null };
  var WEATHER_TTL_MS = 10 * 60 * 1000;

  function $(sel) {
    return document.querySelector(sel);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function hudDateStripHtml(dateLine) {
    return (
      '<header class="hud-date-strip" aria-label="Current date">' +
      '<div class="hud-date-strip__glyph" aria-hidden="true">' +
      '<span class="hud-hatch"></span>' +
      '<span class="hud-date-strip__beam"></span>' +
      "</div>" +
      '<div class="hud-date-strip__text">' +
      '<span class="hud-date-strip__kicker">Date and Day</span>' +
      '<span class="hud-date-strip__value">' +
      escapeHtml(dateLine) +
      "</span>" +
      "</div>" +
      '<div class="hud-date-strip__circuit" aria-hidden="true">' +
      '<span class="hud-circuit__nub"></span>' +
      '<span class="hud-circuit__trace"></span>' +
      '<span class="hud-circuit__nub"></span>' +
      "</div>" +
      "</header>"
    );
  }

  function fmtTime(d) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function fmtWeekday(d) {
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }

  function renderClock() {
    var el = $("#clock");
    if (!el) return;
    el.textContent = new Date().toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function memberColor(data, id) {
    var m = HS.memberById(data, id);
    return m && m.color ? m.color : "#5b8def";
  }

  function renderCalendar(data) {
    var root = $("#slide-calendar .slide__inner");
    if (!root) return;
    var dateLine = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    root.className = "slide__inner slide__inner--hud slide__inner--calendar";
    root.innerHTML =
      '<div class="schedule-hud">' +
      hudDateStripHtml(dateLine) +
      '<div class="schedule-hud__row schedule-hud__row--full">' +
      '<section class="hud-frame hud-frame--schedule hud-frame--calendar-board" aria-label="Calendar week">' +
      '<div class="hud-frame__tri" aria-hidden="true"></div>' +
      '<div class="hud-frame__dots" aria-hidden="true">' +
      "<span></span><span></span><span></span><span></span><span></span>" +
      "</div>" +
      '<h2 class="hud-frame__title">This week</h2>' +
      '<div class="hud-frame__body hud-frame__body--calendar">' +
      '<div class="week week--hud" id="week"></div>' +
      "</div>" +
      '<div class="hud-frame__tab" aria-hidden="true"></div>' +
      "</section>" +
      "</div>" +
      "</div>";
    var days = HC.weekDates(new Date());
    var events = data.events || [];
    var dayMessages =
      data.dayMessages && typeof data.dayMessages === "object" ? data.dayMessages : {};
    var week = $("#week");
    var todayISO = HC.toISODate(new Date());
    days.forEach(function (d) {
      var iso = HC.toISODate(d);
      var col = document.createElement("div");
      col.className = "day" + (iso === todayISO ? " is-today" : "");
      col.innerHTML = '<div class="day__name">' + fmtWeekday(d) + "</div>";
      var stack = document.createElement("div");
      stack.className = "day__stack";
      var numEl = document.createElement("div");
      numEl.className = "day__num";
      numEl.textContent = String(d.getDate());
      stack.appendChild(numEl);
      col.appendChild(stack);
      var dayEvents = events.filter(function (ev) {
        var t = HC.parseISO(ev.start);
        return t && HC.sameDay(t, d);
      });
      dayEvents
        .slice()
        .sort(function (a, b) {
          return String(a.start).localeCompare(String(b.start));
        })
        .forEach(function (ev) {
          var t = HC.parseISO(ev.start);
          var chip = (ev.memberIds && ev.memberIds[0]) || null;
          var evEl = document.createElement("div");
          evEl.className = "ev";
          evEl.style.setProperty("--chip", memberColor(data, chip));
          var title = document.createElement("div");
          title.textContent = ev.title || "Event";
          evEl.appendChild(title);
          if (t) {
            var tm = document.createElement("time");
            tm.textContent = fmtTime(t);
            evEl.appendChild(tm);
          }
          stack.appendChild(evEl);
        });
      var noteText = dayMessages[iso];
      if (noteText && String(noteText).trim()) {
        var msgEl = document.createElement("div");
        msgEl.className = "day__msg";
        msgEl.textContent = String(noteText).trim();
        stack.appendChild(msgEl);
      }
      week.appendChild(col);
    });
  }

  var weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function toggleChoreOnTv(choreId) {
    var data = HS.load();
    var ch = (data.chores || []).find(function (x) {
      return x.id === choreId;
    });
    if (!ch) return;
    ch.done = !ch.done;
    HS.save(data);
    HSync.ready().then(function (ok) {
      if (ok && HSync.getLocalSyncKey()) {
        return HSync.push(HSync.getLocalSyncKey(), data).catch(function () {});
      }
      return null;
    }).then(
      function () {
        renderAll();
      },
      function () {
        renderAll();
      }
    );
  }

  function renderChoresAndDinner(data) {
    var root = $("#slide-chores-dinner .slide__inner");
    if (!root) return;
    var dateLine = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    root.className = "slide__inner slide__inner--hud slide__inner--split";
    root.innerHTML =
      '<div class="schedule-hud">' +
      hudDateStripHtml(dateLine) +
      '<div class="schedule-hud__row schedule-hud__row--split">' +
      '<section class="hud-frame hud-frame--split-tile" aria-label="Chores">' +
      '<h2 class="hud-frame__title">Chores</h2>' +
      '<div class="hud-frame__body"><div class="chores chores--hud" id="tv-chores"></div></div>' +
      "</section>" +
      '<section class="hud-frame hud-frame--split-tile" aria-label="Dinner">' +
      '<h2 class="hud-frame__title">Dinner this week</h2>' +
      '<div class="hud-frame__body"><div class="dinner-grid dinner-grid--embed dinner-grid--hud" id="tv-dinner-grid"></div></div>' +
      "</section>" +
      "</div>" +
      "</div>";
    var box = $("#tv-chores");
    var chores = data.chores || [];
    if (!chores.length) {
      var empty = document.createElement("div");
      empty.className = "chore";
      empty.innerHTML =
        "<div>No chores yet.</div><div class=\"chore__who\">Add them from Manage on a phone or iPad.</div>";
      box.appendChild(empty);
    } else {
      chores.forEach(function (c) {
        var row = document.createElement("div");
        row.className = "chore" + (c.done ? " is-done" : "");
        var main = document.createElement("div");
        main.className = "chore__main";
        var t = document.createElement("div");
        t.textContent = c.title || "Chore";
        main.appendChild(t);
        var sub = document.createElement("div");
        sub.className = "chore__who";
        var assign =
          c.assigneeId && HS.memberById(data, c.assigneeId)
            ? HS.memberById(data, c.assigneeId).name
            : "Anyone";
        var due =
          typeof c.dueWeekday === "number"
            ? weekdayNames[c.dueWeekday] || "Any day"
            : "Any day";
        sub.textContent = assign + " · due " + due + (c.done ? " · done" : "");
        main.appendChild(sub);
        row.appendChild(main);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chore__toggle";
        btn.textContent = c.done ? "Undo" : "Mark done";
        btn.setAttribute("aria-pressed", c.done ? "true" : "false");
        (function (id) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleChoreOnTv(id);
          });
        })(c.id);
        row.appendChild(btn);
        box.appendChild(row);
      });
    }
    var grid = $("#tv-dinner-grid");
    var days = HC.weekDates(new Date());
    var meals = data.meals || {};
    days.forEach(function (d) {
      var hd = document.createElement("div");
      hd.className = "dinner-grid__hd";
      hd.innerHTML = fmtWeekday(d) + "<br/>" + d.getDate();
      grid.appendChild(hd);
    });
    days.forEach(function (d) {
      var iso = HC.toISODate(d);
      var cell = document.createElement("div");
      cell.className = "dinner-grid__cell";
      cell.textContent = (meals[iso] && meals[iso].dinner) || "—";
      grid.appendChild(cell);
    });
  }

  function wmoDescription(code) {
    var c = Number(code);
    if (c === 0) return "Clear sky";
    if (c <= 3) return "Partly cloudy";
    if (c <= 48) return "Foggy";
    if (c <= 57) return "Drizzle";
    if (c <= 67) return "Rain";
    if (c <= 77) return "Snow";
    if (c <= 82) return "Rain showers";
    if (c <= 86) return "Snow showers";
    if (c <= 99) return "Thunderstorm";
    return "Weather";
  }

  function updateScheduleWeatherSlots() {
    document.querySelectorAll(".schedule-day[data-iso]").forEach(function (pane) {
      var slot = pane.querySelector(".schedule-day__weather");
      if (!slot) return;
      var iso = pane.getAttribute("data-iso");
      if (weatherState.err) {
        slot.textContent = weatherState.err;
        return;
      }
      var j = weatherState.data;
      if (!j) {
        slot.innerHTML = '<span class="schedule-day__wx-muted">Loading weather…</span>';
        return;
      }
      var daily = j.daily;
      var times = daily && daily.time;
      var tmax = daily && daily.temperature_2m_max;
      var tmin = daily && daily.temperature_2m_min;
      var codes = daily && daily.weather_code;
      if (!times || !times.length) {
        slot.innerHTML = '<span class="schedule-day__wx-muted">Loading weather…</span>';
        return;
      }
      var idx = times.indexOf(iso);
      if (idx < 0) {
        slot.innerHTML = '<span class="schedule-day__wx-muted">—</span>';
        return;
      }
      var hi = tmax && tmax[idx];
      var lo = tmin && tmin[idx];
      var code = codes && codes[idx];
      var hiStr =
        hi != null && !Number.isNaN(Number(hi)) ? Math.round(Number(hi)) + "°" : "—";
      var loStr =
        lo != null && !Number.isNaN(Number(lo)) ? Math.round(Number(lo)) + "°" : "";
      var line =
        loStr && loStr !== hiStr ? hiStr + " / " + loStr : hiStr;
      var desc = code != null ? wmoDescription(code) : "";
      slot.innerHTML =
        '<div class="schedule-day__wx-temp">' +
        escapeHtml(line) +
        "</div>" +
        (desc
          ? '<div class="schedule-day__wx-desc">' + escapeHtml(desc) + "</div>"
          : "");
    });
  }

  function fetchOpenMeteo(loc) {
    var url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      encodeURIComponent(loc.lat) +
      "&longitude=" +
      encodeURIComponent(loc.lon) +
      "&current=temperature_2m,apparent_temperature,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
      "&forecast_days=7" +
      "&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto";
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("weather");
      return r.json();
    });
  }

  function refreshWeatherIfNeeded(data) {
    var loc = (data && data.weatherLocation) || { lat: 40.7128, lon: -74.006 };
    var key = String(loc.lat) + "," + String(loc.lon);
    var now = Date.now();
    if (
      weatherState.data &&
      weatherState.key === key &&
      now - weatherState.at < WEATHER_TTL_MS
    ) {
      updateScheduleWeatherSlots();
      return;
    }
    weatherState.err = null;
    if (weatherState.key !== key) {
      weatherState.data = null;
    }
    updateScheduleWeatherSlots();
    fetchOpenMeteo(loc).then(
      function (j) {
        weatherState.at = Date.now();
        weatherState.key = key;
        weatherState.data = j;
        weatherState.err = null;
        updateScheduleWeatherSlots();
      },
      function () {
        weatherState.at = Date.now();
        weatherState.key = key;
        weatherState.data = null;
        weatherState.err = "Weather unavailable.";
        updateScheduleWeatherSlots();
      }
    );
  }

  function renderScheduleColumn(data, dayDate, todayISO) {
    var iso = HC.toISODate(dayDate);
    var isTodayCol = iso === todayISO;
    var headLine = dayDate.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    var events = (data.events || [])
      .filter(function (ev) {
        var t = HC.parseISO(ev.start);
        return t && HC.sameDay(t, dayDate);
      })
      .sort(function (a, b) {
        return String(a.start).localeCompare(String(b.start));
      });
    var evHtml = "";
    if (!events.length) {
      evHtml = '<div class="schedule-day__empty">Nothing scheduled.</div>';
    } else {
      evHtml = events
        .map(function (ev) {
          var t = HC.parseISO(ev.start);
          var timeStr = t ? fmtTime(t) : "";
          var chip = (ev.memberIds && ev.memberIds[0]) || null;
          var col = memberColor(data, chip);
          return (
            '<div class="schedule-day__ev" style="--chip:' +
            col +
            '"><span class="schedule-day__ev-title">' +
            escapeHtml(ev.title || "Event") +
            "</span>" +
            (timeStr
              ? '<time class="schedule-day__ev-time">' + escapeHtml(timeStr) + "</time>"
              : "") +
            "</div>"
          );
        })
        .join("");
    }
    return (
      '<div class="schedule-day' +
      (isTodayCol ? " is-today" : "") +
      '" data-iso="' +
      escapeHtml(iso) +
      '">' +
      '<div class="schedule-day__hd">' +
      escapeHtml(headLine) +
      (isTodayCol ? '<span class="schedule-day__badge">Today</span>' : "") +
      "</div>" +
      '<div class="schedule-day__section-h">Weather</div>' +
      '<div class="schedule-day__weather"><span class="schedule-day__wx-muted">Loading weather…</span></div>' +
      '<div class="schedule-day__section-h">Events</div>' +
      '<div class="schedule-day__events">' +
      evHtml +
      "</div>" +
      "</div>"
    );
  }

  function choreSortScore(c, daysThree) {
    if (typeof c.dueWeekday !== "number") return 15;
    var i;
    for (i = 0; i < daysThree.length; i++) {
      if (daysThree[i].getDay() === c.dueWeekday) return i;
    }
    return 30 + c.dueWeekday;
  }

  function renderScheduleChoresSidebar(data, daysThree) {
    var list = (data.chores || []).filter(function (c) {
      return !c.done;
    });
    list.sort(function (a, b) {
      var sa = choreSortScore(a, daysThree);
      var sb = choreSortScore(b, daysThree);
      if (sa !== sb) return sa - sb;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    if (!list.length) {
      return '<div class="schedule-chores-sidebar__empty">All caught up.</div>';
    }
    return list
      .map(function (c) {
        var assign =
          c.assigneeId && HS.memberById(data, c.assigneeId)
            ? HS.memberById(data, c.assigneeId).name
            : "Anyone";
        var due =
          typeof c.dueWeekday === "number"
            ? weekdayNames[c.dueWeekday] || "Any day"
            : "Any day";
        return (
          '<div class="schedule-chores-sidebar__row">' +
          '<span class="schedule-chores-sidebar__t">' +
          escapeHtml(c.title || "Chore") +
          "</span>" +
          '<span class="schedule-chores-sidebar__meta">' +
          escapeHtml(assign + " · " + due) +
          "</span></div>"
        );
      })
      .join("");
  }

  function renderSchedule(data) {
    var root = $("#slide-schedule .slide__inner");
    if (!root) return;
    root.className = "slide__inner slide__inner--hud slide__inner--schedule";
    var anchor = new Date();
    anchor.setHours(12, 0, 0, 0);
    var todayISO = HC.toISODate(new Date());
    var daysThree = [0, 1, 2].map(function (i) {
      return HC.addDays(anchor, i);
    });
    var cols = daysThree.map(function (d) {
      return renderScheduleColumn(data, d, todayISO);
    });
    var dateLine = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    var choresHtml = renderScheduleChoresSidebar(data, daysThree);
    root.innerHTML =
      '<div class="schedule-hud">' +
      hudDateStripHtml(dateLine) +
      '<div class="schedule-hud__row">' +
      '<section class="hud-frame hud-frame--schedule" aria-label="Three day schedule">' +
      '<div class="hud-frame__tri" aria-hidden="true"></div>' +
      '<div class="hud-frame__dots" aria-hidden="true">' +
      "<span></span><span></span><span></span><span></span><span></span>" +
      "</div>" +
      '<h2 class="hud-frame__title">3 day schedule</h2>' +
      '<div class="hud-frame__body schedule-3__cols">' +
      cols.join("") +
      "</div>" +
      '<div class="hud-frame__tab" aria-hidden="true"></div>' +
      "</section>" +
      '<aside class="hud-frame hud-frame--chores" aria-label="Chores">' +
      '<div class="hud-frame__ribs hud-frame__ribs--left" aria-hidden="true"></div>' +
      '<h2 class="hud-frame__title">Chores</h2>' +
      '<div class="hud-frame__body schedule-chores-sidebar">' +
      choresHtml +
      "</div>" +
      '<div class="hud-frame__foot" aria-hidden="true"></div>' +
      "</aside>" +
      "</div>" +
      "</div>";
    refreshWeatherIfNeeded(data);
  }

  function renderShopping(data) {
    var root = $("#slide-shopping .slide__inner");
    if (!root) return;
    var dateLine = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    root.className = "slide__inner slide__inner--hud slide__inner--shopping";
    var cols = data.shoppingColumns || [[], []];
    var labels = ["List 1", "List 2"];
    var parts = [];
    var c;
    for (c = 0; c < 2; c++) {
      var items = cols[c] || [];
      var lines = [];
      var any = false;
      items.forEach(function (it) {
        if (!it) return;
        var tx = String(it.text || "").trim();
        if (!tx) return;
        any = true;
        var ck = it.checked ? " shopping-tv__item--checked" : "";
        lines.push(
          '<li class="shopping-tv__item' +
            ck +
            '"><span class="shopping-tv__check" aria-hidden="true"></span>' +
            escapeHtml(tx) +
            "</li>"
        );
      });
      if (!any) {
        lines.push('<li class="shopping-tv__empty">No items yet</li>');
      }
      parts.push(
        '<div class="shopping-tv__col">' +
          '<div class="shopping-tv__hd">' +
          escapeHtml(labels[c]) +
          "</div>" +
          '<ul class="shopping-tv__list">' +
          lines.join("") +
          "</ul></div>"
      );
    }
    root.innerHTML =
      '<div class="schedule-hud">' +
      hudDateStripHtml(dateLine) +
      '<div class="schedule-hud__row schedule-hud__row--full">' +
      '<section class="hud-frame hud-frame--schedule hud-frame--calendar-board hud-frame--shopping-board" aria-label="Shopping lists">' +
      '<div class="hud-frame__tri" aria-hidden="true"></div>' +
      '<div class="hud-frame__dots" aria-hidden="true">' +
      "<span></span><span></span><span></span><span></span><span></span>" +
      "</div>" +
      '<h2 class="hud-frame__title">Shopping lists</h2>' +
      '<div class="hud-frame__body hud-frame__body--shopping">' +
      '<div class="shopping-tv__grid">' +
      parts.join("") +
      "</div></div>" +
      '<div class="hud-frame__tab" aria-hidden="true"></div>' +
      "</section>" +
      "</div>" +
      "</div>";
  }

  function renderAll() {
    var data = HS.load();
    if (window.HouseholdThemes && data.uiTheme) {
      window.HouseholdThemes.apply(data.uiTheme);
    }
    var name = data.householdName || "Home";
    var ht = $("#houseName");
    if (ht) ht.textContent = name;
    renderVegasTicker(data);
    renderSchedule(data);
    renderCalendar(data);
    renderChoresAndDinner(data);
    renderShopping(data);
  }

  function renderVegasTicker(data) {
    var el = document.getElementById("vegas-ticker-text");
    if (!el) return;
    var isVegas = data && data.uiTheme === "vegas-street";
    var txt = isVegas ? String(data.vegasTickerText || "").trim() : "";
    el.textContent = txt;
    document.body.classList.toggle("has-vegas-ticker", !!txt && isVegas);
  }

  function setSlide(i) {
    idx = (i + slides.length) % slides.length;
    slides.forEach(function (s, j) {
      var on = j === idx;
      s.classList.toggle("is-active", on);
      s.setAttribute("aria-hidden", on ? "false" : "true");
    });
    document.querySelectorAll(".dot").forEach(function (d, j) {
      d.classList.toggle("is-on", j === idx);
    });
    var active = slides[idx];
    if (active && typeof active.focus === "function") {
      try {
        active.focus({ preventScroll: true });
      } catch (e) {
        active.focus();
      }
    }
  }

  function nextSlide(dir) {
    setSlide(idx + (dir > 0 ? 1 : -1));
    armRotate();
  }

  function armRotate() {
    if (rotateTimer) clearTimeout(rotateTimer);
    rotateTimer = setTimeout(function () {
      setSlide(idx + 1);
      armRotate();
    }, rotateMs);
  }

  function onKeyDown(e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown") {
      e.preventDefault();
      nextSlide(1);
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      nextSlide(-1);
    } else if (k === "Home") {
      e.preventDefault();
      setSlide(0);
      armRotate();
    }
  }

  function setSyncHint(text) {
    var el = document.getElementById("sync-hint");
    if (el) el.textContent = text;
  }

  function pullCloudThenRender() {
    HSync.ready().then(function (ok) {
      if (!ok || !HSync.getLocalSyncKey()) {
        renderAll();
        setSyncHint("◀ ▶ remote · local only (add sync-config + key in Manage)");
        return;
      }
      HSync.pull(HSync.getLocalSyncKey()).then(
        function (remote) {
          if (remote && HS.isValidPayload(remote)) HS.save(remote);
          renderAll();
          setSyncHint("◀ ▶ remote · cloud pull active");
        },
        function () {
          renderAll();
          setSyncHint("◀ ▶ remote · cloud unreachable — showing local");
        }
      );
    });
  }

  function init() {
    slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    setSlide(0);
    armRotate();
    pullCloudThenRender();
    renderClock();
    setInterval(renderClock, 30 * 1000);
    document.addEventListener("keydown", onKeyDown);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pullCloudThenRender, pollMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
