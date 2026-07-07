import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
 
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { auth } from "./firebase.js";
import { db } from "./firebase.js";

const provider = new GoogleAuthProvider();

// Your main Google account. This account becomes the first admin automatically.
const BOOTSTRAP_ADMIN_EMAILS = [
  "npringleco@gmail.com"
];

async function getOrCreateUserProfile(user) {
  const email = user.email.toLowerCase();
  const userRef = doc(db, "users", email);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data();
  }

  const isBootstrapAdmin = BOOTSTRAP_ADMIN_EMAILS
    .map(e => e.toLowerCase())
    .includes(email);

  if (isBootstrapAdmin) {
    const newProfile = {
      email,
      name: user.displayName || email,
      role: "admin",
      active: true,
      createdAt: serverTimestamp()
    };

    await setDoc(userRef, newProfile);
    return newProfile;
  }

  return null;
}

export function setupAuth(onLogin, onLogout) {
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
  const unauthorizedLogoutBtn = document.getElementById("unauthorizedLogoutBtn");
  const userEmail = document.getElementById("userEmail");
  const appContent = document.getElementById("appContent");
  const signedOutMessage = document.getElementById("signedOutMessage");
  const unauthorizedMessage = document.getElementById("unauthorizedMessage");
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");

  loginBtn.onclick = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert(error.message);
      console.error(error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  logoutBtn.onclick = logout;
  mobileLogoutBtn.onclick = logout;
  unauthorizedLogoutBtn.onclick = logout;

  onAuthStateChanged(auth, async user => {
    if (user) {
      const profile = await getOrCreateUserProfile(user);

      if (!profile || profile.active !== true) {
        userEmail.textContent = "";
        appContent.classList.add("hidden");
        sidebar.classList.add("hidden");
        menuBtn.classList.add("hidden");
        mobileLogoutBtn.classList.add("hidden");
        signedOutMessage.classList.add("hidden");
        unauthorizedMessage.classList.remove("hidden");

        onLogout();
        return;
      }

      userEmail.textContent = `${profile.name || user.email} (${profile.role})`;
      appContent.classList.remove("hidden");
      sidebar.classList.remove("hidden");
      menuBtn.classList.remove("hidden");
      mobileLogoutBtn.classList.remove("hidden");
      signedOutMessage.classList.add("hidden");
      unauthorizedMessage.classList.add("hidden");

      await onLogin(user, profile);
      return;
    }

    userEmail.textContent = "";
    appContent.classList.add("hidden");
    sidebar.classList.add("hidden");
    menuBtn.classList.add("hidden");
    mobileLogoutBtn.classList.add("hidden");
    signedOutMessage.classList.remove("hidden");
    unauthorizedMessage.classList.add("hidden");

    onLogout();
  });
}
