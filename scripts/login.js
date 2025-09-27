document.addEventListener("DOMContentLoaded", function () {
  // Create theme toggle functionality
  setupThemeToggle();

  // Create loader and error container
  setupUIElements();

  // Set up form submission
  setupFormSubmission();
});

// Helper function to set up theme toggle
function setupThemeToggle() {
  const themeToggle = document.getElementById("theme-toggle");

  if (themeToggle) {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.body.classList.add("dark-mode");
      themeToggle.textContent = "☀️";
    }

    // Add event listener for theme toggle
    themeToggle.addEventListener("click", function () {
      document.body.classList.toggle("dark-mode");
      const isDarkMode = document.body.classList.contains("dark-mode");
      themeToggle.textContent = isDarkMode ? "☀️" : "🌙";
      localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    });
  }
}

// Helper function to set up UI elements
function setupUIElements() {
  const form = document.querySelector("form");

  // Create and append loader
  const loader = document.createElement("div");
  loader.id = "loader";
  loader.style.display = "none";
  loader.innerHTML = `
    <div class="loader-spinner"></div>
    <span>Logging in...</span>
  `;
  form.appendChild(loader);

  // Create and append error message container
  const errorDiv = document.createElement("div");
  errorDiv.id = "error-message";
  errorDiv.className = "error-message";
  errorDiv.style.display = "none";
  form.appendChild(errorDiv);
}

// Helper function to set up form submission
function setupFormSubmission() {
  const form = document.querySelector("form");
  const usernameInput = form.querySelector('input[name="username"]');
  const passwordInput = form.querySelector('input[type="password"]');

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Show loader, hide errors
    showLoader();
    hideError();

    // Validate inputs
    if (!validateInputs(usernameInput, passwordInput)) {
      return;
    }

    // Attempt login
    try {
      await performLogin(usernameInput.value, passwordInput.value);
    } catch (err) {
      console.error("Login error:", err);
      showError("Login failed. Please check your connection.");
    }
  });
}

// Helper function to validate inputs
function validateInputs(usernameInput, passwordInput) {
  if (!usernameInput.value.trim()) {
    showError("Username is required");
    usernameInput.focus();
    return false;
  }

  if (!passwordInput.value) {
    showError("Password is required");
    passwordInput.focus();
    return false;
  }

  return true;
}

// Helper function to perform login
async function performLogin(username, password) {
  try {
    // Make the request to the Flask backend
    const response = await fetch("https://order-app.gemegypt.net/api/login", {
      method: "POST",
      body: new URLSearchParams({
        username: username,
        password: password,
      }),
    });

    hideLoader();

    if (response.ok) {
      const data = await response.json();

      // Save user data to localStorage
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("user_role", data.role);
      localStorage.setItem("username", data.username);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("is_admin", data.admin);

      // Redirect to dashboard
      window.location.href = "index.html";
    } else {
      showError("Invalid username or password. Please try again.");
    }
  } catch (err) {
    hideLoader();
    throw err;
  }
}

// Helper function to show loader
function showLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "block";
}

// Helper function to hide loader
function hideLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.style.display = "none";
}

// Helper function to show error
function showError(message) {
  hideLoader();
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = "block";
  }
}

// Helper function to hide error
function hideError() {
  const errorDiv = document.getElementById("error-message");
  if (errorDiv) {
    errorDiv.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    togglePassword.classList.toggle("fa-eye");
    togglePassword.classList.toggle("fa-eye-slash");
  });
});
