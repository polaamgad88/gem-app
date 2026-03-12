document.addEventListener("DOMContentLoaded", () => {
  const orderIdInput = document.getElementById("orderIdInput");
  const searchOrderBtn = document.getElementById("searchOrderBtn");
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

  initScannerModeToggle();
  initCameraIfNeeded();

  searchOrderBtn.addEventListener("click", async () => {
    const orderId = orderIdInput.value.trim();

    if (!orderId) {
      showMessage("Please enter order ID.", true);
      return;
    }

    showLoader(true);
    showMessage("");
    loadedOrderSection.classList.add("hidden");

    try {
      // Replace this with your real API call
      await fakeDelay(1400);

      const order = {
        id: orderId,
        status: "Pending",
        customer_name: "John Doe",
        items: [
          { name: "Item A", sku: "SKU-001", qty: 2 },
          { name: "Item B", sku: "SKU-002", qty: 1 },
          { name: "Item C", sku: "SKU-003", qty: 4 }
        ]
      };

      orderIdInput.value = order.id;
      orderIdInput.disabled = true;
      searchOrderBtn.disabled = true;

      loadedOrderId.textContent = order.id;
      loadedOrderStatus.textContent = order.status;
      loadedCustomerName.textContent = order.customer_name;

      renderOrderItems(order.items);

      loadedOrderSection.classList.remove("hidden");
      showMessage("Order loaded successfully.", false);

      initCameraIfNeeded();
    } catch (error) {
      console.error(error);
      showMessage("Failed to load order.", true);
    } finally {
      showLoader(false);
    }
  });

  submitScanBtn.addEventListener("click", () => {
    const isCameraMode = modeCameraBtn.classList.contains("active");
    const scannedValue = barcodeInput ? barcodeInput.value.trim() : "";
    const manualValue = manualBarcodeInput ? manualBarcodeInput.value.trim() : "";
    const barcode = isCameraMode ? scannedValue : manualValue;

    if (!barcode) {
      alert("Please scan or enter a barcode first.");
      return;
    }

    console.log("Submitted barcode:", barcode);
    alert(`Submitted barcode: ${barcode}`);
  });

  finishOrderBtn.addEventListener("click", () => {
    console.log("Finish order clicked");
    alert("Order finished.");
  });

  function renderOrderItems(items) {
    orderedItemsTableBody.innerHTML = "";

    items.forEach((item, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${item.name}</td>
        <td>${item.sku}</td>
        <td>${item.qty}</td>
        <td><input type="text" class="mini-input" data-col="c" /></td>
        <td><input type="text" class="mini-input" data-col="r" /></td>
      `;
      orderedItemsTableBody.appendChild(row);
    });
  }

  function showLoader(show) {
    orderSearchLoader.classList.toggle("hidden", !show);
  }

  function showMessage(message, isError = false) {
    if (!message) {
      orderSearchMessage.classList.add("hidden");
      orderSearchMessage.textContent = "";
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

  function fakeDelay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});