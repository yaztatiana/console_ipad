self.addEventListener("install", function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open("home-console-manage-v1").then(function (cache) {
      var base = new URL(".", self.location.href).href;
      return cache.addAll([
        new URL("./index.html", base).href,
        new URL("./manage.css", base).href,
        new URL("./manage.js", base).href,
        new URL("./manifest.json", base).href,
        new URL("../shared/store.js", base).href,
        new URL("../shared/calendar.js", base).href,
      ]);
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
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
