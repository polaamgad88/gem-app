document.addEventListener("DOMContentLoaded", async function () {
  // Initialize state
  let sortOrder = {
    date: true,
    price: true,
  };
  
  let allOrders = [];

  // Check authentication
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  // Show loader while fetching data
  Utils.UI.showLoader();

  // Set up event listeners
  setupEventListeners();
  
  // Fetch and render orders
  try {
    await populateUsers(token);
    await fetchAndRenderOrders(token);
  } catch (err) {
    console.error("Error loading orders:", err);
    Utils.UI.showError("Failed to load orders. Please try again.");
  } finally {
    Utils.UI.hideLoader();
  }
  
  // Check screen size and toggle view if needed
  Utils.UI.checkScreenSize();
  window.addEventListener('resize', Utils.UI.checkScreenSize);

  // Helper function to set up event listeners
  function setupEventListeners() {
    document.getElementById("userFilter").addEventListener("change", async () => {
      Utils.UI.showLoader();
      await fetchAndRenderOrders(token);
      Utils.UI.hideLoader();
    });

    document.getElementById("customerFilter").addEventListener("change", () => {
      filterOrdersByCustomer();
    });
  }

  // Helper function to populate users dropdown
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
      throw err;
    }
  }

  // Helper function to fetch and render orders
  async function fetchAndRenderOrders(token) {
    Utils.UI.showLoader();

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
      const cardsContainer = document.getElementById("ordersCards");
      tableBody.innerHTML = "";
      cardsContainer.innerHTML = "";

      if (!res.ok) {
        allOrders = [];
        renderNoOrders();
        resetCustomerFilter();
        return;
      }

      const data = await res.json();
      allOrders = data.orders || [];

      if (allOrders.length === 0) {
        renderNoOrders();
        resetCustomerFilter();
        return;
      }

      populateCustomerFilter(allOrders);
      renderOrders(allOrders);
    } catch (err) {
      console.error("Order fetch error:", err);
      renderNoOrders();
      resetCustomerFilter();
      throw err;
    } finally {
      Utils.UI.hideLoader();
    }
  }

  // Helper function to populate customer filter
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

  // Helper function to reset customer filter
  function resetCustomerFilter() {
    const customerFilter = document.getElementById("customerFilter");
    customerFilter.innerHTML = `<option value="all">All Customers</option>`;
  }

  // Helper function to filter orders by customer
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

  // Helper function to render orders
  function renderOrders(orders) {
    // Render table view
    const tableBody = document.getElementById("ordersTable");
    tableBody.innerHTML = "";

    // Render card view
    const cardsContainer = document.getElementById("ordersCards");
    cardsContainer.innerHTML = "";

    orders.forEach((order, index) => {
      // Table row
      const row = document.createElement("tr");
      row.innerHTML = `
          <td>${index + 1}</td>
          <td>${order.order_id}</td>
          <td>${Utils.Format.dateSlash(order.order_date)}</td>
          <td>${order.customer_name}</td>
          <td>${order.username}</td>
          <td>${order.role}</td>
          <td><span class="status-${order.status.toLowerCase()}">${order.status}</span></td>
          <td>EGP${order.total_amount}</td>
          <td><button class="view-btn" data-order-id="${
            order.order_id
          }">View</button></td>
        `;
      tableBody.appendChild(row);
      
      // Card view for mobile
      const card = document.createElement("div");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-header">
          <span>Order #${order.order_id}</span>
          <span>${Utils.Format.dateSlash(order.order_date)}</span>
        </div>
        <div class="order-card-body">
          <p><span class="order-card-label">Customer:</span> ${order.customer_name}</p>
          <p><span class="order-card-label">Delegate:</span> ${order.username}</p>
          <p><span class="order-card-label">Status:</span> <span class="status-${order.status.toLowerCase()}">${order.status}</span></p>
          <p><span class="order-card-label">Total:</span> EGP${order.total_amount}</p>
        </div>
        <div class="order-card-footer">
          <button class="view-btn" data-order-id="${order.order_id}">View Details</button>
        </div>
      `;
      cardsContainer.appendChild(card);
    });

    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.orderId;
        window.location.href = `view-order.html?order_id=${id}`;
      });
    });
  }

  // Helper function to render no orders message
  function renderNoOrders() {
    const tableBody = document.getElementById("ordersTable");
    tableBody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px;">No orders available</td></tr>`;
    
    const cardsContainer = document.getElementById("ordersCards");
    cardsContainer.innerHTML = `<div style="text-align: center; padding: 20px;">No orders available</div>`;
  }

  // Sort table function
  window.sortTable = function(colIndex, type) {
    let table = document.getElementById("ordersTable");
    let rows = Array.from(table.rows);

    if (rows.length === 1 && rows[0].cells[0].colSpan === 9) return;

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
    
    // Also sort the card view
    sortCards(type);
  };

  // Helper function to sort cards
  function sortCards(type) {
    const cardsContainer = document.getElementById("ordersCards");
    const cards = Array.from(cardsContainer.children);
    
    cards.sort((cardA, cardB) => {
      if (type === "date") {
        const dateA = new Date(cardA.querySelector(".order-card-header").children[1].innerText);
        const dateB = new Date(cardB.querySelector(".order-card-header").children[1].innerText);
        return sortOrder.date ? dateA - dateB : dateB - dateA;
      }
      
      if (type === "price") {
        const priceTextA = cardA.querySelector(".order-card-body").lastElementChild.innerText;
        const priceTextB = cardB.querySelector(".order-card-body").lastElementChild.innerText;
        const priceA = parseFloat(priceTextA.replace("Total: EGP", ""));
        const priceB = parseFloat(priceTextB.replace("Total: EGP", ""));
        return sortOrder.price ? priceA - priceB : priceB - priceA;
      }
    });
    
    cards.forEach(card => cardsContainer.appendChild(card));
  }
});
