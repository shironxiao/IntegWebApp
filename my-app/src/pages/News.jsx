import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { auth, db } from "../firebase";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-2x-red.png",
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const DEFAULT_CENTER = { lat: 14.676, lng: 121.0437 };
const PROOF_KEYS = [
  "proofImages",
  "proofUrls",
  "proofUrl",
  "proofImage",
  "proof",
  "resolutionImages",
  "resolutionImage",
  "evidenceImages",
  "evidenceUrls",
  "evidenceImage",
  "evidenceUrl",
  "evidence",
];

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTimestamp(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function statusStyles(status = "") {
  const lower = status.toLowerCase();
  if (lower.includes("closed")) return "bg-red-50 text-red-600 border-red-100";
  if (lower.includes("resolved") || lower.includes("located")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (lower.includes("progress")) return "bg-blue-50 text-blue-700 border-blue-100";
  return "bg-amber-50 text-amber-700 border-amber-100";
}

function addUrls(urls, value) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => addUrls(urls, item));
    return;
  }
  if (typeof value === "string") {
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => urls.add(item));
  }
}

function extractProofUrls(announcement) {
  const urls = new Set();
  PROOF_KEYS.forEach((key) => addUrls(urls, announcement?.[key]));

  if (Array.isArray(announcement?.statusUpdates)) {
    announcement.statusUpdates.forEach((update) => {
      if (update && typeof update === "object") {
        ["proofUrls", "proofImages", "evidenceUrls", "evidenceImages", "evidence", "proof"].forEach((key) => {
          addUrls(urls, update[key]);
        });
      }
    });
  }

  return Array.from(urls);
}

async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    const data = await response.json();
    return data.display_name || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  } catch {
    return `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
  }
}

function MapCenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center, map]);
  return null;
}

function MapPickerEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

function MapModal({ mode, title, initialPoint, onClose, onSelect }) {
  const [point, setPoint] = useState(initialPoint || DEFAULT_CENTER);
  const isPicker = mode === "picker";

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => alert("Failed to get location: " + error.message)
    );
  };

  useEffect(() => {
    if (isPicker && !initialPoint && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        setPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      });
    }
  }, [initialPoint, isPicker]);

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/80 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[84vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{isPicker ? "Attach location" : "Location"}</p>
            <h2 className="text-lg font-black text-slate-800">{title}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 grid place-items-center" aria-label="Close map">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative flex-1">
          <MapContainer center={[point.lat, point.lng]} zoom={17} className="h-full w-full">
            <MapCenter center={point} />
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[point.lat, point.lng]} />
            {isPicker && <MapPickerEvents onPick={setPoint} />}
          </MapContainer>

          {isPicker && (
            <div className="absolute left-4 right-4 bottom-4 z-[400] flex flex-col sm:flex-row gap-3 sm:justify-end">
              <button onClick={useCurrentLocation} className="px-4 py-3 rounded-xl bg-white text-[#4169E1] font-bold shadow-lg border border-slate-200">
                Use my location
              </button>
              <button onClick={() => onSelect(point)} className="px-5 py-3 rounded-xl bg-[#4169E1] text-white font-bold shadow-lg">
                Select location
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FullscreenImage({ url, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 grid place-items-center" aria-label="Close image">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
      <img src={url} alt="Full view" className="max-w-full max-h-[92vh] object-contain rounded-lg" onClick={(event) => event.stopPropagation()} />
    </div>
  );
}

function ProofDialog({ announcement, onClose, onImageClick }) {
  const urls = extractProofUrls(announcement);

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[88vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-red-500">Case Closed Photos</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 grid place-items-center" aria-label="Close proof photos">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {urls.map((url) => (
              <button key={url} onClick={() => onImageClick(url)} className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hover:border-[#4169E1]">
                <img src={url} alt="Proof" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CreateAccountDialog({ onClose, onRegister }) {
  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/60 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-black text-slate-800 mb-2">Create Account</h2>
        <p className="text-sm text-slate-500 mb-6">Create an account to comment or attach a sighting location.</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold">No</button>
          <button onClick={onRegister} className="px-4 py-2 rounded-xl bg-[#4169E1] text-white font-bold">Yes</button>
        </div>
      </div>
    </div>
  );
}

function CommentsPanel({ announcement, currentUser, isGuest, onGuestAction, onOpenMap }) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [text, setText] = useState("");
  const [attachedLocation, setAttachedLocation] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const isClosed = (announcement.status || "").toLowerCase() === "case closed";

  useEffect(() => {
    let cancelled = false;
    getCountFromServer(collection(db, "announcements", announcement.id, "comments"))
      .then((snapshot) => {
        if (!cancelled) setCount(snapshot.data().count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [announcement.id]);

  useEffect(() => {
    if (!open) return undefined;
    const commentsQuery = query(
      collection(db, "announcements", announcement.id, "comments"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(
      commentsQuery,
      (snapshot) => {
        const next = snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() }));
        setComments(next);
        setCount(next.length);
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsubscribe();
  }, [announcement.id, open]);

  const attachLocation = () => {
    if (isGuest || !currentUser) {
      onGuestAction();
      return;
    }
    onOpenMap(async (point) => {
      const address = await reverseGeocode(point.lat, point.lng);
      setAttachedLocation({ ...point, address });
    });
  };

  const postComment = async () => {
    if (isGuest || !currentUser) {
      onGuestAction();
      return;
    }
    if (!text.trim()) {
      alert("Write something first.");
      return;
    }
    if (!attachedLocation) {
      alert("Please attach a location sighting to your comment.");
      return;
    }

    setIsPosting(true);
    try {
      const userSnap = await getDoc(doc(db, "users", currentUser.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const userName =
        userData.fullName ||
        userData.username ||
        currentUser.displayName ||
        currentUser.email ||
        "Resident";
      const userAvatarUrl = userData.profileImageUrl || userData.profilePhotoUrl || "";

      await addDoc(collection(db, "announcements", announcement.id, "comments"), {
        userId: currentUser.uid,
        userName,
        userAvatarUrl,
        text: text.trim(),
        latitude: attachedLocation.lat,
        longitude: attachedLocation.lng,
        locationAddress: attachedLocation.address,
        timestamp: serverTimestamp(),
      });

      await addDoc(collection(db, "admin_notifications"), {
        title: "New Comment",
        message: `${userName} commented on: ${announcement.title || "Announcement"}`,
        type: "new_comment",
        referenceId: announcement.id,
        createdAt: serverTimestamp(),
        isRead: false,
      });

      setText("");
      setAttachedLocation(null);
    } catch (error) {
      alert("Failed to post comment: " + error.message);
    } finally {
      setIsPosting(false);
    }
  };

  const deleteComment = async (comment) => {
    if (!window.confirm("Are you sure you want to delete this sighting report?")) return;
    await deleteDoc(doc(db, "announcements", announcement.id, "comments", comment.id));
  };

  const startEdit = (comment) => {
    setEditingComment(comment);
    setEditText(comment.text || "");
  };

  const saveEdit = async () => {
    if (!editingComment || !editText.trim()) return;
    await updateDoc(doc(db, "announcements", announcement.id, "comments", editingComment.id), {
      text: editText.trim(),
    });
    setEditingComment(null);
    setEditText("");
  };

  return (
    <div className="border-t border-slate-100">
      <button
        onClick={() => {
          if (!open) setIsLoading(true);
          setOpen((value) => !value);
        }}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-[#4169E1] hover:bg-blue-50/60"
      >
        <span>{open ? "Hide Comments" : "View Comments"}</span>
        {!open && count > 0 && (
          <span className="min-w-6 h-6 px-2 rounded-full bg-red-500 text-white text-xs grid place-items-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="text-xs font-bold text-slate-400 mb-3">{count} {count === 1 ? "Comment" : "Comments"}</div>

          {isLoading ? (
            <div className="py-6 flex justify-center">
              <div className="w-6 h-6 border-4 border-[#4169E1]/20 border-t-[#4169E1] rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No comments yet.</p>
          ) : (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => {
                const isAuthor = currentUser?.uid && comment.userId === currentUser.uid;
                return (
                  <div key={comment.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="flex items-start gap-3">
                      {comment.userAvatarUrl ? (
                        <img src={comment.userAvatarUrl} alt="" className="w-9 h-9 rounded-full object-cover bg-slate-200" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#4169E1]/10 text-[#4169E1] font-black grid place-items-center">
                          {(comment.userName || "R").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="font-bold text-sm text-slate-800">{comment.userName || "Resident"}</p>
                          <p className="text-[11px] text-slate-400">{formatTimestamp(comment.timestamp)}</p>
                        </div>
                        <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{comment.text}</p>
                        {comment.latitude != null && comment.longitude != null && (
                          <button
                            onClick={() => onOpenMap(null, { lat: comment.latitude, lng: comment.longitude }, comment.locationAddress || "Sighting Location")}
                            className="text-xs text-[#4169E1] font-bold mt-2 text-left"
                          >
                            {comment.locationAddress || "View Sighting Location"}
                          </button>
                        )}
                        {isAuthor && !isClosed && (
                          <div className="flex gap-3 mt-3">
                            <button onClick={() => startEdit(comment)} className="text-xs font-bold text-slate-500 hover:text-[#4169E1]">Edit</button>
                            <button onClick={() => deleteComment(comment)} className="text-xs font-bold text-red-500 hover:text-red-600">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isClosed && (
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Write a sighting update..."
                className="w-full min-h-20 resize-none outline-none text-sm text-slate-800 placeholder:text-slate-400"
              />
              {attachedLocation && (
                <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs font-medium text-slate-600">
                  {attachedLocation.address}
                </div>
              )}
              <div className="flex justify-between items-center mt-3">
                <button onClick={attachLocation} className="w-10 h-10 rounded-full bg-blue-50 text-[#4169E1] hover:bg-blue-100 grid place-items-center" title="Attach location">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                </button>
                <button
                  onClick={postComment}
                  disabled={isPosting}
                  className="px-4 py-2 rounded-xl bg-[#4169E1] text-white text-sm font-bold disabled:opacity-60"
                >
                  {isPosting ? "Posting..." : "Send"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {editingComment && (
        <div className="fixed inset-0 z-[75] bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-800 mb-4">Edit Sighting Description</h2>
            <textarea
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
              className="w-full min-h-32 rounded-xl border border-slate-200 p-3 outline-none focus:border-[#4169E1]"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setEditingComment(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold">Cancel</button>
              <button onClick={saveEdit} className="px-4 py-2 rounded-xl bg-[#4169E1] text-white font-bold">Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ announcement, currentUser, isGuest, onGuestAction, onMapRequest, onProofRequest, onImageClick }) {
  const status = announcement.status || "Verified by Police";
  const isClosedOrResolved = /closed|resolved|located/i.test(status);
  const proofUrls = extractProofUrls(announcement);
  const dateTime = [announcement.incidentDate, announcement.incidentTime].filter(Boolean).join(" at ");

  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="relative bg-slate-100">
        {announcement.imageUrl && announcement.imageUrl.startsWith("http") ? (
          <button onClick={() => onImageClick(announcement.imageUrl)} className="block w-full h-56 sm:h-72 bg-slate-100 overflow-hidden">
            <img src={announcement.imageUrl} alt={announcement.title || "Announcement"} className="w-full h-full object-cover" />
          </button>
        ) : (
          <div className="h-40 sm:h-48 grid place-items-center text-slate-300">
            <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 19.5h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Z" />
            </svg>
          </div>
        )}
        <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-black bg-white/95 text-[#4169E1] shadow-sm">
          {announcement.category || "ANNOUNCEMENT"}
        </div>
        <div className={`absolute top-4 right-4 px-3 py-1 rounded-full border text-xs font-black shadow-sm ${statusStyles(status)}`}>
          {status}
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black text-slate-800 leading-tight">{announcement.title || "Untitled announcement"}</h2>
            {announcement.name && <p className="text-sm font-bold text-slate-500 mt-1">Subject: {announcement.name}</p>}
          </div>
          <p className="text-xs font-bold text-slate-400 shrink-0">{announcement.date || formatTimestamp(announcement.timestamp)}</p>
        </div>

        {announcement.subtitle && <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{announcement.subtitle}</p>}

        {(dateTime || announcement.locationAddress) && (
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
            {dateTime && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <svg className="w-4 h-4 mt-0.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                </svg>
                <span>{dateTime}</span>
              </div>
            )}
            {announcement.locationAddress && (
              <button
                onClick={() =>
                  announcement.latitude != null && announcement.longitude != null
                    ? onMapRequest(null, { lat: announcement.latitude, lng: announcement.longitude }, announcement.locationAddress)
                    : null
                }
                className="flex items-start gap-2 text-sm text-left text-slate-600 disabled:cursor-default"
                disabled={announcement.latitude == null || announcement.longitude == null}
              >
                <svg className="w-4 h-4 mt-0.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657 13.414 20.9a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
                <span>{announcement.locationAddress}</span>
              </button>
            )}
          </div>
        )}

        {announcement.contact && (
          <p className="mt-3 text-sm font-bold text-slate-500">Contact: {announcement.contact}</p>
        )}

        {isClosedOrResolved && proofUrls.length > 0 && (
          <button
            onClick={() => onProofRequest(announcement)}
            className="mt-4 w-full rounded-xl border border-red-100 bg-red-50 text-red-600 font-black py-3 hover:bg-red-100"
          >
            View Case Closed Photos
          </button>
        )}
      </div>

      <CommentsPanel
        announcement={announcement}
        currentUser={currentUser}
        isGuest={isGuest}
        onGuestAction={onGuestAction}
        onOpenMap={onMapRequest}
      />
    </article>
  );
}

export default function News() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(null);
  const [isGuest, setIsGuest] = useState(Boolean(location.state?.is_guest || location.state?.role === "guest"));
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [syncError, setSyncError] = useState("");
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const [proofAnnouncement, setProofAnnouncement] = useState(null);
  const [mapState, setMapState] = useState(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) setIsGuest(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const announcementsQuery = query(collection(db, "announcements"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(
      announcementsQuery,
      (snapshot) => {
        setAnnouncements(snapshot.docs.map((snap) => ({ id: snap.id, ...snap.data() })));
        setIsLoading(false);
        setSyncError("");
      },
      (error) => {
        setSyncError("Failed to sync news: " + error.message);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const filteredAnnouncements = useMemo(() => {
    const lower = search.trim().toLowerCase();
    const start = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

    return announcements.filter((announcement) => {
      const matchesSearch =
        !lower ||
        [announcement.title, announcement.name, announcement.locationAddress]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(lower));

      const timestamp = toDate(announcement.timestamp)?.getTime();
      const matchesDate =
        timestamp == null ||
        ((start == null || timestamp >= start) && (end == null || timestamp <= end));

      return matchesSearch && matchesDate;
    });
  }, [announcements, endDate, search, startDate]);

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
  };

  const openMap = (onPick, point, title) => {
    if (onPick) {
      setMapState({ mode: "picker", title: "Pin Sighting Location", point: point || DEFAULT_CENTER, onPick });
      return;
    }
    setMapState({ mode: "view", title: title || "Sighting Location", point: point || DEFAULT_CENTER });
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] w-full pb-20">
      <div className="max-w-4xl mx-auto px-5 pt-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-800">News</h1>
          <p className="text-sm text-slate-500">Community announcements and sighting updates</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-5">
          <div className="relative mb-3">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search news, subject, or location"
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-[#4169E1] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-[#4169E1] text-sm"
              aria-label="Start date"
            />
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-[#4169E1] text-sm"
              aria-label="End date"
            />
            {(startDate || endDate) && (
              <button onClick={clearDateFilter} className="px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200">
                Clear
              </button>
            )}
          </div>
        </div>

        {syncError && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
            {syncError}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-9 h-9 border-4 border-[#4169E1]/20 border-t-[#4169E1] rounded-full animate-spin" />
          </div>
        ) : filteredAnnouncements.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
            <svg className="w-16 h-16 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5A3.375 3.375 0 0 0 10.125 2.25H8.25m0 12.75h7.5M8.25 18h7.5M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <h2 className="text-lg font-black text-slate-700">No announcements found</h2>
            <p className="text-sm text-slate-400 mt-1">Try another search or date range.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {filteredAnnouncements.map((announcement) => (
              <AnnouncementCard
                key={announcement.id}
                announcement={announcement}
                currentUser={currentUser}
                isGuest={isGuest}
                onGuestAction={() => setShowAccountDialog(true)}
                onMapRequest={openMap}
                onProofRequest={setProofAnnouncement}
                onImageClick={setFullscreenImage}
              />
            ))}
          </div>
        )}
      </div>

      {showAccountDialog && (
        <CreateAccountDialog
          onClose={() => setShowAccountDialog(false)}
          onRegister={() => navigate("/register")}
        />
      )}

      {proofAnnouncement && (
        <ProofDialog
          announcement={proofAnnouncement}
          onClose={() => setProofAnnouncement(null)}
          onImageClick={setFullscreenImage}
        />
      )}

      {fullscreenImage && <FullscreenImage url={fullscreenImage} onClose={() => setFullscreenImage(null)} />}

      {mapState && (
        <MapModal
          mode={mapState.mode}
          title={mapState.title}
          initialPoint={mapState.point}
          onClose={() => setMapState(null)}
          onSelect={async (point) => {
            if (mapState.onPick) await mapState.onPick(point);
            setMapState(null);
          }}
        />
      )}
    </div>
  );
}
