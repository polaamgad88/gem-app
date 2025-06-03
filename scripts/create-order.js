document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  // Set up event listeners
  setupEventListeners(token);

  // Initialize form elements
  document.getElementById("order-date").valueAsDate = new Date();

  // Load initial data
  try {
    Utils.UI.showLoader("loader");

    // Fetch all required data in parallel
    const [brands, categories, products, customers] = await Promise.all([
      fetchList(
        "https://order-app.gemegypt.net/api/products/brands/orders",
        "brands",
        token
      ),
      fetchList(
        "https://order-app.gemegypt.net/api/products/categories/orders",
        "categories",
        token
      ),
      fetchList("https://order-app.gemegypt.net/api/products/orders", "data", token),
      fetchList("https://order-app.gemegypt.net/api/customers?all=true", "customers", token),
    ]);

    populateCustomerDropdown(customers);

    // Set up add row buttons
    setupAddRowButtons(brands, categories, products);

    Utils.UI.hideLoader("loader");
  } catch (err) {
    console.error("Error loading initial data:", err);
    Utils.UI.hideLoader("loader");
    Utils.UI.showError("Failed to load initial data. Please refresh the page.");
  }
});

// Helper function to fetch lists from API
async function fetchList(url, key, token) {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    if (key === "data") {
      return json[key] || [];
    }
    return json[key] || [];
  } catch (err) {
    console.error("Fetch error:", err);
    return [];
  }
}

let allCustomers = [];

function populateCustomerDropdown(customers) {
  allCustomers = customers.sort((a, b) => {
    const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
    const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const searchInput = document.getElementById("customer-search");
  const suggestions = document.getElementById("customer-suggestions");
  const hiddenSelect = document.getElementById("customer-select");

  function renderSuggestions(filtered) {
    suggestions.innerHTML = "";
    filtered.forEach((cust) => {
      const li = document.createElement("li");
      li.textContent = `${cust.first_name} ${cust.last_name}`;
      li.dataset.customerId = cust.customer_id;
      suggestions.appendChild(li);
    });
    suggestions.style.display = filtered.length ? "block" : "none";
  }

  searchInput.addEventListener("input", () => {
    const value = searchInput.value.toLowerCase();
    const matches = value
      ? allCustomers.filter((cust) =>
          `${cust.first_name} ${cust.last_name}`.toLowerCase().includes(value)
        )
      : allCustomers;

    renderSuggestions(matches);
  });

  // Show all on focus
  searchInput.addEventListener("focus", () => {
    renderSuggestions(allCustomers);
  });

  suggestions.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      const selectedId = e.target.dataset.customerId;
      const selectedText = e.target.textContent;
      searchInput.value = selectedText;
      hiddenSelect.innerHTML = `<option value="${selectedId}" selected>${selectedText}</option>`;
      suggestions.style.display = "none";
      hiddenSelect.dispatchEvent(new Event("change"));
    }
  });

  document.addEventListener("click", (e) => {
    if (!document.querySelector(".custom-customer-select").contains(e.target)) {
      suggestions.style.display = "none";
    }
  });
}

// Helper function to set up event listeners
function setupEventListeners(token) {
  // Customer select change event
  document
    .getElementById("customer-select")
    .addEventListener("change", async (e) => {
      const id = e.target.value;
      const addressSelect = document.getElementById("address-select");
      addressSelect.innerHTML = `<option value="">Select Address</option>`;

      if (!id) return;

      try {
        Utils.UI.showLoader("loader");
        const res = await fetch(
          `https://order-app.gemegypt.net/api/customers/${id}/addresses`,
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
        Utils.UI.hideLoader("loader");
      } catch (err) {
        console.error("Error fetching addresses:", err);
        Utils.UI.hideLoader("loader");
        Utils.UI.showError("Failed to load addresses.");
      }
    });

  // Submit order button
  document
    .getElementById("submit-order")
    .addEventListener("click", async () => {
      await submitOrder(token);
    });
}

// Helper function to set up add row buttons
function setupAddRowButtons(brands, categoryOptions, productOptions) {
  document.querySelectorAll(".add-row-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      const containerId =
        type === "combined" ? "combined-order-rows" : "detailed-order-rows";
      const container = document.getElementById(containerId);

      if (type === "combined") {
        addCombinedRow(container, brands, categoryOptions);
      } else {
        addOrderRow(container, brands, productOptions);
      }
    });
  });
}

function addOrderRow(container, brands, products) {
  const row = document.createElement("div");
  row.className = "order-row";

  const scrollable = document.querySelector(".order-rows-scrollable-detailed");
  if (scrollable) {
    scrollable.style.display = "block";
  }

  const brandSelect = document.createElement("select");
  brandSelect.className = "brand-select";
  brandSelect.innerHTML = `<option value="">Select Brand</option>`;
  brands.forEach((b) => {
    brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
  });

  const categorySelect = document.createElement("select");
  categorySelect.className = "category-select";
  categorySelect.innerHTML = `<option value="">Select Category</option>`;

  const barcodeInput = document.createElement("input");
  barcodeInput.className = "barcode-input";
  barcodeInput.type = "text";
  barcodeInput.placeholder = "Search by barcode...";

  const barcodeSuggestions = document.createElement("ul");
  barcodeSuggestions.className = "barcode-suggestions dropdown-list";
  barcodeSuggestions.style.display = "none";

  const nameInput = document.createElement("input");
  nameInput.className = "barcode-input";
  nameInput.type = "text";
  nameInput.placeholder = "Search by name...";

  const nameSuggestions = document.createElement("ul");
  nameSuggestions.className = "barcode-suggestions dropdown-list";
  nameSuggestions.style.display = "none";

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
  row.appendChild(categorySelect);
  row.appendChild(barcodeInput);
  row.appendChild(barcodeSuggestions);
  row.appendChild(nameInput);
  row.appendChild(nameSuggestions);
  row.appendChild(quantityInput);
  row.appendChild(deleteBtn);
  container.appendChild(row);

  function lockFields(selectedProduct) {
    const lockedRow = document.createElement("div");
    lockedRow.className = "order-row";

    const quantityInputLocked = document.createElement("input");
    quantityInputLocked.className = "quantity-input";
    quantityInputLocked.type = "number";
    quantityInputLocked.min = 1;
    quantityInputLocked.value = quantityInput.value;

    // 🔧 FIX: trigger preview and totals when qty changes
    quantityInputLocked.addEventListener("input", () => {
      debouncePreviewUpdate();
      updateTotals();
    });

    const deleteBtnLocked = document.createElement("i");
    deleteBtnLocked.className = "material-icons";
    deleteBtnLocked.style = "font-size:33px;color:red;cursor:pointer;";
    deleteBtnLocked.textContent = "cancel";
    deleteBtnLocked.onclick = () => {
      lockedRow.remove();
      debouncePreviewUpdate();
      updateTotals();
    };

    const productInfoWrapper = document.createElement("div");
    productInfoWrapper.className = "locked-product-wrapper";

    const lockedProductText = document.createElement("div");
    lockedProductText.className = "locked-product-name";
    lockedProductText.textContent = selectedProduct.product_name;

    const quantityWrapper = document.createElement("div");
    quantityWrapper.className = "quantity-wrapper";
    quantityWrapper.appendChild(quantityInputLocked);

    const deleteWrapper = document.createElement("div");
    deleteWrapper.className = "delete-wrapper";
    deleteWrapper.appendChild(deleteBtnLocked);

    productInfoWrapper.appendChild(lockedProductText);
    productInfoWrapper.appendChild(quantityWrapper);
    productInfoWrapper.appendChild(deleteWrapper);

    lockedRow.appendChild(productInfoWrapper);
    lockedRow.dataset.productId = selectedProduct.product_id;
    lockedRow.dataset.productPrice = selectedProduct.price;

    container.insertBefore(lockedRow, row);

    debouncePreviewUpdate();
    updateTotals();
  }

  barcodeInput.addEventListener("input", async () => {
    const query = barcodeInput.value.trim();
    barcodeSuggestions.innerHTML = "";
    if (!query) return;

    const token = localStorage.getItem("access_token");
    const selectedBrand = brandSelect.value;
    const selectedCategory = categorySelect.value;

    const params = new URLSearchParams();
    params.append("barcode", query);
    if (selectedBrand) params.append("brand", selectedBrand);
    if (selectedCategory) params.append("category", selectedCategory);

    try {
      const res = await fetch(
        `https://order-app.gemegypt.net/api/product/order/search_by_barcode?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) return;

      const data = await res.json();
      const matches = data.data || [];

      matches.forEach((product) => {
        const li = document.createElement("li");
        li.textContent = `${product.product_name} (${product.bar_code})`;
        li.dataset.productId = product.product_id;
        barcodeSuggestions.appendChild(li);
      });

      barcodeSuggestions.style.display = matches.length ? "block" : "none";
    } catch (err) {
      console.error("Barcode search failed:", err);
    }
  });

  // Barcode selection
  barcodeSuggestions.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      const productId = e.target.dataset.productId;
      const selectedProduct = products.find((p) => p.product_id == productId);
      if (selectedProduct) {
        lockFields(selectedProduct);
      }
      barcodeSuggestions.style.display = "none";
    }
  });

  // Name search
  nameInput.addEventListener("input", () => {
    const value = nameInput.value.trim().toLowerCase();
    nameSuggestions.innerHTML = "";

    const brand = brandSelect.value;
    const category = categorySelect.value;

    const filtered = products.filter((p) => {
      return (
        (!brand || p.brand === brand) &&
        (!category || p.category === category) &&
        p.product_name.toLowerCase().includes(value)
      );
    });

    filtered.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.product_name} (${p.bar_code})`;
      li.dataset.productId = p.product_id;
      nameSuggestions.appendChild(li);
    });

    nameSuggestions.style.display = filtered.length ? "block" : "none";
  });

  nameInput.addEventListener("focus", () => {
    const brand = brandSelect.value;
    const category = categorySelect.value;

    const filtered = products.filter((p) => {
      return (
        (!brand || p.brand === brand) && (!category || p.category === category)
      );
    });

    nameSuggestions.innerHTML = "";
    filtered.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.product_name} (${p.bar_code})`;
      li.dataset.productId = p.product_id;
      nameSuggestions.appendChild(li);
    });

    nameSuggestions.style.display = filtered.length ? "block" : "none";
  });

  nameSuggestions.addEventListener("click", (e) => {
    if (e.target.tagName === "LI") {
      const productId = e.target.dataset.productId;
      const selectedProduct = products.find((p) => p.product_id == productId);
      if (selectedProduct) {
        lockFields(selectedProduct);
      }
      nameSuggestions.style.display = "none";
    }
  });

  document.addEventListener("click", (e) => {
    if (!row.contains(e.target)) {
      barcodeSuggestions.style.display = "none";
      nameSuggestions.style.display = "none";
    }
  });

  // Load categories when brand changes
  brandSelect.onchange = async () => {
    categorySelect.innerHTML = `<option value="">Select Category</option>`;
    const token = localStorage.getItem("access_token");
    const selectedBrand = brandSelect.value;

    if (!selectedBrand) return;

    try {
      const res = await fetch(
        `https://order-app.gemegypt.net/api/products/categories/orders?brand=${encodeURIComponent(
          selectedBrand
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      const categories = data.categories || [];
      categories.forEach((cat) => {
        categorySelect.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    } catch (err) {
      console.error("Category loading failed:", err);
    }
  };

  quantityInput.oninput = () => {
    debouncePreviewUpdate();
    updateTotals();
  };
}

function addCombinedRow(container, brands) {
  const row = document.createElement("div");
  row.classList.add("order-row");
  const scrollable = document.querySelector(".order-rows-scrollable-combined");

  if (scrollable) {
    scrollable.style.display = "block";
  }
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
  quantityInput.required = true;
  quantityInput.placeholder = "";

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

  const updateCategories = async () => {
    const selectedBrand = brandSelect.value;
    const token = localStorage.getItem("access_token");

    const url = selectedBrand
      ? `https://order-app.gemegypt.net/api/products/categories/orders?brand=${encodeURIComponent(
          selectedBrand
        )}`
      : `https://order-app.gemegypt.net/api/products/categories/orders`;

    categorySelect.innerHTML = `<option value="">Loading categories...</option>`;

    try {
      const categories = await fetchList(url, "categories", token);

      categorySelect.innerHTML = `<option value="">Select Category</option>`;
      categories.forEach((category) => {
        categorySelect.innerHTML += `<option value="${category}">${category}</option>`;
      });
    } catch (err) {
      categorySelect.innerHTML = `<option value="">Failed to load categories</option>`;
      console.error("Error loading categories:", err);
    }

    onChange();
    brandSelect.addEventListener("change", updateCategories);
    categorySelect.addEventListener("change", onChange);
    quantityInput.addEventListener("input", onChange);
  };

  const onChange = async () => {
    const brand = brandSelect.value;
    const category = categorySelect.value;
    const qty = parseInt(quantityInput.value) || 0;
    const token = localStorage.getItem("access_token");

    if ((!brand && !category) || qty < 1) {
      delete row.dataset.totalItems;
      delete row.dataset.totalPrice;
      updateTotals();
      debouncePreviewUpdate();
      return;
    }

    const queryParts = [];
    if (brand) queryParts.push(`brand=${encodeURIComponent(brand)}`);
    if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
    const query = queryParts.join("&");

    try {
      const res = await fetch(
        `https://order-app.gemegypt.net/api/products/orders?${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) return;

      const json = await res.json();
      const selectedProducts = json.data || [];

      const totalItems = qty * selectedProducts.length;
      const totalPrice = selectedProducts.reduce(
        (acc, p) => acc + qty * parseFloat(p.price || 0),
        0
      );

      row.dataset.totalItems = totalItems;
      row.dataset.totalPrice = totalPrice;

      updateTotals();
      debouncePreviewUpdate();
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  brandSelect.addEventListener("change", updateCategories);
  categorySelect.addEventListener("change", onChange);
  quantityInput.addEventListener("input", onChange);

  updateCategories();
}
function updateTotals() {
  let totalItems = 0;
  let totalPrice = 0;

  document
    .querySelectorAll("#detailed-order-rows .order-row")
    .forEach((row) => {
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");
      const price =
        parseFloat(row.dataset.productPrice) ||
        parseFloat(
          row.querySelector(".product-select")?.selectedOptions[0]?.dataset
            ?.price || 0
        ) ||
        0;

      if (qty > 0 && price > 0) {
        totalItems += qty;
        totalPrice += qty * price;
      }
    });

  document
    .querySelectorAll("#combined-order-rows .order-row")
    .forEach((row) => {
      const items = parseInt(row.dataset.totalItems || "0");
      const price = parseFloat(row.dataset.totalPrice || "0");

      if (items > 0 && price > 0) {
        totalItems += items;
        totalPrice += price;
      }
    });

  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-price").textContent = totalPrice.toFixed(2);
}

let previewTimeout;
function debouncePreviewUpdate(delay = 1000) {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(updateOrderPreview, delay);
}

async function updateOrderPreview() {
  const previewBody = document.getElementById("order-preview-body");
  const loader = document.getElementById("preview-loader");
  const token = localStorage.getItem("access_token");

  loader.style.display = "block";
  previewBody.innerHTML = "";

  const productQuantities = new Map();

  document
    .querySelectorAll("#detailed-order-rows .order-row")
    .forEach((row) => {
      const productId = row.dataset.productId;
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");
      if (productId && qty > 0) {
        const key = String(productId);
        productQuantities.set(key, (productQuantities.get(key) || 0) + qty);
      }
    });

  document
    .querySelectorAll("#combined-order-rows .order-row")
    .forEach((row) => {
      const brand = row.querySelector(".brand-select")?.value || "-";
      const category = row.querySelector(".category-select")?.value || "-";
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");

      if ((!brand && !category) || qty <= 0) return;

      const totalItems = parseInt(row.dataset.totalItems || "0");
      const totalPrice = parseFloat(row.dataset.totalPrice || "0");

      const summaryCard = document.createElement("div");
      summaryCard.className = "preview-card preview-summary";
      summaryCard.innerHTML = `
        <div class="card-content">
          <div><strong>Brand:</strong> ${brand}</div>
          <div><strong>Category:</strong> ${category}</div>
          <div><strong>Quantity per Product:</strong> ${qty}</div>
          <div><strong>Total Products:</strong> ${totalItems}</div>
          <div><strong>Total Price:</strong> EGP ${totalPrice.toFixed(2)}</div>
        </div>
      `;
      previewBody.appendChild(summaryCard);
    });

  if (
    productQuantities.size === 0 &&
    !document.querySelector("#combined-order-rows .order-row")
  ) {
    previewBody.innerHTML += `<div style="text-align:center; padding:10px;">No items selected</div>`;
    loader.style.display = "none";
    return;
  }

  try {
    for (const [productId, quantity] of productQuantities.entries()) {
      const res = await fetch(
        `https://order-app.gemegypt.net/api/product/order/find/${productId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) continue;

      const result = await res.json();
      const data = result.data;
      if (!data) continue;

      const name = data.product_name || "Unnamed Product";
      const price = parseFloat(data.price || 0).toFixed(2);
      const total = (price * quantity).toFixed(2);
      const photoUrl = data.image_path
        ? `https://order-app.gemegypt.net/api/images/${data.image_path.replace(/^\/+/, "")}`
        : "";
      const bar_code = data.bar_code;
      const card = document.createElement("div");
      card.className = "preview-card";
      card.innerHTML = `
        ${
          photoUrl
            ? `<img src="${photoUrl}" alt="${name}" />`
            : `<div style="width:60px; height:60px; background-color:#eee; border-radius:4px; display:flex; align-items:center; justify-content:center;">No Photo</div>`
        }
        <div class="card-content">
          <div class="product-name">${name} - (${bar_code})</div>
          <div class="product-detail"><strong>Qty:</strong> ${quantity}</div>
          <div class="product-detail"><strong>Unit Price:</strong> EGP ${price}</div>
          <div class="product-detail"><strong>Total:</strong> EGP ${total}</div>
        </div>
      `;
      previewBody.appendChild(card);
    }
  } catch (err) {
    console.error("Error rendering product preview:", err);
    previewBody.innerHTML = `<div style="text-align:center; padding:10px;">Error loading preview</div>`;
  }

  loader.style.display = "none";
}

async function submitOrder(token) {
  const customerId = document.getElementById("customer-select").value;
  const addressId = document.getElementById("address-select").value;

  if (!customerId || !addressId) {
    alert("Please select both a customer and an address.");
    return;
  }

  const products = [];

  document
    .querySelectorAll("#detailed-order-rows .order-row")
    .forEach((row) => {
      const productId =
        row.dataset.productId || row.querySelector(".product-select")?.value;
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");
      if (productId && qty > 0) {
        products.push({ product_id: parseInt(productId), quantity: qty });
      }
    });

  try {
    const combinedRows = document.querySelectorAll(
      "#combined-order-rows .order-row"
    );
    for (const row of combinedRows) {
      const brand = row.querySelector(".brand-select")?.value;
      const category = row.querySelector(".category-select")?.value;
      const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");

      if ((!brand && !category) || qty <= 0) continue;

      const queryParts = [];
      if (brand) queryParts.push(`brand=${encodeURIComponent(brand)}`);
      if (category) queryParts.push(`category=${encodeURIComponent(category)}`);
      const query = queryParts.join("&");

      const res = await fetch(
        `https://order-app.gemegypt.net/api/products/orders?${query}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (res.ok) {
        const data = await res.json();
        const matched = data.data || [];
        matched.forEach((product) => {
          products.push({ product_id: product.product_id, quantity: qty });
        });
      }
    }
  } catch (err) {
    console.error("Error collecting combined order products:", err);
  }

  console.log(products);
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
    Utils.UI.showLoader("loader");

    const res = await fetch("https://order-app.gemegypt.net/api/orders/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    Utils.UI.hideLoader("loader");

    if (res.ok) {
      const result = await res.json();
      alert("✅ Order created successfully!");
      window.location.href = `view-order.html?order_id=${result.order_id}`;
    } else {
      const data = await res.json();
      alert(`❌ Failed to create order: ${data.message || "Unknown error"}`);
    }
  } catch (err) {
    Utils.UI.hideLoader("loader");
    console.error("Error saving order:", err);
    alert("❌ An error occurred while creating the order. Please try again.");
  }
}

// Add a function to toggle tabs if not already defined
if (typeof window.toggleTab !== "function") {
  window.toggleTab = function (id) {
    const content = document.getElementById(id);
    const arrow = content.previousElementSibling.querySelector(".arrow");
    const isVisible = content.style.display === "block";
    content.style.display = isVisible ? "none" : "block";
    arrow.textContent = isVisible ? "▼" : "▲";
  };
}
