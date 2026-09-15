(function () {
  const { Api, Auth, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  const STATUSES = [
    "delivered",
    "partial delivered",
    "partial refund",
    "refund",
    "delay",
  ];

  let myCar = null;
  let loadedOrder = null; // { sap_order, items, summary, previous_deliveries }
  let draftItems = []; // [{ product_id, product_name, bar_code, qty_ordered, qty_delivered, qty_returned }]
  let chosenStatus = "";

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isDriver = localStorage.getItem("driver") === "1";
    const isAdmin = localStorage.getItem("is_admin") === "1";

    if (!isDriver && !isAdmin) {
      alert("You do not have permission to access this page.");
      window.location.href = "dashboard.html";
      return;
    }

    wireOrderSearch();
    wireOutcome();

    await loadMyCar();
  });

  async function loadMyCar() {
    const body = document.getElementById("myCarBody");

    try {
      const data = await Api.get("/driver/me/car", { retries: 0 });

      myCar = data.car;

      const bits = [myCar.brand, myCar.model]
        .filter(Boolean)
        .join(" ");

      const extra = myCar.year
        ? String(myCar.year)
        : "";

      body.innerHTML = `
        <div class="car-plate">${esc(myCar.plate)}</div>

        <div class="car-meta">
          ${bits ? `<span>${esc(bits)}</span>` : ""}
          ${extra ? `<span>${esc(extra)}</span>` : ""}

          <span class="region-pill region-pill--${esc(
            (myCar.region || "cairo").toLowerCase()
          )}">
            ${esc((myCar.region || "cairo").toUpperCase())}
          </span>
        </div>

        ${
          myCar.notes
            ? `<p class="car-notes">${esc(myCar.notes)}</p>`
            : ""
        }
      `;
    } catch (err) {
      myCar = null;

      const msg =
        err.status === 404
          ? "No car is assigned to you. You can still record a delivery; ask your manager to assign one."
          : err.data?.message ||
            err.message ||
            "Could not load your car.";

      body.innerHTML = `
        <p class="car-none">${esc(msg)}</p>
      `;
    }
  }

  function wireOrderSearch() {
    const input =
      document.getElementById("orderIdInput");

    document
      .getElementById("searchOrderBtn")
      .addEventListener("click", loadOrder);

    document
      .getElementById("clearOrderBtn")
      .addEventListener("click", clearOrder);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadOrder();
      }
    });
  }

  async function loadOrder() {
    const raw =
      document.getElementById("orderIdInput")
        .value
        .trim();

    const orderId = parseInt(raw, 10);

    if (!raw || !Number.isFinite(orderId)) {
      showOrderMessage(
        "Enter a valid order number.",
        true
      );
      return;
    }

    showOrderLoader(true);
    showOrderMessage("");

    resetPayment();

    chosenStatus = "";

    document
      .querySelectorAll(".choice-btn")
      .forEach((b) =>
        b.classList.remove("active")
      );

    try {
      const payload = await Api.get(
        `/driver/sap-order/${orderId}`,
        { retries: 0 }
      );

      loadedOrder = payload;

      draftItems = (payload.items || []).map(
        (item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          bar_code: item.bar_code,
          qty_ordered: Number(
            item.quantity || 0
          ),
          qty_delivered: 0,
          qty_returned: 0,
        })
      );

      renderOrder();

      document
        .getElementById("clearOrderBtn")
        .classList.remove("hidden");

      showOrderMessage(
        `Order ${orderId} loaded.`,
        false
      );
    } catch (err) {
      loadedOrder = null;
      draftItems = [];

      document
        .getElementById("orderSection")
        .classList.add("hidden");

      document
        .getElementById("outcomeSection")
        .classList.add("hidden");

      const msg =
        err.status === 404
          ? `Order ${orderId} was not found.`
          : err.data?.message ||
            err.message ||
            "Could not load the order.";

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
    chosenStatus = "";

    document.getElementById(
      "orderIdInput"
    ).value = "";

    document
      .getElementById("orderSection")
      .classList.add("hidden");

    document
      .getElementById("outcomeSection")
      .classList.add("hidden");

    document
      .getElementById("clearOrderBtn")
      .classList.add("hidden");

    document
      .querySelectorAll(".choice-btn")
      .forEach((b) =>
        b.classList.remove("active")
      );

    showOrderMessage("");
    updateSubmitState();
  }

  function renderOrder() {
    const order =
      loadedOrder.sap_order || {};

    const summary =
      loadedOrder.summary || {};

    document.getElementById(
      "sumOrderId"
    ).textContent =
      order.sap_order_id ?? "-";

    const statusEl =
      document.getElementById("sumStatus");

    statusEl.textContent =
      order.status || "-";

    statusEl.className =
      "status-badge status-" +
      String(
        order.status || "unknown"
      ).toLowerCase();

    document.getElementById(
      "sumPreparedBy"
    ).textContent =
      order.prepared_by || "-";

    document.getElementById(
      "sumReviewedBy"
    ).textContent =
      order.reviewed_by || "-";

    document.getElementById(
      "sumReviewedAt"
    ).textContent =
      order.reviewed_at || "-";

    document.getElementById(
      "sumItems"
    ).textContent =
      `${summary.items_count ?? 0} lines · ` +
      `${summary.total_quantity ?? 0} units`;

    const warnBox =
      document.getElementById(
        "reviewWarning"
      );

    if (loadedOrder.is_reviewed) {
      warnBox.classList.add("hidden");
    } else {
      document.getElementById(
        "reviewWarningText"
      ).textContent =
        loadedOrder.warning ||
        "This order has not been reviewed by storage yet. Check before handing it over.";

      warnBox.classList.remove("hidden");
    }

    renderPreviousDeliveries();
    renderItems();

    document
      .getElementById("orderSection")
      .classList.remove("hidden");

    document
      .getElementById("outcomeSection")
      .classList.remove("hidden");
  }

  function renderPreviousDeliveries() {
    const box =
      document.getElementById(
        "previousDeliveries"
      );

    const prev =
      loadedOrder.previous_deliveries ||
      [];

    if (!prev.length) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML =
      `<strong>Already delivered ${prev.length} time${
        prev.length > 1 ? "s" : ""
      }:</strong> ` +
      prev
        .map(
          (p) =>
            `${esc(p.status)} by ` +
            `${esc(p.driver || "?")} on ` +
            `${esc(p.delivered_at || "?")}`
        )
        .join(" · ");

    box.classList.remove("hidden");
  }

  function renderItems() {
    const tbody =
      document.getElementById(
        "itemsTableBody"
      );

    const frag =
      document.createDocumentFragment();

    draftItems.forEach(
      (item, index) => {
        const tr =
          document.createElement("tr");

        tr.dataset.index =
          String(index);

        tr.innerHTML = `
          <td data-label="#">
            ${index + 1}
          </td>

          <td data-label="Item">
            ${esc(
              item.product_name || "-"
            )}
          </td>

          <td data-label="Barcode">
            ${esc(item.bar_code || "-")}
          </td>

          <td data-label="Ordered">
            <span class="table-value">
              ${item.qty_ordered}
            </span>
          </td>

          <td data-label="Delivered">
            <input
              type="number"
              class="mini-input qty-input"
              data-field="qty_delivered"
              min="0"
              max="${item.qty_ordered}"
              step="1"
              value="${item.qty_delivered}"
            />
          </td>

          <td data-label="Returned">
            <input
              type="number"
              class="mini-input qty-input"
              data-field="qty_returned"
              min="0"
              max="${item.qty_ordered}"
              step="1"
              value="${item.qty_returned}"
            />
          </td>
        `;

        frag.appendChild(tr);
      }
    );

    tbody.replaceChildren(frag);
  }

  document.addEventListener(
    "input",
    (e) => {
      const input =
        e.target.closest(".qty-input");

      if (!input) return;

      const row =
        input.closest("tr");

      const index =
        Number(row?.dataset.index);

      const item =
        draftItems[index];

      if (!item) return;

      const field =
        input.dataset.field;

      let value =
        parseInt(input.value, 10);

      if (
        !Number.isFinite(value) ||
        value < 0
      ) {
        value = 0;
      }

      const other =
        field === "qty_delivered"
          ? item.qty_returned
          : item.qty_delivered;

      const max =
        Math.max(
          0,
          item.qty_ordered - other
        );

      if (value > max) {
        value = max;
      }

      item[field] = value;

      input.value =
        String(value);

      row.classList.toggle(
        "row-touched",
        item.qty_delivered > 0 ||
          item.qty_returned > 0
      );
    }
  );

  function wireOutcome() {
    document
      .getElementById("statusChoice")
      .addEventListener(
        "click",
        (e) => {
          const btn =
            e.target.closest(
              ".choice-btn"
            );

          if (!btn) return;

          chosenStatus =
            btn.dataset.status;

          document
            .querySelectorAll(
              ".choice-btn"
            )
            .forEach((b) => {
              b.classList.toggle(
                "active",
                b === btn
              );
            });

          applyStatusDefaults(
            chosenStatus
          );

          updateSubmitState();
        }
      );

    document
      .getElementById(
        "submitDeliveryBtn"
      )
      .addEventListener(
        "click",
        submitDelivery
      );

    document
      .getElementById(
        "moneyCollectedInput"
      )
      ?.addEventListener(
        "change",
        (e) => {
          const amountInput =
            document.getElementById(
              "collectedAmountInput"
            );

          const amountField =
            document.getElementById(
              "collectedAmountField"
            );

          amountInput.disabled =
            !e.target.checked;

          amountInput.required =
            e.target.checked;

          amountField.classList.toggle(
            "hidden",
            !e.target.checked
          );

          if (!e.target.checked) {
            amountInput.value = "";
          }

          updateSubmitState();
        }
      );
  }

  function resetPayment() {
    const moneyCollectedInput =
      document.getElementById(
        "moneyCollectedInput"
      );

    const collectedAmountInput =
      document.getElementById(
        "collectedAmountInput"
      );

    const collectedAmountField =
      document.getElementById(
        "collectedAmountField"
      );

    moneyCollectedInput.checked =
      false;

    collectedAmountInput.value =
      "";

    collectedAmountInput.disabled =
      true;

    collectedAmountInput.required =
      false;

    collectedAmountField.classList.add(
      "hidden"
    );
  }

  function applyStatusDefaults(
    status
  ) {
    draftItems.forEach((item) => {
      if (status === "delivered") {
        item.qty_delivered =
          item.qty_ordered;

        item.qty_returned = 0;
      } else if (
        status === "refund"
      ) {
        item.qty_delivered = 0;

        item.qty_returned =
          item.qty_ordered;
      } else {
        item.qty_delivered = 0;
        item.qty_returned = 0;
      }
    });

    renderItems();
  }

  function updateSubmitState() {
    const btn =
      document.getElementById(
        "submitDeliveryBtn"
      );

    if (!btn) return;

    const ready =
      !!loadedOrder &&
      STATUSES.includes(chosenStatus);

    btn.disabled = !ready;
  }

  async function submitDelivery() {
    const note =
      document.getElementById(
        "noteInput"
      ).value.trim();

    const moneyCollected =
      document.getElementById(
        "moneyCollectedInput"
      ).checked;

    const collectedAmount =
      document.getElementById(
        "collectedAmountInput"
      ).value;

    if (
      !loadedOrder ||
      !chosenStatus
    ) {
      showSubmitMessage(
        "Load an order and choose a delivery result first.",
        true
      );
      return;
    }

    if (
      moneyCollected &&
      (
        !collectedAmount ||
        !Number.isFinite(
          Number(collectedAmount)
        ) ||
        !document
          .getElementById(
            "collectedAmountInput"
          )
          .checkValidity()
      )
    ) {
      showSubmitMessage(
        "Enter a positive collected amount with at most two decimal places.",
        true
      );
      return;
    }

    const partial =
      chosenStatus ===
        "partial delivered" ||
      chosenStatus ===
        "partial refund";

    const touched =
      draftItems.some(
        (i) =>
          i.qty_delivered > 0 ||
          i.qty_returned > 0
      );

    if (
      partial &&
      !touched
    ) {
      showSubmitMessage(
        "A partial result needs at least one line with a delivered or returned quantity.",
        true
      );
      return;
    }

    const label =
      `${chosenStatus.toUpperCase()} — ` +
      `order ${loadedOrder.sap_order?.sap_order_id}`;

    if (
      !confirm(
        `Record this delivery?\n\n${label}\n\nThis cannot be edited afterwards.`
      )
    ) {
      return;
    }

    const btn =
      document.getElementById(
        "submitDeliveryBtn"
      );

    btn.disabled = true;

    showSubmitMessage("");

    try {
      const data =
        await Api.post(
          "/driver/deliveries",
          {
            sap_order_id:
              loadedOrder.sap_order
                .sap_order_id,

            status:
              chosenStatus,

            note,

            money_collected:
              moneyCollected,

            collected_amount:
              moneyCollected
                ? Number(
                    collectedAmount
                  )
                : 0,

            items:
              draftItems.map(
                (i) => ({
                  product_id:
                    i.product_id,

                  qty_delivered:
                    i.qty_delivered,

                  qty_returned:
                    i.qty_returned,
                })
              ),
          }
        );

      const warning =
        data.warning
          ? `\n\nNote: ${data.warning}`
          : "";

      alert(
        `${
          data.message ||
          "Delivery recorded."
        }${warning}`
      );

      Api.invalidate(
        "/deliveries",
        "/driver/deliveries"
      );

      clearOrder();

      document.getElementById(
        "noteInput"
      ).value = "";
    } catch (err) {
      showSubmitMessage(
        err.data?.message ||
          err.message ||
          "Could not record the delivery.",
        true
      );
    } finally {
      btn.disabled = false;
      updateSubmitState();
    }
  }

  function showOrderLoader(show) {
    document
      .getElementById(
        "orderLoader"
      )
      .classList.toggle(
        "hidden",
        !show
      );
  }

  function showOrderMessage(
    message,
    isError = false
  ) {
    setMessage(
      document.getElementById(
        "orderMessage"
      ),
      message,
      isError
    );
  }

  function showSubmitMessage(
    message,
    isError = false
  ) {
    setMessage(
      document.getElementById(
        "submitMessage"
      ),
      message,
      isError
    );
  }

  function setMessage(
    el,
    message,
    isError
  ) {
    if (!el) return;

    if (!message) {
      el.classList.add("hidden");
      el.textContent = "";
      el.style.color = "";
      return;
    }

    el.classList.remove("hidden");

    el.textContent =
      message;

    el.style.color =
      isError
        ? "#dc2626"
        : "#16a34a";
  }
})();