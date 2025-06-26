document.addEventListener("DOMContentLoaded", async function () {
  // Get order ID from URL
  const orderId = Utils.URL.getParam("order_id");
  if (!orderId) {
    alert("No order ID specified in the URL.");
    window.location.href = "orders.html";
    return;
  }

  // Check authentication
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  // Load order data
  try {
    Utils.UI.showLoader("loader");
    const order = await fetchOrderDetails(orderId, token);

    // Populate order information
    populateOrderInfo(order, token);

    // Populate editable items
    populateEditableItems(order, token);

    // Set up event listeners
    setupEventListeners(orderId, token);

    // Check screen size and toggle view if needed
    Utils.UI.checkScreenSize();
    window.addEventListener("resize", Utils.UI.checkScreenSize);

    Utils.UI.hideLoader("loader");
  } catch (err) {
    Utils.UI.hideLoader("loader");
    console.error("Error loading order:", err);
    alert("Failed to load order details. Please try again.");
  }
});

// Helper function to fetch order details
async function fetchOrderDetails(orderId, token) {
  const res = await fetch(`https://order-app.gemegypt.net/api/orders/find/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
    mode: "cors",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch order details");
  }

  return await res.json();
}

// Helper function to fetch customer addresses
async function fetchCustomerAddresses(customerId, token) {
  // Using the endpoint specified by the user
  const res = await fetch(
    `https://order-app.gemegypt.net/api/customers/${customerId}/addresses`,
    {
      headers: { Authorization: `Bearer ${token}` },
      mode: "cors",
      credentials: "include",
    }
  );

  if (!res.ok) {
    if (res.status === 404) {
      return { addresses: [] }; // Return empty array if no addresses found
    }
    throw new Error("Failed to fetch customer addresses");
  }

  return await res.json();
}

// Helper function to populate order information
async function populateOrderInfo(order, token) {
  document.getElementById("orderId").textContent = `#${order.order_id}`;
  document.getElementById("order-id").textContent = `#${order.order_id}`;
  document.getElementById("customer-note").textContent = order.note;
  document.getElementById("order-date").textContent = Utils.Format.date(
    order.order_date
  );

  const orderState = document.getElementById("order-state");
  orderState.textContent = order.status;
  orderState.className = `state ${order.status.toLowerCase()}`;

  document.getElementById("delegate-name").textContent = order.username;
  document.getElementById("customer-name").textContent = order.customer_name;
  document.getElementById(
    "customer-id"
  ).textContent = `CUST-${order.customer_id}`;

  // Fetch customer addresses and populate dropdown
  try {
    const addressSelect = document.getElementById("customer-address-select");
    addressSelect.innerHTML = '<option value="">Loading addresses...</option>';

    const addressData = await fetchCustomerAddresses(order.customer_id, token);
    // Handle both possible response formats (addresses array or direct array)
    const addresses = addressData.addresses || addressData || [];

    if (addresses.length === 0) {
      // If no addresses found, show the current address as text
      addressSelect.innerHTML = `<option value="">${
        order.address || "No address available"
      }</option>`;
      return;
    }

    // Populate dropdown with addresses
    addressSelect.innerHTML = "";
    addresses.forEach((addr) => {
      const option = document.createElement("option");
      option.value = addr.address_id;
      option.textContent = addr.address;

      // Select the current address if it matches
      if (addr.address === order.address) {
        option.selected = true;
      }

      addressSelect.appendChild(option);
    });

    // Store the customer ID in a data attribute for later use
    addressSelect.dataset.customerId = order.customer_id;
  } catch (err) {
    console.error("Error fetching customer addresses:", err);
    // Fallback to displaying the current address as text
    const addressSelect = document.getElementById("customer-address-select");
    addressSelect.innerHTML = `<option value="">${
      order.address || "No address available"
    }</option>`;
  }
}

function populateEditableItems(order, token) {
  const tableBody = document.getElementById("editable-items-body");
  const cardsContainer = document.getElementById("editable-items-cards");

  tableBody.innerHTML = "";
  cardsContainer.innerHTML = "";

  let total = 0;

  order.items.forEach((item) => {
    const productId = item.product_id;
    const price = parseFloat(item.price.toLocaleString());
    const quantity = parseInt(item.quantity);
    const itemTotal = price * quantity;
    total += itemTotal;

    const imageUrl = item.image_path
      ? `https://order-app.gemegypt.net/api/images/${item.image_path}`
      : "";

    // === Table Row ===
    const row = document.createElement("tr");
    row.dataset.productId = productId;
    row.dataset.price = price;
    row.innerHTML = `
      <td>
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${item.product_name}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`
            : "No image"
        }
      </td>
      <td>
        <div>${item.product_name}</div>
        <div style="font-size: 12px; color: #666;">${item.bar_code}</div>
      </td>

      <td>EGP ${price.toLocaleString()}</td>
      <td><input type="number" class="qty" value="${quantity}" min="1"></td>
      <td>EGP ${itemTotal.toLocaleString()}</td>
      <td><button class="remove-btn">Remove</button></td>
    `;
    tableBody.appendChild(row);

    // === Card View ===
    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.productId = productId;
    card.dataset.price = price;
    card.innerHTML = `
      <div class="item-card-header">
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${item.product_name}">`
            : "<div style='width:50px;height:50px;background:#eee;display:flex;align-items:center;justify-content:center;border-radius:4px;'>No img</div>"
        }
        <h3>${item.product_name}</h3>
      </div>
      <div class="item-card-body">
      <p><span class="item-card-label">Barcode:</span>  ${item.bar_code}</p>
        <p><span class="item-card-label">Price:</span> EGP ${price.toLocaleString()}</p>
        <p><span class="item-card-label">Quantity:</span> <input type="number" class="qty" value="${quantity}" min="1"></p>
        <p><span class="item-card-label">Total:</span> EGP ${itemTotal.toLocaleString()}</p>
      </div>
      <div class="item-card-footer">
        <button class="remove-btn">Remove</button>
      </div>
    `;
    cardsContainer.appendChild(card);

    // === Sync logic ===
    const rowQty = row.querySelector(".qty");
    const cardQty = card.querySelector(".qty");

    // Sync quantity between row and card
    const syncQty = (sourceInput, targetInput) => {
      targetInput.value = sourceInput.value;
      updateTotals();
    };

    rowQty.addEventListener("input", () => syncQty(rowQty, cardQty));
    cardQty.addEventListener("input", () => syncQty(cardQty, rowQty));

    // Sync removal from either view
    const removeBoth = () => {
      row.remove();
      card.remove();
      updateTotals();
    };

    row.querySelector(".remove-btn").addEventListener("click", removeBoth);
    card.querySelector(".remove-btn").addEventListener("click", removeBoth);
  });

  // Set initial total
  document.getElementById(
    "total-price"
  ).textContent = `EGP ${total.toLocaleString()}`;
}

// Helper function to update totals
function updateTotals() {
  let total = 0;

  // Calculate from table rows
  document.querySelectorAll("#editable-items-body tr").forEach((row) => {
    // Skip temporary rows
    if (row.classList.contains("temp-product-row")) return;

    const price = parseFloat(row.dataset.price);
    const qty = parseInt(row.querySelector(".qty").value);
    const itemTotal = price * qty;

    // Update item total cell
    row.cells[4].textContent = `EGP ${itemTotal.toLocaleString()}`;

    total += itemTotal;
  });

  // Update card totals
  document.querySelectorAll(".item-card").forEach((card) => {
    // Skip temporary cards
    if (card.classList.contains("temp-product-card")) return;

    const price = parseFloat(card.dataset.price);
    const qty = parseInt(card.querySelector(".qty").value);
    const itemTotal = price * qty;

    // Update item total in card
    const totalElement = card.querySelector(".item-card-body p:last-child");
    if (totalElement) {
      totalElement.innerHTML = `<span class="item-card-label">Total:</span> EGP ${itemTotal.toFixed(
        2
      )}`;
    }
  });

  // Update total price
  document.getElementById(
    "total-price"
  ).textContent = `EGP ${total.toLocaleString()}`;
}

// Helper function to set up event listeners
function setupEventListeners(orderId, token) {
  // Add product button
  document
    .getElementById("add-product-btn")
    .addEventListener("click", async () => {
      try {
        // Fetch brands first for the dropdown
        const brandsResponse = await fetch(
          "https://order-app.gemegypt.net/api/products/brands/orders",
          {
            headers: { Authorization: `Bearer ${token}` },
            mode: "cors",
            credentials: "include",
          }
        );

        if (!brandsResponse.ok) {
          throw new Error("Failed to fetch brands");
        }

        const brandsData = await brandsResponse.json();
        const brands = brandsData.brands || [];

        addTemporaryProductRow(brands, token);
      } catch (err) {
        console.error("Error fetching brands:", err);
        alert("Failed to load brands. Please try again.");
      }
    });

  // Save order button
  document.getElementById("save-order").addEventListener("click", async () => {
    await saveOrder(orderId, token);
  });
}
function addTemporaryProductRow(brands, token) {
  document
    .querySelectorAll(".temp-product-row, .temp-product-card")
    .forEach((el) => el.remove());

  const tableBody = document.getElementById("editable-items-body");
  const cardsContainer = document.getElementById("editable-items-cards");

  function createElements() {
    const brandSelect = document.createElement("select");
    brandSelect.innerHTML = `<option value="">Select Brand</option>`;
    brands.forEach((b) => {
      brandSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });

    const categorySelect = document.createElement("select");
    categorySelect.innerHTML = `<option value="">Select Category</option>`;

    const barcodeInput = document.createElement("input");
    barcodeInput.placeholder = "Search by barcode...";

    const nameInput = document.createElement("input");
    nameInput.placeholder = "Search by name...";

    const barcodeSuggestions = document.createElement("ul");
    barcodeSuggestions.className = "barcode-suggestions dropdown-list";
    barcodeSuggestions.style.display = "none";
    barcodeSuggestions.style.maxHeight = "200px";
    barcodeSuggestions.style.overflowY = "auto";

    const nameSuggestions = document.createElement("ul");
    nameSuggestions.className = "barcode-suggestions dropdown-list";
    nameSuggestions.style.display = "none";
    nameSuggestions.style.maxHeight = "200px";
    nameSuggestions.style.overflowY = "auto";

    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.value = 1;
    quantityInput.min = 1;

    return {
      brandSelect,
      categorySelect,
      barcodeInput,
      nameInput,
      barcodeSuggestions,
      nameSuggestions,
      quantityInput,
    };
  }

  const row = createElements();
  const card = createElements();

  const sync = (el1, el2, event = "input") => {
    let syncing = false;
    const handler = (source, target) => () => {
      if (syncing || source.value === target.value) return;
      syncing = true;
      target.value = source.value;
      target.dispatchEvent(new Event(event));
      syncing = false;
    };
    el1.addEventListener(event, handler(el1, el2));
    el2.addEventListener(event, handler(el2, el1));
  };

  sync(row.brandSelect, card.brandSelect, "change");
  sync(row.categorySelect, card.categorySelect, "change");
  sync(row.barcodeInput, card.barcodeInput, "input");
  sync(row.nameInput, card.nameInput, "input");
  sync(row.quantityInput, card.quantityInput, "input");

  const selectProduct = (product) => {
    addProductToOrder(product.product_id, product.price, 1, token);
    tempRow.remove();
    tempCard.remove();
  };

  const searchAndPopulate = async (
    query,
    suggestionsEl,
    searchBy,
    brandEl,
    categoryEl
  ) => {
    const brand = brandEl.value;
    const category = categoryEl.value;

    const params = new URLSearchParams();
    if (query.length > 0) {
      params.append(searchBy, query);
    }
    if (brand) params.append("brand", brand);
    if (category) params.append("category", category);

    const url = `https://order-app.gemegypt.net/api/products/orders?${params.toString()}`;

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const matches = data.data || [];

      suggestionsEl.innerHTML = "";
      matches.forEach((product) => {
        const li = document.createElement("li");
        li.innerHTML = `<div><strong>${product.product_name}</strong><br><small>Barcode: ${product.bar_code}, Price: ${product.price}</small></div>`;
        li.style.cursor = "pointer";
        li.onclick = () => selectProduct(product);
        suggestionsEl.appendChild(li);
      });

      suggestionsEl.style.display = matches.length ? "block" : "none";
    } catch (err) {
      console.error("Search failed:", err);
      suggestionsEl.style.display = "none";
    }
  };

  const setupLiveSearch = (
    input,
    suggestions,
    searchBy,
    brandEl,
    categoryEl
  ) => {
    const handleSearch = () => {
      const val = input.value.trim();
      searchAndPopulate(val, suggestions, searchBy, brandEl, categoryEl);
    };

    input.addEventListener("input", handleSearch);
    input.addEventListener("focus", handleSearch);
    input.addEventListener("blur", () => {
      setTimeout(() => {
        suggestions.style.display = "none";
      }, 200);
    });
  };

  setupLiveSearch(
    row.barcodeInput,
    row.barcodeSuggestions,
    "barcode",
    row.brandSelect,
    row.categorySelect
  );
  setupLiveSearch(
    card.barcodeInput,
    card.barcodeSuggestions,
    "barcode",
    card.brandSelect,
    card.categorySelect
  );
  setupLiveSearch(
    row.nameInput,
    row.nameSuggestions,
    "name",
    row.brandSelect,
    row.categorySelect
  );
  setupLiveSearch(
    card.nameInput,
    card.nameSuggestions,
    "name",
    card.brandSelect,
    card.categorySelect
  );

  const loadCategories = async (brand) => {
    const res = await fetch(
      `https://order-app.gemegypt.net/api/products/categories/orders?brand=${encodeURIComponent(
        brand
      )}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();
    const categories = data.categories || [];

    [row.categorySelect, card.categorySelect].forEach((select) => {
      select.innerHTML = `<option value="">Select Category</option>`;
      categories.forEach((cat) => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
      });
    });
  };

  row.brandSelect.addEventListener("change", async () => {
    const brand = row.brandSelect.value;
    await loadCategories(brand);
  });

  const tempRow = document.createElement("tr");
  tempRow.className = "temp-product-row";
  const td = document.createElement("td");
  td.colSpan = 6;
  const rowWrapper = document.createElement("div");
  rowWrapper.className = "order-row";
  [
    row.brandSelect,
    row.categorySelect,
    row.barcodeInput,
    row.barcodeSuggestions,
    row.nameInput,
    row.nameSuggestions,
    row.quantityInput,
  ].forEach((el) => rowWrapper.appendChild(el));
  td.appendChild(rowWrapper);
  tempRow.appendChild(td);
  tableBody.appendChild(tempRow);

  const tempCard = document.createElement("div");
  tempCard.className = "item-card temp-product-card";
  const cardContent = document.createElement("div");
  cardContent.className = "card-content";
  [
    card.brandSelect,
    card.categorySelect,
    card.barcodeInput,
    card.barcodeSuggestions,
    card.nameInput,
    card.nameSuggestions,
    card.quantityInput,
  ].forEach((el) => cardContent.appendChild(el));
  tempCard.appendChild(cardContent);
  cardsContainer.appendChild(tempCard);
}

async function addProductToOrder(productId, price, quantity, token) {
  try {
    const res = await fetch(
      `https://order-app.gemegypt.net/api/product/order/find/${productId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        mode: "cors",
        credentials: "include",
      }
    );

    if (!res.ok) throw new Error("Failed to fetch product details");

    const product = await res.json();
    const productData = product.data;
    const imageUrl = productData.image_path
      ? `https://order-app.gemegypt.net/api/images/${productData.image_path}`
      : "";

    // Remove any temp UI
    document
      .querySelectorAll(".temp-product-row, .temp-product-card")
      .forEach((el) => el.remove());

    // === Table Row ===
    const tableBody = document.getElementById("editable-items-body");
    const row = document.createElement("tr");
    row.dataset.productId = productId;
    row.dataset.price = price;
    row.innerHTML = `
      <td>
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${productData.product_name}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`
            : "No image"
        }
      </td>
      <td>
        <div>${productData.product_name}</div>
        <div style="font-size: 12px; color: #666;">${productData.bar_code}</div>
      </td>

      <td>EGP ${parseFloat(price).toLocaleString()}</td>
      <td><input type="number" class="qty" value="${quantity}" min="1"></td>
      <td>EGP ${(parseFloat(price) * quantity).toLocaleString()}</td>
      <td><button class="remove-btn">Remove</button></td>
    `;
    tableBody.appendChild(row);

    // === Card View ===
    const cardsContainer = document.getElementById("editable-items-cards");
    const card = document.createElement("div");
    card.className = "item-card";
    card.dataset.productId = productId;
    card.dataset.price = price;
    card.innerHTML = `
      <div class="item-card-header">
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${productData.product_name}">`
            : "<div style='width:50px;height:50px;background:#eee;display:flex;align-items:center;justify-content:center;border-radius:4px;'>No img</div>"
        }
        <h3>${productData.product_name}</h3>
      </div>
      <div class="item-card-body">
      <p><span class="item-card-label">Barcode:</span>${parseFloat(
        price
      ).toLocaleString()}</p>
        <p><span class="item-card-label">Price:</span> EGP ${
          productData.bar_code
        }</p>
        <p><span class="item-card-label">Quantity:</span> <input type="number" class="qty" value="${quantity}" min="1"></p>
        <p><span class="item-card-label">Total:</span> EGP ${(
          parseFloat(price) * quantity
        ).toLocaleString()}</p>
      </div>
      <div class="item-card-footer">
        <button class="remove-btn">Remove</button>
      </div>
    `;
    cardsContainer.appendChild(card);

    // === Quantity Sync ===
    const rowQty = row.querySelector(".qty");
    const cardQty = card.querySelector(".qty");

    const syncQty = (sourceInput, targetInput) => {
      targetInput.value = sourceInput.value;
      updateTotals();
    };

    rowQty.addEventListener("input", () => syncQty(rowQty, cardQty));
    cardQty.addEventListener("input", () => syncQty(cardQty, rowQty));

    // === Remove Sync ===
    const removeBoth = () => {
      row.remove();
      card.remove();
      updateTotals();
    };

    row.querySelector(".remove-btn").addEventListener("click", removeBoth);
    card.querySelector(".remove-btn").addEventListener("click", removeBoth);

    updateTotals();
  } catch (err) {
    console.error("Error adding product:", err);
    alert("Failed to add product. Please try again.");
  }
}

// Helper function to save the order
async function saveOrder(orderId, token) {
  try {
    Utils.UI.showLoader("loader");

    // Get the selected address ID
    const addressSelect = document.getElementById("customer-address-select");
    const addressId = addressSelect.value;
    const customerId = addressSelect.dataset.customerId;
    const note = document.getElementById("customer-note").value;

    if (!addressId) {
      Utils.UI.hideLoader("loader");
      alert("Please select a valid address.");
      return;
    }

    const products = [];

    const rows = document.querySelectorAll("#editable-items-body tr");
    if (rows.length > 0) {
      rows.forEach((row) => {
        if (row.classList.contains("temp-product-row")) return;
        const productId = row.dataset.productId;
        const quantity = parseInt(row.querySelector(".qty")?.value || 0);
        if (productId && quantity > 0) {
          products.push({ product_id: parseInt(productId), quantity });
        }
      });
    } else {
      document.querySelectorAll(".item-card").forEach((card) => {
        if (card.classList.contains("temp-product-card")) return;
        const productId = card.dataset.productId;
        const quantity = parseInt(card.querySelector(".qty")?.value || 0);
        if (productId && quantity > 0) {
          products.push({ product_id: parseInt(productId), quantity });
        }
      });
    }

    if (products.length === 0) {
      Utils.UI.hideLoader("loader");
      alert("Please add at least one product to the order.");
      return;
    }

    // Prepare the request data in the format specified by the user
    const requestData = {
      customer_id: parseInt(customerId),
      address_id: parseInt(addressId),
      note: note,
      products: products,
    };

    console.log("Sending order update with data:", requestData);

    // Send request as JSON directly
    const res = await fetch(`https://order-app.gemegypt.net/api/orders/edit/${orderId}`, {
      method: "POST", // Using proper PUT method with JSON
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
      mode: "cors",
      credentials: "include",
    });

    Utils.UI.hideLoader("loader");

    if (res.ok) {
      alert("Order updated successfully!");
      window.location.reload();
    } else {
      const data = await res.json();
      alert(`Failed to update order: ${data.message || "Unknown error"}`);
    }
  } catch (err) {
    Utils.UI.hideLoader("loader");
    console.error("Error saving order:", err);
    alert("An error occurred while saving the order. Please try again.");
  }
}
