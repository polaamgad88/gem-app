/* Users page — perf refactored. Preserves global functions used by inline onclick handlers. */

(function () {
  const { Api, Auth, UI, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  let allUsers = [];

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isAdmin = localStorage.getItem("is_admin") === "1";
    const createBtn = document.getElementById("create-user-btn");
    if (createBtn) {
      createBtn.style.display = isAdmin ? "inline-block" : "none";
      if (isAdmin) {
        createBtn.addEventListener("click", () => {
          window.location.href = "create-user.html";
        });
      }
    }

    await loadUsers();

    const searchInput = document.getElementById("user-search");
    if (searchInput) {
      const onSearch = Async.debounce((value) => filterUsers(value.toLowerCase()), 200);
      searchInput.addEventListener("input", (e) => onSearch(e.target.value));
    }

    toggleView();
    window.addEventListener("resize", Async.throttle(toggleView, 150));

    wireModalForms();
    wireDropdownDelegation();
  });

  // Re-fetch when the page is restored from the back-forward cache (bfcache).
  // Without this, hitting "back" shows a stale DOM and requires a manual refresh.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      Api.invalidate("/users");
      loadUsers();
    }
  });

  async function loadUsers() {
    try {
      const data = await Api.get("/users");
      allUsers = data.users || [];
      renderUsers(allUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
      alert(err.data?.message || "Could not load users.");
    }
  }

  function toggleView() {
    const cardView = document.querySelector(".card-view");
    const table = document.querySelector("table");
    if (!cardView || !table) return;
    if (window.innerWidth <= 768) {
      cardView.style.display = "block";
      table.style.display = "none";
    } else {
      cardView.style.display = "none";
      table.style.display = "table";
    }
  }

  function renderUsers(users) {
    const isAdmin = localStorage.getItem("is_admin") === "1";
    const tableBody = document.getElementById("users-table-body");
    const cardContainer = document.getElementById("user-cards");
    if (!tableBody || !cardContainer) return;

    const tbodyFrag = document.createDocumentFragment();
    const cardsFrag = document.createDocumentFragment();

    const total = users.length;
    users.forEach((user, idx) => {
      const isUserAdmin = !!user.admin;
      const isActive = String(user.status) === "1";
      const dropPos = total - idx <= 2 ? "look_up" : "look_down";

      let userClass = "";
      let badgeLabel = "";
      if (!isActive) {
        userClass = "inactive-badge";
        badgeLabel = " (Inactive)";
      } else if (isUserAdmin) {
        userClass = "admin-badge";
        badgeLabel = " (Admin)";
      }

      const usernameDisplay = `<span class="${userClass}">${esc(user.username)} - ${esc(user.user_id)}${esc(badgeLabel)}</span>`;
      const menuHtml = buildMenu(user.user_id, isActive, isAdmin, dropPos);

      const regionVal = (user.region || "cairo").toLowerCase();
      const regionPill = `<span class="region-pill region-pill--${regionVal}">${regionVal.toUpperCase()}</span>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${usernameDisplay}</td>
        <td>${esc(user.role || "")}</td>
        <td>${regionPill}</td>
        <td>${esc(user.assigned_to_username || "—")} - ${esc(user.assigned_to_user_id || "—")}</td>
        <td>${esc(user.phone || "—")}</td>
        <td>
          <div class="action-container">
            <button class="action-btn" data-dropdown-id="user-dropdown-${user.user_id}">⋮</button>
            ${menuHtml}
          </div>
        </td>`;
      tbodyFrag.appendChild(tr);

      const card = document.createElement("div");
      card.className = "user-card";
      card.innerHTML = `
        <p><strong>Username:</strong> ${usernameDisplay}</p>
        <p><strong>Role:</strong> ${esc(user.role || "")}</p>
        <p><strong>Region:</strong> ${regionPill}</p>
        <p><strong>Assigned To:</strong> ${esc(user.assigned_to_username || "—")} - ${esc(user.assigned_to_user_id || "—")}</p>
        <p><strong>Phone:</strong> ${esc(user.phone || "—")}</p>
        <div class="card-actions">
          <div class="row-actions">
            <button class="btn view-btn" data-action="edit" data-id="${user.user_id}">Edit</button>
            ${isAdmin ? `<button class="btn delete-btn" data-action="delete" data-id="${user.user_id}">Delete</button>` : ""}
          </div>
          <div class="row-actions">
            <button class="btn" data-action="password" data-id="${user.user_id}">Change Password</button>
            <button class="btn toggle-btn" data-action="toggle" data-id="${user.user_id}" data-status="${isActive ? 0 : 1}">
              ${isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>`;
      cardsFrag.appendChild(card);
    });

    tableBody.replaceChildren(tbodyFrag);
    cardContainer.replaceChildren(cardsFrag);
  }

  function buildMenu(userId, isActive, isAdmin, posClass) {
    return `
      <div class="dropdown-menu ${posClass}" id="user-dropdown-${userId}">
        <button data-action="edit" data-id="${userId}">Edit</button>
        <button data-action="password" data-id="${userId}">Change Password</button>
        <button data-action="assign-target" data-id="${userId}">Assign Target</button>
        <button data-action="toggle" data-id="${userId}" data-status="${isActive ? 0 : 1}">
          ${isActive ? "Deactivate" : "Activate"}
        </button>
        ${isAdmin ? `<button class="delete-btn" data-action="delete" data-id="${userId}">Delete</button>` : ""}
      </div>`;
  }

  // ── Single body-level delegation for dropdown + menu actions ─────────────
  function wireDropdownDelegation() {
    document.body.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action][data-id]");
      const openTrigger = e.target.closest("[data-dropdown-id]");

      // Close all open menus when clicking outside any action
      if (!actionBtn && !openTrigger) {
        document.querySelectorAll(".dropdown-menu").forEach((m) => (m.style.display = "none"));
        return;
      }

      if (openTrigger) {
        e.stopPropagation();
        document.querySelectorAll(".dropdown-menu").forEach((m) => (m.style.display = "none"));
        const menu = document.getElementById(openTrigger.dataset.dropdownId);
        if (menu) menu.style.display = "block";
        return;
      }

      if (actionBtn) {
        const action = actionBtn.dataset.action;
        const id = parseInt(actionBtn.dataset.id, 10);
        document.querySelectorAll(".dropdown-menu").forEach((m) => (m.style.display = "none"));
        if (action === "edit") openEditModal(id);
        else if (action === "password") openPasswordModal(id);
        else if (action === "assign-target") openAssignNumberModal(id);
        else if (action === "toggle") toggleUserStatus(id, parseInt(actionBtn.dataset.status, 10));
        else if (action === "delete") deleteUser(id);
      }
    });
  }

  // ── Modal wiring ────────────────────────────────────────────────────────

  function wireModalForms() {
    const editForm = document.getElementById("edit-user-form");
    editForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("edit-user-id").value;
      const newRegion = document.getElementById("edit-region").value;
      const origUser = allUsers.find((u) => String(u.user_id) === String(userId));
      const regionChanged = origUser && (origUser.region || "cairo").toLowerCase() !== newRegion;
      try {
        // Run info+role+manager in parallel — backend doesn't require ordering
        await Promise.all([
          Api.postForm(`/users/edit_info/${userId}`, {
            username: document.getElementById("edit-username").value,
            email: document.getElementById("edit-email").value,
            phone: document.getElementById("edit-phone").value,
            driver: document.getElementById("edit-driver").checked ? "1" : "0",
            storage: document.getElementById("edit-storage").checked ? "1" : "0",
          }),
          Api.postForm(`/users/edit_role/${userId}`, {
            role: document.getElementById("edit-role").value,
            admin: document.getElementById("edit-admin").checked ? "1" : "0",
          }),
          Api.postForm(`/users/change_manager/${userId}`, {
            assigned_to_user_id: document.getElementById("edit-assigned-to").value,
          }),
        ]);
        // Region runs after the manager change — set_region validates the
        // user's manager/subordinate region tree, which the calls above may alter.
        if (regionChanged) {
          await Api.postForm(`/users/set_region/${userId}`, { region: newRegion });
        }
        alert("User updated");
        closeEditModal();
        Api.invalidate("/users");
        await loadUsers();
      } catch (err) {
        alert(err.data?.message || err.message || "Update failed.");
      }
    });

    const pwForm = document.getElementById("change-password-form");
    pwForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userId = document.getElementById("password-user-id").value;
      const newPassword = document.getElementById("new-password").value;
      try {
        const data = await Api.postForm(`/users/change_password/${userId}`, {
          password: newPassword,
        });
        alert(data?.message || "Password updated");
        closePasswordModal();
      } catch (err) {
        alert(err.data?.message || err.message || "Password update failed.");
      }
    });
  }

  // ── Global helpers (referenced by inline onclick handlers) ──────────────

  async function openEditModal(userId) {
    const user = allUsers.find((u) => u.user_id === userId);
    if (!user) return;
    document.getElementById("edit-user-id").value = user.user_id;
    document.getElementById("edit-username").value = user.username || "";
    document.getElementById("edit-email").value = user.email || "";
    document.getElementById("edit-phone").value = user.phone || "";
    document.getElementById("edit-role").value = user.role || "";
    document.getElementById("edit-region").value = (user.region || "cairo").toLowerCase();
    document.getElementById("edit-assigned-to").value = user.assigned_to_user_id || "";
    document.getElementById("edit-admin").checked = !!user.admin;
    document.getElementById("edit-driver").checked = user.driver == 1;
    document.getElementById("edit-storage").checked = user.storage == 1;
    document.getElementById("edit-user-modal").classList.remove("hidden");
  }

  function closeEditModal() {
    document.getElementById("edit-user-modal")?.classList.add("hidden");
  }

  function openPasswordModal(userId) {
    document.getElementById("password-user-id").value = userId;
    document.getElementById("change-password-modal").classList.remove("hidden");
  }

  function closePasswordModal() {
    document.getElementById("change-password-modal")?.classList.add("hidden");
  }

  function openAssignNumberModal(userId) {
    document.getElementById("assign-user-id").value = userId;
    const user = allUsers.find((u) => u.user_id === userId);
    // Backend now returns both cairo_target / region_target and legacy aliases.
    document.getElementById("local-number").value = user?.cairo_target ?? user?.local_number ?? "";
    document.getElementById("abroad-number").value = user?.region_target ?? user?.abroad_number ?? "";
    document.getElementById("assign-number-modal").classList.remove("hidden");
  }

  function closeAssignNumberModal() {
    document.getElementById("assign-number-modal")?.classList.add("hidden");
  }

  /**
   * Placeholder — backend currently has no endpoint for saving local/abroad number per user.
   * Add this in users.py if you want this feature wired up. See backend recommendations.
   */
  async function submitAssignNumber() {
    const userId = document.getElementById("assign-user-id").value;
    const cairoTarget = document.getElementById("local-number").value;
    const regionTarget = document.getElementById("abroad-number").value;
    try {
      await Api.postForm(`/users/assign_target/${userId}`, {
        cairo_target: cairoTarget,
        region_target: regionTarget,
      });
      alert("Targets saved");
      closeAssignNumberModal();
      Api.invalidate("/users");
      await loadUsers();
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to save targets.");
    }
  }

  async function deleteUser(userId) {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await Api.del(`/users/delete/${userId}`);
      alert("User deleted successfully");
      Api.invalidate("/users");
      await loadUsers();
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to delete user");
    }
  }

  async function toggleUserStatus(userId, newStatus) {
    try {
      const data = await Api.post(`/users/set_active/${userId}/${newStatus}`);
      alert(data?.message || "User status updated");
      Api.invalidate("/users");
      await loadUsers();
    } catch (err) {
      alert(err.data?.message || "Failed to update status");
    }
  }

  function filterUsers(searchTerm) {
    const filtered = allUsers.filter((u) =>
      (u.username || "").toLowerCase().includes(searchTerm)
    );
    renderUsers(filtered);
  }

  function viewUser(userId) {
    window.location.href = `view-user.html?user_id=${userId}`;
  }

  // Export globals for inline onclick compatibility
  window.openEditModal = openEditModal;
  window.closeEditModal = closeEditModal;
  window.openPasswordModal = openPasswordModal;
  window.closePasswordModal = closePasswordModal;
  window.openAssignNumberModal = openAssignNumberModal;
  window.closeAssignNumberModal = closeAssignNumberModal;
  window.submitAssignNumber = submitAssignNumber;
  window.deleteUser = deleteUser;
  window.toggleUserStatus = toggleUserStatus;
  window.viewUser = viewUser;
})();
