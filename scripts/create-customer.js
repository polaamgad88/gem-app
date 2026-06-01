document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("create-customer-form");
  const successMsg = document.getElementById("success-message");
  const errorMsg = document.getElementById("error-message");
  const submitBtn = form?.querySelector('button[type="submit"]');

  const token = await Utils.Auth.requireAuth();
  if (!token || !form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    successMsg.style.display = "none";
    errorMsg.style.display = "none";

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    if (submitBtn) submitBtn.disabled = true;
    try {
      await Utils.Api.postForm("/customers/create", payload);
      successMsg.style.display = "block";
      form.reset();
      Utils.Api.invalidate("/customers");
    } catch (err) {
      errorMsg.textContent =
        err.data?.message || err.message || "Server error. Please try again.";
      errorMsg.style.display = "block";
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
