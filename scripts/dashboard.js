let chart; 
let currentType = "line";

async function loadData(type = "amount") {
  try {
    let url =
      type === "amount"
        ? "http://localhost:5000/users/ranking?total_amount=true"
        : "http://localhost:5000/users/ranking?total_number=true";

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("access_token"),
      },
    });

    const data = await res.json();
    console.log("Data from API:", data);

    const users = data.ranking || [];

    const tbody = document.getElementById("delegatesTable");
    tbody.innerHTML = "";
    users.forEach((user) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${user.name}</td>
        <td>${user.total_orders_amount || "-"}</td>
         <td>${user.total_orders_all || "-"}</td>
      `;
      tbody.appendChild(tr);
    });

    const labels = users.map((u) => u.name);
    const dataset =
      type === "amount"
        ? users.map((u) => u.total_orders_amount)
        : users.map((u) => u.total_orders_all);

    if (!chart) {
      const ctx = document.getElementById("delegatesChart").getContext("2d");
      chart = new Chart(ctx, {
        type: currentType, 
        data: {
          labels: labels,
          datasets: [
            {
              label: "Sales",
              data: dataset,
              borderColor: "#0b2a59",
              backgroundColor:
                currentType === "bar"
                  ? "rgba(0,123,255,0.4)"
                  : "rgba(0,123,255,0.1)",
              borderWidth: 2,
              tension: 0.4,
              fill: currentType === "line",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
        },
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = dataset;
      chart.update();
    }
  } catch (err) {
    console.error("Error fetching data:", err);
  }
}

function changeChartType(type) {
  currentType = type;
  if (chart) {
    chart.destroy(); 
    chart = null;
    loadData("amount"); 
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadData("amount");

  document.getElementById("dataType").addEventListener("change", (e) => {
    if (e.target.value === "sales") {
      loadData("amount");
    } else {
      loadData("orders");
    }
  });

  document
    .getElementById("chartLine")
    .addEventListener("click", () => changeChartType("line"));
  document
    .getElementById("chartBar")
    .addEventListener("click", () => changeChartType("bar"));
});
