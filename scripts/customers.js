/* Customers page — perf refactored. */

(function () {
  const { Api, Auth, UI, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  const state = {
    currentPage: 1,
    totalPages: 1,
    searchTerm: "",
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    UI.checkScreenSize();
    window.addEventListener("resize", Async.throttle(UI.checkScreenSize, 150));

    const customers = await fetchCustomers();
    renderCustomers(customers);
    renderPagination();

    document.getElementById("add-customer-btn")?.addEventListener("click", () => {
      window.location.href = "create-customer.html";
    });

    const searchInput = document.getElementById("customer-search");
    if (searchInput) {
      const debouncedSearch = Async.debounce(async (value) => {
        state.searchTerm = value;
        state.currentPage = 1;
        const list = await fetchCustomers();
        renderCustomers(list);
        renderPagination();
      }, 300);
      searchInput.addEventListener("input", (e) => debouncedSearch(e.target.value.trim()));
    }

    // Event delegation for view buttons (no per-row listener cost).
    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-customer-id]");
      if (btn && btn.classList.contains("btn-view")) {
        window.location.href = `view-customer.html?customer_id=${btn.dataset.customerId}`;
      }
    });
  });

  async function fetchCustomers(page = state.currentPage) {
    try {
      const query = { page, limit: 10 };
      if (state.searchTerm) query.search = state.searchTerm;

      const data = await Api.get("/customers", { query });
      state.currentPage = data.page || 1;
      state.totalPages = data.pages || 1;
      return data.customers || [];
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      UI.showError("Failed to load customers.");
      return [];
    }
  }

  function renderCustomers(customers) {
    const tableBody = document.getElementById("customersTable");
    const cardContainer = document.getElementById("customerCards");
    if (!tableBody || !cardContainer) return;

    const tbodyFrag = document.createDocumentFragment();
    const cardsFrag = document.createDocumentFragment();

    for (const c of customers) {
      const fullName = `${c.first_name || ""} ${c.last_name || ""}`.trim();
      const phone = c.phone || "-";
      const id = c.customer_id;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${esc(c.code || "")}</td>
        <td>${esc(fullName)}</td>
        <td>${esc(phone)}</td>
        <td>
          <button class="btn-view" data-customer-id="${id}">View</button>
        </td>`;
      tbodyFrag.appendChild(row);

      const card = document.createElement("div");
      card.className = "customer-card";
      card.innerHTML = `
        <div class="customer-card-header">
          <span>${esc(fullName)}</span>
          <span>#${esc(id)}</span>
        </div>
        <div class="customer-card-body">
          <p><span class="customer-card-label">Phone:</span> ${esc(phone)}</p>
        </div>
        <div class="customer-card-footer">
          <button class="btn-view" data-customer-id="${id}">View</button>
        </div>`;
      cardsFrag.appendChild(card);
    }

    tableBody.replaceChildren(tbodyFrag);
    cardContainer.replaceChildren(cardsFrag);
  }

  function renderPagination() {
    let container = document.getElementById("pagination");
    if (!container) {
      container = document.createElement("div");
      container.id = "pagination";
      container.className = "pagination-controls";
      const anchor =
        window.innerWidth <= 768
          ? document.querySelector(".card-view")
          : document.querySelector(".table-responsive");
      anchor?.after(container);
    }

    const maxButtons = 10;
    const half = Math.floor(maxButtons / 2);
    let start = Math.max(1, state.currentPage - half);
    let end = Math.min(state.totalPages, start + maxButtons - 1);
    if (end - start < maxButtons) start = Math.max(1, end - maxButtons + 1);

    const frag = document.createDocumentFragment();
    const mkBtn = (text, page, disabled, active) => {
      const btn = document.createElement("button");
      btn.textContent = text;
      btn.disabled = disabled;
      if (active) btn.classList.add("active");
      btn.addEventListener("click", async () => {
        const list = await fetchCustomers(page);
        renderCustomers(list);
        renderPagination();
      });
      return btn;
    };

    frag.appendChild(mkBtn("◀", state.currentPage - 1, state.currentPage === 1));
    for (let i = start; i <= end; i++) {
      frag.appendChild(mkBtn(i, i, false, i === state.currentPage));
    }
    frag.appendChild(
      mkBtn("▶", state.currentPage + 1, state.currentPage === state.totalPages)
    );

    container.replaceChildren(frag);
  }
})();
