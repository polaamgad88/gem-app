document.addEventListener("DOMContentLoaded", () => {
  const iframe = document.getElementById("main-frame");
  const navLinks = document.querySelectorAll(".nav-links a");
  const sidebar = document.querySelector(".sidebar");
  const menuBtn = document.querySelector(".topbar-title i.fa-bars");
  const toggleBtn = document.getElementById("theme-toggle");
  const logoutBtn = document.getElementById("logout-btn");

  // ─── Theme ────────────────────────────────────────────────────────────────

  function applyTheme(mode) {
    document.body.classList.toggle("dark-mode", mode === "dark");
    toggleBtn.textContent = mode === "dark" ? "☀️ Light" : "🌙 Dark";
    localStorage.setItem("theme", mode);
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ theme: mode }, "*");
    }
  }

  // Apply saved theme on load
  applyTheme(localStorage.getItem("theme") || "light");

  toggleBtn.addEventListener("click", () => {
    const next = document.body.classList.contains("dark-mode")
      ? "light"
      : "dark";
    applyTheme(next);
  });

  // Also push theme into iframe after it finishes loading (covers page changes)
  iframe.addEventListener("load", () => {
    const saved = localStorage.getItem("theme") || "light";
    iframe.contentWindow.postMessage({ theme: saved }, "*");
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  function setActivePage(href) {
    navLinks.forEach((link) => {
      const linkPage = link.getAttribute("href").split("/").pop();
      const targetPage = href.split("/").pop().split("?")[0];
      link.classList.toggle("active", linkPage === targetPage);
    });
  }

  function navigateTo(href) {
    const activeLink = [...navLinks].find(
      (l) => l.getAttribute("href").split("/").pop() === href.split("/").pop(),
    );
    const title = activeLink
      ? activeLink.innerText.trim()
      : "Company Dashboard";

    document.getElementById("page-title").textContent = title;
    iframe.src = href;
    setActivePage(href);

    // Keep URL in address bar in sync (no page reload)
    const page = href.split("/").pop().split("?")[0];
    history.replaceState(null, "", "?page=" + encodeURIComponent(page));
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(link.getAttribute("href"));
      if (window.innerWidth <= 768) sidebar.classList.remove("active");
    });
  });

  // ─── Handle direct URL access via ?page= param ────────────────────────────
  //
  //  When someone opens orders.html directly, that page redirects them to
  //  index.html?page=orders.html — we pick that up here and load the right page.

  const params = new URLSearchParams(window.location.search);
  const requestedPage = params.get("page");

  if (requestedPage) {
    navigateTo(requestedPage);
  } else {
    // Default: highlight Overview / dashboard
    setActivePage("dashboard.html");
  }

  // ─── Sidebar toggle ───────────────────────────────────────────────────────

  menuBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle("active");
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });

  // Close sidebar on mobile when clicking outside
  document.addEventListener("click", (e) => {
    if (
      window.innerWidth <= 768 &&
      sidebar.classList.contains("active") &&
      !sidebar.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      sidebar.classList.remove("active");
    }
  });

  // ─── Logout ───────────────────────────────────────────────────────────────

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        window.location.href = "login.html";
        return;
      }

      const res = await fetch("https://order-app.gemegypt.net/api/logout", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        localStorage.clear();
        window.location.href = "login.html";
      } else {
        alert("Logout failed. Please try again.");
      }
    } catch {
      alert("Network error during logout.");
    }
  });
});
