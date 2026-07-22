document.addEventListener("DOMContentLoaded", async () => {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  const isAdmin = localStorage.getItem("is_admin") === "1";
  const isDriverManager = localStorage.getItem("driver_manager") === "1";
  if (!isAdmin && !isDriverManager) {
    alert("You do not have permission to access this page.");
    window.location.href = "users.html";
    return;
  }

  await loadAssignableUsers(token);

  const isAdminChk        = document.getElementById("is-admin");
  const isDriverChk       = document.getElementById("is-driver");
  const isDriverAdminChk  = document.getElementById("is-driver-admin");
  const isStorageChk      = document.getElementById("is-storage");
  const isStorageAdminChk = document.getElementById("is-storage-admin");
  const assignedToSelect  = document.getElementById("assigned-to");
  const roleSelect        = document.getElementById("role");

  const capabilityBoxes = [isDriverChk, isDriverAdminChk, isStorageChk, isStorageAdminChk];

  function activeCapability() {
    if (isDriverChk.checked || isDriverAdminChk.checked) return "driver";
    if (isStorageChk.checked || isStorageAdminChk.checked) return "storage";
    return null;
  }

  function syncCapability(changed) {
    if (changed && changed.checked) {
      capabilityBoxes.filter((box) => box !== changed).forEach((box) => (box.checked = false));
      isAdminChk.checked = false;
    }

    const capability = activeCapability();
    const locked = capability !== null;

    if (locked) {
      roleSelect.value = capability === "driver" ? "car" : "storage";
      assignedToSelect.value = "";
    } else if (roleSelect.value === "car" || roleSelect.value === "storage") {
      roleSelect.value = "";
    }

    roleSelect.disabled = locked;
    assignedToSelect.disabled = locked;
  }

  capabilityBoxes.forEach((box) => {
    box.addEventListener("change", () => syncCapability(box));
  });

  isAdminChk.addEventListener("change", () => {
    if (!isAdminChk.checked) return;
    alert("⚠️ You are giving admin access to this user!");
    capabilityBoxes.forEach((box) => (box.checked = false));
    assignedToSelect.value = "";
    syncCapability();
  });

  roleSelect.addEventListener("change", () => {
    if (roleSelect.value === "car") isDriverChk.checked = true;
    else if (roleSelect.value === "storage") isStorageChk.checked = true;
    else capabilityBoxes.forEach((box) => (box.checked = false));
    syncCapability();
  });

  if (!isAdmin && isDriverManager) {
    document.querySelector(".page-heading").textContent = "Add Driver";
    isDriverChk.checked = true;
    [isAdminChk, isDriverAdminChk, isStorageChk, isStorageAdminChk].forEach((chk) => {
      chk.checked = false;
      chk.disabled = true;
      chk.closest(".checkbox-group").style.display = "none";
    });
    isDriverChk.disabled = true;
    assignedToSelect.closest(".form-field").style.display = "none";
  }

  if (new URLSearchParams(location.search).get("driver") === "1") {
    isDriverChk.checked = true;
  }

  syncCapability();

  document
    .getElementById("create-user-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleCreateUser(token);
    });
});

let __ASSIGNABLE_USERS = [];

async function loadAssignableUsers(token) {
  try {
    const data = await Utils.Api.get("/users");
    __ASSIGNABLE_USERS = data.users || [];
    renderAssignableUsers();
    const regionSel = document.getElementById("region");
    if (regionSel) {
      regionSel.addEventListener("change", renderAssignableUsers);
    }
  } catch (err) {
    console.error("Failed to load users for assignment:", err);
  }
}

function renderAssignableUsers() {
  const select = document.getElementById("assigned-to");
  if (!select) return;
  const selectedRegion = (document.getElementById("region")?.value || "cairo").toLowerCase();
  const prev = select.value;
  select.innerHTML = '<option value="">None</option>';
  __ASSIGNABLE_USERS
    .filter((u) => u.admin === 1 || (u.region || "cairo").toLowerCase() === selectedRegion)
    .forEach((u) => {
      const option = document.createElement("option");
      option.value = u.user_id;
      const tag = u.admin === 1 ? " (Admin)" : ` [${(u.region || "cairo")}]`;
      option.textContent = `${u.username}${tag}`;
      select.appendChild(option);
    });
  if ([...select.options].some((o) => o.value === prev)) {
    select.value = prev;
  }
}

async function handleCreateUser(token) {
  const username        = document.getElementById("username").value.trim();
  const phone           = document.getElementById("phone").value.trim();
  const email           = document.getElementById("email").value.trim();
  const password        = document.getElementById("password").value;
  const role            = document.getElementById("role").value;
  const region          = document.getElementById("region").value || "cairo";
  const assignedTo      = document.getElementById("assigned-to").value.trim();
  const isAdmin         = document.getElementById("is-admin").checked;
  const isDriver        = document.getElementById("is-driver").checked;
  const isDriverAdmin   = document.getElementById("is-driver-admin").checked;
  const isStorage       = document.getElementById("is-storage").checked;
  const isStorageAdmin  = document.getElementById("is-storage-admin").checked;
  const trackLocations  = document.getElementById("is-track-locations")?.checked;

  if (!username || !phone || !email || !role) {
    alert("Please fill in all required fields (username, phone, email, role).");
    return;
  }

  if ((isDriver || isDriverAdmin) && (isStorage || isStorageAdmin)) {
    alert("A user cannot be both a Driver and a Storage user.");
    return;
  }

  if (isAdmin && (isDriver || isDriverAdmin || isStorage || isStorageAdmin)) {
    alert("A system admin cannot also be a driver or a storage user.");
    return;
  }

  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("phone",    phone);
  formData.append("email",    email);
  formData.append("password", password);
  formData.append("role",     role);
  formData.append("region",   region);

  if (assignedTo) {
    formData.append("assigned_to", assignedTo);
  }

  if (isAdmin) {
    formData.append("admin", "on");
  }
  if (isDriverAdmin) {
    formData.append("driver_admin", "on");
  } else if (isDriver) {
    formData.append("driver", "on");
  }
  if (isStorageAdmin) {
    formData.append("storage_admin", "on");
  } else if (isStorage) {
    formData.append("storage", "on");
  }
  if (trackLocations) {
    formData.append("track_locations", "on");
  }

  try {
    const payload = Object.fromEntries(formData.entries());
    const data = await Utils.Api.postForm("/register", payload);
    alert(data?.message || "User created successfully!");
    Utils.Api.invalidate("/users");
    window.location.href = "users.html";
  } catch (err) {
    console.error("Error creating user:", err);
    alert(err.data?.message || err.message || "Failed to create user.");
  }
}