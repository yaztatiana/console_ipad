(function () {
  "use strict";

  var DS = window.DashboardStore;
  var SYNC = window.DashboardSync;
  var WD = DS.WEEKDAYS;
  var N_CHORE_TODAY = 12;
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
        var m = line.match(/^(\d{1,2}:\d{2})\s*[-–—·:]\s*(.+)$/);
        if (m) return { time: m[1], text: m[2].trim() };
        m = line.match(/^(\d{1,2}:\d{2})\s+(.+)$/);
        if (m) return { time: m[1], text: m[2].trim() };
        return { time: "", text: line };
      });
  }

  function formatScheduleLines(items) {
    if (!items || !items.length) return "";
    return items
      .map(function (it) {
        if (it.time) return it.time + " — " + (it.text || "");
        return it.text || "";
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
        return { id: uid(), text: t, checked: checked };
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

    html += '<div class="subsection"><h4>Next 3 days — schedule</h4>';
    var si;
    for (si = 0; si < 3; si++) {
      html +=
        '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="m-sch-' +
        si +
        '-label">Day label</label><input class="manage-input" id="m-sch-' +
        si +
        '-label" type="text" /></div>' +
        '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="m-sch-' +
        si +
        '-lines">Events</label><textarea class="manage-input" id="m-sch-' +
        si +
        '-lines" rows="3" placeholder="9:00 — …"></textarea></div>';
    }
    html += "</div>";

    html += '<div class="subsection"><h4>Today’s chores (unchecked = still on TV)</h4><div class="chore-today-grid">';
    var ci;
    for (ci = 0; ci < N_CHORE_TODAY; ci++) {
      html +=
        '<div class="chore-today-row">' +
        '<input class="manage-input" id="m-chore-' +
        ci +
        '-text" type="text" placeholder="Chore ' +
        (ci + 1) +
        '" />' +
        '<label class="chk"><input type="checkbox" id="m-chore-' +
        ci +
        '-done" /> Done</label></div>';
    }
    html += "</div></div></div>";

    html +=
      '<div class="slide-card">' +
      "<h3>Slide 2 — Weekly schedule</h3>" +
      '<div class="manage-row"><label class="manage-label" for="w-heading">Heading</label><input class="manage-input" id="w-heading" type="text" /></div>';
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
    var si;
    for (si = 0; si < 3; si++) {
      m.scheduleThreeDay[si].dateLabel = ($("m-sch-" + si + "-label") && $("m-sch-" + si + "-label").value) || "";
      var ta = $("m-sch-" + si + "-lines");
      m.scheduleThreeDay[si].items = parseScheduleLines(ta ? ta.value : "");
    }
    var prevList = m.choresToday || [];
    var chores = [];
    var ci;
    for (ci = 0; ci < N_CHORE_TODAY; ci++) {
      var tx = $("m-chore-" + ci + "-text");
      var ch = $("m-chore-" + ci + "-done");
      var text = tx ? tx.value.trim() : "";
      if (!text) continue;
      var match = prevList[chores.length];
      var cid = match && match.text === text && match.id ? match.id : uid();
      chores.push({ id: cid, text: text, done: !!(ch && ch.checked) });
    }
    m.choresToday = chores;
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

  function readShopping(data) {
    var s = data.slides[3];
    s.heading = ($("s-heading") && $("s-heading").value) || s.heading;
    s.amazonNote = ($("s-amazon") && $("s-amazon").value) || "";
    var prev = s.lists || [];
    var lists = [];
    var li;
    for (li = 0; li < N_LISTS; li++) {
      var nm = $("s-list-" + li + "-name");
      var ta = $("s-list-" + li + "-lines");
      var name = nm ? nm.value.trim() : "";
      var items = parseShoppingLines(ta ? ta.value : "");
      if (!name && !items.length) continue;
      var match = prev[lists.length];
      var lid = match && match.id ? match.id : uid();
      lists.push({ id: lid, name: name || "List " + (li + 1), items: items });
    }
    s.lists = lists;
  }

  function readFormIntoData() {
    var data = DS.load();
    data.settings.title = ($("setting-title") && $("setting-title").value) || data.settings.title;
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
    var si;
    for (si = 0; si < 3; si++) {
      var d = m.scheduleThreeDay[si] || { dateLabel: "", items: [] };
      if ($("m-sch-" + si + "-label")) $("m-sch-" + si + "-label").value = d.dateLabel || "";
      if ($("m-sch-" + si + "-lines")) $("m-sch-" + si + "-lines").value = formatScheduleLines(d.items);
    }
    var ci;
    for (ci = 0; ci < N_CHORE_TODAY; ci++) {
      var tx = $("m-chore-" + ci + "-text");
      var ch = $("m-chore-" + ci + "-done");
      var c = m.choresToday[ci];
      if (tx) tx.value = c ? c.text || "" : "";
      if (ch) ch.checked = !!(c && c.done);
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
    var li;
    for (li = 0; li < N_LISTS; li++) {
      var L = s.lists[li];
      var nm = $("s-list-" + li + "-name");
      var ta = $("s-list-" + li + "-lines");
      if (nm) nm.value = L ? L.name || "" : "";
      if (ta) ta.value = L ? formatShoppingItems(L.items) : "";
    }
  }

  function fillForm(data) {
    data = DS.ensureFourSlides(data);
    if ($("setting-title")) $("setting-title").value = data.settings.title || "";
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
  }

  function onSaveDash(e) {
    e.preventDefault();
    var data = readFormIntoData();
    saveLocal(data);
    showBanner("ok", "Dashboard saved on this browser.");
    window.setTimeout(function () {
      showBanner("", "");
    }, 3500);
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

  function init() {
    buildSlideFields();
    fillForm(DS.load());
    refreshSyncLine();
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
