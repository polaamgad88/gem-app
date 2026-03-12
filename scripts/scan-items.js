document.addEventListener("DOMContentLoaded", () => {
  const orderIdInput = document.getElementById("orderIdInput");
  const searchOrderBtn = document.getElementById("searchOrderBtn");
  const cancelSearchBtn = document.getElementById("cancelSearchBtn");
  const orderSearchLoader = document.getElementById("orderSearchLoader");
  const orderSearchMessage = document.getElementById("orderSearchMessage");

  const loadedOrderSection = document.getElementById("loadedOrderSection");
  const loadedOrderId = document.getElementById("loadedOrderId");
  const loadedOrderStatus = document.getElementById("loadedOrderStatus");
  const loadedCustomerName = document.getElementById("loadedCustomerName");
  const orderedItemsTableBody = document.getElementById("orderedItemsTableBody");

  const submitScanBtn = document.getElementById("submitScanBtn");
  const finishOrderBtn = document.getElementById("finishOrderBtn");

  const modeCameraBtn = document.getElementById("modeCameraBtn");
  const modeManualBtn = document.getElementById("modeManualBtn");
  const cameraModeSection = document.getElementById("cameraModeSection");
  const manualModeSection = document.getElementById("manualModeSection");
  const barcodeInput = document.getElementById("barcodeInput");
  const manualBarcodeInput = document.getElementById("manualBarcodeInput");

  let cameraStream = null;
  let loadedOrder = null;

  initScannerModeToggle();

  searchOrderBtn.addEventListener("click", async () => {
    const orderId = orderIdInput.value.trim();

    if (!orderId) {
      resetLoadedOrderUI({ keepInputValue: true });
      showMessage("Please enter order ID.", true);
      return;
    }

    showLoader(true);
    showMessage("");

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found.");
      }

      const order = await fetchOrderDetails(orderId, token);
      loadedOrder = order;

      orderIdInput.value = order.order_id || orderId;
      orderIdInput.disabled = true;
      searchOrderBtn.disabled = true;

      if (cancelSearchBtn) {
        cancelSearchBtn.classList.remove("hidden");
      }

      populateOrderDetails(order);

      loadedOrderSection.classList.remove("hidden");
      showMessage("Order loaded successfully.", false);

      initCameraIfNeeded();
    } catch (error) {
      console.error("Error loading order:", error);
      resetLoadedOrderUI({ keepInputValue: true });
      showMessage(error.message || "Failed to load order details.", true);
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

  submitScanBtn.addEventListener("click", () => {
    if (!loadedOrder) {
      alert("Please load an order first.");
      return;
    }

    const isCameraMode = modeCameraBtn.classList.contains("active");
    const scannedValue = barcodeInput ? barcodeInput.value.trim() : "";
    const manualValue = manualBarcodeInput ? manualBarcodeInput.value.trim() : "";
    const barcode = isCameraMode ? scannedValue : manualValue;

    if (!barcode) {
      alert("Please scan or enter a barcode first.");
      return;
    }

    const matchedRow = findMatchingItemRow(barcode);

    if (!matchedRow) {
      alert("This barcode does not match any item in the order.");
      return;
    }

    const currentCValue = parseInt(matchedRow.cInput.value || "0", 10) || 0;
    matchedRow.cInput.value = currentCValue + 1;

    if (barcodeInput) barcodeInput.value = "";
    if (manualBarcodeInput) manualBarcodeInput.value = "";

    highlightRow(matchedRow.row);

    console.log("Matched barcode:", barcode, "Item:", matchedRow.item);
  });

  finishOrderBtn.addEventListener("click", () => {
    if (!loadedOrder) {
      alert("Please load an order first.");
      return;
    }

    const rows = Array.from(
      orderedItemsTableBody.querySelectorAll("tr")
    ).map((row) => {
      const index = Number(row.dataset.index);
      const item = loadedOrder.items[index];

      return {
        item_id: item.item_id || item.id || null,
        product_name: item.product_name || "",
        bar_code: item.bar_code || "",
        ordered_quantity: Number(item.quantity || 0),
        c: Number(row.querySelector('[data-col="c"]')?.value || 0),
        r: Number(row.querySelector('[data-col="r"]')?.value || 0),
      };
    });

    console.log("Finish order payload:", {
      order_id: loadedOrder.order_id,
      items: rows,
    });

    alert("Finish clicked. Payload logged in console.");
  });

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

  async function fetchOrderDetails(orderId, token) {
    const response = await fetch(
      `https://order-app.gemegypt.net/api/orders/find/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || "Failed to fetch order details.");
    }

    return data;
  }

  function populateOrderDetails(order) {
    loadedOrderId.textContent = order.order_id || "-";
    loadedOrderStatus.textContent = order.status || "-";
    loadedCustomerName.textContent = order.customer_name || "-";

    renderOrderItems(order.items || []);
  }

  function renderOrderItems(items) {
    orderedItemsTableBody.innerHTML = "";

    items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.dataset.index = String(index);
      row.dataset.barcode = String(item.bar_code || "").trim();

      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${escapeHtml(item.product_name || "-")}</td>
        <td>${escapeHtml(item.bar_code || "-")}</td>
        <td>${escapeHtml(item.quantity ?? "-")}</td>
        <td><input type="number" min="0" class="mini-input" data-col="c" value="0" /></td>
        <td><input type="number" min="0" class="mini-input" data-col="r" value="0" /></td>
      `;

      orderedItemsTableBody.appendChild(row);
    });
  }

  function resetLoadedOrderUI(options = {}) {
    const {
      keepInputValue = false,
      preserveMessage = false,
    } = options;

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

    stopCamera();

    if (!preserveMessage) {
      showMessage("");
    }
  }

  function findMatchingItemRow(barcode) {
    const normalizedBarcode = normalizeBarcode(barcode);
    const rows = Array.from(orderedItemsTableBody.querySelectorAll("tr"));

    for (const row of rows) {
      const rowBarcode = normalizeBarcode(row.dataset.barcode || "");
      if (rowBarcode && rowBarcode === normalizedBarcode) {
        const index = Number(row.dataset.index);
        return {
          row,
          item: loadedOrder?.items?.[index],
          cInput: row.querySelector('[data-col="c"]'),
          rInput: row.querySelector('[data-col="r"]'),
        };
      }
    }

    return null;
  }

  function normalizeBarcode(value) {
    return String(value || "").trim().replace(/\s+/g, "");
  }

  function highlightRow(row) {
    if (!row) return;

    row.style.transition = "background-color 0.35s ease";
    row.style.backgroundColor = "rgba(34, 197, 94, 0.16)";

    setTimeout(() => {
      row.style.backgroundColor = "";
    }, 900);
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

  function initScannerModeToggle() {
    if (!modeCameraBtn || !modeManualBtn || !cameraModeSection || !manualModeSection) {
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
    if (!loadedOrder) return;

    const video = document.getElementById("scannerVideo");
    if (!video) return;
    if (cameraStream) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" }
        },
        audio: false
      });

      cameraStream = stream;
      video.srcObject = stream;
    } catch (error) {
      console.error("Camera access failed:", error);

      const scannerCamera = document.getElementById("scannerCamera");
      if (scannerCamera) {
        scannerCamera.innerHTML = `
          <div style="
            height:100%;
            display:flex;
            align-items:center;
            justify-content:center;
            color:#fff;
            text-align:center;
            padding:20px;
            background:#222;
            font-size:14px;
            line-height:1.6;
          ">
            Unable to access camera.<br>
            Please allow camera permission.
          </div>
        `;
      }
    }
  }

  function stopCamera() {
    if (!cameraStream) return;

    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;

    const video = document.getElementById("scannerVideo");
    if (video) {
      video.srcObject = null;
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