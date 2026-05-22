import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-red.png",
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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

const getStatusStyles = (status) => {
  switch (status) {
    case "Pending": return { text: "text-[#BA7517]", bg: "bg-[#FFC107]/20", border: "border-[#FFC107]", badge: "bg-[#FFC107]" };
    case "Verified": return { text: "text-[#0F6E56]", bg: "bg-[#1D9E75]/20", border: "border-[#1D9E75]", badge: "bg-[#1D9E75]" };
    case "In Progress": return { text: "text-[#185FA5]", bg: "bg-[#4169E1]/20", border: "border-[#4169E1]", badge: "bg-[#4169E1]" };
    case "Resolved": return { text: "text-[#3B6D11]", bg: "bg-[#4CAF50]/20", border: "border-[#4CAF50]", badge: "bg-[#4CAF50]" };
    default: return { text: "text-[#BA7517]", bg: "bg-[#FFC107]/20", border: "border-[#FFC107]", badge: "bg-[#FFC107]" };
  }
};

const extractProofUrls = (report) => {
  const urls = new Set();
  const topLevelKeys = ["proofImages", "proofUrls", "proofImage", "proofUrl", "proof", "resolutionImages", "resolutionImage", "evidenceImages", "evidenceUrls", "evidenceImage", "evidenceUrl", "evidence"];
  
  topLevelKeys.forEach(key => {
    const val = report[key];
    if (val) {
      if (Array.isArray(val)) val.forEach(v => urls.add(v));
      else if (typeof val === "string") val.split(",").forEach(v => urls.add(v.trim()));
    }
  });

  if (Array.isArray(report.statusUpdates)) {
    report.statusUpdates.forEach(update => {
      if (update && typeof update === "object") {
        ["proofUrls", "proofImages", "evidenceUrls", "evidenceImages", "evidence", "proof"].forEach(k => {
          const val = update[k];
          if (val) {
            if (Array.isArray(val)) val.forEach(v => urls.add(v));
            else if (typeof val === "string") val.split(",").forEach(v => urls.add(v.trim()));
          }
        });
      }
    });
  }
  return Array.from(urls).filter(url => url);
};

const extractReportMedia = (report) => {
  const media = [];
  const seen = new Set();

  const addMedia = (url, type = "image") => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    media.push({ url, type });
  };

  if (Array.isArray(report?.media)) {
    report.media.forEach((item) => {
      if (item?.url) {
        const type = item.resourceType === "video" ? "video" : "image";
        addMedia(item.url, type);
      }
    });
  }

  if (Array.isArray(report?.photoUrls)) {
    report.photoUrls.forEach((url) => addMedia(url, "image"));
  } else if (report?.photoUrl) {
    addMedia(report.photoUrl, "image");
  }

  if (Array.isArray(report?.videoUrls)) {
    report.videoUrls.forEach((url) => addMedia(url, "video"));
  } else if (report?.videoUrl) {
    addMedia(report.videoUrl, "video");
  }

  return media;
};

const isAnimalReport = (report) => {
  return (report?.reportType || "").toLowerCase() === "animal"
    || (report?.approximateAge === "N/A" && report?.sex === "N/A");
};

const hasReportLocation = (report) => report?.latitude != null && report?.longitude != null;

const normalizeFilterStatus = (filterStatus) => {
  if (filterStatus === "Verified" || filterStatus === "Pending") return "Pending";
  if (filterStatus === "In Progress") return "In Progress";
  if (filterStatus === "Resolved") return "Resolved";
  return "All";
};

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function LocationModal({ report, onClose }) {
  const center = [report.latitude, report.longitude];

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[84vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Last Seen Location</p>
            <h2 className="text-lg font-black text-gray-800">{report.reportId || report.id?.substring(0, 8)}</h2>
            <p className="text-sm text-gray-500 line-clamp-1">{report.locationAddress || "No address available."}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 grid place-items-center" aria-label="Close map">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1">
          <MapContainer center={center} zoom={17} className="h-full w-full">
            <MapUpdater center={center} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={center} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentFilter, setCurrentFilter] = useState(() => normalizeFilterStatus(location.state?.filter_status));

  const [selectedReport, setSelectedReport] = useState(null); // For Details Modal
  const [proofReport, setProofReport] = useState(null); // For Proof Images Modal
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [locationReport, setLocationReport] = useState(null);

  useEffect(() => {
    if (location.state && location.state.filter_status) {
      // Clear state so it doesn't re-apply on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const q = query(collection(db, "reports"), where("userId", "==", user.uid));
        
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const list = [];
          snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (!data.isHiddenByResident) {
              list.push({ id: docSnap.id, ...data });
            }
          });
          
          list.sort((a, b) => {
            const tsA = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
            const tsB = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
            return tsB - tsA;
          });
          
          setReports(list);
          setIsLoading(false);
        }, (error) => {
          console.error("Failed to fetch reports:", error);
          setIsLoading(false);
        });

        return () => unsubscribeSnapshot();
      } else {
        navigate("/");
      }
    });
    
    return () => unsubscribeAuth();
  }, [navigate]);

  const filteredReports = reports.filter(r => {
    if (currentFilter === "All") return true;
    const status = r.status || "Pending";
    if (currentFilter === "Pending") return status === "Pending" || status === "Verified";
    return status === currentFilter;
  });

  const handleRemoveReport = async (reportId) => {
    if (window.confirm("This report will be removed from your list, but will remain in our records. Continue?")) {
      try {
        await updateDoc(doc(db, "reports", reportId), { isHiddenByResident: true });
        setSelectedReport(null);
      } catch (e) {
        console.error("Failed to remove report", e);
        alert("Failed to remove report: " + e.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] w-full flex justify-center pb-20">
      <div className="w-full max-w-4xl p-5 flex flex-col pt-8">
        
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-gray-800">Your Reports</h1>
            <p className="text-sm text-gray-500">Track and manage your submitted reports</p>
          </div>
          <button 
            onClick={() => navigate("/report/new")}
            className="bg-[#4169E1] hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
            <span className="hidden sm:inline">New Report</span>
          </button>
        </div>

        {/* Chip Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 hide-scrollbar">
          {["All", "Pending", "In Progress", "Resolved"].map(filter => (
            <button
              key={filter}
              onClick={() => setCurrentFilter(filter)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                currentFilter === filter 
                  ? "bg-[#4169E1] text-white border-[#4169E1]" 
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-[#4169E1]/30 border-t-[#4169E1] rounded-full animate-spin" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 flex flex-col items-center justify-center border border-gray-100 shadow-sm mt-4">
            <svg className="w-16 h-16 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-bold text-gray-700">No reports found</h3>
            <p className="text-sm font-medium text-gray-400 mt-1">You haven't submitted any reports in this category.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredReports.map(report => {
              const statusStr = report.status || "Pending";
              const styles = getStatusStyles(statusStr);
              const assistance = report.assistanceDescription || "—";
              const isResolved = statusStr.toLowerCase().includes("resolved") || statusStr.toLowerCase().includes("closed");
              const proofUrls = extractProofUrls(report);
              const isAnimal = isAnimalReport(report);

              return (
                <div key={report.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  {/* Top bar with ID and Status */}
                  <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-widest">
                      {report.reportId || report.id.substring(0, 8)}
                    </span>
                    <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${styles.bg} ${styles.text}`}>
                      {statusStr}
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => setSelectedReport(report)}>
                    <h3 className="font-bold text-gray-800 text-base mb-3 line-clamp-2 leading-snug">
                      {report.description || "No description provided."}
                    </h3>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4">
                      {!isAnimal && (
                        <>
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <div className="text-[13px]">
                          <span className="text-gray-500">Age: </span><span className="font-medium text-gray-700">{report.approximateAge || "—"}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-4 h-4 mt-0.5 shrink-0 flex items-center justify-center text-gray-400 font-bold text-xs">⚧</div>
                        <div className="text-[13px]">
                          <span className="text-gray-500">Sex: </span><span className="font-medium text-gray-700">{report.sex || "—"}</span>
                        </div>
                      </div>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (hasReportLocation(report)) setLocationReport(report);
                        }}
                        disabled={!hasReportLocation(report)}
                        className="flex items-start gap-2 col-span-2 text-left disabled:cursor-default"
                      >
                        <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <div className="text-[13px]">
                          <span className={`font-medium line-clamp-1 ${hasReportLocation(report) ? "text-[#4169E1] hover:underline" : "text-gray-700"}`}>{report.locationAddress || "Location not set"}</span>
                        </div>
                      </button>
                      <div className="flex items-start gap-2 col-span-2">
                        <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        <div className="text-[13px]">
                          <span className="text-gray-500">Assistance: </span>
                          <span className="font-medium text-gray-700">
                            {assistance.length > 40 ? assistance.substring(0, 40) + "…" : assistance}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-gray-400 font-medium">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Submitted: {formatTimestamp(report.timestamp)}
                      </div>
                      {report.seenAt && (
                        <div className="flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          Seen: {formatTimestamp(report.seenAt)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/30 flex justify-between items-center">
                    <button onClick={() => setSelectedReport(report)} className="text-[13px] font-bold text-[#4169E1] hover:underline px-2 py-1 -ml-2">
                      View Details
                    </button>
                    
                    <div className="flex gap-2">
                      {isResolved && proofUrls.length > 0 && (
                        <button 
                          onClick={() => setProofReport(report)}
                          className="text-[12px] font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          View Proof
                        </button>
                      )}
                      {isResolved && (
                        <button 
                          onClick={() => handleRemoveReport(report.id)}
                          className="text-[12px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: REPORT DETAILS ─────────────────────────────────────────── */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-xl max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white rounded-t-3xl sm:rounded-2xl z-10">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Report Details</p>
                <h2 className="text-lg font-black text-gray-800">{selectedReport.reportId || selectedReport.id.substring(0, 8)}</h2>
              </div>
              <button onClick={() => setSelectedReport(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto">
              <div className="mb-6 flex justify-between items-center">
                <span className="text-sm font-bold text-gray-500">Status</span>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusStyles(selectedReport.status || "Pending").bg} ${getStatusStyles(selectedReport.status || "Pending").text}`}>
                  {selectedReport.status || "Pending"}
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Description</span>
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">{selectedReport.description || "No description provided."}</p>
                </div>

                {!isAnimalReport(selectedReport) && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Age</span>
                    <p className="text-sm text-gray-800 font-medium">{selectedReport.approximateAge || "—"}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Sex</span>
                    <p className="text-sm text-gray-800 font-medium">{selectedReport.sex || "—"}</p>
                  </div>
                </div>
                )}

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Location</span>
                  <button
                    type="button"
                    onClick={() => hasReportLocation(selectedReport) && setLocationReport(selectedReport)}
                    disabled={!hasReportLocation(selectedReport)}
                    className="w-full flex items-start gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100 text-left disabled:cursor-default"
                  >
                    <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <p className={`text-sm font-medium ${hasReportLocation(selectedReport) ? "text-[#4169E1]" : "text-gray-800"}`}>{selectedReport.locationAddress || "No address available."}</p>
                  </button>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Assistance Needed</span>
                  <p className="text-sm text-gray-800 font-medium">{selectedReport.assistanceDescription || "Not specified."}</p>
                </div>

                {extractReportMedia(selectedReport).length > 0 && (
                  <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Captured Media</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {extractReportMedia(selectedReport).map((item, idx) => (
                        <button
                          key={`${item.url}-${idx}`}
                          type="button"
                          onClick={() => setFullscreenMedia(item)}
                          className="relative aspect-[4/3] rounded-xl overflow-hidden border border-gray-200 bg-gray-100 text-left"
                        >
                          {item.type === "video" ? (
                            <>
                              <video src={item.url} className="w-full h-full object-cover" muted playsInline />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <div className="w-11 h-11 rounded-full bg-white/85 text-gray-800 grid place-items-center shadow-md">
                                  <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="absolute left-2 top-2 bg-black/65 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                                Video
                              </div>
                            </>
                          ) : (
                            <img src={item.url} alt={`Report media ${idx + 1}`} className="w-full h-full object-cover" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Contact Number</span>
                  <p className="text-sm text-gray-800 font-medium">{selectedReport.contactNumber || "Not provided"}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date Submitted</span>
                    <p className="text-[13px] text-gray-600 font-medium">{formatTimestamp(selectedReport.timestamp)}</p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Last Seen</span>
                    <p className="text-[13px] text-gray-600 font-medium">{formatTimestamp(selectedReport.seenAt)}</p>
                  </div>
                </div>

                {/* Resolution Section if Closed/Resolved */}
                {(selectedReport.status?.toLowerCase().includes("resolved") || selectedReport.status?.toLowerCase().includes("closed")) && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-sm font-black text-gray-800 mb-3">Resolution Details</h3>
                    {(selectedReport.resolutionNotes || selectedReport.notes || selectedReport.resolution) && (
                      <p className="text-sm text-gray-600 mb-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        {selectedReport.resolutionNotes || selectedReport.notes || selectedReport.resolution}
                      </p>
                    )}
                    
                    {extractProofUrls(selectedReport).length > 0 && (
                      <button 
                        onClick={() => { setSelectedReport(null); setProofReport(selectedReport); }}
                        className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold py-3 rounded-xl border border-gray-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L28 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        View Resolution Proof Images
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-3xl sm:rounded-b-2xl">
              {(selectedReport.status?.toLowerCase().includes("resolved") || selectedReport.status?.toLowerCase().includes("closed")) ? (
                <button 
                  onClick={() => handleRemoveReport(selectedReport.id)}
                  className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3.5 rounded-xl transition-colors"
                >
                  Remove Report
                </button>
              ) : (
                <button 
                  onClick={() => setSelectedReport(null)}
                  className="w-full bg-[#4169E1] hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PROOF IMAGES ───────────────────────────────────────────── */}
      {proofReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#4169E1]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Resolution Proof
              </h2>
              <button onClick={() => setProofReport(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {extractProofUrls(proofReport).map((url, idx) => (
                  <div 
                    key={idx} 
                    className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden cursor-pointer border border-gray-200 hover:border-[#4169E1] hover:shadow-md transition-all group"
                    onClick={() => setFullscreenMedia({ url, type: "image" })}
                  >
                    <img src={url} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FULLSCREEN IMAGE ───────────────────────────────────────── */}
      {fullscreenMedia && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black p-4 animate-in fade-in duration-200" onClick={() => setFullscreenMedia(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {fullscreenMedia.type === "video" ? (
            <video
              src={fullscreenMedia.url}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl bg-black"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <img
              src={fullscreenMedia.url}
              alt="Fullscreen Media"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          )}
        </div>
      )}

      {locationReport && (
        <LocationModal report={locationReport} onClose={() => setLocationReport(null)} />
      )}

    </div>
  );
}
