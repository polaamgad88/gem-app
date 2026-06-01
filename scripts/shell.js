document.addEventListener("DOMContentLoaded", () => {
  const frame     = document.getElementById("main-frame");
  const drawer    = document.getElementById("drawer");
  const overlay   = document.getElementById("overlay");
  const hamburger = document.getElementById("hamburger");
  const themeBtn  = document.getElementById("theme-toggle");
  const logoutBtn = document.getElementById("logout-btn");
  const titleEl   = document.getElementById("page-title");
  const links     = document.querySelectorAll("#nav a");

  // ── Theme ──────────────────────────────────────────
  function setTheme(mode) {
    document.body.classList.toggle("dark-mode", mode === "dark");
    themeBtn.textContent = mode === "dark" ? "☀️ Light" : "🌙 Dark";
    localStorage.setItem("theme", mode);
    try { frame.contentWindow.postMessage({ theme: mode }, "*"); } catch {}
  }

  setTheme(localStorage.getItem("theme") || "light");

  themeBtn.addEventListener("click", () => {
    setTheme(document.body.classList.contains("dark-mode") ? "light" : "dark");
  });

  frame.addEventListener("load", () => {
    try {
      frame.contentWindow.postMessage(
        { theme: localStorage.getItem("theme") || "light" },
        "*"
      );
    } catch {}
  });

  // ── Navigation ─────────────────────────────────────
  function highlight(page) {
    const target = page.split("/").pop().split("?")[0];
    links.forEach((a) => {
      a.classList.toggle("active",
        !a.classList.contains("nav-cta") && a.dataset.page === target
      );
    });
  }

  function go(href) {
    const match = [...links].find(
      (a) => a.dataset.page === href.split("/").pop().split("?")[0]
    );
    titleEl.textContent = match ? match.querySelector("span").textContent : "Dashboard";
    frame.src = href;
    highlight(href);
    const slug = href.split("/").pop().split("?")[0];
    history.replaceState(null, "", "?page=" + encodeURIComponent(slug));
  }

  links.forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      go(a.getAttribute("href"));
      closeDrawer();
    });
  });

  const params = new URLSearchParams(location.search);
  const req = params.get("page");
  if (req) go(req);
  else highlight("dashboard.html");

  // ── Drawer toggle ──────────────────────────────────
  function openDrawer() {
    drawer.classList.add("open");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  hamburger.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      drawer.classList.contains("open") ? closeDrawer() : openDrawer();
    } else {
      drawer.classList.toggle("collapsed");
    }
  });

  overlay.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  window.addEventListener("resize", Utils.Async.throttle(() => {
    if (window.innerWidth > 768) closeDrawer();
  }, 150));

  // ── Logout ─────────────────────────────────────────
  logoutBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    try { await Utils.Auth.logout(); } catch {}
    window.location.href = "login.html";
  });
});
