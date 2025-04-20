document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-customer-form");
  const successMsg = document.getElementById("success-message");
  const errorMsg = document.getElementById("error-message");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    successMsg.style.display = "none";
    errorMsg.style.display = "none";

    const token = localStorage.getItem("access_token");
    if (!token) return alert("You are not logged in.");

    const formData = new FormData(form);
    const payload = new URLSearchParams(formData);

    try {
      const res = await fetch("http://localhost:5000/customers/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      });

      const data = await res.json();
      if (res.ok) {
        successMsg.style.display = "block";
        form.reset();
      } else {
        errorMsg.textContent = data.message || "Something went wrong";
        errorMsg.style.display = "block";
      }
    } catch (err) {
      console.error("Create error:", err);
      errorMsg.textContent = "Server error. Please try again later.";
      errorMsg.style.display = "block";
    }
  });
});
