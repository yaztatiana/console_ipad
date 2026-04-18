(function () {
  const logEl = document.getElementById("sys-log");
  const headEl = document.getElementById("manifest-head");
  const bodyEl = document.getElementById("manifest-body");
  const footEl = document.getElementById("manifest-foot");
  const linkEl = document.getElementById("link-state");
  const clockEl = document.getElementById("clock");
  const refEl = document.getElementById("session-ref");

  function appendLog(line) {
    const t = new Date().toISOString().slice(11, 19);
    logEl.textContent += `\n> [${t}] ${line}`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setLink(state, ok) {
    linkEl.textContent = "Fil: " + state;
    linkEl.style.color = ok ? "rgba(247, 242, 232, 0.65)" : "var(--gold-bright)";
  }

  function padSessionRef() {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    refEl.textContent = hex;
  }

  function tickClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString(undefined, { hour12: false });
  }

  function renderTable(orders) {
    headEl.innerHTML = "";
    bodyEl.innerHTML = "";
    if (!orders.length) {
      footEl.textContent = "Aucune entrée — le registre attend sa première ligne.";
      return;
    }
    const keys = Object.keys(orders[0]);
    const trh = document.createElement("tr");
    keys.forEach((k) => {
      const th = document.createElement("th");
      th.textContent = k;
      trh.appendChild(th);
    });
    headEl.appendChild(trh);

    orders.forEach((row) => {
      const tr = document.createElement("tr");
      keys.forEach((k) => {
        const td = document.createElement("td");
        const v = row[k];
        td.textContent = v === null || v === undefined ? "—" : String(v);
        tr.appendChild(td);
      });
      bodyEl.appendChild(tr);
    });
    footEl.textContent = `Lignes calligraphiées : ${orders.length}`;
  }

  async function loadOrders() {
    setLink("tisse…", true);
    try {
      const res = await fetch("/api/orders?limit=150", { credentials: "same-origin" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail || res.statusText;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      const data = await res.json();
      const orders = data.orders || [];
      renderTable(orders);
      setLink("ouvert", true);
      appendLog("Fil de soie tendu — manifeste rafraîchi.");
    } catch (e) {
      setLink("rompu", false);
      appendLog("Nœud défait : " + (e && e.message ? e.message : String(e)));
    }
  }

  padSessionRef();
  tickClock();
  setInterval(tickClock, 1000);

  appendLog("Trois coups — poignée de main avec le registre…");
  loadOrders();
  setInterval(loadOrders, 60_000);
})();
