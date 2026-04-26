var MANAGE_CACHE = "home-console-manage-v22";

self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(MANAGE_CACHE).then(function (cache) {
      var base = new URL(".", self.location.href).href;
      var urls = [
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
      ];
      // cache.addAll fails the whole install if any URL fails; be resilient.
      return Promise.all(
        urls.map(function (u) {
          return cache.add(u).catch(function () {
            return null;
          });
        })
      );
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
    (function () {
      var url = new URL(req.url);
      var path = url.pathname || "";
      var isHtml = req.mode === "navigate" || path.endsWith(".html");
      var isAsset =
        path.endsWith(".js") ||
        path.endsWith(".css") ||
        path.endsWith(".json") ||
        path.endsWith(".woff2") ||
        path.endsWith(".png") ||
        path.endsWith(".svg");

      // Network-first for HTML + JS/CSS so deployments take effect quickly.
      if (isHtml || isAsset) {
        return fetch(req)
          .then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(MANAGE_CACHE).then(function (cache) {
                cache.put(req, copy).catch(function () {});
              });
            }
            return res;
          })
          .catch(function () {
            return caches.match(req).then(function (cached) {
              if (cached) return cached;
              return caches.match(new URL("./index.html", self.location.href));
            });
          });
      }

      return caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).catch(function () {
          return caches.match(new URL("./index.html", self.location.href));
        });
      });
    })()
  );
});
