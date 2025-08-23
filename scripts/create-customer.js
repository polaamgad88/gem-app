document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("create-customer-form");
  const successMsg = document.getElementById("success-message");
  const errorMsg = document.getElementById("error-message");
  const token = await Utils.Auth.requireAuth();
  if (!token) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    successMsg.style.display = "none";
    errorMsg.style.display = "none";

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
