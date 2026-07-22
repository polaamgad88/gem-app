document.addEventListener("DOMContentLoaded", async function () {
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  try {
    const username = localStorage.getItem("username");
    const admin = localStorage.getItem("is_admin");
    const role = localStorage.getItem("user_role");

    if (!username) throw new Error("Username not found");

    const usernameElement = document.getElementById("username");
    if (usernameElement) {
      usernameElement.textContent = username;
    }

    await verifyToken(token);
    setupAdminButtons(localStorage.getItem("is_admin"), localStorage.getItem("user_role"));
  } catch (err) {
    console.error("Dashboard initialization error:", err);
    window.location.href = "login.html";
  }

  setupLogoutButton();
});
function setupAdminButtons(admin, role) {
  const isAdmin = admin == 1;
  const show = (el) => {
    if (el) el.style.display = "block";
  };

  if (isAdmin || role !== "Delegate") {
    show(document.querySelector(".manage-user"));
  }
  if (isAdmin) {
    show(document.querySelector(".manage-products"));
    showNavLink(document.getElementById("products_page"));
  }

  setupFleetNav(isAdmin);
}

// Nav links are flex rows. Showing one with display:block would drop the icon
// gap and break the alignment of the whole list.
function showNavLink(el) {
  if (el) el.style.display = "flex";
}

function setupFleetNav(isAdmin) {
  const isDriver = localStorage.getItem("driver") === "1";
  const isDriverManager = localStorage.getItem("driver_manager") === "1";
  const isStorageManager = localStorage.getItem("storage_manager") === "1";

  const deliverLink = document.getElementById("deliver_page");
  const carsLink = document.getElementById("cars_page");
  const deliveriesLink = document.getElementById("deliveries_page");

  if (isDriver || isAdmin) showNavLink(deliverLink);
  if (isDriverManager || isAdmin) showNavLink(carsLink);
  if (isDriver || isDriverManager || isStorageManager || isAdmin) {
    showNavLink(deliveriesLink);
  }

  if (isDriver && !isDriverManager && !isAdmin) {
    const allowed = new Set(["deliver.html", "deliveries.html"]);
    document.querySelectorAll("#nav a").forEach((link) => {
      if (allowed.has(link.dataset.page)) showNavLink(link);
      else link.style.display = "none";
    });

    const frame = document.getElementById("main-frame");
    const params = new URLSearchParams(location.search);
    if (frame && !params.get("page")) {
      frame.src = "./deliver.html";
      const title = document.getElementById("page-title");
      if (title) title.textContent = "Deliver Order";
    }
  }

  syncNavGroups();
}

// Hide a section header once every link under it is hidden.
function syncNavGroups() {
  let first = true;
  document.querySelectorAll("#nav .nav-group").forEach((group) => {
    const visible = Array.from(group.querySelectorAll("a")).some(
      (link) => link.style.display !== "none"
    );
    group.style.display = visible ? "flex" : "none";
    group.classList.toggle("nav-group--first", visible && first);
    if (visible) first = false;
  });
}

async function verifyToken(token) {
  const data = await Utils.Api.get("/checklogin", { retries: 0, timeout: 10000 });

  localStorage.setItem("is_admin", data.admin ? "1" : "0");
  localStorage.setItem("user_role", data.role ?? "");
  localStorage.setItem("driver", data.driver ? "1" : "0");
  localStorage.setItem("driver_manager", data.driver_manager ? "1" : "0");
  localStorage.setItem("storage", data.storage ? "1" : "0");
  localStorage.setItem("storage_manager", data.storage_manager ? "1" : "0");
  if (data.region) localStorage.setItem("region", String(data.region).toLowerCase());
}

function setupLogoutButton() {
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await Utils.Auth.logout();
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        localStorage.clear();
        window.location.href = "login.html";
      }
    });
  }
}
