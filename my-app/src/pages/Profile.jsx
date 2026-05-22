import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { uploadImageToCloudinary } from "../utils/cloudinary";
import { CITIES, CITY_BARANGAY_MAP, FIXED_PROVINCE, FIXED_REGION } from "../utils/locations";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function initialsFromName(name) {
  return (name || "Guest")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function buildAddressText(address = {}) {
  const parts = [address.barangay, address.city, address.province].filter(Boolean);
  return parts.length ? parts.join(", ") : "-";
}

function InfoRow({ icon, label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-4 bg-white border border-slate-200 rounded-xl text-left hover:border-[#4169E1]/40 hover:bg-blue-50/30 transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-blue-50 text-[#4169E1] grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-slate-700 truncate">{value || "-"}</p>
      </div>
      <svg className="w-5 h-5 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 5 7 7-7 7" />
      </svg>
    </button>
  );
}

function CreateAccountDialog({ message, onClose, onRegister }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl">
        <h2 className="text-xl font-black text-slate-800 mb-2">Create Account</h2>
        <p className="text-sm text-slate-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 font-bold text-slate-600">
            No
          </button>
          <button onClick={onRegister} className="px-4 py-2 rounded-xl bg-[#4169E1] text-white font-bold">
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}

function ProfileEditModal({ user, profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: profile.fullName || "",
    contactNumber: profile.contactNumber || "",
    email: profile.email || user?.email || "",
    city: profile.address?.city || "",
    barangay: profile.address?.barangay || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const barangays = form.city ? CITY_BARANGAY_MAP[form.city] || [] : [];
  const original = useMemo(
    () => ({
      fullName: profile.fullName || "",
      contactNumber: profile.contactNumber || "",
      email: profile.email || user?.email || "",
      city: profile.address?.city || "",
      barangay: profile.address?.barangay || "",
    }),
    [profile, user]
  );

  const updateForm = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "city" ? { barangay: "" } : {}),
    }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setNotice("");
  };

  const validate = () => {
    const nextErrors = {};
    const nameChanged = form.fullName.trim() !== original.fullName;
    const contactChanged = form.contactNumber.trim() !== original.contactNumber;
    const emailChanged = form.email.trim() !== original.email;
    const addressChanged = form.city !== original.city || form.barangay !== original.barangay;
    const passwordChanged = Boolean(form.newPassword);

    if (!nameChanged && !contactChanged && !emailChanged && !addressChanged && !passwordChanged) {
      setNotice("No changes made.");
      return false;
    }
    if (!form.fullName.trim()) nextErrors.fullName = "Required";
    if (!form.email.trim()) nextErrors.email = "Required";
    else if (!EMAIL_REGEX.test(form.email.trim())) nextErrors.email = "Enter a valid email";
    if (!form.city) nextErrors.city = "Required";
    if (!form.barangay) nextErrors.barangay = "Required";
    if ((emailChanged || passwordChanged) && !form.currentPassword) {
      nextErrors.currentPassword = "Current password required to change email or password";
    }
    if (passwordChanged) {
      if (form.newPassword.length < 6) nextErrors.newPassword = "Min 6 chars";
      if (form.newPassword !== form.confirmPassword) nextErrors.confirmPassword = "Mismatch";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveChanges = async () => {
    if (!validate() || !user) return;

    const fullName = form.fullName.trim();
    const contactNumber = form.contactNumber.trim();
    const email = form.email.trim();
    const emailChanged = email !== original.email;
    const passwordChanged = Boolean(form.newPassword);

    setIsSaving(true);
    setNotice("");

    try {
      if (emailChanged || passwordChanged) {
        const credential = EmailAuthProvider.credential(original.email, form.currentPassword);
        await reauthenticateWithCredential(user, credential);

        if (emailChanged) {
          await verifyBeforeUpdateEmail(user, email);
        }
        if (passwordChanged) {
          await updatePassword(user, form.newPassword);
        }
      }

      const updates = {
        fullName,
        contactNumber,
        email,
        address: {
          city: form.city,
          barangay: form.barangay,
          province: FIXED_PROVINCE,
          region: FIXED_REGION,
        },
        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "users", user.uid), updates);
      onSaved({
        ...profile,
        ...updates,
        updatedAt: new Date(),
      });
      onClose();
      if (emailChanged) {
        alert(`Verification email sent to ${email}.`);
      }
    } catch (error) {
      setNotice(error.message || "Failed to save profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = (field) =>
    `w-full h-12 rounded-xl px-3 text-sm outline-none border bg-slate-50 focus:border-[#4169E1] ${
      errors[field] ? "border-red-400 bg-red-50" : "border-slate-200"
    }`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Profile</p>
            <h2 className="text-lg font-black text-slate-800">Edit Information</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 grid place-items-center" aria-label="Close edit profile">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {notice && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm font-medium text-amber-700">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="sm:col-span-2">
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Full Name</span>
              <input value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} className={inputClass("fullName")} />
              {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
            </label>

            <label>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Contact Number</span>
              <input value={form.contactNumber} onChange={(e) => updateForm("contactNumber", e.target.value)} className={inputClass("contactNumber")} />
            </label>

            <label>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Email</span>
              <input type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} className={inputClass("email")} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </label>

            <label>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Municipality</span>
              <select value={form.city} onChange={(e) => updateForm("city", e.target.value)} className={inputClass("city")}>
                <option value="">Select</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
            </label>

            <label>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Barangay</span>
              <select value={form.barangay} onChange={(e) => updateForm("barangay", e.target.value)} disabled={!form.city} className={`${inputClass("barangay")} disabled:opacity-60`}>
                <option value="">Select</option>
                {barangays.map((barangay) => (
                  <option key={barangay} value={barangay}>{barangay}</option>
                ))}
              </select>
              {errors.barangay && <p className="text-xs text-red-500 mt-1">{errors.barangay}</p>}
            </label>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h3 className="text-sm font-black text-slate-800 mb-1">Security</h3>
            <p className="text-xs text-slate-400 mb-4">Current password is required only when changing email or password.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Current Password</span>
                <input type="password" value={form.currentPassword} onChange={(e) => updateForm("currentPassword", e.target.value)} className={inputClass("currentPassword")} />
                {errors.currentPassword && <p className="text-xs text-red-500 mt-1">{errors.currentPassword}</p>}
              </label>
              <label>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">New Password</span>
                <input type="password" value={form.newPassword} onChange={(e) => updateForm("newPassword", e.target.value)} className={inputClass("newPassword")} />
                {errors.newPassword && <p className="text-xs text-red-500 mt-1">{errors.newPassword}</p>}
              </label>
              <label>
                <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</span>
                <input type="password" value={form.confirmPassword} onChange={(e) => updateForm("confirmPassword", e.target.value)} className={inputClass("confirmPassword")} />
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <button onClick={saveChanges} disabled={isSaving} className="w-full h-12 rounded-xl bg-[#4169E1] text-white font-black disabled:opacity-60 flex items-center justify-center gap-2">
            {isSaving && <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isGuest, setIsGuest] = useState(Boolean(location.state?.is_guest || location.state?.role === "guest"));
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [accountDialogMessage, setAccountDialogMessage] = useState("");
  const [error, setError] = useState("");

  const profileData = profile || {
    fullName: "Guest",
    email: "",
    role: "guest",
    contactNumber: "",
    address: {},
    profilePhotoUrl: "",
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) {
        setIsGuest(true);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        if (snapshot.exists()) {
          setProfile({ id: snapshot.id, ...snapshot.data() });
        } else {
          setError("Account data not found.");
        }
      } catch (loadError) {
        setError("Failed to load profile: " + loadError.message);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const openProtectedAction = (message, action) => {
    if (isGuest || !currentUser) {
      setAccountDialogMessage(message);
      return;
    }
    action();
  };

  const handlePhotoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    setError("");
    try {
      const photoUrl = await uploadImageToCloudinary(file);
      await updateDoc(doc(db, "users", currentUser.uid), {
        profilePhotoUrl: photoUrl,
        updatedAt: serverTimestamp(),
      });
      setProfile((prev) => ({ ...prev, profilePhotoUrl: photoUrl }));
    } catch (uploadError) {
      setError("Upload failed: " + uploadError.message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const logout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    if (currentUser) await signOut(auth);
    navigate("/", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#4169E1]/20 border-t-[#4169E1] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F7FA] w-full pb-20">
      <div className="max-w-4xl mx-auto px-5 pt-8">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
            {error}
          </div>
        )}

        <section className="relative overflow-hidden rounded-3xl bg-[#4169E1] px-6 py-8 text-white shadow-lg">
          <div className="absolute -right-16 -top-20 w-56 h-56 rounded-full bg-white/15" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="relative w-28 h-28 shrink-0">
              {profileData.profilePhotoUrl ? (
                <img src={profileData.profilePhotoUrl} alt="Profile" className="w-28 h-28 rounded-full border-4 border-white object-cover bg-white/20" />
              ) : (
                <div className="w-28 h-28 rounded-full border-4 border-white bg-white/20 grid place-items-center text-3xl font-black">
                  {initialsFromName(profileData.fullName)}
                </div>
              )}
              <button
                onClick={() => openProtectedAction("Create account to edit your profile photo?", () => fileInputRef.current?.click())}
                className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-white text-[#4169E1] shadow-lg grid place-items-center hover:bg-blue-50"
                aria-label="Change profile photo"
              >
                {isUploading ? (
                  <span className="w-5 h-5 border-2 border-[#4169E1]/20 border-t-[#4169E1] rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                  </svg>
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
            </div>

            <div className="min-w-0">
              <h1 className="text-3xl font-black leading-tight break-words">{profileData.fullName || "Guest"}</h1>
              <p className="text-sm font-bold text-white/80 mt-1">
                {(profileData.role || "resident").toUpperCase()} {profileData.address?.city ? `- ${profileData.address.city.toUpperCase()}` : ""}
              </p>
              <p className="text-sm text-white/75 mt-3 max-w-xl">{buildAddressText(profileData.address)}</p>
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-3">
          <InfoRow
            label="Full Name"
            value={profileData.fullName || "Guest"}
            onClick={() => openProtectedAction("Create account to edit your profile?", () => setShowEdit(true))}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a8.25 8.25 0 0 1 15 0" /></svg>}
          />
          <InfoRow
            label="Email"
            value={profileData.email || "-"}
            onClick={() => openProtectedAction("Create account to edit your profile?", () => setShowEdit(true))}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0-9.75 7.5-9.75-7.5" /></svg>}
          />
          <InfoRow
            label="Address"
            value={buildAddressText(profileData.address)}
            onClick={() => openProtectedAction("Create account to edit your profile?", () => setShowEdit(true))}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>}
          />
          <InfoRow
            label="Contact"
            value={profileData.contactNumber || "-"}
            onClick={() => openProtectedAction("Create account to edit your profile?", () => setShowEdit(true))}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106a1.125 1.125 0 0 0-1.173.417l-.97 1.293a1.125 1.125 0 0 1-1.21.38 12.035 12.035 0 0 1-7.143-7.143 1.125 1.125 0 0 1 .38-1.21l1.293-.97a1.125 1.125 0 0 0 .417-1.173L6.963 3.102A1.125 1.125 0 0 0 5.872 2.25H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>}
          />
          <InfoRow
            label="Password"
            value="Change password"
            onClick={() => openProtectedAction("Create account to edit your profile?", () => setShowEdit(true))}
            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 10.5V6.75a4.5 4.5 0 0 0-9 0v3.75m-.75 11.25h10.5A2.25 2.25 0 0 0 19.5 19.5v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>}
          />
        </div>

        <button onClick={logout} className="mt-6 w-full h-13 rounded-xl bg-red-50 border border-red-100 text-red-600 font-black hover:bg-red-100 py-4">
          Log Out
        </button>
      </div>

      {showEdit && currentUser && (
        <ProfileEditModal
          user={currentUser}
          profile={profileData}
          onClose={() => setShowEdit(false)}
          onSaved={setProfile}
        />
      )}

      {accountDialogMessage && (
        <CreateAccountDialog
          message={accountDialogMessage}
          onClose={() => setAccountDialogMessage("")}
          onRegister={() => navigate("/register")}
        />
      )}
    </div>
  );
}
