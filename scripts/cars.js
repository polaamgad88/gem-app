(function () {
  const { Api, Auth, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  let allCars = [];
  let allDrivers = [];

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isAdmin = localStorage.getItem("is_admin") === "1";
    const isDriverManager = localStorage.getItem("driver_manager") === "1";
    if (!isAdmin && !isDriverManager) {
      alert("You do not have permission to access this page.");
      window.location.href = "dashboard.html";
      return;
    }

    wireTabs();
    wireToolbars();
    wireModals();

    await Promise.all([loadCars(), loadDrivers()]);

    toggleView();
    window.addEventListener("resize", Async.throttle(toggleView, 150));
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      Api.invalidate("/cars", "/drivers");
      loadCars();
      loadDrivers();
    }
  });

  function wireTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll(".tab-btn").forEach((b) => {
          b.classList.toggle("active", b === btn);
        });
        document.querySelectorAll(".tab-panel").forEach((panel) => {
          panel.classList.toggle("hidden", panel.id !== `tab-${tab}`);
        });
        toggleView();
      });
    });
  }

  function toggleView() {
    const mobile = window.innerWidth <= 768;
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const table = panel.querySelector(".table-responsive");
      const cards = panel.querySelector(".card-view");
      if (!table || !cards) return;
      table.style.display = mobile ? "none" : "block";
      cards.style.display = mobile ? "block" : "none";
    });
  }

  async function loadCars() {
    try {
      const query = {
        assigned: document.getElementById("car-filter-assigned")?.value || "",
        active: document.getElementById("car-filter-active")?.value ?? "1",
        search: document.getElementById("car-search")?.value.trim() || "",
      };
      const data = await Api.get("/cars", { query });
      allCars = data.cars || [];
      renderCars(allCars);
    } catch (err) {
      console.error("Failed to load cars:", err);
      alert(err.data?.message || err.message || "Could not load cars.");
    }
  }

  async function loadDrivers() {
    try {
      const query = {
        active: document.getElementById("driver-filter-active")?.value || "",
        search: document.getElementById("driver-search")?.value.trim() || "",
      };
      const data = await Api.get("/drivers", { query });
      allDrivers = data.drivers || [];
      renderDrivers(allDrivers);
    } catch (err) {
      console.error("Failed to load drivers:", err);
      alert(err.data?.message || err.message || "Could not load drivers.");
    }
  }

  function regionPill(region) {
    const r = (region || "cairo").toLowerCase();
    return `<span class="region-pill region-pill--${r}">${r.toUpperCase()}</span>`;
  }

  function carDetails(car) {
    return car.year ? esc(String(car.year)) : "—";
  }

  function driverCell(car) {
    if (!car.assigned_user) return `<span class="muted">Unassigned</span>`;
    const inactive = car.assigned_user.active ? "" : " (Inactive)";
    return `${esc(car.assigned_user.username)}${esc(inactive)}`;
  }

  function renderCars(cars) {
    const tbody = document.getElementById("cars-table-body");
    const cardWrap = document.getElementById("car-cards");
    const empty = document.getElementById("cars-empty");
    if (!tbody || !cardWrap) return;

    empty?.classList.toggle("hidden", cars.length > 0);

    const rows = document.createDocumentFragment();
    const cards = document.createDocumentFragment();

    cars.forEach((car) => {
      const plateCell = `<span class="plate${car.active ? "" : " plate--inactive"}">${esc(car.plate)}</span>`;
      const nameCell = esc([car.brand, car.model].filter(Boolean).join(" ") || "—");
      const actions = carActions(car);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${plateCell}</td>
        <td>${nameCell}</td>
        <td>${carDetails(car)}</td>
        <td>${regionPill(car.region)}</td>
        <td>${driverCell(car)}</td>
        <td><div class="row-actions">${actions}</div></td>`;
      rows.appendChild(tr);

      const card = document.createElement("div");
      card.className = "fleet-card";
      card.innerHTML = `
        <p><strong>Plate:</strong> ${plateCell}</p>
        <p><strong>Brand / Model:</strong> ${nameCell}</p>
        <p><strong>Details:</strong> ${carDetails(car)}</p>
        <p><strong>Region:</strong> ${regionPill(car.region)}</p>
        <p><strong>Driver:</strong> ${driverCell(car)}</p>
        <div class="card-actions"><div class="row-actions">${actions}</div></div>`;
      cards.appendChild(card);
    });

    tbody.replaceChildren(rows);
    cardWrap.replaceChildren(cards);
  }

  function carActions(car) {
    const assignBtn = car.assigned_user
      ? `<button class="btn toggle-btn" data-car-action="deassign" data-id="${car.car_id}">Deassign</button>`
      : `<button class="btn view-btn" data-car-action="assign" data-id="${car.car_id}">Assign</button>`;
    const deleteBtn = car.active
      ? `<button class="btn delete-btn" data-car-action="delete" data-id="${car.car_id}">Deactivate</button>`
      : "";
    return `
      <button class="btn" data-car-action="edit" data-id="${car.car_id}">Edit</button>
      ${car.active ? assignBtn : ""}
      ${deleteBtn}`;
  }

  function renderDrivers(drivers) {
    const tbody = document.getElementById("drivers-table-body");
    const cardWrap = document.getElementById("driver-cards");
    const empty = document.getElementById("drivers-empty");
    if (!tbody || !cardWrap) return;

    empty?.classList.toggle("hidden", drivers.length > 0);

    const rows = document.createDocumentFragment();
    const cards = document.createDocumentFragment();

    drivers.forEach((d) => {
      const isActive = Number(d.active) === 1;
      const nameCell = `<span class="${isActive ? "" : "inactive-badge"}">${esc(d.username)} - ${esc(d.user_id)}</span>${
        d.is_driver_manager ? ` <span class="mgr-pill">MANAGER</span>` : ""
      }`;
      const carCell = d.car
        ? `<span class="plate">${esc(d.car.plate)}</span>`
        : `<span class="muted">No car</span>`;
      const statusCell = `<span class="status-pill status-pill--${isActive ? "on" : "off"}">${
        isActive ? "Active" : "Stopped"
      }</span>`;
      const count = Number(d.deliveries_count || 0);
      const activityCell = count
        ? `<span class="count-pill">${count}</span>
           <span class="muted last-seen">${esc(d.last_delivery_at || "")}</span>`
        : `<span class="muted">None yet</span>`;
      const actions = `
        <button class="btn view-btn" data-driver-action="history" data-id="${d.user_id}">History</button>
        <button class="btn toggle-btn" data-driver-action="toggle" data-id="${d.user_id}" data-status="${
          isActive ? 0 : 1
        }">${isActive ? "Stop" : "Activate"}</button>`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${nameCell}</td>
        <td>${esc(d.phone || "—")}</td>
        <td>${regionPill(d.region)}</td>
        <td>${carCell}</td>
        <td>${activityCell}</td>
        <td>${statusCell}</td>
        <td><div class="row-actions">${actions}</div></td>`;
      rows.appendChild(tr);

      const card = document.createElement("div");
      card.className = "fleet-card";
      card.innerHTML = `
        <p><strong>Username:</strong> ${nameCell}</p>
        <p><strong>Phone:</strong> ${esc(d.phone || "—")}</p>
        <p><strong>Region:</strong> ${regionPill(d.region)}</p>
        <p><strong>Car:</strong> ${carCell}</p>
        <p><strong>Deliveries:</strong> ${activityCell}</p>
        <p><strong>Status:</strong> ${statusCell}</p>
        <div class="card-actions"><div class="row-actions">${actions}</div></div>`;
      cards.appendChild(card);
    });

    tbody.replaceChildren(rows);
    cardWrap.replaceChildren(cards);
  }

  function wireToolbars() {
    const carSearch = Async.debounce(loadCars, 250);
    document.getElementById("car-search")?.addEventListener("input", carSearch);
    document.getElementById("car-filter-assigned")?.addEventListener("change", loadCars);
    document.getElementById("car-filter-active")?.addEventListener("change", loadCars);
    document.getElementById("add-car-btn")?.addEventListener("click", () => openCarModal(null));

    const driverSearch = Async.debounce(loadDrivers, 250);
    document.getElementById("driver-search")?.addEventListener("input", driverSearch);
    document.getElementById("driver-filter-active")?.addEventListener("change", loadDrivers);
    document.getElementById("add-driver-btn")?.addEventListener("click", () => {
      window.location.href = "create-user.html?driver=1";
    });

    document.body.addEventListener("click", (e) => {
      const carBtn = e.target.closest("[data-car-action]");
      if (carBtn) {
        const id = parseInt(carBtn.dataset.id, 10);
        const action = carBtn.dataset.carAction;
        if (action === "edit") openCarModal(id);
        else if (action === "assign") openAssignModal(id);
        else if (action === "deassign") deassignCar(id);
        else if (action === "delete") deactivateCar(id);
        return;
      }

      const driverBtn = e.target.closest("[data-driver-action]");
      if (driverBtn) {
        const id = parseInt(driverBtn.dataset.id, 10);
        const action = driverBtn.dataset.driverAction;
        if (action === "toggle") {
          toggleDriver(id, parseInt(driverBtn.dataset.status, 10));
        } else if (action === "history") {
          window.location.href = `deliveries.html?driver_user_id=${id}`;
        }
      }
    });
  }

  function wireModals() {
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal(modal.id);
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".modal:not(.hidden)").forEach((m) => closeModal(m.id));
    });

    document.getElementById("car-form")?.addEventListener("submit", saveCar);
    document.getElementById("assign-form")?.addEventListener("submit", submitAssign);
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
  }

  function openCarModal(carId) {
    const car = carId ? allCars.find((c) => c.car_id === carId) : null;
    document.getElementById("car-modal-title").textContent = car ? "Edit Car" : "Add Car";
    document.getElementById("car-id").value = car ? car.car_id : "";
    document.getElementById("car-plate").value = car?.plate || "";
    document.getElementById("car-brand").value = car?.brand || "";
    document.getElementById("car-model").value = car?.model || "";
    document.getElementById("car-year").value = car?.year || "";
    document.getElementById("car-notes").value = car?.notes || "";
    document.getElementById("car-region").value = (
      car?.region || localStorage.getItem("region") || "cairo"
    ).toLowerCase();
    document.getElementById("car-modal").classList.remove("hidden");
    document.getElementById("car-plate").focus();
  }

  async function saveCar(e) {
    e.preventDefault();
    const carId = document.getElementById("car-id").value;
    const payload = {
      plate: document.getElementById("car-plate").value.trim(),
      brand: document.getElementById("car-brand").value.trim(),
      model: document.getElementById("car-model").value.trim(),
      year: document.getElementById("car-year").value,
      notes: document.getElementById("car-notes").value.trim(),
      region: document.getElementById("car-region").value,
    };

    if (!payload.plate) {
      alert("Plate is required.");
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (carId) await Api.post(`/cars/edit/${carId}`, payload);
      else await Api.post("/cars", payload);
      closeModal("car-modal");
      Api.invalidate("/cars");
      await loadCars();
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to save the car.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function openAssignModal(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    if (!car) return;

    document.getElementById("assign-car-id").value = carId;
    document.getElementById("assign-car-label").textContent =
      `${car.plate}${car.brand ? ` — ${car.brand}` : ""}`;

    const select = document.getElementById("assign-driver");
    const options = allDrivers
      .filter((d) => Number(d.active) === 1 && !d.car)
      .map((d) => `<option value="${d.user_id}">${esc(d.username)} — ${esc(d.region)}</option>`)
      .join("");
    select.innerHTML = `<option value="">Select a driver...</option>${options}`;

    if (!options) {
      select.innerHTML = `<option value="">No free drivers available</option>`;
    }

    document.getElementById("assign-modal").classList.remove("hidden");
  }

  async function submitAssign(e) {
    e.preventDefault();
    const carId = document.getElementById("assign-car-id").value;
    const userId = document.getElementById("assign-driver").value;
    if (!userId) {
      alert("Please select a driver.");
      return;
    }
    try {
      await Api.post(`/cars/${carId}/assign`, { user_id: Number(userId) });
      closeModal("assign-modal");
      Api.invalidate("/cars", "/drivers");
      await Promise.all([loadCars(), loadDrivers()]);
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to assign the car.");
    }
  }

  async function deassignCar(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    const who = car?.assigned_user?.username || "this driver";
    if (!confirm(`Remove ${car?.plate || "this car"} from ${who}?`)) return;
    try {
      await Api.post(`/cars/${carId}/deassign`);
      Api.invalidate("/cars", "/drivers");
      await Promise.all([loadCars(), loadDrivers()]);
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to deassign the car.");
    }
  }

  async function deactivateCar(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    if (
      !confirm(
        `Deactivate ${car?.plate || "this car"}?\n\n` +
          "It will be unassigned from its driver and hidden from the active list. " +
          "Past deliveries keep their link to it."
      )
    )
      return;
    try {
      await Api.del(`/cars/delete/${carId}`);
      Api.invalidate("/cars", "/drivers");
      await Promise.all([loadCars(), loadDrivers()]);
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to deactivate the car.");
    }
  }

  async function toggleDriver(userId, newStatus) {
    const driver = allDrivers.find((d) => d.user_id === userId);
    const verb = newStatus === 1 ? "Activate" : "Stop";
    let msg = `${verb} ${driver?.username || "this driver"}?`;
    if (newStatus === 0) {
      msg += "\n\nThey will be logged out and their car will be unassigned.";
    }
    if (!confirm(msg)) return;
    try {
      await Api.post(`/drivers/set_active/${userId}/${newStatus}`);
      Api.invalidate("/cars", "/drivers");
      await Promise.all([loadCars(), loadDrivers()]);
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to update the driver.");
    }
  }
})();
