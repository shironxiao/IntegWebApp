import { BrowserRouter, Routes, Route, Link } from "react-router-dom"

import Home from "./pages/Home"
import Report from "./pages/Report"
import News from "./pages/News"
import Profile from "./pages/Profile"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ResetPassword from "./pages/ResetPassword"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login page as the landing page */}
        <Route path="/" element={<Login />} />
        
        {/* Authentication Pages */}
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Main app routes with nav */}
        <Route
          path="/*"
          element={
            <>
              <nav className="flex gap-4 p-4 bg-blue-600 text-white shadow-lg">
                <Link to="/home" className="hover:bg-blue-700 px-3 py-2 rounded transition">Home</Link>
                <Link to="/report" className="hover:bg-blue-700 px-3 py-2 rounded transition">Report</Link>
                <Link to="/news" className="hover:bg-blue-700 px-3 py-2 rounded transition">News</Link>
                <Link to="/profile" className="hover:bg-blue-700 px-3 py-2 rounded transition">Profile</Link>
              </nav>

              <div className="flex-1 flex items-center justify-center bg-gray-100 min-h-screen">
                <Routes>
                  <Route path="/home" element={<Home />} />
                  <Route path="/report" element={<Report />} />
                  <Route path="/news" element={<News />} />
                  <Route path="/profile" element={<Profile />} />
                </Routes>
              </div>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
