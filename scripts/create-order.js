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
      fetchList("https://order-app.gemegypt.net/api/customers", "customers", token),
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

// Helper function to add a detailed order row
function addOrderRow(container, brands, products) {
  const row = document.createElement("div");

  row.className = "order-row";
  const scrollable = document.querySelector(".order-rows-scrollable-detailed");
  if (scrollable) {
    scrollable.style.display = "block";
  }
  const barcodeInput = document.createElement("input");
  barcodeInput.className = "barcode-input";
  barcodeInput.type = "number";
  barcodeInput.placeholder = "Search by barcode...";

  const brandSelect = document.createElement("select");
  brandSelect.className = "brand-select";
  brandSelect.innerHTML = `<option value="">Select Brand</option>`;
  brands.forEach((b) => {
    brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
  });

  const categorySelect = document.createElement("select");
  categorySelect.className = "category-select";
  categorySelect.innerHTML = `<option value="">Select Category</option>`;

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
  row.appendChild(barcodeInput);
  row.appendChild(categorySelect);
  row.appendChild(productSelect);
  row.appendChild(quantityInput);
  row.appendChild(deleteBtn);

  const scrollTopBefore = window.scrollY;
  container.appendChild(row);
  window.scrollTo({ top: scrollTopBefore, behavior: "instant" });

  // Helper: Lock fields after product selection
  function lockFields(selectedProduct) {
    brandSelect.style.display = "none";
    barcodeInput.style.display = "none";
    categorySelect.style.display = "none";
    productSelect.style.display = "none";
    brandSelect.disabled = true;
    barcodeInput.disabled = true;
    categorySelect.disabled = true;
    productSelect.disabled = true;

    const productInfoWrapper = document.createElement("div");
    productInfoWrapper.className = "locked-product-wrapper";

    const lockedProductText = document.createElement("div");
    lockedProductText.className = "locked-product-name";
    lockedProductText.textContent = selectedProduct.product_name;

    const quantityWrapper = document.createElement("div");
    quantityWrapper.className = "quantity-wrapper";
    quantityWrapper.appendChild(quantityInput); // Your existing quantity input

    productInfoWrapper.appendChild(lockedProductText);
    productInfoWrapper.appendChild(quantityWrapper);

    // Create delete button container inline
    const deleteWrapper = document.createElement("div");
    deleteWrapper.className = "delete-wrapper";
    deleteWrapper.appendChild(deleteBtn);

    productInfoWrapper.appendChild(deleteWrapper);
    productSelect.replaceWith(productInfoWrapper);
    productSelect.replaceWith(productInfoWrapper);
    row.dataset.productId = selectedProduct.product_id;
    row.dataset.productPrice = selectedProduct.price;

    debouncePreviewUpdate();
    updateTotals();
  }

  // Barcode search logic
  barcodeInput.addEventListener("input", async () => {
    const barcode = barcodeInput.value.trim();
    if (!barcode) return;

    const token = localStorage.getItem("access_token");

    try {
      const res = await fetch(
        `https://order-app.gemegypt.net/api/product/order/search_by_barcode?barcode=${encodeURIComponent(
          barcode
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) return;

      const data = await res.json();
      const productsFound = data.data || [];
      console.log(productsFound);
      if (productsFound.length === 1) {
        lockFields(productsFound[0]); // ✅ Lock if one match
      }
    } catch (err) {
      console.error("Barcode search failed:", err);
    }
  });

  // Brand change — populate categories
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

  // Category change — populate products
  categorySelect.onchange = () => {
    productSelect.innerHTML = `<option value="">Select Product</option>`;
    const selectedBrand = brandSelect.value;
    const selectedCategory = categorySelect.value;

    const filteredProducts = products.filter(
      (p) => p.brand === selectedBrand && p.category === selectedCategory
    );
    filteredProducts.forEach((p) => {
      productSelect.innerHTML += `<option value="${p.product_id}" data-price="${p.price}">${p.product_name}</option>`;
    });
    debouncePreviewUpdate();
    updateTotals();
  };

  // Product manual select logic
  productSelect.onchange = () => {
    const selectedId = productSelect.value;
    if (selectedId) {
      const selectedProduct = products.find((p) => p.product_id == selectedId);
      if (selectedProduct) {
        lockFields(selectedProduct); // ✅ Lock after manual selection
      }
    }
  };

  // Quantity event
  quantityInput.oninput = () => {
    debouncePreviewUpdate();
    updateTotals();
  };
}

// Helper function to add a combined order row
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

  // Preserve scroll position
  const scrollTopBefore = window.scrollY;
  container.appendChild(row);
  window.scrollTo({ top: scrollTopBefore, behavior: "instant" });

  // Function to update categories based on brand selection
  const updateCategories = async () => {
    const selectedBrand = brandSelect.value;
    const token = localStorage.getItem("access_token");

    // Endpoint changes depending on if brand is selected
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

    // After categories update, reset totals and preview
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

  // Event listeners
  brandSelect.addEventListener("change", updateCategories);
  categorySelect.addEventListener("change", onChange);
  quantityInput.addEventListener("input", onChange);

  // Initially populate categories
  updateCategories();
}
function updateTotals() {
  let totalItems = 0;
  let totalPrice = 0;

  // 1. Detailed rows
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

  // 2. Combined rows
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

  // Display totals
  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-price").textContent = totalPrice.toFixed(2);
}

// Debounce function for preview updates
let previewTimeout;
function debouncePreviewUpdate(delay = 1000) {
  // Reduced delay for faster preview updates
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

  // Detailed Order rows — show individual product cards
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

  // Combined Order rows — create summary card only
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

  // If no detailed products, show message
  if (
    productQuantities.size === 0 &&
    !document.querySelector("#combined-order-rows .order-row")
  ) {
    previewBody.innerHTML += `<div style="text-align:center; padding:10px;">No items selected</div>`;
    loader.style.display = "none";
    return;
  }

  // Render product preview cards for detailed rows only
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

      const card = document.createElement("div");
      card.className = "preview-card";
      card.innerHTML = `
        ${
          photoUrl
            ? `<img src="${photoUrl}" alt="${name}" />`
            : `<div style="width:60px; height:60px; background-color:#eee; border-radius:4px; display:flex; align-items:center; justify-content:center;">No Photo</div>`
        }
        <div class="card-content">
          <div class="product-name">${name}</div>
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

// Helper function to submit the order
async function submitOrder(token) {
  const customerId = document.getElementById("customer-select").value;
  const addressId = document.getElementById("address-select").value;

  if (!customerId || !addressId) {
    alert("Please select both a customer and an address.");
    return;
  }

  const products = [];

  // Collect products from Detailed Order
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
