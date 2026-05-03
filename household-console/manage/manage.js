(function () {
  "use strict";

  var DS = window.DashboardStore;
  var SYNC = window.DashboardSync;
  var WD = DS.WEEKDAYS;
  var N_CHART_ROWS = 16;
  var N_LISTS = 4;

  function $(id) {
    return document.getElementById(id);
  }

  function uid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function showBanner(kind, text) {
    var b = $("banner");
    if (!b) return;
    b.textContent = text || "";
    b.className = "manage-banner is-on" + (kind === "ok" ? " is-ok" : kind === "err" ? " is-err" : "");
    if (!text) b.classList.remove("is-on");
  }

  function setSyncStatus(text) {
    var s = $("sync-status");
    if (s) s.textContent = text || "";
  }

  function parseScheduleLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        var once = /\s+\[once\]$/i.test(line);
        if (once) line = line.replace(/\s+\[once\]$/i, "").trim();
        var m = line.match(/^(\d{1,2}:\d{2})\s*[-–—·:]\s*(.+)$/);
        if (m) return { time: m[1], text: m[2].trim(), recurring: !once };
        m = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
        if (m) return { time: m[1], text: m[2].trim(), recurring: !once };
        return { time: "", text: line, recurring: !once };
      });
  }

  function formatScheduleLines(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (it) {
        var tail = it.recurring === false ? " [once]" : "";
        if (it.time) return it.time + " — " + (it.text || "") + tail;
        return (it.text || "") + tail;
      })
      .join("\n");
  }

  function dowFromPrefix(word) {
    var w = String(word || "").trim();
    if (!w) return -1;
    var lower = w.toLowerCase();
    var abbrevs = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
    var ai = abbrevs.indexOf(lower.slice(0, 3));
    if (ai >= 0) return ai;
    var full = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    var i;
    for (i = 0; i < full.length; i++) {
      if (full[i].indexOf(lower) === 0) return i;
    }
    return WD.indexOf(w);
  }

  function parseOneOffLines(text, prevTasks) {
    var prevByKey = {};
    if (prevTasks && prevTasks.length) {
      var pi;
      for (pi = 0; pi < prevTasks.length; pi++) {
        var p = prevTasks[pi];
        if (p && String(p.text || "").trim()) {
          prevByKey[String(p.dow) + "\n" + String(p.text || "").trim().toLowerCase()] = p;
        }
      }
    }
    return String(text || "")
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        var m = line.match(/^([A-Za-z]{3,})\s*[·.\-:]\s*(.+)$/);
        if (!m) return null;
        var dow = dowFromPrefix(m[1]);
        if (dow < 0) return null;
        var tx = String(m[2] || "").trim();
        if (!tx) return null;
        var key = String(dow) + "\n" + tx.toLowerCase();
        var prev = prevByKey[key];
        return {
          id: prev && prev.id ? prev.id : uid(),
          text: tx,
          done: !!(prev && prev.done),
          dow: dow,
        };
      })
      .filter(Boolean);
  }

  function formatOneOffTasks(tasks) {
    if (!tasks || !tasks.length) return "";
    return tasks
      .map(function (t) {
        var d = typeof t.dow === "number" && t.dow >= 0 && t.dow <= 6 ? t.dow : 0;
        return WD[d] + " · " + (t.text || "");
      })
      .join("\n");
  }

  function parseShoppingLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean)
      .map(function (line) {
        var checked = /^\[x\]\s*|^\[X\]\s*|^✓\s*/i.test(line);
        var t = line.replace(/^\[x\]\s*|^\[X\]\s*|^✓\s*/i, "").trim();
        return { text: t, checked: checked };
      });
  }

  function formatShoppingItems(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (it) {
        return (it.checked ? "[x] " : "") + (it.text || "");
      })
      .join("\n");
  }

  function pad2(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function icsUnescape(str) {
    return String(str || "")
      .replace(/\\N/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\,/g, ",")
      .replace(/\\\\/g, "\\");
  }

  function icsUnfold(raw) {
    var lines = String(raw || "")
      .replace(/\r\n/g, "\n")
      .split("\n");
    var out = [];
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (i > 0 && (line.charAt(0) === " " || line.charAt(0) === "\t")) {
        out[out.length - 1] += line.substring(1);
      } else {
        out.push(line);
      }
    }
    return out.join("\n");
  }

  function icsLineValue(line) {
    var idx = line.indexOf(":");
    return idx >= 0 ? line.slice(idx + 1) : "";
  }

  function parseIcsDateValue(val) {
    val = String(val || "").replace(/,/g, "").trim();
    if (!val) return null;
    if (/^\d{8}$/.test(val)) {
      var y = +val.slice(0, 4);
      var mo = +val.slice(4, 6) - 1;
      var d = +val.slice(6, 8);
      return new Date(y, mo, d, 12, 0, 0);
    }
    var m = val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
    if (m) {
      if (m[7]) {
        return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
      }
      return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
    }
    return null;
  }

  function parseIcs(text) {
    var body = icsUnfold(text);
    var lines = body.split("\n");
    var events = [];
    var cur = null;
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line) continue;
      if (/^BEGIN:VEVENT/i.test(line)) {
        cur = { summary: "", startVal: "", allDay: false };
        continue;
      }
      if (/^END:VEVENT/i.test(line)) {
        if (cur) {
          var start = parseIcsDateValue(cur.startVal);
          var summary = icsUnescape(cur.summary).trim();
          if (start) {
            events.push({
              summary: summary || "(Event)",
              start: start,
              allDay: cur.allDay,
            });
          }
        }
        cur = null;
        continue;
      }
      if (!cur) continue;
      if (/^SUMMARY/i.test(line)) {
        cur.summary = icsLineValue(line);
      } else if (/^DTSTART/i.test(line)) {
        var dv = icsLineValue(line);
        cur.allDay = /VALUE=DATE/i.test(line) || /^\d{8}$/.test(dv);
        cur.startVal = dv;
      }
    }
    return events;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }

  function sameDay(a, b) {
    return startOfDay(a).getTime() === startOfDay(b).getTime();
  }

  /** Monday = 0 … Sunday = 6 (matches slide 2 columns) */
  function jsDayToWeeklyIndex(jsDay) {
    return jsDay === 0 ? 6 : jsDay - 1;
  }

  function mergeIcsEvents(events, data, opts) {
    var m = data.slides[0];
    var w = data.slides[1];
    var today = startOfDay(new Date());
    var d0 = addDays(today, 0);
    var d1 = addDays(today, 1);
    var d2 = addDays(today, 2);
    var now = new Date();
    var k;
    for (k = 0; k < events.length; k++) {
      var ev = events[k];
      if (!ev.start) continue;
      if (ev.start.getTime() < now.getTime()) continue; // discard past events
      var sd = startOfDay(ev.start);
      var item;
      if (ev.allDay) {
        item = { time: "", text: ev.summary, recurring: true };
      } else {
        item = {
          time: pad2(ev.start.getHours()) + ":" + pad2(ev.start.getMinutes()),
          text: ev.summary,
          recurring: true,
        };
      }
      if (opts.master) {
        var slot = -1;
        if (sameDay(sd, d0)) slot = 0;
        else if (sameDay(sd, d1)) slot = 1;
        else if (sameDay(sd, d2)) slot = 2;
        if (slot >= 0) {
          m.scheduleThreeDay[slot].items = m.scheduleThreeDay[slot].items.concat([item]);
        }
      }
      if (opts.weekly) {
        var wi = jsDayToWeeklyIndex(ev.start.getDay());
        w.days[wi].items = w.days[wi].items.concat([item]);
      }
    }
  }

  function runCalendarImportFromText(text) {
    var evs = parseIcs(text);
    if (!evs.length) {
      showBanner("err", "No events found. Use a valid iCalendar (.ics) export.");
      return;
    }
    var masterOn = $("ics-target-master") && $("ics-target-master").checked;
    var weeklyOn = $("ics-target-weekly") && $("ics-target-weekly").checked;
    if (!masterOn && !weeklyOn) {
      showBanner("err", "Select at least one target: slide 1 (3-day) and/or slide 2 (weekly).");
      return;
    }
    var data = readFormIntoData();
    mergeIcsEvents(evs, data, { master: masterOn, weekly: weeklyOn });
    saveLocal(data);
    showBanner("ok", "Imported " + evs.length + " event(s). Review slide editors below, then Save or Push.");
  }

  function onCalendarImportClick() {
    var fileEl = $("ics-file");
    var pasteEl = $("ics-paste");
    if (fileEl && fileEl.files && fileEl.files[0]) {
      var f = fileEl.files[0];
      var reader = new FileReader();
      reader.onload = function () {
        runCalendarImportFromText(String(reader.result || ""));
        fileEl.value = "";
      };
      reader.onerror = function () {
        showBanner("err", "Could not read that file.");
      };
      reader.readAsText(f);
      return;
    }
    var pasted = pasteEl ? pasteEl.value : "";
    if (String(pasted).trim()) {
      runCalendarImportFromText(pasted);
      return;
    }
    showBanner("err", "Choose an .ics file or paste calendar text first.");
  }

  function onCalendarImportUrlClick() {
    var urlEl = $("ics-url");
    var url = urlEl ? String(urlEl.value || "").trim() : "";
    if (!url) {
      showBanner("err", "Paste an iCal URL first.");
      return;
    }
    showBanner("ok", "Fetching calendar…");
    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error(t || res.statusText); });
        return res.text();
      })
      .then(function (text) {
        runCalendarImportFromText(text);
      })
      .catch(function (err) {
        showBanner("err", "Calendar URL fetch failed: " + ((err && err.message) || "error"));
      });
  }

  function addGroceryLineToSlot(slot) {
    var itemEl = $("qa-grocery-item");
    var line = itemEl ? itemEl.value.trim() : "";
    if (!line) {
      showBanner("err", "Enter an item to add.");
      return;
    }
    var nm = $("s-list-" + slot + "-name");
    var ta = $("s-list-" + slot + "-lines");
    if (!ta) return;
    if (nm && !nm.value.trim()) nm.value = "Groceries";
    var cur = String(ta.value || "").replace(/\s+$/, "");
    ta.value = cur ? cur + "\n" + line : line;
    if (itemEl) itemEl.value = "";
    showBanner("ok", "Added to list " + (slot + 1) + " — click Save dashboard when done.");
  }

  function weeklyIndexNow() {
    var pack = DS.load();
    var tz = pack.settings && pack.settings.timeZone ? pack.settings.timeZone : "";
    var d = new Date();
    var wk;
    try {
      wk = d.toLocaleDateString("en-US", { weekday: "short", timeZone: tz || undefined });
    } catch (e) {
      wk = d.toLocaleDateString("en-US", { weekday: "short" });
    }
    var wi = WD.indexOf(wk);
    return wi >= 0 ? wi : 0;
  }

  function addChoreTodayToFirstSlot() {
    var inp = $("qa-chore-today-text");
    var text = inp ? inp.value.trim() : "";
    if (!text) {
      showBanner("err", "Enter a chore name.");
      return;
    }
    var ta = $("one-off-tasks");
    if (!ta) {
      showBanner("err", "Open Slide 1 fields (reload Manage if needed).");
      return;
    }
    var line = WD[weeklyIndexNow()] + " · " + text;
    var cur = String(ta.value || "").replace(/\s+$/, "");
    ta.value = cur ? cur + "\n" + line : line;
    if (inp) inp.value = "";
    showBanner("ok", "Added one-off line for today — Save dashboard when done.");
  }

  function addWeeklyChoreFromHub() {
    var nmEl = $("qa-weekly-chore-name");
    var name = nmEl ? nmEl.value.trim() : "";
    if (!name) {
      showBanner("err", "Enter a chore name for the chart.");
      return;
    }
    var days = [];
    var dj;
    for (dj = 0; dj < 7; dj++) {
      var cb = $("qa-wd-" + dj);
      days.push(!!(cb && cb.checked));
    }
    var any = days.some(function (x) {
      return x;
    });
    if (!any) {
      showBanner("err", "Check at least one weekday this chore is due.");
      return;
    }
    var data = readFormIntoData();
    var c = data.slides[2];
    if (c.rows.length >= N_CHART_ROWS) {
      showBanner("err", "Chore chart is full. Remove a row below first.");
      return;
    }
    c.rows.push({ id: uid(), name: name, days: days });
    saveLocal(data);
    if (nmEl) nmEl.value = "";
    for (dj = 0; dj < 7; dj++) {
      var cbx = $("qa-wd-" + dj);
      if (cbx) cbx.checked = false;
    }
    showBanner("ok", "Added row to weekly chore chart.");
  }

  function buildSlideFields() {
    var wrap = $("slide-fields");
    if (!wrap) return;
    var html = "";
    html +=
      '<div class="slide-card slide-card-master">' +
      "<h3>Slide 1 — Today &amp; ahead</h3>" +
      '<div class="manage-row"><label class="manage-label" for="m-heading">Heading</label><input class="manage-input" id="m-heading" type="text" /></div>' +
      '<div class="subsection"><h4>Weather today</h4>' +
      '<div class="manage-row"><label class="manage-label" for="m-wx-temp">Temp / high</label><input class="manage-input manage-input-narrow" id="m-wx-temp" type="text" placeholder="72°F" /></div>' +
      '<div class="manage-row"><label class="manage-label" for="m-wx-cond">Conditions</label><input class="manage-input" id="m-wx-cond" type="text" /></div></div>' +
      '<div class="subsection"><h4>3-day forecast</h4>';

    var fi;
    for (fi = 0; fi < 3; fi++) {
      html +=
        '<div class="forecast-edit"><span class="forecast-edit-label">Day ' +
        (fi + 1) +
        '</span>' +
        '<input class="manage-input manage-input-tiny" id="m-fc-' +
        fi +
        '-day" type="text" placeholder="Label" />' +
        '<input class="manage-input manage-input-tiny" id="m-fc-' +
        fi +
        '-hi" type="text" placeholder="High" />' +
        '<input class="manage-input manage-input-tiny" id="m-fc-' +
        fi +
        '-lo" type="text" placeholder="Low" />' +
        '<input class="manage-input" id="m-fc-' +
        fi +
        '-cond" type="text" placeholder="Conditions" /></div>';
    }
    html += "</div>";

    html += '<div class="slide1-two-col">';

    html +=
      '<div class="subsection slide1-col"><h4>Next 3 days — schedule</h4><p class="manage-help tight">This view is auto-generated from <strong>Slide 2 — Weekly schedule</strong>.</p></div>';

    html +=
      '<div class="subsection slide1-col"><h4>Today’s chores</h4>' +
      '<p class="manage-help tight">Recurring chores are filled from <strong>Slide 3 — Weekly chore chart</strong> for whichever weekdays are checked (today’s weekday appears on TV automatically).</p>' +
      '<p class="manage-help tight" id="chore-auto-preview" aria-live="polite"></p>' +
      '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="one-off-tasks">One-off tasks (by weekday)</label>' +
      '<textarea class="manage-input" id="one-off-tasks" rows="7" placeholder="Mon · Pick up parcel&#10;Thu · Trash night"></textarea></div>' +
      '<p class="manage-help tight">One line per task: <code>Mon · …</code> through <code>Sun · …</code>. These show only on that day (not weekly recurring).</p></div>' +
      "</div></div>";

    html +=
      '<div class="slide-card">' +
      "<h3>Slide 2 — Weekly schedule</h3>" +
      '<div class="manage-row"><label class="manage-label" for="w-heading">Heading</label><input class="manage-input" id="w-heading" type="text" /></div>' +
      '<p class="manage-help tight">End a line with <code>[once]</code> for a one-week-only event (removed on the next Monday rollover).</p>';
    var wi;
    for (wi = 0; wi < 7; wi++) {
      html +=
        '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="w-day-' +
        wi +
        '-lines">' +
        WD[wi] +
        '</label><textarea class="manage-input" id="w-day-' +
        wi +
        '-lines" rows="2" placeholder="Events"></textarea></div>';
    }
    html += "</div>";

    html +=
      '<div class="slide-card">' +
      "<h3>Slide 3 — Weekly chore chart</h3>" +
      '<div class="manage-row"><label class="manage-label" for="c-heading">Heading</label><input class="manage-input" id="c-heading" type="text" /></div>' +
      '<p class="manage-help tight">Checkboxes = due that weekday.</p>' +
      '<div class="chore-chart-edit">';
    var cri;
    for (cri = 0; cri < N_CHART_ROWS; cri++) {
      html += '<div class="chore-chart-row"><input class="manage-input chore-name-input" id="c-row-' + cri + '-name" type="text" placeholder="Chore name" />';
      var dj;
      for (dj = 0; dj < 7; dj++) {
        html +=
          '<label class="chk chk-dow" title="' +
          WD[dj] +
          '"><input type="checkbox" id="c-row-' +
          cri +
          "-d" +
          dj +
          '" /> ' +
          WD[dj].charAt(0) +
          "</label>";
      }
      html += "</div>";
    }
    html += "</div></div>";

    html +=
      '<div class="slide-card">' +
      "<h3>Slide 4 — Shopping lists</h3>" +
      '<div class="manage-row"><label class="manage-label" for="s-heading">Heading</label><input class="manage-input" id="s-heading" type="text" /></div>' +
      '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="s-amazon">Amazon / notes</label><textarea class="manage-input" id="s-amazon" rows="2" placeholder="Household Amazon lists — coming later"></textarea></div>';
    var li;
    for (li = 0; li < N_LISTS; li++) {
      html +=
        '<div class="subsection"><h4>List ' +
        (li + 1) +
        '</h4>' +
        '<div class="manage-row"><label class="manage-label" for="s-list-' +
        li +
        '-name">Name</label><input class="manage-input" id="s-list-' +
        li +
        '-name" type="text" /></div>' +
        '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="s-list-' +
        li +
        '-lines">Items</label><textarea class="manage-input" id="s-list-' +
        li +
        '-lines" rows="3" placeholder="[x] optional checked"></textarea></div></div>';
    }
    html += "</div>";

    wrap.innerHTML = html;
  }

  function readMaster(data) {
    var m = data.slides[0];
    m.heading = ($("m-heading") && $("m-heading").value) || m.heading;
    m.weatherToday = {
      temp: ($("m-wx-temp") && $("m-wx-temp").value) || "",
      condition: ($("m-wx-cond") && $("m-wx-cond").value) || "",
    };
    var fi;
    for (fi = 0; fi < 3; fi++) {
      m.forecast[fi] = {
        dayLabel: ($("m-fc-" + fi + "-day") && $("m-fc-" + fi + "-day").value) || "",
        high: ($("m-fc-" + fi + "-hi") && $("m-fc-" + fi + "-hi").value) || "",
        low: ($("m-fc-" + fi + "-lo") && $("m-fc-" + fi + "-lo").value) || "",
        condition: ($("m-fc-" + fi + "-cond") && $("m-fc-" + fi + "-cond").value) || "",
      };
    }
    // Next-3-day schedule is derived from the weekly schedule (slide 2).
    var taOff = $("one-off-tasks");
    m.oneOffTasks = parseOneOffLines(taOff ? taOff.value : "", m.oneOffTasks || []);
  }

  function readWeekly(data) {
    var w = data.slides[1];
    w.heading = ($("w-heading") && $("w-heading").value) || w.heading;
    var wi;
    for (wi = 0; wi < 7; wi++) {
      var ta = $("w-day-" + wi + "-lines");
      w.days[wi].items = parseScheduleLines(ta ? ta.value : "");
    }
  }

  function readChores(data) {
    var c = data.slides[2];
    c.heading = ($("c-heading") && $("c-heading").value) || c.heading;
    var prev = c.rows || [];
    var rows = [];
    var cri;
    for (cri = 0; cri < N_CHART_ROWS; cri++) {
      var nm = $("c-row-" + cri + "-name");
      var name = nm ? nm.value.trim() : "";
      if (!name) continue;
      var days = [];
      var dj;
      for (dj = 0; dj < 7; dj++) {
        var cb = $("c-row-" + cri + "-d" + dj);
        days.push(!!(cb && cb.checked));
      }
      var match = prev[rows.length];
      var rid = match && match.name === name && match.id ? match.id : uid();
      rows.push({ id: rid, name: name, days: days });
    }
    c.rows = rows;
  }

  function partitionShoppingPrev(prev) {
    var prevBySlot = {};
    var legacy = [];
    var pi;
    for (pi = 0; pi < prev.length; pi++) {
      var p = prev[pi];
      if (!p || typeof p !== "object") continue;
      if (typeof p.slot === "number" && p.slot >= 0 && p.slot < N_LISTS) {
        prevBySlot[p.slot] = p;
      } else {
        legacy.push(p);
      }
    }
    return { prevBySlot: prevBySlot, legacy: legacy };
  }

  function readShopping(data) {
    var s = data.slides[3];
    s.heading = ($("s-heading") && $("s-heading").value) || s.heading;
    s.amazonNote = ($("s-amazon") && $("s-amazon").value) || "";
    var prev = s.lists || [];
    var part = partitionShoppingPrev(prev);
    var lists = [];
    var li;
    for (li = 0; li < N_LISTS; li++) {
      var nm = $("s-list-" + li + "-name");
      var ta = $("s-list-" + li + "-lines");
      var name = nm ? nm.value.trim() : "";
      var parsed = parseShoppingLines(ta ? ta.value : "");
      if (!name && !parsed.length) continue;
      var match = part.prevBySlot[li] || part.legacy[li];
      var lid = match && match.id ? match.id : uid();
      var prevItems = match && Array.isArray(match.items) ? match.items : [];
      var items = parsed.map(function (it, idx) {
        var p = prevItems[idx];
        var iid = p && p.text === it.text && p.id ? p.id : uid();
        return { id: iid, text: it.text, checked: !!it.checked };
      });
      lists.push({ id: lid, name: name || "List " + (li + 1), items: items, slot: li });
    }
    s.lists = lists;
  }

  function readFormIntoData() {
    var data = DS.load();
    data.settings.title = ($("setting-title") && $("setting-title").value) || data.settings.title;
    var th = $("setting-theme");
    if (th) data.settings.themeId = String(th.value || data.settings.themeId || "pastel-prism");
    data.settings.bannerMessage = ($("setting-banner") && $("setting-banner").value) || data.settings.bannerMessage || "";
    data.settings.zip = ($("setting-zip") && $("setting-zip").value) || data.settings.zip || "84010";
    data.settings.timeZone = ($("setting-timezone") && $("setting-timezone").value) || data.settings.timeZone || "America/Denver";
    var aw = $("setting-auto-weather");
    if (aw) data.settings.autoWeather = !!aw.checked;
    var rot = Number(($("setting-rotation") && $("setting-rotation").value) || data.settings.rotationSec);
    data.settings.rotationSec = rot;
    readMaster(data);
    readWeekly(data);
    readChores(data);
    readShopping(data);
    return DS.ensureFourSlides(data);
  }

  function fillMaster(m) {
    if ($("m-heading")) $("m-heading").value = m.heading || "";
    if ($("m-wx-temp")) $("m-wx-temp").value = (m.weatherToday && m.weatherToday.temp) || "";
    if ($("m-wx-cond")) $("m-wx-cond").value = (m.weatherToday && m.weatherToday.condition) || "";
    var fi;
    for (fi = 0; fi < 3; fi++) {
      var f = m.forecast[fi] || {};
      if ($("m-fc-" + fi + "-day")) $("m-fc-" + fi + "-day").value = f.dayLabel || "";
      if ($("m-fc-" + fi + "-hi")) $("m-fc-" + fi + "-hi").value = f.high || "";
      if ($("m-fc-" + fi + "-lo")) $("m-fc-" + fi + "-lo").value = f.low || "";
      if ($("m-fc-" + fi + "-cond")) $("m-fc-" + fi + "-cond").value = f.condition || "";
    }
    var taOne = $("one-off-tasks");
    if (taOne) taOne.value = formatOneOffTasks(m.oneOffTasks || []);
    var pv = $("chore-auto-preview");
    if (pv) {
      var pack = DS.load();
      var chart = pack.slides[2];
      var tz = pack.settings.timeZone || "";
      var d = new Date();
      var wk;
      try {
        wk = d.toLocaleDateString("en-US", { weekday: "short", timeZone: tz || undefined });
      } catch (e) {
        wk = d.toLocaleDateString("en-US", { weekday: "short" });
      }
      var wi = WD.indexOf(wk);
      if (wi < 0) wi = 0;
      var names = [];
      if (chart && chart.rows) {
        var ri;
        for (ri = 0; ri < chart.rows.length; ri++) {
          var row = chart.rows[ri];
          if (row && row.days && row.days[wi] && String(row.name || "").trim()) {
            names.push(String(row.name).trim());
          }
        }
      }
      pv.textContent = names.length
        ? "From chore chart for " + WD[wi] + ": " + names.join("; ")
        : "No chore chart rows marked for " + WD[wi] + " yet.";
    }
  }

  function fillWeekly(w) {
    if ($("w-heading")) $("w-heading").value = w.heading || "";
    var wi;
    for (wi = 0; wi < 7; wi++) {
      var d = w.days[wi] || { items: [] };
      var ta = $("w-day-" + wi + "-lines");
      if (ta) ta.value = formatScheduleLines(d.items);
    }
  }

  function fillChores(c) {
    if ($("c-heading")) $("c-heading").value = c.heading || "";
    var cri;
    for (cri = 0; cri < N_CHART_ROWS; cri++) {
      var r = c.rows[cri];
      var nm = $("c-row-" + cri + "-name");
      if (nm) nm.value = r ? r.name || "" : "";
      var dj;
      for (dj = 0; dj < 7; dj++) {
        var cb = $("c-row-" + cri + "-d" + dj);
        if (cb) cb.checked = !!(r && r.days && r.days[dj]);
      }
    }
  }

  function fillShopping(s) {
    if ($("s-heading")) $("s-heading").value = s.heading || "";
    if ($("s-amazon")) $("s-amazon").value = s.amazonNote || "";
    var lists = s.lists || [];
    var part = partitionShoppingPrev(lists);
    var bySlot = part.prevBySlot;
    var u = 0;
    var leg = part.legacy;
    var li;
    for (li = 0; li < N_LISTS; li++) {
      if (!bySlot[li] && u < leg.length) {
        bySlot[li] = leg[u];
        u++;
      }
      var L = bySlot[li];
      var nm = $("s-list-" + li + "-name");
      var ta = $("s-list-" + li + "-lines");
      if (nm) nm.value = L ? L.name || "" : "";
      if (ta) ta.value = L ? formatShoppingItems(L.items) : "";
    }
  }

  function fillForm(data) {
    data = DS.ensureFourSlides(data);
    if ($("setting-title")) $("setting-title").value = data.settings.title || "";
    if ($("setting-theme")) $("setting-theme").value = data.settings.themeId || "pastel-prism";
    if ($("setting-banner")) $("setting-banner").value = data.settings.bannerMessage || "";
    if ($("setting-zip")) $("setting-zip").value = data.settings.zip || "84010";
    if ($("setting-timezone")) $("setting-timezone").value = data.settings.timeZone || "America/Denver";
    if ($("setting-auto-weather")) $("setting-auto-weather").checked = data.settings.autoWeather !== false;
    if ($("setting-rotation")) $("setting-rotation").value = String(data.settings.rotationSec != null ? data.settings.rotationSec : 15);
    if ($("sync-key")) $("sync-key").value = SYNC.getLocalSyncKey() || "";
    fillMaster(data.slides[0]);
    fillWeekly(data.slides[1]);
    fillChores(data.slides[2]);
    fillShopping(data.slides[3]);
  }

  function saveLocal(data) {
    DS.save(data);
    fillForm(DS.load());
    if (window.DashboardTheme && window.DashboardTheme.applyFromStore) window.DashboardTheme.applyFromStore();
  }

  function onSaveDash(e) {
    e.preventDefault();
    var data = readFormIntoData();
    saveLocal(data);
    var key = SYNC.getLocalSyncKey();
    SYNC.ready()
      .then(function (ok) {
        if (!ok || !key) {
          showBanner("ok", "Saved on this browser. (Cloud is off — add sync config + key to sync.)");
          return false;
        }
        return SYNC.push(key, data).then(function () {
          showBanner("ok", "Saved locally and pushed to cloud.");
          return true;
        });
      })
      .catch(function (err) {
        showBanner("err", "Saved locally, but cloud push failed: " + ((err && err.message) || "error"));
      })
      .finally(function () {
        window.setTimeout(function () {
          showBanner("", "");
        }, 5000);
      });
  }

  function onGenKey() {
    var k = SYNC.generateSyncKey();
    var inp = $("sync-key");
    if (inp) inp.value = k;
    setSyncStatus("Save this key on each device after generating.");
  }

  function onSaveKey() {
    var inp = $("sync-key");
    var v = inp ? inp.value.trim() : "";
    if (v.length < 8) {
      showBanner("err", "Sync key should be at least 8 characters.");
      return;
    }
    SYNC.setLocalSyncKey(v);
    showBanner("ok", "Sync key saved in this browser.");
    refreshSyncLine();
  }

  function applyKeyFromUrlIfPresent() {
    try {
      var qs = new URLSearchParams(window.location.search || "");
      var k = (qs.get("key") || qs.get("sync_key") || "").trim();
      if (!k) return;
      if (k.length < 8) {
        showBanner("err", "URL key too short.");
        return;
      }
      SYNC.setLocalSyncKey(k);
      var inp = $("sync-key");
      if (inp) inp.value = k;
      showBanner("ok", "Sync key set from URL on this device.");
      // Clean URL
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {}
    } catch (e) {}
  }

  function refreshSyncLine() {
    SYNC.ready().then(function (ok) {
      if (ok) setSyncStatus("Supabase config loaded. Push / pull use your saved sync key.");
      else setSyncStatus("Missing shared/sync-config.json (or failed load). Copy sync-config.example.json and add your project URL and anon key.");
    });
  }

  function onPush() {
    var key = SYNC.getLocalSyncKey();
    if (!key) {
      showBanner("err", "Save a sync key first.");
      return;
    }
    var data = readFormIntoData();
    saveLocal(data);
    SYNC.ready()
      .then(function (ok) {
        if (!ok) throw new Error("Sync not configured");
        return SYNC.push(key, data);
      })
      .then(function () {
        showBanner("ok", "Pushed to Supabase.");
      })
      .catch(function (err) {
        showBanner("err", (err && err.message) || "Push failed");
      });
  }

  function onPull() {
    var key = SYNC.getLocalSyncKey();
    if (!key) {
      showBanner("err", "Save a sync key first.");
      return;
    }
    SYNC.ready()
      .then(function (ok) {
        if (!ok) throw new Error("Sync not configured");
        return SYNC.pull(key);
      })
      .then(function (remote) {
        if (remote && DS.isValidPayload(remote)) {
          // Theme is a local display preference; don't let cloud pulls override it.
          try {
            var local = DS.load();
            if (!remote.settings || typeof remote.settings !== "object") remote.settings = {};
            if (local && local.settings && local.settings.themeId) remote.settings.themeId = local.settings.themeId;
          } catch (e) {}
          DS.save(remote);
          fillForm(DS.load());
          showBanner("ok", "Pulled from cloud and applied.");
        } else {
          showBanner("err", "No data in cloud for this key yet. Push from this device first.");
        }
      })
      .catch(function (err) {
        showBanner("err", (err && err.message) || "Pull failed");
      });
  }

  function focusables() {
    var nodes = document.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    );
    return Array.prototype.slice.call(nodes).filter(function (n) {
      return !!(n && n.offsetParent !== null);
    });
  }

  function moveFocus(delta) {
    var list = focusables();
    if (!list.length) return;
    var cur = document.activeElement;
    var idx = list.indexOf(cur);
    if (idx < 0) idx = 0;
    var next = list[Math.max(0, Math.min(list.length - 1, idx + delta))];
    if (next && next.focus) next.focus();
  }

  // FireTV remote: arrow keys should navigate, not change number inputs.
  function onRemoteArrowNav(e) {
    var a = document.activeElement;
    if (!a) return;
    if (a.id !== "setting-rotation") return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      moveFocus(-1);
    }
  }

  function setActivePanel(id) {
    var tabs = document.querySelectorAll(".kiosk-tab[data-tab]");
    var panels = document.querySelectorAll(".kiosk-panel[data-panel]");
    var i;
    for (i = 0; i < panels.length; i++) {
      var p = panels[i];
      var on = p.getAttribute("data-panel") === id;
      p.classList.toggle("is-active", on);
    }
    for (i = 0; i < tabs.length; i++) {
      var t = tabs[i];
      var on2 = t.getAttribute("data-tab") === id;
      t.classList.toggle("is-active", on2);
      t.setAttribute("aria-selected", on2 ? "true" : "false");
    }
  }

  function initTabs() {
    var tabs = document.querySelectorAll(".kiosk-tab[data-tab]");
    if (!tabs || !tabs.length) return;
    var i;
    for (i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener("click", function (e) {
        var id = (e.currentTarget && e.currentTarget.getAttribute("data-tab")) || "";
        if (!id) return;
        setActivePanel(id);
      });
    }
    setActivePanel("title");
  }

  function init() {
    initTabs();
    buildSlideFields();
    fillForm(DS.load());
    refreshSyncLine();
    applyKeyFromUrlIfPresent();
    var st = $("setting-theme");
    if (st) {
      st.addEventListener("change", function () {
        var d = readFormIntoData();
        saveLocal(d);
        if (window.DashboardTheme && window.DashboardTheme.applyFromStore) window.DashboardTheme.applyFromStore();
      });
    }
    if (window.DashboardWeather && window.DashboardWeather.syncOnce) {
      window.DashboardWeather.syncOnce().then(function (ok) {
        if (ok) fillForm(DS.load());
      });
    }
    document.addEventListener("keydown", onRemoteArrowNav, true);
    var form = $("dash-form");
    if (form) form.addEventListener("submit", onSaveDash);
    var bg = $("btn-gen-key");
    var bk = $("btn-save-key");
    var bp = $("btn-push");
    var bl = $("btn-pull");
    if (bg) bg.addEventListener("click", onGenKey);
    if (bk) bk.addEventListener("click", onSaveKey);
    if (bp) bp.addEventListener("click", onPush);
    if (bl) bl.addEventListener("click", onPull);
    var bi = $("btn-ics-import");
    if (bi) bi.addEventListener("click", onCalendarImportClick);
    var biu = $("btn-ics-import-url");
    if (biu) biu.addEventListener("click", onCalendarImportUrlClick);
    var bq = $("btn-qa-grocery");
    if (bq) {
      bq.addEventListener("click", function () {
        var sel = $("qa-grocery-slot");
        var slot = sel ? parseInt(sel.value, 10) : 0;
        if (slot !== slot || slot < 0 || slot > 3) slot = 0;
        addGroceryLineToSlot(slot);
      });
    }
    var bct = $("btn-qa-chore-today");
    if (bct) bct.addEventListener("click", addChoreTodayToFirstSlot);
    var bcw = $("btn-qa-chore-weekly");
    if (bcw) bcw.addEventListener("click", addWeeklyChoreFromHub);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
