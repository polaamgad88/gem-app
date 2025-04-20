let currentEditAddressId = null;
document.addEventListener("DOMContentLoaded", async function () {
  const customerId = new URLSearchParams(window.location.search).get(
    "customer_id"
  );
  const token = localStorage.getItem("access_token");

  if (!customerId || !token) {
    alert("Missing customer ID or access token.");
    return;
  }

  await loadCustomerDetails(customerId, token);
  await setupAddDelegateDropdown(token);

  toggleOrderViews();
  window.addEventListener("resize", toggleOrderViews);
  document.getElementById("edit-customer-btn").addEventListener("click", () => {
    document.getElementById("edit-name").value =
      document.getElementById("customer-name").textContent;
    document.getElementById("edit-phone").value =
      document.getElementById("customer-phone").textContent;
    document.getElementById("edit-email").value =
      document.getElementById("customer-email").textContent;

    document.getElementById("edit-customer-modal").style.display = "block";
  });

  document
    .getElementById("edit-customer-close")
    .addEventListener("click", () => {
      document.getElementById("edit-customer-modal").style.display = "none";
    });
  document
    .getElementById("save-customer-btn")
    .addEventListener("click", async () => {
      const token = localStorage.getItem("access_token");
      const customerId = new URLSearchParams(window.location.search).get(
        "customer_id"
      );

      const fullName = document.getElementById("edit-name").value.trim();
      const phone = document.getElementById("edit-phone").value.trim();
      const email = document.getElementById("edit-email").value.trim();

      const [first_name, ...last_name_parts] = fullName.split(" ");
      const last_name = last_name_parts.join(" ");

      const res = await fetch(
        `http://localhost:5000/customers/edit/${customerId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            first_name,
            last_name,
            phone,
            email,
          }),
        }
      );

      const data = await res.json();
      if (res.ok) {
        document.getElementById("edit-customer-modal").style.display = "none";
        document.getElementById("customer-name").textContent = fullName;
        document.getElementById("customer-phone").textContent = phone;
        document.getElementById("customer-email").textContent = email;
      } else {
        alert(data.message || "Failed to update customer details");
      }
    });

  // Modal interactions
  document.getElementById("add-delegate-btn").addEventListener("click", () => {
    document.getElementById("delegate-modal").style.display = "block";
  });

  document.querySelector(".close-btn").addEventListener("click", () => {
    document.getElementById("delegate-modal").style.display = "none";
  });

  document
    .getElementById("save-delegate-btn")
    .addEventListener("click", async () => {
      const userId = document.getElementById("delegate-dropdown").value;
      const username =
        document.getElementById("delegate-dropdown").selectedOptions[0].text;

      const res = await fetch("http://localhost:5000/customers/assign", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer_id: customerId,
          target_user_id: userId,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        addDelegateToList(userId, username);
        document.getElementById("delegate-modal").style.display = "none";
      } else {
        alert(data.message || "Failed to assign delegate");
      }
    });
  document.getElementById("address-save-btn").addEventListener("click", () => {
    const address = document.getElementById("address-input").value.trim();
    const token = localStorage.getItem("access_token");
    const customerId = new URLSearchParams(window.location.search).get(
      "customer_id"
    );

    if (!address) return alert("Address cannot be empty");

    let url = "";
    let method = "POST";
    let body = new URLSearchParams();

    if (currentEditAddressId) {
      // Edit mode
      url = `http://localhost:5000/customers/address/edit/${currentEditAddressId}`;
      body.append("address", address);
    } else {
      // Create mode
      url = `http://localhost:5000/customers/address/create`;
      body.append("customer_id", customerId);
      body.append("address", address);
    }

    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.message?.includes("success")) {
          loadCustomerAddresses(customerId, token);
          document.getElementById("address-modal").style.display = "none";
          document.getElementById("address-input").value = "";
          currentEditAddressId = null;
        } else {
          alert(data.message || "Operation failed.");
        }
      });
  });

  document.getElementById("address-close").addEventListener("click", () => {
    document.getElementById("address-modal").style.display = "none";
    currentEditAddressId = null;
  });

  document.getElementById("add-address-btn")?.addEventListener("click", () => {
    currentEditAddressId = null;
    document.getElementById("address-input").value = "";
    document.getElementById("address-modal").style.display = "block";
  });
});
async function loadCustomerAddresses(customerId, token) {
  try {
    const res = await fetch(
      `http://localhost:5000/customers/${customerId}/addresses`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) throw new Error("Failed to load addresses");
    const data = await res.json();

    const ul = document.getElementById("address-list");
    ul.innerHTML = "";

    (data.addresses || []).forEach((addr) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${addr.address}</span>
        <div class="address-actions">
          <button class="edit-btn" onclick="editAddress(${addr.address_id}, '${addr.address}')">Edit</button>
          <button class="delete-btn" onclick="deleteAddress(${addr.address_id})">Delete</button>
        </div>
      `;

      ul.appendChild(li);
    });
  } catch (err) {
    console.error("Error loading addresses:", err);
  }
}
async function loadCustomerDetails(customerId, token) {
  try {
    const [custRes, ordersRes] = await Promise.all([
      fetch(`http://localhost:5000/customer/find/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`http://localhost:5000/orders?customer_id=${customerId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const customer = (await custRes.json()).customer;
    const orders = (await ordersRes.json()).orders || [];

    document.getElementById(
      "customer-name"
    ).textContent = `${customer.first_name} ${customer.last_name}`;
    document.getElementById(
      "customer-id"
    ).textContent = `CUST-${customer.customer_id}`;
    document.getElementById("customer-phone").textContent = customer.phone;
    document.getElementById("customer-email").textContent = customer.email;

    const list = document.getElementById("delegate-list");
    list.innerHTML = "";
    customer.assigned_users.forEach(({ user_id, username }) => {
      addDelegateToList(user_id, username);
    });

    const tbody = document.getElementById("order-list");
    let total = 0;
    tbody.innerHTML = "";

    orders
      .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
      .forEach((o, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${o.order_id}</td>
          <td>${new Date(o.order_date).toISOString().slice(0, 10)}</td>
          <td>${o.username}</td>
          <td>${o.status}</td>
          <td class="price">EGP${parseFloat(o.total_amount).toFixed(2)}</td>
          <td><button class="view-btn" onclick="viewOrder(${
            o.order_id
          })">View</button></td>`;
        tbody.appendChild(tr);

        if (!["refunded", "canceled"].includes(o.status.toLowerCase())) {
          total += parseFloat(o.total_amount);
        }
      });

    document.getElementById("total-income").textContent = `EGP${total.toFixed(
      2
    )}`;
    await loadCustomerAddresses(customerId, token);

    renderOrderCards(orders);
  } catch (err) {
    console.error("Failed to load customer info", err);
  }
}

function renderOrderCards(orders) {
  const cardsContainer = document.getElementById("ordersCards");
  cardsContainer.innerHTML = "";

  orders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
        <div class="order-card-header">
          <span>Order #${order.order_id}</span>
          <span>${new Date(order.order_date).toISOString().slice(0, 10)}</span>
        </div>
        <div class="order-card-body">
          <p><strong>Delegate:</strong> ${order.username}</p>
          <p><strong>Status:</strong> ${order.status}</p>
          <p><strong>Total:</strong> EGP${parseFloat(
            order.total_amount
          ).toFixed(2)}</p>
        </div>
        <div class="order-card-footer">
          <button class="view-btn" onclick="viewOrder(${
            order.order_id
          })">View</button>
        </div>`;
    cardsContainer.appendChild(card);
  });
}

function toggleOrderViews() {
  const table = document.querySelector("table");
  const cardView = document.querySelector(".card-view");

  if (window.innerWidth <= 768) {
    table.style.display = "none";
    cardView.style.display = "block";
  } else {
    table.style.display = "table";
    cardView.style.display = "none";
  }
}

async function setupAddDelegateDropdown(token) {
  try {
    const res = await fetch("http://localhost:5000/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = (await res.json()).users;
    const select = document.getElementById("delegate-dropdown");
    select.innerHTML = "";

    users.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.user_id;
      opt.textContent = u.username;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error("Failed to fetch users:", err);
  }
}

function addDelegateToList(userId, username) {
  const li = document.createElement("li");
  li.innerHTML = `
      ${username}
      <button class="remove-btn" onclick="removeDelegate(${userId}, '${username}')">
        <i class="fas fa-trash-alt"></i>
      </button>`;
  document.getElementById("delegate-list").appendChild(li);
}

async function removeDelegate(userId, username) {
  const token = localStorage.getItem("access_token");
  const customerId = new URLSearchParams(window.location.search).get(
    "customer_id"
  );

  if (!confirm(`Are you sure you want to remove ${username}?`)) return;

  try {
    const res = await fetch("http://localhost:5000/customers/deassign", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer_id: customerId,
        target_user_id: userId,
      }),
    });

    if (res.ok) {
      [...document.getElementById("delegate-list").children].forEach((li) => {
        if (li.textContent.includes(username)) li.remove();
      });
    } else {
      const data = await res.json();
      alert(data.message || "Failed to remove delegate");
    }
  } catch (err) {
    console.error("Failed to remove delegate", err);
    alert("Error occurred while removing delegate.");
  }
}

function viewOrder(orderId) {
  window.location.href = `view-order.html?order_id=${orderId}`;
}
// Handle Edit Address (modal)
function editAddress(addressId, oldValue) {
  currentEditAddressId = addressId;
  document.getElementById("address-input").value = oldValue;
  document.getElementById("address-modal").style.display = "block";
}

// Handle Delete Address
function deleteAddress(addressId) {
  const token = localStorage.getItem("access_token");
  if (!confirm("Are you sure you want to delete this address?")) return;

  fetch(`http://localhost:5000/customers/address/delete/${addressId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.message?.includes("success")) {
        const customerId = new URLSearchParams(window.location.search).get(
          "customer_id"
        );
        loadCustomerAddresses(customerId, token);
      } else {
        alert(data.message || "Failed to delete address.");
      }
    });
}
