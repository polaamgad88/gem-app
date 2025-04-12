// Make toggleTab available globally before DOMContentLoaded
window.toggleTab = function (id) {
  const content = document.getElementById(id);
  const arrow = content.previousElementSibling.querySelector(".arrow");
  const isVisible = content.style.display === "block";
  content.style.display = isVisible ? "none" : "block";
  arrow.textContent = isVisible ? "▼" : "▲";
};

document.addEventListener("DOMContentLoaded", async function () {
  const token = localStorage.getItem("access_token");
  if (!token || !(await checkLogin(token))) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("order-date").valueAsDate = new Date();

  const [brands, categories, products, customers] = await Promise.all([
    fetchList("http://localhost:5000/products/brands", "brands"),
    fetchList("http://localhost:5000/products/categories", "categories"),
    fetchList("http://localhost:5000/products", "data"),
    fetchList("http://localhost:5000/customers", "customers"),
  ]);

  populateCustomerDropdown(customers);
  const brandOptions = brands || [];
  const categoryOptions = categories || [];
  const productOptions = products || [];

  document
    .getElementById("customer-select")
    .addEventListener("change", async (e) => {
      const id = e.target.value;
      const addressSelect = document.getElementById("address-select");
      addressSelect.innerHTML = `<option value="">Select Address</option>`;
      if (id) {
        const res = await fetch(
          `http://localhost:5000/customers/${id}/addresses`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (res.ok) {
          const data = await res.json();
          data.addresses.forEach((addr) => {
            const opt = document.createElement("option");
            opt.value = addr.address_id;
            opt.textContent = addr.address;
            addressSelect.appendChild(opt);
          });
        }
      }
    });

  document.querySelectorAll(".add-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const containerId =
        type === "combined" ? "combined-order-rows" : "detailed-order-rows";
      const container = document.getElementById(containerId);
      if (type === "combined") {
        addCombinedRow(container, brandOptions, categoryOptions);
      } else {
        addOrderRow(container, brandOptions, productOptions, "brand");
      }
    });
  });
});

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

async function fetchList(url, key) {
  try {
    const token = localStorage.getItem("access_token");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return json[key] || [];
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }
}

function populateCustomerDropdown(customers) {
  const select = document.getElementById("customer-select");
  select.innerHTML = `<option value="">Select Customer</option>`;
  customers.forEach((cust) => {
    const opt = document.createElement("option");
    opt.value = cust.customer_id;
    opt.textContent = `${cust.first_name} ${cust.last_name}`;
    select.appendChild(opt);
  });
}

function addOrderRow(container, brands, products) {
  const row = document.createElement("div");
  row.className = "order-row";

  const brandSelect = document.createElement("select");
  brandSelect.className = "brand-select";
  brandSelect.innerHTML = `<option value="">Select Brand</option>`;
  brands.forEach((b) => {
    brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
  });

  const productSelect = document.createElement("select");
  productSelect.className = "product-select";
  productSelect.innerHTML = `<option value="">Select Product</option>`;

  const quantityInput = document.createElement("input");
  quantityInput.className = "quantity-input";
  quantityInput.type = "number";
  quantityInput.min = 1;
  quantityInput.value = 1;

  const deleteBtn = document.createElement("i");
  deleteBtn.className = "material-icons";
  deleteBtn.style = "font-size:33px;color:red;cursor:pointer;";
  deleteBtn.textContent = "cancel";
  deleteBtn.onclick = () => {
    row.remove();
    debouncePreviewUpdate();
    updateTotals();
  };

  row.appendChild(brandSelect);
  row.appendChild(productSelect);
  row.appendChild(quantityInput);
  row.appendChild(deleteBtn);
  const scrollTopBefore = window.scrollY;
  container.appendChild(row);
  window.scrollTo({ top: scrollTopBefore, behavior: "instant" });

  brandSelect.onchange = () => {
    productSelect.innerHTML = `<option value="">Select Product</option>`;
    const filteredProducts = products.filter(
      (p) => p.brand === brandSelect.value
    );
    filteredProducts.forEach((p) => {
      productSelect.innerHTML += `<option value="${p.product_id}" data-price="${p.price}">${p.product_name}</option>`;
    });
    debouncePreviewUpdate();
    updateTotals();
  };

  // 🔸 Update the preview clearly whenever product or quantity changes
  productSelect.onchange = () => {
    debouncePreviewUpdate();
    updateTotals();
  };

  quantityInput.oninput = () => {
    debouncePreviewUpdate();
    updateTotals();
  };
}

function addCombinedRow(container, brands) {
  const row = document.createElement("div");
  row.classList.add("order-row");

  const brandSelect = document.createElement("select");
  brandSelect.className = "brand-select";
  brandSelect.innerHTML = `<option value="">Select Brand</option>`;
  brands.forEach((b) => {
    brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
  });

  const categorySelect = document.createElement("select");
  categorySelect.className = "category-select";
  categorySelect.innerHTML = `<option value="">Select Category</option>`;

  const quantityInput = document.createElement("input");
  quantityInput.className = "quantity-input";
  quantityInput.type = "number";
  quantityInput.value = 1;
  quantityInput.min = 1;

  const deleteBtn = document.createElement("i");
  deleteBtn.className = "material-icons";
  deleteBtn.style = "font-size:33px;color:red;cursor:pointer;";
  deleteBtn.textContent = "cancel";
  deleteBtn.onclick = () => {
    row.remove();
    debouncePreviewUpdate();
    updateTotals();
  };

  row.appendChild(brandSelect);
  row.appendChild(categorySelect);
  row.appendChild(quantityInput);
  row.appendChild(deleteBtn);
  const scrollTopBefore = window.scrollY;
  container.appendChild(row);
  window.scrollTo({ top: scrollTopBefore, behavior: "instant" });

  // Function to clearly update categories based on brand selection
  const updateCategories = async () => {
    const selectedBrand = brandSelect.value;

    // Endpoint changes depending on if brand is selected
    const url = selectedBrand
      ? `http://localhost:5000/products/categories?brand=${encodeURIComponent(
          selectedBrand
        )}`
      : `http://localhost:5000/products/categories`;

    categorySelect.innerHTML = `<option value="">Loading categories...</option>`;

    try {
      const categories = await fetchList(url, "categories");

      categorySelect.innerHTML = `<option value="">Select Category</option>`;
      categories.forEach((category) => {
        categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
      });
    } catch (err) {
      categorySelect.innerHTML = `<option value="">Failed to load categories</option>`;
      console.error("Error loading categories:", err);
    }

    // After categories update, reset totals and preview
    onChange();
  };

  // Update totals and preview clearly
  const onChange = async () => {
    const brand = brandSelect.value;
    const category = categorySelect.value;
    const qty = parseInt(quantityInput.value) || 0;

    if ((!brand && !category) || qty < 1) {
      delete row.dataset.totalItems;
      delete row.dataset.totalPrice;
      debouncePreviewUpdate();
      updateTotals();

      return;
    }

    const queryParts = [];
    if (brand) queryParts.push(`brand=${encodeURIComponent(brand)}`);
    if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
    const query = queryParts.join("&");

    const res = await fetch(`http://localhost:5000/products?${query}`);
    if (!res.ok) return;

    const json = await res.json();
    const selectedProducts = json.data || [];

    row.dataset.totalItems = qty * selectedProducts.length;
    row.dataset.totalPrice = selectedProducts.reduce(
      (acc, p) => acc + qty * parseFloat(p.price || 0),
      0
    );

    updateTotals();
    debouncePreviewUpdate();
  };

  // Event listeners clearly defined
  brandSelect.addEventListener("change", updateCategories);
  categorySelect.addEventListener("change", onChange);
  quantityInput.addEventListener("input", onChange);

  // Initially populate categories clearly
  updateCategories();
}

function updateTotals() {
  let totalItems = 0;
  let totalPrice = 0;

  document.querySelectorAll(".order-row").forEach((row) => {
    if (row.dataset.totalItems && row.dataset.totalPrice) {
      totalItems += parseInt(row.dataset.totalItems);
      totalPrice += parseFloat(row.dataset.totalPrice);
    } else {
      const qty = parseInt(row.querySelector(".quantity-input")?.value) || 0;
      const price =
        parseFloat(
          row.querySelector(".product-select")?.selectedOptions[0]?.dataset
            ?.price || 0
        ) || 0;
      totalItems += qty;
      totalPrice += qty * price;
    }
  });

  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-price").textContent = totalPrice.toFixed(2);
}
async function updateOrderPreview() {
  const previewBody = document.getElementById("order-preview-body");
  const loader = document.getElementById("preview-loader");

  // Show loader and clear table
  loader.style.display = "block";
  previewBody.innerHTML = "";

  const token = localStorage.getItem("access_token");
  const productQuantities = new Map();

  // Collect from Detailed Order
  document
    .querySelectorAll("#detailed-order-rows .order-row")
    .forEach((row) => {
      const productId = row.querySelector(".product-select")?.value;
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");
      if (productId && qty > 0) {
        const key = String(productId);
        productQuantities.set(key, (productQuantities.get(key) || 0) + qty);
      }
    });

  // Collect from Combined Order
  const combinedRows = document.querySelectorAll(
    "#combined-order-rows .order-row"
  );
  for (const row of combinedRows) {
    const brand = row.querySelector(".brand-select")?.value;
    const category = row.querySelector(".category-select")?.value;
    const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");
    if ((!brand && !category) || qty <= 0) continue;

    const query = [
      brand ? `brand=${encodeURIComponent(brand)}` : "",
      category ? `category=${encodeURIComponent(category)}` : "",
    ]
      .filter(Boolean)
      .join("&");

    const res = await fetch(`http://localhost:5000/products?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;

    const data = await res.json();
    (data.data || []).forEach((p) => {
      const key = String(p.product_id);
      productQuantities.set(key, (productQuantities.get(key) || 0) + qty);
    });
  }

  // Show "no items" if empty
  if (productQuantities.size === 0) {
    previewBody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:10px;">No items selected</td></tr>`;
    loader.style.display = "none";
    return;
  }

  // Render merged preview
  for (const [productId, quantity] of productQuantities.entries()) {
    const res = await fetch(`http://localhost:5000/product/find/${productId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;

    const result = await res.json();
    const data = result.data;

    const name = data.product_name || "Unnamed Product";
    const price = parseFloat(data.price || 0).toFixed(2);
    const total = (price * quantity).toFixed(2);
    const photoUrl = data.image_path
      ? `http://localhost:5000/images/${data.image_path}`
      : "";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${
        photoUrl
          ? `<img src="${photoUrl}" alt="${name}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;">`
          : "<span>No Photo</span>"
      }</td>
      <td style="align-items:center; gap:8px;">${name}</td>
      <td style="text-align:center;">${quantity}</td>
      <td style="text-align:right;">EGP ${price}</td>
      <td style="text-align:right;">EGP ${total}</td>
    `;
    previewBody.appendChild(row);
  }

  // Hide loader when done
  loader.style.display = "none";
}

document.getElementById("submit-order").addEventListener("click", async () => {
  const token = localStorage.getItem("access_token");

  const customerId = document.getElementById("customer-select").value;
  const addressId = document.getElementById("address-select").value;

  if (!customerId || !addressId) {
    alert("Please select both a customer and an address.");
    return;
  }

  const products = [];

  // 🔹 Collect products from Detailed Order
  document
    .querySelectorAll("#detailed-order-rows .order-row")
    .forEach((row) => {
      const productId = row.querySelector(".product-select")?.value;
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");
      if (productId && qty > 0) {
        products.push({ product_id: parseInt(productId), quantity: qty });
      }
    });

  // 🔹 Collect products from Combined Order
  const combinedRows = document.querySelectorAll(
    "#combined-order-rows .order-row"
  );
  for (const row of combinedRows) {
    const brand = row.querySelector(".brand-select")?.value;
    const category = row.querySelector(".product-select")?.value;
    const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");

    if ((!brand && !category) || qty <= 0) continue;

    const queryParts = [];
    if (brand) queryParts.push(`brand=${encodeURIComponent(brand)}`);
    if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
    const query = queryParts.join("&");

    const res = await fetch(`http://localhost:5000/products?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      const matched = data.data || [];
      matched.forEach((product) => {
        products.push({ product_id: product.product_id, quantity: qty });
      });
    }
  }

  if (products.length === 0) {
    alert("Please add at least one product to the order.");
    return;
  }

  const payload = {
    customer_id: parseInt(customerId),
    address_id: parseInt(addressId),
    products,
  };

  try {
    const res = await fetch("http://localhost:5000/orders/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (res.ok) {
      alert("✅ Order created successfully!");
      window.location.href = "view-order.html?order_id=" + result.created_order;
    } else {
      alert(`❌ Error: ${result.message || "Order failed."}`);
    }
  } catch (err) {
    console.error("Order submission error:", err);
    alert("❌ Something went wrong while submitting the order.");
  }
});

let previewTimeout;
function debouncePreviewUpdate(delay = 2000) {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => {
    updateOrderPreview();
  }, delay);
}
