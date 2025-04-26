/**
 * Common utility functions for the caravan management system
 */

// Authentication helpers
const Auth = {
  /**
   * Check if user is logged in with a valid token
   * @returns {Promise<boolean>} True if logged in, false otherwise
   */
  async checkLogin() {
    const token = localStorage.getItem("access_token");
    if (!token) return false;
    
    try {
      const res = await fetch("http://192.168.158.63:5000/checklogin", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch (err) {
      console.error("Login check failed:", err);
      return false;
    }
  },
  
  /**
   * Redirect to login page if not authenticated
   * @returns {Promise<string|null>} Token if authenticated, null if redirected
   */
  async requireAuth() {
    const token = localStorage.getItem("access_token");
    if (!token || !(await this.checkLogin())) {
      window.location.href = "login.html";
      return null;
    }
    return token;
  },
  
  /**
   * Log out the current user
   * @returns {Promise<boolean>} True if logout successful
   */
  async logout() {
    const token = localStorage.getItem("access_token");
    if (!token) return true;
    
    try {
      const logoutRes = await fetch("http://192.168.158.63:5000/logout", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (logoutRes.ok) {
        localStorage.clear();
        return true;
      } else {
        throw new Error("Logout failed");
      }
    } catch (err) {
      console.error("Logout error:", err);
      throw err;
    }
  }
};

// UI helpers
const UI = {
  /**
   * Show a loader element
   * @param {string} id - ID of the loader element
   */
  showLoader(id = "loader") {
    const loader = document.getElementById(id);
    if (loader) loader.style.display = "block";
  },
  
  /**
   * Hide a loader element
   * @param {string} id - ID of the loader element
   */
  hideLoader(id = "loader") {
    const loader = document.getElementById(id);
    if (loader) loader.style.display = "none";
  },
  
  /**
   * Show an error message
   * @param {string} message - Error message to display
   * @param {string} id - ID of the error element
   */
  showError(message, id = "error-message") {
    const errorDiv = document.getElementById(id);
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = "block";
    } else {
      alert(message);
    }
  },
  
  /**
   * Hide an error message
   * @param {string} id - ID of the error element
   */
  hideError(id = "error-message") {
    const errorDiv = document.getElementById(id);
    if (errorDiv) {
      errorDiv.style.display = "none";
    }
  },
  
  /**
   * Check screen size and toggle between table and card views
   */
  checkScreenSize() {
    const tableView = document.querySelector('.table-responsive');
    const cardView = document.querySelector('.card-view');
    
    if (!tableView || !cardView) return;
    
    if (window.innerWidth < 768) {
      tableView.style.display = 'none';
      cardView.style.display = 'block';
    } else {
      tableView.style.display = 'block';
      cardView.style.display = 'none';
    }
  }
};

// Date and formatting helpers
const Format = {
  /**
   * Format a date string to YYYY-MM-DD
   * @param {string} dateStr - Date string to format
   * @returns {string} Formatted date
   */
  date(dateStr) {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}`;
  },
  
  /**
   * Format a date string to MM/DD/YYYY
   * @param {string} dateStr - Date string to format
   * @returns {string} Formatted date
   */
  dateSlash(dateStr) {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  },
  
  /**
   * Format a number as currency
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted currency
   */
  currency(amount, currency = "EGP") {
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  }
};

// URL and parameter helpers
const URL = {
  /**
   * Get a parameter from the URL
   * @param {string} name - Parameter name
   * @returns {string|null} Parameter value or null if not found
   */
  getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }
};

// Export the utility objects
window.Utils = {
  Auth,
  UI,
  Format,
  URL
};
