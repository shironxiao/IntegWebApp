// ── Firebase Configuration ───────────────────────────────────────────────────
// Replace the placeholder values below with your actual Firebase project config.
// You can find these values in the Firebase Console:
//   Project Settings → General → Your apps → Firebase SDK snippet → Config
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                            // ⚠️ Still needed
  authDomain: "projectinteg.firebaseapp.com",
  projectId: "projectinteg",
  storageBucket: "projectinteg.firebasestorage.app",
  messagingSenderId: "882905246954",
  appId: "YOUR_APP_ID",                              // ⚠️ Still needed
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
