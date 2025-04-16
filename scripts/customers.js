document.addEventListener("DOMContentLoaded", async function () {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  Utils.UI.checkScreenSize();
  window.addEventListener("resize", Utils.UI.checkScreenSize);

  const customersData = await fetchCustomers(token);
  renderCustomers(customersData);

  document.getElementById("add-customer-btn").addEventListener("click", () => {
    window.location.href = "create-customer.html"; // to be created
  });

  document
    .getElementById("customer-search")
    .addEventListener("input", function () {
      const keyword = this.value.toLowerCase();
      const filtered = customersData.filter(
        (c) =>
          c.first_name.toLowerCase().includes(keyword) ||
          c.last_name.toLowerCase().includes(keyword) ||
          c.phone?.toLowerCase().includes(keyword)
      );
      renderCustomers(filtered);
    });
});

async function fetchCustomers(token) {
  try {
    const res = await fetch("http://localhost:5000/customers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.customers || [];
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
        <td>${index + 1}</td>
        <td>${fullName}</td>
        <td>${c.phone || "-"}</td>
        <td>
          <button class="btn-view" onclick="window.location.href='view-customer.html?customer_id=${
            c.customer_id
          }'">View</button>
          <button class="btn-edit" onclick="window.location.href='edit-customer.html?customer_id=${
            c.customer_id
          }'">Edit</button>
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
          <button class="btn-edit" onclick="window.location.href='edit-customer.html?customer_id=${
            c.customer_id
          }'">Edit</button>
        </div>`;
    cardContainer.appendChild(card);
  });
}
