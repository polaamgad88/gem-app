(function () {
  const { Api, Auth, UI, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  const state = {
    page: 1,
    limit: 25,
    totalPages: 1,
    total: 0,
    searchTerm: "",
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    UI.checkScreenSize();
    window.addEventListener("resize", Async.throttle(UI.checkScreenSize, 150));

    document.getElementById("add-customer-btn")?.addEventListener("click", () => {
      window.location.href = "create-customer.html";
    });

    const searchInput = document.getElementById("customer-search");
    if (searchInput) {
      const onSearch = Async.debounce((value) => {
        state.searchTerm = value;
        state.page = 1;
        load();
      }, 300);
      searchInput.addEventListener("input", (e) => onSearch(e.target.value.trim()));
    }

    document.getElementById("page-size")?.addEventListener("change", (e) => {
      state.limit = parseInt(e.target.value, 10) || 25;
      state.page = 1;
      load();
    });

    document.body.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-customer-id]");
      if (btn && btn.classList.contains("btn-view")) {
        window.location.href = `view-customer.html?customer_id=${btn.dataset.customerId}`;
      }
    });

    await load();
  });

  async function load(page = state.page) {
    const loading = document.getElementById("customers-loading");
    loading?.classList.remove("hidden");
    try {
      const query = { page, limit: state.limit };
      if (state.searchTerm) query.search = state.searchTerm;

      const data = await Api.get("/customers", { query });
      state.page = data.page || 1;
      state.totalPages = data.pages || 1;
      state.total = data.total || 0;

      let list = data.customers || [];
      if (Auth.isAlex()) {
        list = list.filter((c) => String(c.code || "").toLowerCase().startsWith("ac-"));
      }

      render(list);
      renderMeta(list.length);
      renderPagination();
    } catch (err) {
      console.error("Failed to fetch customers:", err);
      UI.showError("Failed to load customers.");
      render([]);
      renderMeta(0);
    } finally {
      loading?.classList.add("hidden");
    }
  }

  function regionOf(code) {
    return String(code || "").toLowerCase().startsWith("ac-") ? "alex" : "cairo";
  }

  function initialOf(name) {
    const trimmed = String(name || "").trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
  }

  function repChips(users) {
    if (!users || !users.length) return `<span class="muted">Unassigned</span>`;
    const shown = users
      .slice(0, 2)
      .map((u) => `<span class="rep-chip">${esc(u.username)}</span>`)
      .join("");
    const rest = users.length - 2;
    return shown + (rest > 0 ? `<span class="rep-chip rep-chip--more">+${rest}</span>` : "");
  }

  function phoneCell(phone) {
    if (!phone) return `<span class="muted">—</span>`;
    return `<a class="phone-link" href="tel:${esc(String(phone).replace(/\s+/g, ""))}">${esc(phone)}</a>`;
  }

  function render(customers) {
    const tableBody = document.getElementById("customersTable");
    const cardContainer = document.getElementById("customerCards");
    const empty = document.getElementById("customers-empty");
    if (!tableBody || !cardContainer) return;

    empty?.classList.toggle("hidden", customers.length > 0);

    const rows = document.createDocumentFragment();
    const cards = document.createDocumentFragment();

    for (const c of customers) {
      const name = `${c.first_name || ""} ${c.last_name || ""}`.trim() || "—";
      const id = c.customer_id;
      const region = regionOf(c.code);
      const codeCell = c.code
        ? `<span class="code-pill">${esc(c.code)}</span>
           <span class="region-pill region-pill--${region}">${region.toUpperCase()}</span>`
        : `<span class="muted">—</span>`;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="col-code">${codeCell}</td>
        <td>
          <div class="cust-identity">
            <span class="avatar">${esc(initialOf(name))}</span>
            <span class="cust-text">
              <span class="cust-name">${esc(name)}</span>
              ${c.email ? `<span class="cust-sub">${esc(c.email)}</span>` : ""}
            </span>
          </div>
        </td>
        <td class="col-phone">${phoneCell(c.phone)}</td>
        <td class="col-reps"><div class="rep-list">${repChips(c.assigned_users)}</div></td>
        <td class="col-action">
          <button class="btn-view" data-customer-id="${id}">View</button>
        </td>`;
      rows.appendChild(row);

      const card = document.createElement("div");
      card.className = `customer-card customer-card--${region}`;
      card.innerHTML = `
        <div class="customer-card-header">
          <span class="avatar">${esc(initialOf(name))}</span>
          <span class="cust-text">
            <span class="cust-name">${esc(name)}</span>
            <span class="cust-sub">${c.code ? esc(c.code) : `#${esc(id)}`}</span>
          </span>
          <span class="region-pill region-pill--${region}">${region.toUpperCase()}</span>
        </div>
        <div class="customer-card-body">
          <p><span class="customer-card-label">Phone</span> ${phoneCell(c.phone)}</p>
          ${c.email ? `<p><span class="customer-card-label">Email</span> ${esc(c.email)}</p>` : ""}
          <p><span class="customer-card-label">Assigned to</span></p>
          <div class="rep-list">${repChips(c.assigned_users)}</div>
        </div>
        <div class="customer-card-footer">
          <button class="btn-view" data-customer-id="${id}">View</button>
        </div>`;
      cards.appendChild(card);
    }

    tableBody.replaceChildren(rows);
    cardContainer.replaceChildren(cards);
  }

  function renderMeta(shown) {
    const meta = document.getElementById("result-meta");
    if (!meta) return;
    if (!state.total) {
      meta.textContent = "";
      return;
    }
    const from = (state.page - 1) * state.limit + 1;
    const to = from + shown - 1;
    meta.innerHTML = `Showing <strong>${from}–${to}</strong> of <strong>${state.total}</strong> customers`;
  }

  function renderPagination() {
    let container = document.getElementById("pagination");
    if (!container) {
      container = document.createElement("div");
      container.id = "pagination";
      container.className = "pagination-controls";
      document.querySelector(".card-view")?.after(container);
    }

    if (state.totalPages <= 1) {
      container.replaceChildren();
      return;
    }

    const maxButtons = 7;
    let start = Math.max(1, state.page - Math.floor(maxButtons / 2));
    let end = Math.min(state.totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);

    const frag = document.createDocumentFragment();
    const mkBtn = (text, page, disabled, active) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = text;
      btn.disabled = disabled;
      if (active) btn.classList.add("active");
      if (!disabled) btn.addEventListener("click", () => load(page));
      return btn;
    };

    frag.appendChild(mkBtn("‹", state.page - 1, state.page === 1));
    if (start > 1) {
      frag.appendChild(mkBtn("1", 1, false, false));
      if (start > 2) {
        const gap = document.createElement("span");
        gap.className = "page-gap";
        gap.textContent = "…";
        frag.appendChild(gap);
      }
    }
    for (let i = start; i <= end; i++) {
      frag.appendChild(mkBtn(String(i), i, false, i === state.page));
    }
    if (end < state.totalPages) {
      if (end < state.totalPages - 1) {
        const gap = document.createElement("span");
        gap.className = "page-gap";
        gap.textContent = "…";
        frag.appendChild(gap);
      }
      frag.appendChild(mkBtn(String(state.totalPages), state.totalPages, false, false));
    }
    frag.appendChild(mkBtn("›", state.page + 1, state.page === state.totalPages));

    container.replaceChildren(frag);
  }
})();
