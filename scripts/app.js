document.querySelectorAll(".nav-links a").forEach(link => {
  link.addEventListener("click", function(e) {
    e.preventDefault();

    const url = this.getAttribute("href"); 
    const title = this.innerText;

    document.getElementById("page-title").textContent = title;
    document.getElementById("main-frame").src = url; 
  });
});

document.querySelector(".btn-theme").addEventListener("click", () => {
  document.querySelector(".theme-dropdown").classList.toggle("show");
});


function toggleTheme(mode) {
  if (mode === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }

  localStorage.setItem("theme", mode);

  const iframe = document.getElementById("main-frame");
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage({ theme: mode }, "*");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light"; // default light
  toggleTheme(savedTheme);
});

