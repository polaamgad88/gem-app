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

function addOrderRow(
  container,
  filterOptions,
  allProducts,
  filterType = "brand"
) {
  const row = document.createElement("div");
  row.classList.add("order-row");

  const selector = document.createElement("select");
  selector.className = "brand-select";
  selector.innerHTML = `<option value="">Select ${filterType}</option>`;
  filterOptions.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = item;
    selector.appendChild(opt);
  });

  const productWrapper = document.createElement("div");
  productWrapper.className = "custom-dropdown";

  const productSelect = document.createElement("select");
  productSelect.className = "product-select";
  productSelect.innerHTML = `<option value="">Select Product</option>`;
  productWrapper.appendChild(productSelect);

  const quantityWrapper = document.createElement("div");
  quantityWrapper.className = "quantity-wrapper";
  const quantityInput = document.createElement("input");
  quantityInput.className = "quantity-input";
  quantityInput.type = "number";
  quantityInput.value = 1;
  quantityInput.min = 1;
  quantityInput.addEventListener("input", updateTotals);
  quantityWrapper.appendChild(quantityInput);

  const deleteBtn = document.createElement("i");
  deleteBtn.className = "material-icons";
  deleteBtn.style = "font-size:33px;color:red;cursor:pointer;";
  deleteBtn.textContent = "cancel";
  deleteBtn.onclick = () => {
    row.remove();
    updateTotals();
  };

  row.appendChild(selector);
  row.appendChild(productWrapper);
  row.appendChild(quantityWrapper);
  row.appendChild(deleteBtn);
  container.appendChild(row);

  selector.onchange = () => {
    const selected = selector.value;
    const filteredProducts = allProducts.filter(
      (p) => p[filterType] === selected
    );
    productSelect.innerHTML = `<option value="">Select Product</option>`;
    filteredProducts.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.product_id;
      opt.textContent = p.product_name;
      opt.dataset.price = p.price;
      productSelect.appendChild(opt);
    });
    updateTotals();
  };

  productSelect.onchange = updateTotals;
}

function addCombinedRow(container, brands, categories) {
  const row = document.createElement("div");
  row.classList.add("order-row");

  const brandSelect = document.createElement("select");
  brandSelect.className = "brand-select";
  brandSelect.innerHTML = `<option value="">Select Brand</option>`;
  brands.forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    brandSelect.appendChild(opt);
  });

  const categorySelect = document.createElement("select");
  categorySelect.className = "product-select";
  categorySelect.innerHTML = `<option value="">Select Category</option>`;
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    categorySelect.appendChild(opt);
  });

  const quantityInput = document.createElement("input");
  quantityInput.className = "quantity-input";
  quantityInput.type = "number";
  quantityInput.value = 1;
  quantityInput.min = 1;
  quantityInput.addEventListener("input", () => updateTotals());

  const deleteBtn = document.createElement("i");
  deleteBtn.className = "material-icons";
  deleteBtn.style = "font-size:33px;color:red;cursor:pointer;";
  deleteBtn.textContent = "cancel";
  deleteBtn.onclick = () => {
    row.remove();
    updateTotals();
  };

  row.appendChild(brandSelect);
  row.appendChild(categorySelect);
  row.appendChild(quantityInput);
  row.appendChild(deleteBtn);
  container.appendChild(row);

  const onChange = async () => {
    const brand = brandSelect.value;
    const category = categorySelect.value;
    const qty = parseInt(quantityInput.value) || 0;
    if (!brand || !category || qty < 1) {
      updateTotals();
      return;
    }

    const res = await fetch(
      `http://localhost:5000/products?brand=${encodeURIComponent(
        brand
      )}&category=${encodeURIComponent(category)}`
    );
    if (!res.ok) return;

    const json = await res.json();
    const selectedProducts = json.data || [];

    row.dataset.totalItems = qty * selectedProducts.length;
    row.dataset.totalPrice = selectedProducts.reduce(
      (acc, p) => acc + qty * parseFloat(p.price || 0),
      0
    );

    updateTotals();
  };

  brandSelect.addEventListener("change", onChange);
  categorySelect.addEventListener("change", onChange);
  quantityInput.addEventListener("input", onChange);
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

  // 🔹 Collect products from Combined Order via API
  const combinedRows = document.querySelectorAll(
    "#combined-order-rows .order-row"
  );
  for (const row of combinedRows) {
    const brand = row.querySelector(".brand-select")?.value;
    const category = row.querySelector(".product-select")?.value;
    const qty = parseInt(row.querySelector(".quantity-input")?.value || "0");

    if (!brand || !category || qty <= 0) continue;

    const query = `brand=${encodeURIComponent(
      brand
    )}&category=${encodeURIComponent(category)}`;
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

  // 🔹 Final payload
  const payload = {
    customer_id: parseInt(customerId),
    address_id: parseInt(addressId),
    products,
  };

  // 🔹 Submit order
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
      window.location.href = "orders.html";
    } else {
      alert(`❌ Error: ${result.message || "Order failed."}`);
    }
  } catch (err) {
    console.error("Order submission error:", err);
    alert("❌ Something went wrong while submitting the order.");
  }
});
