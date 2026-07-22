(function () {
  const { Api, Auth, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  let allUsers = [];
  let isAdmin = false;

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    isAdmin = localStorage.getItem("is_admin") === "1";

    const createBtn = document.getElementById("create-user-btn");
    if (createBtn) {
      createBtn.style.display = isAdmin ? "inline-flex" : "none";
      createBtn.addEventListener("click", () => {
        window.location.href = "create-user.html";
      });
    }

    wireFilters();
    wireList();
    wireModalForms();

    await loadUsers();
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      Api.invalidate("/users");
      loadUsers();
    }
  });

  async function loadUsers() {
    const loading = document.getElementById("users-loading");
    loading?.classList.remove("hidden");
    try {
      const data = await Api.get("/users");
      allUsers = data.users || [];
      applyFilters();
    } catch (err) {
      console.error("Failed to load users:", err);
      alert(err.data?.message || "Could not load users.");
    } finally {
      loading?.classList.add("hidden");
    }
  }

  function wireFilters() {
    const search = document.getElementById("user-search");
    if (search) {
      const onSearch = Async.debounce(applyFilters, 200);
      search.addEventListener("input", onSearch);
    }
    ["filter-type", "filter-region", "filter-status"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", applyFilters);
    });
    document.getElementById("reset-filters-btn")?.addEventListener("click", () => {
      ["user-search", "filter-type", "filter-region", "filter-status"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
      applyFilters();
    });
  }

  function userType(user) {
    if (user.admin) return "admin";
    if (Number(user.driver) === 2) return "driver_manager";
    if (Number(user.driver) === 1) return "driver";
    if (Number(user.storage) === 2) return "storage_manager";
    if (Number(user.storage) === 1) return "storage";
    return String(user.role || "").toLowerCase();
  }

  const TYPE_LABEL = {
    admin: "System Admin",
    driver_manager: "Driver Manager",
    driver: "Driver",
    storage_manager: "Storage Admin",
    storage: "Storage User",
  };

  function typeLabel(user) {
    const type = userType(user);
    return TYPE_LABEL[type] || user.role || "No role";
  }

  function isCapabilityUser(user) {
    return Number(user.driver) > 0 || Number(user.storage) > 0;
  }

  function applyFilters() {
    const term = (document.getElementById("user-search")?.value || "").trim().toLowerCase();
    const type = document.getElementById("filter-type")?.value || "";
    const region = document.getElementById("filter-region")?.value || "";
    const status = document.getElementById("filter-status")?.value || "";

    const filtered = allUsers.filter((u) => {
      if (term) {
        const haystack = [u.username, u.email, u.phone, u.user_id]
          .map((v) => String(v || "").toLowerCase())
          .join(" ");
        if (!haystack.includes(term)) return false;
      }
      if (type && userType(u) !== type) return false;
      if (region && (u.region || "cairo").toLowerCase() !== region) return false;
      if (status && String(u.status) !== status) return false;
      return true;
    });

    render(filtered);
  }

  function render(users) {
    const list = document.getElementById("user-list");
    const empty = document.getElementById("users-empty");
    if (!list) return;

    empty?.classList.toggle("hidden", users.length > 0);
    renderSummary(allUsers);

    const frag = document.createDocumentFragment();
    users.forEach((u) => frag.appendChild(buildCard(u)));
    list.replaceChildren(frag);
  }

  function renderSummary(users) {
    const box = document.getElementById("summary-row");
    if (!box) return;
    if (!users.length) {
      box.innerHTML = "";
      return;
    }
    const count = (fn) => users.filter(fn).length;
    const tiles = [
      ["Total", users.length, ""],
      ["Active", count((u) => String(u.status) === "1"), "ok"],
      ["Inactive", count((u) => String(u.status) !== "1"), "off"],
      ["Admins", count((u) => !!u.admin), ""],
      ["Drivers", count((u) => Number(u.driver) > 0), ""],
      ["Storage", count((u) => Number(u.storage) > 0), ""],
    ];
    box.innerHTML = tiles
      .map(
        ([label, value, mod]) =>
          `<div class="stat-tile${mod ? ` stat-tile--${mod}` : ""}"><span>${value}</span><small>${label}</small></div>`
      )
      .join("");
  }

  function buildCard(user) {
    const type = userType(user);
    const active = String(user.status) === "1";
    const region = (user.region || "cairo").toLowerCase();
    const initial = (user.username || "?").trim().charAt(0).toUpperCase();

    const card = document.createElement("article");
    card.className = `u-card u-card--${type.replace(/\s+/g, "-")}${active ? "" : " u-card--off"}`;
    card.dataset.userId = user.user_id;

    card.innerHTML = `
      <button type="button" class="u-head" aria-expanded="false">
        <span class="chev" aria-hidden="true"></span>
        <span class="avatar">${esc(initial)}</span>
        <span class="u-head-main">
          <span class="u-name">
            ${esc(user.username || "—")}
            <span class="u-id">#${esc(user.user_id)}</span>
            ${active ? "" : `<span class="status-pill status-pill--off">Inactive</span>`}
          </span>
          <span class="u-meta">
            <span class="type-badge type-badge--${esc(type.replace(/\s+/g, "-"))}">${esc(typeLabel(user))}</span>
            <span class="region-pill region-pill--${esc(region)}">${esc(region.toUpperCase())}</span>
            ${
              user.assigned_to_username
                ? `<span class="muted">reports to ${esc(user.assigned_to_username)}</span>`
                : ""
            }
          </span>
        </span>
        <span class="u-phone">${esc(user.phone || "—")}</span>
      </button>
      <div class="u-body"><div class="u-body-inner"></div></div>`;

    return card;
  }

  function detailHtml(user) {
    const levelName = { 0: "—", 1: "User", 2: "Manager" };
    const facts = [
      ["Email", esc(user.email || "—")],
      ["Phone", esc(user.phone || "—")],
      ["Role", esc(user.role || "—")],
      ["Region", esc((user.region || "cairo").toUpperCase())],
      [
        "Manager",
        user.assigned_to_user_id
          ? `${esc(user.assigned_to_username || "—")} <span class="muted">#${esc(user.assigned_to_user_id)}</span>`
          : "—",
      ],
      ["System admin", user.admin ? "Yes" : "No"],
      ["Driver", esc(levelName[Number(user.driver) || 0])],
      ["Storage", esc(levelName[Number(user.storage) || 0])],
      ["Cairo target", esc(user.cairo_target ?? 0)],
      ["Region target", esc(user.region_target ?? 0)],
      ["Location tracking", Number(user.track_locations) ? "On" : "Off"],
      ["Status", String(user.status) === "1" ? "Active" : "Inactive"],
    ];

    const active = String(user.status) === "1";
    const id = user.user_id;
    const actions = [
      `<button class="btn" data-action="edit" data-id="${id}">Edit</button>`,
      `<button class="btn" data-action="password" data-id="${id}">Change Password</button>`,
      `<button class="btn" data-action="assign-target" data-id="${id}">Assign Target</button>`,
    ];
    if (isAdmin) {
      actions.push(`<button class="btn" data-action="permissions" data-id="${id}">Permissions</button>`);
    }
    actions.push(
      `<button class="btn toggle-btn" data-action="toggle" data-id="${id}" data-status="${active ? 0 : 1}">${
        active ? "Deactivate" : "Activate"
      }</button>`
    );
    if (isAdmin) {
      actions.push(`<button class="btn delete-btn" data-action="delete" data-id="${id}">Delete</button>`);
    }

    return `
      <div class="detail-grid">
        ${facts.map(([k, v]) => `<div><small>${k}</small><span>${v}</span></div>`).join("")}
      </div>
      <div class="row-actions">${actions.join("")}</div>`;
  }

  function setOpen(card, open) {
    const head = card.querySelector(".u-head");
    const inner = card.querySelector(".u-body-inner");
    if (open && !inner.dataset.filled) {
      const user = allUsers.find((u) => String(u.user_id) === card.dataset.userId);
      if (user) {
        inner.innerHTML = detailHtml(user);
        inner.dataset.filled = "1";
      }
    }
    card.classList.toggle("open", open);
    head.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function wireList() {
    const list = document.getElementById("user-list");
    list.addEventListener("click", (e) => {
      const actionBtn = e.target.closest("[data-action][data-id]");
      if (actionBtn) {
        e.stopPropagation();
        const id = parseInt(actionBtn.dataset.id, 10);
        const action = actionBtn.dataset.action;
        if (action === "edit") openEditModal(id);
        else if (action === "password") openPasswordModal(id);
        else if (action === "assign-target") openAssignNumberModal(id);
        else if (action === "permissions") openPermissionsModal(id);
        else if (action === "toggle") toggleUserStatus(id, parseInt(actionBtn.dataset.status, 10));
        else if (action === "delete") deleteUser(id);
        return;
      }
      const head = e.target.closest(".u-head");
      if (!head) return;
      const card = head.closest(".u-card");
      setOpen(card, !card.classList.contains("open"));
    });
  }

  function wireModalForms() {
    document.getElementById("edit-user-form")?.addEventListener("submit", submitEdit);
    document.getElementById("permissions-save")?.addEventListener("click", submitPermissions);

    document.getElementById("change-password-form")?.addEventListener("submit", async (e) => {
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

    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.add("hidden");
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal:not(.hidden)").forEach((m) => m.classList.add("hidden"));
      }
    });
  }

  function openEditModal(userId) {
    const user = allUsers.find((u) => u.user_id === userId);
    if (!user) return;

    document.getElementById("edit-user-id").value = user.user_id;
    document.getElementById("edit-user-label").textContent = `${user.username} — #${user.user_id}`;
    document.getElementById("edit-username").value = user.username || "";
    document.getElementById("edit-email").value = user.email || "";
    document.getElementById("edit-phone").value = user.phone || "";
    document.getElementById("edit-region").value = (user.region || "cairo").toLowerCase();
    document.getElementById("edit-assigned-to").value = user.assigned_to_user_id || "";
    document.getElementById("edit-admin").checked = !!user.admin;

    const roleSelect = document.getElementById("edit-role");
    const role = String(user.role || "").toLowerCase();
    const match = Array.from(roleSelect.options).find((o) => o.value.toLowerCase() === role);
    roleSelect.value = match ? match.value : "";

    const locked = isCapabilityUser(user);
    ["edit-role", "edit-assigned-to", "edit-admin"].forEach((id) => {
      document.getElementById(id).disabled = locked;
    });

    document.getElementById("edit-user-modal").classList.remove("hidden");
  }

  async function submitEdit(e) {
    e.preventDefault();
    const userId = document.getElementById("edit-user-id").value;
    const user = allUsers.find((u) => String(u.user_id) === String(userId));
    if (!user) return;

    const locked = isCapabilityUser(user);
    const newRegion = document.getElementById("edit-region").value;
    const newRole = document.getElementById("edit-role").value;
    const newAdmin = document.getElementById("edit-admin").checked;
    const newManager = document.getElementById("edit-assigned-to").value.trim();

    const calls = [
      Api.postForm(`/users/edit_info/${userId}`, {
        username: document.getElementById("edit-username").value,
        email: document.getElementById("edit-email").value,
        phone: document.getElementById("edit-phone").value,
      }),
    ];

    if (!locked) {
      const roleChanged = !!newRole && newRole.toLowerCase() !== String(user.role || "").toLowerCase();
      const adminChanged = newAdmin !== !!user.admin;
      if (roleChanged || adminChanged) {
        const payload = { admin: newAdmin ? "1" : "0" };
        if (roleChanged) payload.role = newRole;
        calls.push(Api.postForm(`/users/edit_role/${userId}`, payload));
      }
      if (newManager && newManager !== String(user.assigned_to_user_id || "")) {
        calls.push(
          Api.postForm(`/users/change_manager/${userId}`, { assigned_to_user_id: newManager })
        );
      }
    }

    try {
      await Promise.all(calls);
      if ((user.region || "cairo").toLowerCase() !== newRegion) {
        await Api.postForm(`/users/set_region/${userId}`, { region: newRegion });
      }
      alert("User updated");
      closeEditModal();
      Api.invalidate("/users");
      await loadUsers();
    } catch (err) {
      alert(err.data?.message || err.message || "Update failed.");
      Api.invalidate("/users");
      await loadUsers();
    }
  }

  function closeEditModal() {
    document.getElementById("edit-user-modal")?.classList.add("hidden");
  }

  function openPasswordModal(userId) {
    const user = allUsers.find((u) => u.user_id === userId);
    document.getElementById("password-user-id").value = userId;
    document.getElementById("password-user-label").textContent = user
      ? `${user.username} — #${user.user_id}`
      : "";
    document.getElementById("new-password").value = "";
    document.getElementById("change-password-modal").classList.remove("hidden");
  }

  function closePasswordModal() {
    document.getElementById("change-password-modal")?.classList.add("hidden");
  }

  function openPermissionsModal(userId) {
    const user = allUsers.find((u) => u.user_id === userId);
    if (!user) return;
    document.getElementById("permissions-user-id").value = userId;
    document.getElementById("permissions-user-label").textContent =
      `${user.username} — ${typeLabel(user)}`;
    document.getElementById("permissions-driver").value = String(user.driver ?? 0);
    document.getElementById("permissions-storage").value = String(user.storage ?? 0);
    document.getElementById("permissions-modal").classList.remove("hidden");
  }

  function closePermissionsModal() {
    document.getElementById("permissions-modal")?.classList.add("hidden");
  }

  async function submitPermissions() {
    const userId = document.getElementById("permissions-user-id").value;
    const user = allUsers.find((u) => String(u.user_id) === String(userId));
    const driver = Number(document.getElementById("permissions-driver").value);
    const storage = Number(document.getElementById("permissions-storage").value);

    if (driver > 0 && storage > 0) {
      alert("A user cannot be both a driver and a storage user. Set one of them back to 'Not'.");
      return;
    }

    const currentDriver = Number(user?.driver ?? 0);
    const currentStorage = Number(user?.storage ?? 0);
    if (driver === currentDriver && storage === currentStorage) {
      closePermissionsModal();
      return;
    }

    if ((driver > 0 && currentDriver === 0) || (storage > 0 && currentStorage === 0)) {
      if (!confirm(`Change permissions for ${user?.username || "this user"}?`)) return;
    }

    const btn = document.getElementById("permissions-save");
    btn.disabled = true;
    try {
      const steps = [];
      if (driver < currentDriver) steps.push(["driver", driver]);
      if (storage < currentStorage) steps.push(["storage", storage]);
      if (driver > currentDriver) steps.push(["driver", driver]);
      if (storage > currentStorage) steps.push(["storage", storage]);

      const messages = [];
      for (const [column, level] of steps) {
        const path =
          column === "driver"
            ? `/users/set_driver_role/${userId}`
            : `/users/set_storage_role/${userId}`;
        const data = await Api.post(path, { level });
        if (data?.message) messages.push(data.message);
      }

      alert(messages.join("\n") || "Permissions updated");
      closePermissionsModal();
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to update permissions.");
    } finally {
      btn.disabled = false;
      Api.invalidate("/users");
      await loadUsers();
    }
  }

  function openAssignNumberModal(userId) {
    const user = allUsers.find((u) => u.user_id === userId);
    document.getElementById("assign-user-id").value = userId;
    document.getElementById("target-user-label").textContent = user
      ? `${user.username} — #${user.user_id}`
      : "";
    document.getElementById("local-number").value = user?.cairo_target ?? user?.local_number ?? "";
    document.getElementById("abroad-number").value = user?.region_target ?? user?.abroad_number ?? "";
    document.getElementById("assign-number-modal").classList.remove("hidden");
  }

  function closeAssignNumberModal() {
    document.getElementById("assign-number-modal")?.classList.add("hidden");
  }

  async function submitAssignNumber() {
    const userId = document.getElementById("assign-user-id").value;
    try {
      await Api.postForm(`/users/assign_target/${userId}`, {
        cairo_target: document.getElementById("local-number").value,
        region_target: document.getElementById("abroad-number").value,
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

  function viewUser(userId) {
    window.location.href = `view-user.html?user_id=${userId}`;
  }

  window.closeEditModal = closeEditModal;
  window.closePasswordModal = closePasswordModal;
  window.closePermissionsModal = closePermissionsModal;
  window.closeAssignNumberModal = closeAssignNumberModal;
  window.submitAssignNumber = submitAssignNumber;
  window.viewUser = viewUser;
})();
