let sortOrder = {
  date: true,
  price: true,
};

let allOrders = [];

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("access_token");
  if (!token) return (window.location.href = "login.html");

  showLoader();

  const isValid = await validateSession(token);
  if (!isValid) return (window.location.href = "login.html");

  await populateUsers(token);
  await fetchAndRenderOrders(token);

  hideLoader();

  document.getElementById("userFilter").addEventListener("change", async () => {
    showLoader();
    await fetchAndRenderOrders(token);
    hideLoader();
  });

  document.getElementById("customerFilter").addEventListener("change", () => {
    filterOrdersByCustomer();
  });
});

async function validateSession(token) {
  try {
    const res = await fetch("http://localhost:5000/checklogin", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return res.ok;
  } catch (err) {
    console.error("Session check failed:", err);
    return false;
  }
}

async function populateUsers(token) {
  try {
    const res = await fetch("http://localhost:5000/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) throw new Error("Failed to fetch users");

    const data = await res.json();
    const userFilter = document.getElementById("userFilter");

    userFilter.innerHTML = `<option value="all">All Users</option>`;

    data.users.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.user_id;
      option.textContent = user.username;
      userFilter.appendChild(option);
    });
  } catch (err) {
    console.error("User fetch error:", err);
  }
}

async function fetchAndRenderOrders(token) {
  showLoader();

  const userId = document.getElementById("userFilter").value;
  let url = "http://localhost:5000/orders";
  if (userId !== "all") {
    url += `?user_id=${userId}`;
  }

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const tableBody = document.getElementById("ordersTable");
    tableBody.innerHTML = "";

    if (!res.ok) {
      allOrders = [];
      renderNoOrders();
      resetCustomerFilter();
      hideLoader();
      return;
    }

    const data = await res.json();
    allOrders = data.orders || [];

    if (allOrders.length === 0) {
      renderNoOrders();
      resetCustomerFilter();
      hideLoader();
      return;
    }

    populateCustomerFilter(allOrders);
    renderOrders(allOrders);
  } catch (err) {
    console.error("Order fetch error:", err);
    renderNoOrders();
    resetCustomerFilter();
  }

  hideLoader();
}

function populateCustomerFilter(orders) {
  const customerFilter = document.getElementById("customerFilter");
  customerFilter.innerHTML = `<option value="all">All Customers</option>`;

  const customerSet = new Set();
  orders.forEach((order) => {
    customerSet.add(order.customer_id);
  });

  customerSet.forEach((id) => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = `Customer #${id}`;
    customerFilter.appendChild(option);
  });
}

function resetCustomerFilter() {
  const customerFilter = document.getElementById("customerFilter");
  customerFilter.innerHTML = `<option value="all">All Customers</option>`;
}

function filterOrdersByCustomer() {
  const selectedCustomer = document.getElementById("customerFilter").value;
  if (selectedCustomer === "all") {
    renderOrders(allOrders);
  } else {
    const filtered = allOrders.filter(
      (order) => order.customer_id.toString() === selectedCustomer
    );
    renderOrders(filtered);
  }
}

function renderOrders(orders) {
  const tableBody = document.getElementById("ordersTable");
  tableBody.innerHTML = "";

  orders.forEach((order, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td>${index + 1}</td>
        <td>${order.order_id}</td>
        <td>${formatDate(order.order_date)}</td>
        <td>${order.customer_id}</td>
        <td>${order.username}</td>
        <td>${order.role}</td>
        <td>EGP${order.total_amount}</td>
        <td><button class="view-btn" data-order-id="${
          order.order_id
        }">View</button></td>
      `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.orderId;
      window.location.href = `view-order.html?order_id=${id}`;
    });
  });
}

function renderNoOrders() {
  const tableBody = document.getElementById("ordersTable");
  tableBody.innerHTML = `<tr><td colspan="7">No orders available</td></tr>`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function sortTable(colIndex, type) {
  let table = document.getElementById("ordersTable");
  let rows = Array.from(table.rows);

  if (rows.length === 1 && rows[0].cells[0].colSpan === 7) return;

  rows.sort((rowA, rowB) => {
    let valA = rowA.cells[colIndex].innerText.trim();
    let valB = rowB.cells[colIndex].innerText.trim();

    if (type === "date") {
      let dateA = new Date(valA);
      let dateB = new Date(valB);
      return sortOrder.date ? dateA - dateB : dateB - dateA;
    }

    if (type === "price") {
      let numA = parseFloat(valA.replace("EGP", ""));
      let numB = parseFloat(valB.replace("EGP", ""));
      return sortOrder.price ? numA - numB : numB - numA;
    }
  });

  sortOrder[type] = !sortOrder[type];
  rows.forEach((row) => table.appendChild(row));
}

function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";
}

function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}
