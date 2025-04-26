document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  const isAdmin = localStorage.getItem("is_admin") === "1";

  if (isAdmin) {
    document.getElementById("create-user-btn").style.display = "inline-block";
    document.getElementById("create-user-btn").addEventListener("click", () => {
      window.location.href = "create-user.html";
    });
  } else {
    document.getElementById("create-user-btn").style.display = "none";
  }

  await loadUsers(token);

  document.getElementById("user-search").addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filterUsers(searchTerm);
  });

  toggleView();
  window.addEventListener("resize", toggleView);
});

let allUsers = [];

async function loadUsers(token) {
  try {
    const res = await fetch("http://192.168.158.63:5000/users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    allUsers = data.users || [];
    renderUsers(allUsers);
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
    const res = await fetch(`http://192.168.158.63:5000/users/delete/${userId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (res.ok) {
      alert("User deleted successfully");
      await loadUsers(token);
    } else {
      alert(data.message || "Failed to delete user");
    }
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("Error deleting user");
  }
}

async function toggleUserStatus(userId, newStatus) {
  const token = localStorage.getItem("access_token");
  try {
    const res = await fetch(
      `http://192.168.158.63:5000/users/set_active/${userId}/${newStatus}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = await res.json();

    if (res.ok) {
      alert(data.message || "User status updated");
      await loadUsers(token);
    } else {
      alert(data.message || "Failed to update user status");
    }
  } catch (err) {
    console.error("Error toggling status:", err);
    alert("Failed to update status");
  }
}

function renderUsers(users) {
  const isAdmin = localStorage.getItem("is_admin") === "1";
  const tableBody = document.getElementById("users-table-body");
  const cardContainer = document.getElementById("user-cards");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  users.forEach((user, index) => {
    const isUserAdmin = user.admin;
    const isActive = user.status == "1";

    let userClass = "";
    let badgeLabel = "";

    if (!isActive) {
      userClass = "inactive-badge";
      badgeLabel = " (Inactive)";
    } else if (isUserAdmin) {
      userClass = "admin-badge";
      badgeLabel = " (Admin)";
    }

    const usernameDisplay = `<span class="${userClass}">${user.username} - ${user.user_id}${badgeLabel}</span>`;

    // Table view
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${usernameDisplay}</td>
      <td>${user.role}</td>
      <td>${user.assigned_to_username || "—"} - ${
      user.assigned_to_user_id || "—"
    }</td>
      <td>${user.phone || "—"}</td>
      <td>
        <button class="btn view-btn" onclick="viewUser(${
          user.user_id
        })">View</button>
        <button class="btn toggle-btn" onclick="toggleUserStatus(${
          user.user_id
        }, ${isActive ? 0 : 1})">
          ${isActive ? "Deactivate" : "Activate"}
        </button>
        ${
          isAdmin
            ? `<button class="btn delete-btn" onclick="deleteUser(${user.user_id})">Delete</button>`
            : ""
        }
      </td>
    `;
    tableBody.appendChild(tr);

    // Card view
    const card = document.createElement("div");
    card.className = "user-card";
    card.innerHTML = `
      <p><strong>Username:</strong> ${usernameDisplay}</p>
      <p><strong>Role:</strong> ${user.role}</p>
      <p><strong>Assigned To:</strong> ${user.assigned_to_username || "—"} - ${
      user.assigned_to_user_id || "—"
    }</p>
      <p><strong>Phone:</strong> ${user.phone || "—"}</p>
      <div class="card-actions">
        <button class="btn view-btn" onclick="viewUser(${
          user.user_id
        })">View</button>
        <button class="btn toggle-btn" onclick="toggleUserStatus(${
          user.user_id
        }, ${isActive ? 0 : 1})">
          ${isActive ? "Deactivate" : "Activate"}
        </button>
        ${
          isAdmin
            ? `<button class="btn delete-btn" onclick="deleteUser(${user.user_id})">Delete</button>`
            : ""
        }
      </div>
    `;
    cardContainer.appendChild(card);
  });
}

function filterUsers(searchTerm) {
  const filteredUsers = allUsers.filter((user) =>
    user.username.toLowerCase().includes(searchTerm)
  );
  renderUsers(filteredUsers);
}
