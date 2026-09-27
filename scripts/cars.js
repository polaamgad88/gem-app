(function () {
  const { Api, Auth, Async, DOM } = window.Utils;
  const esc = DOM.escapeHtml;

  let allCars = [];
  let allDrivers = [];
  let allDistributors = [];
  let assignKind = "driver";

  document.addEventListener("DOMContentLoaded", async () => {
    const token = await Auth.requireAuth();
    if (!token) return;

    const isAdmin = localStorage.getItem("is_admin") === "1";
    const isDriverManager = localStorage.getItem("driver_manager") === "1";
    if (!isAdmin && !isDriverManager) {
      alert("مش مسموحلك تدخل الصفحة دي.");
      window.location.href = "dashboard.html";
      return;
    }

    wireTabs();
    wireToolbars();
    wireModals();

    await Promise.all([loadCars(), loadDrivers(), loadDistributors()]);

    toggleView();
    window.addEventListener("resize", Async.throttle(toggleView, 150));
  });

  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      Api.invalidate("/cars", "/drivers", "/distributors");
      loadCars();
      loadDrivers();
      loadDistributors();
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
      alert(err.data?.message || err.message || "مقدرناش نحمل العربيات.");
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
      alert(err.data?.message || err.message || "مقدرناش نحمل السواقين.");
    }
  }

  async function loadDistributors() {
    try {
      const query = {
        active: document.getElementById("distributor-filter-active")?.value || "",
        search: document.getElementById("distributor-search")?.value.trim() || "",
      };
      const data = await Api.get("/distributors", { query });
      allDistributors = data.distributors || [];
      renderDistributors(allDistributors);
    } catch (err) {
      console.error("Failed to load distributors:", err);
      alert(err.data?.message || err.message || "مقدرناش نحمل الموزعين.");
    }
  }

  async function refreshFleet() {
    Api.invalidate("/cars", "/drivers", "/distributors");
    await Promise.all([loadCars(), loadDrivers(), loadDistributors()]);
  }

  function regionLabel(region) {
    const r = (region || "cairo").toLowerCase();
    if (r === "cairo") return "القاهرة";
    if (r === "alex") return "اسكندرية";
    return r;
  }

  function regionPill(region) {
    const r = (region || "cairo").toLowerCase();
    return `<span class="region-pill region-pill--${r}">${esc(regionLabel(r))}</span>`;
  }

  function carDetails(car) {
    return car.year ? esc(String(car.year)) : "—";
  }

  function driverCell(car) {
    if (!car.assigned_user) return `<span class="muted">مش مربوط</span>`;
    const inactive = car.assigned_user.active ? "" : " (متوقف)";
    return `${esc(car.assigned_user.username)}${esc(inactive)}`;
  }

  function distributorCell(car) {
    if (!car.assigned_distributor) return `<span class="muted">مش مربوط</span>`;
    const inactive = car.assigned_distributor.active ? "" : " (متوقف)";
    return `${esc(car.assigned_distributor.username)}${esc(inactive)}`;
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
        <td>${distributorCell(car)}</td>
        <td><div class="row-actions">${actions}</div></td>`;
      rows.appendChild(tr);

      const card = document.createElement("div");
      card.className = "fleet-card";
      card.innerHTML = `
        <p><strong>نمر العربية:</strong> ${plateCell}</p>
        <p><strong>الماركة / الموديل:</strong> ${nameCell}</p>
        <p><strong>التفاصيل:</strong> ${carDetails(car)}</p>
        <p><strong>المنطقة:</strong> ${regionPill(car.region)}</p>
        <p><strong>السواق:</strong> ${driverCell(car)}</p>
        <p><strong>الموزع:</strong> ${distributorCell(car)}</p>
        <div class="card-actions"><div class="row-actions">${actions}</div></div>`;
      cards.appendChild(card);
    });

    tbody.replaceChildren(rows);
    cardWrap.replaceChildren(cards);
  }

  function carActions(car) {
    const driverBtn = car.assigned_user
      ? `<button class="btn toggle-btn" data-car-action="deassign" data-id="${car.car_id}">فك ربط السواق</button>`
      : `<button class="btn view-btn" data-car-action="assign" data-id="${car.car_id}">ربط سواق</button>`;
    const distributorBtn = car.assigned_distributor
      ? `<button class="btn toggle-btn" data-car-action="deassign-distributor" data-id="${car.car_id}">فك ربط الموزع</button>`
      : `<button class="btn view-btn" data-car-action="assign-distributor" data-id="${car.car_id}">ربط موزع</button>`;
    const stateBtn = car.active
      ? `<button class="btn delete-btn" data-car-action="delete" data-id="${car.car_id}">إيقاف</button>`
      : `<button class="btn view-btn" data-car-action="reactivate" data-id="${car.car_id}">تشغيل</button>`;
    return `
      <button class="btn" data-car-action="edit" data-id="${car.car_id}">تعديل</button>
      ${car.active ? driverBtn + distributorBtn : ""}
      ${stateBtn}`;
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
        d.is_driver_manager ? ` <span class="mgr-pill">مدير سواقين</span>` : ""
      }`;
      const carCell = d.car
        ? `<span class="plate">${esc(d.car.plate)}</span>`
        : `<span class="muted">من غير عربية</span>`;
      const statusCell = `<span class="status-pill status-pill--${isActive ? "on" : "off"}">${
        isActive ? "شغال" : "متوقف"
      }</span>`;
      const count = Number(d.deliveries_count || 0);
      const activityCell = count
        ? `<span class="count-pill">${count}</span>
           <span class="muted last-seen">${esc(d.last_delivery_at || "")}</span>`
        : `<span class="muted">مفيش لسه</span>`;
      const actions = `
        <button class="btn view-btn" data-driver-action="history" data-id="${d.user_id}">سجل التوصيلات</button>
        <button class="btn toggle-btn" data-driver-action="toggle" data-id="${d.user_id}" data-status="${
          isActive ? 0 : 1
        }">${isActive ? "إيقاف" : "تشغيل"}</button>`;

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
        <p><strong>اسم المستخدم:</strong> ${nameCell}</p>
        <p><strong>رقم التليفون:</strong> ${esc(d.phone || "—")}</p>
        <p><strong>المنطقة:</strong> ${regionPill(d.region)}</p>
        <p><strong>العربية:</strong> ${carCell}</p>
        <p><strong>التوصيلات:</strong> ${activityCell}</p>
        <p><strong>الحالة:</strong> ${statusCell}</p>
        <div class="card-actions"><div class="row-actions">${actions}</div></div>`;
      cards.appendChild(card);
    });

    tbody.replaceChildren(rows);
    cardWrap.replaceChildren(cards);
  }

  function renderDistributors(distributors) {
    const tbody = document.getElementById("distributors-table-body");
    const cardWrap = document.getElementById("distributor-cards");
    document.getElementById("distributors-empty")?.classList.toggle("hidden", distributors.length > 0);
    if (!tbody || !cardWrap) return;
    const rows = document.createDocumentFragment();
    const cards = document.createDocumentFragment();
    distributors.forEach((p) => {
      const isActive = Number(p.active) === 1;
      const name = `${esc(p.username)} - ${esc(p.user_id)}`;
      const car = p.car ? `<span class="plate">${esc(p.car.plate)}</span>` : `<span class="muted">من غير عربية</span>`;
      const status = `<span class="status-pill status-pill--${isActive ? "on" : "off"}">${isActive ? "شغال" : "متوقف"}</span>`;
      const action = `<button class="btn toggle-btn" data-distributor-action="toggle" data-id="${p.user_id}" data-status="${isActive ? 0 : 1}">${isActive ? "إيقاف" : "تشغيل"}</button>`;
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${name}</td><td>${esc(p.phone || "—")}</td><td>${regionPill(p.region)}</td><td>${car}</td><td>${status}</td><td><div class="row-actions">${action}</div></td>`;
      rows.appendChild(tr);
      const card = document.createElement("div");
      card.className = "fleet-card";
      card.innerHTML = `<p><strong>اسم المستخدم:</strong> ${name}</p><p><strong>رقم التليفون:</strong> ${esc(p.phone || "—")}</p><p><strong>المنطقة:</strong> ${regionPill(p.region)}</p><p><strong>العربية:</strong> ${car}</p><p><strong>الحالة:</strong> ${status}</p><div class="card-actions"><div class="row-actions">${action}</div></div>`;
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

    document.getElementById("distributor-search")?.addEventListener("input", Async.debounce(loadDistributors, 250));
    document.getElementById("distributor-filter-active")?.addEventListener("change", loadDistributors);
    document.getElementById("add-distributor-btn")?.addEventListener("click", () => {
      window.location.href = "create-user.html?distributor=1";
    });

    document.body.addEventListener("click", (e) => {
      const carBtn = e.target.closest("[data-car-action]");
      if (carBtn) {
        const id = parseInt(carBtn.dataset.id, 10);
        const action = carBtn.dataset.carAction;
        if (action === "edit") openCarModal(id);
        else if (action === "assign") openAssignModal(id, "driver");
        else if (action === "assign-distributor") openAssignModal(id, "distributor");
        else if (action === "deassign-distributor") deassignDistributor(id);
        else if (action === "deassign") deassignCar(id);
        else if (action === "delete") deactivateCar(id);
        else if (action === "reactivate") reactivateCar(id);
        return;
      }

      const distributorBtn = e.target.closest("[data-distributor-action]");
      if (distributorBtn) {
        toggleDistributor(parseInt(distributorBtn.dataset.id, 10), parseInt(distributorBtn.dataset.status, 10));
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
    document.getElementById("car-modal-title").textContent = car ? "تعديل" : "ضيف عربية";
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
      alert("نمر العربية مطلوبة.");
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
      alert(err.data?.message || err.message || "مقدرناش نحفظ العربية.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function openAssignModal(carId, kind) {
    const car = allCars.find((c) => c.car_id === carId);
    if (!car) return;

    try {
      const data = await Api.get(kind === "distributor" ? "/distributors" : "/drivers", {
        query: { active: "1" },
      });
      const available = kind === "distributor" ? data.distributors || [] : data.drivers || [];
      const select = document.getElementById("assign-driver");
      const options = available
        .filter((person) => !person.car && person.region === car.region)
        .map((person) => `<option value="${person.user_id}">${esc(person.username)} — ${esc(regionLabel(person.region))}</option>`)
        .join("");
      const label = kind === "distributor" ? "الموزع" : "السواق";
      assignKind = kind;
      document.getElementById("assign-car-id").value = carId;
      document.getElementById("assign-car-label").textContent =
        `${car.plate}${car.brand ? ` — ${car.brand}` : ""}`;
      document.getElementById("assign-modal-title").textContent = `ربط ${label} بالعربية`;
      document.getElementById("assign-person-label").textContent = label;
      select.innerHTML = options
        ? `<option value="">اختار ${label}...</option>${options}`
        : `<option value="">مفيش ${kind === "distributor" ? "موزعين" : "سواقين"} متاحين</option>`;
      document.getElementById("assign-modal").classList.remove("hidden");
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نحمل الأشخاص المتاحين.");
    }
  }

  async function submitAssign(e) {
    e.preventDefault();
    const carId = document.getElementById("assign-car-id").value;
    const userId = document.getElementById("assign-driver").value;
    if (!userId) {
      alert(`اختار ${assignKind === "distributor" ? "الموزع" : "السواق"} الأول.`);
      return;
    }
    try {
      await Api.post(`/cars/${carId}/${assignKind === "distributor" ? "assign-distributor" : "assign"}`, { user_id: Number(userId) });
      closeModal("assign-modal");
      await refreshFleet();
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نربط العربية.");
    }
  }

  async function deassignCar(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    const who = car?.assigned_user?.username || "السواق";
    if (!confirm(`تفك ربط ${car?.plate || "العربية دي"} من ${who}؟`)) return;
    try {
      await Api.post(`/cars/${carId}/deassign`);
      Api.invalidate("/cars", "/drivers", "/distributors");
      await Promise.all([loadCars(), loadDrivers(), loadDistributors()]);
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نفك ربط العربية.");
    }
  }

  async function deassignDistributor(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    if (!confirm(`تفك ربط ${car?.plate || "العربية دي"} من ${car?.assigned_distributor?.username || "الموزع"}؟`)) return;
    try {
      await Api.post(`/cars/${carId}/deassign-distributor`);
      await refreshFleet();
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نفك ربط الموزع.");
    }
  }

  async function deactivateCar(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    if (
      !confirm(
        `توقف ${car?.plate || "العربية دي"}؟\n\n` +
          "هيتفك ربط العربية من السواق والموزع ومش هتظهر في قائمة العربيات الشغالة. " +
          "التوصيلات القديمة هتفضل مرتبطة بيها."
      )
    )
      return;
    try {
      await Api.del(`/cars/delete/${carId}`);
      Api.invalidate("/cars", "/drivers", "/distributors");
      await Promise.all([loadCars(), loadDrivers(), loadDistributors()]);
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نوقف العربية.");
    }
  }

  async function reactivateCar(carId) {
    const car = allCars.find((c) => c.car_id === carId);
    if (!confirm(`تشغل ${car?.plate || "العربية دي"}؟`)) return;
    try {
      await Api.post(`/cars/${carId}/reactivate`);
      Api.invalidate("/cars", "/drivers", "/distributors");
      await Promise.all([loadCars(), loadDrivers(), loadDistributors()]);
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نشغل العربية.");
    }
  }

  async function toggleDistributor(userId, newStatus) {
    const distributor = allDistributors.find((p) => p.user_id === userId);
    const action = newStatus ? "تشغيل" : "إيقاف";
    const note = newStatus ? "" : "\n\nهيتفك ربط الموزع من العربية.";
    if (!confirm(`${action} ${distributor?.username || "الموزع ده"}؟${note}`)) return;
    try {
      await Api.post(`/distributors/set_active/${userId}/${newStatus}`);
      await refreshFleet();
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نحدّث حالة الموزع.");
    }
  }

  async function toggleDriver(userId, newStatus) {
    const driver = allDrivers.find((d) => d.user_id === userId);
    const verb = newStatus === 1 ? "تشغيل" : "إيقاف";
    let msg = `${verb} ${driver?.username || "السواق ده"}؟`;
    if (newStatus === 0) {
      msg += "\n\nهيتعمله تسجيل خروج وهيتفك ربط العربية منه.";
    }
    if (!confirm(msg)) return;
    try {
      await Api.post(`/drivers/set_active/${userId}/${newStatus}`);
      Api.invalidate("/cars", "/drivers", "/distributors");
      await Promise.all([loadCars(), loadDrivers(), loadDistributors()]);
    } catch (err) {
      alert(err.data?.message || err.message || "مقدرناش نحدّث حالة السواق.");
    }
  }
})();
