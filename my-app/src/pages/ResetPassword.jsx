import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" }); // type: "error" or "success"

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setMessage({ text: "Please enter your registered email.", type: "error" });
      return;
    }
    
    setIsLoading(true);
    setMessage({ text: "", type: "" });
    
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage({ text: "Password reset link sent! Please check your email inbox (and spam folder).", type: "success" });
      // Automatically navigate back to login after 3 seconds on success
      setTimeout(() => navigate("/"), 3000);
    } catch (error) {
      console.error("Password reset error:", error);
      let errorMsg = "Failed to send reset email. Please try again.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
        errorMsg = "No account found with this email.";
      }
      setMessage({ text: errorMsg, type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* Header */}
      <div className="bg-[#4169E1] h-[72px] px-4 flex items-center relative shadow-md">
        <button 
          onClick={() => navigate("/")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors absolute left-4"
          aria-label="Back"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-white text-lg font-bold w-full text-center">Reset Password</h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col">
        <h2 className="text-xl font-bold text-gray-800 mb-2">Verify Your Account</h2>
        <p className="text-gray-500 text-[15px] mb-8">
          Please provide your registered details to reset your password.
        </p>

        {message.text && (
          <div className={`p-4 rounded-lg mb-6 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
            {message.text}
          </div>
        )}

        {/* Verification Section */}
        <div className="flex flex-col gap-6 flex-1">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1 absolute -top-2 left-3 bg-[#F5F7FA] px-1 z-10 text-xs">Registered Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full bg-transparent border-2 border-gray-300 rounded-lg h-14 px-4 text-base focus:border-[#4169E1] outline-none transition-colors"
            />
          </div>

          <button 
            onClick={handleResetPassword}
            disabled={isLoading}
            className="w-full bg-[#4169E1] hover:bg-blue-700 text-white font-medium text-base rounded-lg h-14 shadow-md transition-colors active:scale-[0.98] disabled:opacity-70 flex justify-center items-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : "Send Reset Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
