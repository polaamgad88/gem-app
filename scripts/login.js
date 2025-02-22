document.addEventListener("DOMContentLoaded", function () {
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = document.getElementById("theme-icon");

    themeToggle.addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");

        // Toggle icon
        themeIcon.textContent = document.body.classList.contains("dark-mode") ? "☀️" : "🌙";
    });
});