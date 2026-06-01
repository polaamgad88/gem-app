document.addEventListener("DOMContentLoaded", () => {
  const iframe = document.getElementById("main-frame");
  const navLinks = document.querySelectorAll(".nav-links a");
  const sidebar = document.querySelector(".sidebar");
  const menuBtn = document.getElementById("menu-btn");
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
      if (window.innerWidth <= 768) {
        sidebar.classList.remove("active");
        const bd = document.getElementById("sidebar-backdrop");
        if (bd) bd.classList.remove("show");
        document.body.style.overflow = "";
      }
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

  const backdrop = document.getElementById("sidebar-backdrop");

  function syncBackdrop() {
    if (!backdrop) return;
    const open = window.innerWidth <= 768 && sidebar.classList.contains("active");
    backdrop.classList.toggle("show", open);
    document.body.style.overflow = open ? "hidden" : "";
  }

  function openSidebarMobile() {
    sidebar.classList.add("active");
    syncBackdrop();
  }

  function closeSidebarMobile() {
    sidebar.classList.remove("active");
    syncBackdrop();
  }

  menuBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      if (sidebar.classList.contains("active")) closeSidebarMobile();
      else openSidebarMobile();
    } else {
      sidebar.classList.toggle("collapsed");
    }
  });

  // Keyboard activation for menu icon
  menuBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      menuBtn.click();
    }
  });

  // Close on backdrop tap
  if (backdrop) {
    backdrop.addEventListener("click", closeSidebarMobile);
  }

  // ESC closes drawer on mobile
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && window.innerWidth <= 768 && sidebar.classList.contains("active")) {
      closeSidebarMobile();
    }
  });

  // Reset state on resize across breakpoint (throttled to ~150ms)
  const onResize = Utils.Async.throttle(() => {
    if (window.innerWidth > 768) {
      sidebar.classList.remove("active");
      if (backdrop) backdrop.classList.remove("show");
      document.body.style.overflow = "";
    }
  }, 150);
  window.addEventListener("resize", onResize);

  // ─── Logout ───────────────────────────────────────────────────────────────

  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      await Utils.Auth.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      window.location.href = "login.html";
    }
  });
});
