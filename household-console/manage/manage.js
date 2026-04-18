(function () {
  "use strict";

  var HC = window.HouseholdCalendar;
  var HS = window.HouseholdStore;

  function $(id) {
    return document.getElementById(id);
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
        HS.save(data);
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
      return String(n).padStart(2, "0");
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
    if (Number.isNaN(d.getTime())) return null;
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
        HS.save(data);
        renderAll();
        toast("Event deleted", "ok");
      });
      li.appendChild(left);
      li.appendChild(btn);
      ul.appendChild(li);
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
        HS.save(data);
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
        HS.save(data);
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

  function buildMealEditor() {
    var data = HS.load();
    var root = $("meal-week");
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
      ["breakfast", "lunch", "dinner"].forEach(function (meal) {
        var lab = document.createElement("label");
        lab.textContent = meal.charAt(0).toUpperCase() + meal.slice(1);
        var inp = document.createElement("input");
        inp.type = "text";
        inp.dataset.date = iso;
        inp.dataset.meal = meal;
        var cur = (data.meals && data.meals[iso] && data.meals[iso][meal]) || "";
        inp.value = cur;
        col.appendChild(lab);
        col.appendChild(inp);
      });
      root.appendChild(col);
    });
  }

  function saveMealsFromEditor() {
    var data = HS.load();
    if (!data.meals) data.meals = {};
    var root = $("meal-week");
    if (!root) return;
    root.querySelectorAll("input[data-date]").forEach(function (inp) {
      var iso = inp.getAttribute("data-date");
      var meal = inp.getAttribute("data-meal");
      if (!iso || !meal) return;
      if (!data.meals[iso]) data.meals[iso] = {};
      var v = String(inp.value || "").trim();
      if (!v) {
        delete data.meals[iso][meal];
        if (Object.keys(data.meals[iso]).length === 0) delete data.meals[iso];
      } else {
        data.meals[iso][meal] = v;
      }
    });
    HS.save(data);
    toast("Meals saved", "ok");
  }

  function renderAll() {
    var data = HS.load();
    var hn = $("house-name");
    if (hn) hn.value = data.householdName || "";
    renderMembers();
    renderEvents();
    renderChores();
    renderEventMemberChecks();
    refreshMemberSelects();
    buildMealEditor();
  }

  function wire() {
    $("btn-save-house").addEventListener("click", function () {
      var data = HS.load();
      data.householdName = String($("house-name").value || "").trim() || "Home";
      HS.save(data);
      toast("Household saved", "ok");
    });

    $("btn-add-member").addEventListener("click", function () {
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
      HS.save(data);
      $("member-name").value = "";
      renderAll();
      toast("Member added", "ok");
    });

    $("btn-add-event").addEventListener("click", function () {
      var title = String($("ev-title").value || "").trim();
      var start = fromLocalValue($("ev-start").value);
      if (!title || !start) {
        toast("Title and start time required", "err");
        return;
      }
      var end = fromLocalValue($("ev-end").value);
      var ids = [];
      $("ev-members")
        .querySelectorAll("input[type=checkbox]:checked")
        .forEach(function (cb) {
          ids.push(cb.value);
        });
      var data = HS.load();
      data.events.push({
        id: HS.uid(),
        title: title,
        start: start,
        end: end,
        memberIds: ids,
      });
      HS.save(data);
      $("ev-title").value = "";
      $("ev-end").value = "";
      renderAll();
      toast("Event added", "ok");
    });

    $("btn-add-chore").addEventListener("click", function () {
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
      HS.save(data);
      $("ch-title").value = "";
      renderAll();
      toast("Chore added", "ok");
    });

    $("btn-save-meals").addEventListener("click", saveMealsFromEditor);

    $("btn-export").addEventListener("click", function () {
      var data = HS.load();
      var blob = new Blob([HS.exportJson(data)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "household-console-export.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Download started", "ok");
    });

    $("file-import").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          HS.importJson(String(reader.result || ""));
          renderAll();
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
