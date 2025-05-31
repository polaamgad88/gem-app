let token;
let currentPage = 1;
let totalPages = 1;
let allCustomers = [];
let searchTerm = "";

document.addEventListener("DOMContentLoaded", async function () {
  token = await Utils.Auth.requireAuth(); // <== assign it here
  if (!token) return;

  Utils.UI.checkScreenSize();
  window.addEventListener("resize", Utils.UI.checkScreenSize);

  const customersData = await fetchCustomers(token, currentPage);
  renderCustomers(customersData);
  renderPagination();

  document.getElementById("add-customer-btn").addEventListener("click", () => {
    window.location.href = "create-customer.html"; // to be created
  });

  document
    .getElementById("customer-search")
    .addEventListener("input", async function () {
      searchTerm = this.value.trim();
      //.toLowerCase(); // <- Update global searchTerm
      currentPage = 1; // <- Reset to first page
      const customersData = await fetchCustomers(
        token,
        currentPage,
        searchTerm
      );
      renderCustomers(customersData);
      renderPagination();
    });
});

function renderPagination() {
  const containerId = "pagination";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.className = "pagination-controls";
    document.querySelector(".container").appendChild(container);
  }

  container.innerHTML = "";

  const maxButtons = 10;
  const half = Math.floor(maxButtons / 2);
  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, start + maxButtons - 1);
  if (end - start < maxButtons) start = Math.max(1, end - maxButtons + 1);

  const createBtn = (text, page, disabled = false, active = false) => {
    const btn = document.createElement("button");
    btn.textContent = text;
    if (disabled) btn.disabled = true;
    if (active) btn.classList.add("active");
    btn.addEventListener("click", async () => {
      const customersData = await fetchCustomers(token, page, searchTerm);
      renderCustomers(customersData);
      renderPagination();
    });
    return btn;
  };

  container.appendChild(createBtn("◀", currentPage - 1, currentPage === 1));

  for (let i = start; i <= end; i++) {
    container.appendChild(createBtn(i, i, false, i === currentPage));
  }

  container.appendChild(
    createBtn("▶", currentPage + 1, currentPage === totalPages)
  );
}

async function fetchCustomers(token, page = 1, search = "") {
  try {
    const query = new URLSearchParams({
      page,
      limit: 10,
    });

    if (search) query.append("search", search);

    const res = await fetch(
      `https://order-app.gemegypt.net/api/customers?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const data = await res.json();

    currentPage = data.page || 1;
    totalPages = data.pages || 1;
    allCustomers = data.customers || [];

    return allCustomers;
  } catch (err) {
    console.error("Failed to fetch customers:", err);
    return [];
  }
}

function renderCustomers(customers) {
  const tableBody = document.getElementById("customersTable");
  const cardContainer = document.getElementById("customerCards");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  customers.forEach((c, index) => {
    const fullName = `${c.first_name} ${c.last_name}`;
    // Table Row
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${c.code}</td>
        <td>${fullName}</td>
        <td>${c.phone || "-"}</td>
        <td>
          <button class="btn-view" onclick="window.location.href='view-customer.html?customer_id=${
            c.customer_id
          }'">View</button>
        </td>`;
    tableBody.appendChild(row);

    // Card
    const card = document.createElement("div");
    card.className = "customer-card";
    card.innerHTML = `
        <div class="customer-card-header">
          <span>${fullName}</span>
          <span>#${c.customer_id}</span>
        </div>
        <div class="customer-card-body">
          <p><span class="customer-card-label">Phone:</span> ${
            c.phone || "-"
          }</p>
        </div>
        <div class="customer-card-footer">
          <button class="btn-view" onclick="window.location.href='view-customer.html?customer_id=${
            c.customer_id
          }'">View</button>
        </div>`;
    cardContainer.appendChild(card);
  });
}
