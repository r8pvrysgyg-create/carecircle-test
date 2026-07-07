import {
  loadAppointmentTemplates,
  updateAppointmentTemplate,
  deleteAppointmentTemplate,
  createAppointmentTemplate
} from "./appointmentTemplates.js";
import { appState, formatDate, isAdmin } from "./state.js";
import { escapeHtml } from "./ui.js";
import { notify, confirmAction } from "./notifications.js";

let editingTemplateId = null;

export function setupQuickAppointmentManager() {
  const filter = document.getElementById("quickAppointmentSearch");
  const saveButton = document.getElementById("saveQuickTemplate");
  const cancelButton = document.getElementById("cancelQuickTemplateEdit");

  if (filter) {
    filter.oninput = () => renderQuickAppointments();
  }

  if (saveButton) {
    saveButton.onclick = saveQuickTemplateEdit;
  }

  if (cancelButton) {
    cancelButton.onclick = cancelQuickTemplateEdit;
  }
}

export async function loadQuickAppointments() {
  try {
    appState.appointmentTemplates = await loadAppointmentTemplates();
  } catch (error) {
    console.error("Unable to load quick appointments:", error);
    appState.appointmentTemplates = [];
  }

  populateQuickTemplateDirectoryDropdown();
  renderQuickAppointments();
}

export function renderQuickAppointments() {
  const list = document.getElementById("quickAppointmentsList");
  const count = document.getElementById("quickAppointmentsCount");
  const favoritesList = document.getElementById("favoriteQuickAppointments");
  const allList = document.getElementById("allQuickAppointments");

  if (!list || !favoritesList || !allList) return;

  const search = (document.getElementById("quickAppointmentSearch")?.value || "").trim().toLowerCase();
  const templates = (appState.appointmentTemplates || []).filter(template => templateMatchesSearch(template, search));
  const favorites = sortTemplates(templates.filter(template => template.favorite === true));
  const regular = sortTemplates(templates.filter(template => template.favorite !== true));

  if (count) {
    count.textContent = `${templates.length} saved quick appointment${templates.length === 1 ? "" : "s"}`;
  }

  if (!templates.length) {
    list.classList.remove("hidden");
    favoritesList.innerHTML = "";
    allList.innerHTML = `
      <div class="empty-state">
        <h3>No quick appointments found</h3>
        <p>Create one by adding an appointment and checking <strong>Save this appointment as a template</strong>.</p>
      </div>
    `;
    return;
  }

  favoritesList.innerHTML = favorites.length
    ? `
      <h3>⭐ Favorites</h3>
      <div class="template-grid">${favorites.map(renderTemplateCard).join("")}</div>
    `
    : "";

  allList.innerHTML = `
    <h3>All quick appointments</h3>
    ${regular.length ? `<div class="template-grid">${regular.map(renderTemplateCard).join("")}</div>` : `<p class="muted">No non-favorite templates.</p>`}
  `;

  setupTemplateCardButtons();
}

function templateMatchesSearch(template, search) {
  if (!search) return true;

  const haystack = [
    template.name,
    template.person,
    template.appointmentType,
    template.doctor,
    template.location,
    template.preferredDriver,
    template.notes,
    template.transportationNotes
  ].join(" ").toLowerCase();

  return haystack.includes(search);
}

function sortTemplates(templates) {
  return [...templates].sort((a, b) => {
    return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
  });
}

function renderTemplateCard(template) {
  const title = template.name || "Unnamed quick appointment";
  const duration = Number(template.appointmentLengthMinutes || 0);
  const lastUsed = template.lastUsedAt?.seconds
    ? formatDate(new Date(template.lastUsedAt.seconds * 1000).toISOString().slice(0, 10))
    : "Not used yet";
  const usedCount = Number(template.usedCount || 0);

  return `
    <div class="template-card">
      <div class="item-topline">
        <strong>${template.favorite ? "⭐ " : ""}${escapeHtml(title)}</strong>
        ${template.person ? `<span class="pill">${escapeHtml(template.person)}</span>` : ""}
      </div>

      ${template.appointmentType ? `<p class="item-title">${escapeHtml(template.appointmentType)}</p>` : ""}
      ${template.doctor ? `<p>👨‍⚕️ ${escapeHtml(template.doctor)}</p>` : ""}
      ${template.location ? `<p>📍 ${escapeHtml(template.location)}</p>` : ""}
      ${template.preferredDriver ? `<p>🚗 ${escapeHtml(template.preferredDriver)}</p>` : ""}
      ${duration ? `<p>⏱️ ${duration} minutes</p>` : ""}
      ${template.transportationNotes ? `<p>🚐 ${escapeHtml(template.transportationNotes)}</p>` : ""}
      ${template.notes ? `<p>📝 ${escapeHtml(template.notes)}</p>` : ""}

      <small>Used ${usedCount} time${usedCount === 1 ? "" : "s"} • Last used: ${escapeHtml(lastUsed)}</small>

      <div class="action-row">
        <button data-template-edit="${template.id}">Edit</button>
        <button data-template-duplicate="${template.id}">Duplicate</button>
        <button data-template-favorite="${template.id}">${template.favorite ? "Unfavorite" : "Favorite"}</button>
        ${isAdmin() ? `<button class="danger" data-template-delete="${template.id}">Delete</button>` : ""}
      </div>
    </div>
  `;
}

function setupTemplateCardButtons() {
  document.querySelectorAll("[data-template-edit]").forEach(button => {
    button.onclick = () => {
      const template = findTemplate(button.getAttribute("data-template-edit"));
      if (template) startEditTemplate(template);
    };
  });

  document.querySelectorAll("[data-template-duplicate]").forEach(button => {
    button.onclick = async () => {
      const template = findTemplate(button.getAttribute("data-template-duplicate"));
      if (!template) return;

      await createAppointmentTemplate({
        ...template,
        name: `${template.name || "Quick Appointment"} (Copy)`,
        favorite: false
      });

      await loadQuickAppointments();
      notify("Quick appointment duplicated.");
    };
  });

  document.querySelectorAll("[data-template-favorite]").forEach(button => {
    button.onclick = async () => {
      const template = findTemplate(button.getAttribute("data-template-favorite"));
      if (!template) return;

      await updateAppointmentTemplate(template.id, {
        ...template,
        favorite: template.favorite !== true
      });

      await loadQuickAppointments();
      notify(template.favorite ? "Quick appointment removed from favorites." : "Quick appointment marked as favorite.");
    };
  });

  document.querySelectorAll("[data-template-delete]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can delete quick appointments.");
      if (!confirmAction("Delete this quick appointment?")) return;

      await deleteAppointmentTemplate(button.getAttribute("data-template-delete"));
      await loadQuickAppointments();
      notify("Quick appointment deleted.");
    };
  });
}

function findTemplate(templateId) {
  return (appState.appointmentTemplates || []).find(template => template.id === templateId);
}

function startEditTemplate(template) {
  editingTemplateId = template.id;
  populateQuickTemplateDirectoryDropdown();

  setValue("quickTemplateName", template.name);
  setValue("quickTemplatePerson", template.person);
  setValue("quickTemplateType", template.appointmentType);
  setValue("quickTemplateDirectoryContact", template.directoryContactId);
  setValue("quickTemplateDoctor", template.doctor);
  setValue("quickTemplateLocation", template.location);
  setValue("quickTemplateDriver", template.preferredDriver);
  setValue("quickTemplateLength", template.appointmentLengthMinutes || 60);
  setValue("quickTemplateMapleOffset", template.maplePickupOffsetMinutes || 45);
  setValue("quickTemplateReturnOffset", template.returnPickupOffsetMinutes || 30);
  setValue("quickTemplateTransportationNotes", template.transportationNotes);
  setValue("quickTemplateNotes", template.notes);

  const favorite = document.getElementById("quickTemplateFavorite");
  if (favorite) favorite.checked = template.favorite === true;

  const title = document.getElementById("quickAppointmentEditorTitle");
  if (title) title.textContent = "Edit Quick Appointment";

  const editor = document.getElementById("quickAppointmentEditor");
  if (editor) {
    editor.classList.remove("hidden");
    editor.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function saveQuickTemplateEdit() {
  if (!editingTemplateId) return;

  const name = getValue("quickTemplateName");
  if (!name) {
    alert("Please enter a template name.");
    return;
  }

  await updateAppointmentTemplate(editingTemplateId, {
    name,
    person: getValue("quickTemplatePerson"),
    appointmentType: getValue("quickTemplateType"),
    directoryContactId: getValue("quickTemplateDirectoryContact"),
    doctor: getValue("quickTemplateDoctor"),
    location: getValue("quickTemplateLocation"),
    preferredDriver: getValue("quickTemplateDriver"),
    appointmentLengthMinutes: Number(getValue("quickTemplateLength") || 60),
    maplePickupOffsetMinutes: Number(getValue("quickTemplateMapleOffset") || 45),
    returnPickupOffsetMinutes: Number(getValue("quickTemplateReturnOffset") || 30),
    transportationNotes: getValue("quickTemplateTransportationNotes"),
    notes: getValue("quickTemplateNotes"),
    favorite: document.getElementById("quickTemplateFavorite")?.checked === true
  });

  cancelQuickTemplateEdit(false);
  await loadQuickAppointments();
  notify("Quick appointment updated.");
}

function cancelQuickTemplateEdit(showNotice = true) {
  editingTemplateId = null;

  [
    "quickTemplateName",
    "quickTemplatePerson",
    "quickTemplateType",
    "quickTemplateDirectoryContact",
    "quickTemplateDoctor",
    "quickTemplateLocation",
    "quickTemplateDriver",
    "quickTemplateLength",
    "quickTemplateMapleOffset",
    "quickTemplateReturnOffset",
    "quickTemplateTransportationNotes",
    "quickTemplateNotes"
  ].forEach(id => setValue(id, ""));

  const favorite = document.getElementById("quickTemplateFavorite");
  if (favorite) favorite.checked = false;

  const editor = document.getElementById("quickAppointmentEditor");
  if (editor) editor.classList.add("hidden");

  if (showNotice) notify("Quick appointment edit cancelled.", "info");
}

function populateQuickTemplateDirectoryDropdown() {
  const select = document.getElementById("quickTemplateDirectoryContact");
  if (!select) return;

  const contacts = [...(appState.directoryContacts || [])].sort((a, b) =>
    (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase())
  );

  select.innerHTML = `
    <option value="">Directory contact / location optional</option>
    ${contacts.map(contact => `
      <option value="${escapeHtml(contact.id)}">${escapeHtml(contact.name || "Unnamed contact")}</option>
    `).join("")}
  `;
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function getValue(id) {
  return (document.getElementById(id)?.value || "").trim();
}
