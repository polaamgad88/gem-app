document.addEventListener("DOMContentLoaded", async function () {
  function parseCustomDate(dateStr) {
    const [datePart, timePart] = dateStr.split(" ");
    const [day, month, year] = datePart.split("/").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }

  let sortOrder = { date: true, price: true };
  let allOrders = [];
  let allUsers = [];
  let allCustomers = [];
  let currentPage = 1;
  let totalPages = 1;

  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  Utils.UI.showLoader();

  setupEventListeners();

  try {
    await Promise.all([fetchUsers(), fetchCustomers()]);
    await fetchAndRenderOrders();
  } catch (err) {
    console.error(err);
    Utils.UI.showError("Failed to load orders.");
  } finally {
    Utils.UI.hideLoader();
  }

  Utils.UI.checkScreenSize();
  window.addEventListener("resize", Utils.UI.checkScreenSize);

  async function fetchUsers() {
    const res = await fetch("https://order-app.gemegypt.net/api/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("users");
    const data = await res.json();
    allUsers = data.users || [];

    const sel = document.getElementById("userFilter");
    sel.innerHTML = '<option value="all">All Users</option>';
    allUsers.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.user_id;
      opt.textContent = u.username;
      sel.appendChild(opt);
    });

    const dl = document.getElementById("modalUserList");
    allUsers.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.username;
      dl.appendChild(opt);
    });
  }

  async function fetchCustomers() {
    const res = await fetch("https://order-app.gemegypt.net/api/customers?all=true", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("customers");
    const data = await res.json();
    allCustomers = data.customers || [];

    const dl = document.getElementById("modalCustomerList");
    allCustomers.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = `${c.first_name} ${c.last_name}`;
      dl.appendChild(opt);
    });
  }
  async function fetchAndRenderOrders(page = 1) {
    Utils.UI.showLoader();
    function isConfirmedOnly() {
      return document
        .getElementById("confirmedToggle")
        .classList.contains("active");
    }
    const userId = document.getElementById("userFilter").value;
    const customerName = document.getElementById("customerFilter").value;
    const dateStart = document.getElementById("dateStart").value;
    const dateEnd = document.getElementById("dateEnd").value;
    const updateStart = document.getElementById("updateDateStart").value;
    const updateEnd = document.getElementById("updateDateEnd").value;
    const confirmedOnly = isConfirmedOnly();

    const pageSize = parseInt(
      document.getElementById("pageSize").value || "25"
    );

    let params = new URLSearchParams();

    if (userId !== "all") params.append("user_id", userId);

    if (customerName !== "all") {
      const matchedCustomer = allOrders.find(
        (o) => o.customer_name === customerName
      );
      if (matchedCustomer)
        params.append("customer_id", matchedCustomer.customer_id);
    }

    if (dateStart) params.append("date_start", dateStart);
    if (dateEnd) params.append("date_end", dateEnd);
    if (updateStart) params.append("date_start_update", updateStart);
    if (updateEnd) params.append("date_end_update", updateEnd);

    params.append("page", page);
    params.append("limit", pageSize);

    const endpoint = confirmedOnly
      ? "https://order-app.gemegypt.net/api/orders/confirmed-chain"
      : "https://order-app.gemegypt.net/api/orders";

    const url = `${endpoint}?${params.toString()}`;

    const tb = document.getElementById("ordersTable");
    const cc = document.getElementById("ordersCards");
    tb.innerHTML = cc.innerHTML = "";

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        renderNoOrders();
        Utils.UI.hideLoader();
        return;
      }

      const data = await res.json();
      allOrders = data.orders || [];

      if (data.summary) renderOrderSummary(data.summary);
      else renderOrderSummary({});

      currentPage = data.page || 1;
      totalPages = data.pages || 1;

      if (!allOrders.length) {
        renderNoOrders();
        Utils.UI.hideLoader();
        return;
      }

      populateCustomerFilter(allOrders);
      renderOrders(allOrders);
      renderPagination();
    } catch (err) {
      console.error(err);
      Utils.UI.showError("Failed to load orders.");
    } finally {
      Utils.UI.hideLoader();
    }
  }

  function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;

    container.innerHTML = "";

    const maxButtons = 10;
    const half = Math.floor(maxButtons / 2);

    let startPage = Math.max(1, currentPage - half);
    let endPage = startPage + maxButtons - 1;
    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    const createBtn = (label, page, disabled = false, isActive = false) => {
      const btn = document.createElement("button");
      btn.textContent = label;
      btn.disabled = disabled;
      btn.className = isActive ? "active" : "";
      btn.onclick = () => fetchAndRenderOrders(page);
      return btn;
    };

    // « Prev page
    container.appendChild(createBtn("◀", currentPage - 1, currentPage === 1));

    for (let i = startPage; i <= endPage; i++) {
      container.appendChild(createBtn(i, i, false, i === currentPage));
    }

    // » Next page
    container.appendChild(
      createBtn("▶", currentPage + 1, currentPage === totalPages)
    );
  }

  function populateCustomerFilter(orders) {
    const sel = document.getElementById("customerFilter");
    sel.innerHTML = '<option value="all">All Customers</option>';
    const seen = new Set();
    orders.forEach((o) => {
      if (seen.has(o.customer_name)) return;
      seen.add(o.customer_name);
      const opt = document.createElement("option");
      opt.value = o.customer_name;
      opt.textContent = o.customer_name;
      sel.appendChild(opt);
    });
  }

  function renderOrders(orders) {
    const tbody = document.getElementById("ordersTable");
    const cards = document.getElementById("ordersCards");
    tbody.innerHTML = cards.innerHTML = "";
    {
      /* <td>${i + 1}</td> */
    }
    orders.forEach((o, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="checkbox" class="order-checkbox" value="${
          o.order_id
        }"></td>
        <td>${o.order_id}</td>
        <td>${Utils.Format.dateSlash(o.update_date)}</td>
        <td>${o.customer_name}</td>
        <td>${o.username}</td>
        <td>${o.role}</td>
        <td><span class="status-${o.status.toLowerCase()}">${
        o.status
      }</span></td>
<td>EGP${o.total_amount.toLocaleString()}</td>
        <td><button class="view-btn" data-order-id="${
          o.order_id
        }">View</button></td>
      `;
      tbody.appendChild(tr);

      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-header">
          <span>
            <input type="checkbox" class="order-checkbox" value="${o.order_id}">
            &nbsp;#${o.order_id}
          </span>
          <span>${Utils.Format.dateSlash(o.update_date)}</span>
        </div>
        <div class="order-card-body">
          <p><b>Customer:</b> ${o.customer_name}</p>
          <p><b>Delegate:</b> ${o.username}</p>
          <p><b>Status:</b> <span class="status-${o.status.toLowerCase()}">${
        o.status
      }</span></p>
          <p><b>Total:</b> EGP${o.total_amount}</p>
        </div>
        <div class="order-card-footer">
          <button class="view-btn" data-order-id="${
            o.order_id
          }">View Details</button>
        </div>
      `;
      cards.appendChild(card);
    });

    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener(
        "click",
        () =>
          (window.location = `view-order.html?order_id=${btn.dataset.orderId}`)
      );
    });
  }

  function renderOrderSummary(summary) {
    const tableRow = document.getElementById("orderSummaryRow");
    const cardSummary = document.getElementById("cardSummary");
    const html = `
    <div style="
      display: flex;
      gap: 16px;
      margin-top: 16px;
      flex-wrap: wrap;
    ">
      <div style="
        flex: 1;
        background-color: #f1f1f1;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 16px;
        font-weight: 500;
        color: green;
      ">
         Confirmed<br>
        <span style="font-weight: bold;">
          EGP ${(summary.confirmed_total || 0).toLocaleString()}
        </span>
      </div>
  
      <div style="
        flex: 1;
        background-color: #f1f1f1;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 500;
        color: red;
      ">
        Refunded<br>
        <span style="font-weight: bold;">
          EGP ${(summary.refunded_or_canceled_total || 0).toLocaleString()}
        </span>
      </div>
  
      <div style="
        flex: 1;
        background-color: #f1f1f1;
        border: 1px solid #ccc;
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 14px;
        font-weight: 500;
        color: #333;
      ">
        Total<br>
        <span style="font-weight: bold;">
          EGP ${(summary.overall_total || 0).toLocaleString()}
        </span>
      </div>
    </div>
  `;

    if (tableRow) {
      // Grab the only <td> inside <tr id="orderSummaryRow">
      const summaryCell = tableRow.querySelector("td");
      if (summaryCell) {
        summaryCell.innerHTML = html;
        summaryCell.style.textAlign = "left";
        summaryCell.style.fontWeight = "bold";
      }
    }

    if (cardSummary) {
      cardSummary.innerHTML = html;
      cardSummary.style.textAlign = "left";
      cardSummary.style.fontWeight = "bold";
    }
  }

  function renderNoOrders() {
    document.getElementById(
      "ordersTable"
    ).innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;">No orders</td></tr>`;
    document.getElementById(
      "ordersCards"
    ).innerHTML = `<div style="text-align:center;padding:20px;">No orders</div>`;
  }
  function setupEventListeners() {
    const toggleButton = document.getElementById("confirmedToggle");

    toggleButton.addEventListener("click", () => {
      toggleButton.classList.toggle("active");
      const isConfirmed = toggleButton.classList.contains("active");
      toggleButton.textContent = isConfirmed ? "Fully Confirmed" : "All Orders";
      fetchAndRenderOrders();
    });

    document
      .getElementById("dateStart")
      .addEventListener("change", () => fetchAndRenderOrders());
    document
      .getElementById("dateEnd")
      .addEventListener("change", () => fetchAndRenderOrders());
    document
      .getElementById("updateDateStart")
      .addEventListener("change", () => fetchAndRenderOrders());
    document
      .getElementById("updateDateEnd")
      .addEventListener("change", () => fetchAndRenderOrders());
    document
      .getElementById("pageSize")
      .addEventListener("change", () => fetchAndRenderOrders());

    document
      .getElementById("userFilter")
      .addEventListener("change", async () => {
        Utils.UI.showLoader();
        await fetchAndRenderOrders();
        Utils.UI.hideLoader();
      });

    document.getElementById("customerFilter").addEventListener("change", () => {
      const sel = document.getElementById("customerFilter").value;
      if (sel === "all") renderOrders(allOrders);
      else renderOrders(allOrders.filter((o) => o.customer_name === sel));
    });

    document.getElementById("checkAll").addEventListener("change", (e) => {
      document
        .querySelectorAll(".order-checkbox")
        .forEach((cb) => (cb.checked = e.target.checked));
    });

    document
      .getElementById("exportBtn")
      .addEventListener("click", handleExport);

    document
      .querySelector(".close-modal")
      .addEventListener("click", () => toggleModal(false));
    window.addEventListener("click", (e) => {
      if (e.target.id === "exportModal") toggleModal(false);
    });

    /* modal submit */
    document
      .getElementById("exportForm")
      .addEventListener("submit", handleModalExport);
  }

  function getSelectedOrderIds() {
    return Array.from(document.querySelectorAll(".order-checkbox"))
      .filter((cb) => cb.checked)
      .map((cb) => cb.value);
  }

  async function handleExport() {
    const ids = getSelectedOrderIds();
    if (ids.length) {
      const qp = `order_ids=${ids.join(",")}`;
      await downloadExport(qp);
    } else {
      toggleModal(true);
    }
  }

  function toggleModal(show) {
    document.getElementById("exportModal").classList.toggle("hidden", !show);
  }

  async function handleModalExport(e) {
    e.preventDefault();
    const custName = document.getElementById("modalCustomer").value.trim();
    const userName = document.getElementById("modalUser").value.trim();

    const custId = (
      allCustomers.find((c) => `${c.first_name} ${c.last_name}` === custName) ||
      {}
    ).customer_id;
    const userId = (allUsers.find((u) => u.username === userName) || {})
      .user_id;

    const params = new URLSearchParams();
    if (custId) params.append("customer_id", custId);
    if (userId) params.append("user_id", userId);

    const aStart = document.getElementById("amountStart").value;
    const aEnd = document.getElementById("amountEnd").value;
    if (aStart) params.append("amount_start", aStart);
    if (aEnd) params.append("amount_end", aEnd);

    const dStart = document.getElementById("dateStart").value;
    const dEnd = document.getElementById("dateEnd").value;
    if (dStart) params.append("date_start", dStart);
    if (dEnd) params.append("date_end", dEnd);

    const dStart_update = document.getElementById("dateStartUpdate").value;
    const dEnd_update = document.getElementById("dateEndUpdate").value;
    if (dStart_update) params.append("update_date_start", dStart_update);
    if (dEnd_update) params.append("update_date_end", dEnd_update);
    if (document.getElementById("fullyconfirmed").checked) {
      params.append("confirmed_cycle_only", "true");
    }
    toggleModal(false);
    await downloadExport(params.toString());
  }

  async function downloadExport(query) {
    try {
      Utils.UI.showLoader("Preparing file…");
      const api = `https://order-app.gemegypt.net/api/orders/export?${query}`;
      const res = await fetch(api, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.message || "export failed");
      }
      const blob = await res.blob();

      /* ---------------------------------------------------------------------- */
      const objectURL = (window.URL || window.webkitURL).createObjectURL(blob);
      /* ---------------------------------------------------------------------- */

      const a = document.createElement("a");
      a.href = objectURL;
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `orders_export_${timestamp}.zip`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      (window.URL || window.webkitURL).revokeObjectURL(objectURL);
    } catch (err) {
      console.error(err);
      Utils.UI.showError(err.message || "Export failed");
    } finally {
      Utils.UI.hideLoader();
    }
  }

  window.sortTable = function (colIndex, type) {
    const table = document.getElementById("ordersTable");
    let rows = Array.from(table.rows);
    if (rows.length === 1 && rows[0].cells[0].colSpan) return;

    rows.sort((a, b) => {
      let va = a.cells[colIndex].innerText.trim();
      let vb = b.cells[colIndex].innerText.trim();
      if (type === "date") {
        const da = parseCustomDate(va),
          db = parseCustomDate(vb);
        return sortOrder.date ? da - db : db - da;
      }
      if (type === "price") {
        const na = parseFloat(va.replace("EGP", "")),
          nb = parseFloat(vb.replace("EGP", ""));
        return sortOrder.price ? na - nb : nb - na;
      }
    });
    sortOrder[type] = !sortOrder[type];
    rows.forEach((r) => table.appendChild(r));
    sortCards(type);
  };

  function sortCards(type) {
    const cc = document.getElementById("ordersCards");
    const cards = Array.from(cc.children);
    cards.sort((a, b) => {
      if (type === "date") {
        const da = parseCustomDate(
          a.querySelector(".order-card-header span:last-child").innerText
        );
        const db = parseCustomDate(
          b.querySelector(".order-card-header span:last-child").innerText
        );
        return sortOrder.date ? da - db : db - da;
      }
      if (type === "price") {
        const pa = parseFloat(
          a
            .querySelector(".order-card-body p:last-child")
            .innerText.replace("Total: EGP", "")
        );
        const pb = parseFloat(
          b
            .querySelector(".order-card-body p:last-child")
            .innerText.replace("Total: EGP", "")
        );
        return sortOrder.price ? pa - pb : pb - pa;
      }
    });
    cards.forEach((c) => cc.appendChild(c));
  }
});
