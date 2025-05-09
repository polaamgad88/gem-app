document.addEventListener("DOMContentLoaded", async function () {
  // Get elements
  const orderId = Utils.URL.getParam("order_id");

  // Check authentication
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  // Set up event listeners for action buttons
  setupActionButtons(orderId, token);

  // Load and display order details
  try {
    const order = await fetchOrderDetails(orderId, token);
    populateOrderDetails(order);

    // Check screen size and toggle view if needed
    Utils.UI.checkScreenSize();
    window.addEventListener("resize", Utils.UI.checkScreenSize);
  } catch (err) {
    console.error("Error loading order:", err);
    alert("Something went wrong while loading the order details.");
  }
});

// Helper function to fetch order details
async function fetchOrderDetails(orderId, token) {
  if (!orderId) {
    throw new Error("No order ID specified.");
  }

  const res = await fetch(`http://localhost:5000/orders/find/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch order details.");
  }
  return await res.json();
}

// Helper function to populate order details
function populateOrderDetails(order) {
  // Header
  console.log(order);
  document.getElementById("orderId").textContent = `#${order.order_id}`;
  document.getElementById("order-id").textContent = `#${order.order_id}`;
  document.getElementById("order-date").textContent = Utils.Format.date(
    order.order_date
  );

  // Status
  const orderState = document.getElementById("order-state");
  orderState.textContent = order.status;
  orderState.className = `state ${order.status.toLowerCase()}`;

  // Delegate
  document.getElementById("delegate-name").textContent = order.username;

  // Customer Info
  document.getElementById("customer-name").textContent = order.customer_name;
  document.getElementById(
    "customer-id"
  ).textContent = `CUST-${order.customer_id}`;
  document.getElementById("customer-address").textContent = order.address;

  // Items - Table View
  const itemsTableBody = document.getElementById("items-table-body");
  itemsTableBody.innerHTML = "";

  // Items - Card View
  const itemsCardView = document.getElementById("items-card-view");
  itemsCardView.innerHTML = "";

  let total = 0;

  order.items.forEach((item) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    total += itemTotal;

    const imageUrl = item.image_path
      ? `http://localhost:5000/images/${item.image_path}`
      : "";

    // Add table row
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${item.product_name}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`
            : "No image"
        }
      </td>
      <td>${item.product_name}</td>
      <td>EGP ${parseFloat(item.price).toFixed(2)}</td>
      <td>${item.quantity}</td>
      <td>EGP ${itemTotal.toFixed(2)}</td>
    `;
    itemsTableBody.appendChild(row);

    // Add card for mobile view
    const card = document.createElement("div");
    card.className = "item-card";
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
        <p><span class="item-card-label">Price:</span> EGP ${parseFloat(
          item.price
        ).toFixed(2)}</p>
        <p><span class="item-card-label">Quantity:</span> ${item.quantity}</p>
        <p><span class="item-card-label">Total:</span> EGP ${itemTotal.toFixed(
          2
        )}</p>
      </div>
    `;
    itemsCardView.appendChild(card);
  });

  // Total
  document.getElementById("total-price").textContent = `EGP ${total.toFixed(
    2
  )}`;
}

// Helper function to set up action buttons
function setupActionButtons(orderId, token) {
  document.getElementById("edit-order").addEventListener("click", () => {
    window.location.href = "edit-order.html?order_id=" + orderId;
  });

  document
    .getElementById("confirm-order")
    .addEventListener("click", async () => {
      if (!orderId) {
        alert("Order ID not found in the URL.");
        return;
      }

      try {
        const response = await fetch(
          `http://localhost:5000/orders/confirm/${orderId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (response.ok) {
          alert(data.message || "✅ Order confirmed successfully!");
          location.reload();
        } else {
          alert(data.message || "❌ Failed to confirm order.");
        }
      } catch (error) {
        console.error("Error confirming order:", error);
        alert("❌ An unexpected error occurred.");
      }
    });

  const refundBtn = document.getElementById("refund-order");
  if (refundBtn) {
    refundBtn.addEventListener("click", async () => {
      if (!orderId) {
        alert("Order ID not found in the URL.");
        return;
      }

      const confirm = window.confirm(
        "Are you sure you want to refund this order?"
      );
      if (!confirm) return;

      try {
        const response = await fetch(
          `http://localhost:5000/orders/refund/${orderId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (response.ok) {
          alert(data.message || "✅ Order refunded successfully!");
          location.reload(); // Refresh to reflect new status
        } else {
          alert(data.message || "❌ Failed to refund order.");
        }
      } catch (err) {
        console.error("Refund error:", err);
        alert("❌ An unexpected error occurred during refund.");
      }
    });
  }
}
