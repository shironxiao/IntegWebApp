import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";

// Helper function to format timestamp
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "—";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('en-US', { 
    month: 'short', 
    day: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
};

export default function Home() {
  const navigate = useNavigate();
  
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState({ firstName: "User", photoUrl: null });
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  
  const [stats, setStats] = useState({ total: 0, pending: 0, resolved: 0 });
  const [recentReports, setRecentReports] = useState([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  // 1. Listen for Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadUserProfile(user.uid);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // 2. Load User Profile
  const loadUserProfile = async (uid) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const fullName = data.fullName || "User";
        const firstName = fullName.trim().split(/\s+/)[0];
        setUserProfile({
          firstName: firstName,
          photoUrl: data.profilePhotoUrl || null
        });
      }
    } catch (error) {
      console.error("Failed to load profile", error);
    }
  };

  // 3. Listen to Notifications
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", currentUser.uid),
      where("isRead", "==", false)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadNotifs(snapshot.size);
    }, (error) => {
      console.error("Failed to listen to notifications", error);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 4. Listen to Reports
  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "reports"),
      where("userId", "==", currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0, pending = 0, resolved = 0;
      let validDocs = [];

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isHiddenByResident) return; // Skip hidden
        
        validDocs.push({ id: docSnap.id, ...data });
        total++;
        
        const status = data.status || "Pending";
        if (status.toLowerCase() === "pending" || status.toLowerCase() === "verified") {
          pending++;
        }
        if (status.toLowerCase() === "resolved") {
          resolved++;
        }
      });

      // Sort by timestamp descending
      validDocs.sort((a, b) => {
        const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
        const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
        return tsB - tsA;
      });

      setStats({ total, pending, resolved });
      setRecentReports(validDocs.slice(0, 3)); // Max 3 recent reports
      setIsLoadingReports(false);
    }, (error) => {
      console.error("Failed to listen to reports", error);
      setIsLoadingReports(false);
    });
    
    return () => unsubscribe();
  }, [currentUser]);

  // Status Styling Helper
  const getStatusStyles = (status) => {
    switch (status) {
      case "Pending":
        return { text: "text-[#BA7517]", bg: "bg-[#FFC107]/20", bar: "bg-[#FFC107]" };
      case "Verified":
        return { text: "text-[#0F6E56]", bg: "bg-[#1D9E75]/20", bar: "bg-[#1D9E75]" };
      case "In Progress":
        return { text: "text-[#185FA5]", bg: "bg-[#4169E1]/20", bar: "bg-[#4169E1]" };
      case "Resolved":
        return { text: "text-[#3B6D11]", bg: "bg-[#4CAF50]/20", bar: "bg-[#4CAF50]" };
      default:
        return { text: "text-[#BA7517]", bg: "bg-[#FFC107]/20", bar: "bg-[#FFC107]" };
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 w-full">
      
      {/* ── HEADER SECTION ────────────────────────────────────────────────── */}
      <div className="relative bg-[#4169E1] overflow-hidden rounded-b-[32px] px-6 pt-16 pb-16 lg:pb-20">
        {/* Decorative Circle */}
        <div className="absolute -top-16 -right-16 w-52 h-52 bg-white/20 rounded-full" />
        
        <div className="max-w-4xl mx-auto flex justify-between items-start relative z-10">
          {/* User Info */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate("/profile")}>
            {/* Avatar */}
            {userProfile.photoUrl ? (
              <img 
                src={userProfile.photoUrl} 
                alt="Profile" 
                className="w-16 h-16 rounded-full border-2 border-white object-cover shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-full border-2 border-white bg-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-sm">
                {userProfile.firstName.charAt(0).toUpperCase()}
              </div>
            )}
            
            <div className="text-white">
              <h1 className="text-2xl font-black mb-1">Welcome, {userProfile.firstName}!</h1>
              <p className="text-sm opacity-90 text-white/90 font-medium">Making our community better together.</p>
            </div>
          </div>

          {/* Notification Bell */}
          <div className="relative p-2 cursor-pointer hover:bg-white/10 rounded-full transition-colors" onClick={() => navigate("/notifications")}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unreadNotifs > 0 && (
              <div className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#4169E1]">
                {unreadNotifs > 9 ? "9+" : unreadNotifs}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ────────────────────────────────────────── */}
      <div className="px-5 -mt-12 lg:-mt-16 relative z-20 max-w-4xl mx-auto w-full">
        
        {/* Action Card: Submit New Report */}
        <div 
          onClick={() => navigate("/report/new")} 
          className="bg-white rounded-3xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.08)] flex items-center justify-between cursor-pointer hover:scale-[1.02] transition-transform duration-200 border border-gray-100"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-[#4169E1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Submit New Report</h2>
              <p className="text-sm text-slate-500">Click here to report a case</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#4169E1]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* ── YOUR ACTIVITY SECTION ───────────────────────────────────────── */}
        <div className="mt-8">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1 mb-3">Your Activity</h3>
          
          <div className="flex gap-3">
            {/* Total Card */}
            <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="text-2xl font-black text-[#4169E1]">{stats.total}</div>
              <div className="text-[11px] text-slate-500 font-medium uppercase mt-1">Total</div>
            </div>
            
            {/* Pending Card */}
            <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="text-2xl font-black text-[#F59E0B]">{stats.pending}</div>
              <div className="text-[11px] text-slate-500 font-medium uppercase mt-1">Pending</div>
            </div>
            
            {/* Resolved Card */}
            <div className="flex-1 bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="text-2xl font-black text-[#10B981]">{stats.resolved}</div>
              <div className="text-[11px] text-slate-500 font-medium uppercase mt-1">Resolved</div>
            </div>
          </div>
        </div>

        {/* ── RECENT REPORTS SECTION ──────────────────────────────────────── */}
        <div className="mt-8">
          <div className="flex justify-between items-center mb-3 ml-1">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Recent Reports</h3>
            <button 
              onClick={() => navigate("/report")} 
              className="text-xs font-bold text-[#4169E1] hover:underline px-2 py-1"
            >
              See all →
            </button>
          </div>

          {isLoadingReports ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-[#4169E1]/30 border-t-[#4169E1] rounded-full animate-spin" />
            </div>
          ) : recentReports.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center justify-center border border-gray-100 shadow-sm mt-3">
              <svg className="w-12 h-12 text-slate-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm font-medium text-slate-400">No reports submitted yet.</p>
            </div>
          ) : (
            /* Recent Reports List */
            <div className="flex flex-col gap-3 mt-3">
              {recentReports.map(report => {
                const statusStr = report.status || "Pending";
                const styles = getStatusStyles(statusStr);
                
                return (
                  <div 
                    key={report.id}
                    onClick={() => navigate("/report", { state: { filter_status: statusStr } })}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow flex"
                  >
                    {/* Left status color bar */}
                    <div className={`w-1.5 flex-shrink-0 ${styles.bar}`} />
                    
                    <div className="p-4 w-full">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          {report.reportId || report.id.substring(0, 8)}
                        </span>
                        
                        {/* Status Badge */}
                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${styles.bg} ${styles.text}`}>
                          {statusStr}
                        </div>
                      </div>
                      
                      <h4 className="font-semibold text-slate-800 text-sm mb-1.5 line-clamp-1">
                        {report.description || "No description"}
                      </h4>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="line-clamp-1">{report.locationAddress || "Location not set"}</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{formatTimestamp(report.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
