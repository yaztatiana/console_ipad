(function (global) {
  "use strict";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toISODate(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  }

  /** Monday-start week */
  function startOfWeekMonday(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - day);
    return x;
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }

  function weekDates(anchor) {
    const start = startOfWeekMonday(anchor);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  function parseISO(s) {
    if (!s) return null;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t);
  }

  function eventsInRange(events, start, end) {
    const s = start.getTime();
    const e = end.getTime();
    return (events || []).filter(function (ev) {
      const t = parseISO(ev.start);
      if (!t) return false;
      const ts = t.getTime();
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
