(function () {
  const { Api, Auth, Async, DOM, Format } = window.Utils;
  const esc = DOM.escapeHtml;

  const STATUS_LABELS = {
    delivered: "تم التسليم",
    "partial delivered": "تم تسليم جزء",
    "partial refund": "تسليم جزئي مع مرتجع",
    refund: "مرتجع بالكامل",
    delay: "مؤجل",
  };

  function statusLabel(status) {
    const key = String(status || "").toLowerCase();
    return STATUS_LABELS[key] || status || "-";
  }

  const FILTER_IDS = [
    "filter-status",
    "filter-driver",
    "filter-distributor",
    "filter-sap-order",
    "filter-date-start",
    "filter-date-end",
  ];

  let allDeliveries = [];
  let endpoint = "/deliveries";
  let canSeeAllDrivers = false;
  let canManageDeliveries = false;
  let expandedAll = false;
  let managerDrivers = [];
  let managerDistributors = [];
  let managerCars = [];
  let editPayload = null;
  let editMoneyCollected = false;

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isAdmin = localStorage.getItem("is_admin") === "1";
    const isDriverManager = localStorage.getItem("driver_manager") === "1";
    const isStorageManager = localStorage.getItem("storage_manager") === "1";
    const isDriver = localStorage.getItem("driver") === "1";
    const isDistributor = localStorage.getItem("distributor") === "1";

    canManageDeliveries = isAdmin || isDriverManager;
    canSeeAllDrivers = canManageDeliveries || isStorageManager;

    if (!canSeeAllDrivers && !isDriver && !isDistributor) {
      alert("مش مسموحلك تدخل الصفحة دي.");
      window.location.href = "dashboard.html";
      return;
    }

    if (canManageDeliveries) document.getElementById("distributor-field").classList.remove("hidden");

    if (!canSeeAllDrivers) {
      endpoint = "/delivery/deliveries";
      document.getElementById("page-heading").textContent = "توصيلاتي";
      document.getElementById("driver-field").classList.add("hidden");
    }

    wireFilters();
    wireList();
    wireEditModal();

    if (canManageDeliveries) {
      await loadManagerLookups();
      paintDriverFilter();
      paintDistributorFilter();
    }

    const presetDriver = new URLSearchParams(location.search).get("driver_user_id");
    if (presetDriver && canManageDeliveries) {
      const select = document.getElementById("filter-driver");
      select.value = presetDriver;
      const name = select.selectedOptions[0]?.textContent;
      if (name && select.value) {
        document.getElementById("page-heading").textContent = `التوصيلات — ${name}`;
        document.getElementById("back-to-fleet").classList.remove("hidden");
        openFilters(true);
      }
    }

    await loadDeliveries();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
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
        const element = document.getElementById(id);
        if (element) element.value = "";
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
        ? "قفل الكل"
        : "فتح الكل";
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
    return FILTER_IDS.reduce((count, id) => {
      if ((id === "filter-driver" || id === "filter-distributor") && !canSeeAllDrivers) return count;
      const element = document.getElementById(id);
      return element?.value ? count + 1 : count;
    }, 0);
  }

  function paintFilterCount() {
    const badge = document.getElementById("filters-count");
    const count = activeFilterCount();
    badge.textContent = count;
    badge.classList.toggle("hidden", count === 0);
  }

  async function loadManagerLookups() {
    try {
      const [driverData, distributorData, carData] = await Promise.all([
        Api.get("/drivers"),
        Api.get("/distributors"),
        Api.get("/cars"),
      ]);
      managerDrivers = driverData.drivers || [];
      managerDistributors = distributorData.distributors || [];
      managerCars = carData.cars || [];
    } catch (err) {
      console.error("Could not load delivery edit choices:", err);
      managerDrivers = [];
      managerDistributors = [];
      managerCars = [];
    }
  }

  function paintDriverFilter() {
    const select = document.getElementById("filter-driver");
    if (!select) return;
    const options = managerDrivers
      .map((driver) => `<option value="${driver.user_id}">${esc(driver.username)}</option>`)
      .join("");
    select.innerHTML = `<option value="">كل السواقين</option>${options}`;
  }

  function paintDistributorFilter() {
    const select = document.getElementById("filter-distributor");
    if (!select) return;
    select.innerHTML = `<option value="">كل الموزعين</option>${managerDistributors.map((person) => `<option value="${person.user_id}">${esc(person.username)}</option>`).join("")}`;
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
        query.distributor_user_id = document.getElementById("filter-distributor")?.value || "";
      }

      const data = await Api.get(endpoint, { query });
      allDeliveries = data.deliveries || [];
      render(allDeliveries);
    } catch (err) {
      console.error("Failed to load deliveries:", err);
      alert("مقدرناش نحمل التوصيلات.");
    } finally {
      loading?.classList.add("hidden");
    }
  }

  function statusPill(status) {
    const slug = String(status || "").replace(/\s+/g, "-");
    return `<span class="result-pill result-pill--${esc(slug)}">${esc(statusLabel(status))}</span>`;
  }

  function itemTotals(delivery) {
    return (delivery.items || []).reduce(
      (acc, item) => {
        acc.ordered += Number(item.qty_ordered || 0);
        acc.delivered += Number(item.qty_delivered || 0);
        acc.returned += Number(item.qty_returned || 0);
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
    if (expandBtn) expandBtn.textContent = "فتح الكل";

    const fragment = document.createDocumentFragment();
    deliveries.forEach((delivery) => fragment.appendChild(buildCard(delivery)));
    list.replaceChildren(fragment);
  }

  function buildCard(delivery) {
    const slug = String(delivery.status || "").replace(/\s+/g, "-");
    const totals = itemTotals(delivery);
    const when = delivery.delivered_at ? Format.dateSlash(delivery.delivered_at) : "—";

    const card = document.createElement("article");
    card.className = `dlv-card dlv-card--${slug}`;
    card.dataset.deliveryId = delivery.delivery_id;

    const meta = [];
    meta.push(`السواق: ${esc(delivery.driver?.username || "—")}`);
    meta.push(`الموزع: ${esc(delivery.distributor?.username || "—")}`);
    meta.push(`سجله: ${esc(delivery.recorded_by?.username || "—")}`);
    if (delivery.car?.plate) meta.push(`<span class="plate">${esc(delivery.car.plate)}</span>`);
    meta.push(`تم تسليم ${esc(totals.delivered)}/${esc(totals.ordered)}`);
    meta.push(
      delivery.money_collected
        ? `تم التحصيل: ${Number(delivery.collected_amount || 0).toFixed(2)}`
        : "مفيش فلوس اتحصلت"
    );

    const managerTools = canManageDeliveries
      ? `<div class="dlv-card-tools">
          <button type="button" class="delivery-action edit" data-delivery-action="edit" data-id="${delivery.delivery_id}">تعديل</button>
          <button type="button" class="delivery-action delete" data-delivery-action="delete" data-id="${delivery.delivery_id}">حذف</button>
        </div>`
      : "";

    card.innerHTML = `
      <button type="button" class="dlv-head" aria-expanded="false">
        <span class="chev" aria-hidden="true"></span>
        <span class="dlv-head-main">
          <span class="dlv-title">
            <strong>#${esc(delivery.sap_order_id)}</strong>
            ${statusPill(delivery.status)}
            ${
              delivery.sap_reviewed_at_delivery
                ? ""
                : `<span class="warn-dot" title="الطلب مكنش متراجع وقت التوصيل">!</span>`
            }
          </span>
          <span class="dlv-meta">${meta.join('<span class="dot">·</span>')}</span>
        </span>
        <span class="dlv-when">${esc(when)}</span>
      </button>
      ${managerTools}
      <div class="dlv-body"><div class="dlv-body-inner"></div></div>`;

    return card;
  }

  function setOpen(card, open) {
    const head = card.querySelector(".dlv-head");
    const inner = card.querySelector(".dlv-body-inner");
    if (open && !inner.dataset.filled) {
      const id = parseInt(card.dataset.deliveryId, 10);
      const delivery = allDeliveries.find((entry) => entry.delivery_id === id);
      if (delivery) {
        inner.innerHTML = detailHtml(delivery);
        inner.dataset.filled = "1";
      }
    }
    card.classList.toggle("open", open);
    head.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function wireList() {
    const list = document.getElementById("delivery-list");
    list.addEventListener("click", (event) => {
      const actionBtn = event.target.closest("[data-delivery-action]");
      if (actionBtn) {
        const deliveryId = parseInt(actionBtn.dataset.id, 10);
        if (actionBtn.dataset.deliveryAction === "edit") openEditDelivery(deliveryId);
        if (actionBtn.dataset.deliveryAction === "delete") deleteDelivery(deliveryId);
        return;
      }

      if (event.target.closest("a")) return;
      const head = event.target.closest(".dlv-head");
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
    deliveries.forEach((delivery) => {
      counts[delivery.status] = (counts[delivery.status] || 0) + 1;
      if (!delivery.sap_reviewed_at_delivery) unreviewed += 1;
    });

    const tiles = [
      `<div class="stat-tile"><span>${deliveries.length}</span><small>الإجمالي</small></div>`,
    ];
    Object.entries(counts).forEach(([status, count]) => {
      const slug = String(status || "").replace(/\s+/g, "-");
      tiles.push(
        `<div class="stat-tile stat-tile--${esc(slug)}"><span>${count}</span><small>${esc(
          statusLabel(status)
        )}</small></div>`
      );
    });
    if (unreviewed) {
      tiles.push(
        `<div class="stat-tile stat-tile--warn"><span>${unreviewed}</span><small>مش متراجع</small></div>`
      );
    }
    box.innerHTML = tiles.join("");
  }

  function detailHtml(delivery) {
    const totals = itemTotals(delivery);
    const rows = (delivery.items || [])
      .map(
        (item) => `
        <tr>
          <td data-label="Item">${esc(item.product_name || "-")}</td>
          <td data-label="Ordered">${esc(item.qty_ordered)}</td>
          <td data-label="Delivered">${esc(item.qty_delivered)}</td>
          <td data-label="Returned">${esc(item.qty_returned)}</td>
        </tr>`
      )
      .join("");

    const facts = [
      ["التوصيل", `#${esc(delivery.delivery_id)}`],
      ["طلب SAP", `#${esc(delivery.sap_order_id)}`],
      ["التاريخ", esc(delivery.delivered_at ? Format.dateSlash(delivery.delivered_at) : "—")],
      ["تم استلام فلوس", delivery.money_collected ? "نعم" : "لا"],
      ["المبلغ المستلم", Number(delivery.collected_amount || 0).toFixed(2)],
    ];
    facts.splice(2, 0,
      ["السواق", esc(delivery.driver?.username || "—")],
      ["الموزع", esc(delivery.distributor?.username || "—")],
      ["سجله", esc(delivery.recorded_by?.username || "—")],
      ["العربية", esc(delivery.car?.plate || "—")]
    );

    return `
      <div class="detail-grid">
        ${facts.map(([key, value]) => `<div><small>${key}</small><span>${value}</span></div>`).join("")}
      </div>
      ${
        delivery.sap_reviewed_at_delivery
          ? ""
          : `<p class="detail-warning">طلب SAP مكنش متراجع وقت تسجيل التوصيل ده.</p>`
      }
      ${delivery.note ? `<p class="detail-note"><strong>ملاحظة</strong> ${esc(delivery.note)}</p>` : ""}
      <div class="table-wrapper">
        <table class="items-table">
          <thead><tr><th>الصنف</th><th>الكمية المطلوبة</th><th>اتسلم</th><th>مرتجع</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4">مفيش أصناف مسجلة.</td></tr>`}</tbody>
          <tfoot>
            <tr>
              <td><strong>الإجمالي</strong></td>
              <td><strong>${totals.ordered}</strong></td>
              <td><strong>${totals.delivered}</strong></td>
              <td><strong>${totals.returned}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>`;
  }

  function wireEditModal() {
    document.getElementById("delivery-edit-close")?.addEventListener("click", closeEditModal);
    document.getElementById("delivery-edit-cancel")?.addEventListener("click", closeEditModal);
    document.getElementById("delivery-edit-modal")?.addEventListener("click", (event) => {
      if (event.target.id === "delivery-edit-modal") closeEditModal();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeEditModal();
    });

    document.getElementById("delivery-edit-form")?.addEventListener("submit", saveEditDelivery);
    document.getElementById("edit-money-no")?.addEventListener("click", () => setEditPayment(false));
    document.getElementById("edit-money-yes")?.addEventListener("click", () => setEditPayment(true));
    document.getElementById("edit-items-body")?.addEventListener("input", handleEditQuantity);
  }

  async function openEditDelivery(deliveryId) {
    if (!canManageDeliveries) return;
    showEditMessage("");

    try {
      if (!managerDrivers.length && !managerCars.length) await loadManagerLookups();
      const data = await Api.get(`/deliveries/${deliveryId}/edit-data`, { retries: 0 });
      editPayload = data;
      const delivery = data.delivery;

      document.getElementById("edit-delivery-id").value = delivery.delivery_id;
      document.getElementById("edit-sap-order").textContent = `#${delivery.sap_order_id}`;
      document.getElementById("edit-delivered-at").textContent = delivery.delivered_at
        ? Format.dateSlash(delivery.delivered_at)
        : "—";
      document.getElementById("edit-note").value = delivery.note || "";

      paintEditDriverOptions(delivery.driver_user_id);
      paintEditDistributorOptions(delivery.distributor_user_id);
      paintEditCarOptions(delivery.car_id);
      renderEditItems();
      document.getElementById("edit-collected-amount").value = delivery.money_collected
        ? Number(delivery.collected_amount || 0).toFixed(2)
        : "";
      setEditPayment(Boolean(delivery.money_collected));
      updateEditStatusPreview();
      document.getElementById("delivery-edit-modal").classList.remove("hidden");
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نحمل بيانات التوصيل للتعديل.");
    }
  }

  function paintEditDriverOptions(selectedId) {
    const select = document.getElementById("edit-driver");
    const options = managerDrivers.map((driver) => {
      const inactive = Number(driver.active) === 1 ? "" : " (متوقف)";
      const selected = Number(driver.user_id) === Number(selectedId) ? " selected" : "";
      return `<option value="${driver.user_id}"${selected}>${esc(driver.username)}${inactive}</option>`;
    });

    if (!managerDrivers.some((driver) => Number(driver.user_id) === Number(selectedId))) {
      const current = allDeliveries.find(
        (delivery) => Number(delivery.delivery_id) === Number(editPayload?.delivery?.delivery_id)
      );
      options.unshift(
        `<option value="${selectedId}" selected>${esc(current?.driver?.username || `سواق ${selectedId}`)} (تاريخ)</option>`
      );
    }
    select.innerHTML = options.join("");
  }

  function paintEditDistributorOptions(selectedId) {
    const select = document.getElementById("edit-distributor");
    const options = [`<option value="">بدون موزع (توصيل قديم)</option>`];
    managerDistributors.forEach((person) => {
      const selected = Number(person.user_id) === Number(selectedId) ? " selected" : "";
      options.push(`<option value="${person.user_id}"${selected}>${esc(person.username)}</option>`);
    });
    if (selectedId && !managerDistributors.some((person) => Number(person.user_id) === Number(selectedId))) {
      const current = allDeliveries.find((entry) => Number(entry.delivery_id) === Number(editPayload?.delivery?.delivery_id));
      options.push(`<option value="${selectedId}" selected>${esc(current?.distributor?.username || `موزع ${selectedId}`)} (تاريخ)</option>`);
    }
    select.innerHTML = options.join("");
  }

  function paintEditCarOptions(selectedId) {
    const select = document.getElementById("edit-car");
    const options = [`<option value="">من غير عربية</option>`];
    managerCars.forEach((car) => {
      const inactive = Number(car.active) === 1 ? "" : " (متوقفة)";
      const selected = Number(car.car_id) === Number(selectedId) ? " selected" : "";
      options.push(`<option value="${car.car_id}"${selected}>${esc(car.plate)}${inactive}</option>`);
    });
    if (
      selectedId &&
      !managerCars.some((car) => Number(car.car_id) === Number(selectedId))
    ) {
      const current = allDeliveries.find(
        (delivery) => Number(delivery.delivery_id) === Number(editPayload?.delivery?.delivery_id)
      );
      options.push(
        `<option value="${selectedId}" selected>${esc(current?.car?.plate || `عربية ${selectedId}`)} (تاريخ)</option>`
      );
    }
    select.innerHTML = options.join("");
  }

  function renderEditItems() {
    const body = document.getElementById("edit-items-body");
    const rows = (editPayload?.items || []).map((item, index) => `
      <tr data-index="${index}">
        <td data-label="Item">${esc(item.product_name || "-")}</td>
        <td data-label="Ordered">${item.qty_ordered}</td>
        <td data-label="مستخدم في توصيلات تانية">${item.qty_used_by_others}</td>
        <td data-label="أقصى كمية">${item.correction_max}</td>
        <td data-label="Delivered">
          <input type="number" class="edit-qty" data-field="qty_delivered" min="0" max="${item.correction_max}" step="1" value="${item.qty_delivered}" />
        </td>
        <td data-label="Returned">
          <input type="number" class="edit-qty" data-field="qty_returned" min="0" max="${item.correction_max}" step="1" value="${item.qty_returned}" />
        </td>
      </tr>
    `);
    body.innerHTML = rows.join("");
  }

  function handleEditQuantity(event) {
    const input = event.target.closest(".edit-qty");
    if (!input || !editPayload) return;
    const row = input.closest("tr");
    const item = editPayload.items[Number(row.dataset.index)];
    if (!item) return;

    const field = input.dataset.field;
    const raw = input.value.trim();
    const value = raw === "" ? 0 : Number(raw);
    const otherField = field === "qty_delivered" ? "qty_returned" : "qty_delivered";
    const max = Number(item.correction_max || 0);

    let error = "";
    if (!Number.isInteger(value) || value < 0) {
      error = "اكتب رقم صحيح ومش سالب.";
    } else if (value > max) {
      error = `أقصى كمية متاحة هنا هي ${max}.`;
    }
    input.setCustomValidity(error);
    row.classList.toggle("row-invalid", Boolean(error));
    if (!error) {
      item[field] = value;
      if (Number(item[field]) + Number(item[otherField] || 0) > max) {
        item[otherField] = max - value;
        const pairedInput = row.querySelector(`[data-field="${otherField}"]`);
        pairedInput.value = String(item[otherField]);
        pairedInput.setCustomValidity("");
      }
      updateEditStatusPreview();
    }
  }

  function deriveEditStatus() {
    const items = editPayload?.items || [];
    const delivered = items.reduce((total, item) => total + Number(item.qty_delivered || 0), 0);
    const returned = items.reduce((total, item) => total + Number(item.qty_returned || 0), 0);
    const openAfter = items.reduce(
      (total, item) =>
        total + Math.max(0, Number(item.correction_max || 0) - Number(item.qty_delivered || 0) - Number(item.qty_returned || 0)),
      0
    );
    if (!delivered && !returned) return "delay";
    if (returned && delivered) return "partial refund";
    if (returned) return openAfter === 0 ? "refund" : "partial refund";
    return openAfter === 0 ? "delivered" : "partial delivered";
  }

  function updateEditStatusPreview() {
    const element = document.getElementById("edit-status-preview");
    if (element) element.textContent = statusLabel(deriveEditStatus());
  }

  function setEditPayment(value) {
    editMoneyCollected = Boolean(value);
    const noBtn = document.getElementById("edit-money-no");
    const yesBtn = document.getElementById("edit-money-yes");
    const amountField = document.getElementById("edit-amount-field");
    const amountInput = document.getElementById("edit-collected-amount");

    noBtn.classList.toggle("active", !editMoneyCollected);
    yesBtn.classList.toggle("active", editMoneyCollected);
    amountField.classList.toggle("hidden", !editMoneyCollected);
    amountInput.disabled = !editMoneyCollected;
    amountInput.required = editMoneyCollected;
    if (!editMoneyCollected) amountInput.value = "";
  }

  function closeEditModal() {
    document.getElementById("delivery-edit-modal")?.classList.add("hidden");
    editPayload = null;
    showEditMessage("");
  }

  function showEditMessage(message, isError = false) {
    const element = document.getElementById("delivery-edit-message");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("hidden", !message);
    element.classList.toggle("error", Boolean(message && isError));
  }

  async function saveEditDelivery(event) {
    event.preventDefault();
    if (!editPayload || !canManageDeliveries) return;

    const amountInput = document.getElementById("edit-collected-amount");
    const quantityInputs = Array.from(document.querySelectorAll(".edit-qty"));
    if (quantityInputs.some((input) => !input.checkValidity())) {
      showEditMessage("راجع كميات التسليم والمرتجع الأول.", true);
      return;
    }
    if (editMoneyCollected && !amountInput.checkValidity()) {
      showEditMessage("اكتب مبلغ صحيح.", true);
      return;
    }

    const deliveryId = Number(document.getElementById("edit-delivery-id").value);
    const driverUserId = Number(document.getElementById("edit-driver").value);
    const distributorValue = document.getElementById("edit-distributor").value;
    const carValue = document.getElementById("edit-car").value;
    const saveBtn = document.getElementById("delivery-edit-save");
    saveBtn.disabled = true;
    showEditMessage("");

    try {
      const data = await Api.post(`/deliveries/${deliveryId}/edit`, {
        driver_user_id: driverUserId,
        distributor_user_id: distributorValue ? Number(distributorValue) : null,
        car_id: carValue ? Number(carValue) : null,
        note: document.getElementById("edit-note").value.trim(),
        money_collected: editMoneyCollected,
        collected_amount: editMoneyCollected ? Number(amountInput.value) : 0,
        items: editPayload.items.map((item) => ({
          product_id: item.product_id,
          qty_delivered: Number(item.qty_delivered || 0),
          qty_returned: Number(item.qty_returned || 0),
        })),
      });

      closeEditModal();
      Api.invalidate("/deliveries", "/delivery/deliveries", "/delivery/sap-order");
      await loadDeliveries();
      alert("تم تعديل التوصيل.");
    } catch (err) {
      showEditMessage("مقدرناش نعدّل التوصيل. راجع البيانات وحاول تاني.", true);
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function deleteDelivery(deliveryId) {
    if (!canManageDeliveries) return;
    const delivery = allDeliveries.find((entry) => Number(entry.delivery_id) === Number(deliveryId));
    const orderLabel = delivery ? `طلب SAP رقم ${delivery.sap_order_id}` : `التوصيل رقم ${deliveryId}`;
    if (
      !confirm(
        `تحذف ${orderLabel}؟\n\nالكميات المسجلة في التوصيل ده هترجع متاحة تاني. الحذف مينفعش يتراجع.`
      )
    ) {
      return;
    }

    try {
      const data = await Api.del(`/deliveries/${deliveryId}`);
      Api.invalidate("/deliveries", "/delivery/deliveries", "/delivery/sap-order");
      await loadDeliveries();
      alert("تم حذف التوصيل.");
    } catch (err) {
      alert("مقدرناش نحذف التوصيل.");
    }
  }
})();
