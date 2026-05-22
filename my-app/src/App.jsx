import { useState } from "react"
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom"

import Home from "./pages/Home"
import Report from "./pages/Report"
import News from "./pages/News"
import Profile from "./pages/Profile"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ResetPassword from "./pages/ResetPassword"
import Notifications from "./pages/Notifications"
import SubmitReport from "./pages/SubmitReport"
import { useReportStatusWatcher } from "./hooks/useReportStatusWatcher"

function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navItems = [
    { to: "/home", label: "Home" },
    { to: "/report", label: "Report" },
    { to: "/news", label: "News" },
    { to: "/profile", label: "Profile" },
  ];

  const linkClass = ({ isActive }) =>
    `px-3 py-2 rounded-xl text-sm font-bold transition-colors ${
      isActive ? "bg-white text-[#4169E1]" : "text-white hover:bg-white/15"
    }`;

  return (
    <>
      <nav className="sticky top-0 z-40 bg-[#4169E1] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to="/home" className="font-black text-lg tracking-tight" onClick={() => setMenuOpen(false)}>
            StreetAssist
          </NavLink>

          <div className="hidden sm:flex gap-2 items-center">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="sm:hidden w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center"
            aria-label="Open navigation menu"
            aria-expanded={menuOpen}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="sm:hidden border-t border-white/15 px-4 pb-4">
            <div className="flex flex-col gap-2 pt-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={linkClass}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="flex-1 bg-gray-100 min-h-screen w-full" key={location.pathname}>
        <Routes>
          <Route path="/home" element={<Home />} />
          <Route path="/report" element={<Report />} />
          <Route path="/news" element={<News />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  // Start global background watcher for report status changes
  useReportStatusWatcher();

  return (
    <BrowserRouter>
      <Routes>
        {/* Login page as the landing page */}
        <Route path="/" element={<Login />} />
        
        {/* Authentication Pages */}
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        
        {/* Standalone Pages without bottom nav */}
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/report/new" element={<SubmitReport />} />

        {/* Main app routes with nav */}
        <Route
          path="/*"
          element={<MainLayout />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
