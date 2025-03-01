document.addEventListener("DOMContentLoaded", function() {
    // Set today's date
    document.getElementById("order-date").valueAsDate = new Date();

    // Toggle section visibility
    window.toggleSection = function(id) {
        const section = document.getElementById(id);
        section.style.display = section.style.display === "block" ? "none" : "block";
    };
});

// Sample Product Data with Availability
const productData = {
    brand1: [
        { name: "Product A", status: "available" },
        { name: "Product B", status: "limited" },
        { name: "Product C", status: "out-of-stock" }
    ],
    brand2: [
        { name: "Product X", status: "available" },
        { name: "Product Y", status: "limited" }
    ]
};

// Function to Filter Products by Brand
function filterProducts(selectElement) {
    const brand = selectElement.value;
    const productSelect = selectElement.parentElement.querySelector(".product-select");
    const indicator = selectElement.parentElement.querySelector(".availability-indicator");

    productSelect.innerHTML = '<option value="">Select Product</option>';
    
    if (brand in productData) {
        productData[brand].forEach(product => {
            const option = document.createElement("option");
            option.value = product.name;
            option.textContent = product.name;
            option.dataset.status = product.status;
            productSelect.appendChild(option);
        });
    }

    productSelect.onchange = function () {
        const selectedStatus = this.options[this.selectedIndex].dataset.status;
        setIndicatorColor(indicator, selectedStatus);
    };
}

// Function to Set Indicator Color
function setIndicatorColor(indicator, status) {
    const colors = {
        available: "green",
        limited: "yellow",
        "out-of-stock": "red"
    };
    indicator.style.backgroundColor = colors[status] || "transparent";
}

// Function to Add New Order Row
function addOrderRow() {
    const newRow = document.createElement("div");
    newRow.classList.add("order-row");
    newRow.innerHTML = `
       <!-- Brand Dropdown -->
        <select class="brand-select" onchange="filterProducts(this)">
            <option value="">Select Brand</option>
            <option value="brand1">Brand 1</option>
            <option value="brand2">Brand 2</option>
        </select>
    
        <div class="custom-dropdown">
            <select class="product-select" >
                <option value="">Select Product</option>
                <option value="product1" data-status="green"> Product 1</option>
                <option value="product2" data-status="yellow"> Product 2</option>
                <option value="product3" data-status="red"> Product 3 </option>
            </select>
        </div>
    
     

        <div class="quantity-wrapper">
            <!-- <button class="quantity-btn" onclick="changeQuantity(this, -1)">-</button> -->
            <input type="number" class="quantity-input" value="1" min="1">
            <!-- <button class="quantity-btn" onclick="changeQuantity(this, 1)">+</button> -->
        </div>
    
        <i class="material-icons" onclick="deleteRow(this)" class="" style="font-size:33px;color:red">cancel</i>

    `;

    document.getElementById("order-rows").appendChild(newRow);
}



function addOrderRowCombined() {
    const newRow = document.createElement("div");
    newRow.classList.add("order-row");
    newRow.innerHTML = `
       <!-- Brand Dropdown -->
        <select class="brand-select" onchange="filterProducts(this)">
            <option value="">Select Brand</option>
            <option value="brand1">Zerofrizz</option>
            <option value="brand2">Ravita</option>
        </select>
    
        <div class="custom-dropdown">
            <select class="product-select" >
                <option value="">Select Category</option>
                <option value="product1" data-status="green"> Shampoo</option>
                <option value="product2" data-status="yellow"> Therum 2</option>
                <option value="product3" data-status="red"> Mask </option>
            </select>
        </div>
    
     

        <div class="quantity-wrapper">
            <!-- <button class="quantity-btn" onclick="changeQuantity(this, -1)">-</button> -->
            <input type="number" class="quantity-input" value="1" min="1">
            <!-- <button class="quantity-btn" onclick="changeQuantity(this, 1)">+</button> -->
        </div>
    
        <i class="material-icons" onclick="deleteRow(this)" class="" style="font-size:33px;color:red">cancel</i>

    `;

    document.getElementById("order-rows").appendChild(newRow);
}

// Toggle tab visibility
function toggleTab(tabId) {
    const content = document.getElementById(tabId);
    const arrow = content.previousElementSibling.querySelector(".arrow");

    if (content.style.display === "none" || content.style.display === "") {
        content.style.display = "block";
        arrow.textContent = "▲"; // Expand
    } else {
        content.style.display = "none";
        arrow.textContent = "▼"; // Collapse
    }
}

function changeQuantity(button, amount) {
    let input = button.parentElement.querySelector(".quantity-input");
    let newValue = parseInt(input.value) + amount;
    
    if (newValue >= 1) { // Prevent going below 1
        input.value = newValue;
    }
}



// Delete Row Function
function deleteRow(button) {
    let row = button.closest(".quantity-wrapper"); // Find closest row container
    row.remove();
}

