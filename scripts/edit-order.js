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
    const price = parseFloat(item.price);
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
      <td>${item.product_name}</td>
      <td>EGP ${price.toFixed(2)}</td>
      <td><input type="number" class="qty" value="${quantity}" min="1"></td>
      <td>EGP ${itemTotal.toFixed(2)}</td>
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
        <p><span class="item-card-label">Price:</span> EGP ${price.toFixed(
          2
        )}</p>
        <p><span class="item-card-label">Quantity:</span> <input type="number" class="qty" value="${quantity}" min="1"></p>
        <p><span class="item-card-label">Total:</span> EGP ${itemTotal.toFixed(
          2
        )}</p>
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
  document.getElementById("total-price").textContent = `EGP ${total.toFixed(
    2
  )}`;
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
    row.cells[4].textContent = `EGP ${itemTotal.toFixed(2)}`;

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
  document.getElementById("total-price").textContent = `EGP ${total.toFixed(
    2
  )}`;
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

        // Add temporary product row to both table and card views
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

// Helper function to add a temporary product row to both table and card views
function addTemporaryProductRow(brands, token) {
  // Remove any existing temporary rows first to prevent multiple search interfaces
  document
    .querySelectorAll(".temp-product-row, .temp-product-card")
    .forEach((el) => el.remove());

  // Create a temporary row in the table
  const tableBody = document.getElementById("editable-items-body");
  const tempRow = document.createElement("tr");
  tempRow.className = "temp-product-row";
  tempRow.innerHTML = `
    <td colspan="6">
      <div class="search-container">
        <div class="search-options">
          <label>
            <input type="radio" name="search-type" value="brand-product" checked> 
            Search by Brand/Product
          </label>
          <label>
            <input type="radio" name="search-type" value="barcode"> 
            Search by Barcode
          </label>
        </div>
        
        <div class="search-inputs">
          <div class="brand-product-search">
            <div class="brand-select-container">
              <select id="brand-select" class="search-input">
                <option value="">Select Brand</option>
                ${brands
                  .map((brand) => `<option value="${brand}">${brand}</option>`)
                  .join("")}
              </select>
            </div>
            <div class="product-select-container" style="display:none; margin-top:10px;">
              <select id="product-select" class="search-input">
                <option value="">Select Product</option>
              </select>
            </div>
          </div>
          
          <div class="barcode-search" style="display:none;">
            <input type="text" id="barcode-search" placeholder="Scan or enter barcode" class="search-input">
            <button id="search-barcode-btn" class="search-btn">Search</button>
          </div>
        </div>
        
        <div class="quantity-wrapper">
          <label for="product-quantity">Quantity:</label>
          <input type="number" id="product-quantity" value="1" min="1">
        </div>
        
        <div class="action-buttons">
          <button id="confirm-add-product" class="confirm-btn">Add</button>
          <button id="cancel-add-product" class="cancel-btn">Cancel</button>
        </div>
      </div>
    </td>
  `;

  tableBody.appendChild(tempRow);

  // Create a temporary card for mobile view
  const cardsContainer = document.getElementById("editable-items-cards");
  const tempCard = document.createElement("div");
  tempCard.className = "item-card temp-product-card";
  tempCard.innerHTML = `
    <div class="search-container">
      <div class="search-options">
        <label>
          <input type="radio" name="search-type-mobile" value="brand-product" checked> 
          Search by Brand/Product
        </label>
        <label>
          <input type="radio" name="search-type-mobile" value="barcode"> 
          Search by Barcode
        </label>
      </div>
      
      <div class="search-inputs">
        <div class="brand-product-search-mobile">
          <div class="brand-select-container-mobile">
            <select id="brand-select-mobile" class="search-input">
              <option value="">Select Brand</option>
              ${brands
                .map((brand) => `<option value="${brand}">${brand}</option>`)
                .join("")}
            </select>
          </div>
          <div class="product-select-container-mobile" style="display:none; margin-top:10px;">
            <select id="product-select-mobile" class="search-input">
              <option value="">Select Product</option>
            </select>
          </div>
        </div>
        
        <div class="barcode-search-mobile" style="display:none;">
          <input type="text" id="barcode-search-mobile" placeholder="Scan or enter barcode" class="search-input">
          <button id="search-barcode-btn-mobile" class="search-btn">Search</button>
        </div>
      </div>
      
      <div class="quantity-wrapper">
        <label for="product-quantity-mobile">Quantity:</label>
        <input type="number" id="product-quantity-mobile" value="1" min="1">
      </div>
      
      <div class="action-buttons">
        <button id="confirm-add-product-mobile" class="confirm-btn">Add</button>
        <button id="cancel-add-product-mobile" class="cancel-btn">Cancel</button>
      </div>
    </div>
  `;

  cardsContainer.appendChild(tempCard);

  // Set up search type toggle for desktop
  document.querySelectorAll('input[name="search-type"]').forEach((radio) => {
    radio.addEventListener("change", function () {
      const brandProductSearch = document.querySelector(
        ".brand-product-search"
      );
      const barcodeSearch = document.querySelector(".barcode-search");

      if (this.value === "barcode") {
        barcodeSearch.style.display = "flex";
        brandProductSearch.style.display = "none";
      } else {
        barcodeSearch.style.display = "none";
        brandProductSearch.style.display = "flex";
      }
    });
  });

  // Set up search type toggle for mobile
  document
    .querySelectorAll('input[name="search-type-mobile"]')
    .forEach((radio) => {
      radio.addEventListener("change", function () {
        const brandProductSearch = document.querySelector(
          ".brand-product-search-mobile"
        );
        const barcodeSearch = document.querySelector(".barcode-search-mobile");

        if (this.value === "barcode") {
          barcodeSearch.style.display = "flex";
          brandProductSearch.style.display = "none";
        } else {
          barcodeSearch.style.display = "none";
          brandProductSearch.style.display = "flex";
        }
      });
    });

  // Set up brand select change event for desktop
  const brandSelect = document.getElementById("brand-select");
  const productSelect = document.getElementById("product-select");
  const productContainer = document.querySelector(".product-select-container");

  brandSelect.addEventListener("change", async function () {
    const selectedBrand = this.value;

    if (!selectedBrand) {
      productContainer.style.display = "none";
      return;
    }

    try {
      // Fetch products for the selected brand
      const res = await fetch(
        `https://order-app.gemegypt.net/api/products/orders?brand=${encodeURIComponent(
          selectedBrand
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("Failed to fetch products");

      const data = await res.json();
      const products = data.data || [];

      // Populate product dropdown
      productSelect.innerHTML = '<option value="">Select Product</option>';
      products.forEach((product) => {
        productSelect.innerHTML += `<option value="${product.product_id}" data-price="${product.price}">${product.product_name}</option>`;
      });

      productContainer.style.display = "block";
    } catch (err) {
      console.error("Error fetching products:", err);
      alert("Failed to load products for this brand. Please try again.");
    }
  });

  // Set up brand select change event for mobile
  const brandSelectMobile = document.getElementById("brand-select-mobile");
  const productSelectMobile = document.getElementById("product-select-mobile");
  const productContainerMobile = document.querySelector(
    ".product-select-container-mobile"
  );

  brandSelectMobile.addEventListener("change", async function () {
    const selectedBrand = this.value;

    if (!selectedBrand) {
      productContainerMobile.style.display = "none";
      return;
    }

    try {
      // Fetch products for the selected brand
      const res = await fetch(
        `https://order-app.gemegypt.net/api/products/orders?brand=${encodeURIComponent(
          selectedBrand
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("Failed to fetch products");

      const data = await res.json();
      const products = data.data || [];

      // Populate product dropdown
      productSelectMobile.innerHTML =
        '<option value="">Select Product</option>';
      products.forEach((product) => {
        productSelectMobile.innerHTML += `<option value="${product.product_id}" data-price="${product.price}">${product.product_name}</option>`;
      });

      productContainerMobile.style.display = "block";
    } catch (err) {
      console.error("Error fetching products:", err);
      alert("Failed to load products for this brand. Please try again.");
    }
  });

  // Set up barcode search for desktop
  const barcodeInput = document.getElementById("barcode-search");
  const searchBarcodeBtn = document.getElementById("search-barcode-btn");

  searchBarcodeBtn.addEventListener("click", async function () {
    const barcode = barcodeInput.value.trim();
    if (!barcode) {
      alert("Please enter a barcode");
      return;
    }

    try {
      // Use the provided backend endpoint for barcode search
      const res = await fetch(
        `https://order-app.gemegypt.net/api/product/order/search_by_barcode?barcode=${encodeURIComponent(
          barcode
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
          credentials: "include",
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          alert("No product found with this barcode");
          return;
        }
        throw new Error("Failed to search by barcode");
      }

      const data = await res.json();
      const matchedProducts = data.data || [];

      // If exactly one product is found, automatically select it
      if (matchedProducts.length === 1) {
        const product = matchedProducts[0];
        barcodeInput.dataset.selectedId = product.product_id;
        barcodeInput.dataset.selectedPrice = product.price;
        barcodeInput.value = `${product.product_name} (${barcode})`;

        // Automatically add the product
        const quantity =
          parseInt(document.getElementById("product-quantity").value) || 1;
        addProductToOrder(product.product_id, product.price, quantity, token);
      } else if (matchedProducts.length > 1) {
        // If multiple products found, do nothing as per requirements
        alert(
          "Multiple products found with this barcode. Please refine your search."
        );
        barcodeInput.dataset.selectedId = "";
        barcodeInput.dataset.selectedPrice = "";
      } else {
        // No products found (this shouldn't happen due to 404 handling above)
        alert("No product found with this barcode");
        barcodeInput.dataset.selectedId = "";
        barcodeInput.dataset.selectedPrice = "";
      }
    } catch (err) {
      console.error("Error searching by barcode:", err);
      alert("Failed to search by barcode. Please try again.");
    }
  });

  // Set up barcode search for mobile
  const barcodeInputMobile = document.getElementById("barcode-search-mobile");
  const searchBarcodeBtnMobile = document.getElementById(
    "search-barcode-btn-mobile"
  );

  searchBarcodeBtnMobile.addEventListener("click", async function () {
    const barcode = barcodeInputMobile.value.trim();
    if (!barcode) {
      alert("Please enter a barcode");
      return;
    }

    try {
      // Use the provided backend endpoint for barcode search
      const res = await fetch(
        `https://order-app.gemegypt.net/api/product/order/search_by_barcode?barcode=${encodeURIComponent(
          barcode
        )}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          mode: "cors",
          credentials: "include",
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          alert("No product found with this barcode");
          return;
        }
        throw new Error("Failed to search by barcode");
      }

      const data = await res.json();
      const matchedProducts = data.data || [];

      // If exactly one product is found, automatically select it
      if (matchedProducts.length === 1) {
        const product = matchedProducts[0];
        barcodeInputMobile.dataset.selectedId = product.product_id;
        barcodeInputMobile.dataset.selectedPrice = product.price;
        barcodeInputMobile.value = `${product.product_name} (${barcode})`;

        // Automatically add the product
        const quantity =
          parseInt(document.getElementById("product-quantity-mobile").value) ||
          1;
        addProductToOrder(product.product_id, product.price, quantity, token);
      } else if (matchedProducts.length > 1) {
        // If multiple products found, do nothing as per requirements
        alert(
          "Multiple products found with this barcode. Please refine your search."
        );
        barcodeInputMobile.dataset.selectedId = "";
        barcodeInputMobile.dataset.selectedPrice = "";
      } else {
        // No products found (this shouldn't happen due to 404 handling above)
        alert("No product found with this barcode");
        barcodeInputMobile.dataset.selectedId = "";
        barcodeInputMobile.dataset.selectedPrice = "";
      }
    } catch (err) {
      console.error("Error searching by barcode:", err);
      alert("Failed to search by barcode. Please try again.");
    }
  });

  // Set up cancel button for desktop
  document
    .getElementById("cancel-add-product")
    .addEventListener("click", function () {
      document
        .querySelectorAll(".temp-product-row, .temp-product-card")
        .forEach((el) => el.remove());
    });

  // Set up cancel button for mobile
  document
    .getElementById("cancel-add-product-mobile")
    .addEventListener("click", function () {
      document
        .querySelectorAll(".temp-product-row, .temp-product-card")
        .forEach((el) => el.remove());
    });

  // Set up confirm button for desktop
  document
    .getElementById("confirm-add-product")
    .addEventListener("click", async function () {
      const searchType = document.querySelector(
        'input[name="search-type"]:checked'
      ).value;
      let productId, price;

      if (searchType === "brand-product") {
        productId = productSelect.value;
        price =
          productSelect.options[productSelect.selectedIndex]?.dataset.price;

        if (!productId) {
          alert("Please select a product");
          return;
        }
      } else {
        // barcode search
        productId = barcodeInput.dataset.selectedId;
        price = barcodeInput.dataset.selectedPrice;

        if (!productId) {
          alert("Please search for a valid barcode");
          return;
        }
      }

      const quantity =
        parseInt(document.getElementById("product-quantity").value) || 1;
      addProductToOrder(productId, price, quantity, token);
    });

  // Set up confirm button for mobile
  document
    .getElementById("confirm-add-product-mobile")
    .addEventListener("click", async function () {
      const searchType = document.querySelector(
        'input[name="search-type-mobile"]:checked'
      ).value;
      let productId, price;

      if (searchType === "brand-product") {
        productId = productSelectMobile.value;
        price =
          productSelectMobile.options[productSelectMobile.selectedIndex]
            ?.dataset.price;

        if (!productId) {
          alert("Please select a product");
          return;
        }
      } else {
        // barcode search
        productId = barcodeInputMobile.dataset.selectedId;
        price = barcodeInputMobile.dataset.selectedPrice;

        if (!productId) {
          alert("Please search for a valid barcode");
          return;
        }
      }

      const quantity =
        parseInt(document.getElementById("product-quantity-mobile").value) || 1;
      addProductToOrder(productId, price, quantity, token);
    });
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
      <td>${productData.product_name}</td>
      <td>EGP ${parseFloat(price).toFixed(2)}</td>
      <td><input type="number" class="qty" value="${quantity}" min="1"></td>
      <td>EGP ${(parseFloat(price) * quantity).toFixed(2)}</td>
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
        <p><span class="item-card-label">Price:</span> EGP ${parseFloat(
          price
        ).toFixed(2)}</p>
        <p><span class="item-card-label">Quantity:</span> <input type="number" class="qty" value="${quantity}" min="1"></p>
        <p><span class="item-card-label">Total:</span> EGP ${(
          parseFloat(price) * quantity
        ).toFixed(2)}</p>
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
