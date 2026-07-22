(function () {
  const { Api, Auth, UI, Async, DOM, Format, API_BASE } = window.Utils;
  const esc = DOM.escapeHtml;

  const FILTER_IDS = [
    "product-search",
    "brand-filter",
    "category-filter",
    "availability-filter",
    "visibility-filter",
  ];

  const state = {
    page: 1,
    limit: 20,
    pages: 1,
    total: 0,
    products: [],
  };

  let currentAction = "edit";
  let exportType = "all";
  let importMode = "update";

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    UI.checkScreenSize();
    window.addEventListener("resize", Async.throttle(UI.checkScreenSize, 150));

    wireToolbar();
    wireModals();
    wireRowActions();

    await Promise.all([populateBrands(), populateCategories()]);
    await load();
  });

  function imageUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return `${API_BASE}/images/${String(path).replace(/^\/+/, "")}`;
  }

  function filterValues() {
    return {
      search: document.getElementById("product-search").value.trim(),
      brand: document.getElementById("brand-filter").value,
      category: document.getElementById("category-filter").value,
      availability: document.getElementById("availability-filter").value,
      visability: document.getElementById("visibility-filter").value,
    };
  }

  function wireToolbar() {
    const reload = Async.debounce(() => {
      state.page = 1;
      load();
    }, 300);
    document.getElementById("product-search").addEventListener("input", reload);

    document.getElementById("brand-filter").addEventListener("change", async () => {
      await populateCategories();
      state.page = 1;
      load();
    });

    ["category-filter", "availability-filter", "visibility-filter"].forEach((id) => {
      document.getElementById(id).addEventListener("change", () => {
        state.page = 1;
        load();
      });
    });

    document.getElementById("reset-filters-btn").addEventListener("click", async () => {
      FILTER_IDS.forEach((id) => {
        document.getElementById(id).value = "";
      });
      await populateCategories();
      state.page = 1;
      load();
    });
  }

  async function populateBrands() {
    try {
      const data = await Api.get("/products/brands");
      const select = document.getElementById("brand-filter");
      select.innerHTML =
        `<option value="">All brands</option>` +
        (data.brands || []).map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("");
    } catch (err) {
      console.error("Failed to load brands:", err);
    }
  }

  async function populateCategories() {
    try {
      const brand = document.getElementById("brand-filter").value;
      const data = await Api.get("/products/categories", {
        query: brand ? { brand } : {},
      });
      const select = document.getElementById("category-filter");
      const previous = select.value;
      select.innerHTML =
        `<option value="">All categories</option>` +
        (data.categories || [])
          .map((c) => `<option value="${esc(c)}">${esc(c)}</option>`)
          .join("");
      if (Array.from(select.options).some((o) => o.value === previous)) {
        select.value = previous;
      }
    } catch (err) {
      console.error("Failed to load categories:", err);
    }
  }

  async function load(page = state.page) {
    const loading = document.getElementById("products-loading");
    loading?.classList.remove("hidden");
    try {
      const query = { page, limit: state.limit, ...filterValues() };
      Object.keys(query).forEach((k) => {
        if (query[k] === "" || query[k] == null) delete query[k];
      });

      const data = await Api.get("/products", { query });
      state.products = data.data || [];
      state.page = data.page || 1;
      state.pages = data.pages || 1;
      state.total = data.total ?? state.products.length;

      render();
      renderMeta();
      renderSummary();
      renderPagination();
    } catch (err) {
      console.error("Failed to load products:", err);
      alert(err.data?.message || err.message || "Could not load products.");
    } finally {
      loading?.classList.add("hidden");
    }
  }

  function availabilityPill(product) {
    const value = product.availability || "Unavailable";
    const slug = String(value).toLowerCase();
    const stock = product.stock_quantity;
    const count = stock == null ? "" : ` <span class="stock-count">${esc(stock)}</span>`;
    return `<span class="avail-pill avail-pill--${esc(slug)}">${esc(value)}</span>${count}`;
  }

  function thumb(product) {
    const url = imageUrl(product.image_path);
    const initial = esc((product.product_name || "?").trim().charAt(0).toUpperCase());
    if (!url) return `<span class="thumb thumb--empty">${initial}</span>`;
    return `<span class="thumb"><img src="${esc(url)}" alt="" loading="lazy"
              onerror="this.parentNode.classList.add('thumb--empty');this.remove()" /></span>`;
  }

  function actionsMenu(product) {
    const id = product.product_id;
    return `
      <div class="action-container">
        <button type="button" class="action-btn" data-menu="${id}" aria-label="Actions">⋮</button>
        <div class="dropdown-menu" id="menu-${id}">
          <button type="button" data-act="edit" data-id="${id}">Edit</button>
          <button type="button" data-act="copy" data-id="${id}">Duplicate</button>
          <button type="button" data-act="visibility" data-id="${id}" data-visible="${product.visability}">
            ${product.visability === 1 ? "Hide" : "Show"}
          </button>
          <button type="button" class="danger" data-act="delete" data-id="${id}">Delete</button>
        </div>
      </div>`;
  }

  function render() {
    const tbody = document.getElementById("productsTable");
    const cards = document.getElementById("productCards");
    const empty = document.getElementById("products-empty");
    if (!tbody || !cards) return;

    empty?.classList.toggle("hidden", state.products.length > 0);

    const rowFrag = document.createDocumentFragment();
    const cardFrag = document.createDocumentFragment();

    for (const p of state.products) {
      const hidden = p.visability !== 1;
      const name = p.product_name || "—";

      const tr = document.createElement("tr");
      if (hidden) tr.className = "is-hidden-product";
      tr.innerHTML = `
        <td class="col-img">${thumb(p)}</td>
        <td>
          <div class="prod-name">${esc(name)}</div>
          <div class="prod-sub">
            <span class="barcode">${esc(p.bar_code || "-")}</span>
            ${hidden ? `<span class="hidden-pill">Hidden</span>` : ""}
          </div>
        </td>
        <td class="col-item">${esc(p.Item_number || "-")}</td>
        <td class="col-brand">
          <div>${esc(p.brand || "-")}</div>
          <div class="prod-sub">${esc(p.category || "-")}</div>
        </td>
        <td class="col-price">${esc(Format.currency(p.price))}</td>
        <td class="col-stock">${availabilityPill(p)}</td>
        <td class="col-action">${actionsMenu(p)}</td>`;
      rowFrag.appendChild(tr);

      const card = document.createElement("div");
      card.className = `product-card${hidden ? " is-hidden-product" : ""}`;
      card.innerHTML = `
        <div class="product-card-top">
          ${thumb(p)}
          <div class="product-card-title">
            <div class="prod-name">${esc(name)}</div>
            <div class="prod-sub">
              <span class="barcode">${esc(p.bar_code || "-")}</span>
              ${hidden ? `<span class="hidden-pill">Hidden</span>` : ""}
            </div>
          </div>
          ${actionsMenu(p)}
        </div>
        <div class="product-card-body">
          <div><small>Item No.</small><span>${esc(p.Item_number || "-")}</span></div>
          <div><small>Brand</small><span>${esc(p.brand || "-")}</span></div>
          <div><small>Category</small><span>${esc(p.category || "-")}</span></div>
          <div><small>Price</small><span>${esc(Format.currency(p.price))}</span></div>
          <div><small>Stock</small><span>${availabilityPill(p)}</span></div>
        </div>`;
      cardFrag.appendChild(card);
    }

    tbody.replaceChildren(rowFrag);
    cards.replaceChildren(cardFrag);
  }

  function renderMeta() {
    const meta = document.getElementById("result-meta");
    if (!meta) return;
    if (!state.total) {
      meta.textContent = "";
      return;
    }
    const from = (state.page - 1) * state.limit + 1;
    const to = from + state.products.length - 1;
    meta.innerHTML = `Showing <strong>${from}–${to}</strong> of <strong>${state.total}</strong> products`;
  }

  function renderSummary() {
    const box = document.getElementById("summary-row");
    if (!box) return;
    if (!state.products.length) {
      box.innerHTML = "";
      return;
    }
    const count = (fn) => state.products.filter(fn).length;
    const tiles = [
      ["On this page", state.products.length, ""],
      ["Available", count((p) => p.availability === "Available"), "ok"],
      ["Limited", count((p) => p.availability === "Limited"), "warn"],
      ["Unavailable", count((p) => p.availability === "Unavailable"), "off"],
      ["Hidden", count((p) => p.visability !== 1), "off"],
    ];
    box.innerHTML = tiles
      .map(
        ([label, value, mod]) =>
          `<div class="stat-tile${mod ? ` stat-tile--${mod}` : ""}"><span>${value}</span><small>${label}</small></div>`
      )
      .join("");
  }

  function renderPagination() {
    const container = document.getElementById("pagination");
    if (!container) return;
    if (state.pages <= 1) {
      container.replaceChildren();
      return;
    }

    const maxButtons = 7;
    let start = Math.max(1, state.page - Math.floor(maxButtons / 2));
    const end = Math.min(state.pages, start + maxButtons - 1);
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
    const gap = () => {
      const s = document.createElement("span");
      s.className = "page-gap";
      s.textContent = "…";
      return s;
    };

    frag.appendChild(mkBtn("‹", state.page - 1, state.page === 1));
    if (start > 1) {
      frag.appendChild(mkBtn("1", 1, false, false));
      if (start > 2) frag.appendChild(gap());
    }
    for (let i = start; i <= end; i++) {
      frag.appendChild(mkBtn(String(i), i, false, i === state.page));
    }
    if (end < state.pages) {
      if (end < state.pages - 1) frag.appendChild(gap());
      frag.appendChild(mkBtn(String(state.pages), state.pages, false, false));
    }
    frag.appendChild(mkBtn("›", state.page + 1, state.page === state.pages));

    container.replaceChildren(frag);
  }

  function closeMenus() {
    document.querySelectorAll(".dropdown-menu.open").forEach((m) => m.classList.remove("open"));
  }

  function wireRowActions() {
    document.body.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-menu]");
      if (trigger) {
        const menu = document.getElementById(`menu-${trigger.dataset.menu}`);
        const wasOpen = menu?.classList.contains("open");
        closeMenus();
        if (menu && !wasOpen) menu.classList.add("open");
        return;
      }

      const action = e.target.closest("[data-act]");
      if (!action) {
        closeMenus();
        return;
      }

      closeMenus();
      const id = parseInt(action.dataset.id, 10);
      switch (action.dataset.act) {
        case "edit":
          openProductDialog("edit", id);
          break;
        case "copy":
          openProductDialog("copy", id);
          break;
        case "visibility":
          toggleVisibility(id, parseInt(action.dataset.visible, 10));
          break;
        case "delete":
          deleteProduct(id);
          break;
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMenus();
    });
  }

  function openModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
  }

  function wireModals() {
    document.getElementById("add-product-btn").addEventListener("click", openAddProductDialog);
    document.getElementById("product-cancel-btn").addEventListener("click", () => {
      closeModal("product-modal");
      document.getElementById("product-form").reset();
    });

    document.getElementById("export-open-btn").addEventListener("click", () => openModal("export-modal"));
    document.getElementById("import-open-btn").addEventListener("click", () => {
      document.getElementById("import-error-message").classList.add("hidden");
      openModal("import-modal");
    });

    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal:not(.hidden)").forEach((m) => closeModal(m.id));
      }
    });

    document.querySelectorAll("#export-modal .option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#export-modal .option-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        exportType = btn.dataset.value;
      });
    });

    document.querySelectorAll("#import-modal .option-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#import-modal .option-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        importMode = btn.dataset.value;
      });
    });

    document.getElementById("export-go-btn").addEventListener("click", handleExport);
    document.getElementById("import-go-btn").addEventListener("click", handleImport);
    document.getElementById("product-form").addEventListener("submit", submitProduct);
  }

  function showModalError(id, message) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.classList.remove("hidden");
  }

  function openAddProductDialog() {
    currentAction = "add";
    const form = document.getElementById("product-form");
    form.reset();
    document.getElementById("modal-error-message").classList.add("hidden");
    document.getElementById("product-modal-title").textContent = "Add Product";
    document.getElementById("product-id").value = "";
    document.getElementById("product-order-limit").value = -1;
    document.getElementById("availability-limit").value = 100;
    openModal("product-modal");
  }

  async function openProductDialog(action, productId) {
    currentAction = action;
    document.getElementById("modal-error-message").classList.add("hidden");
    document.getElementById("product-modal-title").textContent =
      action === "copy" ? "Duplicate Product" : "Edit Product";

    try {
      const { data } = await Api.get(`/product/find/${productId}`);
      document.getElementById("product-id").value = productId;

      const isCopy = action === "copy";
      document.getElementById("product-name").value = isCopy ? "" : data.product_name || "";
      document.getElementById("bar-code").value = isCopy ? "" : data.bar_code || "";
      document.getElementById("item-number").value = isCopy ? "" : data.Item_number || "";
      document.getElementById("brand").value = data.brand || "";
      document.getElementById("category").value = data.category || "";
      document.getElementById("description").value = data.description || "";
      document.getElementById("price").value = data.price ?? "";
      document.getElementById("product-order-limit").value = data.product_order_limit ?? "";
      document.getElementById("availability-limit").value = data.availability_limit ?? "";

      openModal("product-modal");
    } catch (err) {
      console.error("Error fetching product data:", err);
      alert(err.data?.message || "Failed to load product data.");
    }
  }

  async function submitProduct(e) {
    e.preventDefault();

    const id = document.getElementById("product-id").value;
    const formData = new FormData();
    formData.append("product_name", document.getElementById("product-name").value);
    formData.append("bar_code", document.getElementById("bar-code").value);
    formData.append("item_number", document.getElementById("item-number").value);
    formData.append("brand", document.getElementById("brand").value);
    formData.append("category", document.getElementById("category").value);
    formData.append("description", document.getElementById("description").value);
    formData.append("price", document.getElementById("price").value);
    formData.append("product_order_limit", document.getElementById("product-order-limit").value);
    formData.append("availability_limit", document.getElementById("availability-limit").value);

    const file = document.getElementById("image").files[0];
    if (file) formData.append("image", file);

    const path =
      currentAction === "add"
        ? "/add_product"
        : currentAction === "edit"
        ? `/product/edit/${id}`
        : `/product/copy/${id}`;

    try {
      const result = await Api.post(path, formData);
      alert(result?.message || "Saved");
      closeModal("product-modal");
      document.getElementById("product-form").reset();
      Api.invalidate("/products");
      await load();
    } catch (err) {
      showModalError("modal-error-message", err.data?.message || err.message || "Something went wrong.");
    }
  }

  async function deleteProduct(id) {
    if (!confirm("Delete this product?")) return;
    try {
      const result = await Api.del(`/product/delete/${id}`);
      alert(result?.message || "Product deleted.");
      Api.invalidate("/products");
      await load();
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to delete product.");
    }
  }

  async function toggleVisibility(productId, currentVisibility) {
    const next = currentVisibility === 1 ? 0 : 1;
    if (!confirm(next === 1 ? "Show this product?" : "Hide this product?")) return;
    try {
      const result = await Api.post(`/products/set_visibility/${productId}/${next}`);
      alert(result?.message || "Visibility updated.");
      Api.invalidate("/products");
      await load();
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to update visibility.");
    }
  }

  async function handleExport() {
    const query = {};
    if (exportType === "filtered") {
      const f = filterValues();
      if (f.brand) query.brand = f.brand;
      if (f.category) query.category = f.category;
      if (f.search) query.bar_code = f.search;
    }

    const params = new URLSearchParams(query).toString();
    const url = `${API_BASE}/products/export${params ? `?${params}` : ""}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = "products_export.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(dlUrl);
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      closeModal("export-modal");
    }
  }

  async function handleImport() {
    const xlsxInput = document.getElementById("import-file");
    const zipInput = document.getElementById("images-zip");
    const hasXlsx = xlsxInput.files.length > 0;
    const hasZip = zipInput.files.length > 0;

    document.getElementById("import-error-message").classList.add("hidden");

    if (!hasXlsx && !hasZip) {
      showModalError("import-error-message", "Select at least one file (Excel or ZIP).");
      return;
    }

    const formData = new FormData();
    if (hasXlsx) {
      formData.append("file", xlsxInput.files[0]);
      formData.append("mode", importMode);
    }
    if (hasZip) formData.append("images_zip", zipInput.files[0]);

    const path = hasXlsx
      ? `/products/import?mode=${encodeURIComponent(importMode)}`
      : "/products/images/import";

    try {
      const result = await Api.post(path, formData);
      if (hasXlsx) {
        alert(`Import successful: Added ${result.added}, Updated ${result.updated}`);
      } else {
        alert(`Images updated: ${result.updated}. Skipped: ${(result.skipped || []).length}`);
      }
      closeModal("import-modal");
      xlsxInput.value = "";
      zipInput.value = "";
      Api.invalidate("/products");
      await load();
    } catch (err) {
      showModalError("import-error-message", err.data?.message || err.message || "Import failed.");
    }
  }
})();
