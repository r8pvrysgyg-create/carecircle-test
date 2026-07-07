import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

import { db } from "./firebase.js";
import { appState, APP_VERSION, formatDateTimeSeattle, isAdmin } from "./state.js";
import { escapeHtml } from "./ui.js";
import { notify } from "./notifications.js";

const BACKUP_COLLECTIONS = [
  "appointments",
  "tasks",
  "notes",
  "medications",
  "directory",
  "appointmentTemplates",
  "users"
];

export function setupBackupCenter() {
  const exportBtn = document.getElementById("exportBackupBtn");
  const previewBtn = document.getElementById("refreshBackupSummaryBtn");

  if (exportBtn) exportBtn.onclick = exportCareCircleData;
  if (previewBtn) previewBtn.onclick = renderBackupCenter;
}

export function renderBackupCenter() {
  const adminNotice = document.getElementById("backupAdminNotice");
  const adminTools = document.getElementById("backupAdminTools");
  const summaryDiv = document.getElementById("backupSummary");
  const statusDiv = document.getElementById("backupStatus");

  if (!adminNotice || !adminTools || !summaryDiv) return;

  if (!isAdmin()) {
    adminNotice.classList.remove("hidden");
    adminTools.classList.add("hidden");
    summaryDiv.innerHTML = "";
    if (statusDiv) statusDiv.innerHTML = "";
    return;
  }

  adminNotice.classList.add("hidden");
  adminTools.classList.remove("hidden");

  const counts = getLocalCounts();
  summaryDiv.innerHTML = `
    <div class="backup-summary-grid">
      ${renderBackupCount("Appointments", counts.appointments)}
      ${renderBackupCount("Tasks", counts.tasks)}
      ${renderBackupCount("Notes", counts.notes)}
      ${renderBackupCount("Medications", counts.medications)}
      ${renderBackupCount("Directory", counts.directory)}
      ${renderBackupCount("Quick Appointments", counts.appointmentTemplates)}
      ${renderBackupCount("Users", counts.users)}
    </div>
    <p class="muted small-text">Last local refresh: ${escapeHtml(formatDateTimeSeattle())}</p>
  `;
}

function renderBackupCount(label, count) {
  return `
    <div class="backup-count-card">
      <strong>${escapeHtml(count)}</strong>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function getLocalCounts() {
  return {
    appointments: appState.appointments.length,
    tasks: appState.tasks.length,
    notes: appState.notes.length,
    medications: appState.medications.length,
    directory: appState.directoryContacts.length,
    appointmentTemplates: appState.appointmentTemplates.length,
    users: appState.users.length
  };
}

async function exportCareCircleData() {
  if (!isAdmin()) {
    alert("Only admins can export CareCircle backups.");
    return;
  }

  const statusDiv = document.getElementById("backupStatus");
  if (statusDiv) statusDiv.innerHTML = `<p class="muted">Preparing backup...</p>`;

  try {
    const backup = {
      metadata: {
        appName: "CareCircle",
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        exportedAtSeattle: formatDateTimeSeattle(),
        exportedBy: appState.currentUser?.email || "unknown",
        collections: BACKUP_COLLECTIONS
      },
      data: {}
    };

    for (const collectionName of BACKUP_COLLECTIONS) {
      backup.data[collectionName] = await exportCollection(collectionName);
    }

    downloadBackup(backup);

    const totalRecords = Object.values(backup.data).reduce((sum, records) => sum + records.length, 0);
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="success-box">
          <strong>Backup exported successfully.</strong>
          <p>${escapeHtml(totalRecords)} records included.</p>
          <p class="muted small-text">${escapeHtml(backup.metadata.exportedAtSeattle)}</p>
        </div>
      `;
    }

    notify("Backup exported.");
  } catch (error) {
    console.error("Backup export failed:", error);
    if (statusDiv) {
      statusDiv.innerHTML = `
        <div class="error-box">
          <strong>Backup failed.</strong>
          <p>${escapeHtml(error.message || String(error))}</p>
        </div>
      `;
    }
    alert("Backup failed. Check the browser console for details.");
  }
}

async function exportCollection(collectionName) {
  const snapshot = await getDocs(collection(db, collectionName));
  const records = [];

  snapshot.forEach(docSnap => {
    records.push({
      id: docSnap.id,
      ...normalizeForBackup(docSnap.data())
    });
  });

  records.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return records;
}

function normalizeForBackup(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map(item => normalizeForBackup(item));
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function" && typeof value.seconds === "number") {
      return {
        _type: "firestoreTimestamp",
        seconds: value.seconds,
        nanoseconds: value.nanoseconds || 0,
        iso: value.toDate().toISOString()
      };
    }

    const output = {};
    Object.entries(value).forEach(([key, nestedValue]) => {
      output[key] = normalizeForBackup(nestedValue);
    });
    return output;
  }

  return value;
}

function downloadBackup(backup) {
  const datePart = new Date().toISOString().slice(0, 10);
  const fileName = `carecircle-backup-${datePart}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
