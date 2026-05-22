import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, onSnapshot, writeBatch, doc } from "firebase/firestore";
import { auth, db } from "../firebase";

const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
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

const getStatusStyles = (status) => {
  switch (status) {
    case "Pending": return { text: "text-[#BA7517]", bg: "bg-[#FFC107]/20", dot: "bg-[#FFC107]" };
    case "Verified": return { text: "text-[#0F6E56]", bg: "bg-[#1D9E75]/20", dot: "bg-[#1D9E75]" };
    case "In Progress": return { text: "text-[#185FA5]", bg: "bg-[#4169E1]/20", dot: "bg-[#4169E1]" };
    case "Resolved": return { text: "text-[#3B6D11]", bg: "bg-[#4CAF50]/20", dot: "bg-[#4CAF50]" };
    default: return { text: "text-[#BA7517]", bg: "bg-[#FFC107]/20", dot: "bg-[#FFC107]" };
  }
};

export default function Notifications() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        loadNotifications(user.uid);
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const loadNotifications = async (uid) => {
    try {
      // 1. Fetch all existing report IDs for this user to ensure sync
      const reportsQuery = query(collection(db, "reports"), where("userId", "==", uid));
      const reportSnapshots = await getDocs(reportsQuery);
      
      const existingReportIds = new Set();
      reportSnapshots.forEach(docSnap => {
        const rId = docSnap.data().reportId || docSnap.id;
        existingReportIds.add(rId);
      });

      // 2. Listen to notifications in real-time
      const notifsQuery = query(collection(db, "notifications"), where("userId", "==", uid));
      
      onSnapshot(notifsQuery, async (snapshot) => {
        const batch = writeBatch(db);
        let needsCleanup = false;
        let notifsList = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const reportId = data.reportId;

          // If notification is linked to a report that no longer exists, delete it
          if (reportId && !existingReportIds.has(reportId)) {
            batch.delete(docSnap.ref);
            needsCleanup = true;
            return; // skip adding to list
          }

          notifsList.push({
            id: docSnap.id,
            title: data.title || "Notification",
            message: data.message || "",
            isRead: data.isRead || false,
            createdAt: data.createdAt,
            status: data.status || "",
            reportId: data.reportId,
            ref: docSnap.ref
          });
        });

        if (needsCleanup) {
          await batch.commit();
        }

        // Sort: newest first
        notifsList.sort((a, b) => {
          const tsA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const tsB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return tsB - tsA;
        });

        setNotifications(notifsList);
        setIsLoading(false);
      });

    } catch (error) {
      console.error("Failed to load notifications", error);
      setIsLoading(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = async () => {
    if (!currentUser || unreadCount === 0) return;

    try {
      const batch = writeBatch(db);
      notifications.forEach(item => {
        if (!item.isRead) {
          batch.update(item.ref, { isRead: true });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  const clearAllNotifications = async () => {
    if (!currentUser || notifications.length === 0) return;

    try {
      const batch = writeBatch(db);
      notifications.forEach(item => {
        batch.delete(item.ref);
      });
      await batch.commit();
      setShowClearConfirm(false);
    } catch (error) {
      console.error("Failed to clear notifications", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col relative">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="bg-[#007BFF] h-16 flex items-center px-4 shadow-md shrink-0 relative z-10">
        <button onClick={() => navigate(-1)} className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-white text-lg font-bold ml-2">Notifications</h1>
        
        {notifications.length > 0 && (
          <button 
            onClick={() => setShowClearConfirm(true)}
            className="absolute right-4 px-2 py-2 text-white text-sm font-bold hover:bg-white/10 rounded transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* ── CONTENT ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* Mark All as Read Card */}
        {notifications.length > 0 && (
          <div className="mx-4 mt-4 shrink-0">
            <button 
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className={`w-full bg-white border border-gray-200 rounded-lg h-12 flex items-center justify-center font-bold text-[15px] transition-colors
                ${unreadCount > 0 ? "text-gray-600 hover:bg-gray-50 active:bg-gray-100 cursor-pointer" : "text-gray-400 opacity-50 cursor-not-allowed"}`}
            >
              Mark All as Read ({unreadCount})
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="w-8 h-8 border-4 border-[#007BFF]/30 border-t-[#007BFF] rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-[#AAAAAA] text-[15px]">No notifications yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {notifications.map(item => {
                const statusStyles = item.status ? getStatusStyles(item.status) : null;
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => {
                      if (!item.isRead) {
                        // Mark as read upon click
                        import("firebase/firestore").then(({ updateDoc }) => updateDoc(item.ref, { isRead: true }));
                      }
                      navigate("/report", { state: { filter_status: item.status } });
                    }}
                    className={`rounded-xl p-4 cursor-pointer transition-colors relative border ${item.isRead ? 'bg-white border-gray-100' : 'bg-[#EDF2FF] border-[#4169E1]/20'}`}
                  >
                    {!item.isRead && (
                      <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-[#4169E1] rounded-full" />
                    )}
                    
                    <h3 className="font-bold text-[15px] text-gray-800 pr-6 mb-1">{item.title}</h3>
                    <p className="text-sm text-gray-600 mb-2 leading-snug">{item.message}</p>
                    
                    <div className="flex items-center gap-3 mt-3">
                      <p className="text-xs text-gray-400 font-medium">{formatTimestamp(item.createdAt)}</p>
                      
                      {statusStyles && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <div className={`w-2 h-2 rounded-full ${statusStyles.dot}`} />
                          <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusStyles.bg} ${statusStyles.text}`}>
                            {item.status}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── CONFIRM CLEAR MODAL ─────────────────────────────────────────── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[320px] overflow-hidden">
            <div className="p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Clear Notifications</h3>
              <p className="text-sm text-gray-600">Are you sure you want to delete all notifications?</p>
            </div>
            <div className="flex border-t border-gray-100">
              <button onClick={() => setShowClearConfirm(false)} className="flex-1 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100">
                Cancel
              </button>
              <button onClick={clearAllNotifications} className="flex-1 py-3.5 text-sm font-bold text-red-500 hover:bg-red-50">
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
