document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  setupUIElements();
  setupFormSubmission();
  setupPasswordToggle();
});

function setupThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");
  if (!themeToggle) return;

  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "☀️";
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    themeToggle.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

function setupUIElements() {
  const form = document.querySelector("form");
  if (!form) return;

  if (!document.getElementById("loader")) {
    const loader = document.createElement("div");
    loader.id = "loader";
    loader.style.display = "none";
    loader.innerHTML = `<div class="loader-spinner"></div><span>Logging in...</span>`;
    form.appendChild(loader);
  }

  if (!document.getElementById("error-message")) {
    const errorDiv = document.createElement("div");
    errorDiv.id = "error-message";
    errorDiv.className = "error-message";
    errorDiv.style.display = "none";
    form.appendChild(errorDiv);
  }
}

function setupFormSubmission() {
  const form = document.querySelector("form");
  if (!form) return;
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[type="password"]');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    Utils.UI.hideError();
    if (!validateInputs(usernameInput, passwordInput)) return;

    if (submitBtn) submitBtn.disabled = true;
    Utils.UI.showLoader();

    try {
      await performLogin(usernameInput.value.trim(), passwordInput.value);
    } catch (err) {
      console.error("Login error:", err);
      const msg =
        err?.status === 401 || err?.status === 400
          ? "Invalid username or password. Please try again."
          : "Login failed. Please check your connection.";
      Utils.UI.showError(msg);
    } finally {
      Utils.UI.hideLoader();
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function validateInputs(usernameInput, passwordInput) {
  if (!usernameInput?.value.trim()) {
    Utils.UI.showError("Username is required");
    usernameInput?.focus();
    return false;
  }
  if (!passwordInput?.value) {
    Utils.UI.showError("Password is required");
    passwordInput?.focus();
    return false;
  }
  return true;
}

async function performLogin(username, password) {
  // Backend `/api/login` accepts form-encoded body (URLSearchParams).
  const res = await fetch(`${Utils.API_BASE}/login`, {
    method: "POST",
    body: new URLSearchParams({ username, password }),
  });

  if (!res.ok) {
    const err = new Error("Login failed");
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("user_role", data.role ?? "");
  localStorage.setItem("username", data.username ?? "");
  localStorage.setItem("user_id", data.user_id ?? "");
  localStorage.setItem("is_admin", data.admin ?? "");
  localStorage.setItem("region", (data.region ?? "cairo").toLowerCase());
  window.location.href = "index.html";
}

function setupPasswordToggle() {
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");
  if (!passwordInput || !togglePassword) return;

  const toggle = () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.classList.toggle("fa-eye");
    togglePassword.classList.toggle("fa-eye-slash");
  };

  togglePassword.addEventListener("click", toggle);
  togglePassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle();
    }
  });
}
