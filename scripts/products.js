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
  const res = await fetch("http://localhost:5000/products/brands", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const brands = (await res.json()).brands || [];
  const brandSelect = document.getElementById("brand-filter");
  brandSelect.innerHTML =
    `<option value="">All Brands</option>` +
    brands.map((b) => `<option value="${b}">${b}</option>`).join("");
}

async function populateCategories(token) {
  const brand = document.getElementById("brand-filter").value;
  const categoryEndpoint = brand
    ? `http://localhost:5000/products/categories?brand=${encodeURIComponent(
        brand
      )}`
    : `http://localhost:5000/products/categories`;

  const res = await fetch(categoryEndpoint, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const categories = (await res.json()).categories || [];
  const categorySelect = document.getElementById("category-filter");
  categorySelect.innerHTML =
    `<option value="">All Categories</option>` +
    categories.map((c) => `<option value="${c}">${c}</option>`).join("");
}

async function fetchAndRenderProducts(token) {
  const brand = document.getElementById("brand-filter").value;
  const category = document.getElementById("category-filter").value;
  const barcodeSearch = document.getElementById("barcode-search").value.trim();

  const params = new URLSearchParams();
  if (brand) params.append("brand", brand);
  if (category) params.append("category", category);

  const res = await fetch(
    `http://localhost:5000/products?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await res.json();
  let products = data.data || [];

  // Filter by barcode text
  if (barcodeSearch) {
    products = products.filter((p) =>
      p.bar_code?.toString().includes(barcodeSearch)
    );
  }

  const tableBody = document.getElementById("productsTable");
  const cardContainer = document.getElementById("productCards");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  products.forEach((product) => {
    const imageUrl = `http://localhost:5000/images/${product.image_path}`;

    // Table Row
    const row = document.createElement("tr");
    row.innerHTML = `
        <td><img src="${imageUrl}" alt="${product.product_name}" /></td>
        <td>
          ${product.product_name}
          <div class="barcode-text">${product.bar_code || "-"}</div>
          <span class="visability-badge ${
            product.visability === 1 ? "visible-badge" : "hidden-badge"
          }">
            ${product.visability === 1 ? "🟢 Visible" : "🔒 Hidden"}
          </span>
        </td>
        <td>${product.brand}</td>
        <td>${product.category}</td>
        <td>${Utils.Format.currency(product.price)}</td>
        <td>
          <span class="${
            product.availability == "Available"
              ? "available-badge"
              : "not-available-badge"
          }">
            ${product.availability == "Available" ? "🟢" : "🔴"}
          </span>
        </td>

        <td>
          <button class="btn btn-view" onclick="location.href='view-product.html?product_id=${
            product.product_id
          }'">View</button>
         <button class="btn btn-edit" onclick="openProductDialog('edit', ${
           product.product_id
         })">Edit</button>
         <button class="btn btn-copy" onclick="openProductDialog('copy', ${
           product.product_id
         })">Copy</button>
<button class="btn btn-toggle-visability ${
      product.visability === 1 ? "btn-hide" : "btn-show"
    }" onclick="toggleVisability(${product.product_id}, ${product.visability})">
  ${product.visability === 1 ? "Hide" : "Show"}
</button>
          <button class="btn btn-delete" onclick="deleteProduct(${
            product.product_id
          })">Delete</button>
        </td>`;
    tableBody.appendChild(row);

    // Card View
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
        <img src="${imageUrl}" alt="${product.product_name}" />
        <div class="product-card-header">
          ${product.product_name}
          <span class="visability-badge ${
            product.visability === 1 ? "visible-badge" : "hidden-badge"
          }">
            ${product.visability === 1 ? "🟢 Visible" : "🔒 Hidden"}
          </span>
        </div>

        <div class="barcode-text text-center">${product.bar_code || "-"}</div>
        <div class="product-card-body">
          <p><strong>Brand:</strong> ${product.brand}</p>
          <p><strong>Category:</strong> ${product.category}</p>
          <p><strong>Price:</strong> ${Utils.Format.currency(product.price)}</p>
          <p><strong>Availability:</strong> 
            <span class="${
              product.availability == "Available"
                ? "available-badge"
                : "not-available-badge"
            }">
              ${product.availability == "Available" ? "🟢" : "🔴"}
            </span>
          </p>

        </div>
        <div class="product-card-footer text-right">
          <button class="btn btn-view" onclick="location.href='view-product.html?product_id=${
            product.product_id
          }'">View</button>
          <button class="btn btn-edit" onclick="openProductDialog('edit', ${
            product.product_id
          })">Edit</button>
          <button class="btn btn-copy" onclick="openProductDialog('copy', ${
            product.product_id
          })">Copy</button>
           <button class="btn btn-toggle-visability ${
             product.visability === 1 ? "btn-hide" : "btn-show"
           }" onclick="toggleVisability(${product.product_id}, ${
      product.visability
    })">
          ${product.visability === 1 ? "Hide" : "Show"}
          </button>
          
          <button class="btn btn-delete" onclick="deleteProduct(${
            product.product_id
          })">Delete</button>
        </div>`;
    cardContainer.appendChild(card);
  });
}

// Add barcode search event listener
document.getElementById("barcode-search").addEventListener("input", () => {
  const token = localStorage.getItem("access_token");
  fetchAndRenderProducts(token);
});

async function deleteProduct(id) {
  if (!confirm("Are you sure you want to delete this product?")) return;

  const token = localStorage.getItem("access_token");
  try {
    const res = await fetch(`http://localhost:5000/product/delete/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

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

let currentAction = "edit"; // or "copy"

function openProductDialog(action, productId) {
  currentAction = action;
  const modal = document.getElementById("product-modal");
  const form = document.getElementById("product-form");
  const title = document.getElementById("modal-title");
  const errorMsg = document.getElementById("modal-error-message");

  const token = localStorage.getItem("access_token");

  errorMsg.style.display = "none"; // Clear previous error

  fetch(`http://localhost:5000/product/find/${productId}`, {
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
      } else {
        // Clear name and barcode for copy
        document.getElementById("product-name").value = "";
        document.getElementById("bar-code").value = "";
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
        ? `http://localhost:5000/add_product`
        : currentAction === "edit"
        ? `http://localhost:5000/product/edit/${id}`
        : `http://localhost:5000/product/copy/${id}`;
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

  const url = `http://localhost:5000/products/export?${params.toString()}`;
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

  // Require only the XLSX
  if (!xlsxInput.files.length) {
    errorMsg.textContent = "Please select the Excel file to upload.";
    errorMsg.style.display = "block";
    return;
  }

  const formData = new FormData();
  formData.append("file", xlsxInput.files[0]);
  formData.append("mode", selectedImportMode);

  // Append images_zip only if the user picked one
  if (zipInput.files.length) {
    formData.append("images_zip", zipInput.files[0]);
  }

  try {
    const res = await fetch(
      `http://localhost:5000/products/import?mode=${selectedImportMode}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      }
    );
    const result = await res.json();

    if (res.ok) {
      alert(
        "Import successful: Added " + result.added + " Updated:" + result.updated
      );
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
      `http://localhost:5000/products/set_visability/${productId}/${newVisability}`,
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
  document.getElementById("image-note").style.display = "none"; // Only needed for edit/copy

  modal.style.display = "flex";
}
