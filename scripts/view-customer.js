const { Api, Auth, DOM, Format } = window.Utils;
const esc = DOM.escapeHtml;

let currentEditAddressId = null;
let addressMap = null;
let addressMarker = null;
let selectedLat = null;
let selectedLng = null;

document.addEventListener("DOMContentLoaded", async () => {
  const customerId = Utils.URL.getParam("customer_id");
  const token = await Auth.requireAuth();
  if (!token) return;

  if (!customerId) {
    alert("Missing customer ID.");
    return;
  }

  initAddressMap();

  await Promise.all([
    loadCustomerDetails(customerId),
    setupAddDelegateDropdown(),
  ]);

  toggleOrderViews();
  window.addEventListener("resize", Utils.Async.throttle(toggleOrderViews, 150));

  wireEditCustomerModal(customerId);
  wireDelegateModal(customerId);
  wireAddressModal(customerId);
  wireOrderViewDelegation();
});

function initAddressMap() {
  if (typeof L === "undefined") return;
  const mapEl = document.getElementById("map");
  if (!mapEl || addressMap) return;

  addressMap = L.map("map").setView([30.0444, 31.2357], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(addressMap);

  addressMap.on("click", (e) => {
    selectedLat = e.latlng.lat;
    selectedLng = e.latlng.lng;
    if (!addressMarker) {
      addressMarker = L.marker([selectedLat, selectedLng]).addTo(addressMap);
    } else {
      addressMarker.setLatLng([selectedLat, selectedLng]);
    }
  });
}

function resetMarker() {
  if (addressMarker) {
    addressMap.removeLayer(addressMarker);
    addressMarker = null;
  }
  selectedLat = null;
  selectedLng = null;
}

function wireEditCustomerModal(customerId) {
  const openBtn = document.getElementById("edit-customer-btn");
  const modal = document.getElementById("edit-customer-modal");
  const closeBtn = document.getElementById("edit-customer-close");
  const saveBtn = document.getElementById("save-customer-btn");
  if (!openBtn || !modal || !saveBtn) return;

  openBtn.addEventListener("click", () => {
    document.getElementById("edit-name").value =
      document.getElementById("customer-name").textContent;
    document.getElementById("edit-phone").value =
      document.getElementById("customer-phone").textContent;
    document.getElementById("edit-email").value =
      document.getElementById("customer-email").textContent;
    modal.style.display = "block";
  });

  closeBtn?.addEventListener("click", () => (modal.style.display = "none"));

  saveBtn.addEventListener("click", async () => {
    const fullName = document.getElementById("edit-name").value.trim();
    const phone = document.getElementById("edit-phone").value.trim();
    const email = document.getElementById("edit-email").value.trim();
    const [first_name, ...rest] = fullName.split(" ");
    const last_name = rest.join(" ");

    saveBtn.disabled = true;
    try {
      await Api.postForm(`/customers/edit/${customerId}`, {
        first_name,
        last_name,
        phone,
        email,
      });
      modal.style.display = "none";
      document.getElementById("customer-name").textContent = fullName;
      document.getElementById("customer-phone").textContent = phone;
      document.getElementById("customer-email").textContent = email;
      Api.invalidate("/customers", `/customer/find/${customerId}`);
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to update customer.");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function wireDelegateModal(customerId) {
  const openBtn = document.getElementById("add-Delegate-btn");
  const modal = document.getElementById("Delegate-modal");
  const closeBtn = modal?.querySelector(".close-btn");
  const saveBtn = document.getElementById("save-Delegate-btn");
  if (!openBtn || !modal || !saveBtn) return;

  openBtn.addEventListener("click", () => (modal.style.display = "block"));
  closeBtn?.addEventListener("click", () => (modal.style.display = "none"));

  saveBtn.addEventListener("click", async () => {
    const select = document.getElementById("Delegate-dropdown");
    const userId = select.value;
    const username = select.selectedOptions[0]?.text || "";
    if (!userId) return;

    saveBtn.disabled = true;
    try {
      await Api.postForm("/customers/assign", {
        customer_id: customerId,
        target_user_id: userId,
      });
      addDelegateToList(userId, username);
      modal.style.display = "none";
    } catch (err) {
      alert(err.data?.message || err.message || "Failed to assign Delegate.");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

function wireAddressModal(customerId) {
  const openBtn = document.getElementById("add-address-btn");
  const modal = document.getElementById("address-modal");
  const closeBtn = document.getElementById("address-close");
  const saveBtn = document.getElementById("address-save-btn");
  const input = document.getElementById("address-input");
  if (!openBtn || !modal || !saveBtn || !input) return;

  openBtn.addEventListener("click", () => {
    currentEditAddressId = null;
    input.value = "";
    resetMarker();
    modal.style.display = "flex";
    setTimeout(() => addressMap?.invalidateSize(), 200);
  });

  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
    currentEditAddressId = null;
  });

  saveBtn.addEventListener("click", async () => {
    const address = input.value.trim();
    if (!address) {
      alert("Address cannot be empty");
      return;
    }

    const body = { address };
    if (selectedLat != null && selectedLng != null) {
      body.latitude = selectedLat;
      body.longitude = selectedLng;
    }

    saveBtn.disabled = true;
    try {
      if (currentEditAddressId) {
        await Api.postForm(`/customers/address/edit/${currentEditAddressId}`, body);
      } else {
        await Api.postForm(`/customers/address/create`, {
          customer_id: customerId,
          ...body,
        });
      }
      await loadCustomerAddresses(customerId);
      modal.style.display = "none";
      input.value = "";
      currentEditAddressId = null;
      resetMarker();
    } catch (err) {
      alert(err.data?.message || err.message || "Operation failed.");
    } finally {
      saveBtn.disabled = false;
    }
  });
}

async function loadCustomerAddresses(customerId) {
  try {
    const data = await Api.get(`/customers/${customerId}/addresses`);
    const ul = document.getElementById("address-list");
    if (!ul) return;
    DOM.replaceChildren(ul, data.addresses || [], (addr) => {
      const li = document.createElement("li");
      li.dataset.addressId = addr.address_id;
      li.innerHTML = `
        <span>${esc(addr.address)}</span>
        <div class="address-actions">
          <button class="edit-btn" data-action="edit-address" data-id="${addr.address_id}" data-value="${esc(
        addr.address
      )}">Edit</button>
          <button class="delete-btn" data-action="delete-address" data-id="${addr.address_id}">Delete</button>
        </div>`;
      return li;
    });
  } catch (err) {
    console.error("Error loading addresses:", err);
  }
}

async function loadCustomerDetails(customerId) {
  try {
    const [custResp, ordersResp] = await Promise.all([
      Api.get(`/customer/find/${customerId}`),
      Api.get(`/orders`, { query: { customer_id: customerId } }),
    ]);

    const customer = custResp.customer;
    const orders = ordersResp.orders || [];

    document.getElementById("customer-name").textContent = `${customer.first_name} ${customer.last_name}`;
    document.getElementById("customer-id").textContent = `CUST-${customer.customer_id}`;
    document.getElementById("customer-phone").textContent = customer.phone || "";
    document.getElementById("customer-email").textContent = customer.email || "";

    const list = document.getElementById("Delegate-list");
    list.innerHTML = "";
    (customer.assigned_users || []).forEach(({ user_id, username }) => {
      addDelegateToList(user_id, username);
    });

    renderOrdersTable(orders);
    renderOrderCards(orders);
    updateTotalIncome(orders);

    await loadCustomerAddresses(customerId);
  } catch (err) {
    console.error("Failed to load customer info", err);
    alert("Failed to load customer.");
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("order-list");
  if (!tbody) return;

  const sorted = [...orders].sort(
    (a, b) => new Date(b.order_date) - new Date(a.order_date)
  );

  DOM.replaceChildren(tbody, sorted, (o, i) => {
    const tr = document.createElement("tr");
    const dateStr = o.order_date ? Format.date(o.order_date) : "";
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${esc(o.order_id)}</td>
      <td>${esc(dateStr)}</td>
      <td>${esc(o.username || "")}</td>
      <td>${esc(o.status || "")}</td>
      <td class="price">${Format.currency(o.total_amount)}</td>
      <td><button class="view-btn" data-action="view-order" data-id="${o.order_id}">View</button></td>`;
    return tr;
  });
}

function updateTotalIncome(orders) {
  let total = 0;
  for (const o of orders) {
    const status = (o.status || "").toLowerCase();
    if (!["refunded", "canceled"].includes(status)) {
      total += parseFloat(o.total_amount) || 0;
    }
  }
  const el = document.getElementById("total-income-value");
  if (!el) return;
  el.textContent =
    total % 1 === 0
      ? `EGP ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      : `EGP ${total.toLocaleString(undefined, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 2,
        })}`;
}

function renderOrderCards(orders) {
  const cardsContainer = document.getElementById("ordersCards");
  if (!cardsContainer) return;
  DOM.replaceChildren(cardsContainer, orders, (order) => {
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <div class="order-card-header">
        <span>Order #${esc(order.order_id)}</span>
        <span>${esc(Format.date(order.order_date))}</span>
      </div>
      <div class="order-card-body">
        <p><strong>Delegate:</strong> ${esc(order.username || "")}</p>
        <p><strong>Status:</strong> ${esc(order.status || "")}</p>
        <p><strong>Total:</strong> ${Format.currency(order.total_amount)}</p>
      </div>
      <div class="order-card-footer">
        <button class="view-btn" data-action="view-order" data-id="${order.order_id}">View</button>
      </div>`;
    return card;
  });
}

function toggleOrderViews() {
  const table = document.querySelector("table");
  const cardView = document.querySelector(".card-view");
  if (!table || !cardView) return;
  if (window.innerWidth <= 768) {
    table.style.display = "none";
    cardView.style.display = "block";
  } else {
    table.style.display = "table";
    cardView.style.display = "none";
  }
}

async function setupAddDelegateDropdown() {
  try {
    const data = await Api.getCached("/users", { cacheTtl: 5 * 60 * 1000 });
    const select = document.getElementById("Delegate-dropdown");
    if (!select) return;
    DOM.replaceChildren(select, data.users || [], (u) => {
      const opt = document.createElement("option");
      opt.value = u.user_id;
      opt.textContent = u.username;
      return opt;
    });
  } catch (err) {
    console.error("Failed to fetch users:", err);
  }
}

function addDelegateToList(userId, username) {
  const li = document.createElement("li");
  li.dataset.userId = userId;
  li.innerHTML = `
    ${esc(username)}
    <button class="remove-btn" data-action="remove-delegate" data-id="${userId}" data-name="${esc(
    username
  )}">
      <i class="fas fa-trash-alt"></i>
    </button>`;
  document.getElementById("Delegate-list").appendChild(li);
}

async function removeDelegate(userId, username) {
  const customerId = Utils.URL.getParam("customer_id");
  if (!confirm(`Are you sure you want to remove ${username}?`)) return;

  try {
    await Api.postForm("/customers/deassign", {
      customer_id: customerId,
      target_user_id: userId,
    });
    const li = document.querySelector(`#Delegate-list li[data-user-id="${userId}"]`);
    if (li) li.remove();
  } catch (err) {
    console.error("Failed to remove Delegate", err);
    alert(err.data?.message || "Error occurred while removing Delegate.");
  }
}

function editAddress(addressId, oldValue) {
  currentEditAddressId = addressId;
  document.getElementById("address-input").value = oldValue;
  document.getElementById("address-modal").style.display = "flex";
  resetMarker();
  setTimeout(() => addressMap?.invalidateSize(), 200);
}

async function deleteAddress(addressId) {
  if (!confirm("Are you sure you want to delete this address?")) return;
  try {
    await Api.del(`/customers/address/delete/${addressId}`);
    const el = document.querySelector(`[data-address-id="${addressId}"]`);
    if (el) el.remove();
  } catch (err) {
    alert(err.data?.message || "Failed to delete address.");
  }
}

function viewOrder(orderId) {
  window.location.href = `view-order.html?order_id=${orderId}`;
}

function wireOrderViewDelegation() {
  document.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const action = t.dataset.action;
    const id = t.dataset.id;
    if (action === "view-order") viewOrder(id);
    else if (action === "remove-delegate") removeDelegate(id, t.dataset.name);
    else if (action === "edit-address") editAddress(id, t.dataset.value);
    else if (action === "delete-address") deleteAddress(id);
  });
}

window.viewOrder = viewOrder;
window.removeDelegate = removeDelegate;
window.editAddress = editAddress;
window.deleteAddress = deleteAddress;
