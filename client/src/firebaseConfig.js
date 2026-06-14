import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOGLuOuxJ3_uIpmg5nxU8-5d13sNc56lk",
  authDomain: "vet-admin-55453.firebaseapp.com",
  projectId: "vet-admin-55453",
  storageBucket: "vet-admin-55453.firebasestorage.app",
  messagingSenderId: "294077405747",
  appId: "1:294077405747:web:d7cee8a4f00b75d54c6146",
  measurementId: "G-ECQBPTS50Z"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
