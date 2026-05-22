import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

const FIXED_REGION = "REGION V (Bicol Region)";
const FIXED_PROVINCE = "Camarines Norte";

const CITY_BARANGAY_MAP = {
  "Basud": [
    "Aguit-it", "Backong", "Bagaobawan", "Calangcawan Norte", "Calangcawan Sur",
    "Culayculay", "Dagang", "Gahonon", "Gubat Norte", "Gubat Sur",
    "Ignit", "Kaibigan", "Langa-langa", "Laniton", "Lastic",
    "Mabini", "Manlimonsito", "Matango", "Mocong", "Oloapaen",
    "Ombao Heights", "Ombao Tibang", "Omboy", "Pagsangahan", "Pambuhan",
    "Pinagwarasan", "Plaridel", "Poblacion", "Salvacion", "San Isidro",
    "San Roque", "Santa Rosa Norte", "Santa Rosa Sur", "Taba-taba",
    "Tacad", "Taisan", "Tambongon", "Tenerife", "Yapak"
  ],
  "Capalonga": [
    "Alayao", "Binawangan", "Calabaca", "Calagbagang", "Catabaguangan",
    "Catioan", "Del Pilar", "Gilong", "Guayabo", "Ligñon",
    "Mabini", "Magsaysay", "Mantalongon", "Milagrosa", "Plaridel",
    "Poblacion", "Quirino", "Roosevelt", "Salvacion", "San Antonio",
    "San Francisco", "San Isidro", "Santa Cruz", "Santa Elena",
    "Santa Maria", "Santo Niño", "Sinagapos", "Vista Hermosa"
  ],
  "Daet": [
    "Alawihao", "Awitan", "Bagasbas", "Barangay I (Pob.)", "Barangay II (Pob.)",
    "Barangay III (Pob.)", "Barangay IV (Pob.)", "Barangay V (Pob.)",
    "Barangay VI (Pob.)", "Barangay VII (Pob.)", "Barangay VIII (Pob.)",
    "Bibirao", "Borabod", "Calasgasan", "Camambugan", "Cobangbang (Sto. Niño)",
    "Dogongan", "Garcia", "Gahonon", "Gubat", "Lag-on",
    "Lucrecia", "Magang", "Mancruz (San Juan)", "Pamorangon", "San Isidro"
  ],
  "San Lorenzo Ruiz": [
    "Alegria", "Anahawan", "Anonang", "Bagong Silang", "Calangcawan",
    "Guinabonan", "Iligan", "Inductan", "Km. 891 Pob. (Tulay)",
    "Lamon", "Mabilo I", "Mabilo II", "Nakalaya", "Northern Poblacion",
    "Placer", "Salvacion", "San Antonio", "San Francisco", "San Isidro",
    "San Jose", "San Martin", "San Pedro", "Santa Cruz",
    "Santa Elena", "Santiago", "Southern Poblacion", "Talahib",
    "Talisay", "Tamban", "Tambo", "Tandoc", "Tison"
  ],
  "San Vicente": [
    "Bugtong na Pulo", "Calwit", "Labnig", "Mabini", "Madlawon",
    "Pag-asa", "Poblacion", "San Antonio", "San Francisco",
    "San Isidro", "San Ramon", "Santa Cruz", "Santa Elena",
    "Santo Niño", "Taguilid"
  ],
  "Santa Elena": [
    "Angga", "Bactas", "Binanwaanan", "Bulhao", "Busak",
    "Caawigan", "Caayunan", "Calabaca", "Calagbagang", "Calaocan",
    "Camambugan", "Candawan", "Catabaguangan", "Cataroan", "Caugmayan",
    "Cayucay", "Del Pilar", "Guadalupe", "Hawak", "Itulan",
    "Laniton", "Lastic", "Mabini", "Magsaysay",
    "Manlimonsito", "Matango", "Mocong", "Oloapaen",
    "Pagsangahan", "Pambuhan", "Pinagwarasan", "Plaridel",
    "Poblacion", "Puro", "Salvacion", "San Antonio",
    "San Francisco", "San Isidro", "San Jose", "San Martin",
    "San Miguel", "San Pedro", "San Ramon", "San Roque",
    "Santa Cruz", "Santo Niño", "Tacad",
    "Taisan", "Talisay", "Tambongon", "Tenerife"
  ],
  "Jose Panganiban": [
    "Bagong Bayan", "Calero", "Dahican", "Dayhagan", "Estacion",
    "Lag-on", "Larap", "Loreña", "Luyos", "Mabini",
    "Mabungabon", "Managpi", "Manaringon", "Mercedes", "Napaod",
    "Parang", "Placer", "Poblacion I", "Poblacion II", "Poblacion III",
    "Port Junction Norte", "Port Junction Sur", "Santa Milagrosa",
    "Tacay", "Tambo", "Trinidad", "Viñas", "Wawa"
  ],
  "Labo": [
    "Abella", "Agusigin", "Balangcawan Norte", "Balangcawan Sur", "Balite",
    "Bautista", "Bayabas", "Bena", "Binanuahan East", "Binanuahan West",
    "Bulacan", "Caayunan", "Calibunan", "Camambugan", "Candawan",
    "Capalogan", "Catabaguangan", "Catioan", "Codon", "Colacling",
    "Colomio", "Corucao", "Del Pilar", "Gahonon", "Guadalupe",
    "Guinabonan", "Herrera", "Hoyohoy", "Imelda", "Inauayan",
    "J. Milan (Catanggalan)", "Kaibigan", "Lag-on", "Lictingtung",
    "Ligñon", "Lumbangan", "Luna Norte", "Luna Sur", "Mabini",
    "Mabolo", "Macabug", "Magang", "Magsaysay", "Manuangan",
    "Maria", "Masalong Norte", "Masalong Sur", "Mataque", "Mercedes",
    "Napaod", "Niabonan", "Obaliw Recto", "Ocampo", "Ola Norte",
    "Ola Sur", "Osmeña", "Oyon", "Pag-asa", "Palong",
    "Pancucuran", "Pawili", "Plaridel", "Poblacion", "Pola",
    "Pood", "Quezon", "Quirino", "Roosevelt", "Rosario",
    "Salvacion", "San Antonio Norte", "San Antonio Sur", "San Isidro",
    "San Lorenzo", "San Miguel", "San Pablo Norte", "San Pablo Sur",
    "San Patricio Norte", "San Patricio Sur", "San Ramon",
    "San Vicente", "Santa Cruz", "Sapang Palay", "Sumaoy",
    "Tamban", "Tulay", "Tungmalaong", "Vega", "Villasol"
  ],
  "Mercedes": [
    "Apuao", "Barangay I (Pob.)", "Barangay II (Pob.)", "Barangay III (Pob.)",
    "Barangay IV (Pob.)", "Barangay V (Pob.)", "Barangay VI (Pob.)",
    "Barangay VII (Pob.)", "Boot", "Casagsagan", "Comadaycaday",
    "Comadogcadog", "Daculang Bolo", "Daguit", "Danao",
    "Guayabo", "Himanag", "Lagha", "Lanot", "Lañgon",
    "Libas", "Mabini", "Macolabo Island", "Malinis",
    "Maot", "Masikla", "Matnog", "Mobo", "Nacawit",
    "Pambuhan", "Patag", "Patrol", "Quinapaguian", "Salingogon",
    "Sirangan", "Taba", "Tawig", "Tugos", "Yabo"
  ],
  "Paracale": [
    "Awitan", "Bagumbayan", "Bakal Norte", "Bakal Sur", "Batobalani",
    "Calaburnay", "Capacuan", "Casagsagan", "Caypandan", "Colasi",
    "Gahonon", "Guinabonan", "Jose Panganiban", "Lag-on", "Larap",
    "Luklukan Norte", "Luklukan Sur", "Mabini", "Madlawon",
    "Mananao", "Mancuartira", "Mangkasuy", "Maot", "Masalong",
    "Minalabac", "Nakalaya", "Norte", "Obo", "Pag-asa",
    "Pangarairan", "Peñafrancia", "Poblacion", "Tabugon",
    "Tagas", "Talisay", "Tambong", "Tigbinan", "Tulay Na Lupa"
  ],
  "Talisay": [
    "Bagong Bayan", "Bautista", "Calasag", "Catagbacan", "Codon",
    "Hampas", "Laniton", "Limaong", "Mabini", "Magang",
    "Mataque", "Maugat East", "Maugat West", "Pag-asa", "Poblacion",
    "Salvacion", "San Antonio", "San Isidro", "San Jose",
    "San Miguel", "San Pablo", "San Roque", "Santa Cruz",
    "Santo Niño", "Tapihan", "Tulatula"
  ],
  "Vinzons": [
    "Alaban", "Algaran", "Balagba", "Binobong", "Burabod",
    "Cagbanaba", "Calabagas", "Calangcawan Norte", "Calangcawan Sur",
    "Cawayan Pola", "Cawayan Sapa", "Colasi", "Del Pilar",
    "Gubat Norte", "Gubat Sur", "Himaao", "Indangan",
    "La Purisima", "Labo", "Laga", "Mabini", "Masalong",
    "Maulawin", "Nakalaya", "Pag-asa", "Pambuhan", "Pinit",
    "Pob. I (Barangay I)", "Pob. II (Barangay II)", "Pob. III (Barangay III)",
    "Pob. IV (Barangay IV)", "Potot", "Sabang", "Salvacion",
    "San Antonio", "San Francisco", "San Isidro", "San Jose",
    "San Pascual", "Santa Cruz", "Santo Niño", "Taisan",
    "Tambongon", "Tulay Na Lupa"
  ],
  "Tulay Na Lupa": [
    "Calabasa", "Mabini", "Pag-asa (Pob.)", "Poblacion",
    "San Antonio", "San Francisco", "San Isidro", "San Jose",
    "Santa Cruz", "Santa Elena", "Santo Niño", "Villa Aurora",
    "Villa Hermosa"
  ]
};

const CITIES = Object.keys(CITY_BARANGAY_MAP).sort();
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function Register() {
  const navigate = useNavigate();

  // State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    city: "",
    barangay: "",
    password: "",
    confirmPassword: ""
  });
  
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const nextData = { ...prev, [name]: value };
      if (name === "city") nextData.barangay = ""; // Reset barangay when city changes
      return nextData;
    });
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
  };

  const showToast = (message, type = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: "", type: "" }), 4000);
  };

  const validateInputs = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!EMAIL_REGEX.test(formData.email.trim())) newErrors.email = "Enter a valid email";

    if (!formData.contactNumber.trim()) newErrors.contactNumber = "Contact number is required";
    else if (!/^09\d{9}$/.test(formData.contactNumber.trim())) newErrors.contactNumber = "Enter a valid 11-digit number starting with 09";

    if (!formData.city) newErrors.city = "Please select a city / municipality";
    if (!formData.barangay) newErrors.barangay = "Please select a barangay";

    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 6) newErrors.password = "Password must be at least 6 characters";

    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);

    if (!hasReadTerms) {
      showToast("Please read the Terms and Privacy Policy first.", "error");
      setShowTermsModal(true);
      return false;
    }
    
    if (!termsAccepted) {
      showToast("You must accept the Terms and Privacy Policy to continue.", "error");
      return false;
    }

    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateInputs()) return;

    setIsLoading(true);
    
    try {
      // Create user in Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email.trim(), 
        formData.password
      );
      
      const user = userCredential.user;
      
      // Save user to Firestore
      const address = {
        region: FIXED_REGION,
        province: FIXED_PROVINCE,
        city: formData.city,
        barangay: formData.barangay
      };

      const userDoc = {
        uid: user.uid,
        fullName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        email: formData.email.trim(),
        contactNumber: formData.contactNumber.trim(),
        address: address,
        role: "resident",
        isVerified: false,
        isActive: true,
        profilePhotoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await setDoc(doc(db, "users", user.uid), userDoc);
      
      // Sign out immediately so they have to log in manually
      await signOut(auth);
      
      showToast("Account created successfully! Please log in.", "success");
      setTimeout(() => navigate("/"), 1500);

    } catch (error) {
      console.error("Registration error:", error);
      showToast(error.message || "Registration failed. Please try again.", "error");
      setIsLoading(false);
    }
  };

  const handleTermsCheckbox = () => {
    if (!hasReadTerms) {
      showToast("Please read the Terms and Privacy Policy first.", "error");
      setShowTermsModal(true);
    } else {
      setTermsAccepted(!termsAccepted);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col relative">
      {/* Toast Notification */}
      {toast.message && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white text-sm font-medium transition-all duration-300 animate-slideDown max-w-md text-center ${
            toast.type === "error" ? "bg-red-500/95" : toast.type === "success" ? "bg-emerald-500/95" : "bg-blue-500/95"
          }`}>
          {toast.message}
        </div>
      )}

      {/* Header Section */}
      <div className="px-6 pt-6 pb-2">
        <button 
          onClick={() => navigate("/")}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors mb-2"
          aria-label="Back"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-3xl font-black text-black">Create Account</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24">
        {/* Personal Information Section */}
        <h2 className="text-xs font-bold text-gray-500 mb-2 mt-4 uppercase tracking-wider">Personal Information</h2>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="mb-3">
            <label className="block text-[13px] text-gray-600 mb-1">First Name</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} 
              className={`w-full bg-gray-50 rounded-lg h-12 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.firstName ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`} />
            {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
          </div>

          <div className="mb-3">
            <label className="block text-[13px] text-gray-600 mb-1">Last Name</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} 
              className={`w-full bg-gray-50 rounded-lg h-12 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.lastName ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`} />
            {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
          </div>

          <div className="mb-3">
            <label className="block text-[13px] text-gray-600 mb-1">Email</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} 
              className={`w-full bg-gray-50 rounded-lg h-12 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.email ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`} />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div className="mb-1">
            <label className="block text-[13px] text-gray-600 mb-1">Contact Number</label>
            <input type="tel" name="contactNumber" value={formData.contactNumber} onChange={handleChange} placeholder="09XXXXXXXXX" maxLength="11"
              className={`w-full bg-gray-50 rounded-lg h-12 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.contactNumber ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`} />
            {errors.contactNumber && <p className="text-xs text-red-500 mt-1">{errors.contactNumber}</p>}
          </div>
        </div>

        {/* Address Section */}
        <h2 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Address</h2>
        
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center bg-gray-50 rounded-lg h-12 px-3 border border-gray-200 mb-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="ml-2 text-gray-600 text-sm font-medium">{FIXED_PROVINCE}</span>
          </div>

          <div className="mb-3">
            <label className="block text-[13px] text-gray-600 mb-1">Municipality</label>
            <select name="city" value={formData.city} onChange={handleChange}
              className={`w-full bg-gray-50 rounded-lg h-12 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.city ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`}>
              <option value="" disabled>Select</option>
              {CITIES.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
            {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
          </div>

          <div className="mb-1">
            <label className="block text-[13px] text-gray-600 mb-1">Barangay</label>
            <select name="barangay" value={formData.barangay} onChange={handleChange} disabled={!formData.city}
              className={`w-full bg-gray-50 rounded-lg h-12 px-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50 ${errors.barangay ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`}>
              <option value="" disabled>Select</option>
              {formData.city && CITY_BARANGAY_MAP[formData.city].map(bg => <option key={bg} value={bg}>{bg}</option>)}
            </select>
            {errors.barangay && <p className="text-xs text-red-500 mt-1">{errors.barangay}</p>}
          </div>
        </div>

        {/* Security Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="mb-3 relative">
            <label className="block text-[13px] text-gray-600 mb-1">Password</label>
            <input type={showPassword ? "text" : "password"} name="password" value={formData.password} onChange={handleChange} 
              className={`w-full bg-gray-50 rounded-lg h-12 pl-3 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.password ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute bottom-3 right-3 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={showPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768l4.242 4.242m0 0l3.768 3.768M6.11 6.11L3 3m3.11 3.11l4.242 4.242" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z"} />
                {!showPassword && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
              </svg>
            </button>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div className="mb-1 relative">
            <label className="block text-[13px] text-gray-600 mb-1">Confirm Password</label>
            <input type={showConfirmPassword ? "text" : "password"} name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} 
              className={`w-full bg-gray-50 rounded-lg h-12 pl-3 pr-10 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.confirmPassword ? 'border border-red-500 bg-red-50' : 'border border-gray-200'}`} />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute bottom-3 right-3 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={showConfirmPassword ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.11 6.11m3.768 3.768l4.242 4.242m0 0l3.768 3.768M6.11 6.11L3 3m3.11 3.11l4.242 4.242" : "M15 12a3 3 0 11-6 0 3 3 0 016 0z"} />
                {!showConfirmPassword && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />}
              </svg>
            </button>
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>}
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className="flex items-center mb-8">
          <input type="checkbox" id="terms" checked={termsAccepted} onChange={handleTermsCheckbox} className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500 mr-3" />
          <label htmlFor="terms" className="text-[13px] text-gray-500 select-none">
            I accept the <button type="button" onClick={() => setShowTermsModal(true)} className="text-blue-500 font-bold hover:underline">terms and privacy policy</button>
          </label>
        </div>

        {/* Create Account Button */}
        <button onClick={handleRegister} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium text-base rounded-lg h-14 shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 mb-6">
          {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Create Account"}
        </button>

        {/* Back to Login */}
        <div className="text-center">
          <button onClick={() => navigate("/")} className="text-sm font-medium text-blue-500 hover:text-blue-600 hover:underline">Go back to Menu</button>
        </div>
      </div>

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800">Terms & Privacy Policy</h3>
              <button onClick={() => setShowTermsModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {"Terms of Service\n\nWelcome to StreetAssist. By accessing or using our application, you agree to comply with and be bound by the following Terms of Service:\n\n1. Purpose of Service\nStreetAssist is designed to facilitate the reporting of community and homelessness concerns to relevant local authorities and support services.\n\n2. User Responsibility & Conduct\nYou agree to provide accurate, truthful, and complete information when submitting reports. You are strictly prohibited from submitting fraudulent, misleading, or harassing reports.\n\n3. Intellectual Property & Application Use\nAll content, features, and functionality provided in the StreetAssist application are the exclusive property of the developers and are protected by applicable intellectual property laws.\n\n4. Limitation of Liability\nStreetAssist is provided on an \"as-is\" and \"as-available\" basis. The developers do not guarantee continuous, uninterrupted, or secure access to the application, and reserve the right to modify or terminate services at any time without notice.\n\n5. Agreement to Terms\nBy completing the registration process and checking the agreement box, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service.\n\n──────────────────────────────\n\nPrivacy Policy\n\nYour privacy is of utmost importance to us. This Privacy Policy details how StreetAssist handles your personal information:\n\n1. Information Collection\nTo provide our services, we collect necessary user profile data, including your name, email address, contact number, and registered address.\n\n2. Location and Report Data\nWhen you submit a report, we collect relevant incident details and location data to ensure accurate dispatching and response by community services.\n\n3. Data Utilization & Sharing\nYour collected information is strictly utilized to facilitate community assistance and coordinate with appropriate service providers. We do not sell or share your personal data with third-party marketers.\n\n4. Security and Data Protection\nWe implement robust security measures to protect your personal details from unauthorized access, alteration, or disclosure."}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => { setHasReadTerms(true); setTermsAccepted(true); setShowTermsModal(false); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors">
                I Have Read & Understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
