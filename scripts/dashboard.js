const API_BASE = "http://localhost:5000";
const JWT = localStorage.getItem("access_token");

let currentPage = 1;
let currentLimit = 10;
let map, plannedMarker, actualMarker, lineLayer;
let chart;
let currentType = "line";

/* -------------------- helpers -------------------- */
function authHeaders() {
  return JWT ? { Authorization: `Bearer ${JWT}` } : {};
}
function applyTheme(mode) {
  if (mode === "dark") document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
}
function statusEmoji(distance, within200) {
  if (within200 || distance < 200) return "🟢";
  if (distance <= 300 && distance >= 200) return "🟡";
  return "🔴";
}
function fmtDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
function reasonLabel(r) {
  const m = {
    making_order: "Making Order",
    delivering_order: "Delivering Order",
    bill_collection: "Bill Collection",
    receiving_returns: "Receiving Returns",
  };
  return m[r] || r;
}
function debounce(fn, ms = 200) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
function valueLooksLikeId(v = "") {
  return /^\d+$/.test((v || "").trim());
}
function valueLooksLikeIdNumOrStoredId(inputEl) {
  if (!inputEl) return "";
  if (inputEl.dataset.id) return inputEl.dataset.id;
  if (valueLooksLikeId(inputEl.value)) return inputEl.value.trim();
  return "";
}

function createMenu() {
  const el = document.createElement("div");
  el.className = "autocomplete-menu";
  el.style.display = "none";
  document.body.appendChild(el);
  return el;
}
function placeMenu(menu, input) {
  const r = input.getBoundingClientRect();
  menu.style.left = `${r.left + window.scrollX}px`;
  menu.style.top = `${r.bottom + window.scrollY + 4}px`;
  menu.style.width = `${r.width}px`;
}
function makeAutocomplete(input, options) {
  const menu = createMenu();
  let items = [];
  let activeIdx = -1;

  function hide() {
    menu.style.display = "none";
    menu.innerHTML = "";
    activeIdx = -1;
  }
  function show() {
    placeMenu(menu, input);
    menu.style.display = "block";
  }
  function render(list) {
    items = list || [];
    menu.innerHTML = "";
    if (!items.length) {
      hide();
      return;
    }
    items.forEach((it, i) => {
      const div = document.createElement("div");
      div.className = "autocomplete-item" + (i === activeIdx ? " active" : "");
      div.innerHTML = `
        <span class="autocomplete-label">${it.label}</span>
        ${
          it.sublabel
            ? `<span class="autocomplete-sublabel">${it.sublabel}</span>`
            : ""
        }
      `;
      div.addEventListener("mousedown", (e) => {
        e.preventDefault();
        pick(i);
      });
      menu.appendChild(div);
    });
    show();
  }
  function pick(i) {
    const it = items[i];
    if (!it) return;
    input.value = it.label; // show only label (no id)
    input.dataset.id = String(it.id); // keep id hidden
    hide();
    options.onPick?.(it);
  }

  async function update(term) {
    try {
      const data = await options.source(term);
      render(data);
    } catch {
      hide();
    }
  }
  const debouncedUpdate = debounce(update, 150);

  input.addEventListener("focus", () => {
    input.dataset.id = "";
    placeMenu(menu, input);
    update("");
  });
  input.addEventListener("input", (e) => {
    input.dataset.id = "";
    debouncedUpdate(e.target.value || "");
  });
  input.addEventListener("blur", () => setTimeout(hide, 120));
  window.addEventListener(
    "scroll",
    () => {
      if (menu.style.display === "block") placeMenu(menu, input);
    },
    { passive: true }
  );
  window.addEventListener("resize", () => {
    if (menu.style.display === "block") placeMenu(menu, input);
  });

  input.addEventListener("keydown", (e) => {
    if (menu.style.display !== "block") return;
    const max = items.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIdx = Math.min(max, activeIdx + 1);
      render(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIdx = Math.max(0, activeIdx - 1);
      render(items);
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        pick(activeIdx);
      }
    } else if (e.key === "Escape") {
      hide();
    }
  });

  return { destroy: () => menu.remove() };
}

const usersCache = { loaded: false, list: [] };
let customersCache = { loaded: false, list: [] };

async function ensureUsers() {
  if (usersCache.loaded) return usersCache.list;
  const res = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
  usersCache.loaded = true;
  if (!res.ok) {
    usersCache.list = [];
    return usersCache.list;
  }
  const data = await res.json();
  usersCache.list =
    (data.users || []).map((u) => ({
      id: u.user_id,
      name: u.username || `User #${u.user_id}`,
      email: u.email || "",
    })) || [];
  return usersCache.list;
}

async function ensureCustomersAll() {
  if (customersCache.loaded) return customersCache.list;
  const url = new URL(`${API_BASE}/customers`);
  url.searchParams.set("all", "true");
  const res = await fetch(url, { headers: authHeaders() });
  customersCache.loaded = true;
  if (!res.ok) {
    customersCache.list = [];
    return customersCache.list;
  }
  const data = await res.json();
  customersCache.list =
    (data.customers || []).map((c) => {
      const name =
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() ||
        "Customer";
      const sub = c.code ? `Code: ${c.code}` : c.phone || "";
      return { id: c.customer_id, name, sub };
    }) || [];
  return customersCache.list;
}

async function usersSource(term = "") {
  const all = await ensureUsers();
  const t = term.trim().toLowerCase();
  const filtered = !t
    ? all
    : all.filter(
        (u) =>
          u.name.toLowerCase().includes(t) ||
          (u.email && u.email.toLowerCase().includes(t)) ||
          String(u.id).includes(t)
      );
  return filtered.slice(0, 300).map((u) => ({
    id: u.id,
    label: u.name,
  }));
}

async function customersSource(term = "") {
  const all = await ensureCustomersAll();
  const t = term.trim().toLowerCase();
  const filtered = !t
    ? all
    : all.filter(
        (c) =>
          c.name.toLowerCase().includes(t) ||
          (c.sub && c.sub.toLowerCase().includes(t)) ||
          String(c.id).includes(t)
      );
  return filtered.slice(0, 300).map((c) => ({
    id: c.id,
    label: c.name,
    sublabel: c.sub || undefined,
  }));
}

function wireAutocompleteFields() {
  const userInput = document.getElementById("userFilter");
  const custInput = document.getElementById("customerFilter");

  makeAutocomplete(userInput, {
    source: usersSource,
    onPick: () => {},
  });

  makeAutocomplete(custInput, {
    source: customersSource,
    onPick: () => {},
  });
}

function buildQuery() {
  const userEl = document.getElementById("userFilter");
  const custEl = document.getElementById("customerFilter");

  const userId = valueLooksLikeIdNumOrStoredId(userEl);
  const customerId = valueLooksLikeIdNumOrStoredId(custEl);

  const params = new URLSearchParams();
  if (userId) params.set("user_id", userId);
  if (customerId) params.set("customer_id", customerId);
  params.set("page", currentPage);
  params.set("limit", currentLimit);
  return params.toString();
}

async function fetchVisits() {
  const res = await fetch(`${API_BASE}/visits?${buildQuery()}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Error" }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}
function renderVisits(data) {
  const tbody = document.getElementById("visitsTbody");
  tbody.innerHTML = "";
  if (!data.visits || data.visits.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" style="text-align:center;color:#777">No visits found</td></tr>';
    renderPager(data);
    return;
  }
  for (const v of data.visits) {
    const within = !!v.within_200m;
    const dist = Number(v.distance_m ?? 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${statusEmoji(dist, within)}</td>
      <td>${v.username ?? `User #${v.user_id}`}</td>
      <td>${fmtDate(v.arrived_at)}</td>
      <td>${v.customer_name ?? `Customer #${v.customer_id}`}</td>
      <td>${reasonLabel(v.reason)}</td>
      <td>${v.address_text ?? "-"}</td>
      <td>${dist}</td>
      <td><button class="viewBtn">View</button></td>
    `;
    tr.querySelector(".viewBtn").addEventListener("click", () =>
      openMapPopup({
        planned_latitude: v.planned_latitude,
        planned_longitude: v.planned_longitude,
        actual_latitude: v.actual_latitude,
        actual_longitude: v.actual_longitude,
        customer_name: v.customer_name ?? `Customer #${v.customer_id}`,
        address_text: v.address_text ?? "-",
        distance_m: dist,
        within_200m: within,
      })
    );
    tbody.appendChild(tr);
  }
  renderPager(data);
}
function renderPager({ page, limit, total, count }) {
  const pi = document.getElementById("pageInfo");
  const totalPages = Math.max(
    1,
    Math.ceil((total || 0) / (limit || currentLimit))
  );
  pi.textContent = `Page ${page} of ${totalPages} • ${count}/${total} shown`;
  document.getElementById("prevPageBtn").disabled = page <= 1;
  document.getElementById("nextPageBtn").disabled = page >= totalPages;
}
async function loadVisits() {
  const tbody = document.getElementById("visitsTbody");
  tbody.innerHTML =
    '<tr><td colspan="8" style="text-align:center;color:#777">Loading…</td></tr>';
  try {
    const data = await fetchVisits();
    currentPage = data.page;
    renderVisits(data);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#c00">Error: ${e.message}</td></tr>`;
  }
}

let _visitMap, _plannedMarker, _actualMarker, _lineLayer;

function closeMapPopup() {
  const modal = document.getElementById("mapModal");
  if (modal) modal.classList.remove("show");
}

function numOrNaN(v) {
  return v === null || v === undefined || v === "" ? NaN : Number(v);
}

function openMapPopup(payload) {
  const modal = document.getElementById("mapModal");
  const mapEl = document.getElementById("map");
  if (!modal || !mapEl) {
    console.error("Map modal or map element not found");
    return;
  }

  // Show modal first so Leaflet can size correctly
  modal.classList.add("show");

  const {
    planned_latitude: pLat,
    planned_longitude: pLon,
    actual_latitude: aLat,
    actual_longitude: aLon,
    customer_name,
    address_text,
    distance_m,
    within_200m,
  } = payload || {};

  const pLatN = numOrNaN(pLat);
  const pLonN = numOrNaN(pLon);
  const aLatN = numOrNaN(aLat);
  const aLonN = numOrNaN(aLon);

  const center =
    !Number.isNaN(pLatN) && !Number.isNaN(pLonN)
      ? [pLatN, pLonN]
      : !Number.isNaN(aLatN) && !Number.isNaN(aLonN)
      ? [aLatN, aLonN]
      : [30.0444, 31.2357]; // Cairo fallback

  // Create or reuse the map
  if (!_visitMap) {
    _visitMap = L.map(mapEl).setView(center, 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(_visitMap);
  } else {
    _visitMap.invalidateSize();
    _visitMap.setView(center, 15);
  }

  // Clear old layers
  if (_plannedMarker) _visitMap.removeLayer(_plannedMarker);
  if (_actualMarker) _visitMap.removeLayer(_actualMarker);
  if (_lineLayer) _visitMap.removeLayer(_lineLayer);

  // Add markers if available
  if (!Number.isNaN(pLatN) && !Number.isNaN(pLonN)) {
    _plannedMarker = L.marker([pLatN, pLonN], {
      icon: L.icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        iconSize: [32, 32],
      }),
    })
      .addTo(_visitMap)
      .bindPopup(
        `<b>Planned</b><br>${customer_name || ""}<br>${address_text || ""}`
      );
  } else {
    _plannedMarker = null;
  }

  if (!Number.isNaN(aLatN) && !Number.isNaN(aLonN)) {
    _actualMarker = L.marker([aLatN, aLonN], {
      icon: L.icon({
        iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        iconSize: [32, 32],
      }),
    })
      .addTo(_visitMap)
      .bindPopup(
        `<b>Actual</b><br>Distance: ${distance_m ?? "-"} m<br>Status: ${
          within_200m ? "Within 200m" : "Outside 200m"
        }`
      );
  } else {
    _actualMarker = null;
  }

  if (_plannedMarker && _actualMarker) {
    _lineLayer = L.polyline(
      [_plannedMarker.getLatLng(), _actualMarker.getLatLng()],
      { weight: 3 }
    ).addTo(_visitMap);
    _visitMap.fitBounds(
      L.featureGroup([_plannedMarker, _actualMarker]).getBounds().pad(0.5)
    );
    _plannedMarker.openPopup();
  } else if (_plannedMarker) {
    _visitMap.setView(_plannedMarker.getLatLng(), 15);
    _plannedMarker.openPopup();
  } else if (_actualMarker) {
    _visitMap.setView(_actualMarker.getLatLng(), 15);
    _actualMarker.openPopup();
  } else {
    L.popup()
      .setLatLng(center)
      .setContent("No coordinates for this visit.")
      .openOn(_visitMap);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("closeMapBtn")
    ?.addEventListener("click", closeMapPopup);
});

async function loadRankingData(mode = "amount") {
  try {
    const url =
      mode === "amount"
        ? `${API_BASE}/users/ranking?total_amount=true`
        : `${API_BASE}/users/ranking?total_number=true`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...authHeaders() },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Error" }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const users = data.ranking || [];
    const tbody = document.getElementById("delegatesTable");
    if (tbody) {
      tbody.innerHTML = "";
      users.forEach((u) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${u.name}</td><td>${
          u.total_orders_amount ?? "-"
        }</td><td>${u.total_orders_all ?? "-"}</td>`;
        tbody.appendChild(tr);
      });
    }
    const labels = users.map((u) => u.name);
    const dataset =
      mode === "amount"
        ? users.map((u) => u.total_orders_amount)
        : users.map((u) => u.total_orders_all);

    const canvas = document.getElementById("delegatesChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    if (!chart) {
      chart = new Chart(ctx, {
        type: currentType,
        data: {
          labels,
          datasets: [
            {
              label: "Sales",
              data: dataset,
              borderColor: "#0b2a59",
              backgroundColor:
                currentType === "bar"
                  ? "rgba(0,123,255,0.4)"
                  : "rgba(0,123,255,0.1)",
              borderWidth: 2,
              tension: 0.4,
              fill: currentType === "line",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = dataset;
      chart.update();
    }
  } catch (err) {
    console.error("Error fetching ranking data:", err);
  }
}
function changeChartType(type) {
  currentType = type;
  if (chart) {
    chart.destroy();
    chart = null;
    const val = document.getElementById("dataType")?.value || "sales";
    loadRankingData(val === "sales" ? "amount" : "orders");
  }
}
window.showChart = changeChartType;
window.changeDataset = (val) =>
  loadRankingData(val === "sales" ? "amount" : "orders");

document.addEventListener("DOMContentLoaded", async () => {
  wireAutocompleteFields();
  loadVisits();
  await loadRankingData("amount");

  const applyBtn = document.getElementById("applyFiltersBtn");
  const clearBtn = document.getElementById("clearFiltersBtn");
  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  applyBtn?.addEventListener("click", () => {
    currentPage = 1;
    loadVisits();
  });

  clearBtn?.addEventListener("click", () => {
    const uf = document.getElementById("userFilter");
    const cf = document.getElementById("customerFilter");
    if (uf) {
      uf.value = "";
      uf.dataset.id = "";
    }
    if (cf) {
      cf.value = "";
      cf.dataset.id = "";
    }
    currentPage = 1;
    loadVisits();
  });

  prevBtn?.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadVisits();
    }
  });
  nextBtn?.addEventListener("click", () => {
    currentPage++;
    loadVisits();
  });

  document
    .getElementById("closeMapBtn")
    ?.addEventListener("click", closeMapPopup);

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") applyTheme("dark");
  window.addEventListener("message", (event) => {
    if (event.data?.theme) {
      applyTheme(event.data.theme);
      localStorage.setItem("theme", event.data.theme);
    }
  });

  document.getElementById("dataType")?.addEventListener("change", (e) => {
    const v = e.target.value;
    loadRankingData(v === "sales" ? "amount" : "orders");
  });
  document
    .getElementById("chartLine")
    ?.addEventListener("click", () => changeChartType("line"));
  document
    .getElementById("chartBar")
    ?.addEventListener("click", () => changeChartType("bar"));
});
