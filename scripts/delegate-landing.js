document.addEventListener("DOMContentLoaded", async function () {
  const logoutBtn = document.getElementById("logout-btn");
  const heading = document.querySelector("h1");

  const token = localStorage.getItem("access_token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  try {
    const username = localStorage.getItem("username");
    const admin = localStorage.getItem("is_admin");
    const role = localStorage.getItem("user_role");

    if (!username) throw new Error("username not found");
    if (admin == 1 || role !== "representative") {
      const customersBtn = document.querySelector(".manage-customers");
      if (customersBtn) customersBtn.style.display = "block";
      const manageruserBtn = document.querySelector(".manage-user");
      if (manageruserBtn) manageruserBtn.style.display = "block";
    }
    if (admin == 1) {
      const productsBtn = document.querySelector(".manage-products");
      if (productsBtn) productsBtn.style.display = "block";
    }

    document.querySelector("h1").innerHTML = `Welcome, ${username}!`;
    const response = await fetch("http://localhost:5000/checklogin", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status !== 200) {
      // Token is invalid, revoked, or expired
      window.location.href = "login.html";
      return;
    }
  } catch (err) {
    console.error("Check login error:", err);
    window.location.href = "login.html";
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      const logoutRes = await fetch("http://localhost:5000/logout", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (logoutRes.ok) {
        localStorage.clear();
        window.location.href = "login.html";
      } else {
        alert("Logout failed");
      }
    } catch (err) {
      alert("Logout error");
      console.error(err);
    }
  });
});
