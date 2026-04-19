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
    var days = HC.weekDates(new Date());
    var events = data.events || [];
    root.innerHTML =
      '<div class="slide__label">This week</div><div class="week" id="week"></div>';
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
    root.className = "slide__inner slide__inner--split";
    root.innerHTML = "";
    var title = document.createElement("div");
    title.className = "slide__label";
    title.textContent = "Chores & dinner";
    root.appendChild(title);
    var split = document.createElement("div");
    split.className = "chores-dinner-split";
    var left = document.createElement("div");
    left.className = "chores-dinner-split__col chores-dinner-split__col--chores";
    var subL = document.createElement("div");
    subL.className = "chores-dinner-split__sub";
    subL.textContent = "Chores";
    left.appendChild(subL);
    var box = document.createElement("div");
    box.className = "chores";
    box.id = "tv-chores";
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
    left.appendChild(box);
    var right = document.createElement("div");
    right.className = "chores-dinner-split__col chores-dinner-split__col--dinner";
    var subR = document.createElement("div");
    subR.className = "chores-dinner-split__sub";
    subR.textContent = "Dinner this week";
    right.appendChild(subR);
    var days = HC.weekDates(new Date());
    var meals = data.meals || {};
    var grid = document.createElement("div");
    grid.className = "dinner-grid dinner-grid--embed";
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
    right.appendChild(grid);
    split.appendChild(left);
    split.appendChild(right);
    root.appendChild(split);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function updateTodayWeatherEl() {
    var el = $("#today-weather");
    if (!el) return;
    if (weatherState.err) {
      el.textContent = weatherState.err;
      return;
    }
    var j = weatherState.data;
    if (!j || !j.current) {
      el.textContent = "Loading weather…";
      return;
    }
    var cur = j.current;
    var t = cur.temperature_2m;
    var feel = cur.apparent_temperature;
    var desc = wmoDescription(cur.weather_code);
    var big = t != null && !Number.isNaN(Number(t)) ? Math.round(Number(t)) + "°" : "—";
    var feelLine =
      feel != null && !Number.isNaN(Number(feel))
        ? '<div class="today-weather__feel">Feels like ' + Math.round(Number(feel)) + "°</div>"
        : "";
    el.innerHTML =
      '<div class="today-weather__big">' +
      big +
      "</div>" +
      '<div class="today-weather__desc">' +
      escapeHtml(desc) +
      "</div>" +
      feelLine;
  }

  function fetchOpenMeteo(loc) {
    var url =
      "https://api.open-meteo.com/v1/forecast?latitude=" +
      encodeURIComponent(loc.lat) +
      "&longitude=" +
      encodeURIComponent(loc.lon) +
      "&current=temperature_2m,apparent_temperature,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto";
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
      updateTodayWeatherEl();
      return;
    }
    weatherState.err = null;
    if (weatherState.key !== key) {
      weatherState.data = null;
    }
    updateTodayWeatherEl();
    fetchOpenMeteo(loc).then(
      function (j) {
        weatherState.at = Date.now();
        weatherState.key = key;
        weatherState.data = j;
        weatherState.err = null;
        updateTodayWeatherEl();
      },
      function () {
        weatherState.at = Date.now();
        weatherState.key = key;
        weatherState.data = null;
        weatherState.err = "Weather unavailable.";
        updateTodayWeatherEl();
      }
    );
  }

  function renderToday(data) {
    var root = $("#slide-today .slide__inner");
    if (!root) return;
    var today = new Date();
    var todayISO = HC.toISODate(today);
    var head = today.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    var events = (data.events || []).filter(function (ev) {
      var t = HC.parseISO(ev.start);
      return t && HC.sameDay(t, today);
    });
    events.sort(function (a, b) {
      return String(a.start).localeCompare(String(b.start));
    });
    var dinnerStr =
      (data.meals && data.meals[todayISO] && data.meals[todayISO].dinner) || "";
    var wd = today.getDay();
    var choresOpen = (data.chores || []).filter(function (c) {
      return !c.done;
    });
    choresOpen.sort(function (a, b) {
      var da =
        typeof a.dueWeekday === "number" && a.dueWeekday === wd ? 0 : 1;
      var db =
        typeof b.dueWeekday === "number" && b.dueWeekday === wd ? 0 : 1;
      if (da !== db) return da - db;
      return String(a.title || "").localeCompare(String(b.title || ""));
    });
    root.innerHTML =
      '<div class="today-dash">' +
      '<div class="today-dash__head">' +
      escapeHtml(head) +
      "</div>" +
      '<div class="today-dash__grid">' +
      '<div class="today-pane today-pane--weather"><div class="today-pane__label">Weather</div><div id="today-weather" class="today-pane__body">…</div></div>' +
      '<div class="today-pane today-pane--events"><div class="today-pane__label">Today\x27s events</div><div id="today-events" class="today-pane__body"></div></div>' +
      '<div class="today-pane today-pane--dinner"><div class="today-pane__label">Dinner</div><div id="today-dinner" class="today-pane__body"></div></div>' +
      '<div class="today-pane today-pane--chores"><div class="today-pane__label">Chores to do</div><div id="today-chores" class="today-pane__body"></div></div>' +
      "</div></div>";

    var evBox = $("#today-events");
    if (evBox) {
      if (!events.length) {
        evBox.innerHTML = '<div class="today-empty">Nothing on the calendar.</div>';
      } else {
        evBox.innerHTML = events
          .map(function (ev) {
            var t = HC.parseISO(ev.start);
            var timeStr = t ? fmtTime(t) : "";
            var chip = (ev.memberIds && ev.memberIds[0]) || null;
            var col = memberColor(data, chip);
            return (
              '<div class="today-ev" style="--chip:' +
              col +
              '"><strong>' +
              escapeHtml(ev.title || "Event") +
              "</strong>" +
              (timeStr
                ? '<time class="today-ev__time">' + escapeHtml(timeStr) + "</time>"
                : "") +
              "</div>"
            );
          })
          .join("");
      }
    }
    var din = $("#today-dinner");
    if (din) {
      din.innerHTML = dinnerStr
        ? '<div class="today-dinner__line">' + escapeHtml(dinnerStr) + "</div>"
        : '<div class="today-empty">No dinner planned yet.</div>';
    }
    var chBox = $("#today-chores");
    if (chBox) {
      if (!choresOpen.length) {
        chBox.innerHTML = '<div class="today-empty">All caught up.</div>';
      } else {
        chBox.innerHTML = choresOpen
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
              '<div class="today-chore"><div class="today-chore__t">' +
              escapeHtml(c.title || "Chore") +
              '</div><div class="today-chore__m">' +
              escapeHtml(assign + " · due " + due) +
              "</div></div>"
            );
          })
          .join("");
      }
    }
    refreshWeatherIfNeeded(data);
  }

  function renderAll() {
    var data = HS.load();
    if (window.HouseholdThemes && data.uiTheme) {
      window.HouseholdThemes.apply(data.uiTheme);
    }
    var name = data.householdName || "Home";
    var ht = $("#houseName");
    if (ht) ht.textContent = name;
    renderToday(data);
    renderCalendar(data);
    renderChoresAndDinner(data);
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
