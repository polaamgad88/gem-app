document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("access_token");
  const orderId = getOrderIdFromUrl();

  if (!token || !(await checkLogin(token))) {
    return (window.location.href = "login.html");
  }

  if (!orderId) {
    alert("Missing order ID");
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/orders/find/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return alert("Failed to fetch order");
    }

    const order = await res.json();
    await populateEditableForm(order, token);
    const allProducts = await fetchList(
      "http://localhost:5000/products",
      "data"
    );
    const allBrands = [...new Set(allProducts.map((p) => p.brand))];

    document.getElementById("add-product-btn").addEventListener("click", () => {
      addProductRow(allBrands, allProducts);
    });
  } catch (err) {
    console.error("Error loading order:", err);
  }

  document.getElementById("save-order").addEventListener("click", async () => {
    const orderId = getOrderIdFromUrl();
    const addressSelect = document.getElementById("address-select");
    const selectedAddress = addressSelect?.value;

    const updatedProducts = [];

    document.querySelectorAll(".edit-row").forEach((row) => {
      const productId = row.dataset.productId;
      const qty = parseInt(row.querySelector(".qty").value);
      if (productId && qty > 0) {
        updatedProducts.push({
          product_id: parseInt(productId),
          quantity: qty,
        });
      }
    });

    if (updatedProducts.length === 0) {
      return alert("Please add at least one product");
    }

    const payload = {
      products: updatedProducts,
    };

    if (selectedAddress) {
      payload.address_id = parseInt(selectedAddress);
    }

    try {
      const res = await fetch(`http://localhost:5000/orders/edit/${orderId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        alert("✅ Order updated successfully!");
        window.location.href = `view-order.html?order_id=${orderId}`;
      } else {
        alert(`❌ ${data.message}`);
      }
    } catch (err) {
      alert("❌ Error updating order");
    }
  });
});

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("order_id");
}

async function checkLogin(token) {
  try {
    const res = await fetch("http://localhost:5000/checklogin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function populateEditableForm(order, token) {
  document.getElementById("orderId").textContent = `#${order.order_id}`;
  document.getElementById("order-id").textContent = `#${order.order_id}`;
  document.getElementById("order-date").textContent = formatDate(
    order.order_date
  );
  document.getElementById("order-state").textContent = order.status;
  document.getElementById("order-state").className = `state ${order.status}`;
  document.getElementById("delegate-name").textContent = order.username;
  document.getElementById("customer-name").textContent = order.customer_name;
  document.getElementById(
    "customer-id"
  ).textContent = `CUST-${order.customer_id}`;

  const addrContainer = document.getElementById("customer-address");
  const select = document.createElement("select");
  select.id = "address-select";
  select.style.padding = "8px";
  select.style.borderRadius = "4px";
  select.style.marginTop = "6px";

  try {
    const res = await fetch(
      `http://localhost:5000/customers/${order.customer_id}/addresses`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    const addresses = data.addresses || [];

    addresses.forEach((a) => {
      const opt = document.createElement("option");
      opt.value = a.address_id;
      opt.textContent = a.address;
      if (
        a.address === order.address ||
        a.address_id === order.customer_address_id
      ) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    addrContainer.innerHTML = ""; // remove text
    addrContainer.appendChild(select);
  } catch (err) {
    console.error("Failed to fetch addresses");
  }

  const tbody = document.getElementById("editable-items-body");
  tbody.innerHTML = "";

  order.items.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "edit-row";
    row.dataset.productId = item.product_id;

    const imageUrl = item.image_path
      ? `http://localhost:5000/images/${item.image_path}`
      : "";

    row.innerHTML = `
      <td><img src="${imageUrl}" style="width:50px; height:50px; object-fit:cover;"></td>
      <td>${item.product_name}</td>
      <td>EGP ${item.price.toFixed(2)}</td>
      <td><input type="number" class="qty" value="${
        item.quantity
      }" min="1" style="width:60px"></td>
      <td class="item-total">EGP ${(item.quantity * item.price).toFixed(2)}</td>
      <td><button class="remove-btn">🗑️</button></td>
    `;

    row.querySelector(".qty").addEventListener("input", () => {
      const qty = parseInt(row.querySelector(".qty").value) || 0;
      const newTotal = qty * item.price;
      row.querySelector(".item-total").textContent = `EGP ${newTotal.toFixed(
        2
      )}`;
      updateTotal();
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      row.remove();
      updateTotal();
    });

    tbody.appendChild(row);
  });

  updateTotal();
}

function updateTotal() {
  let total = 0;
  document.querySelectorAll(".edit-row").forEach((row) => {
    const qty = parseInt(row.querySelector(".qty").value) || 0;
    const priceText = row.children[2].textContent.replace("EGP", "").trim();
    const price = parseFloat(priceText);
    total += qty * price;
  });
  document.getElementById("total-price").textContent = `EGP ${total.toFixed(
    2
  )}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

async function fetchList(url, key) {
  const token = localStorage.getItem("access_token");
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return json[key] || [];
  } catch {
    return [];
  }
}
function addProductRow(brands, products) {
  const tbody = document.getElementById("editable-items-body");
  const row = document.createElement("tr");
  row.className = "edit-row";

  let selectedProduct = null;

  // 📦 Image cell
  const imageCell = document.createElement("td");
  imageCell.innerHTML = `<span style="color:#888;">No Image</span>`;

  // 📦 Product selection cell with mode selector
  const itemCell = document.createElement("td");
  const modeSelector = document.createElement("select");
  modeSelector.innerHTML = `
    <option value="brand">Brand + Product</option>
    <option value="barcode">Barcode</option>
  `;
  modeSelector.style.marginBottom = "4px";

  const inputWrapper = document.createElement("div");
  itemCell.appendChild(modeSelector);
  itemCell.appendChild(inputWrapper);

  // 📦 Price, Qty, Total
  const priceCell = document.createElement("td");
  priceCell.textContent = "EGP 0";

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = 1;
  qtyInput.value = 1;
  qtyInput.className = "qty";
  qtyInput.style.width = "60px";

  const qtyCell = document.createElement("td");
  qtyCell.appendChild(qtyInput);

  const totalCell = document.createElement("td");
  totalCell.className = "item-total";
  totalCell.textContent = "EGP 0";

  const removeBtn = document.createElement("button");
  removeBtn.textContent = "🗑️";
  removeBtn.className = "remove-btn";
  removeBtn.onclick = () => {
    row.remove();
    updateTotal();
  };

  const actionCell = document.createElement("td");
  actionCell.appendChild(removeBtn);

  row.appendChild(imageCell);
  row.appendChild(itemCell);
  row.appendChild(priceCell);
  row.appendChild(qtyCell);
  row.appendChild(totalCell);
  row.appendChild(actionCell);
  tbody.appendChild(row);

  // --- Functions to switch between modes ---
  function setBrandProductInputs() {
    inputWrapper.innerHTML = "";

    const brandSelect = document.createElement("select");
    brandSelect.innerHTML = `<option value="">Select Brand</option>`;
    brands.forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b;
      opt.textContent = b;
      brandSelect.appendChild(opt);
    });

    const productSelect = document.createElement("select");
    productSelect.innerHTML = `<option value="">Select Product</option>`;

    inputWrapper.appendChild(brandSelect);
    inputWrapper.appendChild(document.createElement("br"));
    inputWrapper.appendChild(productSelect);

    brandSelect.addEventListener("change", () => {
      const brand = brandSelect.value;
      productSelect.innerHTML = `<option value="">Select Product</option>`;
      const filtered = products.filter((p) => p.brand === brand);
      filtered.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.product_id;
        opt.textContent = p.product_name;
        opt.dataset.price = p.price;
        opt.dataset.image = p.image_path || "";
        productSelect.appendChild(opt);
      });
    });

    productSelect.addEventListener("change", () => {
      const selected = productSelect.selectedOptions[0];
      if (!selected) return;

      const productId = selected.value;
      const price = parseFloat(selected.dataset.price || 0);
      const image = selected.dataset.image;
      const quantity = parseInt(qtyInput.value);

      row.dataset.productId = productId;
      selectedProduct = { product_id: productId, price };

      imageCell.innerHTML = image
        ? `<img src="http://localhost:5000/images/${image}" style="width:50px;height:50px;object-fit:cover;">`
        : `<span style="color:#888;">No Image</span>`;

      priceCell.textContent = `EGP ${price.toFixed(2)}`;
      totalCell.textContent = `EGP ${(price * quantity).toFixed(2)}`;
      updateTotal();

      const lastRow = [...tbody.querySelectorAll(".edit-row")].at(-1);
      if (lastRow === row) addProductRow(brands, products);
    });
  }

  function setBarcodeInput() {
    inputWrapper.innerHTML = "";
    const barcodeInput = document.createElement("input");
    barcodeInput.type = "text";
    barcodeInput.placeholder = "Enter barcode";
    inputWrapper.appendChild(barcodeInput);

    let timer;
    barcodeInput.addEventListener("input", () => {
      clearTimeout(timer);
      const value = barcodeInput.value.trim();
      if (value.length < 3) return;

      timer = setTimeout(async () => {
        const token = localStorage.getItem("access_token");
        const res = await fetch(
          `http://localhost:5000/product/search_by_barcode?barcode=${encodeURIComponent(
            value
          )}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const json = await res.json();
        const matches = json.data || [];

        if (matches.length === 1) {
          const p = matches[0];
          const quantity = parseInt(qtyInput.value);

          row.dataset.productId = p.product_id;
          selectedProduct = { product_id: p.product_id, price: p.price };

          imageCell.innerHTML = p.image_path
            ? `<img src="http://localhost:5000/images/${p.image_path}" style="width:50px;height:50px;object-fit:cover;">`
            : `<span style="color:#888;">No Image</span>`;

          priceCell.textContent = `EGP ${Number(p.price).toFixed(2)}`;
          totalCell.textContent = `EGP ${(Number(p.price) * quantity).toFixed(
            2
          )}`;

          updateTotal();

          const lastRow = [...tbody.querySelectorAll(".edit-row")].at(-1);
          if (lastRow === row) addProductRow(brands, products);
        }
      }, 500);
    });
  }

  modeSelector.addEventListener("change", () => {
    if (modeSelector.value === "barcode") {
      setBarcodeInput();
    } else {
      setBrandProductInputs();
    }
  });

  setBrandProductInputs();

  qtyInput.addEventListener("input", () => {
    if (!selectedProduct) return;
    const qty = parseInt(qtyInput.value) || 1;
    totalCell.textContent = `EGP ${(selectedProduct.price * qty).toFixed(2)}`;
    updateTotal();
  });
}
