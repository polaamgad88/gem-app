/* Orders page — perf-refactored.
 * - Uses Utils.Api with TTL cache for users/customers.
 * - DocumentFragment batching for table + cards.
 * - Event delegation for view buttons.
 * - Debounced filter changes.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const { Api, Auth, UI, Format, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  const state = {
    sortOrder: { date: true, price: true },
    allOrders: [],
    allUsers: [],
    allCustomers: [],
    currentPage: 1,
    totalPages: 1,
  };

  const token = await Auth.requireAuth();
  if (!token) return;

  UI.showLoader();
  setupEventListeners();

  try {
    await Promise.all([fetchUsers(), fetchCustomers()]);
    await fetchAndRenderOrders();
  } catch (err) {
    console.error(err);
    UI.showError("Failed to load orders.");
  } finally {
    UI.hideLoader();
  }

  UI.checkScreenSize();
  window.addEventListener("resize", Async.throttle(UI.checkScreenSize, 150));

  // ── Data fetch ─────────────────────────────────────────────────────────

  async function fetchUsers() {
    const data = await Api.getCached("/users", { cacheTtl: 5 * 60 * 1000 });
    state.allUsers = data.users || [];

    const sel = document.getElementById("userFilter");
    if (sel) {
      const frag = document.createDocumentFragment();
      const defaultOpt = document.createElement("option");
      defaultOpt.value = "all";
      defaultOpt.textContent = "All Users";
      frag.appendChild(defaultOpt);
      for (const u of state.allUsers) {
        const opt = document.createElement("option");
        opt.value = u.user_id;
        opt.textContent = u.username;
        frag.appendChild(opt);
      }
      sel.replaceChildren(frag);
    }

    const dl = document.getElementById("modalUserList");
    if (dl) {
      const frag = document.createDocumentFragment();
      for (const u of state.allUsers) {
        const opt = document.createElement("option");
        opt.value = u.username;
        frag.appendChild(opt);
      }
      dl.replaceChildren(frag);
    }
  }

  async function fetchCustomers() {
    const data = await Api.getCached("/customers", {
      query: { all: true },
      cacheTtl: 5 * 60 * 1000,
    });
    state.allCustomers = data.customers || [];

    const dl = document.getElementById("modalCustomerList");
    if (dl) {
      const frag = document.createDocumentFragment();
      for (const c of state.allCustomers) {
        const opt = document.createElement("option");
        opt.value = `${c.first_name} ${c.last_name}`;
        frag.appendChild(opt);
      }
      dl.replaceChildren(frag);
    }
  }

  async function fetchAndRenderOrders(page = 1) {
    UI.showLoader();
    const confirmedOnly = isConfirmedOnly();
    const userId = document.getElementById("userFilter").value;
    const customerName = document.getElementById("customerFilter").value;
    const dateStart = document.getElementById("dateStart").value;
    const dateEnd = document.getElementById("dateEnd").value;
    const updateStart = document.getElementById("updateDateStart").value;
    const updateEnd = document.getElementById("updateDateEnd").value;
    const pageSize = parseInt(document.getElementById("pageSize").value || "25", 10);

    const query = { page, limit: pageSize };
    if (userId !== "all") query.user_id = userId;

    if (customerName && customerName !== "all") {
      // Prefer global customers list (more reliable than current page of orders)
      const match =
        state.allCustomers.find(
          (c) => `${c.first_name} ${c.last_name}` === customerName
        ) ||
        state.allOrders.find((o) => o.customer_name === customerName);
      if (match) query.customer_id = match.customer_id;
    }

    if (dateStart) query.date_start = dateStart;
    if (dateEnd) query.date_end = dateEnd;
    if (updateStart) query.date_start_update = updateStart;
    if (updateEnd) query.date_end_update = updateEnd;

    const path = confirmedOnly ? "/orders/confirmed-chain" : "/orders";

    document.getElementById("ordersTable").innerHTML = "";
    document.getElementById("ordersCards").innerHTML = "";

    try {
      const data = await Api.get(path, { query });
      state.allOrders = data.orders || [];

      renderOrderSummary(data.summary || {});
      state.currentPage = data.page || 1;
      state.totalPages = data.pages || 1;

      if (!state.allOrders.length) {
        renderNoOrders();
        return;
      }

      populateCustomerFilter(state.allOrders);
      renderOrders(state.allOrders);
      renderPagination();
    } catch (err) {
      console.error(err);
      UI.showError(err.message || "Failed to load orders.");
    } finally {
      UI.hideLoader();
    }
  }

  function isConfirmedOnly() {
    return document
      .getElementById("confirmedToggle")
      ?.classList.contains("active");
  }

  // ── Render ─────────────────────────────────────────────────────────────

  function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    const maxButtons = 10;
    const half = Math.floor(maxButtons / 2);
    let startPage = Math.max(1, state.currentPage - half);
    let endPage = startPage + maxButtons - 1;
    if (endPage > state.totalPages) {
      endPage = state.totalPages;
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    const frag = document.createDocumentFragment();
    const mkBtn = (label, page, disabled, active) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.disabled = disabled;
      if (active) btn.className = "active";
      btn.dataset.page = page;
      return btn;
    };

    frag.appendChild(mkBtn("◀", state.currentPage - 1, state.currentPage === 1));
    for (let i = startPage; i <= endPage; i++) {
      frag.appendChild(mkBtn(i, i, false, i === state.currentPage));
    }
    frag.appendChild(
      mkBtn("▶", state.currentPage + 1, state.currentPage === state.totalPages)
    );
    container.replaceChildren(frag);
  }

  function populateCustomerFilter(orders) {
    const sel = document.getElementById("customerFilter");
    if (!sel) return;
    const frag = document.createDocumentFragment();
    const defaultOpt = document.createElement("option");
    defaultOpt.value = "all";
    defaultOpt.textContent = "All Customers";
    frag.appendChild(defaultOpt);
    const seen = new Set();
    for (const o of orders) {
      if (!o.customer_name || seen.has(o.customer_name)) continue;
      seen.add(o.customer_name);
      const opt = document.createElement("option");
      opt.value = o.customer_name;
      opt.textContent = o.customer_name;
      frag.appendChild(opt);
    }
    sel.replaceChildren(frag);
  }

  function renderOrders(orders) {
    const tbody = document.getElementById("ordersTable");
    const cards = document.getElementById("ordersCards");

    const tbodyFrag = document.createDocumentFragment();
    const cardsFrag = document.createDocumentFragment();

    for (const o of orders) {
      const status = (o.status || "").toLowerCase();
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" class="order-checkbox" value="${o.order_id}"></td>
        <td>${esc(o.order_id)}</td>
        <td>${esc(Format.dateSlash(o.update_date))}</td>
        <td>${esc(o.customer_name || "")}</td>
        <td>${esc(o.username || "")}</td>
        <td>${esc(o.role || "")}</td>
        <td><span class="status-${esc(status)}">${esc(o.status || "")}</span></td>
        <td>EGP${Number(o.total_amount || 0).toLocaleString()}</td>
        <td><button class="view-btn" data-order-id="${o.order_id}">View</button></td>
      `;
      tbodyFrag.appendChild(tr);

      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-header">
          <span>
            <input type="checkbox" class="order-checkbox" value="${o.order_id}">
            &nbsp;#${esc(o.order_id)}
          </span>
          <span>${esc(Format.dateSlash(o.update_date))}</span>
        </div>
        <div class="order-card-body">
          <p><b>Customer:</b> ${esc(o.customer_name || "")}</p>
          <p><b>Delegate:</b> ${esc(o.username || "")}</p>
          <p><b>Status:</b> <span class="status-${esc(status)}">${esc(o.status || "")}</span></p>
          <p><b>Total:</b> EGP${esc(o.total_amount)}</p>
        </div>
        <div class="order-card-footer">
          <button class="view-btn" data-order-id="${o.order_id}">View Details</button>
        </div>
      `;
      cardsFrag.appendChild(card);
    }

    tbody.replaceChildren(tbodyFrag);
    cards.replaceChildren(cardsFrag);
  }

  function renderOrderSummary(summary) {
    const tableRow = document.getElementById("orderSummaryRow");
    const cardSummary = document.getElementById("cardSummary");
    const html = `
      <div class="orders-summary-grid">
        <div class="summary-stat confirmed">
          Confirmed<br>
          <span>EGP ${(summary.confirmed_total || 0).toLocaleString()}</span>
        </div>
        <div class="summary-stat refunded">
          Refunded<br>
          <span>EGP ${(summary.refunded_or_canceled_total || 0).toLocaleString()}</span>
        </div>
        <div class="summary-stat overall">
          Total<br>
          <span>EGP ${(summary.overall_total || 0).toLocaleString()}</span>
        </div>
      </div>
    `;

    if (tableRow) {
      const cell = tableRow.querySelector("td");
      if (cell) cell.innerHTML = html;
    }
    if (cardSummary) cardSummary.innerHTML = html;
  }

  function renderNoOrders() {
    document.getElementById("ordersTable").innerHTML =
      `<tr><td colspan="10" style="text-align:center;padding:20px;">No orders</td></tr>`;
    document.getElementById("ordersCards").innerHTML =
      `<div style="text-align:center;padding:20px;">No orders</div>`;
  }

  // ── Events ─────────────────────────────────────────────────────────────

  function setupEventListeners() {
    const debouncedRefresh = Async.debounce(() => fetchAndRenderOrders(), 250);

    const toggleButton = document.getElementById("confirmedToggle");
    toggleButton?.addEventListener("click", () => {
      toggleButton.classList.toggle("active");
      toggleButton.textContent = toggleButton.classList.contains("active")
        ? "Fully Confirmed"
        : "All Orders";
      fetchAndRenderOrders();
    });

    for (const id of [
      "dateStart",
      "dateEnd",
      "updateDateStart",
      "updateDateEnd",
      "pageSize",
      "userFilter",
    ]) {
      document.getElementById(id)?.addEventListener("change", debouncedRefresh);
    }

    document.getElementById("customerFilter")?.addEventListener("change", () => {
      const sel = document.getElementById("customerFilter").value;
      if (sel === "all") renderOrders(state.allOrders);
      else renderOrders(state.allOrders.filter((o) => o.customer_name === sel));
    });

    document.getElementById("checkAll")?.addEventListener("change", (e) => {
      document
        .querySelectorAll(".order-checkbox")
        .forEach((cb) => (cb.checked = e.target.checked));
    });

    // Event delegation: view buttons + pagination
    document.body.addEventListener("click", (e) => {
      const viewBtn = e.target.closest(".view-btn");
      if (viewBtn?.dataset.orderId) {
        window.location = `view-order.html?order_id=${viewBtn.dataset.orderId}`;
        return;
      }
      const pgBtn = e.target.closest("#pagination button");
      if (pgBtn && pgBtn.dataset.page && !pgBtn.disabled) {
        fetchAndRenderOrders(parseInt(pgBtn.dataset.page, 10));
      }
    });

    document.getElementById("exportBtn")?.addEventListener("click", handleExport);

    document
      .querySelector(".close-modal")
      ?.addEventListener("click", () => toggleModal(false));
    window.addEventListener("click", (e) => {
      if (e.target.id === "exportModal") toggleModal(false);
    });

    document
      .getElementById("exportForm")
      ?.addEventListener("submit", handleModalExport);
  }

  function getSelectedOrderIds() {
    return Array.from(document.querySelectorAll(".order-checkbox"))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  async function handleExport() {
    const ids = getSelectedOrderIds();
    if (ids.length) {
      await downloadExport({ order_ids: ids.join(",") });
    } else {
      toggleModal(true);
    }
  }

  function toggleModal(show) {
    document.getElementById("exportModal")?.classList.toggle("hidden", !show);
  }

  async function handleModalExport(e) {
    e.preventDefault();
    const custName = document.getElementById("modalCustomer").value.trim();
    const userName = document.getElementById("modalUser").value.trim();

    const custId = state.allCustomers.find(
      (c) => `${c.first_name} ${c.last_name}` === custName
    )?.customer_id;
    const userId = state.allUsers.find((u) => u.username === userName)?.user_id;

    const query = {};
    if (custId) query.customer_id = custId;
    if (userId) query.user_id = userId;

    const aStart = document.getElementById("amountStart").value;
    const aEnd = document.getElementById("amountEnd").value;
    if (aStart) query.amount_start = aStart;
    if (aEnd) query.amount_end = aEnd;

    const dStart = document.getElementById("dateStart").value;
    const dEnd = document.getElementById("dateEnd").value;
    if (dStart) query.date_start = dStart;
    if (dEnd) query.date_end = dEnd;

    const dStartUpd = document.getElementById("dateStartUpdate").value;
    const dEndUpd = document.getElementById("dateEndUpdate").value;
    if (dStartUpd) query.update_date_start = dStartUpd;
    if (dEndUpd) query.update_date_end = dEndUpd;

    if (document.getElementById("fullyconfirmed").checked) {
      query.confirmed_cycle_only = "true";
    }

    toggleModal(false);
    await downloadExport(query);
  }

  async function downloadExport(query) {
    try {
      UI.showLoader();
      const res = await Api.get("/orders/export", { query, raw: true });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || "Export failed");
      }
      const blob = await res.blob();
      const objectURL = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectURL;
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `orders_export_${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectURL);
    } catch (err) {
      console.error(err);
      UI.showError(err.message || "Export failed");
    } finally {
      UI.hideLoader();
    }
  }

  // Legacy sort handlers (called via inline onclick in HTML)
  function parseCustomDate(dateStr) {
    const [datePart, timePart] = dateStr.split(" ");
    const [day, month, year] = datePart.split("/").map(Number);
    const [hours, minutes] = (timePart || "00:00").split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  window.sortTable = function (colIndex, type) {
    const table = document.getElementById("ordersTable");
    const rows = Array.from(table.rows);
    if (rows.length === 1 && rows[0].cells[0]?.colSpan) return;

    rows.sort((a, b) => {
      const va = a.cells[colIndex].innerText.trim();
      const vb = b.cells[colIndex].innerText.trim();
      if (type === "date") {
        const da = parseCustomDate(va);
        const db = parseCustomDate(vb);
        return state.sortOrder.date ? da - db : db - da;
      }
      if (type === "price") {
        const na = parseFloat(va.replace("EGP", ""));
        const nb = parseFloat(vb.replace("EGP", ""));
        return state.sortOrder.price ? na - nb : nb - na;
      }
      return 0;
    });
    state.sortOrder[type] = !state.sortOrder[type];
    const frag = document.createDocumentFragment();
    rows.forEach((r) => frag.appendChild(r));
    table.appendChild(frag);
  };
});
