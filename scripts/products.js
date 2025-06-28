document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;
  // expose it to the rest of this module
  window.__API_TOKEN = token;

  // open the modal
  document
    .getElementById("export-open-btn")
    .addEventListener("click", openExportDialog);

  // wire up the actual export button,
  document
    .getElementById("export-go-btn")
    .addEventListener("click", () => handleExport(window.__API_TOKEN));

  Utils.UI.checkScreenSize();
  window.addEventListener("resize", Utils.UI.checkScreenSize);

  await populateBrands(token);
  await populateCategories(token); // Load all categories initially
  await fetchAndRenderProducts(token);

  document
    .getElementById("brand-filter")
    .addEventListener("change", async () => {
      await populateCategories(token); // Refresh categories based on selected brand
      await fetchAndRenderProducts(token); // Re-filter products
    });

  document.getElementById("category-filter").addEventListener("change", () => {
    fetchAndRenderProducts(token); // Filter products on category change
  });
});

async function populateBrands(token) {
  const res = await fetch(
    "https://order-app.gemegypt.net/api/products/brands",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const brands = (await res.json()).brands || [];
  const brandSelect = document.getElementById("brand-filter");
  brandSelect.innerHTML =
    `<option value="">All Brands</option>` +
    brands.map((b) => `<option value="${b}">${b}</option>`).join("");
}

async function populateCategories(token) {
  const brand = document.getElementById("brand-filter").value;
  const categoryEndpoint = brand
    ? `https://order-app.gemegypt.net/api/products/categories?brand=${encodeURIComponent(
        brand
      )}`
    : `https://order-app.gemegypt.net/api/products/categories`;

  const res = await fetch(categoryEndpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const categories = (await res.json()).categories || [];
  const categorySelect = document.getElementById("category-filter");
  categorySelect.innerHTML =
    `<option value="">All Categories</option>` +
    categories.map((c) => `<option value="${c}">${c}</option>`).join("");
}

let currentPage = 1;
const pageLimit = 20;

async function fetchAndRenderProducts(token) {
  const brand = document.getElementById("brand-filter").value;
  const category = document.getElementById("category-filter").value;
  const barcodeSearch = document.getElementById("barcode-search").value.trim();

  const params = new URLSearchParams();
  if (brand) params.append("brand", brand);
  if (category) params.append("category", category);
  if (barcodeSearch) params.append("barcode", barcodeSearch);
  params.append("page", currentPage);
  params.append("limit", pageLimit);

  const res = await fetch(
    `https://order-app.gemegypt.net/api/products?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await res.json();
  const products = data.data || [];

  const tableBody = document.getElementById("productsTable");
  const cardContainer = document.getElementById("productCards");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  products.forEach((product) => {
    const imageUrl = `https://order-app.gemegypt.net/api/images/${product.image_path}`;

    // Table Row
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><img src="${imageUrl}" alt="${product.product_name}" /></td>
     <td style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
  <div style="font-weight: 600; margin-bottom: 2px;">
    ${product.product_name}
  </div>

  <div style="color: #666; font-size: 12px; margin-bottom: 4px;">
    <span style="opacity: 0.8;">Barcode:</span>
    <span>${product.bar_code || "-"}</span>
  </div>

  <span style="
    display: inline-block;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    font-weight: 500;
    color: white;
    background-color: ${product.visability === 1 ? "#28a745" : "#999"};
  ">
    ${product.visability === 1 ? "🟢 Visible" : "🔒 Hidden"}
  </span>
</td>

      <td>${product.Item_number || "-"}</td>
      <td>${product.brand}</td>
      <td>${product.category}</td>
      <td>${Utils.Format.currency(product.price)}</td>
      <td>
        <span class="${
          product.availability == "Available"
            ? "available-badge"
            : "not-available-badge"
        }">
          ${
            product.availability === "Available"
              ? "🟢"
              : product.availability === "Limited"
              ? "🟡"
              : "🔴"
          }
          
        </span>
      </td>
     <td>
  <style>
    .action-container {
      position: relative;
      display: inline-block;
      font-family: sans-serif;
    }

    .action-btn {
      background-color: #f5f5f5;
      border: 1px solid #ccc;
      border-radius: 5px;
      padding: 6px 14px;
      font-size: 14px;
      cursor: pointer;
      color: #333;
      transition: background-color 0.2s ease;
    }

    .action-btn:hover {
      background-color: #e0e0e0;
    }

    .dropdown-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      background-color: white;
      min-width: 130px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      overflow: hidden;
      z-index: 100;
    }

    .dropdown-menu button {
      display: block;
      width: 100%;
      padding: 8px 12px;
      background: none;
      border: none;
      text-align: left;
      font-size: 13px;
      color: #333;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .dropdown-menu button:hover {
      background-color: #d3d3d3;
      color: black;
    }

    .dropdown-menu .btn-delete:hover {
      background-color: #f8d7da;
      color: #c00;
    }

    .action-container:hover .dropdown-menu,
    .action-container:focus-within .dropdown-menu {
      display: block;
    }
  </style>

  <div class="action-container">
    <button class="action-btn">Actions ▾</button>
    <div class="dropdown-menu">
      <button onclick="openProductDialog('edit', ${
        product.product_id
      })">Edit</button>
      <button onclick="openProductDialog('copy', ${
        product.product_id
      })">Copy</button>
      <button onclick="toggleVisability(${product.product_id}, ${
      product.visability
    })">
        ${product.visability === 1 ? "Hide" : "Show"}
      </button>
      <button class="btn-delete" onclick="deleteProduct(${
        product.product_id
      })">Delete</button>
    </div>
  </div>
</td>
`;
    tableBody.appendChild(row);

    // Card View
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
       <img src="${imageUrl}" alt="${product.product_name}" style="
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    margin-bottom: 6px;
  "/>
     


<div class="product-card-header" style="
  font-family: sans-serif;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
">
  <span style="flex-grow: 1; word-break: break-word;">
    ${product.product_name}
  </span>
  <span style="
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
    color: white;
    background-color: ${product.visability === 1 ? "#28a745" : "#999"};
    white-space: nowrap;
  ">
    ${product.visability === 1 ? "🟢 Visible" : "🔒 Hidden"}
  </span>
</div>






      <div class="barcode-text text-center">${product.bar_code || "-"}</div>
      <div class="product-card-body">
        <p><strong>Item No.:</strong> ${product.Item_number || "-"}</p>
        <p><strong>Brand:</strong> ${product.brand}</p>
        <p><strong>Category:</strong> ${product.category}</p>
        <p><strong>Price:</strong> ${Utils.Format.currency(product.price)}</p>
        <p><strong>Availability:</strong>
          <span class="${
            product.availability == "Available"
              ? "available-badge"
              : "not-available-badge"
          }">
             ${
               product.availability === "Available"
                 ? "🟢"
                 : product.availability === "Limited"
                 ? "🟡"
                 : "🔴"
             }
          </span>
        </p>
      </div>

      
    <div class="product-card-footer text-right">
  <style>
    .action-container-mobile {
      position: relative;
      display: inline-block;
      width: 100%;
      text-align: right;
      font-family: sans-serif;
    }

    .action-btn-mobile {
      background-color: #f5f5f5;
      border: 1px solid #ccc;
      border-radius: 5px;
      padding: 6px 14px;
      font-size: 14px;
      cursor: pointer;
      color: #333;
      transition: background-color 0.2s ease;
    }

    .action-btn-mobile:hover {
      background-color: #e0e0e0;
    }

    .dropdown-menu-mobile {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      background-color: white;
      min-width: 130px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      overflow: hidden;
      z-index: 100;
    }

    .dropdown-menu-mobile button {
      display: block;
      width: 100%;
      padding: 8px 12px;
      background: none;
      border: none;
      text-align: left;
      font-size: 13px;
      color: #333;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .dropdown-menu-mobile button:hover {
      background-color: #d3d3d3;
      color: black;
    }

    .dropdown-menu-mobile .btn-delete:hover {
      background-color: #f8d7da;
      color: #c00;
    }
  </style>

  <div class="action-container-mobile">
    <button class="action-btn-mobile" data-dropdown-id="dropdown-${
      product.product_id
    }">
      Actions ▾
    </button>
    <div class="dropdown-menu-mobile" id="dropdown-${product.product_id}">
      <button onclick="openProductDialog('edit', ${
        product.product_id
      })">Edit</button>
      <button onclick="openProductDialog('copy', ${
        product.product_id
      })">Copy</button>
      <button onclick="toggleVisability(${product.product_id}, ${
      product.visability
    })">
        ${product.visability === 1 ? "Hide" : "Show"}
      </button>
      <button class="btn-delete" onclick="deleteProduct(${
        product.product_id
      })">Delete</button>
    </div>
  </div>
</div>
`;
    document.addEventListener("click", function (e) {
      const isButton = e.target.matches(".action-btn-mobile");
      const openMenus = document.querySelectorAll(".dropdown-menu-mobile");

      // Close all menus first
      openMenus.forEach((menu) => (menu.style.display = "none"));

      // If it's the Actions button
      if (isButton) {
        e.stopPropagation();
        const dropdownId = e.target.getAttribute("data-dropdown-id");
        const menu = document.getElementById(dropdownId);
        if (menu) {
          menu.style.display = "block";
        }
      }
    });

    cardContainer.appendChild(card);
  });

  renderPagination(data.page, data.pages);
}

document.getElementById("barcode-search").addEventListener("input", () => {
  currentPage = 1;
  const token = localStorage.getItem("access_token");
  fetchAndRenderProducts(token);
});

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  const token = localStorage.getItem("access_token");
  try {
    const res = await fetch(
      `https://order-app.gemegypt.net/api/product/delete/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.ok) {
      alert("Product deleted successfully.");
      fetchAndRenderProducts(token);
    } else {
      const err = await res.json();
      alert(`Failed to delete: ${err.message}`);
    }
  } catch (error) {
    alert("Something went wrong during deletion.");
    console.error(error);
  }
}

let currentAction = "edit";

function openProductDialog(action, productId) {
  currentAction = action;
  const modal = document.getElementById("product-modal");
  const form = document.getElementById("product-form");
  const title = document.getElementById("modal-title");
  const errorMsg = document.getElementById("modal-error-message");

  const token = localStorage.getItem("access_token");

  errorMsg.style.display = "none"; // Clear previous error

  fetch(`https://order-app.gemegypt.net/api/product/find/${productId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((res) => res.json())
    .then(({ data }) => {
      document.getElementById("product-id").value = productId;

      if (action === "edit") {
        document.getElementById("product-name").value = data.product_name;
        document.getElementById("bar-code").value = data.bar_code;
        document.getElementById("item-number").value = data.Item_number || "";
      } else {
        // Clear name and barcode for copy
        document.getElementById("product-name").value = "";
        document.getElementById("bar-code").value = "";
        document.getElementById("item-number").value = "";
      }

      document.getElementById("brand").value = data.brand;
      document.getElementById("category").value = data.category;
      document.getElementById("description").value = data.description;
      document.getElementById("price").value = data.price;
      document.getElementById("product-order-limit").value =
        data.product_order_limit || "";
      document.getElementById("availability-limit").value =
        data.availability_limit || "";

      modal.style.display = "flex";
    })
    .catch((error) => {
      console.error("Error fetching product data:", error);
      errorMsg.textContent = "Failed to load product data. Please try again.";
      errorMsg.style.display = "block";
    });
}

function closeModal() {
  document.getElementById("product-modal").style.display = "none";
  document.getElementById("product-form").reset();
}
document
  .getElementById("product-form")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("access_token");
    const formData = new FormData();

    const id = document.getElementById("product-id").value;
    formData.append(
      "product_name",
      document.getElementById("product-name").value
    );
    formData.append("bar_code", document.getElementById("bar-code").value);
    formData.append(
      "item_number",
      document.getElementById("item-number").value
    );
    formData.append("brand", document.getElementById("brand").value);
    formData.append("category", document.getElementById("category").value);
    formData.append(
      "description",
      document.getElementById("description").value
    );
    formData.append("price", document.getElementById("price").value);
    formData.append(
      "product_order_limit",
      document.getElementById("product-order-limit").value
    );
    formData.append(
      "availability_limit",
      document.getElementById("availability-limit").value
    );

    const file = document.getElementById("image").files[0];
    if (file) formData.append("image", file);

    const url =
      currentAction === "add"
        ? `https://order-app.gemegypt.net/api/add_product`
        : currentAction === "edit"
        ? `https://order-app.gemegypt.net/api/product/edit/${id}`
        : `https://order-app.gemegypt.net/api/product/copy/${id}`;
    if (currentAction === "add") {
      document.getElementById("image-note").style.display = "none";
    } else {
      document.getElementById("image-note").style.display = "block";
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await res.json();
      const errorMsg = document.getElementById("modal-error-message");

      if (res.ok) {
        alert(result.message);
        closeModal();
        fetchAndRenderProducts(token);
      } else {
        errorMsg.textContent = result.message || "Something went wrong.";
        errorMsg.style.display = "block";
      }
    } catch (error) {
      const errorMsg = document.getElementById("modal-error-message");
      errorMsg.textContent = "Network error. Please try again.";
      errorMsg.style.display = "block";
    }
  });
// EXPORT Logic
function openExportDialog() {
  document.getElementById("export-modal").style.display = "flex";
}

function closeExportDialog() {
  document.getElementById("export-modal").style.display = "none";
}
let selectedExportType = "all";
let selectedImportMode = "update";

function selectExportOption(button) {
  document
    .querySelectorAll("#export-modal .option-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  button.classList.add("selected");
  selectedExportType = button.getAttribute("data-value");
}

function selectImportOption(button) {
  document
    .querySelectorAll("#import-modal .option-btn")
    .forEach((btn) => btn.classList.remove("selected"));
  button.classList.add("selected");
  selectedImportMode = button.getAttribute("data-value");
}

async function handleExport(token) {
  const params = new URLSearchParams();
  if (selectedExportType === "filtered") {
    const brand = document.getElementById("brand-filter").value;
    const category = document.getElementById("category-filter").value;
    const barcode = document.getElementById("barcode-search").value.trim();
    if (brand) params.append("brand", brand);
    if (category) params.append("category", category);
    if (barcode) params.append("bar_code", barcode);
  }

  const url = `https://order-app.gemegypt.net/api/products/export?${params.toString()}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Export failed");

    const blob = await res.blob();
    const filename = "products_export.xlsx";

    // 1) try the normal URL API
    const URLobj = window.URL || window.webkitURL;
    if (URLobj && typeof URLobj.createObjectURL === "function") {
      const dlUrl = URLobj.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URLobj.revokeObjectURL(dlUrl);

      // 2) fallback: read as data URL
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        const a = document.createElement("a");
        a.href = reader.result; // this is a data: URI
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      reader.readAsDataURL(blob);
    }
  } catch (err) {
    alert("Export failed. Are you logged in as an admin?");
    console.error(err);
  } finally {
    closeExportDialog();
  }
}

// IMPORT Logic
function openImportDialog() {
  document.getElementById("import-modal").style.display = "flex";
  document.getElementById("import-error-message").style.display = "none";
}

function closeImportDialog() {
  document.getElementById("import-modal").style.display = "none";
  document.getElementById("import-file").value = ""; // Reset file input
}

async function handleImport() {
  const token = localStorage.getItem("access_token");
  const xlsxInput = document.getElementById("import-file");
  const zipInput = document.getElementById("images-zip");
  const errorMsg = document.getElementById("import-error-message");

  errorMsg.style.display = "none";

  const hasXlsx = xlsxInput.files.length > 0;
  const hasZip = zipInput.files.length > 0;

  if (!hasXlsx && !hasZip) {
    errorMsg.textContent =
      "Please select at least one file to upload (Excel or ZIP).";
    errorMsg.style.display = "block";
    return;
  }

  const formData = new FormData();

  if (hasXlsx) {
    formData.append("file", xlsxInput.files[0]);
    formData.append("mode", selectedImportMode); // "update" or "add"
  }

  if (hasZip) {
    formData.append("images_zip", zipInput.files[0]);
  }

  try {
    let endpoint = "";
    if (hasXlsx) {
      endpoint = `https://order-app.gemegypt.net/api/products/import?mode=${selectedImportMode}`;
    } else {
      endpoint = `https://order-app.gemegypt.net/api/products/images/import`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const result = await res.json();

    if (res.ok) {
      if (hasXlsx) {
        alert(
          `Import successful: Added ${result.added}, Updated ${result.updated}`
        );
      } else {
        alert(
          `Image import successful. Updated: ${result.updated}. Skipped: ${result.skipped.length}`
        );
      }

      closeImportDialog();
      fetchAndRenderProducts(token);
    } else {
      errorMsg.textContent = result.message || "Import failed.";
      errorMsg.style.display = "block";
    }
  } catch (err) {
    errorMsg.textContent = "Network error. Please try again.";
    errorMsg.style.display = "block";
  }
}

async function toggleVisability(productId, currentVisability) {
  const token = localStorage.getItem("access_token");
  const newVisability = currentVisability === 1 ? 0 : 1;

  if (
    !confirm(
      `Are you sure you want to ${
        newVisability === 1 ? "Show" : "Hide"
      } this product?`
    )
  )
    return;

  try {
    const res = await fetch(
      `https://order-app.gemegypt.net/api/products/set_visability/${productId}/${newVisability}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const result = await res.json();

    if (res.ok) {
      alert(result.message);
      fetchAndRenderProducts(token);
    } else {
      alert(result.message || "Failed to update visability.");
    }
  } catch (error) {
    alert("Network error. Please try again.");
    console.error(error);
  }
}

function openAddProductDialog() {
  currentAction = "add";
  const modal = document.getElementById("product-modal");
  const errorMsg = document.getElementById("modal-error-message");
  errorMsg.style.display = "none"; // Clear any previous error

  // Reset form and fields
  const form = document.getElementById("product-form");
  form.reset();

  // Set default values for limits
  document.getElementById("product-order-limit").value = -1;
  document.getElementById("availability-limit").value = 100;

  document.getElementById("product-id").value = "";
  document.getElementById("image-note").style.display = "none";

  modal.style.display = "flex";
}

function renderPagination(current, totalPages) {
  const container = document.getElementById("pagination");
  if (!container) return;

  container.innerHTML = "";

  const maxPagesToShow = 10;
  let startPage = Math.max(current - Math.floor(maxPagesToShow / 2), 1);
  let endPage = startPage + maxPagesToShow - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(endPage - maxPagesToShow + 1, 1);
  }

  // Previous Button
  const prevBtn = document.createElement("button");
  prevBtn.textContent = "◀";
  prevBtn.disabled = current === 1;
  prevBtn.className = "btn";
  prevBtn.onclick = () => {
    if (current > 1) {
      currentPage = current - 1;
      fetchAndRenderProducts(window.__API_TOKEN);
    }
  };
  container.appendChild(prevBtn);

  // Page Numbers
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement("button");
    btn.textContent = i;
    btn.className = i === current ? "btn selected" : "btn";
    btn.onclick = () => {
      currentPage = i;
      fetchAndRenderProducts(window.__API_TOKEN);
    };
    container.appendChild(btn);
  }

  // Next Button
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "▶";
  nextBtn.disabled = current === totalPages;
  nextBtn.className = "btn";
  nextBtn.onclick = () => {
    if (current < totalPages) {
      currentPage = current + 1;
      fetchAndRenderProducts(window.__API_TOKEN);
    }
  };
  container.appendChild(nextBtn);
}
