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

  // ── Mutual-exclusion logic ──────────────────────────────────────────────

  const isAdminChk       = document.getElementById("is-admin");
  const isDriverChk      = document.getElementById("is-driver");
  const isStorageChk     = document.getElementById("is-storage");
  const isStorageAdminChk = document.getElementById("is-storage-admin");
  const assignedToSelect = document.getElementById("assigned-to");
  const roleSelect       = document.getElementById("role");

  // Admin ⇒ clear assigned-to
  isAdminChk.addEventListener("change", () => {
    if (isAdminChk.checked) {
      alert("⚠️ You are giving admin access to this user!");
      assignedToSelect.value = "";
    }
  });

  // Driver ⇒ clear storage flags; role must be "car"
  isDriverChk.addEventListener("change", () => {
    if (isDriverChk.checked) {
      isStorageChk.checked      = false;
      isStorageAdminChk.checked = false;
      assignedToSelect.value    = "";
      if (roleSelect.value !== "car") {
        roleSelect.value = "car";
      }
    }
  });

  // Storage ⇒ clear driver; storage_admin overrides
  isStorageChk.addEventListener("change", () => {
    if (isStorageChk.checked) {
      isDriverChk.checked       = false;
      isStorageAdminChk.checked = false; // only one active at a time
      assignedToSelect.value    = "";
    }
  });

  // Storage Admin ⇒ clear driver & regular storage
  isStorageAdminChk.addEventListener("change", () => {
    if (isStorageAdminChk.checked) {
      isDriverChk.checked    = false;
      isStorageChk.checked   = false;
      assignedToSelect.value = "";
    }
  });

  // Role = car ⇒ auto-tick driver
  roleSelect.addEventListener("change", () => {
    if (roleSelect.value === "car") {
      isDriverChk.checked       = true;
      isStorageChk.checked      = false;
      isStorageAdminChk.checked = false;
      assignedToSelect.value    = "";
    } else if (roleSelect.value !== "car" && isDriverChk.checked) {
      isDriverChk.checked = false;
    }
  });

  // ── Form submit ─────────────────────────────────────────────────────────
  document
    .getElementById("create-user-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCreateUser(token);
    });
});

// ── Load users for "Assigned To" dropdown ──────────────────────────────────

async function loadAssignableUsers(token) {
  try {
    const res = await fetch("https://order-app.gemegypt.net/api/users", {
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

// ── Create user ────────────────────────────────────────────────────────────

async function handleCreateUser(token) {
  const username        = document.getElementById("username").value.trim();
  const phone           = document.getElementById("phone").value.trim();
  const email           = document.getElementById("email").value.trim();
  const password        = document.getElementById("password").value;
  const role            = document.getElementById("role").value;
  const assignedTo      = document.getElementById("assigned-to").value.trim();
  const isAdmin         = document.getElementById("is-admin").checked;
  const isDriver        = document.getElementById("is-driver").checked;
  const isStorage       = document.getElementById("is-storage").checked;
  const isStorageAdmin  = document.getElementById("is-storage-admin").checked;

  // ── Client-side validation ─────────────────────────────────────────────

  if (!username || !phone || !email || !role) {
    alert("Please fill in all required fields (username, phone, email, role).");
    return;
  }

  if (isDriver && role !== "car") {
    alert('Driver flag requires the role to be "Car (Driver)".');
    return;
  }

  if (isDriver && (isStorage || isStorageAdmin)) {
    alert("A user cannot be both a Driver and a Storage user.");
    return;
  }

  if (isStorage && isStorageAdmin) {
    // storage_admin takes precedence — silently correct
    // (backend handles this too, but be explicit to the user)
    const ok = confirm(
      "Both Storage User and Storage Admin are checked. Only Storage Admin will be applied. Continue?"
    );
    if (!ok) return;
  }

  // ── Build form payload ─────────────────────────────────────────────────

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("phone",    phone);
  formData.append("email",    email);
  formData.append("password", password);
  formData.append("role",     role);

  // Only send assigned_to when a real user is selected
  if (assignedTo) {
    formData.append("assigned_to", assignedTo);
  }

  // Flags — backend detects by KEY PRESENCE, not value
  if (isAdmin) {
    formData.append("admin", "on");
  }
  if (isDriver) {
    formData.append("driver", "on");
  }
  // storage_admin takes priority over storage (backend checks storage_admin first)
  if (isStorageAdmin) {
    formData.append("storage_admin", "on");
  } else if (isStorage) {
    formData.append("storage", "on");
  }

  // ── Send ───────────────────────────────────────────────────────────────

  try {
    const res = await fetch("https://order-app.gemegypt.net/api/register", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const message = await res.text(); // backend returns plain text

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