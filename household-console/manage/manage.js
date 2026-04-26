(function () {
  "use strict";

  var DS = window.DashboardStore;
  var SYNC = window.DashboardSync;

  function $(id) {
    return document.getElementById(id);
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

  function buildSlideFields() {
    var wrap = $("slide-fields");
    if (!wrap) return;
    wrap.innerHTML = "";
    var i;
    for (i = 0; i < 4; i++) {
      var card = document.createElement("div");
      card.className = "slide-card";
      card.innerHTML =
        "<h3>Slide " +
        (i + 1) +
        "</h3>" +
        '<div class="manage-row"><label class="manage-label" for="slide-title-' +
        i +
        '">Title</label>' +
        '<input class="manage-input" id="slide-title-' +
        i +
        '" type="text" /></div>' +
        '<div class="manage-row" style="align-items:flex-start"><label class="manage-label" for="slide-body-' +
        i +
        '">Body</label>' +
        '<textarea class="manage-input" id="slide-body-' +
        i +
        '" rows="4"></textarea></div>';
      wrap.appendChild(card);
    }
  }

  function readFormIntoData() {
    var data = DS.load();
    data.settings.title = ($("setting-title") && $("setting-title").value) || data.settings.title;
    var rot = Number(($("setting-rotation") && $("setting-rotation").value) || data.settings.rotationMs);
    data.settings.rotationMs = rot;
    var i;
    for (i = 0; i < 4; i++) {
      var t = $("slide-title-" + i);
      var b = $("slide-body-" + i);
      if (!data.slides[i]) data.slides[i] = { id: "", title: "", body: "" };
      data.slides[i].title = t ? t.value : data.slides[i].title;
      data.slides[i].body = b ? b.value : data.slides[i].body;
    }
    return DS.ensureFourSlides(data);
  }

  function fillForm(data) {
    data = DS.ensureFourSlides(data);
    var st = $("setting-title");
    var sr = $("setting-rotation");
    if (st) st.value = data.settings.title || "";
    if (sr) sr.value = String(data.settings.rotationMs || 15000);
    var sk = $("sync-key");
    if (sk) sk.value = SYNC.getLocalSyncKey() || "";
    var i;
    for (i = 0; i < 4; i++) {
      var t = $("slide-title-" + i);
      var b = $("slide-body-" + i);
      var s = data.slides[i];
      if (t) t.value = s.title || "";
      if (b) b.value = s.body || "";
    }
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
    setSyncStatus("Generated a new key. Save it on this device, then paste the same key on the TV browser (or use Manage on the TV once).");
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
