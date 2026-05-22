// ── Firebase Configuration ───────────────────────────────────────────────────
// Replace the placeholder values below with your actual Firebase project config.
// You can find these values in the Firebase Console:
//   Project Settings → General → Your apps → Firebase SDK snippet → Config
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDIukJv2lJtJ8983GcDb1Q_tb3Qzr6M_CQ",
  authDomain: "projectinteg.firebaseapp.com",
  projectId: "projectinteg",
  storageBucket: "projectinteg.firebasestorage.app",
  messagingSenderId: "882905246954",
  appId: "1:882905246954:web:ad9594a1eaab6c0220fb93",
  measurementId: "G-7TZD5TYP2H"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
