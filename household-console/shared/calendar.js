(function (global) {
  "use strict";

  /** ES5-friendly pad (no String.prototype.padStart). */
  function pad2(n) {
    var s = String(n);
    return s.length < 2 ? "0" + s : s;
  }

  function toISODate(d) {
    var x = new Date(d);
    return x.getFullYear() + "-" + pad2(x.getMonth() + 1) + "-" + pad2(x.getDate());
  }

  /** Monday-start week */
  function startOfWeekMonday(d) {
    var x = new Date(d);
    var day = (x.getDay() + 6) % 7;
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - day);
    return x;
  }

  function addDays(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function weekDates(anchor) {
    var start = startOfWeekMonday(anchor);
    var out = [];
    var i;
    for (i = 0; i < 7; i++) {
      out.push(addDays(start, i));
    }
    return out;
  }

  function parseISO(s) {
    if (!s) return null;
    var t = Date.parse(s);
    if (typeof t !== "number" || t !== t) return null;
    return new Date(t);
  }

  function eventsInRange(events, start, end) {
    var s = start.getTime();
    var e = end.getTime();
    return (events || []).filter(function (ev) {
      var t = parseISO(ev.start);
      if (!t) return false;
      var ts = t.getTime();
      return ts >= s && ts <= e;
    });
  }

  function sameDay(a, b) {
    return toISODate(a) === toISODate(b);
  }

  global.HouseholdCalendar = {
    toISODate: toISODate,
    startOfWeekMonday: startOfWeekMonday,
    addDays: addDays,
    weekDates: weekDates,
    parseISO: parseISO,
    eventsInRange: eventsInRange,
    sameDay: sameDay,
  };
})(window);
