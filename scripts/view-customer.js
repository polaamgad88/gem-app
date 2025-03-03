document.addEventListener("DOMContentLoaded", function () {
    updateTotalIncome();
});

// 🚀 Remove Delegate
function removeDelegate(delegateName) {
    if (confirm(`Are you sure you want to remove ${delegateName}?`)) {
        let delegates = [...document.getElementById("delegate-list").children];
        delegates.forEach((item) => {
            if (item.textContent.includes(delegateName)) {
                item.remove();
            }
        });
    }
}

// 🚀 Show Add Delegate Modal
document.getElementById("add-delegate-btn").addEventListener("click", () => {
    document.getElementById("delegate-modal").style.display = "block";
});

// 🚀 Save Delegate
document.getElementById("save-delegate-btn").addEventListener("click", function () {
    const delegateName = document.getElementById("delegate-dropdown").value;
    const newDelegate = document.createElement("li");
    newDelegate.innerHTML = `${delegateName} <button class="remove-btn" onclick="removeDelegate('${delegateName}')"><i class="fas fa-trash-alt"></i></button>`;
    document.getElementById("delegate-list").appendChild(newDelegate);
    document.getElementById("delegate-modal").style.display = "none";
});

// 🚀 Update Total Income
function updateTotalIncome() {
    let total = 0;
    document.querySelectorAll(".price").forEach(price => {
        total += parseFloat(price.textContent.replace("EGP", ""));
    });
    document.getElementById("total-income").textContent = `EGP${total}`;
}

