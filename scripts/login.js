document.addEventListener("DOMContentLoaded", function () {
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");

  // Dark-mode toggle (optional)
  themeToggle?.addEventListener("click", function () {
    document.body.classList.toggle("dark-mode");
    themeIcon.textContent = document.body.classList.contains("dark-mode")
      ? "☀️"
      : "🌙";
  });

  // Grab the form, username, and password fields
  const form = document.querySelector("form");
  const usernameInput = form.querySelector('input[type="text"]');
  const passwordInput = form.querySelector('input[type="password"]');

  // Create a loader and error container
  const loader = document.createElement("div");
  loader.id = "loader";
  loader.style.display = "none";
  loader.innerText = "Logging in...";
  loader.style.marginTop = "10px";
  form.appendChild(loader);

  const errorDiv = document.createElement("div");
  errorDiv.id = "error-message";
  errorDiv.style.color = "red";
  errorDiv.style.marginTop = "10px";
  errorDiv.style.display = "none";
  form.appendChild(errorDiv);

  // Handle form submission
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // Show loader, hide errors
    loader.style.display = "block";
    errorDiv.style.display = "none";

    // Read user input
    const username = usernameInput.value;
    const password = passwordInput.value;

    try {
      // Make the request to the Flask backend
      const response = await fetch("http://localhost:5000/login", {
        method: "POST",
        body: new URLSearchParams({
          username: username,
          password: password,
        }),
      });
      loader.style.display = "none";

      if (response.ok) {
        const data = await response.json();

        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("user_role", data.role);
        localStorage.setItem("username", data.username);
        localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("is_admin", data.admin);

        window.location.href = "delegate-landing.html";
      } else {
        errorDiv.innerText = "Invalid username or password. Please try again.";
        errorDiv.style.display = "block";
      }
    } catch (err) {
      loader.style.display = "none";
      errorDiv.innerText = "Login failed. Please check your connection.";
      errorDiv.style.display = "block";
    }
  });
});
