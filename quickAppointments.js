import { loadAppointmentTemplates } from "./appointmentTemplates.js";
import { appState, formatDate } from "./state.js";
import { escapeHtml } from "./ui.js";

export function setupQuickAppointmentManager() {
  const filter = document.getElementById("quickAppointmentSearch");
  if (!filter) return;

  filter.oninput = () => renderQuickAppointments();
}

export async function loadQuickAppointments() {
  try {
    appState.appointmentTemplates = await loadAppointmentTemplates();
  } catch (error) {
    console.error("Unable to load quick appointments:", error);
    appState.appointmentTemplates = [];
  }

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
    <div class="template-grid">${regular.map(renderTemplateCard).join("")}</div>
  `;
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
      ${template.notes ? `<p>📝 ${escapeHtml(template.notes)}</p>` : ""}

      <small>Last used: ${escapeHtml(lastUsed)}</small>
    </div>
  `;
}
