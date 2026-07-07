import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { db } from "./firebase.js";
import { appState, isAdmin } from "./state.js";
import { escapeHtml } from "./ui.js";

export function setupAdmin() {
  const addUserBtn = document.getElementById("addUserBtn");
  if (!addUserBtn) return;

  addUserBtn.onclick = addApprovedUser;
}

export async function loadAdminPanel() {
  const adminOnlySection = document.getElementById("adminOnlySection");
  const nonAdminSettings = document.getElementById("nonAdminSettings");

  if (!adminOnlySection || !nonAdminSettings) return;

  if (!isAdmin()) {
    adminOnlySection.classList.add("hidden");
    nonAdminSettings.classList.remove("hidden");
    return;
  }

  adminOnlySection.classList.remove("hidden");
  nonAdminSettings.classList.add("hidden");

  await loadUsers();
}

async function addApprovedUser() {
  if (!isAdmin()) {
    alert("Only admins can add family members.");
    return;
  }

  const emailInput = document.getElementById("newUserEmail");
  const nameInput = document.getElementById("newUserName");
  const roleInput = document.getElementById("newUserRole");

  const email = emailInput.value.trim().toLowerCase();
  const name = nameInput.value.trim();
  const role = roleInput.value;

  if (!email || !email.includes("@")) {
    alert("Enter a valid Google email address.");
    return;
  }

  await setDoc(doc(db, "users", email), {
    email,
    name: name || email,
    role,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  emailInput.value = "";
  nameInput.value = "";
  roleInput.value = "family";

  await loadUsers();
}

async function loadUsers() {
  const usersList = document.getElementById("usersList");
  if (!usersList) return;

  const snapshot = await getDocs(collection(db, "users"));
  appState.users = [];

  snapshot.forEach(docSnap => {
    appState.users.push({ id: docSnap.id, ...docSnap.data() });
  });

  appState.users.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));

  usersList.innerHTML = appState.users.length
    ? appState.users.map(renderUser).join("")
    : "<p>No approved users yet.</p>";

  setupUserButtons();
}

function renderUser(user) {
  const roleLabel = user.role === "admin" ? "👑 Admin" : "👤 Family";
  const statusLabel = user.active === false ? "Inactive" : "Active";

  return `
    <div class="item">
      <div class="item-topline">
        <strong>${escapeHtml(user.name || user.email)}</strong>
        <span class="pill">${roleLabel}</span>
      </div>
      <p>${escapeHtml(user.email)}</p>
      <p>Status: <strong>${statusLabel}</strong></p>
      <div class="action-row">
        <button data-user-role="${escapeHtml(user.email)}" data-current-role="${escapeHtml(user.role || "family")}">
          ${user.role === "admin" ? "Make Family" : "Make Admin"}
        </button>
        <button class="danger" data-user-active="${escapeHtml(user.email)}" data-current-active="${user.active !== false}">
          ${user.active === false ? "Reactivate" : "Deactivate"}
        </button>
      </div>
    </div>
  `;
}

function setupUserButtons() {
  document.querySelectorAll("[data-user-role]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can change user roles.");
      const email = button.getAttribute("data-user-role");
      const currentRole = button.getAttribute("data-current-role");
      const nextRole = currentRole === "admin" ? "family" : "admin";

      await updateDoc(doc(db, "users", email), {
        role: nextRole,
        updatedAt: serverTimestamp()
      });

      await loadUsers();
    };
  });

  document.querySelectorAll("[data-user-active]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can activate or deactivate users.");
      const email = button.getAttribute("data-user-active");
      const currentActive = button.getAttribute("data-current-active") === "true";

      await updateDoc(doc(db, "users", email), {
        active: !currentActive,
        updatedAt: serverTimestamp()
      });

      await loadUsers();
    };
  });
}
