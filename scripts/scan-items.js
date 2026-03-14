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
  const orderedItemsTableBody = document.getElementById(
    "orderedItemsTableBody",
  );

  const modeCameraBtn = document.getElementById("modeCameraBtn");
  const modeManualBtn = document.getElementById("modeManualBtn");
  const cameraModeSection = document.getElementById("cameraModeSection");
  const manualModeSection = document.getElementById("manualModeSection");
  const barcodeInput = document.getElementById("barcodeInput");
  const manualBarcodeInput = document.getElementById("manualBarcodeInput");
  const finishOrderBtn = document.getElementById("finishOrderBtn");

  enhanceUi();

  const submitScanBtn = document.getElementById("submitScanBtn");
  const scanQtyInput = document.getElementById("scanQtyInput");
  const startCheckingBtn = document.getElementById("startCheckingBtn");

  let cameraStream = null;
  let loadedOrder = null;

  let barcodeDetector = null;
  let detectorInterval = null;
  let lastDetectedValue = "";
  let lastDetectedAt = 0;
  let cameraInfoShown = false;

  initScannerModeToggle();
  updateActionButtons();

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

  if (startCheckingBtn) {
    startCheckingBtn.addEventListener("click", async () => {
      if (!loadedOrder?.sap_order?.sap_order_id) {
        alert("Please load a SAP order first.");
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
          return;
        }

        if (currentStatus === "prepared") {
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

  if (submitScanBtn) {
    submitScanBtn.addEventListener("click", async () => {
      if (!loadedOrder?.sap_order?.sap_order_id) {
        alert("Please load a SAP order first.");
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
        alert("Please scan or enter a barcode first.");
        return;
      }

      try {
        submitScanBtn.disabled = true;
        showMessage("");

        const token = await getAuthToken();
        if (!token) {
          throw new Error("Authentication token not found.");
        }

        const sapOrderId = loadedOrder.sap_order.sap_order_id;
        const scanResult = await scanSapOrderItem(
          sapOrderId,
          barcode,
          incrementBy,
          token,
        );

        updateItemRowFromScan(scanResult);
        updateLoadedOrderItemState(scanResult);

        if (barcodeInput) barcodeInput.value = "";
        if (manualBarcodeInput) manualBarcodeInput.value = "";

        if (
          manualModeSection &&
          !manualModeSection.classList.contains("hidden") &&
          manualBarcodeInput
        ) {
          manualBarcodeInput.focus();
        }

        showMessage(
          scanResult.message ||
            `Checked ${scanResult.product_name} successfully.`,
          false,
        );
      } catch (error) {
        console.error("Scan failed:", error);
        showMessage(error.message || "Failed to check item.", true);
      } finally {
        submitScanBtn.disabled = false;
      }
    });
  }

  if (finishOrderBtn) {
    finishOrderBtn.addEventListener("click", async () => {
      if (!loadedOrder?.sap_order?.sap_order_id) {
        alert("Please load a SAP order first.");
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
        const result = await prepareSapOrder(sapOrderId, token);

        loadedOrder = normalizeLoadedOrderPayload(result);
        populateOrderDetails(loadedOrder);
        updateActionButtons();

        if (result.mail?.sent) {
          showMessage(
            "Order finished successfully. Missing-items email was sent by the backend.",
            false,
          );
        } else {
          showMessage(
            "Order finished successfully. All items were checked, so no missing-items email was needed.",
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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      body: JSON.stringify({
        doc_num: Number(sapOrderId),
      }),
    });
  }

  async function startCheckingSapOrder(sapOrderId, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/start-checking`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  async function scanSapOrderItem(sapOrderId, barcode, incrementBy, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/scan`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          barcode,
          increment_by: incrementBy,
        }),
      },
    );
  }

  async function prepareSapOrder(sapOrderId, token) {
    return requestJson(
      `${API_BASE}/sap-orders/${encodeURIComponent(sapOrderId)}/prepare`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
  }

  function normalizeLoadedOrderPayload(payload) {
    const sapOrder = payload?.sap_order || payload || {};
    const items = Array.isArray(payload?.items) ? payload.items : [];
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

    return {
      sap_order: sapOrder,
      items,
      summary,
    };
  }

  function populateOrderDetails(payload) {
    const sapOrder = payload?.sap_order || {};
    const items = payload?.items || [];

    loadedOrderId.textContent = sapOrder.sap_order_id ?? "-";
    loadedOrderStatus.textContent = sapOrder.status || "-";
    loadedCustomerName.textContent = sapOrder.prepared_by_username || "-";

    renderOrderItems(items);
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
        <td><input type="number" min="0" class="mini-input" data-col="c" value="${Number(item.qty_checked || 0)}" readonly /></td>
        <td><input type="number" min="0" class="mini-input" data-col="r" value="${Number(item.qty_remaining || 0)}" readonly /></td>
      `;

      orderedItemsTableBody.appendChild(row);
    });
  }

  function resetLoadedOrderUI(options = {}) {
    const { keepInputValue = false, preserveMessage = false } = options;

    loadedOrder = null;

    loadedOrderSection.classList.add("hidden");
    orderedItemsTableBody.innerHTML = "";

    loadedOrderId.textContent = "-";
    loadedOrderStatus.textContent = "-";
    loadedCustomerName.textContent = "-";

    if (!keepInputValue) {
      orderIdInput.value = "";
    }

    orderIdInput.disabled = false;
    searchOrderBtn.disabled = false;

    if (cancelSearchBtn) {
      cancelSearchBtn.classList.add("hidden");
    }

    if (barcodeInput) barcodeInput.value = "";
    if (manualBarcodeInput) manualBarcodeInput.value = "";
    if (scanQtyInput) scanQtyInput.value = "1";

    stopCamera();

    if (!preserveMessage) {
      showMessage("");
    }

    updateActionButtons();
  }

  function updateLoadedOrderItemState(scanResult) {
    if (!loadedOrder?.items?.length) return;

    const target = loadedOrder.items.find((item) => {
      if (
        String(item.sap_order_detail_id || "") ===
        String(scanResult.sap_order_detail_id || "")
      ) {
        return true;
      }

      if (
        String(item.product_id || "") === String(scanResult.product_id || "")
      ) {
        return true;
      }

      return (
        normalizeBarcode(item.bar_code || "") ===
        normalizeBarcode(scanResult.barcode || "")
      );
    });

    if (!target) return;

    target.qty_checked = Number(scanResult.qty_checked || 0);
    target.qty_remaining = Number(scanResult.qty_remaining || 0);
  }

  function updateItemRowFromScan(scanResult) {
    const rows = Array.from(orderedItemsTableBody.querySelectorAll("tr"));

    const row = rows.find((candidate) => {
      if (
        String(candidate.dataset.detailId || "") ===
        String(scanResult.sap_order_detail_id || "")
      ) {
        return true;
      }

      if (
        String(candidate.dataset.productId || "") ===
        String(scanResult.product_id || "")
      ) {
        return true;
      }

      return (
        normalizeBarcode(candidate.dataset.barcode || "") ===
        normalizeBarcode(scanResult.barcode || "")
      );
    });

    if (!row) return;

    const cInput = row.querySelector('[data-col="c"]');
    const rInput = row.querySelector('[data-col="r"]');

    if (cInput) cInput.value = Number(scanResult.qty_checked || 0);
    if (rInput) rInput.value = Number(scanResult.qty_remaining || 0);

    highlightRow(row);
  }

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

  function enhanceUi() {
    const summaryStrongEls = document.querySelectorAll(".order-summary strong");
    if (summaryStrongEls[2]) {
      summaryStrongEls[2].textContent = "Prepared By:";
    }

    if (barcodeInput) {
      barcodeInput.readOnly = false;
      barcodeInput.placeholder = "Camera-detected or typed barcode";
    }

    const scannerSubmitWrap = document.querySelector(".scanner-submit-btn");
    if (scannerSubmitWrap && !document.getElementById("scanQtyInput")) {
      const qtyLabel = document.createElement("label");
      qtyLabel.setAttribute("for", "scanQtyInput");
      qtyLabel.className = "scanner-main-label";
      qtyLabel.textContent = "Qty";

      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.step = "1";
      qtyInput.value = "1";
      qtyInput.id = "scanQtyInput";
      qtyInput.className = "input";

      scannerSubmitWrap.prepend(qtyInput);
      scannerSubmitWrap.prepend(qtyLabel);
    }

    const submitBtn = document.getElementById("submitScanBtn");
    if (submitBtn) {
      submitBtn.textContent = "Check";
    }

    const finishRow = document.querySelector(".finish-row");
    if (finishRow && !document.getElementById("startCheckingBtn")) {
      const startBtn = document.createElement("button");
      startBtn.id = "startCheckingBtn";
      startBtn.className = "btn btn-primary";
      startBtn.type = "button";
      startBtn.textContent = "Start Checking";
      startBtn.style.marginInlineEnd = "12px";
      finishRow.prepend(startBtn);
    }
  }

  function updateActionButtons() {
    const status = String(loadedOrder?.sap_order?.status || "").toLowerCase();
    const hasLoadedOrder = Boolean(loadedOrder?.sap_order?.sap_order_id);

    const scanAllowedStatuses = ["checked", "opened", "reopened", "prepared"];
    const canScan = hasLoadedOrder && scanAllowedStatuses.includes(status);

    if (submitScanBtn) {
      submitScanBtn.disabled = !canScan;
    }

    if (finishOrderBtn) {
      finishOrderBtn.disabled = !hasLoadedOrder;
    }

    if (startCheckingBtn) {
      startCheckingBtn.disabled = !hasLoadedOrder;

      if (!hasLoadedOrder) {
        startCheckingBtn.textContent = "Start Checking";
        return;
      }

      if (["checked", "opened", "reopened"].includes(status)) {
        startCheckingBtn.textContent = "Ready for Checking";
      } else if (status === "prepared") {
        startCheckingBtn.textContent = "Reopen for Checking";
      } else {
        startCheckingBtn.textContent = "Start Checking";
      }
    }
  }

  function initScannerModeToggle() {
    if (
      !modeCameraBtn ||
      !modeManualBtn ||
      !cameraModeSection ||
      !manualModeSection
    ) {
      return;
    }

    setScannerMode("camera");

    modeCameraBtn.addEventListener("click", () => {
      setScannerMode("camera");
    });

    modeManualBtn.addEventListener("click", () => {
      setScannerMode("manual");
    });
  }

  function setScannerMode(mode) {
    const isCamera = mode === "camera";
    const switchWrap = document.querySelector(".scanner-mode-switch");

    modeCameraBtn.classList.toggle("active", isCamera);
    modeManualBtn.classList.toggle("active", !isCamera);

    cameraModeSection.classList.toggle("hidden", !isCamera);
    manualModeSection.classList.toggle("hidden", isCamera);

    if (switchWrap) {
      switchWrap.classList.toggle("manual-active", !isCamera);
    }

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
        video: {
          facingMode: { ideal: "environment" },
        },
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
        if (rawValue === lastDetectedValue && now - lastDetectedAt < 1000) {
          return;
        }

        lastDetectedValue = rawValue;
        lastDetectedAt = now;

        if (barcodeInput) {
          barcodeInput.value = rawValue;
        }
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
    if (video) {
      video.srcObject = null;
    }
  }

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

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
