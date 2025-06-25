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

  const res = await fetch(`https://order-app.gemegypt.net/api/orders/find/${orderId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch order details.");
  }
  return await res.json();
}

function populateOrderDetails(order) {
  document.getElementById("orderId").textContent = `#${order.order_id}`;
  document.getElementById("order-id").textContent = `#${order.order_id}`;
  document.getElementById("order-date").textContent = Utils.Format.date(order.order_date);


  const orderState = document.getElementById("order-state");
  orderState.textContent = order.status;
  // orderState.className = `state ${order.status.toLowerCase()}`;

  document.getElementById("order-state").textContent = order.status;
  document.getElementById("delegate-name").textContent = order.username;
  document.getElementById("customer-name").textContent = order.customer_name;
  document.getElementById(
    "customer-id"
  ).textContent = `CUST-${order.customer_id}`;
  document.getElementById("customer-address").textContent = order.address;

  const itemsTableBody = document.getElementById("items-table-body");
  const itemsCardView = document.getElementById("items-card-view");
  itemsTableBody.innerHTML = "";
  itemsCardView.innerHTML = "";

  let total = 0;

  order.items.forEach((item) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    total += itemTotal;

    const imageUrl = item.image_path
      ? `https://order-app.gemegypt.net/api/images/${item.image_path}`
      : "";

    const barCodeLine = `<div style="font-size: 0.8em; color: gray;">${
      item.bar_code || "-"
    }</div>`;

    // Table view row
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${item.product_name}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;">`
            : "No image"
        }
      </td>
      <td>
        ${item.product_name}
        ${barCodeLine}
      </td>
      <td>EGP ${parseFloat(item.price).toLocaleString()}</td>
      <td>${item.quantity}</td>
      <td>EGP ${itemTotal.toLocaleString()}</td>
    `;
    itemsTableBody.appendChild(row);

    // Card view
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      <div class="item-card-header">
        ${
          imageUrl
            ? `<img src="${imageUrl}" alt="${item.product_name}">`
            : "<div style='width:50px;height:50px;background:#eee;display:flex;align-items:center;justify-content:center;border-radius:4px;'>No img</div>"
        }
        <div>
          <h3 style="margin:0">${item.product_name}</h3>
          ${barCodeLine}
        </div>
      </div>
      <div class="item-card-body">
        <p><span class="item-card-label">Price:</span> EGP ${parseFloat(
          item.price
        ).toLocaleString()}</p>
        <p><span class="item-card-label">Quantity:</span> ${item.quantity}</p>
        <p><span class="item-card-label">Total:</span> EGP ${itemTotal.toLocaleString()}</p>
      </div>
    `;
    itemsCardView.appendChild(card);
  });

  document.getElementById("total-price").textContent = `EGP ${total.toLocaleString()}`;
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
          `https://order-app.gemegypt.net/api/orders/confirm/${orderId}`,
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
          `https://order-app.gemegypt.net/api/orders/refund/${orderId}`,
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
