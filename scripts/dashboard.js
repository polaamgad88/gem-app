const API_BASE = "http://localhost:5000";
const JWT = localStorage.getItem("access_token");

let currentPage = 1;
let currentLimit = 10;
let map, plannedMarker, actualMarker, lineLayer;
let chart;
let currentType = "line";

function authHeaders() {
  return JWT ? { Authorization: `Bearer ${JWT}` } : {};
}
function applyTheme(mode) {
  if (mode === "dark") document.body.classList.add("dark-mode");
  else document.body.classList.remove("dark-mode");
}
function statusEmoji(distance, within200) {
  console.log("Distance:", distance, "Within 200m:", within200);
  if (within200 || distance < 200) {
    return "🟢";
  } else {
    if (distance <= 300 && distance >= 200) return "🟡";
    else if (distance > 300) return "🔴";
  }
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
function buildQuery() {
  const userId = document.getElementById("userFilter").value.trim();
  const customerId = document.getElementById("customerFilter").value.trim();
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

function openMapPopup(payload) {
  const modal = document.getElementById("mapModal");
  modal.style.display = "flex";
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
  const toFloat = (v) =>
    v === null || v === undefined || v === "" ? NaN : Number(v);

  const pLatN = toFloat(pLat);
  const pLonN = toFloat(pLon);
  const aLatN = toFloat(aLat);
  const aLonN = toFloat(aLon);
  setTimeout(() => {
    const mapEl = document.getElementById("map");
    if (!map) {
      map = L.map(mapEl).setView([pLatN, pLonN], 15);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
    } else {
      map.invalidateSize();
    }
    if (plannedMarker) map.removeLayer(plannedMarker);
    if (actualMarker) map.removeLayer(actualMarker);
    if (lineLayer) map.removeLayer(lineLayer);

    const markers = [];

    if (typeof pLatN === "number" && typeof pLonN === "number") {
      plannedMarker = L.marker([pLatN, pLonN], {
        icon: L.icon({
          iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
          iconSize: [32, 32],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<b>Planned</b><br>${customer_name || ""}<br>${address_text || ""}`
        );
      markers.push(plannedMarker);
    } else console.log("error");
    if (typeof aLatN === "number" && typeof aLonN === "number") {
      actualMarker = L.marker([aLatN, aLonN], {
        icon: L.icon({
          iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
          iconSize: [32, 32],
        }),
      })
        .addTo(map)
        .bindPopup(
          `<b>Actual</b><br>Distance: ${distance_m} m<br>Status: ${
            within_200m ? "Within 200m" : "Outside 200m"
          }`
        );
      markers.push(actualMarker);
    }
    if (plannedMarker && actualMarker) {
      lineLayer = L.polyline(
        [plannedMarker.getLatLng(), actualMarker.getLatLng()],
        { weight: 3 }
      ).addTo(map);
      map.fitBounds(
        L.featureGroup([plannedMarker, actualMarker]).getBounds().pad(0.5)
      );
      plannedMarker.openPopup();
    } else if (plannedMarker) {
      map.setView(plannedMarker.getLatLng(), 15);
      plannedMarker.openPopup();
    } else if (actualMarker) {
      map.setView(actualMarker.getLatLng(), 15);
      actualMarker.openPopup();
    }
  }, 150);
}
function closeMapPopup() {
  document.getElementById("mapModal").style.display = "none";
}

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
    tbody.innerHTML = "";
    users.forEach((u) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${u.name}</td><td>${
        u.total_orders_amount ?? "-"
      }</td><td>${u.total_orders_all ?? "-"}</td>`;
      tbody.appendChild(tr);
    });
    const labels = users.map((u) => u.name);
    const dataset =
      mode === "amount"
        ? users.map((u) => u.total_orders_amount)
        : users.map((u) => u.total_orders_all);
    if (!chart) {
      const ctx = document.getElementById("delegatesChart").getContext("2d");
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
    const v = document.getElementById("dataType")?.value || "visits";
    loadRankingData(v === "sales" || v === "visits" ? "amount" : "orders");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadVisits();
  loadRankingData("amount");

  document.getElementById("applyFiltersBtn").addEventListener("click", () => {
    currentPage = 1;
    loadVisits();
  });
  document.getElementById("clearFiltersBtn").addEventListener("click", () => {
    document.getElementById("userFilter").value = "";
    document.getElementById("customerFilter").value = "";
    currentPage = 1;
    loadVisits();
  });
  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadVisits();
    }
  });
  document.getElementById("nextPageBtn").addEventListener("click", () => {
    currentPage++;
    loadVisits();
  });
  document
    .getElementById("closeMapBtn")
    .addEventListener("click", closeMapPopup);

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") applyTheme("dark");
  window.addEventListener("message", (event) => {
    if (event.data?.theme) {
      applyTheme(event.data.theme);
      localStorage.setItem("theme", event.data.theme);
    }
  });

  document.getElementById("dataType").addEventListener("change", (e) => {
    const v = e.target.value;
    loadRankingData(v === "sales" || v === "visits" ? "amount" : "orders");
  });
  document
    .getElementById("chartLine")
    .addEventListener("click", () => changeChartType("line"));
  document
    .getElementById("chartBar")
    .addEventListener("click", () => changeChartType("bar"));
});
