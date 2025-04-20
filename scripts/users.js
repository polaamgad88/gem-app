document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("access_token");
  if (!token) return alert("Not authenticated");

  await loadUsers(token);

  document.getElementById("create-user-btn").addEventListener("click", () => {
    window.location.href = "create-user.html";
  });

  toggleView();
  window.addEventListener("resize", toggleView);
});

async function loadUsers(token) {
  try {
    const res = await fetch("http://localhost:5000/users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    const users = data.users || [];

    const tableBody = document.getElementById("users-table-body");
    const cardContainer = document.getElementById("user-cards");

    tableBody.innerHTML = "";
    cardContainer.innerHTML = "";

    users.forEach((user, index) => {
      // Table Row
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>${user.assigned_to || "—"}</td>
          <td>${user.email || "—"}</td>
          <td>${user.phone || "—"}</td>
          <td>
            <button class="view-btn" onclick="viewUser(${
              user.user_id
            })">View</button>
            <button class="delete-btn" onclick="deleteUser(${
              user.user_id
            })">Delete</button>
          </td>
        `;
      tableBody.appendChild(tr);

      // Card View
      const card = document.createElement("div");
      card.className = "user-card";
      card.innerHTML = `
          <p><strong>Username:</strong> ${user.username}</p>
          <p><strong>Role:</strong> ${user.role}</p>
          <p><strong>Assigned To:</strong> ${user.assigned_to || "—"}</p>
          <p><strong>Email:</strong> ${user.email || "—"}</p>
          <p><strong>Phone:</strong> ${user.phone || "—"}</p>
          <div class="card-actions">
            <button class="view-btn" onclick="viewUser(${
              user.user_id
            })">View</button>
            <button class="delete-btn" onclick="deleteUser(${
              user.user_id
            })">Delete</button>
          </div>
        `;
      cardContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Failed to load users:", err);
    alert("Could not load users.");
  }
}

function toggleView() {
  const cardView = document.querySelector(".card-view");
  const table = document.querySelector("table");

  if (window.innerWidth <= 768) {
    cardView.style.display = "block";
    table.style.display = "none";
  } else {
    cardView.style.display = "none";
    table.style.display = "table";
  }
}

function viewUser(userId) {
  window.location.href = `view-user.html?user_id=${userId}`;
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  const token = localStorage.getItem("access_token");

  try {
    const res = await fetch(`http://localhost:5000/users/delete/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (res.ok) {
      alert("User deleted successfully");
      window.location.reload();
    } else {
      alert(data.message || "Failed to delete user");
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("Error deleting user");
  }
}
