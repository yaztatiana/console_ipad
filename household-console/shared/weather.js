(function (global) {
  "use strict";

  var DS = global.DashboardStore;

  function clamp(n, a, b) {
    if (n < a) return a;
    if (n > b) return b;
    return n;
  }

  function safeNum(x) {
    var n = Number(x);
    return n === n ? n : null;
  }

  function weatherCodeToText(code) {
    // Open-Meteo weather codes
    code = Number(code);
    if (code === 0) return "Clear";
    if (code === 1) return "Mostly clear";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Overcast";
    if (code === 45 || code === 48) return "Fog";
    if (code === 51 || code === 53 || code === 55) return "Drizzle";
    if (code === 56 || code === 57) return "Freezing drizzle";
    if (code === 61 || code === 63 || code === 65) return "Rain";
    if (code === 66 || code === 67) return "Freezing rain";
    if (code === 71 || code === 73 || code === 75) return "Snow";
    if (code === 77) return "Snow grains";
    if (code === 80 || code === 81 || code === 82) return "Rain showers";
    if (code === 85 || code === 86) return "Snow showers";
    if (code === 95) return "Thunderstorm";
    if (code === 96 || code === 99) return "Thunderstorm (hail)";
    return "Weather";
  }

  function toF(c) {
    var n = safeNum(c);
    if (n == null) return null;
    return Math.round((n * 9) / 5 + 32);
  }

  function weekdayLabelForIsoDate(isoDate, timeZone) {
    try {
      return new Date(isoDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", timeZone: timeZone });
    } catch (e) {
      return "";
    }
  }

  function fetchZipLatLon(zip) {
    zip = String(zip || "").trim();
    if (!zip) return Promise.reject(new Error("Missing ZIP"));
    // Zippopotam.us: free, no key. US ZIPs.
    return fetch("https://api.zippopotam.us/us/" + encodeURIComponent(zip), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error(t || "ZIP lookup failed"); });
        return res.json();
      })
      .then(function (j) {
        var p = j && j.places && j.places[0];
        var lat = p ? safeNum(p.latitude) : null;
        var lon = p ? safeNum(p.longitude) : null;
        if (lat == null || lon == null) throw new Error("ZIP lookup missing coordinates");
        return { lat: lat, lon: lon, place: (p["place name"] || "") + (p["state abbreviation"] ? ", " + p["state abbreviation"] : "") };
      });
  }

  function fetchOpenMeteo(lat, lon, timeZone) {
    lat = clamp(lat, -90, 90);
    lon = clamp(lon, -180, 180);
    var tz = String(timeZone || "America/Denver");
    var url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=" +
      encodeURIComponent(String(lat)) +
      "&longitude=" +
      encodeURIComponent(String(lon)) +
      "&current=temperature_2m,weather_code" +
      "&daily=weather_code,temperature_2m_max,temperature_2m_min" +
      "&temperature_unit=fahrenheit" +
      "&timezone=" +
      encodeURIComponent(tz);
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error(t || "Weather fetch failed"); });
        return res.json();
      })
      .then(function (j) {
        return j;
      });
  }

  function applyWeatherToStore(payload, timeZone) {
    var data = DS.load();
    if (!data || !data.slides || !data.slides[0] || data.slides[0].kind !== "master") return false;

    var master = data.slides[0];
    master.weatherToday = master.weatherToday || { temp: "", condition: "" };
    var curTemp = payload && payload.current && payload.current.temperature_2m;
    var curCode = payload && payload.current && payload.current.weather_code;
    var tF = safeNum(curTemp);
    if (tF != null) master.weatherToday.temp = Math.round(tF) + "°F";
    master.weatherToday.condition = weatherCodeToText(curCode);

    var d = payload && payload.daily;
    var times = d && d.time;
    var maxs = d && d.temperature_2m_max;
    var mins = d && d.temperature_2m_min;
    var codes = d && d.weather_code;
    if (Array.isArray(times) && Array.isArray(maxs) && Array.isArray(mins) && Array.isArray(codes)) {
      // Use tomorrow +2 +3 (skip index 0 = today)
      var i;
      for (i = 1; i <= 3; i++) {
        if (!master.forecast[i - 1]) master.forecast[i - 1] = { dayLabel: "", high: "", low: "", condition: "" };
        var iso = times[i];
        master.forecast[i - 1].dayLabel = iso ? weekdayLabelForIsoDate(iso, timeZone) : master.forecast[i - 1].dayLabel;
        master.forecast[i - 1].high = safeNum(maxs[i]) != null ? Math.round(Number(maxs[i])) + "°" : "";
        master.forecast[i - 1].low = safeNum(mins[i]) != null ? Math.round(Number(mins[i])) + "°" : "";
        master.forecast[i - 1].condition = weatherCodeToText(codes[i]);
      }
    }

    DS.save(data);
    return true;
  }

  function syncOnce() {
    var data = DS.load();
    if (!data || !data.settings) return Promise.resolve(false);
    if (data.settings.autoWeather === false) return Promise.resolve(false);
    var zip = data.settings.zip || "84010";
    var tz = data.settings.timeZone || "America/Denver";
    return fetchZipLatLon(zip)
      .then(function (loc) {
        return fetchOpenMeteo(loc.lat, loc.lon, tz).then(function (wx) {
          applyWeatherToStore(wx, tz);
          return true;
        });
      })
      .catch(function () {
        return false;
      });
  }

  global.DashboardWeather = {
    syncOnce: syncOnce,
    fetchZipLatLon: fetchZipLatLon,
  };
})(window);

