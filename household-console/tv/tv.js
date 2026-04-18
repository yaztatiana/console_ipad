(function () {
  "use strict";

  var HC = window.HouseholdCalendar;
  var HS = window.HouseholdStore;

  var slides = [];
  var idx = 0;
  var rotateMs = 22000;
  var pollMs = 15000;
  var rotateTimer = null;
  var pollTimer = null;

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
      col.innerHTML =
        '<div class="day__name">' +
        fmtWeekday(d) +
        '</div><div class="day__num">' +
        d.getDate() +
        "</div>";
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
          col.appendChild(evEl);
        });
      week.appendChild(col);
    });
  }

  var weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function renderChores(data) {
    var root = $("#slide-chores .slide__inner");
    if (!root) return;
    root.innerHTML = '<div class="slide__label">Chores</div><div class="chores" id="chores"></div>';
    var box = $("#chores");
    var chores = data.chores || [];
    if (!chores.length) {
      box.innerHTML =
        '<div class="chore"><div>No chores yet.</div><div class="chore__who">Add them from Manage on a phone or iPad.</div></div>';
      return;
    }
    chores.forEach(function (c) {
      var row = document.createElement("div");
      row.className = "chore" + (c.done ? " is-done" : "");
      var t = document.createElement("div");
      t.textContent = c.title || "Chore";
      row.appendChild(t);
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
      row.appendChild(sub);
      box.appendChild(row);
    });
  }

  function renderMeals(data) {
    var root = $("#slide-meals .slide__inner");
    if (!root) return;
    var days = HC.weekDates(new Date());
    var meals = data.meals || {};
    var rows = [
      { key: "breakfast", label: "Breakfast" },
      { key: "lunch", label: "Lunch" },
      { key: "dinner", label: "Dinner" },
    ];
    var html = '<div class="slide__label">Meals this week</div><div class="meals-grid">';
    html += '<div class="corner"></div>';
    days.forEach(function (d) {
      html +=
        '<div class="hd">' +
        fmtWeekday(d) +
        "<br/>" +
        d.getDate() +
        "</div>";
    });
    rows.forEach(function (r) {
      html += '<div class="rowhd">' + r.label + "</div>";
      days.forEach(function (d) {
        var iso = HC.toISODate(d);
        var cell = (meals[iso] && meals[iso][r.key]) || "—";
        html += '<div class="cell">' + escapeHtml(cell) + "</div>";
      });
    });
    html += "</div>";
    root.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderAll() {
    var data = HS.load();
    var name = data.householdName || "Home";
    var ht = $("#houseName");
    if (ht) ht.textContent = name;
    renderCalendar(data);
    renderChores(data);
    renderMeals(data);
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

  function init() {
    slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    setSlide(0);
    armRotate();
    renderAll();
    renderClock();
    setInterval(renderClock, 30 * 1000);
    document.addEventListener("keydown", onKeyDown);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(renderAll, pollMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
