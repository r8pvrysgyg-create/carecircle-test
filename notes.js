import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { auth, db } from "./firebase.js";
import { appState, isAdmin } from "./state.js";
import { escapeHtml } from "./ui.js";
import { renderDashboard } from "./dashboard.js";
import { renderFamily } from "./family.js";
import { notify } from "./notifications.js";

let editingNoteId = null;

export async function addNote() {
  const user = auth.currentUser;
  if (!user) return alert("You must be logged in to add notes.");

  const input = document.getElementById("noteInput");
  const person = document.getElementById("notePerson").value;
  const text = input.value.trim();

  if (!text) return;

  const wasEditing = Boolean(editingNoteId);

  if (editingNoteId) {
    await updateDoc(doc(db, "notes", editingNoteId), {
      text,
      person,
      updatedBy: user.email,
      updatedAt: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, "notes"), {
      text,
      person,
      author: user.email,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now()
    });
  }

  clearNoteForm();
  await loadNotes();
  notify(wasEditing ? "Note updated." : "Note added.");
}

export async function loadNotes() {
  const snapshot = await getDocs(collection(db, "notes"));
  appState.notes = [];

  snapshot.forEach(docSnap => appState.notes.push({ id: docSnap.id, ...docSnap.data() }));
  appState.notes.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  renderNotes();
  renderDashboard();
  renderFamily();
}

export function renderNotes() {
  const div = document.getElementById("notes");
  if (!div) return;
  div.innerHTML = appState.notes.length ? appState.notes.map(n => renderNoteCard(n)).join("") : "<p>No notes yet.</p>";
  setupNoteButtons();
}

export function renderNoteCard(note, compact = false) {
  return `
    <div class="item note-card">
      <div class="item-topline">
        <strong>${escapeHtml(note.author || "unknown")}</strong>
        ${note.person ? `<span class="pill">${escapeHtml(note.person)}</span>` : ""}
      </div>
      <p>${escapeHtml(note.text)}</p>
      ${!compact ? `<div class="action-row"><button data-note-edit="${note.id}">Edit</button>${isAdmin() ? `<button class="danger" data-note-delete="${note.id}">Delete</button>` : ""}</div>` : ""}
    </div>
  `;
}

function setupNoteButtons() {
  document.querySelectorAll("[data-note-edit]").forEach(button => {
    button.onclick = () => {
      const note = appState.notes.find(n => n.id === button.getAttribute("data-note-edit"));
      if (note) startEditNote(note);
    };
  });

  document.querySelectorAll("[data-note-delete]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can delete notes.");
      if (!confirm("Delete this note?")) return;
      await deleteDoc(doc(db, "notes", button.getAttribute("data-note-delete")));
      await loadNotes();
      notify("Note deleted.");
    };
  });
}


function startEditNote(note) {
  editingNoteId = note.id;
  document.getElementById("notePerson").value = note.person || "";
  document.getElementById("noteInput").value = note.text || "";

  const title = document.getElementById("noteFormTitle");
  if (title) title.textContent = "Edit note";

  const button = document.getElementById("addNote");
  if (button) button.textContent = "Save Changes";

  const cancelButton = document.getElementById("cancelNoteEdit");
  if (cancelButton) cancelButton.classList.remove("hidden");
  document.getElementById("view-notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearNoteForm() {
  editingNoteId = null;
  document.getElementById("noteInput").value = "";
  document.getElementById("notePerson").value = "";
  const title = document.getElementById("noteFormTitle");
  if (title) title.textContent = "Add note";

  const button = document.getElementById("addNote");
  if (button) button.textContent = "Add Note";

  const cancelButton = document.getElementById("cancelNoteEdit");
  if (cancelButton) cancelButton.classList.add("hidden");
}

export function cancelEditNote() {
  clearNoteForm();
  notify("Note edit cancelled.", "info");
}

export function getRecentNotes(limit = 5) {
  return appState.notes.slice(0, limit);
}
