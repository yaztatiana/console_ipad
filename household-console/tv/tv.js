(function () {
  "use strict";

  var DS = window.DashboardStore;
  var SYNC = window.DashboardSync;
  var idx = 0;
  var slides = [];
  var pollTimer = null;
  var rotateTimer = null;
  var POLL_MS = 30000;

  function $(id) {
    return document.getElementById(id);
  }

  function setHint(text) {
    var el = $("sync-hint");
    if (el) el.textContent = text;
  }

  function renderDots() {
    var box = $("dots");
    if (!box) return;
    box.innerHTML = "";
    var i;
    for (i = 0; i < 4; i++) {
      var d = document.createElement("span");
      d.className = "tv-dot" + (i === idx ? " is-on" : "");
      d.setAttribute("aria-hidden", "true");
      box.appendChild(d);
    }
  }

  function setSlide(next) {
    idx = (next % 4 + 4) % 4;
    var i;
    for (i = 0; i < 4; i++) {
      var el = $("slide-" + i);
      if (!el) continue;
      el.classList.toggle("is-active", i === idx);
      el.setAttribute("aria-hidden", i === idx ? "false" : "true");
    }
    renderDots();
    var active = $("slide-" + idx);
    if (active) active.focus({ preventScroll: true });
  }

  function renderSlideContent() {
    var data = DS.load();
    var t = $("dash-title");
    if (t) t.textContent = data.settings.title || "Dashboard";
    var i;
    for (i = 0; i < 4; i++) {
      var el = $("slide-" + i);
      if (!el) continue;
      el.innerHTML = "";
      var s = data.slides[i] || { title: "Slide " + (i + 1), body: "" };
      var h = document.createElement("h2");
      h.textContent = s.title || "Slide " + (i + 1);
      var p = document.createElement("p");
      p.textContent = s.body || "";
      el.appendChild(h);
      el.appendChild(p);
    }
    slides = document.querySelectorAll(".slide");
  }

  function armRotate() {
    if (rotateTimer) clearInterval(rotateTimer);
    rotateTimer = null;
    var data = DS.load();
    var sec = Number(data.settings.rotationSec);
    if (sec !== sec || sec < 3) sec = 15;
    if (sec > 120) sec = 120;
    var ms = sec * 1000;
    rotateTimer = window.setInterval(function () {
      setSlide(idx + 1);
    }, ms);
  }

  function pullThenRender(silent) {
    SYNC.ready().then(function (ok) {
      if (!ok || !SYNC.getLocalSyncKey()) {
        renderSlideContent();
        setHint("◀ ▶ Change slide · add sync key in Manage for cloud");
        armRotate();
        return;
      }
      SYNC.pull(SYNC.getLocalSyncKey())
        .then(function (remote) {
          if (remote && DS.isValidPayload(remote)) {
            DS.save(remote);
            if (!silent) setHint("◀ ▶ Cloud updated");
          }
          renderSlideContent();
          armRotate();
        })
        .catch(function () {
          renderSlideContent();
          setHint("◀ ▶ Cloud unreachable — showing saved data");
          armRotate();
        });
    });
  }

  function onKeyDown(e) {
    var k = e.key;
    if (k === "ArrowRight" || k === "PageDown") {
      e.preventDefault();
      setSlide(idx + 1);
      armRotate();
    } else if (k === "ArrowLeft" || k === "PageUp") {
      e.preventDefault();
      setSlide(idx - 1);
      armRotate();
    } else if (k === "Home") {
      e.preventDefault();
      setSlide(0);
      armRotate();
    }
  }

  function init() {
    renderSlideContent();
    setSlide(0);
    pullThenRender(true);
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = window.setInterval(function () {
      pullThenRender(true);
    }, POLL_MS);
    document.addEventListener("keydown", onKeyDown);
    armRotate();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
