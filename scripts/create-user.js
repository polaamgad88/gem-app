document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  const isAdmin = localStorage.getItem("is_admin") === "1";
  if (!isAdmin) {
    alert("You do not have permission to access this page.");
    window.location.href = "users.html";
    return;
  }

  await loadAssignableUsers(token);

  document.getElementById("is-admin").addEventListener("change", (e) => {
    if (e.target.checked) {
      alert("⚠️ You are giving admin access to this user!");
    }
  });

  document
    .getElementById("create-user-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCreateUser(token);
    });
});

async function loadAssignableUsers(token) {
  try {
    const res = await fetch("http://localhost:5000/users", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const users = data.users || [];

    const select = document.getElementById("assigned-to");
    users.forEach((user) => {
      const option = document.createElement("option");
      option.value = user.user_id;
      option.textContent = user.username;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Failed to load users for assignment:", err);
  }
}

async function handleCreateUser(token) {
  const username = document.getElementById("username").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const role = document.getElementById("role").value;
  const assignedTo = document.getElementById("assigned-to").value;
  const isAdmin = document.getElementById("is-admin").checked;

  if (!username || !phone || !role || !email) {
    alert("Please fill in all required fields.");
    return;
  }

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("phone", phone);
  formData.append("email", email);
  formData.append("role", role);

  if (assignedTo) {
    formData.append("assigned_to", assignedTo); // Correct field name!
  }

  if (isAdmin) {
    formData.append("admin", "on"); // Just presence of 'admin' key triggers admin status.
  }

  try {
    const res = await fetch("http://localhost:5000/register", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    const message = await res.text(); // Not JSON, plain text response.

    if (res.ok) {
      alert("User created successfully!");
      window.location.href = "users.html";
    } else {
      alert(message || "Failed to create user.");
    }
  } catch (err) {
    console.error("Error creating user:", err);
    alert("An error occurred while creating the user.");
  }
}
