// firebase.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ✅ Your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCPBHQCrvC9lNpA74u-Wlu2etcWPmwcN54",
  authDomain: "student-832b1.firebaseapp.com",
  projectId: "student-832b1",
  storageBucket: "student-832b1.firebasestorage.app",
  messagingSenderId: "798785736655",
  appId: "1:798785736655:web:c31a924e3d1199c4860cba",
  measurementId: "G-8RJZM1S9JL"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);

// ✅ Initialize Authentication and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
