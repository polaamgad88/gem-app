document.addEventListener("DOMContentLoaded", async function () {
  // Check authentication
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  try {
    // Get user information
    const username = localStorage.getItem("username");
    const admin = localStorage.getItem("is_admin");
    const role = localStorage.getItem("user_role");

    if (!username) throw new Error("Username not found");

    // Display username
    const usernameElement = document.getElementById("username");
    if (usernameElement) {
      usernameElement.textContent = username;
    }

    // Show admin buttons if applicable
    setupAdminButtons(admin, role);

    // Verify token is still valid
    await verifyToken(token);
  } catch (err) {
    console.error("Dashboard initialization error:", err);
    window.location.href = "login.html";
  }

  // Set up logout button
  setupLogoutButton();
});

// Helper function to set up admin buttons
function setupAdminButtons(admin, role) {
  if (admin == 1 || role !== "delegate") {
    const manageUserBtn = document.querySelector(".manage-user");
    if (manageUserBtn) manageUserBtn.style.display = "block";
  }

  if (admin == 1) {
    const productsBtn = document.querySelector(".manage-products");
    if (productsBtn) productsBtn.style.display = "block";
  }
}

// Helper function to verify token
async function verifyToken(token) {
  const response = await fetch("https://order-app.gemegypt.net/api/checklogin", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status !== 200) {
    // Token is invalid, revoked, or expired
    throw new Error("Invalid token");
  }
}

// Helper function to set up logout button
function setupLogoutButton() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        const token = localStorage.getItem("access_token");
        if (!token) {
          window.location.href = "login.html";
          return;
        }

        const logoutRes = await fetch("https://order-app.gemegypt.net/api/logout", {
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
  }
}
