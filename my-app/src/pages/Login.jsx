import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import SessionManager from "../utils/SessionManager";
import logoImg from "../assets/logointeg.png";

// ── Email regex (mirrors android.util.Patterns.EMAIL_ADDRESS) ────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Login() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "" });
  const [btnText, setBtnText] = useState("Login");
  const [btnDisabled, setBtnDisabled] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ── Auto-login: if user is already signed in, skip to main ─────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        navigateByRole(currentUser.uid);
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Restore remembered email via SessionManager ────────────────────────────
  useEffect(() => {
    if (SessionManager.isRememberMeChecked()) {
      setEmail(SessionManager.getSavedEmail());
      setRememberMe(true);
    }
  }, []);

  // ── Toast auto-dismiss ─────────────────────────────────────────────────────
  useEffect(() => {
    if (toast.message) {
      const timer = setTimeout(() => setToast({ message: "", type: "" }), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // =========================================================================
  //  Validation (mirrors Android validateInputs)
  // =========================================================================

  function validateInputs() {
    const newErrors = { email: "", password: "" };
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(trimmedEmail)) {
      newErrors.email = "Enter a valid email";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  }

  // =========================================================================
  //  Firebase Login (mirrors Android loginUser)
  // =========================================================================

  async function loginUser() {
    const trimmedEmail = email.trim();

    setBtnDisabled(true);
    setBtnText("Signing in…");

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        trimmedEmail,
        password
      );

      // Save or clear remembered email
      saveRememberMe(trimmedEmail);

      const user = userCredential.user;
      if (user) {
        navigateByRole(user.uid);
      }
    } catch (error) {
      setBtnDisabled(false);
      setBtnText("Login");

      // Map common Firebase errors to friendly messages
      let errorMsg = "Login failed. Please try again.";
      const raw = error.message || "";

      if (raw.includes("user-not-found") || raw.includes("identifier")) {
        errorMsg = "No account found with this email.";
      } else if (
        raw.includes("wrong-password") ||
        raw.includes("invalid-credential")
      ) {
        errorMsg = "Incorrect password. Please try again.";
      } else if (
        raw.includes("too-many-requests") ||
        raw.includes("blocked")
      ) {
        errorMsg = "Too many attempts. Please try again later.";
      } else if (raw.includes("network")) {
        errorMsg = "Network error. Check your connection.";
      }

      showToast(errorMsg, "error");
    }
  }

  // =========================================================================
  //  Firestore – fetch user role then navigate (mirrors Android navigateByRole)
  // =========================================================================

  async function navigateByRole(uid) {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const role = data.role || "";
        const fullName = data.fullName || "User";

        // Greet the user
        showToast(`Welcome back, ${fullName}!`, "success");

        // Pass useful user data to the next screen via state
        const userData = {
          uid,
          fullName,
          email: data.email || "",
          role,
        };

        // Pass address fields
        if (data.address) {
          userData.region = data.address.region || "";
          userData.province = data.address.province || "";
          userData.city = data.address.city || "";
          userData.barangay = data.address.barangay || "";
        }

        // Route by role (mirrors Android intent routing)
        if (role === "admin") {
          navigate("/home", { replace: true, state: userData });
        } else {
          navigate("/home", { replace: true, state: userData });
        }
      } else {
        // Auth account exists but Firestore doc is missing
        setBtnDisabled(false);
        setBtnText("Login");
        showToast(
          "Account data not found. Please contact support.",
          "error"
        );
        auth.signOut();
      }
    } catch (e) {
      setBtnDisabled(false);
      setBtnText("Login");
      showToast(`Failed to load profile: ${e.message}`, "error");
      auth.signOut();
    }
  }

  // =========================================================================
  //  Forgot Password (mirrors Android handleForgotPassword)
  // =========================================================================

  function handleForgotPassword() {
    navigate("/reset-password");
  }

  // =========================================================================
  //  Remember Me (mirrors Android saveRememberMe)
  // =========================================================================

  function saveRememberMe(emailValue) {
    SessionManager.setRememberMe(rememberMe, emailValue);
  }

  // =========================================================================
  //  Toast helper
  // =========================================================================

  function showToast(message, type = "info") {
    setToast({ message, type });
  }

  // ── Loading state while checking auth ──────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  //  Render
  // =========================================================================

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
      {/* ── Toast Notification ──────────────────────────────────────────── */}
      {toast.message && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white text-sm font-medium transition-all duration-300 animate-slideDown max-w-md text-center ${
            toast.type === "error"
              ? "bg-red-500/95 backdrop-blur-sm"
              : toast.type === "success"
              ? "bg-emerald-500/95 backdrop-blur-sm"
              : "bg-blue-500/95 backdrop-blur-sm"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* ── Blue Header Background (40% height) ─────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/10 rounded-full" />
        <div className="absolute top-32 -left-16 w-48 h-48 bg-white/5 rounded-full" />
        <div className="absolute bottom-10 right-10 w-24 h-24 bg-white/10 rounded-full" />
      </div>

      {/* ── Logo and Branding ────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center pt-10 pb-4">
        <div className="w-36 h-36 rounded-3xl overflow-hidden shadow-2xl bg-white/20 backdrop-blur-sm p-2 transition-transform duration-300 hover:scale-105">
          <img
            src={logoImg}
            alt="Street Assist Logo"
            className="w-full h-full object-contain rounded-2xl"
          />
        </div>
      </div>

      {/* ── Main Login Card ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex items-start justify-center px-6 mt-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] p-8 animate-fadeUp">
          {/* Card Title */}
          <h2
            id="tvSignIn"
            className="text-center text-gray-500 text-base font-medium mb-8"
          >
            Log in or Sign up
          </h2>

          {/* ── Email Field ──────────────────────────────────────────────── */}
          <div className="mb-5">
            <label
              htmlFor="etEmail"
              className="block text-sm font-medium text-gray-800 mb-1.5"
            >
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <input
                id="etEmail"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                }}
                placeholder="Enter Email"
                className={`w-full pl-11 pr-4 py-3 bg-gray-50 border rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                  errors.email ? "border-red-400 bg-red-50/50" : "border-gray-200"
                }`}
              />
            </div>
            {errors.email && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.email}
              </p>
            )}
          </div>

          {/* ── Password Field ───────────────────────────────────────────── */}
          <div className="mb-5">
            <label
              htmlFor="etPassword"
              className="block text-sm font-medium text-gray-800 mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <input
                id="etPassword"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password)
                    setErrors((p) => ({ ...p, password: "" }));
                }}
                placeholder="Enter Password"
                className={`w-full pl-11 pr-12 py-3 bg-gray-50 border rounded-lg text-sm text-gray-900 placeholder-gray-400 outline-none transition-all duration-200 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 ${
                  errors.password
                    ? "border-red-400 bg-red-50/50"
                    : "border-gray-200"
                }`}
              />
              {/* Password toggle (mirrors endIconMode="password_toggle") */}
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768l4.242 4.242m0 0l3.768 3.768M6.11 6.11L3 3m3.11 3.11l4.242 4.242"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.password}
              </p>
            )}
          </div>

          {/* ── Login Button ─────────────────────────────────────────────── */}
          <button
            id="btnGetStarted"
            type="button"
            disabled={btnDisabled}
            onClick={() => {
              if (validateInputs()) loginUser();
            }}
            className="w-full h-14 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium text-base rounded-lg shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 mb-4"
          >
            {btnDisabled && (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {btnText}
          </button>

          {/* ── Remember Me & Forgot Password ────────────────────────────── */}
          <div className="flex items-center justify-between mb-7">
            <label
              htmlFor="cbRememberMe"
              className="flex items-center gap-2 cursor-pointer select-none group"
            >
              <input
                id="cbRememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500/30 focus:ring-2 transition-colors cursor-pointer accent-blue-500"
              />
              <span className="text-xs text-blue-500 group-hover:text-blue-600 transition-colors">
                Remember Me
              </span>
            </label>

            <button
              id="tvForgotPassword"
              type="button"
              onClick={handleForgotPassword}
              className="text-xs text-blue-500 hover:text-blue-600 hover:underline transition-colors"
            >
              Forgot your password?
            </button>
          </div>

          {/* ── Sign Up Prompt ───────────────────────────────────────────── */}
          <p
            id="tvSignUpPrompt"
            className="text-center text-gray-500 text-sm mb-3"
          >
            Don&apos;t have an Account yet?
          </p>

          {/* ── Sign Up Button ───────────────────────────────────────────── */}
          <button
            id="btnSignUp"
            type="button"
            onClick={() => navigate("/register")}
            className="w-full h-14 bg-white border-2 border-blue-500 text-blue-500 font-medium text-base rounded-lg hover:bg-blue-50 active:scale-[0.98] transition-all duration-200 mb-2"
          >
            Sign Up
          </button>
        </div>
      </div>

    </div>
  );
}
