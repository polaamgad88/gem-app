(function () {
  const { Api, Auth, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  const STATUS_LABELS = {
    delivered: "تم التسليم",
    "partial delivered": "تم تسليم جزء",
    "partial refund": "تسليم جزئي مع مرتجع",
    refund: "مرتجع بالكامل",
    delay: "مؤجل",
    reviewed: "متراجع",
    prepared: "متجهز",
    pending: "قيد الانتظار",
  };

  function statusLabel(status) {
    const key = String(status || "").toLowerCase();
    return STATUS_LABELS[key] || status || "-";
  }

  function regionLabel(region) {
    const key = String(region || "cairo").toLowerCase();
    if (key === "cairo") return "القاهرة";
    if (key === "alex") return "اسكندرية";
    return region || "-";
  }

  let myCar = null;
  let loadedOrder = null;
  let draftItems = [];
  let moneyCollected = false;

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isDriver = localStorage.getItem("driver") === "1";
    const isDistributor = localStorage.getItem("distributor") === "1";
    const isAdmin = localStorage.getItem("is_admin") === "1";
    if (!isDriver && !isDistributor) {
      alert("مش مسموحلك تدخل الصفحة دي.");
      window.location.href = "dashboard.html";
      return;
    }

    wireOrderSearch();
    wireOutcome();
    resetPayment();
    await loadMyCar();
  });

  async function loadMyCar() {
    const body = document.getElementById("myCarBody");
    try {
      const data = await Api.get("/delivery/me/car", { retries: 0 });
      myCar = data.car;
      const bits = [myCar.brand, myCar.model].filter(Boolean).join(" ");
      const extra = myCar.year ? String(myCar.year) : "";
      body.innerHTML = `
        <div class="car-plate">${esc(myCar.plate)}</div>
        <div class="car-meta">
          ${bits ? `<span>${esc(bits)}</span>` : ""}
          ${extra ? `<span>${esc(extra)}</span>` : ""}
          <span>السواق: ${esc(myCar.assigned_user?.username || "—")}</span>
          <span>الموزع: ${esc(myCar.assigned_distributor?.username || "—")}</span>
          <span class="region-pill region-pill--${esc((myCar.region || "cairo").toLowerCase())}">
            ${esc(regionLabel(myCar.region))}
          </span>
        </div>
        ${myCar.notes ? `<p class="car-notes">${esc(myCar.notes)}</p>` : ""}
        ${!myCar.assigned_user || !myCar.assigned_distributor ? `<p class="car-none">لازم العربية يكون مربوط بيها سواق وموزع قبل تسجيل التوصيل.</p>` : ""}
      `;
    } catch (err) {
      myCar = null;
      const msg =
        err.status === 404
          ? "مفيش عربية مربوطة بيك. كلم مدير السواقين يربطك بعربية فيها سواق وموزع."
          : "مقدرناش نحمل بيانات العربية.";
      body.innerHTML = `<p class="car-none">${esc(msg)}</p>`;
    }
  }

  function wireOrderSearch() {
    const input = document.getElementById("orderIdInput");
    document.getElementById("searchOrderBtn").addEventListener("click", loadOrder);
    document.getElementById("clearOrderBtn").addEventListener("click", clearOrder);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        loadOrder();
      }
    });
  }

  async function loadOrder() {
    const raw = document.getElementById("orderIdInput").value.trim();
    const orderId = parseInt(raw, 10);
    if (!raw || !Number.isFinite(orderId)) {
      showOrderMessage("اكتب رقم طلب صحيح.", true);
      return;
    }

    showOrderLoader(true);
    showOrderMessage("");
    showSubmitMessage("");
    resetPayment();

    try {
      const payload = await Api.get(`/delivery/sap-order/${orderId}`, { retries: 0 });
      loadedOrder = payload;
      draftItems = (payload.items || []).map((item) => ({
        product_id: item.product_id,
        product_name: item.product_name,
        bar_code: item.bar_code,
        qty_ordered: Number(item.quantity || 0),
        qty_already_delivered: Number(item.qty_already_delivered || 0),
        qty_already_returned: Number(item.qty_already_returned || 0),
        qty_available: Number(
          item.qty_available ?? item.qty_remaining_for_delivery ?? item.quantity ?? 0
        ),
        qty_delivered: 0,
        qty_returned: 0,
      }));

      renderOrder();
      document.getElementById("clearOrderBtn").classList.remove("hidden");
      showOrderMessage(`تم تحميل الطلب ${orderId}.`, false);
    } catch (err) {
      loadedOrder = null;
      draftItems = [];
      document.getElementById("orderSection").classList.add("hidden");
      document.getElementById("outcomeSection").classList.add("hidden");
      const msg =
        err.status === 404
          ? `الطلب ${orderId} مش موجود.`
          : "مقدرناش نحمل الطلب.";
      showOrderMessage(msg, true);
    } finally {
      showOrderLoader(false);
      updateSubmitState();
    }
  }

  function clearOrder() {
    resetPayment();
    loadedOrder = null;
    draftItems = [];
    document.getElementById("orderIdInput").value = "";
    document.getElementById("orderSection").classList.add("hidden");
    document.getElementById("outcomeSection").classList.add("hidden");
    document.getElementById("clearOrderBtn").classList.add("hidden");
    document.getElementById("noteInput").value = "";
    showOrderMessage("");
    showSubmitMessage("");
    updatePreview();
    updateSubmitState();
  }

  function renderOrder() {
    const order = loadedOrder.sap_order || {};
    const summary = loadedOrder.summary || {};

    document.getElementById("sumOrderId").textContent = order.sap_order_id ?? "-";
    const statusEl = document.getElementById("sumStatus");
    statusEl.textContent = statusLabel(order.status);
    statusEl.className =
      "status-badge status-" + String(order.status || "unknown").toLowerCase();

    document.getElementById("sumPreparedBy").textContent = order.prepared_by || "-";
    document.getElementById("sumReviewedBy").textContent = order.reviewed_by || "-";
    document.getElementById("sumReviewedAt").textContent = order.reviewed_at || "-";
    document.getElementById("sumItems").textContent =
      `${summary.items_count ?? 0} أصناف · ${summary.total_quantity ?? 0} مطلوب · ` +
      `${summary.total_open ?? totalCurrentOpen()} متبقي`;

    const warnBox = document.getElementById("reviewWarning");
    if (loadedOrder.is_reviewed) {
      warnBox.classList.add("hidden");
    } else {
      document.getElementById("reviewWarningText").textContent =
        "الطلب لسه متراجعش من المخزن. راجعه قبل التسليم.";
      warnBox.classList.remove("hidden");
    }

    renderPreviousDeliveries();
    renderItems();
    updatePreview();
    document.getElementById("orderSection").classList.remove("hidden");
    document.getElementById("outcomeSection").classList.remove("hidden");
  }

  function renderPreviousDeliveries() {
    const box = document.getElementById("previousDeliveries");
    const previous = loadedOrder.previous_deliveries || [];
    if (!previous.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML =
      `<strong>محاولات توصيل سابقة (${previous.length}):</strong> ` +
      previous
        .map(
          (entry) =>
            `${esc(statusLabel(entry.status))} - السواق: ${esc(entry.driver || "?")} - الموزع: ${esc(entry.distributor || "—")} - سجله: ${esc(entry.recorded_by || "—")} - ${esc(entry.delivered_at || "?")}`
        )
        .join(" · ");
    box.classList.remove("hidden");
  }

  function renderItems() {
    const tbody = document.getElementById("itemsTableBody");
    const frag = document.createDocumentFragment();

    draftItems.forEach((item, index) => {
      const closed = item.qty_available <= 0;
      const tr = document.createElement("tr");
      tr.dataset.index = String(index);
      tr.classList.toggle("row-closed", closed);
      tr.innerHTML = `
        <td data-label="#">${index + 1}</td>
        <td data-label="الصنف">${esc(item.product_name || "-")}</td>
        <td data-label="الباركود">${esc(item.bar_code || "-")}</td>
        <td data-label="الكمية المطلوبة"><span class="table-value">${item.qty_ordered}</span></td>
        <td data-label="اتسلم قبل كده"><span class="handled-value">${item.qty_already_delivered}</span></td>
        <td data-label="اترجع قبل كده"><span class="handled-value">${item.qty_already_returned}</span></td>
        <td data-label="المتاح">
          <span class="available-pill ${closed ? "available-pill--closed" : ""}">
            ${item.qty_available}
          </span>
        </td>
        <td data-label="تسليم دلوقتي">
          <div class="qty-cell">
          <input
            type="number"
            class="mini-input qty-input"
            data-field="qty_delivered"
            min="0"
            max="${item.qty_available}"
            step="1"
            value="${item.qty_delivered}"
            ${closed ? "disabled" : ""}
          />
          <button type="button" class="quick-fill-btn item-quick-fill" data-fill="delivered" ${closed ? "disabled" : ""}>تسليم الصنف</button>
          </div>
        </td>
        <td data-label="مرتجع دلوقتي">
          <div class="qty-cell">
          <input
            type="number"
            class="mini-input qty-input"
            data-field="qty_returned"
            min="0"
            max="${item.qty_available}"
            step="1"
            value="${item.qty_returned}"
            ${closed ? "disabled" : ""}
          />
          <button type="button" class="quick-fill-btn quick-fill-btn--return item-quick-fill" data-fill="returned" ${closed ? "disabled" : ""}>إرجاع الصنف</button>
          </div>
        </td>
      `;
      frag.appendChild(tr);
    });

    tbody.replaceChildren(frag);
  }

  function applyQuickFill(mode, onlyIndex = null) {
    if (!loadedOrder) return;
    const indices = onlyIndex === null ? draftItems.map((_, index) => index) : [onlyIndex];
    const tbody = document.getElementById("itemsTableBody");
    indices.forEach((index) => {
      const item = draftItems[index];
      if (!item || item.qty_available <= 0) return;
      item.qty_delivered = mode === "delivered" ? item.qty_available : 0;
      item.qty_returned = mode === "returned" ? item.qty_available : 0;

      const row = tbody.querySelector(`tr[data-index="${index}"]`);
      if (!row) return;
      row.querySelectorAll(".qty-input").forEach((input) => {
        input.value = String(item[input.dataset.field]);
        input.setCustomValidity("");
      });
      row.classList.remove("row-invalid");
      row.classList.add("row-touched");
    });
    updatePreview();
    updateSubmitState();
  }

  document.addEventListener("input", (event) => {
    const input = event.target.closest(".qty-input");
    if (!input) return;

    const row = input.closest("tr");
    const index = Number(row?.dataset.index);
    const item = draftItems[index];
    if (!item) return;

    const field = input.dataset.field;
    const raw = input.value.trim();
    const value = raw === "" ? 0 : Number(raw);
    const otherField = field === "qty_delivered" ? "qty_returned" : "qty_delivered";
    const max = item.qty_available;

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
      if (item[field] + item[otherField] > max) {
        item[otherField] = max - value;
        const pairedInput = row.querySelector(`[data-field="${otherField}"]`);
        pairedInput.value = String(item[otherField]);
        pairedInput.setCustomValidity("");
      }
      row.classList.toggle(
        "row-touched",
        item.qty_delivered > 0 || item.qty_returned > 0
      );
      updatePreview();
    }
    updateSubmitState();
  });

  function derivePreviewStatus() {
    const delivered = draftItems.reduce((total, item) => total + item.qty_delivered, 0);
    const returned = draftItems.reduce((total, item) => total + item.qty_returned, 0);
    const openAfter = totalOpenAfter();

    if (!delivered && !returned) return "delay";
    if (returned && delivered) return "partial refund";
    if (returned) return openAfter === 0 ? "refund" : "partial refund";
    return openAfter === 0 ? "delivered" : "partial delivered";
  }

  function totalCurrentOpen() {
    return draftItems.reduce((total, item) => total + item.qty_available, 0);
  }

  function totalOpenAfter() {
    return draftItems.reduce(
      (total, item) =>
        total + Math.max(0, item.qty_available - item.qty_delivered - item.qty_returned),
      0
    );
  }

  function updatePreview() {
    const statusEl = document.getElementById("calculatedStatus");
    const remainingEl = document.getElementById("remainingAfterText");
    if (!statusEl || !remainingEl) return;

    if (!loadedOrder) {
      statusEl.textContent = "مؤجل";
      remainingEl.textContent = "";
      return;
    }

    const status = derivePreviewStatus();
    const remaining = totalOpenAfter();
    statusEl.textContent = statusLabel(status);
    statusEl.className = `preview-status preview-status--${status.replace(/\s+/g, "-")}`;
    remainingEl.textContent =
      remaining > 0
        ? `هيفضل ${remaining} وحدة متاحة لتوصيلة تانية.`
        : "مفيش كمية هتفضل متاحة بعد التوصيل ده.";
  }

  function wireOutcome() {
    document.getElementById("submitDeliveryBtn").addEventListener("click", submitDelivery);
    document.getElementById("fillAllDeliveredBtn").addEventListener("click", () => applyQuickFill("delivered"));
    document.getElementById("fillAllReturnedBtn").addEventListener("click", () => applyQuickFill("returned"));
    document.getElementById("itemsTableBody").addEventListener("click", (event) => {
      const button = event.target.closest("[data-fill]");
      if (!button) return;
      const index = Number(button.closest("tr")?.dataset.index);
      if (Number.isInteger(index)) applyQuickFill(button.dataset.fill, index);
    });
    document.getElementById("moneyCollectedNo").addEventListener("click", () => {
      setPayment(false);
    });
    document.getElementById("moneyCollectedYes").addEventListener("click", () => {
      setPayment(true);
    });
    document.getElementById("collectedAmountInput").addEventListener("input", updateSubmitState);
  }

  function setPayment(value) {
    moneyCollected = Boolean(value);
    const noBtn = document.getElementById("moneyCollectedNo");
    const yesBtn = document.getElementById("moneyCollectedYes");
    const amountField = document.getElementById("collectedAmountField");
    const amountInput = document.getElementById("collectedAmountInput");

    noBtn.classList.toggle("active", !moneyCollected);
    yesBtn.classList.toggle("active", moneyCollected);
    noBtn.setAttribute("aria-pressed", moneyCollected ? "false" : "true");
    yesBtn.setAttribute("aria-pressed", moneyCollected ? "true" : "false");

    amountField.classList.toggle("hidden", !moneyCollected);
    amountInput.disabled = !moneyCollected;
    amountInput.required = moneyCollected;
    if (!moneyCollected) amountInput.value = "";
    if (moneyCollected) amountInput.focus();
    updateSubmitState();
  }

  function resetPayment() {
    moneyCollected = false;
    const amountInput = document.getElementById("collectedAmountInput");
    if (amountInput) amountInput.value = "";
    if (document.getElementById("moneyCollectedNo")) setPayment(false);
  }

  function paymentValid() {
    if (!moneyCollected) return true;
    const amountInput = document.getElementById("collectedAmountInput");
    const amount = Number(amountInput.value);
    return amountInput.checkValidity() && Number.isFinite(amount) && amount > 0;
  }

  function quantitiesValid() {
    return Array.from(document.querySelectorAll(".qty-input")).every((input) =>
      input.checkValidity()
    );
  }

  function updateSubmitState() {
    const btn = document.getElementById("submitDeliveryBtn");
    if (!btn) return;
    const hasOpenQuantity = Boolean(loadedOrder) && totalCurrentOpen() > 0;
    document.getElementById("fillAllDeliveredBtn").disabled = !hasOpenQuantity;
    document.getElementById("fillAllReturnedBtn").disabled = !hasOpenQuantity;
    btn.disabled = !hasOpenQuantity || !myCar?.assigned_user || !myCar?.assigned_distributor || !quantitiesValid() || !paymentValid();
  }

  async function submitDelivery() {
    const note = document.getElementById("noteInput").value.trim();
    const amountInput = document.getElementById("collectedAmountInput");
    const collectedAmount = amountInput.value;

    if (!loadedOrder) {
      showSubmitMessage("حمّل الطلب الأول.", true);
      return;
    }
    if (totalCurrentOpen() <= 0) {
      showSubmitMessage("الطلب ده اتقفل بالكامل ومفيش كمية متبقية.", true);
      return;
    }
    if (!quantitiesValid()) {
      showSubmitMessage("راجع كميات التسليم والمرتجع الأول.", true);
      return;
    }
    if (!paymentValid()) {
      showSubmitMessage(
        "اكتب مبلغ صحيح أكبر من صفر وبحد أقصى رقمين بعد العلامة.",
        true
      );
      return;
    }

    const preview = derivePreviewStatus();
    const remaining = totalOpenAfter();
    const orderId = loadedOrder.sap_order?.sap_order_id;
    const message =
      `تسجل الطلب ${orderId} بالحالة: ${statusLabel(preview)}؟\n\n` +
      (remaining > 0
        ? `هيفضل ${remaining} وحدة متاحة لتوصيلة تانية.`
        : "مفيش كمية هتفضل متاحة.");
    if (!confirm(message)) return;

    const btn = document.getElementById("submitDeliveryBtn");
    btn.disabled = true;
    showSubmitMessage("");

    try {
      const data = await Api.post("/delivery/deliveries", {
        sap_order_id: orderId,
        note,
        money_collected: moneyCollected,
        collected_amount: moneyCollected ? Number(collectedAmount) : 0,
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          qty_delivered: item.qty_delivered,
          qty_returned: item.qty_returned,
        })),
      });

      const warnings = (data.warnings || [])
        .map((warning) => {
          if (warning.includes("No car is assigned")) {
            return "مفيش عربية مربوطة بالسواق؛ التوصيل اتسجل من غير عربية.";
          }
          if (warning.includes("not reviewed")) {
            return "الطلب مكنش متراجع وقت التوصيل.";
          }
          return "";
        })
        .filter(Boolean);
      const warning = warnings.length ? `\n\nملاحظة: ${warnings.join(" ")}` : "";
      alert(`تم تسجيل التوصيل بالحالة: ${statusLabel(data.status || preview)}${warning}`);
      Api.invalidate("/deliveries", "/delivery/deliveries", "/delivery/sap-order");
      clearOrder();
    } catch (err) {
      showSubmitMessage(
        "مقدرناش نسجل التوصيل. راجع البيانات وحاول تاني.",
        true
      );
    } finally {
      updateSubmitState();
    }
  }

  function showOrderLoader(show) {
    document.getElementById("orderLoader").classList.toggle("hidden", !show);
  }

  function showOrderMessage(message, isError = false) {
    setMessage(document.getElementById("orderMessage"), message, isError);
  }

  function showSubmitMessage(message, isError = false) {
    setMessage(document.getElementById("submitMessage"), message, isError);
  }

  function setMessage(element, message, isError) {
    if (!element) return;
    if (!message) {
      element.classList.add("hidden");
      element.textContent = "";
      element.style.color = "";
      return;
    }
    element.classList.remove("hidden");
    element.textContent = message;
    element.style.color = isError ? "#dc2626" : "#16a34a";
  }
})();
