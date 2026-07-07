import { appState, formatDate } from "./state.js";
import { escapeHtml, showView } from "./ui.js";

export function setupSearch() {
  const input = document.getElementById("globalSearch");
  const results = document.getElementById("searchResults");

  if (!input || !results) return;

  input.addEventListener("input", () => {
    const term = input.value.trim().toLowerCase();
    if (!term) {
      results.innerHTML = "";
      return;
    }

    const matches = getMatches(term);

    results.innerHTML = matches.length
      ? matches.slice(0, 8).map(renderResult).join("")
      : `<p class="muted">No results found.</p>`;

    document.querySelectorAll("[data-search-jump]").forEach(button => {
      button.onclick = () => showView(button.getAttribute("data-search-jump"));
    });
  });
}

function getMatches(term) {
  const items = [];

  appState.appointments.forEach(a => {
    const blob = `${a.person} ${a.appointmentType} ${a.doctor} ${a.location} ${a.driver} ${a.date} ${a.time} ${a.appointmentEndTime} ${a.maplePickupStart} ${a.maplePickupEnd} ${a.returnPickupStart} ${a.returnPickupEnd} ${a.status} ${a.notes}`.toLowerCase();
    if (blob.includes(term)) {
      items.push({ type: "Appointment", view: "appointments", title: `${a.person || "Appointment"}: ${a.appointmentType ? `${a.appointmentType} - ` : ""}${a.doctor || ""}`, detail: `${formatDate(a.date)} ${a.time || ""}` });
    }
  });

  appState.tasks.forEach(t => {
    const blob = `${t.title} ${t.assignedTo} ${t.dueDate} ${t.person} ${t.notes}`.toLowerCase();
    if (blob.includes(term)) {
      items.push({ type: "Task", view: "tasks", title: t.title || "Task", detail: t.dueDate ? `Due ${formatDate(t.dueDate)}` : "No due date" });
    }
  });

  appState.notes.forEach(n => {
    const blob = `${n.text} ${n.person} ${n.author}`.toLowerCase();
    if (blob.includes(term)) {
      items.push({ type: "Note", view: "notes", title: n.person ? `Note for ${n.person}` : "Family note", detail: n.text || "" });
    }
  });

  appState.medications.forEach(m => {
    const blob = `${m.person} ${m.name} ${m.dosage} ${m.schedule} ${m.doctor} ${m.pharmacy} ${m.instructions} ${m.refillDate}`.toLowerCase();
    if (blob.includes(term)) {
      items.push({ type: "Medication", view: "medications", title: `${m.person || "Medication"}: ${m.name || ""}`, detail: m.refillDate ? `Refill ${formatDate(m.refillDate)}` : (m.schedule || "No schedule") });
    }
  });


  appState.directoryContacts.forEach(c => {
    const blob = `${c.name} ${c.category} ${c.organization} ${c.phone} ${c.alternatePhone} ${c.email} ${c.website} ${c.street} ${c.city} ${c.state} ${c.zip} ${c.address} ${(c.linkedPeople || []).join(" ")} ${c.defaultAppointmentType} ${c.defaultLocation} ${c.typicalDuration} ${c.preferredDriver} ${c.transportationNotes} ${c.notes}`.toLowerCase();
    if (blob.includes(term)) {
      items.push({ type: "Directory", view: "directory", title: `${c.favorite ? "⭐ " : ""}${c.name || "Contact"}${c.category ? ` - ${c.category}` : ""}`, detail: c.phone || c.email || c.address || c.notes || "Directory contact" });
    }
  });

  return items;
}

function renderResult(result) {
  return `
    <div class="search-result">
      <div>
        <span class="pill">${escapeHtml(result.type)}</span>
        <strong>${escapeHtml(result.title)}</strong>
        <p>${escapeHtml(result.detail)}</p>
      </div>
      <button class="secondary" data-search-jump="${result.view}">Open</button>
    </div>
  `;
}
