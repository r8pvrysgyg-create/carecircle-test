import { setupAuth } from "./auth.js";
import { setupNavigation } from "./ui.js";
import { addNote, loadNotes, cancelEditNote } from "./notes.js";
import { addAppointment, loadAppointments, setupAppointmentForm, cancelEditAppointment } from "./appointments.js";
import { addTask, loadTasks, cancelEditTask } from "./tasks.js";
import { addMedication, loadMedications, cancelEditMedication } from "./medications.js";
import { addDirectoryContact, loadDirectoryContacts, cancelEditDirectoryContact, setupDirectoryFilter } from "./directory.js";
import { renderDashboard } from "./dashboard.js";
import { renderFamily, setupPersonProfiles } from "./family.js";
import { setupSearch } from "./search.js";
import { setupAdmin, loadAdminPanel } from "./admin.js";
import { setupPrintCenter, renderPrintPreview } from "./print.js";
import { appState } from "./state.js";
import { setupNotifications } from "./notifications.js";
import { setupQuickAppointmentManager, loadQuickAppointments } from "./quickAppointments.js";
import { setupCalendarView, renderCalendarView } from "./calendar.js";
import { setupTimeline, renderTimeline } from "./timeline.js";
import { setupBackupCenter, renderBackupCenter } from "./backup.js";

document.getElementById("addNote").onclick = addNote;
document.getElementById("addAppt").onclick = addAppointment;
document.getElementById("addTask").onclick = addTask;
document.getElementById("addMedication").onclick = addMedication;
document.getElementById("addDirectoryContact").onclick = addDirectoryContact;

document.getElementById("cancelAppointmentEdit")?.addEventListener("click", cancelEditAppointment);
document.getElementById("cancelTaskEdit")?.addEventListener("click", cancelEditTask);
document.getElementById("cancelNoteEdit")?.addEventListener("click", cancelEditNote);
document.getElementById("cancelMedicationEdit")?.addEventListener("click", cancelEditMedication);
document.getElementById("cancelDirectoryEdit")?.addEventListener("click", cancelEditDirectoryContact);

setupNavigation();
setupSearch();
setupAdmin();
setupAppointmentForm();
setupPrintCenter();
setupNotifications();
setupDirectoryFilter();
setupQuickAppointmentManager();
setupPersonProfiles();
setupCalendarView();
setupTimeline();
setupBackupCenter();

async function loadEverything(user, profile) {
  appState.currentUser = user;
  appState.currentProfile = profile;

  await loadDirectoryContacts();

  await Promise.all([
    loadAppointments(),
    loadTasks(),
    loadNotes(),
    loadMedications(),
    loadQuickAppointments()
  ]);

  renderDashboard();
  renderFamily();
  renderCalendarView();
  renderTimeline();
  renderBackupCenter();

  if (profile && profile.role === "admin") {
    await loadAdminPanel();
  }

  renderPrintPreview();
}

function clearEverything() {
  appState.currentUser = null;
  appState.currentProfile = null;
  appState.appointments = [];
  appState.tasks = [];
  appState.notes = [];
  appState.medications = [];
  appState.directoryContacts = [];
  appState.users = [];
  appState.appointmentTemplates = [];

  const idsToClear = [
    "appointments",
    "todayAppointments",
    "todayTransportation",
    "waitingForRide",
    "tasks",
    "openTasks",
    "notes",
    "recentNotes",
    "medications",
    "inactiveMedications",
    "refillWatch",
    "dashboardRefillWatch",
    "needsAttention",
    "nextUp",
    "familyGrid",
    "searchResults",
    "adminPanel",
    "grandmaMedications",
    "grandpaMedications",
    "grandmaProfileSummary",
    "grandpaProfileSummary",
    "grandmaTransportation",
    "grandpaTransportation",
    "grandmaContacts",
    "grandpaContacts",
    "directoryContacts",
    "printPreview",
    "quickAppointmentsList",
    "favoriteQuickAppointments",
    "allQuickAppointments",
    "calendarGrid",
    "calendarDayDetails",
    "timelineSummary",
    "timelineList",
    "backupSummary",
    "backupStatus"
  ];

  idsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });
}

setupAuth(
  async (user, profile) => {
    await loadEverything(user, profile);
  },
  () => {
    clearEverything();
  }
);
