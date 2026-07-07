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
import { notify, confirmAction } from "./notifications.js";

const CATEGORY_ICONS = {
  "Doctor": "👨‍⚕️",
  "Specialist": "🩺",
  "Pharmacy": "💊",
  "Care Facility": "🏠",
  "Transportation": "🚐",
  "Family": "👨‍👩‍👧‍👦",
  "Insurance": "🏢",
  "Hospital": "🏥",
  "Other": "📞"
};

let editingDirectoryId = null;

export function setupDirectoryFilter() {
  const filter = document.getElementById("directoryFilter");
  if (!filter) return;
  filter.addEventListener("input", renderDirectoryContacts);
}

export async function addDirectoryContact() {
  const user = auth.currentUser;
  if (!user) return alert("You must be logged in to add directory contacts.");

  const name = getValue("directoryName");
  const category = getValue("directoryCategory");
  const organization = getValue("directoryOrganization");
  const primaryContact = getValue("directoryPrimaryContact");
  const phone = getValue("directoryPhone");
  const extension = getValue("directoryExtension");
  const alternatePhone = getValue("directoryAltPhone");
  const fax = getValue("directoryFax");
  const officeHours = getValue("directoryOfficeHours");
  const email = getValue("directoryEmail");
  const website = getValue("directoryWebsite");
  const street = getValue("directoryStreet");
  const city = getValue("directoryCity");
  const state = getValue("directoryState");
  const zip = getValue("directoryZip");
  const linkedPeople = getLinkedPeople();
  const favorite = Boolean(document.getElementById("directoryFavorite")?.checked);
  const defaultAppointmentType = getValue("directoryDefaultType");
  const defaultLocation = getValue("directoryDefaultLocation");
  const typicalDuration = getValue("directoryTypicalDuration");
  const preferredDriver = getValue("directoryPreferredDriver");
  const transportationNotes = getValue("directoryTransportationNotes");
  const notes = getValue("directoryNotes");

  if (!name) return alert("Please enter a name for this directory contact.");

  const data = {
    name,
    category,
    organization,
    primaryContact,
    phone,
    extension,
    alternatePhone,
    fax,
    officeHours,
    email,
    website,
    street,
    city,
    state,
    zip,
    address: buildAddress({ street, city, state, zip }),
    linkedPeople,
    favorite,
    defaultAppointmentType,
    defaultLocation,
    typicalDuration,
    preferredDriver,
    transportationNotes,
    notes,
    active: true
  };

  const wasEditing = Boolean(editingDirectoryId);

  if (editingDirectoryId) {
    await updateDoc(doc(db, "directory", editingDirectoryId), {
      ...data,
      updatedBy: user.email,
      updatedAt: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, "directory"), {
      ...data,
      createdBy: user.email,
      createdAt: serverTimestamp()
    });
  }

  clearDirectoryForm();
  await loadDirectoryContacts();
  notify(wasEditing ? "Directory contact updated." : "Directory contact added.");
}

export async function loadDirectoryContacts() {
  const snapshot = await getDocs(collection(db, "directory"));
  appState.directoryContacts = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    appState.directoryContacts.push({
      id: docSnap.id,
      ...data,
      address: data.address || buildAddress(data)
    });
  });

  sortDirectoryContacts();
  renderDirectoryContacts();
  populateAppointmentDirectorySelect();
}

export function renderDirectoryContacts() {
  const div = document.getElementById("directoryContacts");
  if (!div) return;

  const filterText = (document.getElementById("directoryFilter")?.value || "").trim().toLowerCase();
  const contacts = getSortedDirectoryContacts().filter(contact => matchesDirectoryFilter(contact, filterText));

  if (!contacts.length) {
    div.innerHTML = filterText ? "<p>No contacts match your search.</p>" : "<p>No directory contacts added yet.</p>";
    return;
  }

  const favorites = contacts.filter(contact => contact.favorite);
  const others = contacts.filter(contact => !contact.favorite);

  div.innerHTML = `
    ${favorites.length ? `<div class="directory-section-heading">⭐ Favorites</div>${favorites.map(renderDirectoryCard).join("")}` : ""}
    ${others.length ? `<div class="directory-section-heading">All Contacts</div>${others.map(renderDirectoryCard).join("")}` : ""}
  `;

  setupDirectoryButtons();
}

function renderDirectoryCard(contact) {
  const phoneLink = cleanPhone(contact.phone);
  const altPhoneLink = cleanPhone(contact.alternatePhone);
  const faxLink = cleanPhone(contact.fax);
  const mapsUrl = getMapsUrl(contact);
  const website = normalizeWebsite(contact.website);
  const mailto = contact.email ? `mailto:${contact.email}` : "";
  const icon = CATEGORY_ICONS[contact.category] || "📞";
  const linkedPeople = Array.isArray(contact.linkedPeople) ? contact.linkedPeople : [];
  const linkedBadges = linkedPeople.length
    ? linkedPeople.map(person => `<span class="person-badge">${person === "Grandma" ? "👵" : person === "Grandpa" ? "👴" : "👤"} ${escapeHtml(person)}</span>`).join("")
    : `<span class="muted">Not linked to a person</span>`;
  const phoneDisplay = formatPhoneWithExt(contact.phone, contact.extension);

  return `
    <div class="item directory-item ${contact.favorite ? "favorite-contact" : ""}">
      <div class="item-topline directory-card-header">
        <strong>${contact.favorite ? "⭐ " : ""}${icon} ${escapeHtml(contact.name)}</strong>
        ${contact.category ? `<span class="pill">${escapeHtml(contact.category)}</span>` : ""}
      </div>

      ${contact.organization ? `<p class="directory-org">🏢 ${escapeHtml(contact.organization)}</p>` : ""}

      <div class="directory-detail-group">
        ${contact.phone ? `<p>☎️ <a href="tel:${escapeHtml(phoneLink)}">${escapeHtml(phoneDisplay)}</a> <button class="mini-copy" data-copy="${escapeHtml(contact.phone)}">Copy</button></p>` : ""}
        ${contact.alternatePhone ? `<p>☎️ Secondary: <a href="tel:${escapeHtml(altPhoneLink)}">${escapeHtml(contact.alternatePhone)}</a> <button class="mini-copy" data-copy="${escapeHtml(contact.alternatePhone)}">Copy</button></p>` : ""}
        ${contact.fax ? `<p>📠 Fax: ${escapeHtml(contact.fax)} <button class="mini-copy" data-copy="${escapeHtml(contact.fax)}">Copy</button></p>` : ""}
        ${contact.primaryContact ? `<p>👤 Primary contact: ${escapeHtml(contact.primaryContact)}</p>` : ""}
        ${contact.officeHours ? `<p>🕒 ${escapeHtml(contact.officeHours)}</p>` : ""}
      </div>

      <div class="directory-detail-group">
        ${contact.email ? `<p>📧 <a href="${escapeHtml(mailto)}">${escapeHtml(contact.email)}</a></p>` : ""}
        ${website ? `<p>🌐 <a href="${escapeHtml(website)}" target="_blank" rel="noopener">${escapeHtml(contact.website || website)}</a></p>` : ""}
        ${contact.address ? `<p>📍 ${escapeHtml(contact.address)} ${mapsUrl ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Open map</a>` : ""}</p>` : ""}
      </div>

      <div class="directory-linked-row">${linkedBadges}</div>

      <div class="directory-detail-group directory-defaults">
        ${contact.defaultAppointmentType ? `<p>📅 Default appointment type: ${escapeHtml(contact.defaultAppointmentType)}</p>` : ""}
        ${contact.typicalDuration ? `<p>⏱️ Typical length: ${escapeHtml(contact.typicalDuration)} minutes</p>` : ""}
        ${contact.preferredDriver ? `<p>🚗 Preferred driver: ${escapeHtml(contact.preferredDriver)}</p>` : ""}
        ${contact.defaultLocation ? `<p>🏥 Default location: ${escapeHtml(contact.defaultLocation)}</p>` : ""}
        ${contact.transportationNotes ? `<p>🚐 Transportation notes: ${escapeHtml(contact.transportationNotes)}</p>` : ""}
        ${contact.notes ? `<p>📝 ${escapeHtml(contact.notes)}</p>` : ""}
      </div>

      <div class="quick-actions">
        ${contact.phone ? `<a class="button-link" href="tel:${escapeHtml(phoneLink)}">Call</a>` : ""}
        ${contact.email ? `<a class="button-link" href="${escapeHtml(mailto)}">Email</a>` : ""}
        ${mapsUrl ? `<a class="button-link" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener">Maps</a>` : ""}
        ${website ? `<a class="button-link" href="${escapeHtml(website)}" target="_blank" rel="noopener">Website</a>` : ""}
      </div>

      <small>Added by ${escapeHtml(contact.createdBy || "unknown")}</small>
      <div class="action-row">
        <button data-directory-edit="${contact.id}">Edit</button>
        ${isAdmin() ? `<button class="danger" data-directory-delete="${contact.id}">Delete</button>` : ""}
      </div>
    </div>
  `;
}

function setupDirectoryButtons() {
  document.querySelectorAll("[data-directory-edit]").forEach(button => {
    button.onclick = () => {
      const contact = appState.directoryContacts.find(c => c.id === button.getAttribute("data-directory-edit"));
      if (contact) startEditDirectoryContact(contact);
    };
  });

  document.querySelectorAll("[data-directory-delete]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can delete directory contacts.");
      if (!confirmAction("Delete this directory contact?")) return;

      await deleteDoc(doc(db, "directory", button.getAttribute("data-directory-delete")));
      await loadDirectoryContacts();
      notify("Directory contact deleted.");
    };
  });

  document.querySelectorAll("[data-copy]").forEach(button => {
    button.onclick = async () => {
      const value = button.getAttribute("data-copy") || "";
      try {
        await navigator.clipboard.writeText(value);
        notify("Copied to clipboard.", "success");
      } catch {
        notify("Copy failed. You can manually select the number.", "info");
      }
    };
  });
}

export function populateAppointmentDirectorySelect() {
  const select = document.getElementById("apptDirectoryContact");
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = `<option value="">Directory contact / location (optional)</option>`;

  const contacts = getSortedDirectoryContacts();

  contacts.forEach(contact => {
    const option = document.createElement("option");
    option.value = contact.id;
    option.textContent = `${contact.favorite ? "⭐ " : ""}${contact.name}${contact.category ? ` - ${contact.category}` : ""}`;
    select.appendChild(option);
  });

  if (currentValue && appState.directoryContacts.some(contact => contact.id === currentValue)) {
    select.value = currentValue;
  }
}

export function getDirectoryContactById(id) {
  return appState.directoryContacts.find(contact => contact.id === id) || null;
}

export function applyDirectoryContactToAppointment(contactId) {
  const contact = getDirectoryContactById(contactId);
  if (!contact) return;

  const typeInput = document.getElementById("apptType");
  const doctorInput = document.getElementById("apptDoctor");
  const locationInput = document.getElementById("apptLocation");
  const notesInput = document.getElementById("apptNotes");
  const endTimeInput = document.getElementById("apptEndTime");
  const startTimeInput = document.getElementById("apptTime");
  const driverSelect = document.getElementById("apptDriverSelect");
  const driverOther = document.getElementById("apptDriverOther");
  const otherWrap = document.getElementById("apptDriverOtherWrap");

  if (typeInput && contact.defaultAppointmentType) typeInput.value = contact.defaultAppointmentType;
  if (doctorInput && contact.name) doctorInput.value = contact.name;

  const location = contact.defaultLocation || contact.address || "";
  if (locationInput && location) locationInput.value = location;

  if (contact.preferredDriver && driverSelect) {
    const values = Array.from(driverSelect.options).map(option => option.value);
    if (values.includes(contact.preferredDriver)) {
      driverSelect.value = contact.preferredDriver;
      if (otherWrap) otherWrap.classList.add("hidden");
      if (driverOther) driverOther.value = "";
    } else {
      driverSelect.value = "Other";
      if (otherWrap) otherWrap.classList.remove("hidden");
      if (driverOther) driverOther.value = contact.preferredDriver;
    }
  }

  if (contact.typicalDuration && startTimeInput?.value && endTimeInput && !endTimeInput.value) {
    endTimeInput.value = addMinutesToTime(startTimeInput.value, Number(contact.typicalDuration));
  }

  const noteParts = [];
  if (contact.phone) noteParts.push(`Phone: ${formatPhoneWithExt(contact.phone, contact.extension)}`);
  if (contact.alternatePhone) noteParts.push(`Secondary phone: ${contact.alternatePhone}`);
  if (contact.fax) noteParts.push(`Fax: ${contact.fax}`);
  if (contact.primaryContact) noteParts.push(`Primary contact: ${contact.primaryContact}`);
  if (contact.officeHours) noteParts.push(`Office hours: ${contact.officeHours}`);
  if (contact.email) noteParts.push(`Email: ${contact.email}`);
  if (contact.transportationNotes) noteParts.push(`Transportation notes: ${contact.transportationNotes}`);
  if (contact.notes) noteParts.push(`Directory notes: ${contact.notes}`);

  if (notesInput && noteParts.length) {
    const existing = notesInput.value.trim();
    const addition = noteParts.join("\n");
    notesInput.value = existing ? `${existing}\n${addition}` : addition;
  }
}

function startEditDirectoryContact(contact) {
  editingDirectoryId = contact.id;
  setValue("directoryName", contact.name);
  setValue("directoryCategory", contact.category);
  setValue("directoryOrganization", contact.organization);
  setValue("directoryPrimaryContact", contact.primaryContact);
  setValue("directoryPhone", contact.phone);
  setValue("directoryExtension", contact.extension);
  setValue("directoryAltPhone", contact.alternatePhone);
  setValue("directoryFax", contact.fax);
  setValue("directoryOfficeHours", contact.officeHours);
  setValue("directoryEmail", contact.email);
  setValue("directoryWebsite", contact.website);
  setValue("directoryStreet", contact.street);
  setValue("directoryCity", contact.city);
  setValue("directoryState", contact.state);
  setValue("directoryZip", contact.zip);
  setValue("directoryDefaultType", contact.defaultAppointmentType);
  setValue("directoryDefaultLocation", contact.defaultLocation);
  setValue("directoryTypicalDuration", contact.typicalDuration);
  setValue("directoryPreferredDriver", contact.preferredDriver);
  setValue("directoryTransportationNotes", contact.transportationNotes);
  setValue("directoryNotes", contact.notes);

  const linkedPeople = Array.isArray(contact.linkedPeople) ? contact.linkedPeople : [];
  setChecked("directoryFavorite", Boolean(contact.favorite));
  setChecked("directoryLinkGrandma", linkedPeople.includes("Grandma"));
  setChecked("directoryLinkGrandpa", linkedPeople.includes("Grandpa"));

  const title = document.getElementById("directoryFormTitle");
  if (title) title.textContent = "Edit directory contact";

  const button = document.getElementById("addDirectoryContact");
  if (button) button.textContent = "Save Changes";

  const cancelButton = document.getElementById("cancelDirectoryEdit");
  if (cancelButton) cancelButton.classList.remove("hidden");
  document.getElementById("view-directory")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearDirectoryForm() {
  [
    "directoryName",
    "directoryCategory",
    "directoryOrganization",
    "directoryPrimaryContact",
    "directoryPhone",
    "directoryExtension",
    "directoryAltPhone",
    "directoryFax",
    "directoryOfficeHours",
    "directoryEmail",
    "directoryWebsite",
    "directoryStreet",
    "directoryCity",
    "directoryState",
    "directoryZip",
    "directoryDefaultType",
    "directoryDefaultLocation",
    "directoryTypicalDuration",
    "directoryPreferredDriver",
    "directoryTransportationNotes",
    "directoryNotes"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["directoryFavorite", "directoryLinkGrandma", "directoryLinkGrandpa"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  editingDirectoryId = null;
  const title = document.getElementById("directoryFormTitle");
  if (title) title.textContent = "Add directory contact";

  const button = document.getElementById("addDirectoryContact");
  if (button) button.textContent = "Add Contact";

  const cancelButton = document.getElementById("cancelDirectoryEdit");
  if (cancelButton) cancelButton.classList.add("hidden");
}

export function cancelEditDirectoryContact() {
  clearDirectoryForm();
  notify("Directory edit cancelled.", "info");
}

function sortDirectoryContacts() {
  appState.directoryContacts.sort(compareDirectoryContacts);
}

function getSortedDirectoryContacts() {
  return [...appState.directoryContacts].sort(compareDirectoryContacts);
}

function compareDirectoryContacts(a, b) {
  if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
  return getSortName(a).localeCompare(getSortName(b), undefined, { sensitivity: "base" });
}

function getSortName(contact) {
  return String(contact.name || contact.organization || "").trim().toLowerCase();
}

function matchesDirectoryFilter(contact, filterText) {
  if (!filterText) return true;
  return [
    contact.name,
    contact.category,
    contact.organization,
    contact.primaryContact,
    contact.phone,
    contact.extension,
    contact.alternatePhone,
    contact.fax,
    contact.officeHours,
    contact.email,
    contact.website,
    contact.address,
    contact.notes,
    contact.defaultAppointmentType,
    contact.defaultLocation,
    contact.preferredDriver,
    contact.transportationNotes,
    ...(Array.isArray(contact.linkedPeople) ? contact.linkedPeople : [])
  ].filter(Boolean).join(" ").toLowerCase().includes(filterText);
}

function formatPhoneWithExt(phone, extension) {
  if (!phone) return "";
  return extension ? `${phone} ext. ${extension}` : phone;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(value);
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function getLinkedPeople() {
  const linked = [];
  if (document.getElementById("directoryLinkGrandma")?.checked) linked.push("Grandma");
  if (document.getElementById("directoryLinkGrandpa")?.checked) linked.push("Grandpa");
  return linked;
}

function buildAddress(contact) {
  if (contact.address) return contact.address;
  return [
    contact.street,
    contact.city,
    [contact.state, contact.zip].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");
}

function getMapsUrl(contact) {
  const address = contact.address || buildAddress(contact);
  if (!address) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function cleanPhone(value) {
  return value ? value.replace(/[^0-9+]/g, "") : "";
}

function normalizeWebsite(value) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return `https://${value}`;
}

function addMinutesToTime(time, minutes) {
  if (!time || !minutes) return "";
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hour, minute + minutes, 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
