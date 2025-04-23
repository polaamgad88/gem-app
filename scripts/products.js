document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

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
        </td>
        <td>${product.brand}</td>
        <td>${product.category}</td>
        <td>${Utils.Format.currency(product.price)}</td>
        <td>
          <button class="btn btn-view" onclick="location.href='view-product.html?product_id=${
            product.product_id
          }'">View</button>
          <button class="btn btn-edit" onclick="location.href='edit-product.html?product_id=${
            product.product_id
          }'">Edit</button>
          <button class="btn btn-copy" onclick="location.href='copy-product.html?product_id=${
            product.product_id
          }'">Copy</button>
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
        <div class="product-card-header">${product.product_name}</div>
        <div class="barcode-text text-center">${product.bar_code || "-"}</div>
        <div class="product-card-body">
          <p><strong>Brand:</strong> ${product.brand}</p>
          <p><strong>Category:</strong> ${product.category}</p>
          <p><strong>Price:</strong> ${Utils.Format.currency(product.price)}</p>
        </div>
        <div class="product-card-footer text-right">
          <button class="btn btn-view" onclick="location.href='view-product.html?product_id=${
            product.product_id
          }'">View</button>
          <button class="btn btn-edit" onclick="location.href='edit-product.html?product_id=${
            product.product_id
          }'">Edit</button>
          <button class="btn btn-copy" onclick="location.href='copy-product.html?product_id=${
            product.product_id
          }'">Copy</button>
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
