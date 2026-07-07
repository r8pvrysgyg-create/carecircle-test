import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6SWLx-74wjrZMTnfENcsn8DhSjYMsmN4",
  authDomain: "carecircle-a0cfb.firebaseapp.com",
  projectId: "carecircle-a0cfb",
  storageBucket: "carecircle-a0cfb.appspot.com",
  messagingSenderId: "599284379254",
  appId: "1:599284379254:web:07fbf9a971c82cd02e7957"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
