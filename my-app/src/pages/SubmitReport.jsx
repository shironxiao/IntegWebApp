import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, getDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import { notifyReportSubmitted } from "../hooks/useReportStatusWatcher";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet marker icons (use CDN to avoid Vite bundling issues and use a red marker)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-red.png",
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});


function LocationMarker({ position, onLocationChange }) {
  useMapEvents({
    async click(e) {
      const point = { lat: e.latlng.lat, lng: e.latlng.lng };
      onLocationChange({
        markerPosition: point,
        latitude: point.lat,
        longitude: point.lng,
        locationName: "Loading address...",
      });
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}`);
        const data = await res.json();
        const address = data.display_name || `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
        onLocationChange({ locationName: address, locationAddress: address });
      } catch {
        const fallback = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
        onLocationChange({ locationName: fallback, locationAddress: fallback });
      }
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function SubmitReport() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportId, setReportId] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(null);
  const searchTimeoutRef = useRef(null);
  const searchContainerRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    reportType: "Individual",
    approximateAge: "",
    sex: "",
    description: "",
    seenAt: "",
    assistanceDescription: "",
    contactNumber: "",
  });

  const [reportTypeData, setReportTypeData] = useState({
    Individual: {
      locationAddress: "",
      locationName: "No individual location selected yet",
      latitude: 14.6760,
      longitude: 121.0437,
      markerPosition: null,
      searchQuery: "",
      photoFiles: [],
      photoPreviews: [],
    },
    Animal: {
      locationAddress: "",
      locationName: "No animal location selected yet",
      latitude: 14.6760,
      longitude: 121.0437,
      markerPosition: null,
      searchQuery: "",
      photoFiles: [],
      photoPreviews: [],
    },
  });

  const activeReportData = reportTypeData[formData.reportType];

  const updateForm = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateActiveReportData = (updates) => {
    setReportTypeData(prev => ({
      ...prev,
      [formData.reportType]: {
        ...prev[formData.reportType],
        ...updates,
      },
    }));
  };

  const changeReportType = (reportType) => {
    updateForm("reportType", reportType);
    setSearchResults([]);
    setShowSuggestions(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        try {
          const docSnap = await getDoc(doc(db, "users", user.uid));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            if (data.contactNumber) {
              setFormData(prev => (
                prev.contactNumber ? prev : { ...prev, contactNumber: data.contactNumber }
              ));
            }
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        navigate("/");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Automatically request the user's current location on mount
  useEffect(() => {
    const updateInitialLocation = (updates) => {
      setReportTypeData(prev => ({
        ...prev,
        Individual: {
          ...prev.Individual,
          ...updates,
        },
      }));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateInitialLocation({
          latitude: lat,
          longitude: lng,
          markerPosition: { lat, lng },
          locationName: "Loading address...",
        });
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const address = data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
          updateInitialLocation({ locationName: address, locationAddress: address });
        } catch {
          const fallback = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
          updateInitialLocation({ locationName: fallback, locationAddress: fallback });
        }
      }, (err) => {
        console.warn("Auto-location permission denied or failed:", err);
      });
    }
  }, []);


  const handlePhotoSelect = (e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      updateActiveReportData({ photoFiles: [...activeReportData.photoFiles, ...files] });
      const newPreviews = files.map(file => URL.createObjectURL(file));
      updateActiveReportData({ photoPreviews: [...activeReportData.photoPreviews, ...newPreviews] });
      e.target.value = "";
    }
  };

  const removePhoto = (index) => {
    const newFiles = [...activeReportData.photoFiles];
    newFiles.splice(index, 1);
    const newPreviews = [...activeReportData.photoPreviews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    updateActiveReportData({ photoFiles: newFiles, photoPreviews: newPreviews });
  };

  // Dynamic search with debounce
  const handleSearchInput = (value) => {
    updateActiveReportData({ searchQuery: value });
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!value.trim() || value.trim().length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(data || []);
        setShowSuggestions(data && data.length > 0);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  };

  const selectSearchResult = (result) => {
    const newLat = parseFloat(result.lat);
    const newLng = parseFloat(result.lon);
    updateActiveReportData({
      latitude: newLat,
      longitude: newLng,
      markerPosition: { lat: newLat, lng: newLng },
      locationName: result.display_name,
      locationAddress: result.display_name,
      searchQuery: result.display_name,
    });
    setShowSuggestions(false);
    setSearchResults([]);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateActiveReportData({
          latitude: lat,
          longitude: lng,
          markerPosition: { lat, lng },
          locationName: "Loading address...",
        });
        
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const address = data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
          updateActiveReportData({ locationName: address, locationAddress: address });
        } catch {
          const fallback = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
          updateActiveReportData({ locationName: fallback, locationAddress: fallback });
        }

      }, (err) => {
        alert("Failed to get location: " + err.message);
      });
    }
  };

  const handleUseCurrentDateTime = () => {
    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzOffset)).toISOString().slice(0, 16);
    updateForm("seenAt", localISOTime);
  };

  const goToStep2 = () => {
    if (!activeReportData.markerPosition || !activeReportData.locationAddress) {
      alert(`Please select a location for the ${formData.reportType.toLowerCase()} report.`);
      return;
    }
    if (!formData.description.trim()) {
      alert("Please provide a brief description.");
      return;
    }
    if (formData.reportType === "Animal" && activeReportData.photoFiles.length === 0) {
      alert("Please upload a photo for the animal report.");
      return;
    }
    setStep(2);
  };

  const submitReport = async () => {
    if (!formData.assistanceDescription.trim()) {
      alert("Please describe the assistance needed.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const currentReportData = reportTypeData[formData.reportType];
      // 1. Upload photos if exists
      let uploadedPhotoUrl = "";
      let uploadedPhotoUrls = [];
      if (currentReportData.photoFiles && currentReportData.photoFiles.length > 0) {
        const uploadPromises = currentReportData.photoFiles.map(file => uploadImageToCloudinary(file));
        uploadedPhotoUrls = await Promise.all(uploadPromises);
        uploadedPhotoUrl = uploadedPhotoUrls[0]; // fallback for backward compat
      }

      // 2. Prepare Data
      const generatedReportId = "RPT-" + new Date().toISOString().replace(/[-:T.]/g, "").substring(0, 14);
      const uid = currentUser ? currentUser.uid : "anonymous";
      let fullName = userProfile?.fullName || userProfile?.username || "Resident";
      let email = currentUser?.email || "";

      // Parse seenAt
      let seenAtTimestamp = null;
      if (formData.seenAt) {
        seenAtTimestamp = new Date(formData.seenAt);
      }

      const reportPayload = {
        reportId: generatedReportId,
        userId: uid,
        userEmail: email,
        fullName: fullName,
        latitude: currentReportData.latitude,
        longitude: currentReportData.longitude,
        locationAddress: currentReportData.locationAddress,
        approximateAge: formData.reportType === "Individual" ? formData.approximateAge : "N/A",
        sex: formData.reportType === "Individual" ? formData.sex : "N/A",
        description: formData.description,
        assistanceDescription: formData.assistanceDescription,
        contactNumber: formData.contactNumber,
        seenAt: seenAtTimestamp,
        reportType: formData.reportType,
        photoUrl: uploadedPhotoUrl,
        photoUrls: uploadedPhotoUrls,
        status: "Pending",
        timestamp: serverTimestamp(),
        isHiddenByResident: false
      };

      // 3. Save to Firestore
      await setDoc(doc(db, "reports", generatedReportId), reportPayload);

      // 4. Create Admin Notification
      await addDoc(collection(db, "admin_notifications"), {
        title: `New ${formData.reportType} Report`,
        message: `${fullName} submitted a new ${formData.reportType.toLowerCase()} report (${generatedReportId}) at ${currentReportData.locationAddress}`,
        createdAt: serverTimestamp(),
        isRead: false,
        type: "new_report",
        referenceId: generatedReportId
      });

      // 5. Create Resident Notification via Status Watcher Helper
      await notifyReportSubmitted(uid, generatedReportId);

      setReportId(generatedReportId);
      setStep(3);

    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };


  // ── RENDER HELPERS ────────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center py-6">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {step > 1 ? "✓" : "1"}
      </div>
      <div className={`w-10 h-0.5 mx-2 ${step >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-green-500 text-white' : (step === 2 ? 'bg-[#4169E1] text-white' : 'bg-gray-200 text-gray-500')}`}>
        {step > 2 ? "✓" : "2"}
      </div>
      <div className={`w-10 h-0.5 mx-2 ${step >= 3 ? 'bg-green-500' : 'bg-gray-200'}`} />
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step === 3 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
        3
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F7FA] w-full pb-20">
      {/* Header */}
      <div className="bg-[#4169E1] px-6 py-8 pb-16 w-full text-white">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <button onClick={() => step > 1 && step < 3 ? setStep(step - 1) : navigate(-1)} className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/30 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-black">Submit a Report</h1>
            <p className="text-blue-100 text-sm">
              {step === 1 && "General Information"}
              {step === 2 && "Additional Information"}
              {step === 3 && "Report submitted successfully"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-3xl mx-auto px-5 -mt-8 relative z-10">
        <div className="bg-white rounded-t-[32px] rounded-b-xl shadow-lg p-6 min-h-[500px]">
          {renderStepIndicator()}

          {/* ── STEP 1: General Info ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
              
              {/* Report Type Toggle */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">What are you reporting?</label>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  <button 
                    onClick={() => changeReportType("Individual")}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${formData.reportType === "Individual" ? "bg-white text-[#4169E1] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    Individual
                  </button>
                  <button 
                    onClick={() => changeReportType("Animal")}
                    className={`flex-1 py-3 text-sm font-bold rounded-lg transition-colors ${formData.reportType === "Animal" ? "bg-white text-[#4169E1] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    Animal
                  </button>
                </div>
              </div>

              {/* Map & Location */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Last Seen Location</label>
                
                {/* Search Bar with Suggestions */}
                <div className="relative mb-2" ref={searchContainerRef}>
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
                  <input 
                    type="text" 
                    value={activeReportData.searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowSuggestions(true)}
                    placeholder="Search a location..."
                    className="w-full pl-10 pr-10 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm"
                  />
                  {isSearching && (
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <div className="w-4 h-4 border-2 border-[#4169E1] border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {/* Suggestions Dropdown */}
                  {showSuggestions && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-[500] max-h-60 overflow-y-auto">
                      {searchResults.map((result, idx) => (
                        <button
                          key={idx}
                          onClick={() => selectSearchResult(result)}
                          className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors flex items-start gap-3 border-b border-gray-100 last:border-b-0"
                        >
                          <svg className="w-4 h-4 text-[#4169E1] mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-sm text-gray-700 line-clamp-2">{result.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Map Container */}
                <div className="h-[250px] rounded-xl overflow-hidden border border-gray-200 relative z-0">
                  <MapContainer center={[activeReportData.latitude, activeReportData.longitude]} zoom={15} style={{ height: "100%", width: "100%" }}>
                    <MapUpdater center={[activeReportData.latitude, activeReportData.longitude]} />
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <LocationMarker 
                      position={activeReportData.markerPosition} 
                      onLocationChange={updateActiveReportData}
                    />
                  </MapContainer>
                  <button 
                    onClick={handleGetLocation}
                    className="absolute bottom-4 right-4 z-[400] bg-white text-[#4169E1] px-4 py-2.5 rounded-full shadow-lg hover:bg-gray-50 flex items-center gap-2 text-sm font-bold"
                    title="Use my location"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Use my location
                  </button>
                </div>

                {/* Selected Location Text View */}
                <div className="flex items-center gap-3 p-3 mt-1 bg-[#EDF2FF] border border-[#D1D9FF] rounded-xl shadow-sm">
                  <svg className="w-5 h-5 text-[#4169E1] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <span className="text-sm text-gray-700 font-medium line-clamp-2">{activeReportData.locationName}</span>
                </div>
              </div>

              {/* Photo Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Photo {formData.reportType === "Animal" ? "(Required)" : "(Optional)"}
                </label>
                
                {activeReportData.photoPreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                    {activeReportData.photoPreviews.map((preview, idx) => (
                      <div key={preview} className="relative h-24 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 group">
                        <button
                          type="button"
                          onClick={() => setFullscreenPreview(preview)}
                          className="w-full h-full block"
                          aria-label="View uploaded photo"
                        >
                          <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                        </button>
                        <button 
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-600 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <label className="w-full h-16 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-[#4169E1] transition-colors">
                  <svg className="w-6 h-6 text-[#4169E1] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L28 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-sm font-bold text-[#4169E1]">Upload Photo(s)</span>
                  <input type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
                </label>
              </div>

              {/* Grid: Age & Sex (Conditional) */}
              {formData.reportType === "Individual" && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Approximate Age</label>
                    <input 
                      type="text" 
                      value={formData.approximateAge}
                      onChange={(e) => updateForm("approximateAge", e.target.value)}
                      placeholder="e.g. 30s, 65"
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sex</label>
                    <select 
                      value={formData.sex}
                      onChange={(e) => updateForm("sex", e.target.value)}
                      className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Brief Description *</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => updateForm("description", e.target.value)}
                  placeholder="Physical description, clothing, condition..."
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm min-h-[100px]"
                />
              </div>

              {/* Seen At */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Date & Time Seen</label>
                
                <button 
                  onClick={handleUseCurrentDateTime}
                  className="self-start flex items-center gap-2 px-4 py-2 border border-[#4169E1] text-[#4169E1] rounded-full text-sm font-bold hover:bg-blue-50 transition-colors mb-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Use current date & time
                </button>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </div>
                  <input 
                    type="datetime-local" 
                    value={formData.seenAt}
                    onChange={(e) => updateForm("seenAt", e.target.value)}
                    className="w-full pl-10 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm"
                  />
                </div>
              </div>

              <button 
                onClick={goToStep2}
                className="w-full bg-[#4169E1] hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all text-lg mt-4"
              >
                Next &rarr;
              </button>
            </div>
          )}

          {/* ── STEP 2: Additional Info ─────────────────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Description of Assistance Needed *</label>
                <textarea 
                  value={formData.assistanceDescription}
                  onChange={(e) => updateForm("assistanceDescription", e.target.value)}
                  placeholder="Please describe what kind of assistance is needed (e.g., medical help, food, shelter, etc.)..."
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm min-h-[150px]"
                />
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Your Contact</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  </div>
                  <input 
                    type="tel" 
                    value={formData.contactNumber}
                    onChange={(e) => updateForm("contactNumber", e.target.value)}
                    placeholder="e.g. 0917-000-0000"
                    className="w-full pl-11 p-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:border-[#4169E1] focus:ring-1 focus:ring-[#4169E1] outline-none text-sm"
                  />
                </div>
                <span className="text-[11px] text-gray-400">Only shared with assigned barangay official.</span>
              </div>

              <button 
                onClick={submitReport}
                disabled={isSubmitting}
                className={`w-full text-white font-bold py-4 rounded-xl shadow-md transition-all text-lg mt-8 flex justify-center items-center gap-2 ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#4169E1] hover:bg-blue-700'}`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          )}

          {/* ── STEP 3: Success ─────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-500 py-8">
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-500">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              
              <h2 className="text-2xl font-black text-gray-800 mb-2">Report Submitted!</h2>
              <p className="text-gray-500 text-sm max-w-sm mb-8">
                Your report has been received. A barangay official will review and respond shortly.
              </p>

              <div className="w-full bg-[#EDF2FF] border border-[#D1D9FF] rounded-2xl p-6 mb-8">
                <p className="text-xs font-bold text-[#4169E1] uppercase tracking-widest mb-1">Report ID</p>
                <p className="text-2xl font-black text-[#1A237E]">{reportId}</p>
              </div>

              <p className="text-xs text-gray-400 mb-8 max-w-sm">
                You can track the status of this report under My Reports. You will be notified of any updates.
              </p>

              <button 
                onClick={() => navigate("/home")}
                className="w-full bg-[#4169E1] hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-md transition-all text-lg"
              >
                Back to Home
              </button>
            </div>
          )}

        </div>
      </div>

      {fullscreenPreview && (
        <div
          className="fixed inset-0 z-[70] bg-black flex items-center justify-center p-4"
          onClick={() => setFullscreenPreview(null)}
        >
          <button
            type="button"
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 grid place-items-center"
            aria-label="Close image preview"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={fullscreenPreview}
            alt="Uploaded preview"
            className="max-w-full max-h-[92vh] object-contain rounded-lg shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
