var MANAGE_CACHE = "home-console-manage-v14";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(MANAGE_CACHE).then(function (cache) {
      var base = new URL(".", self.location.href).href;
      return cache.addAll([
        new URL("./index.html", base).href,
        new URL("./manage.css", base).href,
        new URL("./manage.js", base).href,
        new URL("./manifest.json", base).href,
        new URL("../shared/theme.css", base).href,
        new URL("../shared/themes.js", base).href,
        new URL("../shared/themes/fonts.css", base).href,
        new URL("../shared/themes/sailor-moon-prism.css", base).href,
        new URL("../shared/themes/sailor-sky.css", base).href,
        new URL("../shared/themes/academia-night.css", base).href,
        new URL("../shared/themes/vegas-street.css", base).href,
        new URL("../shared/store.js", base).href,
        new URL("../shared/calendar.js", base).href,
        new URL("../shared/sync.js", base).href,
      ]);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== MANAGE_CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).catch(function () {
        return caches.match(new URL("./index.html", self.location.href));
      });
    })
  );
});
