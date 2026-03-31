import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

//Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA43_YNHhL5Jx56B29KAYGqC7W2_Y1U4l0",
  authDomain: "sdu-online-voting-system.firebaseapp.com",
  projectId: "sdu-online-voting-system",
  storageBucket: "sdu-online-voting-system.firebasestorage.app",
  messagingSenderId: "635500042847",
  appId: "1:635500042847:web:8db316aae864d7ddd919ea",
  measurementId: "G-Z619GCH7ZZ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
const analytics = getAnalytics(app);