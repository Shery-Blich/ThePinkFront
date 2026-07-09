import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBo0iI8d8xABO4LFRr6eQ5BOa2lm6-QD2w",
  authDomain: "thepinkfront.firebaseapp.com",
  projectId: "thepinkfront",
  storageBucket: "thepinkfront.firebasestorage.app",
  messagingSenderId: "898409575567",
  appId: "1:898409575567:web:d45b06bddd0d1e76ac2cfa",
  measurementId: "G-5NF55YESH8"
};

const app = initializeApp(firebaseConfig);

export const analytics = getAnalytics(app);