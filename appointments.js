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
import { appState, formatDate, todayString, isAdmin, formatTime, addMinutesToTime } from "./state.js";
import { escapeHtml } from "./ui.js";
import { renderDashboard } from "./dashboard.js";
import { renderFamily } from "./family.js";
import { applyDirectoryContactToAppointment } from "./directory.js";
import { notify, confirmAction } from "./notifications.js";

let editingAppointmentId = null;

export function setupAppointmentForm() {
  const driverSelect = document.getElementById("apptDriverSelect");
  const otherWrap = document.getElementById("apptDriverOtherWrap");
  const directorySelect = document.getElementById("apptDirectoryContact");
  const mapleStart = document.getElementById("apptMaplePickupStart");
  const mapleEnd = document.getElementById("apptMaplePickupEnd");
  const returnStart = document.getElementById("apptReturnPickupStart");
  const returnEnd = document.getElementById("apptReturnPickupEnd");
  const cancelButton = document.getElementById("cancelAppointmentEdit");

  if (cancelButton) {
    cancelButton.onclick = cancelEditAppointment;
  }

  if (directorySelect) {
    directorySelect.onchange = () => {
      if (directorySelect.value) applyDirectoryContactToAppointment(directorySelect.value);
    };
  }

  if (driverSelect && otherWrap) {
    driverSelect.onchange = () => {
      const isOther = driverSelect.value === "Other";
      otherWrap.classList.toggle("hidden", !isOther);

      if (!isOther) {
        const otherInput = document.getElementById("apptDriverOther");
        if (otherInput) otherInput.value = "";
      }
    };
  }

  setupThirtyMinuteDefault(mapleStart, mapleEnd);
  setupThirtyMinuteDefault(returnStart, returnEnd);
}

function setupThirtyMinuteDefault(startInput, endInput) {
  if (!startInput || !endInput) return;

  startInput.onchange = () => {
    if (!startInput.value) return;
    if (!endInput.value || endInput.dataset.autoDefault === "true") {
      endInput.value = addMinutesToTime(startInput.value, 30);
      endInput.dataset.autoDefault = "true";
    }
  };

  endInput.oninput = () => {
    endInput.dataset.autoDefault = "false";
  };
}

export async function addAppointment() {
  const user = auth.currentUser;
  if (!user) return alert("You must be logged in to add appointments.");

  const data = getAppointmentFormData(user.email);

  if (!data.person || !data.doctor || !data.date) return alert("Please enter person, doctor/visit details, and date.");
  if (data.driverType === "Other" && !data.driver) return alert("Please enter the other driver or transportation name.");

  const wasEditing = Boolean(editingAppointmentId);

  if (editingAppointmentId) {
    await updateDoc(doc(db, "appointments", editingAppointmentId), {
      ...data,
      updatedBy: user.email,
      updatedAt: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, "appointments"), {
      ...data,
      status: "Scheduled",
      createdBy: user.email,
      createdAt: serverTimestamp()
    });
  }

  clearAppointmentForm();
  await loadAppointments();
  notify(wasEditing ? "Appointment updated." : "Appointment added.");
}

function getAppointmentFormData(userEmail) {
  const driverChoice = document.getElementById("apptDriverSelect").value.trim();
  const driverOther = document.getElementById("apptDriverOther").value.trim();

  return {
    person: document.getElementById("apptPerson").value.trim(),
    appointmentType: document.getElementById("apptType").value.trim(),
    directoryContactId: document.getElementById("apptDirectoryContact").value.trim(),
    doctor: document.getElementById("apptDoctor").value.trim(),
    location: document.getElementById("apptLocation").value.trim(),
    driver: driverChoice === "Other" ? driverOther : driverChoice,
    driverType: driverChoice || "",
    date: document.getElementById("apptDate").value,
    time: document.getElementById("apptTime").value,
    appointmentEndTime: document.getElementById("apptEndTime").value,
    maplePickupStart: document.getElementById("apptMaplePickupStart").value,
    maplePickupEnd: document.getElementById("apptMaplePickupEnd").value,
    returnPickupStart: document.getElementById("apptReturnPickupStart").value,
    returnPickupEnd: document.getElementById("apptReturnPickupEnd").value,
    notes: document.getElementById("apptNotes").value.trim()
  };
}

export async function loadAppointments() {
  const snapshot = await getDocs(collection(db, "appointments"));
  appState.appointments = [];

  snapshot.forEach(docSnap => {
    appState.appointments.push({ id: docSnap.id, ...docSnap.data() });
  });

  appState.appointments.sort((a, b) => `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`));

  renderAppointments();
  renderDashboard();
  renderFamily();
}

export function renderAppointments() {
  const div = document.getElementById("appointments");
  if (!div) return;

  div.innerHTML = appState.appointments.length
    ? appState.appointments.map(a => renderAppointmentCard(a)).join("")
    : "<p>No appointments added yet.</p>";

  setupAppointmentButtons();
}

export function renderAppointmentCard(a, compact = false) {
  const mapleWindow = formatWindow(a.maplePickupStart, a.maplePickupEnd);
  const appointmentWindow = formatWindow(a.time, a.appointmentEndTime);
  const returnWindow = formatWindow(a.returnPickupStart, a.returnPickupEnd);

  return `
    <div class="item ${statusClass(a.status || "Scheduled")}">
      <div class="item-topline">
        <strong>${escapeHtml(a.person)}</strong>
        <span class="pill">${escapeHtml(a.status || "Scheduled")}</span>
      </div>
      <p class="item-title">${escapeHtml(a.appointmentType ? `${a.appointmentType}: ${a.doctor}` : a.doctor)}</p>
      <p>📅 ${formatDate(a.date)}</p>
      ${appointmentWindow ? `<p>⏰ Appointment time: ${escapeHtml(appointmentWindow)}</p>` : ""}
      ${mapleWindow ? `<p>🏠 Maple Ridge pickup: ${escapeHtml(mapleWindow)}</p>` : ""}
      ${returnWindow ? `<p>🚙 Appointment pickup: ${escapeHtml(returnWindow)}</p>` : ""}
      ${a.location ? `<p>📍 ${escapeHtml(a.location)}</p>` : ""}
      ${a.driver ? `<p>🚗 Driver: ${escapeHtml(a.driver)}</p>` : ""}
      ${a.notes && !compact ? `<p>📝 ${escapeHtml(a.notes)}</p>` : ""}
      <small>Added by ${escapeHtml(a.createdBy || "unknown")}</small>
      ${!compact ? `
        <div class="action-row">
          <button data-appt-edit="${a.id}">Edit</button>
          <button data-appt-duplicate="${a.id}">Duplicate</button>
          <button data-appt-status="${a.id}" data-current-status="${escapeHtml(a.status || "Scheduled")}">Next Status</button>
          ${isAdmin() ? `<button class="danger" data-appt-delete="${a.id}">Delete</button>` : ""}
        </div>` : ""}
    </div>
  `;
}

function setupAppointmentButtons() {
  document.querySelectorAll("[data-appt-edit]").forEach(button => {
    button.onclick = () => {
      const appointment = appState.appointments.find(a => a.id === button.getAttribute("data-appt-edit"));
      if (appointment) startEditAppointment(appointment);
    };
  });

  document.querySelectorAll("[data-appt-duplicate]").forEach(button => {
    button.onclick = () => {
      const appointment = appState.appointments.find(a => a.id === button.getAttribute("data-appt-duplicate"));
      if (appointment) startDuplicateAppointment(appointment);
    };
  });

  document.querySelectorAll("[data-appt-delete]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can delete appointments.");
      if (!confirmAction("Delete this appointment?")) return;
      await deleteDoc(doc(db, "appointments", button.getAttribute("data-appt-delete")));
      await loadAppointments();
      notify("Appointment deleted.");
    };
  });

  document.querySelectorAll("[data-appt-status]").forEach(button => {
    button.onclick = async () => {
      const id = button.getAttribute("data-appt-status");
      const current = button.getAttribute("data-current-status");
      const statuses = ["Scheduled", "Picked Up", "At Appointment", "Waiting for Ride", "Returned to Maple Ridge", "Completed", "Cancelled"];
      const currentIndex = statuses.indexOf(current);
      const nextStatus = statuses[(currentIndex + 1) % statuses.length];
      await updateDoc(doc(db, "appointments", id), { status: nextStatus, updatedAt: serverTimestamp() });
      await loadAppointments();
      notify(`Appointment status changed to ${nextStatus}.`);
    };
  });
}

function startEditAppointment(a) {
  editingAppointmentId = a.id;
  setValue("apptPerson", a.person);
  setValue("apptType", a.appointmentType);
  setValue("apptDirectoryContact", a.directoryContactId);
  setValue("apptDoctor", a.doctor);
  setValue("apptLocation", a.location);

  const driverSelect = document.getElementById("apptDriverSelect");
  const driverOther = document.getElementById("apptDriverOther");
  const otherWrap = document.getElementById("apptDriverOtherWrap");
  const driverType = a.driverType || a.driver || "";
  const selectValues = driverSelect ? Array.from(driverSelect.options).map(o => o.value) : [];
  if (driverSelect && selectValues.includes(driverType)) {
    driverSelect.value = driverType;
    if (driverOther) driverOther.value = "";
    if (otherWrap) otherWrap.classList.toggle("hidden", driverType !== "Other");
  } else if (driverSelect && a.driver) {
    driverSelect.value = "Other";
    if (driverOther) driverOther.value = a.driver;
    if (otherWrap) otherWrap.classList.remove("hidden");
  }

  setValue("apptDate", a.date);
  setValue("apptTime", a.time);
  setValue("apptEndTime", a.appointmentEndTime);
  setValue("apptMaplePickupStart", a.maplePickupStart);
  setValue("apptMaplePickupEnd", a.maplePickupEnd);
  setValue("apptReturnPickupStart", a.returnPickupStart);
  setValue("apptReturnPickupEnd", a.returnPickupEnd);
  setValue("apptNotes", a.notes);

  ["apptMaplePickupEnd", "apptReturnPickupEnd"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.dataset.autoDefault = "false";
  });

  const title = document.getElementById("appointmentFormTitle");
  if (title) title.textContent = "Edit appointment";

  const button = document.getElementById("addAppt");
  if (button) button.textContent = "Save Changes";

  const cancelButton = document.getElementById("cancelAppointmentEdit");
  if (cancelButton) cancelButton.classList.remove("hidden");
  document.getElementById("view-appointments")?.scrollIntoView({ behavior: "smooth", block: "start" });
}


function startDuplicateAppointment(a) {
  startEditAppointment(a);
  editingAppointmentId = null;

  ["apptDate", "apptTime", "apptEndTime", "apptMaplePickupStart", "apptMaplePickupEnd", "apptReturnPickupStart", "apptReturnPickupEnd"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      delete el.dataset.autoDefault;
    }
  });

  const title = document.getElementById("appointmentFormTitle");
  if (title) title.textContent = "Duplicate appointment";

  const button = document.getElementById("addAppt");
  if (button) button.textContent = "Save Duplicate";

  notify("Appointment duplicated into the form. Add the new date and times, then save.");
}

export function cancelEditAppointment() {
  clearAppointmentForm();
  notify("Appointment edit cancelled.", "info");
}

function clearAppointmentForm() {
  [
    "apptPerson",
    "apptType",
    "apptDirectoryContact",
    "apptDoctor",
    "apptLocation",
    "apptDriverSelect",
    "apptDriverOther",
    "apptDate",
    "apptTime",
    "apptEndTime",
    "apptMaplePickupStart",
    "apptMaplePickupEnd",
    "apptReturnPickupStart",
    "apptReturnPickupEnd",
    "apptNotes"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      delete el.dataset.autoDefault;
    }
  });

  editingAppointmentId = null;
  const title = document.getElementById("appointmentFormTitle");
  if (title) title.textContent = "Add appointment";

  const button = document.getElementById("addAppt");
  if (button) button.textContent = "Add Appointment";

  const cancelButton = document.getElementById("cancelAppointmentEdit");
  if (cancelButton) cancelButton.classList.add("hidden");

  const otherWrap = document.getElementById("apptDriverOtherWrap");
  if (otherWrap) otherWrap.classList.add("hidden");
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function statusClass(status) {
  return "status-" + String(status || "scheduled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function formatWindow(start, end) {
  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);

  if (startFormatted && endFormatted) return `${startFormatted} - ${endFormatted}`;
  if (startFormatted) return `Starting ${startFormatted}`;
  if (endFormatted) return `By ${endFormatted}`;
  return "";
}

export function getTodaysAppointments() {
  const today = todayString();
  return appState.appointments.filter(a => a.date === today && a.status !== "Cancelled");
}

export function getUpcomingAppointments(limit = 5) {
  const today = todayString();
  return appState.appointments.filter(a => a.date >= today && a.status !== "Cancelled").slice(0, limit);
}

export function getTodaysTransportationItems() {
  const today = todayString();
  const items = [];

  appState.appointments
    .filter(a => a.date === today && a.status !== "Cancelled")
    .forEach(a => {
      const mapleWindow = formatWindow(a.maplePickupStart, a.maplePickupEnd);
      const returnWindow = formatWindow(a.returnPickupStart, a.returnPickupEnd);

      if (mapleWindow) {
        items.push({
          sort: a.maplePickupStart || a.time || "99:99",
          time: mapleWindow,
          label: "Maple Ridge pickup",
          appointment: a
        });
      }

      if (returnWindow) {
        items.push({
          sort: a.returnPickupStart || a.appointmentEndTime || a.time || "99:99",
          time: returnWindow,
          label: "Appointment pickup / return ride",
          appointment: a
        });
      }
    });

  return items.sort((a, b) => String(a.sort).localeCompare(String(b.sort)));
}

export function getWaitingForRideAppointments() {
  return appState.appointments.filter(a =>
    a.status === "Waiting for Ride" ||
    a.status === "Waiting for ride"
  );
}
