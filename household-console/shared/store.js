(function (global) {
  "use strict";

  var STORAGE_KEY = "dashboard-console-v1";
  var SLIDE_KINDS = ["master", "weekly", "chores", "shopping"];
  var WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Monday-based week id: YYYY-Www (e.g. 2026-W17)
  function weekId(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay(); // 0 Sun .. 6 Sat
    var isoDay = day === 0 ? 7 : day; // 1..7 (Mon..Sun)
    x.setDate(x.getDate() + (4 - isoDay)); // Thursday
    var yearStart = new Date(x.getFullYear(), 0, 1);
    var weekNo = Math.ceil(((x - yearStart) / 86400000 + 1) / 7);
    return x.getFullYear() + "-W" + (weekNo < 10 ? "0" : "") + weekNo;
  }

  // Sunday 00:00-based week id: YYYY-MM-DD of the Sunday that starts the week
  function sundayWeekId(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = x.getDay(); // 0 Sunday .. 6 Saturday
    x.setDate(x.getDate() - day);
    var y = x.getFullYear();
    var m = x.getMonth() + 1;
    var dd = x.getDate();
    return y + "-" + (m < 10 ? "0" : "") + m + "-" + (dd < 10 ? "0" : "") + dd;
  }

  function copyScheduleItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (it) {
      return { time: String((it && it.time) || ""), text: String((it && it.text) || "") };
    });
  }

  // Returns index into WEEKDAYS (Mon=0..Sun=6) for the given date in the provided timezone.
  function weeklyIndexForDateInTimeZone(date, timeZone) {
    var tz = String(timeZone || "");
    var wk;
    try {
      wk = date.toLocaleDateString("en-US", { weekday: "short", timeZone: tz || undefined });
    } catch (e) {
      wk = date.toLocaleDateString("en-US", { weekday: "short" });
    }
    // en-US weekday short: Mon, Tue, Wed, Thu, Fri, Sat, Sun
    var i = WEEKDAYS.indexOf(wk);
    if (i >= 0) return i;
    return 0;
  }

  function deriveThreeDayScheduleFromWeekly(data) {
    if (!data || !data.slides || !data.slides[0] || !data.slides[1]) return;
    var master = data.slides[0];
    var weekly = data.slides[1];
    if (master.kind !== "master" || weekly.kind !== "weekly") return;
    if (!Array.isArray(weekly.days) || weekly.days.length !== 7) return;
    if (!Array.isArray(master.scheduleThreeDay) || master.scheduleThreeDay.length !== 3) return;

    var tz = data.settings && data.settings.timeZone ? data.settings.timeZone : "";
    var labels = ["Today", "Tomorrow", "Day after"];
    var base = new Date();
    var k;
    for (k = 0; k < 3; k++) {
      var d = new Date(base.getTime());
      d.setDate(d.getDate() + k);
      var wi = weeklyIndexForDateInTimeZone(d, tz);
      var wd = weekly.days[wi];
      master.scheduleThreeDay[k].dateLabel = labels[k] + (wd && wd.dayLabel ? " (" + wd.dayLabel + ")" : "");
      master.scheduleThreeDay[k].items = copyScheduleItems(wd && wd.items);
    }
  }

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function blankForecastDay() {
    return { dayLabel: "", high: "", low: "", condition: "" };
  }

  function blankScheduleDay(dateLabel) {
    return { dateLabel: dateLabel || "", items: [] };
  }

  function defaultMaster() {
    return {
      id: uid(),
      kind: "master",
      heading: "Today & ahead",
      weatherToday: { temp: "—°", condition: "Add weather in Manage" },
      forecast: [
        { dayLabel: "Tomorrow", high: "", low: "", condition: "" },
        { dayLabel: "+2 days", high: "", low: "", condition: "" },
        { dayLabel: "+3 days", high: "", low: "", condition: "" },
      ],
      scheduleThreeDay: [
        blankScheduleDay("Today"),
        blankScheduleDay("Tomorrow"),
        blankScheduleDay("Day after"),
      ],
      choresToday: [
        { id: uid(), text: "Example chore", done: false, recurring: true },
        { id: uid(), text: "One-off task", done: true, recurring: false },
      ],
    };
  }

  function defaultWeekly() {
    var days = WEEKDAYS.map(function (d) {
      return { dayLabel: d, items: [] };
    });
    days[0].items = [{ time: "9:00", text: "School drop-off" }];
    days[2].items = [{ time: "15:30", text: "Soccer practice" }];
    return {
      id: uid(),
      kind: "weekly",
      heading: "Weekly schedule",
      days: days,
    };
  }

  function defaultChores() {
    return {
      id: uid(),
      kind: "chores",
      heading: "Weekly chore chart",
      dayLabels: WEEKDAYS.slice(),
      rows: [
        { id: uid(), name: "Kitchen counters", days: [true, false, true, false, true, false, false] },
        { id: uid(), name: "Trash / recycling", days: [false, false, false, false, true, false, false] },
      ],
    };
  }

  function defaultShopping() {
    return {
      id: uid(),
      kind: "shopping",
      heading: "Shopping lists",
      amazonNote: "Amazon household lists will connect here later.",
      lists: [
        {
          id: uid(),
          name: "Groceries",
          items: [
            { id: uid(), text: "Milk", checked: false },
            { id: uid(), text: "Bread", checked: false },
          ],
        },
        {
          id: uid(),
          name: "Home",
          items: [{ id: uid(), text: "Light bulbs", checked: false }],
        },
      ],
    };
  }

  function defaultsForIndex(i) {
    if (i === 0) return defaultMaster();
    if (i === 1) return defaultWeekly();
    if (i === 2) return defaultChores();
    return defaultShopping();
  }

  function isLegacySlide(s) {
    if (!s || typeof s !== "object") return true;
    return SLIDE_KINDS.indexOf(s.kind) === -1;
  }

  function normalizeForecast(arr) {
    var out = [];
    var i;
    for (i = 0; i < 3; i++) {
      var x = arr && arr[i];
      if (!x || typeof x !== "object") {
        out.push(blankForecastDay());
        continue;
      }
      out.push({
        dayLabel: String(x.dayLabel || ""),
        high: String(x.high || ""),
        low: String(x.low || ""),
        condition: String(x.condition || ""),
      });
    }
    return out;
  }

  function normalizeScheduleItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (it) {
      if (!it || typeof it !== "object") return { time: "", text: "" };
      return { time: String(it.time || ""), text: String(it.text || "") };
    });
  }

  function normalizeScheduleThreeDay(arr) {
    var labels = ["Today", "Tomorrow", "Day after"];
    var out = [];
    var i;
    for (i = 0; i < 3; i++) {
      var x = arr && arr[i];
      if (!x || typeof x !== "object") {
        out.push(blankScheduleDay(labels[i]));
        continue;
      }
      out.push({
        dateLabel: String(x.dateLabel || labels[i]),
        items: normalizeScheduleItems(x.items),
      });
    }
    return out;
  }

  function normalizeChoresToday(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.map(function (c) {
      if (!c || typeof c !== "object") return { id: uid(), text: "", done: false };
      return {
        id: c.id || uid(),
        text: String(c.text || ""),
        done: !!c.done,
        recurring: !!c.recurring,
      };
    });
  }

  function normalizeMaster(s, i) {
    var d = defaultsForIndex(i);
    var base = !s || s.kind !== "master" ? d : s;
    var wt = base.weatherToday && typeof base.weatherToday === "object" ? base.weatherToday : {};
    return {
      id: base.id || uid(),
      kind: "master",
      heading: String(base.heading || d.heading),
      weatherToday: {
        temp: String(wt.temp != null ? wt.temp : d.weatherToday.temp),
        condition: String(wt.condition != null ? wt.condition : d.weatherToday.condition),
      },
      forecast: normalizeForecast(base.forecast),
      scheduleThreeDay: normalizeScheduleThreeDay(base.scheduleThreeDay),
      choresToday: normalizeChoresToday(base.choresToday),
    };
  }

  function normalizeWeeklyDays(arr) {
    var out = [];
    var i;
    for (i = 0; i < 7; i++) {
      var x = arr && arr[i];
      var label = WEEKDAYS[i];
      if (!x || typeof x !== "object") {
        out.push({ dayLabel: label, items: [] });
        continue;
      }
      out.push({
        dayLabel: String(x.dayLabel || label),
        items: normalizeScheduleItems(x.items),
      });
    }
    return out;
  }

  function normalizeWeekly(s, i) {
    var d = defaultsForIndex(i);
    var base = !s || s.kind !== "weekly" ? d : s;
    return {
      id: base.id || uid(),
      kind: "weekly",
      heading: String(base.heading || d.heading),
      days: normalizeWeeklyDays(base.days),
    };
  }

  function normalizeChoreRows(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(function (r) {
      if (!r || typeof r !== "object") return { id: uid(), name: "", days: [false, false, false, false, false, false, false] };
      var days = Array.isArray(r.days) ? r.days : [];
      var checks = Array.isArray(r.checks) ? r.checks : [];
      var d = [];
      var c = [];
      var j;
      for (j = 0; j < 7; j++) {
        d.push(!!days[j]);
        c.push(!!checks[j]);
      }
      return { id: r.id || uid(), name: String(r.name || ""), days: d, checks: c };
    });
  }

  function normalizeChores(s, i) {
    var d = defaultsForIndex(i);
    var base = !s || s.kind !== "chores" ? d : s;
    var labels = Array.isArray(base.dayLabels) && base.dayLabels.length === 7 ? base.dayLabels.map(String) : WEEKDAYS.slice();
    return {
      id: base.id || uid(),
      kind: "chores",
      heading: String(base.heading || d.heading),
      dayLabels: labels,
      rows: normalizeChoreRows(base.rows),
    };
  }

  function normalizeListItems(items) {
    if (!Array.isArray(items)) return [];
    return items.map(function (it) {
      if (!it || typeof it !== "object") return { id: uid(), text: "", checked: false };
      return {
        id: it.id || uid(),
        text: String(it.text || ""),
        checked: !!it.checked,
      };
    });
  }

  function normalizeShoppingLists(lists) {
    if (!Array.isArray(lists)) return [];
    return lists.map(function (L) {
      if (!L || typeof L !== "object") return { id: uid(), name: "", items: [] };
      return {
        id: L.id || uid(),
        name: String(L.name || ""),
        items: normalizeListItems(L.items),
      };
    });
  }

  function normalizeShopping(s, i) {
    var d = defaultsForIndex(i);
    var base = !s || s.kind !== "shopping" ? d : s;
    return {
      id: base.id || uid(),
      kind: "shopping",
      heading: String(base.heading || d.heading),
      amazonNote: String(base.amazonNote != null ? base.amazonNote : d.amazonNote),
      lists: normalizeShoppingLists(base.lists),
    };
  }

  function migrateLegacySlide(s, index) {
    var fresh = defaultsForIndex(index);
    fresh.id = (s && s.id) || fresh.id;
    fresh.heading = String((s && s.title) || fresh.heading);
    var body = String((s && s.body) || "").trim();
    if (body) {
      if (index === 0) {
        fresh.scheduleThreeDay[0].items = [{ time: "", text: body }];
      } else if (index === 1) {
        fresh.days[0].items = [{ time: "", text: body }];
      } else if (index === 2) {
        fresh.rows = [{ id: uid(), name: body, days: [false, false, false, false, false, false, false] }];
      } else {
        fresh.amazonNote = body;
      }
    }
    return fresh;
  }

  function normalizeSlideAt(s, index) {
    var expected = SLIDE_KINDS[index];
    var working = s;
    if (isLegacySlide(s)) {
      working = migrateLegacySlide(s || {}, index);
    } else if (s.kind !== expected) {
      working = migrateLegacySlide({}, index);
    }
    if (expected === "master") return normalizeMaster(working, index);
    if (expected === "weekly") return normalizeWeekly(working, index);
    if (expected === "chores") return normalizeChores(working, index);
    return normalizeShopping(working, index);
  }

  function defaultData() {
    return {
      version: 1,
      settings: {
        title: "Home dashboard",
        themeId: "pastel-prism",
        bannerMessage: "",
        zip: "84010",
        timeZone: "America/Denver",
        autoWeather: true,
        lastWeekId: "",
        lastSundayWeekId: "",
        rotationSec: 15,
      },
      slides: [defaultMaster(), defaultWeekly(), defaultChores(), defaultShopping()],
    };
  }

  function ensureFourSlides(data) {
    if (!data || typeof data !== "object") return defaultData();
    if (!Array.isArray(data.slides)) data.slides = [];
    while (data.slides.length < 4) {
      data.slides.push(defaultsForIndex(data.slides.length));
    }
    if (data.slides.length > 4) data.slides = data.slides.slice(0, 4);
    data.slides = data.slides.map(function (s, i) {
      return normalizeSlideAt(s, i);
    });
    if (!data.settings || typeof data.settings !== "object") data.settings = defaultData().settings;
    data.settings.title = String(data.settings.title || "Home dashboard");
    var tid = String(data.settings.themeId || "pastel-prism");
    if (tid !== "pastel-prism" && tid !== "neon-kiosk" && tid !== "academia-ledger") tid = "pastel-prism";
    data.settings.themeId = tid;
    data.settings.bannerMessage = String(data.settings.bannerMessage || "");
    data.settings.zip = String(data.settings.zip || "84010");
    data.settings.timeZone = String(data.settings.timeZone || "America/Denver");
    data.settings.autoWeather = data.settings.autoWeather !== false;
    var curWeek = weekId(new Date());
    data.settings.lastWeekId = String(data.settings.lastWeekId || curWeek);
    var curSunWeek = sundayWeekId(new Date());
    data.settings.lastSundayWeekId = String(data.settings.lastSundayWeekId || curSunWeek);
    var sec = Number(data.settings.rotationSec);
    if (sec !== sec || sec < 3) {
      var legacyMs = Number(data.settings.rotationMs);
      if (legacyMs >= 3000 && legacyMs <= 120000) {
        sec = Math.round(legacyMs / 1000);
      } else {
        sec = 15;
      }
    }
    if (sec < 3) sec = 3;
    if (sec > 120) sec = 120;
    data.settings.rotationSec = sec;
    delete data.settings.rotationMs;
    data.version = 1;

    // Slide 1 "Next 3 days" schedule is derived from the weekly schedule (slide 2).
    deriveThreeDayScheduleFromWeekly(data);

    // Weekly rollover for "today chores": keep recurring, reset done, drop one-offs.
    if (data.settings.lastWeekId !== curWeek) {
      var m = data.slides[0];
      if (m && m.kind === "master" && Array.isArray(m.choresToday)) {
        m.choresToday = m.choresToday
          .filter(function (c) {
            return c && c.recurring && String(c.text || "").trim();
          })
          .map(function (c) {
            return { id: c.id || uid(), text: String(c.text || ""), done: false, recurring: true };
          });
      }

      // Reset weekly chore-chart checkoffs
      var chart = data.slides[2];
      if (chart && chart.kind === "chores" && Array.isArray(chart.rows)) {
        chart.rows = chart.rows.map(function (r) {
          if (!r || typeof r !== "object") return r;
          r.checks = [false, false, false, false, false, false, false];
          return r;
        });
      }

      data.settings.lastWeekId = curWeek;
    }

    // Sunday-week rollover for Shopping: clear checked items in Groceries + Home lists.
    if (data.settings.lastSundayWeekId !== curSunWeek) {
      var sh = data.slides[3];
      if (sh && sh.kind === "shopping" && Array.isArray(sh.lists)) {
        sh.lists = sh.lists.map(function (L) {
          var name = String((L && L.name) || "").trim().toLowerCase();
          if (name !== "groceries" && name !== "home") return L;
          var items = Array.isArray(L.items) ? L.items : [];
          L.items = items.filter(function (it) {
            return it && !it.checked;
          });
          return L;
        });
      }
      data.settings.lastSundayWeekId = curSunWeek;
    }
    return data;
  }

  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return ensureFourSlides(defaultData());
      var data = JSON.parse(raw);
      var normalized = ensureFourSlides(data);
      // Persist weekly rollover (or other normalization) immediately.
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch (e) {
      return ensureFourSlides(defaultData());
    }
  }

  function save(data) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(ensureFourSlides(data)));
  }

  function exportJson(data) {
    return JSON.stringify(ensureFourSlides(data), null, 2);
  }

  function importJson(text) {
    var data = JSON.parse(text);
    save(ensureFourSlides(data));
    return load();
  }

  function isValidPayload(o) {
    return !!(o && typeof o === "object" && Array.isArray(o.slides) && o.slides.length === 4);
  }

  global.DashboardStore = {
    STORAGE_KEY: STORAGE_KEY,
    WEEKDAYS: WEEKDAYS,
    load: load,
    save: save,
    exportJson: exportJson,
    importJson: importJson,
    isValidPayload: isValidPayload,
    ensureFourSlides: ensureFourSlides,
    defaultData: defaultData,
    normalizeSlideAt: normalizeSlideAt,
  };
})(window);
