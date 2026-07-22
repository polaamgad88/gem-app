(function () {
  const { Api, Auth, Async, DOM, Format } = window.Utils;
  const esc = DOM.escapeHtml;

  const FILTER_IDS = [
    "filter-status",
    "filter-driver",
    "filter-sap-order",
    "filter-date-start",
    "filter-date-end",
  ];

  let allDeliveries = [];
  let endpoint = "/deliveries";
  let canSeeAllDrivers = false;
  let expandedAll = false;

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isAdmin = localStorage.getItem("is_admin") === "1";
    const isDriverManager = localStorage.getItem("driver_manager") === "1";
    const isStorageManager = localStorage.getItem("storage_manager") === "1";
    const isDriver = localStorage.getItem("driver") === "1";

    canSeeAllDrivers = isAdmin || isDriverManager || isStorageManager;

    if (!canSeeAllDrivers && !isDriver) {
      alert("You do not have permission to access this page.");
      window.location.href = "dashboard.html";
      return;
    }

    if (!canSeeAllDrivers) {
      endpoint = "/driver/deliveries";
      document.getElementById("page-heading").textContent = "My Deliveries";
      document.getElementById("driver-field").classList.add("hidden");
    }

    wireFilters();
    wireList();

    if (isAdmin || isDriverManager) await loadDriverFilter();

    const presetDriver = new URLSearchParams(location.search).get("driver_user_id");
    if (presetDriver && canSeeAllDrivers) {
      const select = document.getElementById("filter-driver");
      select.value = presetDriver;
      const name = select.selectedOptions[0]?.textContent;
      if (name && select.value) {
        document.getElementById("page-heading").textContent = `Deliveries — ${name}`;
        document.getElementById("back-to-fleet").classList.remove("hidden");
        openFilters(true);
      }
    }

    await loadDeliveries();
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      Api.invalidate(endpoint);
      loadDeliveries();
    }
  });

  function wireFilters() {
    const reload = Async.debounce(loadDeliveries, 250);
    FILTER_IDS.filter((id) => id !== "filter-sap-order").forEach((id) => {
      document.getElementById(id)?.addEventListener("change", loadDeliveries);
    });
    document.getElementById("filter-sap-order")?.addEventListener("input", reload);

    document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
      FILTER_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      loadDeliveries();
    });

    document.getElementById("filters-toggle")?.addEventListener("click", () => {
      openFilters(document.getElementById("filters-panel").classList.contains("hidden"));
    });

    document.getElementById("refresh-btn")?.addEventListener("click", () => {
      Api.invalidate(endpoint);
      loadDeliveries();
    });

    document.getElementById("expand-all-btn")?.addEventListener("click", () => {
      expandedAll = !expandedAll;
      document.querySelectorAll(".dlv-card").forEach((card) => setOpen(card, expandedAll));
      document.getElementById("expand-all-btn").textContent = expandedAll
        ? "Collapse all"
        : "Expand all";
    });
  }

  function openFilters(open) {
    const panel = document.getElementById("filters-panel");
    const toggle = document.getElementById("filters-toggle");
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.classList.toggle("open", open);
  }

  function activeFilterCount() {
    return FILTER_IDS.reduce((n, id) => {
      if (id === "filter-driver" && !canSeeAllDrivers) return n;
      const el = document.getElementById(id);
      if (!el) return n;
      return el.value ? n + 1 : n;
    }, 0);
  }

  function paintFilterCount() {
    const badge = document.getElementById("filters-count");
    const n = activeFilterCount();
    badge.textContent = n;
    badge.classList.toggle("hidden", n === 0);
  }

  async function loadDriverFilter() {
    try {
      const data = await Api.get("/drivers");
      const select = document.getElementById("filter-driver");
      const options = (data.drivers || [])
        .map((d) => `<option value="${d.user_id}">${esc(d.username)}</option>`)
        .join("");
      select.innerHTML = `<option value="">All drivers</option>${options}`;
    } catch (err) {
      console.error("Could not load drivers for the filter:", err);
    }
  }

  async function loadDeliveries() {
    const loading = document.getElementById("deliveries-loading");
    loading?.classList.remove("hidden");
    paintFilterCount();
    try {
      const dateStart = document.getElementById("filter-date-start")?.value;
      const dateEnd = document.getElementById("filter-date-end")?.value;
      const query = {
        status: document.getElementById("filter-status")?.value || "",
        sap_order_id: document.getElementById("filter-sap-order")?.value || "",
        date_start: dateStart ? `${dateStart} 00:00:00` : "",
        date_end: dateEnd ? `${dateEnd} 23:59:59` : "",
      };
      if (canSeeAllDrivers) {
        query.driver_user_id = document.getElementById("filter-driver")?.value || "";
      }
      const data = await Api.get(endpoint, { query });
      allDeliveries = data.deliveries || [];
      render(allDeliveries);
    } catch (err) {
      console.error("Failed to load deliveries:", err);
      alert(err.data?.message || err.message || "Could not load deliveries.");
    } finally {
      loading?.classList.add("hidden");
    }
  }

  function statusPill(status) {
    const slug = String(status || "").replace(/\s+/g, "-");
    return `<span class="result-pill result-pill--${esc(slug)}">${esc(status || "-")}</span>`;
  }

  function itemTotals(delivery) {
    return (delivery.items || []).reduce(
      (acc, i) => {
        acc.ordered += Number(i.qty_ordered || 0);
        acc.delivered += Number(i.qty_delivered || 0);
        acc.returned += Number(i.qty_returned || 0);
        return acc;
      },
      { ordered: 0, delivered: 0, returned: 0 }
    );
  }

  function render(deliveries) {
    const list = document.getElementById("delivery-list");
    const empty = document.getElementById("deliveries-empty");
    if (!list) return;

    empty?.classList.toggle("hidden", deliveries.length > 0);
    renderSummary(deliveries);

    expandedAll = false;
    const expandBtn = document.getElementById("expand-all-btn");
    if (expandBtn) expandBtn.textContent = "Expand all";

    const frag = document.createDocumentFragment();
    deliveries.forEach((d) => frag.appendChild(buildCard(d)));
    list.replaceChildren(frag);
  }

  function buildCard(d) {
    const slug = String(d.status || "").replace(/\s+/g, "-");
    const totals = itemTotals(d);
    const when = d.delivered_at ? Format.dateSlash(d.delivered_at) : "—";
    const customer = d.customer?.name || "—";
    const code = d.customer?.code ? ` (${d.customer.code})` : "";

    const card = document.createElement("article");
    card.className = `dlv-card dlv-card--${slug}`;
    card.dataset.deliveryId = d.delivery_id;

    const meta = [];
    if (canSeeAllDrivers) meta.push(esc(d.driver?.username || "—"));
    if (d.car?.plate) meta.push(`<span class="plate">${esc(d.car.plate)}</span>`);
    meta.push(`${esc(totals.delivered)}/${esc(totals.ordered)} delivered`);

    card.innerHTML = `
      <button type="button" class="dlv-head" aria-expanded="false">
        <span class="chev" aria-hidden="true"></span>
        <span class="dlv-head-main">
          <span class="dlv-title">
            <strong>#${esc(d.sap_order_id)}</strong>
            ${statusPill(d.status)}
            ${
              d.sap_reviewed_at_delivery
                ? ""
                : `<span class="warn-dot" title="Order was not reviewed when delivered">!</span>`
            }
          </span>
          <span class="dlv-customer">${esc(customer)}<span class="muted">${esc(code)}</span></span>
          <span class="dlv-meta">${meta.join('<span class="dot">·</span>')}</span>
        </span>
        <span class="dlv-when">${esc(when)}</span>
      </button>
      <div class="dlv-body"><div class="dlv-body-inner"></div></div>`;

    return card;
  }

  function setOpen(card, open) {
    const head = card.querySelector(".dlv-head");
    const inner = card.querySelector(".dlv-body-inner");
    if (open && !inner.dataset.filled) {
      const id = parseInt(card.dataset.deliveryId, 10);
      const d = allDeliveries.find((x) => x.delivery_id === id);
      if (d) {
        inner.innerHTML = detailHtml(d);
        inner.dataset.filled = "1";
      }
    }
    card.classList.toggle("open", open);
    head.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function wireList() {
    const list = document.getElementById("delivery-list");
    list.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      const head = e.target.closest(".dlv-head");
      if (!head) return;
      const card = head.closest(".dlv-card");
      setOpen(card, !card.classList.contains("open"));
    });
  }

  function renderSummary(deliveries) {
    const box = document.getElementById("summary-row");
    if (!box) return;
    if (!deliveries.length) {
      box.innerHTML = "";
      return;
    }
    const counts = {};
    let unreviewed = 0;
    deliveries.forEach((d) => {
      counts[d.status] = (counts[d.status] || 0) + 1;
      if (!d.sap_reviewed_at_delivery) unreviewed += 1;
    });

    const tiles = [`<div class="stat-tile"><span>${deliveries.length}</span><small>Total</small></div>`];
    Object.entries(counts).forEach(([status, n]) => {
      const slug = String(status || "").replace(/\s+/g, "-");
      tiles.push(
        `<div class="stat-tile stat-tile--${esc(slug)}"><span>${n}</span><small>${esc(status)}</small></div>`
      );
    });
    if (unreviewed) {
      tiles.push(
        `<div class="stat-tile stat-tile--warn"><span>${unreviewed}</span><small>not reviewed</small></div>`
      );
    }
    box.innerHTML = tiles.join("");
  }

  function locationBlock(d) {
    const lat = d.latitude;
    const lng = d.longitude;
    if (lat == null || lng == null) {
      return `<p class="detail-location detail-location--none">No saved location for this customer address.</p>`;
    }
    const maps = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    return `
      <p class="detail-location">
        <strong>Customer location</strong>
        <span class="coords">${esc(`${lat}, ${lng}`)}</span>
        <a href="${esc(maps)}" target="_blank" rel="noopener noreferrer" class="map-link">Open in Maps</a>
      </p>`;
  }

  function detailHtml(d) {
    const totals = itemTotals(d);
    const rows = (d.items || [])
      .map(
        (i) => `
        <tr>
          <td data-label="Item">${esc(i.product_name || "-")}</td>
          <td data-label="Ordered">${esc(i.qty_ordered)}</td>
          <td data-label="Delivered">${esc(i.qty_delivered)}</td>
          <td data-label="Returned">${esc(i.qty_returned)}</td>
        </tr>`
      )
      .join("");

    const facts = [
      ["Delivery", `#${esc(d.delivery_id)}`],
      ["SAP order", `#${esc(d.sap_order_id)}`],
      ["When", esc(d.delivered_at ? Format.dateSlash(d.delivered_at) : "—")],
      ["Customer code", esc(d.customer?.code || "—")],
      ["Phone", esc(d.customer?.phone || "—")],
    ];
    if (canSeeAllDrivers) facts.splice(2, 0, ["Driver", esc(d.driver?.username || "—")]);
    facts.splice(canSeeAllDrivers ? 3 : 2, 0, ["Car", esc(d.car?.plate || "—")]);

    return `
      <div class="detail-grid">
        ${facts.map(([k, v]) => `<div><small>${k}</small><span>${v}</span></div>`).join("")}
      </div>

      <p class="detail-address"><strong>Address</strong> ${esc(d.address || "—")}</p>

      ${locationBlock(d)}

      ${
        d.sap_reviewed_at_delivery
          ? ""
          : `<p class="detail-warning">The SAP order had not been reviewed when this delivery was recorded.</p>`
      }

      ${d.note ? `<p class="detail-note"><strong>Note</strong> ${esc(d.note)}</p>` : ""}

      <div class="table-wrapper">
        <table class="items-table">
          <thead>
            <tr><th>Item</th><th>Ordered</th><th>Delivered</th><th>Returned</th></tr>
          </thead>
          <tbody>${rows || `<tr><td colspan="4">No items recorded.</td></tr>`}</tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>${totals.ordered}</strong></td>
              <td><strong>${totals.delivered}</strong></td>
              <td><strong>${totals.returned}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }
})();
