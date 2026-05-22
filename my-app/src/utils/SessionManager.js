// ── SessionManager ───────────────────────────────────────────────────────────
// Web equivalent of the Android SessionManager using localStorage.
// Mirrors the SharedPreferences-based SessionManager from the mobile app.
// ─────────────────────────────────────────────────────────────────────────────

const KEYS = {
  REMEMBER_ME: "remember_me",
  SAVED_EMAIL: "saved_email",
};

const SessionManager = {
  /**
   * Persist or clear the "Remember Me" preference and email.
   */
  setRememberMe(checked, email) {
    if (checked) {
      localStorage.setItem(KEYS.REMEMBER_ME, "true");
      localStorage.setItem(KEYS.SAVED_EMAIL, email);
    } else {
      localStorage.removeItem(KEYS.REMEMBER_ME);
      localStorage.removeItem(KEYS.SAVED_EMAIL);
    }
  },

  /**
   * @returns {boolean} whether Remember Me was previously checked.
   */
  isRememberMeChecked() {
    return localStorage.getItem(KEYS.REMEMBER_ME) === "true";
  },

  /**
   * @returns {string} the saved email, or empty string.
   */
  getSavedEmail() {
    return localStorage.getItem(KEYS.SAVED_EMAIL) || "";
  },

  /**
   * Clear all session data (used on sign-out).
   */
  clear() {
    localStorage.removeItem(KEYS.REMEMBER_ME);
    localStorage.removeItem(KEYS.SAVED_EMAIL);
  },
};

export default SessionManager;
