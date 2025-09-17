// Get DOM elements
const customerSearchInput = document.getElementById("customer-search");
const customerSuggestions = document.getElementById("customer-suggestions");
const checkInButton = document.getElementById("checkInBtn");
const statusDropdown = document.getElementById("status-dropdown");
const noteInput = document.getElementById("note");
const customerAddressInput = document.getElementById("customer-address");

// Map setup
const map = L.map("map").setView([30.044015, 31.331689], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);
let marker;

// Helper function to fetch customers
async function fetchCustomers(query = "") {
  const token = localStorage.getItem("access_token"); // JWT Token for Authorization
  const response = await fetch(
    `http://localhost:5000/customers?all=true&search=${query}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  const data = await response.json();
  return data.customers || [];
}

// Populate customer list on page load
document.addEventListener("DOMContentLoaded", async () => {
  const customers = await fetchCustomers(); // Fetch all customers if no query
  populateCustomerList(customers);
});

// Handle customer search input
customerSearchInput.addEventListener("input", async (e) => {
  const query = e.target.value;
  const customers = await fetchCustomers(query);
  populateCustomerList(customers);
});

// Populate customer suggestions
function populateCustomerList(customers) {
  customerSuggestions.innerHTML = customers
    .map(
      (customer) =>
        `<li data-customer-id="${customer.customer_id}">${customer.first_name} ${customer.last_name}</li>`
    )
    .join("");
  customerSuggestions.style.display = customers.length ? "block" : "none";
}

// Select customer from dropdown and update input field with customer name
customerSuggestions.addEventListener("click", (e) => {
  if (e.target.tagName === "LI") {
    const customerId = e.target.getAttribute("data-customer-id"); // Get customer ID
    fillCustomerAddress(customerId);

    // Set customer name in the search input (not the customer ID)
    customerSearchInput.value = e.target.textContent; // Set name as the visible text
    customerSearchInput.setAttribute("data-customer-id", customerId); // Store the ID in a custom attribute

    customerSuggestions.style.display = "none";
  }
});

// Fetch customer address for selected customer
async function fillCustomerAddress(customerId) {
  const token = localStorage.getItem("access_token");
  const response = await fetch(
    `http://localhost:5000/customers/${customerId}/addresses`, // Get customer addresses
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const data = await response.json();

  // Populate the address dropdown with the fetched addresses
  const addresses = data.addresses || [];
  const addressDropdown = document.getElementById("customer-address");
  addressDropdown.innerHTML = ""; // Clear existing options

  if (addresses.length === 0) {
    addressDropdown.innerHTML =
      "<option value=''>No address available</option>";
    addressDropdown.disabled = true;
  } else {
    addressDropdown.innerHTML =
      "<option value=''>Select Customer Address</option>";
    addresses.forEach((address) => {
      const option = document.createElement("option");
      option.value = address.address_id; // Set the value to address_id
      option.textContent = address.address;
      addressDropdown.appendChild(option);
    });
    addressDropdown.disabled = false;
  }

  // Automatically select the first address if there's only one
  if (addresses.length === 1) {
    addressDropdown.value = addresses[0].address_id; // Select address by ID
  }
}

// Handle the address selection change (in case user selects a different address)
document.getElementById("customer-address").addEventListener("change", (e) => {
  const selectedAddressId = e.target.value;
  console.log("Selected Address ID:", selectedAddressId);
});

document.getElementById("customer-address").addEventListener("change", (e) => {
  const selectedAddress = e.target.value;
  console.log("Selected Address:", selectedAddress);
});

// Handle Check In button click
checkInButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation not supported");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      if (!marker) {
        marker = L.marker([latitude, longitude]).addTo(map);
      }
      marker.setLatLng([latitude, longitude]);
      map.setView([latitude, longitude], 17);

      // Use the customer ID stored in the input field's custom attribute
      const customerId = customerSearchInput.getAttribute("data-customer-id"); // Get customer ID
      const addressId = document.getElementById("customer-address").value; // Get address ID
      const status = statusDropdown.value;
      const note = noteInput.value;

      if (!customerId || !addressId || !status) {
        alert("Customer ID, address, and status are required.");
        return;
      }

      // Call the backend to log the visit
      const token = localStorage.getItem("access_token");
      const response = await fetch("http://localhost:5000/visits/checkin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customerId, // Send customer ID
          customer_address_id: addressId, // Send address ID
          reason: status,
          note,
          actual_latitude: latitude,
          actual_longitude: longitude,
        }),
      });

      const data = await response.json();
      alert(
        data.message +
          "\n" +
          (data.within_200m
            ? "Within 200m of address."
            : "Not within 200m of address.") +
          "\nDistance: " +
          (data.distance_m || "N/A") +
          " meters"
      );
    },
    (error) => {
      alert("Error getting location: " + error.message);
    },
    { enableHighAccuracy: true }
  );
});
