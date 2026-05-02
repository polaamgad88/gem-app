document.addEventListener("DOMContentLoaded", () => {
  const API_BASE =
    window.location.origin && window.location.origin.startsWith("http")
      ? `${window.location.origin}/api`
      : "https://order-app.gemegypt.net/api";

  const orderIdInput = document.getElementById("orderIdInput");
  const searchOrderBtn = document.getElementById("searchOrderBtn");
  const cancelSearchBtn = document.getElementById("cancelSearchBtn");
  const orderSearchLoader = document.getElementById("orderSearchLoader");
  const orderSearchMessage = document.getElementById("orderSearchMessage");

  const loadedOrderSection = document.getElementById("loadedOrderSection");
  const loadedOrderId = document.getElementById("loadedOrderId");
  const loadedOrderStatus = document.getElementById("loadedOrderStatus");
  const loadedCustomerName = document.getElementById("loadedCustomerName");
  const loadedReviewedBy = document.getElementById("loadedReviewedBy"); // NEW
  const loadedReviewedAt = document.getElementById("loadedReviewedAt"); // NEW
  const orderedItemsTableBody = document.getElementById(
    "orderedItemsTableBody",
  );

  const submitScanBtn = document.getElementById("submitScanBtn");
  const finishOrderBtn = document.getElementById("finishOrderBtn");
  const startCheckingBtn = document.getElementById("startCheckingBtn");
  const reviewOrderBtn = document.getElementById("reviewOrderBtn"); // NEW

  const modeCameraBtn = document.getElementById("modeCameraBtn");
  const modeManualBtn = document.getElementById("modeManualBtn");
  const cameraModeSection = document.getElementById("cameraModeSection");
  const manualModeSection = document.getElementById("manualModeSection");
  const barcodeInput = document.getElementById("barcodeInput");
  const manualBarcodeInput = document.getElementById("manualBarcodeInput");
  const scanQtyInput = document.getElementById("scanQtyInput");

  let cameraStream = null;
  let loadedOrder = null;

  let barcodeDetector = null;
  let detectorInterval = null;
  let lastDetectedValue = "";
  let lastDetectedAt = 0;
  let cameraInfoShown = false;

  initScannerModeToggle();
  updateActionButtons();

  // ─── Search ───────────────────────────────────────────────────────────────

  searchOrderBtn.addEventListener("click", async () => {
    const sapOrderId = orderIdInput.value.trim();

    if (!sapOrderId) {
      resetLoadedOrderUI({ keepInputValue: true });
      showMessage("Please enter SAP order ID.", true);
      return;
    }

    if (!/^\d+$/.test(sapOrderId)) {
      resetLoadedOrderUI({ keepInputValue: true });
      showMessage("SAP order ID must be numeric.", true);
      return;
    }

    showLoader(true);
    showMessage("");

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found.");
      }

      let payload;
      try {
        payload = await fetchSapOrderDetails(sapOrderId, token);
      } catch (error) {
        const notFound =
          /not found/i.test(error.message || "") ||
          /404/.test(error.message || "");

        if (!notFound) {
          throw error;
        }

        await fetchSapOrderFromSap(sapOrderId, token);
        payload = await fetchSapOrderDetails(sapOrderId, token);
      }

      loadedOrder = normalizeLoadedOrderPayload(payload);

      orderIdInput.value = String(
        loadedOrder.sap_order.sap_order_id || sapOrderId,
      );
      orderIdInput.disabled = true;
      searchOrderBtn.disabled = true;

      if (cancelSearchBtn) {
        cancelSearchBtn.classList.remove("hidden");
      }

      populateOrderDetails(loadedOrder);
      loadedOrderSection.classList.remove("hidden");
      showMessage("SAP order loaded successfully.", false);

      initCameraIfNeeded();
      updateActionButtons();
    } catch (error) {
      console.error("Error loading SAP order:", error);
      resetLoadedOrderUI({ keepInputValue: true });
      showMessage(error.message || "Failed to load SAP order.", true);
    } finally {
      showLoader(false);
    }
  });

  if (cancelSearchBtn) {
    cancelSearchBtn.addEventListener("click", () => {
      resetLoadedOrderUI();
      showMessage("");
    });
  }

  orderIdInput.addEventListener("input", () => {
    if (loadedOrder) {
      resetLoadedOrderUI({ keepInputValue: true, preserveMessage: true });
    }
  });

  // ─── Table interactions ───────────────────────────────────────────────────

  orderedItemsTableBody.addEventListener("click", (event) => {
    const minusBtn = event.target.closest(".minus-btn");
    if (!minusBtn) return;
    if (!canEditDraft()) return;

    const row = minusBtn.closest("tr");
    if (!row) return;

    const index = Number(row.dataset.index);
    const item = loadedOrder?.items?.[index];
    if (!item) return;

    const nextChecked = Math.max(0, Number(item.draft_qty_checked || 0) - 1);
    const me = getCurrentUserInfo();
    updateDraftItemAtIndex(index, nextChecked, me.user_id, me.username);
    updateRowFromItem(row, loadedOrder.items[index]);

    highlightRow(row);
    showMessage(
      `Reduced ${item.product_name}. Final checked = ${loadedOrder.items[index].draft_qty_checked}.`,
      false,
    );
  });

  orderedItemsTableBody.addEventListener("input", (event) => {
    const target = event.target;
    if (!target.classList.contains("final-checked-input")) return;
    if (!canEditDraft()) return;
    handleFinalCheckedInput(target);
  });

  orderedItemsTableBody.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.classList.contains("final-checked-input")) return;
    if (!canEditDraft()) return;
    handleFinalCheckedInput(target, true);
  });

  // ─── Start Checking ───────────────────────────────────────────────────────

  if (startCheckingBtn) {
    startCheckingBtn.addEventListener("click", async () => {
      if (!loadedOrder?.sap_order?.sap_order_id) {
        showMessage("Please load a SAP order first.", true);
        return;
      }

      const sapOrderId = loadedOrder.sap_order.sap_order_id;
      const currentStatus = String(
        loadedOrder.sap_order.status || "",
      ).toLowerCase();

      try {
        startCheckingBtn.disabled = true;
        showMessage("");

        const token = await getAuthToken();
        if (!token) {
          throw new Error("Authentication token not found.");
        }

        let responsePayload = null;

        if (["checked", "opened", "reopened"].includes(currentStatus)) {
          showMessage("This order is already ready for checking.", false);
          updateActionButtons();
          setDraftInputsDisabled(false);
          return;
        }

        // "prepared" and "reviewed" both get reopened when the user wants to re-check
        if (["prepared", "reviewed"].includes(currentStatus)) {
          responsePayload = await reopenSapOrder(sapOrderId, token);
        } else {
          responsePayload = await startCheckingSapOrder(sapOrderId, token);
        }

        loadedOrder = normalizeLoadedOrderPayload(responsePayload);
        populateOrderDetails(loadedOrder);
        updateActionButtons();

        showMessage("Order is ready for checking.", false);
      } catch (error) {
        console.error("Start checking failed:", error);
        showMessage(error.message || "Failed to start checking.", true);
      } finally {
        updateActionButtons();
      }
    });
  }

  // ─── Scan / Check ─────────────────────────────────────────────────────────

  if (submitScanBtn) {
    submitScanBtn.addEventListener("click", () => {
      if (!loadedOrder?.sap_order?.sap_order_id) {
        showMessage("Please load a SAP order first.", true);
        return;
      }

      if (!canEditDraft()) {
        showMessage("Start or reopen checking first.", true);
        return;
      }

      const isCameraMode = modeCameraBtn.classList.contains("active");
      const scannedValue = barcodeInput ? barcodeInput.value.trim() : "";
      const manualValue = manualBarcodeInput
        ? manualBarcodeInput.value.trim()
        : "";
      const barcode = isCameraMode ? scannedValue : manualValue;
      const incrementBy = Math.max(
        1,
        parseInt(scanQtyInput?.value || "1", 10) || 1,
      );

      if (!barcode) {
        showMessage("Please scan or enter a barcode first.", true);
        return;
      }

      const matched = findMatchingItemRow(barcode);

      if (!matched) {
        showMessage("This barcode does not match any item in the order.", true);
        return;
      }

      const nextChecked =
        Number(matched.item.draft_qty_checked || 0) + incrementBy;

      const me = getCurrentUserInfo();
      updateDraftItemAtIndex(
        matched.index,
        nextChecked,
        me.user_id,
        me.username,
      );
      updateRowFromItem(matched.row, loadedOrder.items[matched.index]);

      if (barcodeInput) barcodeInput.value = "";
      if (manualBarcodeInput) manualBarcodeInput.value = "";

      if (
        manualModeSection &&
        !manualModeSection.classList.contains("hidden") &&
        manualBarcodeInput
      ) {
        manualBarcodeInput.focus();
      }

      highlightRow(matched.row);
      showMessage(
        `Updated ${matched.item.product_name} by ${incrementBy}. Final checked = ${loadedOrder.items[matched.index].draft_qty_checked}.`,
        false,
      );
    });
  }

  // ─── Finish (Prepare) ─────────────────────────────────────────────────────

  if (finishOrderBtn) {
    finishOrderBtn.addEventListener("click", async () => {
      if (!loadedOrder?.sap_order?.sap_order_id) {
        showMessage("Please load a SAP order first.", true);
        return;
      }

      if (!canEditDraft()) {
        showMessage("Start or reopen checking first.", true);
        return;
      }

      try {
        finishOrderBtn.disabled = true;
        showMessage("");

        const token = await getAuthToken();
        if (!token) {
          throw new Error("Authentication token not found.");
        }

        const sapOrderId = loadedOrder.sap_order.sap_order_id;
        const finalItemsPayload = loadedOrder.items.map((item) => ({
          sap_order_detail_id: item.sap_order_detail_id,
          qty_checked: Number(item.draft_qty_checked || 0),
          checked_by_user_id: item.checked_by_user_id || null,
        }));

        const result = await prepareSapOrder(
          sapOrderId,
          finalItemsPayload,
          token,
        );

        loadedOrder = normalizeLoadedOrderPayload(result);
        populateOrderDetails(loadedOrder);
        updateActionButtons();

        // Compute missing items from the actual returned data
        const missingCount = (loadedOrder.items || []).filter(
          (item) => Number(item.qty_remaining || 0) > 0,
        ).length;

        if (missingCount > 0) {
          showMessage(
            `Order marked as prepared. ${missingCount} item(s) are missing. A reviewer must confirm the order.`,
            false,
          );
        } else {
          showMessage(
            "Order marked as prepared. All items were fully checked. A reviewer must confirm the order.",
            false,
          );
        }

        console.log("Prepare response:", result);
      } catch (error) {
        console.error("Finish failed:", error);
        showMessage(error.message || "Failed to finish SAP order.", true);
      } finally {
        finishOrderBtn.disabled = false;
      }
    });
  }

  // ─── Review (NEW) ─────────────────────────────────────────────────────────

  if (reviewOrderBtn) {
    let reviewPendingConfirm = false;

    reviewOrderBtn.addEventListener("click", async () => {
      // ── Permission check (client-side guard) ──────────────────────────────
      const me = getCurrentUserInfo();
      if (!me.is_admin && !me.is_storage_admin) {
        showMessage(
          "You don't have permission to review orders. Only Storage Admins and system Admins can confirm a review.",
          true,
        );
        reviewPendingConfirm = false;
        updateActionButtons();
        return;
      }

      if (!loadedOrder?.sap_order?.sap_order_id) {
        showMessage("Please load a SAP order first.", true);
        reviewPendingConfirm = false;
        updateActionButtons();
        return;
      }

      const status = String(loadedOrder.sap_order.status || "").toLowerCase();

      if (status === "reviewed") {
        showMessage("This order has already been reviewed.", false);
        reviewPendingConfirm = false;
        updateActionButtons();
        return;
      }

      if (status !== "prepared") {
        showMessage(
          `Order cannot be reviewed — current status is "${status}". Finish the order first.`,
          true,
        );
        reviewPendingConfirm = false;
        updateActionButtons();
        return;
      }

      // ── Two-click confirmation (replaces browser confirm()) ───────────────
      if (!reviewPendingConfirm) {
        reviewPendingConfirm = true;
        reviewOrderBtn.textContent = "Tap again to confirm review";
        showMessage(
          "A confirmation email will be sent to the team. Click 'Tap again to confirm review' to proceed.",
          false,
        );
        // Auto-cancel after 5 s if user doesn't click again
        setTimeout(() => {
          if (reviewPendingConfirm) {
            reviewPendingConfirm = false;
            showMessage("");
            updateActionButtons();
          }
        }, 5000);
        return;
      }

      // Second click — proceed
      reviewPendingConfirm = false;

      try {
        reviewOrderBtn.disabled = true;
        showMessage("");

        const token = await getAuthToken();
        if (!token) throw new Error("Authentication token not found.");

        const sapOrderId = loadedOrder.sap_order.sap_order_id;
        const result = await reviewSapOrder(sapOrderId, token);

        loadedOrder = normalizeLoadedOrderPayload(result);
        populateOrderDetails(loadedOrder);
        updateActionButtons();

        showMessage(
          "Order reviewed and confirmed. Confirmation email sent.",
          false,
        );
        console.log("Review response:", result);
      } catch (error) {
        console.error("Review failed:", error);

        // Translate backend error messages into plain language
        const raw = error.message || "";
        let friendlyMsg;
        if (
          /storage admin/i.test(raw) ||
          /401/.test(raw) ||
          /permission/i.test(raw)
        ) {
          friendlyMsg =
            "Permission denied — only Storage Admins can confirm a review.";
        } else if (/not found/i.test(raw) || /404/.test(raw)) {
          friendlyMsg = "SAP order not found.";
        } else if (/prepared/i.test(raw)) {
          friendlyMsg =
            "The order must be in 'prepared' status before it can be reviewed.";
        } else if (/token/i.test(raw)) {
          friendlyMsg = "Your session has expired. Please log in again.";
        } else {
          friendlyMsg = raw || "Something went wrong. Please try again.";
        }

        showMessage(friendlyMsg, true);
      } finally {
        reviewOrderBtn.disabled = false;
        updateActionButtons();
      }
    });
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  /**
   * Decode the JWT sub payload to get current user id + username.
   * Returns { user_id, username } or nulls if not available.
   */
  function getCurrentUserInfo() {
    const possibleKeys = [
      "token",
      "authToken",
      "access_token",
      "accessToken",
      "jwt",
    ];
    for (const key of possibleKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parts = raw.split(".");
        if (parts.length < 2) continue;
        const sub = JSON.parse(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        const identity = sub.sub || sub;
        return {
          user_id: identity.id || identity.user_id || null,
          username: identity.username || null,
          is_admin: Boolean(identity.admin),
          is_storage_admin: Boolean(identity.storage_manager),
        };
      } catch (_) {}
    }
    return {
      user_id: null,
      username: null,
      is_admin: false,
      is_storage_admin: false,
    };
  }

  async function getAuthToken() {
    try {
      if (
        typeof Utils !== "undefined" &&
        Utils.Auth &&
        typeof Utils.Auth.requireAuth === "function"
      ) {
        const token = await Utils.Auth.requireAuth();
        if (token) return token;
      }
    } catch (error) {
      console.warn("Utils.Auth.requireAuth failed:", error);
    }

    const possibleKeys = [
      "token",
      "authToken",
      "access_token",
      "accessToken",
      "jwt",
    ];

    for (const key of possibleKeys) {
      const value = localStorage.getItem(key);
      if (value) return value;
    }

    return null;
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────

  async function requestJson(url, options = {}) {
    const response = await fetch(url, options);

    let data = null;
    const rawText = await response.text();

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch (error) {
        data = { message: rawText };
      }
    }

    if (!response.ok) {
      throw new Error(data?.message || `Request failed (${response.status}).`);
    }

    return data;
  }

  async function fetchSapOrderDetails(sapOrderId, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  async function fetchSapOrderFromSap(sapOrderId, token) {
    return requestJson(`${API_BASE}/sap-orders/fetch-from-sap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ doc_num: Number(sapOrderId) }),
    });
  }

  async function startCheckingSapOrder(sapOrderId, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/start-checking`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  async function reopenSapOrder(sapOrderId, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/reopen`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      },
    );
  }

  async function prepareSapOrder(sapOrderId, items, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/prepare`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ items }),
      },
    );
  }

  // NEW — calls POST /sap-orders/<id>/review
  async function reviewSapOrder(sapOrderId, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/review`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
  }

  // ─── Data normalisation ───────────────────────────────────────────────────

  function normalizeLoadedOrderPayload(payload) {
    const sapOrder = payload?.sap_order || payload || {};
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const items = rawItems.map((item) => {
      const quantity = Number(item.quantity || 0);
      const checked = Number(item.qty_checked || 0);

      return {
        ...item,
        quantity,
        original_qty_checked: checked,
        draft_qty_checked: checked,
        draft_qty_remaining: Math.max(quantity - checked, 0),
        // Preserve checker info returned by the backend
        checked_by_user_id: item.checked_by_user_id || null,
        checked_by_username: item.checked_by_username || null,
        checked_at: item.checked_at || null,
      };
    });

    const summary = payload?.summary || {
      items_count: items.length,
      total_quantity: items.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0,
      ),
      total_checked: items.reduce(
        (sum, item) => sum + Number(item.qty_checked || 0),
        0,
      ),
      total_remaining: items.reduce(
        (sum, item) => sum + Number(item.qty_remaining || 0),
        0,
      ),
    };

    return { sap_order: sapOrder, items, summary };
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function populateOrderDetails(payload) {
    const sapOrder = payload?.sap_order || {};
    const items = payload?.items || [];

    loadedOrderId.textContent = sapOrder.sap_order_id ?? "-";
    loadedOrderStatus.textContent = sapOrder.status || "-";
    loadedCustomerName.textContent = sapOrder.prepared_by_username || "-";

    // NEW — reviewer fields (elements may be absent in older HTML, guard with ?.
    if (loadedReviewedBy) {
      loadedReviewedBy.textContent = sapOrder.reviewed_by_username || "-";
    }
    if (loadedReviewedAt) {
      loadedReviewedAt.textContent = sapOrder.reviewed_at || "-";
    }

    // Highlight status badge
    loadedOrderStatus.className =
      "status-badge status-" + (sapOrder.status || "unknown").toLowerCase();

    renderOrderItems(items);
    setDraftInputsDisabled(!canEditDraft());
  }

  function renderOrderItems(items) {
    orderedItemsTableBody.innerHTML = "";

    items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.dataset.index = String(index);
      row.dataset.detailId = String(item.sap_order_detail_id || "");
      row.dataset.productId = String(item.product_id || "");
      row.dataset.barcode = String(item.bar_code || "").trim();

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(item.product_name || "-")}</td>
        <td>${escapeHtml(item.bar_code || "-")}</td>
        <td>${escapeHtml(item.quantity ?? "-")}</td>
        <td><span class="table-value">${Number(item.original_qty_checked || 0)}</span></td>
        <td>
          <input
            type="number"
            min="0"
            step="1"
            class="mini-input final-checked-input"
            data-col="final"
            value="${Number(item.draft_qty_checked || 0)}"
          />
        </td>
        <td><span class="table-value" data-col="remaining">${Number(item.draft_qty_remaining || 0)}</span></td>
        <td class="checker-col" data-col="checker">${renderCheckerCell(item)}</td>
        <td>
          <button
            type="button"
            class="minus-btn"
            title="Reduce by 1"
            aria-label="Reduce by 1"
          >-</button>
        </td>
      `;

      orderedItemsTableBody.appendChild(row);
    });
  }

  // ─── Draft logic ──────────────────────────────────────────────────────────

  function handleFinalCheckedInput(input, normalize = false) {
    const row = input.closest("tr");
    if (!row || !loadedOrder?.items?.length) return;

    const index = Number(row.dataset.index);
    const currentItem = loadedOrder.items[index];
    if (!currentItem) return;

    let rawValue = String(input.value || "").trim();

    if (!rawValue && !normalize) return;

    let nextChecked = parseInt(rawValue || "0", 10);
    if (!Number.isFinite(nextChecked) || nextChecked < 0) nextChecked = 0;

    input.value = String(nextChecked);
    const me = getCurrentUserInfo();
    updateDraftItemAtIndex(index, nextChecked, me.user_id, me.username);
    updateRowFromItem(row, loadedOrder.items[index]);
  }

  function updateDraftItemAtIndex(
    index,
    nextChecked,
    checkerUserId,
    checkerUsername,
  ) {
    const item = loadedOrder?.items?.[index];
    if (!item) return;

    const safeChecked = Math.max(0, parseInt(nextChecked, 10) || 0);
    item.draft_qty_checked = safeChecked;
    item.draft_qty_remaining = Math.max(
      Number(item.quantity || 0) - safeChecked,
      0,
    );

    // Record who made this change (from scan button or manual edit)
    if (checkerUserId !== undefined) {
      item.checked_by_user_id = checkerUserId;
      item.checked_by_username = checkerUsername || null;
    }
  }

  function updateRowFromItem(row, item) {
    if (!row || !item) return;

    const finalInput = row.querySelector('[data-col="final"]');
    const remainingText = row.querySelector('[data-col="remaining"]');
    const checkerCol = row.querySelector('[data-col="checker"]');

    if (finalInput)
      finalInput.value = String(Number(item.draft_qty_checked || 0));
    if (remainingText)
      remainingText.textContent = String(Number(item.draft_qty_remaining || 0));
    if (checkerCol) checkerCol.innerHTML = renderCheckerCell(item);
  }

  function findMatchingItemRow(barcode) {
    const normalizedBarcode = normalizeBarcode(barcode);
    const rows = Array.from(orderedItemsTableBody.querySelectorAll("tr"));

    for (const row of rows) {
      const rowBarcode = normalizeBarcode(row.dataset.barcode || "");
      if (rowBarcode && rowBarcode === normalizedBarcode) {
        const index = Number(row.dataset.index);
        return { row, index, item: loadedOrder?.items?.[index] };
      }
    }

    return null;
  }

  // ─── State helpers ────────────────────────────────────────────────────────

  function resetLoadedOrderUI(options = {}) {
    const { keepInputValue = false, preserveMessage = false } = options;

    loadedOrder = null;

    loadedOrderSection.classList.add("hidden");
    orderedItemsTableBody.innerHTML = "";

    loadedOrderId.textContent = "-";
    loadedOrderStatus.textContent = "-";
    loadedCustomerName.textContent = "-";

    if (loadedReviewedBy) loadedReviewedBy.textContent = "-";
    if (loadedReviewedAt) loadedReviewedAt.textContent = "-";

    if (!keepInputValue) orderIdInput.value = "";

    orderIdInput.disabled = false;
    searchOrderBtn.disabled = false;

    if (cancelSearchBtn) cancelSearchBtn.classList.add("hidden");

    if (barcodeInput) barcodeInput.value = "";
    if (manualBarcodeInput) manualBarcodeInput.value = "";
    if (scanQtyInput) scanQtyInput.value = "1";

    stopCamera();

    if (!preserveMessage) showMessage("");

    updateActionButtons();
  }

  /**
   * The order is editable (scanning/checking allowed) only when status is
   * one of the active working statuses.  "prepared" and "reviewed" are
   * locked — the preparer must reopen, or a reviewer must act.
   */
  function canEditDraft() {
    if (!loadedOrder?.sap_order?.sap_order_id) return false;
    const status = String(loadedOrder.sap_order.status || "").toLowerCase();
    return ["checked", "opened", "reopened"].includes(status);
  }

  /**
   * Returns true only when the order is in "prepared" status,
   * meaning it's waiting for a reviewer to confirm it.
   */
  function canReview() {
    if (!loadedOrder?.sap_order?.sap_order_id) return false;
    const status = String(loadedOrder.sap_order.status || "").toLowerCase();
    return status === "prepared";
  }

  function setDraftInputsDisabled(disabled) {
    const finalInputs = orderedItemsTableBody.querySelectorAll(
      ".final-checked-input",
    );
    const minusButtons = orderedItemsTableBody.querySelectorAll(".minus-btn");
    finalInputs.forEach((input) => {
      input.disabled = disabled;
    });
    minusButtons.forEach((button) => {
      button.disabled = disabled;
    });
  }

  // ─── UI feedback ──────────────────────────────────────────────────────────

  function showLoader(show) {
    orderSearchLoader.classList.toggle("hidden", !show);
  }

  function showMessage(message, isError = false) {
    if (!message) {
      orderSearchMessage.classList.add("hidden");
      orderSearchMessage.textContent = "";
      orderSearchMessage.style.color = "";
      return;
    }

    orderSearchMessage.classList.remove("hidden");
    orderSearchMessage.textContent = message;
    orderSearchMessage.style.color = isError ? "#dc2626" : "#16a34a";
  }

  /**
   * Central place that drives ALL button states based on current order status.
   *
   * Status flow:
   *   checked → opened → (scanning) → prepared → reviewed
   *                ↑_______reopen____________________|
   */
  function updateActionButtons() {
    const hasLoadedOrder = Boolean(loadedOrder?.sap_order?.sap_order_id);
    const canEdit = canEditDraft();
    const canRev = canReview();
    const status = String(loadedOrder?.sap_order?.status || "").toLowerCase();

    // Scan / Check button
    if (submitScanBtn) submitScanBtn.disabled = !canEdit;

    // Finish (Prepare) button
    if (finishOrderBtn) finishOrderBtn.disabled = !canEdit;

    // Qty field usable once an order is loaded
    if (scanQtyInput) scanQtyInput.disabled = !hasLoadedOrder;

    setDraftInputsDisabled(!canEdit);

    // ── Start / Reopen button ──────────────────────────────────────────────
    if (startCheckingBtn) {
      startCheckingBtn.disabled = !hasLoadedOrder;

      if (!hasLoadedOrder) {
        startCheckingBtn.textContent = "Start Checking";
      } else if (["checked", "opened", "reopened"].includes(status)) {
        startCheckingBtn.textContent = "Ready for Checking";
      } else if (["prepared", "reviewed"].includes(status)) {
        startCheckingBtn.textContent = "Reopen for Checking";
      } else {
        startCheckingBtn.textContent = "Start Checking";
      }
    }

    // ── Review button ──────────────────────────────────────────────────────
    if (reviewOrderBtn) {
      // Always show the button once an order is loaded — hide it only
      // when there is no order at all.
      reviewOrderBtn.classList.toggle("hidden", !hasLoadedOrder);

      if (status === "reviewed") {
        reviewOrderBtn.textContent = "Reviewed ✓";
        reviewOrderBtn.disabled = true;
        reviewOrderBtn.classList.add("reviewed");
      } else {
        reviewOrderBtn.textContent = "Confirm Review";
        reviewOrderBtn.classList.remove("reviewed");
        // Enabled only when status is "prepared"
        reviewOrderBtn.disabled = !canRev;
      }
    }
  }

  // ─── Camera / Scanner ─────────────────────────────────────────────────────

  function initScannerModeToggle() {
    if (
      !modeCameraBtn ||
      !modeManualBtn ||
      !cameraModeSection ||
      !manualModeSection
    )
      return;

    setScannerMode("camera");

    modeCameraBtn.addEventListener("click", () => setScannerMode("camera"));
    modeManualBtn.addEventListener("click", () => setScannerMode("manual"));
  }

  function setScannerMode(mode) {
    const isCamera = mode === "camera";
    const switchWrap = document.querySelector(".scanner-mode-switch");

    modeCameraBtn.classList.toggle("active", isCamera);
    modeManualBtn.classList.toggle("active", !isCamera);

    cameraModeSection.classList.toggle("hidden", !isCamera);
    manualModeSection.classList.toggle("hidden", isCamera);

    if (switchWrap) switchWrap.classList.toggle("manual-active", !isCamera);

    if (isCamera) {
      if (manualBarcodeInput) manualBarcodeInput.value = "";
      initCameraIfNeeded();
    } else {
      if (barcodeInput) barcodeInput.value = "";
      stopCamera();
      if (manualBarcodeInput) manualBarcodeInput.focus();
    }
  }

  async function initCameraIfNeeded() {
    if (!modeCameraBtn || !modeCameraBtn.classList.contains("active")) return;
    if (!loadedOrder?.sap_order?.sap_order_id) return;

    const video = document.getElementById("scannerVideo");
    if (!video) return;

    if (cameraStream) {
      startBarcodeDetection();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });

      cameraStream = stream;
      video.srcObject = stream;

      try {
        await video.play();
      } catch (error) {}

      startBarcodeDetection();
    } catch (error) {
      console.error("Camera access failed:", error);
      showMessage(
        "Unable to access camera. Please allow camera permission or use Manual Entry.",
        true,
      );
    }
  }

  async function startBarcodeDetection() {
    stopBarcodeDetection();

    const video = document.getElementById("scannerVideo");
    if (!video || !cameraStream) return;

    if (!("BarcodeDetector" in window)) {
      if (!cameraInfoShown) {
        cameraInfoShown = true;
        showMessage(
          "Camera preview is on, but this browser cannot auto-read barcodes. You can still type/paste the barcode or use Manual Entry.",
          false,
        );
      }
      return;
    }

    try {
      if (!barcodeDetector) {
        try {
          barcodeDetector = new BarcodeDetector({
            formats: [
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "code_128",
              "code_39",
              "qr_code",
            ],
          });
        } catch (error) {
          barcodeDetector = new BarcodeDetector();
        }
      }
    } catch (error) {
      console.error("BarcodeDetector init failed:", error);
      return;
    }

    detectorInterval = setInterval(async () => {
      try {
        if (!cameraStream || !video || video.readyState < 2 || !barcodeDetector)
          return;

        const detected = await barcodeDetector.detect(video);
        if (!Array.isArray(detected) || detected.length === 0) return;

        const rawValue = String(detected[0].rawValue || "").trim();
        if (!rawValue) return;

        const now = Date.now();
        if (rawValue === lastDetectedValue && now - lastDetectedAt < 1000)
          return;

        lastDetectedValue = rawValue;
        lastDetectedAt = now;

        if (barcodeInput) barcodeInput.value = rawValue;
      } catch (error) {}
    }, 400);
  }

  function stopBarcodeDetection() {
    if (detectorInterval) {
      clearInterval(detectorInterval);
      detectorInterval = null;
    }
  }

  function stopCamera() {
    stopBarcodeDetection();
    if (!cameraStream) return;

    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;

    const video = document.getElementById("scannerVideo");
    if (video) video.srcObject = null;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function normalizeBarcode(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "");
  }

  function highlightRow(row) {
    if (!row) return;
    row.style.transition = "background-color 0.35s ease";
    row.style.backgroundColor = "rgba(34, 197, 94, 0.16)";
    setTimeout(() => {
      row.style.backgroundColor = "";
    }, 900);
  }

  // ─── Checker cell renderer ────────────────────────────────────────────────

  /**
   * Returns an HTML string for the "Checked By" cell.
   *
   * States:
   *   • Not checked yet  — grey badge "Not checked yet"
   *   • Fully checked    — green badge with username + "X min ago"
   *   • Partially / missing — amber badge with username + remaining note
   *   • Draft (in-session change, no server timestamp yet) — blue badge
   */
  function renderCheckerCell(item) {
    const qty = Number(item.quantity || 0);
    const checked = Number(item.draft_qty_checked ?? item.qty_checked ?? 0);
    const remaining = Number(
      item.draft_qty_remaining ?? item.qty_remaining ?? 0,
    );
    const username = item.checked_by_username || null;
    const checkedAt = item.checked_at || null;

    // Nothing touched at all
    if (!username && checked === 0) {
      return `<span class="checker-badge checker-none">Not checked yet</span>`;
    }

    // Has a username (from server or just set in this session)
    const nameLabel = escapeHtml(username || "You");
    const timeLabel = checkedAt ? `· ${timeAgo(checkedAt)}` : `· just now`;

    if (remaining === 0 && checked >= qty && qty > 0) {
      // Fully done ✓
      return `
        <span class="checker-badge checker-done" title="Checked at ${escapeHtml(checkedAt || "this session")}">
          ✓ ${nameLabel} <small>${timeLabel}</small>
        </span>`;
    }

    if (checked > 0 && remaining > 0) {
      // Partially checked — missing items
      return `
        <span class="checker-badge checker-partial" title="Checked at ${escapeHtml(checkedAt || "this session")}">
          ⚠ ${nameLabel} <small>· ${remaining} missing ${timeLabel}</small>
        </span>`;
    }

    // checked = 0 but username exists (was reset / reopened after being checked)
    return `
      <span class="checker-badge checker-reset" title="Previously checked by ${nameLabel}">
        — ${nameLabel} <small>(reset)</small>
      </span>`;
  }

  /**
   * Returns a human-readable relative time string for a datetime string.
   * e.g. "just now", "2 min ago", "1 hr ago", "3 days ago"
   */
  function timeAgo(datetimeStr) {
    if (!datetimeStr) return "";
    try {
      // Backend returns "YYYY-MM-DD HH:MM:SS" (no timezone suffix) — treat as local
      const normalized = datetimeStr.replace(" ", "T");
      const date = new Date(normalized);
      if (isNaN(date.getTime())) return datetimeStr;

      const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

      if (diffSec < 10) return "just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} hr ago`;
      const diffDay = Math.floor(diffHr / 24);
      return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
    } catch (_) {
      return datetimeStr;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
