document.addEventListener("DOMContentLoaded", async () => {
  const { Api, Auth, UI, Format, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  const FILTER_IDS = [
    "userFilter",
    "customerFilter",
    "dateStart",
    "dateEnd",
    "updateDateStart",
    "updateDateEnd",
  ];

  const state = {
    sortOrder: { date: true, price: true },
    allOrders: [],
    allUsers: [],
    allCustomers: [],
    selected: new Set(),
    searchTerm: "",
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 25,
  };

  const token = await Auth.requireAuth();
  if (!token) return;

  setupEventListeners();

  try {
    await Promise.all([fetchUsers(), fetchCustomers()]);
    await fetchAndRenderOrders();
  } catch (err) {
    console.error(err);
    UI.showError("Failed to load orders.");
  }

  UI.checkScreenSize();
  window.addEventListener("resize", Async.throttle(UI.checkScreenSize, 150));

  async function fetchUsers() {
    const data = await Api.getCached("/users", { cacheTtl: 5 * 60 * 1000 });
    state.allUsers = data.users || [];

    const sel = document.getElementById("userFilter");
    if (sel) {
      sel.innerHTML =
        `<option value="all">All users</option>` +
        state.allUsers
          .map((u) => `<option value="${esc(u.user_id)}">${esc(u.username)}</option>`)
          .join("");
    }

    const dl = document.getElementById("modalUserList");
    if (dl) {
      dl.innerHTML = state.allUsers
        .map((u) => `<option value="${esc(u.username)}"></option>`)
        .join("");
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
      dl.innerHTML = state.allCustomers
        .map((c) => `<option value="${esc(`${c.first_name} ${c.last_name}`)}"></option>`)
        .join("");
    }
  }

  async function fetchAndRenderOrders(page = 1) {
    state.limit = parseInt(document.getElementById("pageSize").value || "25", 10);
    setBusy(true);
    renderSkeleton();

    const confirmedOnly = isConfirmedOnly();
    const userId = document.getElementById("userFilter").value;
    const customerName = document.getElementById("customerFilter").value;
    const dateStart = document.getElementById("dateStart").value;
    const dateEnd = document.getElementById("dateEnd").value;
    const updateStart = document.getElementById("updateDateStart").value;
    const updateEnd = document.getElementById("updateDateEnd").value;

    const query = { page, limit: state.limit };
    if (userId !== "all") query.user_id = userId;

    if (customerName && customerName !== "all") {
      const match =
        state.allCustomers.find(
          (c) => `${c.first_name} ${c.last_name}` === customerName
        ) || state.allOrders.find((o) => o.customer_name === customerName);
      if (match) query.customer_id = match.customer_id;
    }

    if (dateStart) query.date_start = dateStart;
    if (dateEnd) query.date_end = dateEnd;
    if (updateStart) query.date_start_update = updateStart;
    if (updateEnd) query.date_end_update = updateEnd;

    const path = confirmedOnly ? "/orders/confirmed-chain" : "/orders";

    try {
      const data = await Api.get(path, { query });
      state.allOrders = data.orders || [];
      state.currentPage = data.page || 1;
      state.totalPages = data.pages || 1;
      state.total = data.total ?? state.allOrders.length;

      renderOrderSummary(data.summary || {});
      populateCustomerFilter(state.allOrders);
      applySearch();
      renderPagination();
      paintFilterCount();
    } catch (err) {
      console.error(err);
      document.getElementById("ordersTable").replaceChildren();
      document.getElementById("ordersCards").replaceChildren();
      renderLoadError(err.message || "Failed to load orders.");
    } finally {
      setBusy(false);
    }
  }

  function renderLoadError(message) {
    const empty = document.getElementById("ordersEmpty");
    if (!empty) return;
    empty.classList.remove("hidden");
    empty.classList.add("empty-state--error");
    empty.innerHTML = `
      <p>${esc(message)}</p>
      <button type="button" id="retryLoad" class="ghost-btn">Try again</button>`;
    document
      .getElementById("retryLoad")
      ?.addEventListener("click", () => fetchAndRenderOrders(state.currentPage));
  }

  function isConfirmedOnly() {
    return document.getElementById("confirmedToggle")?.classList.contains("active");
  }

  function visibleOrders() {
    const term = state.searchTerm;
    if (!term) return state.allOrders;
    return state.allOrders.filter((o) =>
      [o.order_id, o.customer_name, o.username]
        .map((v) => String(v || "").toLowerCase())
        .join(" ")
        .includes(term)
    );
  }

  function applySearch() {
    const orders = visibleOrders();
    renderOrders(orders);
    renderMeta(orders.length);

    const empty = document.getElementById("ordersEmpty");
    if (empty) {
      empty.classList.remove("empty-state--error");
      empty.textContent = state.searchTerm
        ? "No orders match this search."
        : "No orders match these filters.";
      empty.classList.toggle("hidden", orders.length > 0);
    }
  }

  function renderMeta(shown) {
    const meta = document.getElementById("resultMeta");
    if (!meta) return;
    if (!state.total) {
      meta.textContent = "";
      return;
    }
    const from = (state.currentPage - 1) * state.limit + 1;
    const to = from + shown - 1;
    const filtered = state.searchTerm ? " (filtered)" : "";
    meta.innerHTML = `Showing <strong>${from}–${to}</strong> of <strong>${state.total}</strong> orders${filtered}`;
  }

  function setBusy(busy) {
    document.getElementById("topProgress")?.toggleAttribute("hidden", !busy);
    document.querySelector(".table-responsive")?.setAttribute("aria-busy", busy);
    document
      .querySelectorAll("#exportBtn, #confirmedToggle, #pagination button")
      .forEach((el) => (el.disabled = busy));
  }

  function skeletonCells() {
    return `
      <td class="col-check"><span class="sk sk-check"></span></td>
      <td class="col-id"><span class="sk" style="width:52px"></span></td>
      <td class="col-date"><span class="sk" style="width:110px"></span></td>
      <td><span class="sk" style="width:70%"></span></td>
      <td class="col-user">
        <span class="sk" style="width:80px"></span>
        <span class="sk sk-sub" style="width:52px"></span>
      </td>
      <td class="col-status"><span class="sk sk-pill"></span></td>
      <td class="col-total"><span class="sk" style="width:80px"></span></td>
      <td class="col-action"><span class="sk sk-btn"></span></td>`;
  }

  function renderSkeleton() {
    const rows = Math.max(3, Math.min(state.limit || 8, 8));
    const tbody = document.getElementById("ordersTable");
    const cards = document.getElementById("ordersCards");
    const summary = document.getElementById("summary-row");

    if (tbody) {
      tbody.innerHTML = Array.from({ length: rows })
        .map(() => `<tr class="sk-row">${skeletonCells()}</tr>`)
        .join("");
    }

    if (cards) {
      cards.innerHTML = Array.from({ length: Math.min(rows, 4) })
        .map(
          () => `
          <div class="order-card sk-row">
            <div class="order-card-header">
              <span class="sk" style="width:90px"></span>
              <span class="sk" style="width:110px"></span>
            </div>
            <div class="order-card-body">
              <div><span class="sk sk-sub" style="width:60px"></span><span class="sk"></span></div>
              <div><span class="sk sk-sub" style="width:60px"></span><span class="sk"></span></div>
              <div><span class="sk sk-sub" style="width:60px"></span><span class="sk sk-pill"></span></div>
              <div><span class="sk sk-sub" style="width:60px"></span><span class="sk"></span></div>
            </div>
          </div>`
        )
        .join("");
    }

    if (summary && !summary.children.length) {
      summary.innerHTML = Array.from({ length: 3 })
        .map(
          () =>
            `<div class="stat-tile sk-row"><span class="sk" style="width:120px"></span><span class="sk sk-sub" style="width:70px"></span></div>`
        )
        .join("");
    }

    document.getElementById("ordersEmpty")?.classList.add("hidden");
  }

  function statusBadge(rawStatus) {
    const status = String(rawStatus || "").trim();
    const slug = status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const confirmedBy = /^confirmed-by-(.+)$/i.exec(status);
    if (confirmedBy) {
      return `<span class="status-badge status-badge--confirmed">Confirmed</span>
              <span class="status-by">${esc(confirmedBy[1])}</span>`;
    }
    return `<span class="status-badge status-badge--${esc(slug)}">${esc(status || "-")}</span>`;
  }

  function money(value) {
    return `EGP ${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function renderOrders(orders) {
    const tbody = document.getElementById("ordersTable");
    const cards = document.getElementById("ordersCards");

    const tbodyFrag = document.createDocumentFragment();
    const cardsFrag = document.createDocumentFragment();

    for (const o of orders) {
      const id = o.order_id;
      const checked = state.selected.has(String(id)) ? "checked" : "";
      const when = Format.dateSlash(o.update_date);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="col-check"><input type="checkbox" class="order-checkbox" value="${esc(id)}" ${checked}></td>
        <td class="col-id"><strong>#${esc(id)}</strong></td>
        <td class="col-date">${esc(when)}</td>
        <td class="col-customer">${esc(o.customer_name || "-")}</td>
        <td class="col-user">
          <div>${esc(o.username || "-")}</div>
          <div class="cell-sub">${esc(o.role || "")}</div>
        </td>
        <td class="col-status">${statusBadge(o.status)}</td>
        <td class="col-total">${esc(money(o.total_amount))}</td>
        <td class="col-action"><button class="view-btn" data-order-id="${esc(id)}">View</button></td>`;
      tbodyFrag.appendChild(tr);

      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-header">
          <label class="card-check">
            <input type="checkbox" class="order-checkbox" value="${esc(id)}" ${checked}>
            <strong>#${esc(id)}</strong>
          </label>
          <span class="cell-sub">${esc(when)}</span>
        </div>
        <div class="order-card-body">
          <div><small>Customer</small><span>${esc(o.customer_name || "-")}</span></div>
          <div><small>Delegate</small><span>${esc(o.username || "-")}</span></div>
          <div><small>Status</small><span>${statusBadge(o.status)}</span></div>
          <div><small>Total</small><span>${esc(money(o.total_amount))}</span></div>
        </div>
        <div class="order-card-footer">
          <button class="view-btn" data-order-id="${esc(id)}">View Details</button>
        </div>`;
      cardsFrag.appendChild(card);
    }

    tbody.replaceChildren(tbodyFrag);
    cards.replaceChildren(cardsFrag);
    syncSelectionUI();
  }

  function renderOrderSummary(summary) {
    const box = document.getElementById("summary-row");
    if (!box) return;
    const tiles = [
      ["Confirmed", summary.confirmed_total || 0, "ok"],
      ["Refunded / Canceled", summary.refunded_or_canceled_total || 0, "bad"],
      ["Total", summary.overall_total || 0, ""],
    ];
    box.innerHTML = tiles
      .map(
        ([label, value, mod]) =>
          `<div class="stat-tile${mod ? ` stat-tile--${mod}` : ""}">
             <span>${esc(money(value))}</span><small>${label}</small>
           </div>`
      )
      .join("");
  }

  function populateCustomerFilter(orders) {
    const sel = document.getElementById("customerFilter");
    if (!sel) return;
    const previous = sel.value;
    const seen = new Set();
    const options = [];
    for (const o of orders) {
      if (!o.customer_name || seen.has(o.customer_name)) continue;
      seen.add(o.customer_name);
      options.push(`<option value="${esc(o.customer_name)}">${esc(o.customer_name)}</option>`);
    }
    sel.innerHTML = `<option value="all">All customers</option>${options.join("")}`;
    if (Array.from(sel.options).some((opt) => opt.value === previous)) {
      sel.value = previous;
    }
  }

  function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;
    if (state.totalPages <= 1) {
      container.replaceChildren();
      return;
    }

    const maxButtons = 7;
    let start = Math.max(1, state.currentPage - Math.floor(maxButtons / 2));
    const end = Math.min(state.totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    const frag = document.createDocumentFragment();
    const mkBtn = (label, page, disabled, active) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.disabled = disabled;
      if (active) btn.classList.add("active");
      btn.dataset.page = page;
      return btn;
    };
    const gap = () => {
      const s = document.createElement("span");
      s.className = "page-gap";
      s.textContent = "…";
      return s;
    };

    frag.appendChild(mkBtn("‹", state.currentPage - 1, state.currentPage === 1));
    if (start > 1) {
      frag.appendChild(mkBtn("1", 1, false, false));
      if (start > 2) frag.appendChild(gap());
    }
    for (let i = start; i <= end; i++) {
      frag.appendChild(mkBtn(String(i), i, false, i === state.currentPage));
    }
    if (end < state.totalPages) {
      if (end < state.totalPages - 1) frag.appendChild(gap());
      frag.appendChild(mkBtn(String(state.totalPages), state.totalPages, false, false));
    }
    frag.appendChild(
      mkBtn("›", state.currentPage + 1, state.currentPage === state.totalPages)
    );

    container.replaceChildren(frag);
  }

  function paintFilterCount() {
    const badge = document.getElementById("filtersCount");
    if (!badge) return;
    const n = FILTER_IDS.reduce((count, id) => {
      const el = document.getElementById(id);
      if (!el) return count;
      const value = el.value;
      return value && value !== "all" ? count + 1 : count;
    }, 0);
    badge.textContent = n;
    badge.classList.toggle("hidden", n === 0);
  }

  function openFilters(open) {
    const panel = document.getElementById("filtersPanel");
    const toggle = document.getElementById("filtersToggle");
    panel.classList.toggle("hidden", !open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.classList.toggle("open", open);
  }

  function syncSelectionUI() {
    const bar = document.getElementById("selectionBar");
    const count = state.selected.size;
    document.getElementById("selectionCount").textContent = `${count} selected`;
    bar.classList.toggle("hidden", count === 0);

    const boxes = Array.from(document.querySelectorAll("#ordersTable .order-checkbox"));
    const checkAll = document.getElementById("checkAll");
    if (checkAll) {
      checkAll.checked = boxes.length > 0 && boxes.every((cb) => cb.checked);
      checkAll.indeterminate = !checkAll.checked && boxes.some((cb) => cb.checked);
    }
  }

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
      "customerFilter",
    ]) {
      document.getElementById(id)?.addEventListener("change", debouncedRefresh);
    }

    document.getElementById("filtersToggle")?.addEventListener("click", () => {
      openFilters(document.getElementById("filtersPanel").classList.contains("hidden"));
    });

    document.getElementById("resetFilters")?.addEventListener("click", () => {
      FILTER_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = el.tagName === "SELECT" ? "all" : "";
      });
      const search = document.getElementById("orderSearch");
      if (search) search.value = "";
      state.searchTerm = "";
      fetchAndRenderOrders();
    });

    const onSearch = Async.debounce((value) => {
      state.searchTerm = value.trim().toLowerCase();
      applySearch();
    }, 200);
    document
      .getElementById("orderSearch")
      ?.addEventListener("input", (e) => onSearch(e.target.value));

    document.getElementById("checkAll")?.addEventListener("change", (e) => {
      document.querySelectorAll("#ordersTable .order-checkbox").forEach((cb) => {
        cb.checked = e.target.checked;
        if (e.target.checked) state.selected.add(cb.value);
        else state.selected.delete(cb.value);
      });
      syncSelectionUI();
    });

    document.body.addEventListener("change", (e) => {
      const cb = e.target.closest(".order-checkbox");
      if (!cb) return;
      if (cb.checked) state.selected.add(cb.value);
      else state.selected.delete(cb.value);
      document
        .querySelectorAll(`.order-checkbox[value="${cb.value}"]`)
        .forEach((other) => (other.checked = cb.checked));
      syncSelectionUI();
    });

    document.getElementById("clearSelection")?.addEventListener("click", () => {
      state.selected.clear();
      document.querySelectorAll(".order-checkbox").forEach((cb) => (cb.checked = false));
      syncSelectionUI();
    });

    document.getElementById("exportSelected")?.addEventListener("click", () => {
      if (state.selected.size) {
        downloadExport({ order_ids: Array.from(state.selected).join(",") });
      }
    });

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

    document.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => sortTable(th.dataset.sort));
    });

    document.getElementById("exportBtn")?.addEventListener("click", handleExport);

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => toggleModal(false));
    });
    window.addEventListener("click", (e) => {
      if (e.target.id === "exportModal") toggleModal(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") toggleModal(false);
    });

    document.getElementById("exportForm")?.addEventListener("submit", handleModalExport);
  }

  async function handleExport() {
    if (state.selected.size) {
      await downloadExport({ order_ids: Array.from(state.selected).join(",") });
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

    const dStart = document.getElementById("exportDateStart").value;
    const dEnd = document.getElementById("exportDateEnd").value;
    if (dStart) query.date_start = dStart;
    if (dEnd) query.date_end = dEnd;

    const dStartUpd = document.getElementById("exportUpdateStart").value;
    const dEndUpd = document.getElementById("exportUpdateEnd").value;
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
      setBusy(true);
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
      setBusy(false);
    }
  }

  function sortTable(type) {
    const ascending = state.sortOrder[type];
    const sorted = [...state.allOrders].sort((a, b) => {
      if (type === "date") {
        const da = new Date(a.update_date).getTime() || 0;
        const db = new Date(b.update_date).getTime() || 0;
        return ascending ? da - db : db - da;
      }
      const na = Number(a.total_amount || 0);
      const nb = Number(b.total_amount || 0);
      return ascending ? na - nb : nb - na;
    });
    state.sortOrder[type] = !ascending;
    state.allOrders = sorted;

    document.querySelectorAll("th.sortable").forEach((th) => {
      th.classList.toggle("sorted", th.dataset.sort === type);
      th.classList.toggle("sorted-desc", th.dataset.sort === type && !ascending);
    });

    applySearch();
  }
});
