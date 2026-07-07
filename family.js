import { appState, formatDate, formatTime, todayString } from "./state.js";
import { renderAppointmentCard } from "./appointments.js";
import { renderTaskCard } from "./tasks.js";
import { renderNoteCard } from "./notes.js";
import { getMedicationsForPerson, renderMedicationCard } from "./medications.js";
import { escapeHtml } from "./ui.js";

export function setupPersonProfiles() {
  document.querySelectorAll("[data-profile-tab]").forEach(button => {
    button.onclick = () => {
      const person = button.getAttribute("data-profile-tab");
      showProfile(person);
    };
  });
}

export function renderFamily() {
  renderPerson("Grandma", "grandma");
  renderPerson("Grandpa", "grandpa");
}

function showProfile(person) {
  document.querySelectorAll("[data-profile-tab]").forEach(button => {
    button.classList.toggle("active", button.getAttribute("data-profile-tab") === person);
  });

  document.querySelectorAll(".person-profile").forEach(profile => {
    profile.classList.remove("active");
  });

  const target = document.getElementById(person === "Grandma" ? "profileGrandma" : "profileGrandpa");
  if (target) target.classList.add("active");
}

function renderPerson(person, prefix) {
  const appointments = getPersonAppointments(person);
  const upcomingAppointments = appointments.filter(a => a.date >= todayString()).slice(0, 6);
  const transportation = getPersonTransportation(person).slice(0, 6);
  const tasks = appState.tasks
    .filter(t => matchesPerson(t.person, person) && !t.completed)
    .slice(0, 6);
  const notes = appState.notes
    .filter(n => matchesPerson(n.person, person))
    .slice(0, 6);
  const medications = getMedicationsForPerson(person, 8);
  const contacts = getPersonContacts(person);

  setHtml(`${prefix}ProfileSummary`, renderSummary(person, appointments, transportation, tasks, medications, contacts));
  setHtml(`${prefix}Appointments`, upcomingAppointments.length ? upcomingAppointments.map(a => renderAppointmentCard(a, true)).join("") : "<p>No upcoming appointments.</p>");
  setHtml(`${prefix}Transportation`, transportation.length ? transportation.map(renderTransportationItem).join("") : "<p>No transportation scheduled.</p>");
  setHtml(`${prefix}Tasks`, tasks.length ? tasks.map(t => renderTaskCard(t, true)).join("") : "<p>No open tasks.</p>");
  setHtml(`${prefix}Medications`, medications.length ? medications.map(m => renderMedicationCard(m, true)).join("") : "<p>No medications.</p>");
  setHtml(`${prefix}Notes`, notes.length ? notes.map(n => renderNoteCard(n, true)).join("") : "<p>No notes.</p>");
  setHtml(`${prefix}Contacts`, contacts.length ? contacts.map(renderContactCard).join("") : "<p>No linked contacts.</p>");
}

function getPersonAppointments(person) {
  return appState.appointments
    .filter(a => matchesPerson(a.person, person) && a.status !== "Cancelled")
    .sort((a, b) => `${a.date || ""} ${a.time || ""}`.localeCompare(`${b.date || ""} ${b.time || ""}`));
}

function getPersonTransportation(person) {
  const items = [];

  getPersonAppointments(person)
    .filter(a => a.date >= todayString())
    .forEach(appointment => {
      const mapleWindow = formatWindow(appointment.maplePickupStart, appointment.maplePickupEnd);
      const returnWindow = formatWindow(appointment.returnPickupStart, appointment.returnPickupEnd);

      if (mapleWindow) {
        items.push({
          date: appointment.date,
          sort: `${appointment.date || "9999-99-99"} ${appointment.maplePickupStart || appointment.time || "99:99"}`,
          label: "Maple Ridge pickup",
          time: mapleWindow,
          appointment
        });
      }

      if (returnWindow) {
        items.push({
          date: appointment.date,
          sort: `${appointment.date || "9999-99-99"} ${appointment.returnPickupStart || appointment.appointmentEndTime || appointment.time || "99:99"}`,
          label: "Appointment pickup / return ride",
          time: returnWindow,
          appointment
        });
      }
    });

  return items.sort((a, b) => a.sort.localeCompare(b.sort));
}

function getPersonContacts(person) {
  return (appState.directoryContacts || [])
    .filter(contact => Array.isArray(contact.linkedPeople) && contact.linkedPeople.includes(person))
    .sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase());
    });
}

function renderSummary(person, appointments, transportation, tasks, medications, contacts) {
  const today = todayString();
  const todayAppointments = appointments.filter(a => a.date === today).length;
  const todayTransportation = transportation.filter(item => item.date === today).length;

  return `
    <div class="profile-stat">
      <strong>${todayAppointments}</strong>
      <span>Today</span>
    </div>
    <div class="profile-stat">
      <strong>${appointments.filter(a => a.date >= today).length}</strong>
      <span>Upcoming</span>
    </div>
    <div class="profile-stat">
      <strong>${todayTransportation}</strong>
      <span>Rides today</span>
    </div>
    <div class="profile-stat">
      <strong>${tasks.length}</strong>
      <span>Open tasks</span>
    </div>
    <div class="profile-stat">
      <strong>${medications.length}</strong>
      <span>Active meds</span>
    </div>
    <div class="profile-stat">
      <strong>${contacts.length}</strong>
      <span>Contacts</span>
    </div>
  `;
}

function renderTransportationItem(item) {
  const appointment = item.appointment || {};
  return `
    <div class="item compact-item">
      <div class="item-topline">
        <strong>${escapeHtml(item.label)}</strong>
        <span class="pill">${escapeHtml(formatDate(item.date))}</span>
      </div>
      <p>🕒 ${escapeHtml(item.time)}</p>
      ${appointment.doctor ? `<p>📅 ${escapeHtml(appointment.appointmentType ? `${appointment.appointmentType}: ${appointment.doctor}` : appointment.doctor)}</p>` : ""}
      ${appointment.driver ? `<p>🚗 Driver: ${escapeHtml(appointment.driver)}</p>` : ""}
    </div>
  `;
}

function renderContactCard(contact) {
  const phone = contact.extension ? `${contact.phone || ""} ext. ${contact.extension}` : contact.phone;
  const category = contact.category ? `<span class="pill">${escapeHtml(contact.category)}</span>` : "";
  const favorite = contact.favorite ? "⭐ " : "";
  const tel = cleanPhone(contact.phone);
  const address = contact.address || [contact.street, contact.city, contact.state, contact.zip].filter(Boolean).join(", ");
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : "";

  return `
    <div class="item compact-item directory-profile-contact">
      <div class="item-topline">
        <strong>${favorite}${escapeHtml(contact.name || "Unnamed contact")}</strong>
        ${category}
      </div>
      ${contact.organization ? `<p>🏢 ${escapeHtml(contact.organization)}</p>` : ""}
      ${contact.primaryContact ? `<p>👤 ${escapeHtml(contact.primaryContact)}</p>` : ""}
      ${contact.phone ? `<p>☎️ <a href="tel:${escapeHtml(tel)}">${escapeHtml(phone)}</a></p>` : ""}
      ${contact.alternatePhone ? `<p>☎️ Secondary: ${escapeHtml(contact.alternatePhone)}</p>` : ""}
      ${contact.email ? `<p>📧 <a href="mailto:${escapeHtml(contact.email)}">${escapeHtml(contact.email)}</a></p>` : ""}
      ${mapsUrl ? `<p>📍 <a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Open map</a></p>` : ""}
    </div>
  `;
}

function formatWindow(start, end) {
  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);

  if (startFormatted && endFormatted) return `${startFormatted} - ${endFormatted}`;
  if (startFormatted) return `Starting ${startFormatted}`;
  if (endFormatted) return `By ${endFormatted}`;
  return "";
}

function matchesPerson(value, person) {
  return value === person || value === "Both";
}

function setHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function cleanPhone(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}
