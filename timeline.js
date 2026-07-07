import { appState, formatDate, formatDateLong, formatDateTimeSeattle, formatTime, todayString } from "./state.js";
import { escapeHtml, showView } from "./ui.js";

let timelinePersonFilter = "Everyone";
let timelineRangeFilter = "today";
let timelineSearchText = "";

export function setupTimeline() {
  const personFilter = document.getElementById("timelinePersonFilter");
  const rangeFilter = document.getElementById("timelineRangeFilter");
  const searchInput = document.getElementById("timelineSearch");

  if (personFilter) {
    personFilter.onchange = () => {
      timelinePersonFilter = personFilter.value || "Everyone";
      renderTimeline();
    };
  }

  if (rangeFilter) {
    rangeFilter.onchange = () => {
      timelineRangeFilter = rangeFilter.value || "today";
      renderTimeline();
    };
  }

  if (searchInput) {
    searchInput.oninput = () => {
      timelineSearchText = searchInput.value.trim().toLowerCase();
      renderTimeline();
    };
  }
}

export function renderTimeline() {
  const summaryDiv = document.getElementById("timelineSummary");
  const listDiv = document.getElementById("timelineList");

  if (!summaryDiv || !listDiv) return;

  const events = getTimelineEvents();
  const filtered = filterEvents(events);
  const todayEvents = events.filter(event => isSameDateKey(event.dateKey, todayString()));

  summaryDiv.innerHTML = renderTimelineSummary(todayEvents);

  if (!filtered.length) {
    listDiv.innerHTML = `<p class="muted">No timeline activity found for this filter.</p>`;
    return;
  }

  listDiv.innerHTML = groupEventsByDate(filtered)
    .map(group => `
      <div class="timeline-day-group">
        <h3>${escapeHtml(formatDateLong(group.dateKey))}</h3>
        <div class="timeline-list-inner">
          ${group.events.map(renderTimelineCard).join("")}
        </div>
      </div>
    `)
    .join("");

  setupTimelineButtons();
}

function getTimelineEvents() {
  const events = [];

  appState.appointments.forEach(appointment => {
    const label = appointment.appointmentType || appointment.doctor || "Appointment";
    const person = appointment.person || "";
    const appointmentDetail = `${label}${appointment.date ? ` • ${formatDate(appointment.date)}` : ""}${appointment.time ? ` • ${formatTime(appointment.time)}` : ""}`;

    addEvent(events, {
      type: "appointment",
      icon: "📅",
      title: "Appointment created",
      person,
      details: appointmentDetail,
      by: appointment.createdBy,
      timestamp: appointment.createdAt || appointment.createdAtMs,
      targetView: "appointments"
    });

    addEvent(events, {
      type: "appointment",
      icon: "✏️",
      title: "Appointment updated",
      person,
      details: appointmentDetail,
      by: appointment.updatedBy,
      timestamp: appointment.updatedAt,
      targetView: "appointments"
    });

    if (appointment.status && appointment.status !== "Scheduled") {
      addEvent(events, {
        type: "transportation",
        icon: "🚗",
        title: `Appointment status: ${appointment.status}`,
        person,
        details: appointmentDetail,
        by: appointment.updatedBy || appointment.createdBy,
        timestamp: appointment.updatedAt || appointment.createdAt || appointment.createdAtMs,
        targetView: "appointments"
      });
    }
  });

  appState.tasks.forEach(task => {
    const person = task.person || "";
    addEvent(events, {
      type: "task",
      icon: "✅",
      title: "Task created",
      person,
      details: task.title,
      by: task.createdBy,
      timestamp: task.createdAt || task.createdAtMs,
      targetView: "tasks"
    });

    addEvent(events, {
      type: "task",
      icon: "✏️",
      title: "Task updated",
      person,
      details: task.title,
      by: task.updatedBy,
      timestamp: task.updatedAt,
      targetView: "tasks"
    });

    if (task.completed) {
      addEvent(events, {
        type: "task",
        icon: "☑️",
        title: "Task completed",
        person,
        details: task.title,
        by: task.completedBy,
        timestamp: task.completedAt,
        targetView: "tasks"
      });
    }
  });

  appState.medications.forEach(medication => {
    const person = medication.person || "";
    const details = `${medication.name || "Medication"}${medication.dosage ? ` • ${medication.dosage}` : ""}${medication.schedule ? ` • ${medication.schedule}` : ""}`;

    addEvent(events, {
      type: "medication",
      icon: "💊",
      title: "Medication added",
      person,
      details,
      by: medication.createdBy,
      timestamp: medication.createdAt || medication.createdAtMs,
      targetView: "medications"
    });

    addEvent(events, {
      type: "medication",
      icon: medication.active === false ? "📦" : "✏️",
      title: medication.active === false ? "Medication archived" : "Medication updated",
      person,
      details,
      by: medication.updatedBy,
      timestamp: medication.updatedAt,
      targetView: "medications"
    });
  });

  appState.notes.forEach(note => {
    const person = note.person || "";
    addEvent(events, {
      type: "note",
      icon: "📝",
      title: "Note added",
      person,
      details: truncate(note.text, 120),
      by: note.author,
      timestamp: note.createdAt || note.createdAtMs,
      targetView: "notes"
    });

    addEvent(events, {
      type: "note",
      icon: "✏️",
      title: "Note updated",
      person,
      details: truncate(note.text, 120),
      by: note.updatedBy,
      timestamp: note.updatedAt,
      targetView: "notes"
    });
  });

  appState.directoryContacts.forEach(contact => {
    const linked = Array.isArray(contact.linkedPeople) ? contact.linkedPeople.join(", ") : "";
    addEvent(events, {
      type: "directory",
      icon: "📇",
      title: "Directory contact added",
      person: linked,
      details: contact.name,
      by: contact.createdBy,
      timestamp: contact.createdAt || contact.createdAtMs,
      targetView: "directory"
    });

    addEvent(events, {
      type: "directory",
      icon: "✏️",
      title: "Directory contact updated",
      person: linked,
      details: contact.name,
      by: contact.updatedBy,
      timestamp: contact.updatedAt,
      targetView: "directory"
    });
  });

  appState.appointmentTemplates.forEach(template => {
    addEvent(events, {
      type: "quick",
      icon: "⚡",
      title: "Quick Appointment created",
      person: template.person || "",
      details: template.name,
      by: template.createdBy,
      timestamp: template.createdAt || template.createdAtMs,
      targetView: "quickAppointments"
    });

    addEvent(events, {
      type: "quick",
      icon: "⭐",
      title: "Quick Appointment used",
      person: template.person || "",
      details: template.name,
      by: template.updatedBy || template.createdBy,
      timestamp: template.lastUsedAt,
      targetView: "quickAppointments"
    });

    addEvent(events, {
      type: "quick",
      icon: "✏️",
      title: "Quick Appointment updated",
      person: template.person || "",
      details: template.name,
      by: template.updatedBy,
      timestamp: template.updatedAt,
      targetView: "quickAppointments"
    });
  });

  return events
    .filter(event => event.timestampMs)
    .sort((a, b) => b.timestampMs - a.timestampMs);
}

function addEvent(events, event) {
  const timestampMs = timestampToMs(event.timestamp);
  if (!timestampMs) return;

  events.push({
    ...event,
    timestampMs,
    dateKey: dateKeyFromMs(timestampMs)
  });
}

function timestampToMs(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp === "number") return timestamp;
  if (timestamp.seconds) return timestamp.seconds * 1000;
  if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dateKeyFromMs(ms) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(ms));

  const year = parts.find(part => part.type === "year")?.value;
  const month = parts.find(part => part.type === "month")?.value;
  const day = parts.find(part => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function filterEvents(events) {
  const today = todayString();
  const now = new Date(`${today}T12:00:00`);
  const weekAgo = addDays(now, -7);
  const monthAgo = addDays(now, -31);

  return events.filter(event => {
    if (timelinePersonFilter !== "Everyone") {
      const personText = String(event.person || "").toLowerCase();
      if (!personText.includes(timelinePersonFilter.toLowerCase()) && personText !== "both") return false;
    }

    if (timelineRangeFilter === "today" && event.dateKey !== today) return false;
    if (timelineRangeFilter === "week" && event.timestampMs < weekAgo.getTime()) return false;
    if (timelineRangeFilter === "month" && event.timestampMs < monthAgo.getTime()) return false;

    if (timelineSearchText) {
      const haystack = `${event.title} ${event.person} ${event.details} ${event.by} ${event.type}`.toLowerCase();
      if (!haystack.includes(timelineSearchText)) return false;
    }

    return true;
  });
}

function groupEventsByDate(events) {
  const groups = [];
  const byDate = new Map();

  events.forEach(event => {
    if (!byDate.has(event.dateKey)) {
      byDate.set(event.dateKey, []);
      groups.push({ dateKey: event.dateKey, events: byDate.get(event.dateKey) });
    }
    byDate.get(event.dateKey).push(event);
  });

  return groups;
}

function renderTimelineSummary(todayEvents) {
  const appointments = todayEvents.filter(event => event.type === "appointment").length;
  const transportation = todayEvents.filter(event => event.type === "transportation").length;
  const tasks = todayEvents.filter(event => event.type === "task").length;
  const medications = todayEvents.filter(event => event.type === "medication").length;

  return `
    <div class="timeline-summary-grid">
      <div class="stat-card"><span>${appointments}</span><p>Appointment Events</p></div>
      <div class="stat-card"><span>${transportation}</span><p>Transportation</p></div>
      <div class="stat-card"><span>${tasks}</span><p>Task Events</p></div>
      <div class="stat-card"><span>${medications}</span><p>Medication Events</p></div>
    </div>
  `;
}

function renderTimelineCard(event) {
  return `
    <div class="timeline-card timeline-${escapeHtml(event.type)}">
      <div class="timeline-icon">${escapeHtml(event.icon)}</div>
      <div class="timeline-content">
        <div class="item-topline">
          <strong>${escapeHtml(event.title)}</strong>
          <span class="pill">${escapeHtml(timeFromMs(event.timestampMs))}</span>
        </div>
        ${event.person ? `<p class="timeline-person">${escapeHtml(event.person)}</p>` : ""}
        ${event.details ? `<p>${escapeHtml(event.details)}</p>` : ""}
        <small>${event.by ? `by ${escapeHtml(event.by)}` : "CareCircle activity"}</small>
        ${event.targetView ? `<div class="action-row"><button data-timeline-open="${escapeHtml(event.targetView)}">Open</button></div>` : ""}
      </div>
    </div>
  `;
}

function setupTimelineButtons() {
  document.querySelectorAll("[data-timeline-open]").forEach(button => {
    button.onclick = () => showView(button.getAttribute("data-timeline-open"));
  });
}

function timeFromMs(ms) {
  return formatDateTimeSeattle(new Date(ms)).replace(/^\d{1,2}\/\d{1,2}\/\d{4},\s*/, "");
}

function isSameDateKey(a, b) {
  return String(a || "") === String(b || "");
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function truncate(text, maxLength) {
  const value = String(text || "");
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}
