import { appState, formatDate, todayString, formatTime } from "./state.js";
import { getTodaysAppointments, getUpcomingAppointments, renderAppointmentCard, getTodaysTransportationItems, getWaitingForRideAppointments } from "./appointments.js";
import { getOpenTasks, renderTaskCard } from "./tasks.js";
import { getRecentNotes, renderNoteCard } from "./notes.js";
import { getActiveMedications, getRefillWatch, renderMedicationCard } from "./medications.js";
import { escapeHtml, showView } from "./ui.js";

export function renderDashboard() {
  const todayDiv = document.getElementById("todayAppointments");
  const upcomingDiv = document.getElementById("upcomingAppointments");
  const openTasksDiv = document.getElementById("openTasks");
  const recentNotesDiv = document.getElementById("recentNotes");
  const activityFeed = document.getElementById("activityFeed");
  const refillWatch = document.getElementById("dashboardRefillWatch");
  const needsAttention = document.getElementById("needsAttention");
  const nextUp = document.getElementById("nextUp");
  const todayTransportation = document.getElementById("todayTransportation");
  const waitingForRide = document.getElementById("waitingForRide");

  if (!todayDiv || !upcomingDiv || !openTasksDiv || !recentNotesDiv) return;

  const todays = getTodaysAppointments();
  const upcoming = getUpcomingAppointments(5);
  const openTasks = getOpenTasks(5);
  const recentNotes = getRecentNotes(5);
  const refillMeds = getRefillWatch(5);
  const attentionItems = getAttentionItems();
  const nextUpItems = getNextUpItems();
  const transportationItems = getTodaysTransportationItems();
  const waitingRideItems = getWaitingForRideAppointments();

  todayDiv.innerHTML = todays.length ? todays.map(a => renderAppointmentCard(a, true)).join("") : "<p>No appointments today.</p>";
  upcomingDiv.innerHTML = upcoming.length ? upcoming.map(a => renderAppointmentCard(a, true)).join("") : "<p>No upcoming appointments.</p>";
  openTasksDiv.innerHTML = openTasks.length ? openTasks.map(t => renderTaskCard(t, true)).join("") : "<p>No open tasks.</p>";
  recentNotesDiv.innerHTML = recentNotes.length ? recentNotes.map(n => renderNoteCard(n, true)).join("") : "<p>No recent notes.</p>";

  setText("statToday", todays.length);
  setText("statUpcoming", upcoming.length);
  setText("statOpenTasks", appState.tasks.filter(t => !t.completed).length);
  setText("statNotes", appState.notes.length);
  setText("statMedications", getActiveMedications().length);

  if (refillWatch) refillWatch.innerHTML = refillMeds.length ? refillMeds.map(m => renderMedicationCard(m, true)).join("") : "<p>No refills due soon.</p>";
  if (activityFeed) activityFeed.innerHTML = renderActivityFeed();
  if (needsAttention) needsAttention.innerHTML = attentionItems.length ? attentionItems.map(renderAlertItem).join("") : "<p>No urgent items right now.</p>";
  if (nextUp) nextUp.innerHTML = nextUpItems.length ? nextUpItems.map(renderAlertItem).join("") : "<p>Nothing coming up tomorrow.</p>";
  if (todayTransportation) todayTransportation.innerHTML = transportationItems.length ? transportationItems.map(renderTransportationItem).join("") : "<p>No transportation windows today.</p>";
  if (waitingForRide) waitingForRide.innerHTML = waitingRideItems.length ? waitingRideItems.map(a => renderAppointmentCard(a, true)).join("") : "<p>No one is marked as waiting for a ride.</p>";

  updateNavBadges(attentionItems);
  setupDashboardJumpButtons();
}

function setupDashboardJumpButtons() {
  document.querySelectorAll("#view-dashboard [data-jump]").forEach(button => {
    button.onclick = () => showView(button.getAttribute("data-jump"));
  });
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function updateNavBadges(attentionItems) {
  const today = todayString();
  const appointmentsCount = appState.appointments.filter(a => a.date >= today && a.status !== "Cancelled").length;
  const tasksCount = appState.tasks.filter(t => !t.completed).length;
  const refillCount = getRefillWatch(99).length;
  const dashboardCount = attentionItems.length;

  setBadge("badgeDashboard", dashboardCount);
  setBadge("badgeAppointments", appointmentsCount);
  setBadge("badgeTasks", tasksCount);
  setBadge("badgeMedications", refillCount);
}

function setBadge(id, count) {
  const badge = document.getElementById(id);
  if (!badge) return;
  badge.textContent = count;
  badge.classList.toggle("hidden", count <= 0);
}

function getAttentionItems() {
  const items = [];
  const today = todayString();

  appState.tasks
    .filter(t => !t.completed && t.dueDate && t.dueDate < today)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .forEach(t => {
      items.push({
        icon: "⚠️",
        title: t.title || "Overdue task",
        detail: `${t.person ? `${t.person} • ` : ""}Due ${formatDate(t.dueDate)}${t.assignedTo ? ` • Assigned: ${t.assignedTo}` : ""}`,
        severity: "danger",
        view: "tasks"
      });
    });

  appState.medications
    .filter(m => m.active !== false && m.refillDate)
    .filter(m => daysUntil(m.refillDate) !== null && daysUntil(m.refillDate) <= 7)
    .sort((a, b) => (a.refillDate || "").localeCompare(b.refillDate || ""))
    .forEach(m => {
      const days = daysUntil(m.refillDate);
      items.push({
        icon: days < 0 ? "🔴" : "🟡",
        title: `${m.person || "Medication"}: ${m.name || "Medication"}`,
        detail: days < 0
          ? `Refill overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
          : days === 0
            ? "Refill due today"
            : `Refill due in ${days} day${days === 1 ? "" : "s"}`,
        severity: days < 0 ? "danger" : "warning",
        view: "medications"
      });
    });

  return items.slice(0, 8);
}

function getNextUpItems() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowString = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(tomorrow);

  const items = [];

  appState.appointments
    .filter(a => a.date === tomorrowString && a.status !== "Cancelled")
    .forEach(a => {
      items.push({
        icon: "📅",
        title: `${a.person || "Appointment"}: ${a.doctor || "Appointment"}`,
        detail: `Tomorrow ${formatTime(a.time)}${a.driver ? ` • Driver: ${a.driver}` : ""}`,
        severity: "info",
        view: "appointments"
      });
    });

  appState.tasks
    .filter(t => !t.completed && t.dueDate === tomorrowString)
    .forEach(t => {
      items.push({
        icon: "✅",
        title: t.title || "Task",
        detail: `${t.person ? `${t.person} • ` : ""}Due tomorrow${t.assignedTo ? ` • Assigned: ${t.assignedTo}` : ""}`,
        severity: "info",
        view: "tasks"
      });
    });

  if (items.length) return items.slice(0, 5);

  const upcoming = getUpcomingAppointments(3).filter(a => a.date > todayString());
  return upcoming.map(a => ({
    icon: "📌",
    title: `${a.person || "Appointment"}: ${a.doctor || "Appointment"}`,
    detail: `${formatDate(a.date)} ${formatTime(a.time)}`,
    severity: "info",
    view: "appointments"
  }));
}

function renderAlertItem(item) {
  return `
    <button class="alert-item ${escapeHtml(item.severity)}" data-jump="${escapeHtml(item.view)}">
      <span class="alert-icon">${escapeHtml(item.icon)}</span>
      <span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </span>
    </button>
  `;
}

function renderActivityFeed() {
  const items = [];

  appState.appointments.forEach(a => {
    items.push({
      sort: `${a.date || "9999-99-99"} ${a.time || ""}`,
      icon: "📅",
      title: `${a.person || "Appointment"}: ${a.doctor || "Appointment"}`,
      detail: `${formatDate(a.date)} ${formatTime(a.time)}${a.driver ? ` • Driver: ${a.driver}` : ""}`
    });
  });

  appState.tasks.forEach(t => {
    items.push({
      sort: t.dueDate || "9999-99-99",
      icon: t.completed ? "☑" : "☐",
      title: t.title || "Task",
      detail: `${t.assignedTo ? `Assigned: ${t.assignedTo}` : "Unassigned"}${t.dueDate ? ` • Due ${formatDate(t.dueDate)}` : ""}`
    });
  });

  appState.notes.forEach(n => {
    items.push({
      sort: String(n.createdAtMs || 0),
      icon: "📝",
      title: n.person ? `Note for ${n.person}` : "Family note",
      detail: `${n.author || "Someone"}: ${n.text || ""}`
    });
  });

  appState.medications.forEach(m => {
    items.push({
      sort: m.refillDate || String(m.createdAtMs || 0),
      icon: "💊",
      title: `${m.person || "Medication"}: ${m.name || "Medication"}`,
      detail: `${m.schedule || "No schedule"}${m.refillDate ? ` • Refill ${formatDate(m.refillDate)}` : ""}`
    });
  });

  if (!items.length) return "<p>No activity yet.</p>";

  return items
    .sort((a, b) => String(b.sort).localeCompare(String(a.sort)))
    .slice(0, 8)
    .map(item => `
      <div class="timeline-item">
        <span class="timeline-icon">${item.icon}</span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.detail)}</p>
        </div>
      </div>
    `).join("");
}

function daysUntil(dateString) {
  if (!dateString) return null;
  const [year, month, day] = dateString.split("-").map(Number);
  if (!year || !month || !day) return null;
  const target = new Date(year, month - 1, day);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}


function renderTransportationItem(item) {
  const a = item.appointment || {};
  return `
    <div class="transport-item">
      <div class="transport-time">${escapeHtml(item.time || "")}</div>
      <div>
        <strong>${escapeHtml(a.person || "Appointment")}</strong>
        <p>${escapeHtml(item.label || "Transportation")}</p>
        <small>${escapeHtml(a.appointmentType ? `${a.appointmentType}: ${a.doctor || ""}` : (a.doctor || ""))}${a.driver ? ` • Driver: ${escapeHtml(a.driver)}` : ""}</small>
      </div>
    </div>
  `;
}
