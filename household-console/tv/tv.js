(function () {
  "use strict";

  var DS = window.DashboardStore;
  var SYNC = window.DashboardSync;
  var WX = window.DashboardWeather;
  var idx = 0;
  var pollTimer = null;
  var rotateTimer = null;
  var POLL_MS = 30000;
  var pushTimer = null;
  var clockTimer = null;
  var weatherTimer = null;

  function $(id) {
    return document.getElementById(id);
  }

  function setHint(text) {
    var el = $("sync-hint");
    if (el) el.textContent = text;
  }

  function setBanner(text) {
    var box = $("tv-banner");
    var track = $("tv-banner-track");
    text = String(text || "").trim();
    if (!box || !track) return;
    track.innerHTML = "";
    if (!text) {
      box.classList.remove("is-on");
      return;
    }
    box.classList.add("is-on");
    // Duplicate text to reduce blank gaps during marquee
    var a = el("span", "tv-banner-text", text);
    var b = el("span", "tv-banner-text", text);
    track.appendChild(a);
    track.appendChild(b);
  }

  function formatNow() {
    var data = DS.load();
    var tz = (data.settings && data.settings.timeZone) || "";
    var d = new Date();
    var date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: tz || undefined });
    var time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: tz || undefined });
    return date + " · " + time;
  }

  function updateClock() {
    var elDt = $("tv-datetime");
    if (!elDt) return;
    elDt.textContent = formatNow();
  }

  function maybePushToCloud() {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    pushTimer = window.setTimeout(function () {
      SYNC.ready().then(function (ok) {
        var key = SYNC.getLocalSyncKey();
        if (!ok || !key) return;
        var data = DS.load();
        SYNC.push(key, data)
          .then(function () {
            setHint("Cloud saved");
          })
          .catch(function (err) {
            setHint("Cloud push failed: " + ((err && err.message) || "error"));
          });
      });
    }, 1500);
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null && text !== "") n.textContent = text;
    return n;
  }

  function renderDots() {
    var box = $("dots");
    if (!box) return;
    box.innerHTML = "";
    var i;
    for (i = 0; i < 4; i++) {
      var d = document.createElement("span");
      d.className = "tv-dot" + (i === idx ? " is-on" : "");
      d.setAttribute("aria-hidden", "true");
      box.appendChild(d);
    }
  }

  function setSlide(next) {
    idx = (next % 4 + 4) % 4;
    var i;
    for (i = 0; i < 4; i++) {
      var slideEl = $("slide-" + i);
      if (!slideEl) continue;
      slideEl.classList.toggle("is-active", i === idx);
      slideEl.setAttribute("aria-hidden", i === idx ? "false" : "true");
    }
    renderDots();
    var active = $("slide-" + idx);
    if (active) active.focus({ preventScroll: true });
  }

  function renderMaster(root, s) {
    root.className = "slide-inner slide-master";
    var h = el("h2", "slide-heading", s.heading || "Today & ahead");
    root.appendChild(h);
    var grid = el("div", "master-grid");
    var wx = el("div", "master-weather");
    wx.appendChild(el("div", "master-weather-label", "Today"));
    var tline = el("div", "master-weather-temp", s.weatherToday.temp || "—");
    wx.appendChild(tline);
    wx.appendChild(el("div", "master-weather-condition", s.weatherToday.condition || ""));
    grid.appendChild(wx);
    var fc = el("div", "master-forecast");
    fc.appendChild(el("div", "block-title", "3-day forecast"));
    var i;
    for (i = 0; i < s.forecast.length; i++) {
      var f = s.forecast[i];
      var row = el("div", "forecast-row");
      row.appendChild(el("span", "forecast-day", f.dayLabel || "Day " + (i + 1)));
      var hl = f.high || "—";
      var ll = f.low ? " / " + f.low : "";
      row.appendChild(el("span", "forecast-hi-lo", hl + ll));
      row.appendChild(el("span", "forecast-cond", f.condition || ""));
      fc.appendChild(row);
    }
    grid.appendChild(fc);
    root.appendChild(grid);
    var sch = el("div", "master-schedule");
    sch.appendChild(el("div", "block-title", "Next 3 days"));
    for (i = 0; i < s.scheduleThreeDay.length; i++) {
      var day = s.scheduleThreeDay[i];
      var block = el("div", "schedule-day-block");
      block.appendChild(el("div", "schedule-day-label", day.dateLabel || ""));
      var list = el("ul", "schedule-list");
      var j;
      for (j = 0; j < day.items.length; j++) {
        var it = day.items[j];
        var line = (it.time ? it.time + " · " : "") + (it.text || "");
        if (line) list.appendChild(el("li", "", line));
      }
      if (!list.childNodes.length) list.appendChild(el("li", "muted", "—"));
      block.appendChild(list);
      sch.appendChild(block);
    }
    root.appendChild(sch);
    var ch = el("div", "master-chores");
    ch.appendChild(el("div", "block-title", "Chores today (check off)"));
    var cul = el("ul", "chore-list");
    for (i = 0; i < s.choresToday.length; i++) {
      var c = s.choresToday[i];
      var li = el("li", "chore-item" + (c.done ? " is-done" : ""));
      li.setAttribute("role", "button");
      li.setAttribute("tabindex", "0");
      li.setAttribute("data-chore-id", c.id || "");
      li.appendChild(el("span", "", c.text || "—"));
      li.appendChild(el("span", "chore-chip" + (c.done ? " is-on" : ""), c.done ? "Done" : "To‑do"));
      cul.appendChild(li);
    }
    if (!s.choresToday.length) cul.appendChild(el("li", "muted", "Add chores in Manage."));
    ch.appendChild(cul);
    root.appendChild(ch);
  }

  function renderWeekly(root, s) {
    root.className = "slide-inner slide-weekly";
    root.appendChild(el("h2", "slide-heading", s.heading || "Weekly schedule"));
    var wrap = el("div", "weekly-columns");
    var i;
    for (i = 0; i < s.days.length; i++) {
      var d = s.days[i];
      var col = el("div", "weekly-col");
      col.appendChild(el("div", "weekly-col-head", d.dayLabel || ""));
      var ul = el("ul", "weekly-items");
      var j;
      for (j = 0; j < d.items.length; j++) {
        var it = d.items[j];
        var line = (it.time ? it.time + " " : "") + (it.text || "");
        if (line.trim()) ul.appendChild(el("li", "", line));
      }
      if (!ul.childNodes.length) ul.appendChild(el("li", "muted", "—"));
      col.appendChild(ul);
      wrap.appendChild(col);
    }
    root.appendChild(wrap);
  }

  function renderChores(root, s) {
    root.className = "slide-inner slide-chores";
    root.appendChild(el("h2", "slide-heading", s.heading || "Weekly chores"));
    var table = el("div", "chore-table-wrap");
    var head = el("div", "chore-row chore-head");
    head.appendChild(el("div", "chore-cell chore-name-h", "Chore"));
    var labels = s.dayLabels && s.dayLabels.length === 7 ? s.dayLabels : DS.WEEKDAYS;
    var i;
    for (i = 0; i < 7; i++) {
      head.appendChild(el("div", "chore-cell chore-dow", labels[i] || DS.WEEKDAYS[i]));
    }
    table.appendChild(head);
    for (i = 0; i < s.rows.length; i++) {
      var r = s.rows[i];
      var row = el("div", "chore-row");
      row.appendChild(el("div", "chore-cell chore-name", r.name || "—"));
      var j;
      for (j = 0; j < 7; j++) {
        var done = r.checks && r.checks[j];
        var due = r.days && r.days[j];
        var cell = el("div", "chore-cell chore-mark" + (done ? " is-on" : "") + (due ? " is-due" : ""), done ? "✓" : "");
        cell.setAttribute("role", "button");
        cell.setAttribute("tabindex", "0");
        cell.setAttribute("data-chart-row-id", String(r.id || ""));
        cell.setAttribute("data-chart-dow", String(j));
        row.appendChild(cell);
      }
      table.appendChild(row);
    }
    if (!s.rows.length) {
      var empty = el("p", "muted center-msg", "Add rows in Manage.");
      table.appendChild(empty);
    }
    root.appendChild(table);
  }

  function renderShopping(root, s) {
    root.className = "slide-inner slide-shopping";
    root.appendChild(el("h2", "slide-heading", s.heading || "Shopping"));
    if (s.amazonNote) {
      var note = el("p", "amazon-note", s.amazonNote);
      root.appendChild(note);
    }
    var lists = el("div", "shopping-lists");
    var raw = s.lists || [];
    var i;
    var shown = 0;
    for (i = 0; i < raw.length; i++) {
      var L = raw[i];
      if (!L || typeof L !== "object") continue;
      var hasName = String(L.name || "").trim();
      var hasItems = Array.isArray(L.items) && L.items.length;
      if (!hasName && !hasItems) continue;
      shown++;
      var listId = String(L.id || "");
      var box = el("div", "shopping-list");
      box.appendChild(el("div", "shopping-list-name", L.name || "List"));
      var ul = el("ul", "shopping-items");
      var j;
      for (j = 0; j < L.items.length; j++) {
        var it = L.items[j];
        var li = el("li", "shopping-item" + (it.checked ? " is-checked" : ""), (it.checked ? "[x] " : "[ ] ") + (it.text || ""));
        li.setAttribute("role", "button");
        li.setAttribute("tabindex", "0");
        li.setAttribute("data-shop-list-id", listId);
        li.setAttribute("data-shop-item-id", String(it.id || ""));
        ul.appendChild(li);
      }
      if (!L.items.length) ul.appendChild(el("li", "muted", "—"));
      box.appendChild(ul);
      lists.appendChild(box);
    }
    if (!shown) lists.appendChild(el("p", "muted center-msg", "Add lists in Manage."));
    root.appendChild(lists);
  }

  function renderSlideInto(elSlide, s, index) {
    elSlide.innerHTML = "";
    var inner = el("div", "");
    elSlide.appendChild(inner);
    var kind = s.kind || ["master", "weekly", "chores", "shopping"][index];
    if (kind === "master") renderMaster(inner, s);
    else if (kind === "weekly") renderWeekly(inner, s);
    else if (kind === "chores") renderChores(inner, s);
    else renderShopping(inner, s);
  }

  function renderSlideContent() {
    var data = DS.load();
    if (window.DashboardTheme && window.DashboardTheme.applyFromStore) window.DashboardTheme.applyFromStore();
    var t = $("dash-title");
    if (t) t.textContent = data.settings.title || "Dashboard";
    setBanner(data.settings.bannerMessage || "");
    var i;
    for (i = 0; i < 4; i++) {
      var slideEl = $("slide-" + i);
      if (!slideEl) continue;
      renderSlideInto(slideEl, data.slides[i], i);
    }
  }

  function toggleChoreById(choreId) {
    if (!choreId) return;
    var idStr = String(choreId);
    var data = DS.load();
    var m = data.slides[0];
    var i;
    for (i = 0; i < m.choresToday.length; i++) {
      if (m.choresToday[i].id === choreId) {
        var next = !m.choresToday[i].done;
        m.choresToday[i].done = next;
        if (idStr.indexOf("chart:") !== 0 && Array.isArray(m.oneOffTasks)) {
          var j;
          for (j = 0; j < m.oneOffTasks.length; j++) {
            var ot = m.oneOffTasks[j];
            if (ot && ot.id === choreId) {
              ot.done = next;
              break;
            }
          }
        }
        DS.save(data);
        renderSlideContent();
        maybePushToCloud();
        return;
      }
    }
  }

  function toggleShoppingItem(listId, itemId) {
    if (listId == null || itemId == null) return;
    var lid = String(listId || "");
    var id = String(itemId || "");
    if (!lid || !id) return;
    var data = DS.load();
    var s = data.slides[3];
    if (!s || s.kind !== "shopping" || !Array.isArray(s.lists)) return;
    var li;
    for (li = 0; li < s.lists.length; li++) {
      var L = s.lists[li];
      if (!L || String(L.id || "") !== lid) continue;
      var items = L.items || [];
      var i;
      for (i = 0; i < items.length; i++) {
        if (items[i].id === id) {
          items[i].checked = !items[i].checked;
          DS.save(data);
          renderSlideContent();
          maybePushToCloud();
          return;
        }
      }
      return;
    }
  }

  function toggleChoreChartCell(rowId, dow) {
    var rid = String(rowId || "");
    var j = parseInt(String(dow), 10);
    if (!rid) return;
    if (j !== j || j < 0 || j > 6) return;
    var data = DS.load();
    var c = data.slides[2];
    if (!c || c.kind !== "chores" || !Array.isArray(c.rows)) return;
    var i;
    for (i = 0; i < c.rows.length; i++) {
      if (c.rows[i] && c.rows[i].id === rid) {
        if (!Array.isArray(c.rows[i].checks)) c.rows[i].checks = [false, false, false, false, false, false, false];
        c.rows[i].checks[j] = !c.rows[i].checks[j];
        DS.save(data);
        renderSlideContent();
        maybePushToCloud();
        return;
      }
    }
  }

  function closestWithAttr(node, attr) {
    var t = node;
    while (t && t !== document.body) {
      if (t.getAttribute && t.getAttribute(attr)) return t;
      t = t.parentNode;
    }
    return null;
  }

  function focusChartCell(rowId, dow) {
    var rid = String(rowId || "");
    var j = parseInt(String(dow), 10);
    if (!rid) return false;
    if (j !== j || j < 0 || j > 6) return false;
    var sel = '[data-chart-row-id="' + rid.replace(/"/g, '\\"') + '"][data-chart-dow="' + String(j) + '"]';
    var elCell = document.querySelector(sel);
    if (elCell && elCell.focus) {
      elCell.focus({ preventScroll: false });
      return true;
    }
    return false;
  }

  function getChartRowOrder() {
    var nodes = document.querySelectorAll("[data-chart-row-id][data-chart-dow]");
    var seen = {};
    var order = [];
    var i;
    for (i = 0; i < nodes.length; i++) {
      var rid = nodes[i].getAttribute("data-chart-row-id");
      if (!rid || seen[rid]) continue;
      seen[rid] = true;
      order.push(rid);
    }
    return order;
  }

  function moveChartFocus(curRowId, curDow, dRow, dCol) {
    var order = getChartRowOrder();
    if (!order.length) return;
    var rIdx = order.indexOf(String(curRowId || ""));
    if (rIdx < 0) rIdx = 0;
    var dow = parseInt(String(curDow), 10);
    if (dow !== dow) dow = 0;
    var nextR = rIdx + dRow;
    var nextD = dow + dCol;
    if (nextD < 0) {
      nextD = 0;
    } else if (nextD > 6) {
      nextD = 6;
    }
    if (nextR < 0) nextR = 0;
    if (nextR > order.length - 1) nextR = order.length - 1;
    focusChartCell(order[nextR], nextD);
  }

  function onClick(e) {
    var t = e.target;
    while (t && t !== document.body) {
      if (t && t.getAttribute && t.getAttribute("data-chore-id")) {
        toggleChoreById(t.getAttribute("data-chore-id"));
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-shop-item-id")) {
        toggleShoppingItem(t.getAttribute("data-shop-list-id"), t.getAttribute("data-shop-item-id"));
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-chart-row-id")) {
        toggleChoreChartCell(t.getAttribute("data-chart-row-id"), t.getAttribute("data-chart-dow"));
        return;
      }
      t = t.parentNode;
    }
  }

  function onItemKeyDown(e) {
    var k = e.key;
    if (k !== "Enter" && k !== " ") return;
    var t = e.target;
    while (t && t !== document.body) {
      if (t && t.getAttribute && t.getAttribute("data-chore-id")) {
        e.preventDefault();
        toggleChoreById(t.getAttribute("data-chore-id"));
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-shop-item-id")) {
        e.preventDefault();
        toggleShoppingItem(t.getAttribute("data-shop-list-id"), t.getAttribute("data-shop-item-id"));
        return;
      }
      if (t && t.getAttribute && t.getAttribute("data-chart-row-id")) {
        e.preventDefault();
        toggleChoreChartCell(t.getAttribute("data-chart-row-id"), t.getAttribute("data-chart-dow"));
        return;
      }
      t = t.parentNode;
    }
  }

  function armRotate() {
    if (rotateTimer) clearInterval(rotateTimer);
    rotateTimer = null;
    var data = DS.load();
    var sec = Number(data.settings.rotationSec);
    if (sec !== sec || sec < 3) sec = 15;
    if (sec > 120) sec = 120;
    var ms = sec * 1000;
    rotateTimer = window.setInterval(function () {
      setSlide(idx + 1);
    }, ms);
  }

  function pullThenRender(silent) {
    SYNC.ready().then(function (ok) {
      if (!ok || !SYNC.getLocalSyncKey()) {
        renderSlideContent();
        setHint("◀ ▶ Change slide · cloud off (missing config or key)");
        armRotate();
        return;
      }
      var key = SYNC.getLocalSyncKey();
      SYNC.pull(key)
        .then(function (remote) {
          if (remote && DS.isValidPayload(remote)) {
            // Theme is a local display preference; don't let cloud pulls override it.
            try {
              var local = DS.load();
              if (!remote.settings || typeof remote.settings !== "object") remote.settings = {};
              if (local && local.settings && local.settings.themeId) remote.settings.themeId = local.settings.themeId;
            } catch (e) {}
            DS.save(remote);
            if (!silent) setHint("Cloud updated");
          } else if (!silent) {
            setHint("Cloud empty for key");
          }
          renderSlideContent();
          armRotate();
        })
        .catch(function (err) {
          renderSlideContent();
          setHint("Cloud pull failed: " + ((err && err.message) || "error"));
          armRotate();
        });
    });
  }

  function onKeyDown(e) {
    var k = e.key;
    var chartCell = closestWithAttr(document.activeElement, "data-chart-row-id");
    if (chartCell) {
      var rid = chartCell.getAttribute("data-chart-row-id");
      var dow = chartCell.getAttribute("data-chart-dow");
      if (k === "ArrowRight") {
        e.preventDefault();
        moveChartFocus(rid, dow, 0, 1);
        armRotate();
        return;
      } else if (k === "ArrowLeft") {
        e.preventDefault();
        moveChartFocus(rid, dow, 0, -1);
        armRotate();
        return;
      } else if (k === "ArrowDown") {
        e.preventDefault();
        moveChartFocus(rid, dow, 1, 0);
        armRotate();
        return;
      } else if (k === "ArrowUp") {
        e.preventDefault();
        moveChartFocus(rid, dow, -1, 0);
        armRotate();
        return;
      }
    }
    if (k === "ArrowRight" || k === "PageDown") {
      e.preventDefault();
      setSlide(idx + 1);
      armRotate();
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      setSlide(idx - 1);
      armRotate();
    } else if (k === "Home") {
      e.preventDefault();
      setSlide(0);
      armRotate();
    }
  }

  function init() {
    renderSlideContent();
    setSlide(0);
    pullThenRender(false);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = window.setInterval(function () {
      pullThenRender(true);
    }, POLL_MS);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onItemKeyDown);
    updateClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = window.setInterval(updateClock, 30000);
    if (WX && WX.syncOnce) {
      WX.syncOnce().then(function () {
        renderSlideContent();
      });
      if (weatherTimer) clearInterval(weatherTimer);
      weatherTimer = window.setInterval(function () {
        WX.syncOnce().then(function (ok) {
          if (ok) renderSlideContent();
        });
      }, 30 * 60 * 1000);
    }
    armRotate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
