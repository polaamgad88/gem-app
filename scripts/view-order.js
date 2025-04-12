document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("edit-order").addEventListener("click", () => {
    alert("Redirect to edit page or enable edit mode.");
  });

  document
    .getElementById("confirm-order")
    .addEventListener("click", async () => {
      const token = localStorage.getItem("access_token");
      const urlParams = new URLSearchParams(window.location.search);
      const orderId = urlParams.get("order_id");

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
      const token = localStorage.getItem("access_token");
      const urlParams = new URLSearchParams(window.location.search);
      const orderId = urlParams.get("order_id");

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
  const token = localStorage.getItem("access_token");
  if (!token || !(await checkLogin(token))) {
    window.location.href = "login.html";
    return;
  }

  const orderId = getOrderIdFromUrl();
  if (!orderId) {
    alert("No order ID specified.");
    return;
  }

  try {
    const res = await fetch(`http://localhost:5000/orders/find/${orderId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      alert("Failed to fetch order details.");
      return;
    }

    const order = await res.json();
    populateOrderDetails(order);
  } catch (err) {
    console.error("Error loading order:", err);
    alert("Something went wrong.");
  }
});

function getOrderIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("order_id");
}

async function checkLogin(token) {
  try {
    const res = await fetch("http://localhost:5000/checklogin", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function populateOrderDetails(order) {
  // Header
  document.getElementById("orderId").textContent = `#${order.order_id}`;
  document.getElementById("order-id").textContent = `#${order.order_id}`;
  document.getElementById("order-date").textContent = formatDate(
    order.order_date
  );
  document.getElementById("order-state").textContent = order.status;
  document.getElementById("order-state").className = `state ${order.status}`;

  // Delegate
  document.getElementById("delegate-name").textContent = order.username;

  // Customer Info
  document.getElementById("customer-name").textContent = order.customer_name;
  document.getElementById(
    "customer-id"
  ).textContent = `CUST-${order.customer_id}`;
  document.getElementById("customer-address").textContent = order.address;

  // Items
  const tbody = document.querySelector(".items-list tbody");
  tbody.innerHTML = "";

  let total = 0;
  order.items.forEach((item) => {
    const itemTotal = parseFloat(item.price) * item.quantity;
    total += itemTotal;

    const imageUrl = item.image_path
      ? `http://localhost:5000/images/${item.image_path}`
      : "";

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
      <td>${item.quantity}</td>
      <td>EGP ${parseFloat(item.price).toFixed(2)}</td>
      <td>EGP ${itemTotal.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });

  // Total
  document.getElementById("total-price").textContent = `EGP ${total.toFixed(
    2
  )}`;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
}
