// Get DOM elements
const customerSearchInput = document.getElementById("customer-search");
const customerSuggestions = document.getElementById("customer-suggestions");
const checkInButton = document.getElementById("checkInBtn");
const noteInput = document.getElementById("note");
const customerAddressInput = document.getElementById("customer-address");
const billAmountInput = document.getElementById("bill-amount");
const statusDropdown = document.getElementById("status-dropdown");
const billDiv = document.getElementById("billDiv");
const locationStatusEl = document.getElementById("locationStatus");

// ------------------------------
// Map setup
// ------------------------------
const map = L.map("map").setView([30.044015, 31.331689], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let marker;

// ------------------------------
// Bill amount toggle
// ------------------------------
function toggleBillAmountVisibility(status) {
  if (!billDiv) return;
  billDiv.style.display = status === "bill_collection" ? "block" : "none";
}

statusDropdown.addEventListener("change", function () {
  toggleBillAmountVisibility(this.value);
});

// ------------------------------
// Location auto-refresh (every 10 seconds)
// ------------------------------
let lastKnownLocation = null; // { latitude, longitude, timestamp }
let locationIntervalId = null;

function setLocationStatus(text) {
  if (locationStatusEl) locationStatusEl.textContent = text;
}

function updateMarker(lat, lng) {
  if (!marker) marker = L.marker([lat, lng]).addTo(map);
  marker.setLatLng([lat, lng]);
}

function formatLocationText(loc) {
  const ageSec = Math.floor((Date.now() - loc.timestamp) / 1000);
  return `Location: ${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(
    6,
  )} (updated ${ageSec}s ago)`;
}

function requestLocationOnce() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // force a fresh fix each time
      },
    );
  });
}

async function refreshLocation() {
  try {
    setLocationStatus("Location: getting current position...");
    const position = await requestLocationOnce();
    const { latitude, longitude } = position.coords;

    lastKnownLocation = { latitude, longitude, timestamp: Date.now() };

    updateMarker(latitude, longitude);
    map.setView([latitude, longitude], 17);

    setLocationStatus(formatLocationText(lastKnownLocation));
    return lastKnownLocation;
  } catch (err) {
    console.error("Location error:", err);
    setLocationStatus("Location: failed (check GPS/permission)");
    return null;
  }
}

function startLocationAutoRefresh() {
  // first refresh triggers permission prompt
  refreshLocation();

  if (locationIntervalId) clearInterval(locationIntervalId);
  locationIntervalId = setInterval(() => {
    refreshLocation();
  }, 10000);
}

function isLocationFresh(maxAgeMs = 15000) {
  if (!lastKnownLocation) return false;
  return Date.now() - lastKnownLocation.timestamp <= maxAgeMs;
}

// ------------------------------
// Customers
// ------------------------------
async function fetchCustomers(query = "") {
  const token = localStorage.getItem("access_token");
  const response = await fetch(
    `https://order-app.gemegypt.net/api/customers?all=true&search=${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const data = await response.json();
  return data.customers || [];
}

document.addEventListener("DOMContentLoaded", async () => {
  startLocationAutoRefresh();

  const customers = await fetchCustomers();
  populateCustomerList(customers);

  toggleBillAmountVisibility(statusDropdown.value);
});

customerSearchInput.addEventListener("input", async (e) => {
  const query = e.target.value;
  const customers = await fetchCustomers(query);
  populateCustomerList(customers);
});

function populateCustomerList(customers) {
  customerSuggestions.innerHTML = customers
    .map(
      (customer) =>
        `<li data-customer-id="${customer.customer_id}">${customer.first_name} ${customer.last_name}</li>`,
    )
    .join("");
  customerSuggestions.style.display = customers.length ? "block" : "none";
}

customerSuggestions.addEventListener("click", (e) => {
  if (e.target.tagName === "LI") {
    const customerId = e.target.getAttribute("data-customer-id");
    fillCustomerAddress(customerId);

    customerSearchInput.value = e.target.textContent;
    customerSearchInput.setAttribute("data-customer-id", customerId);

    customerSuggestions.style.display = "none";
  }
});

async function fillCustomerAddress(customerId) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(
    `https://order-app.gemegypt.net/api/customers/${customerId}/addresses`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  const data = await response.json();

  const addresses = data.addresses || [];
  customerAddressInput.innerHTML = "";

  if (addresses.length === 0) {
    customerAddressInput.innerHTML =
      "<option value=''>No address available</option>";
    customerAddressInput.disabled = true;
  } else {
    customerAddressInput.innerHTML =
      "<option value=''>Select Customer Address</option>";
    addresses.forEach((address) => {
      const option = document.createElement("option");
      option.value = address.address_id;
      option.textContent = address.address;
      customerAddressInput.appendChild(option);
    });
    customerAddressInput.disabled = false;
  }

  if (addresses.length === 1) {
    customerAddressInput.value = addresses[0].address_id;
  }
}

function validateInputs() {
  const customerId = customerSearchInput.getAttribute("data-customer-id");
  const addressId = customerAddressInput.value;
  const status = statusDropdown.value;
  const note = noteInput.value;

  if (!customerId || !addressId || !status) {
    alert("Customer, address, and status are required.");
    return null;
  }

  let amount;
  if (status === "bill_collection") {
    const raw = billAmountInput?.value?.trim();
    if (!raw) {
      alert("Bill amount is required for Bill Collection.");
      return null;
    }
    amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      alert("Bill amount must be a valid non-negative number.");
      return null;
    }
  }

  return { customerId, addressId, status, note, amount };
}

checkInButton.addEventListener("click", async () => {
  const validated = validateInputs();
  if (!validated) return;

  // ensure we have a fresh location right before sending
  if (!isLocationFresh(15000)) {
    await refreshLocation();
  }

  if (!isLocationFresh(15000)) {
    alert(
      "Could not get a fresh GPS location. Please enable GPS and try again.",
    );
    return;
  }

  const token = localStorage.getItem("access_token");

  const payload = {
    customer_id: validated.customerId,
    customer_address_id: validated.addressId,
    reason: validated.status,
    note: validated.note,
    actual_latitude: lastKnownLocation.latitude,
    actual_longitude: lastKnownLocation.longitude,
    ...(validated.status === "bill_collection"
      ? { amount: validated.amount }
      : {}),
  };

  try {
    checkInButton.disabled = true;

    const response = await fetch(
      "https://order-app.gemegypt.net/api/visits/checkin",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    const data = await response.json();
    alert(data.message || "Done");
  } catch (err) {
    console.error(err);
    alert("Failed to check in. Please try again.");
  } finally {
    checkInButton.disabled = false;
  }
});
