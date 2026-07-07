import { appState, formatDateLong, formatTime, todayString } from "./state.js";
import { escapeHtml, showView } from "./ui.js";

let calendarMonthDate = getMonthStart(todayString());

export function setupCalendarView() {
  const prevBtn = document.getElementById("calendarPrevMonth");
  const nextBtn = document.getElementById("calendarNextMonth");
  const todayBtn = document.getElementById("calendarToday");
  const personFilter = document.getElementById("calendarPersonFilter");

  if (prevBtn) {
    prevBtn.onclick = () => {
      calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() - 1, 1);
      renderCalendarView();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = () => {
      calendarMonthDate = new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + 1, 1);
      renderCalendarView();
    };
  }

  if (todayBtn) {
    todayBtn.onclick = () => {
      calendarMonthDate = getMonthStart(todayString());
      renderCalendarView();
      renderCalendarDay(todayString());
    };
  }

  if (personFilter) {
    personFilter.onchange = () => renderCalendarView();
  }
}

export function renderCalendarView() {
  const title = document.getElementById("calendarMonthTitle");
  const grid = document.getElementById("calendarGrid");

  if (!grid) return;

  const year = calendarMonthDate.getFullYear();
  const month = calendarMonthDate.getMonth();

  if (title) {
    title.textContent = calendarMonthDate.toLocaleString("en-US", {
      month: "long",
      year: "numeric"
    });
  }

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const previousMonthDays = new Date(year, month, 0).getDate();

  const cells = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const dayNumber = previousMonthDays - i;
    const date = toDateString(new Date(year, month - 1, dayNumber));
    cells.push(renderCalendarCell(date, dayNumber, true));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = toDateString(new Date(year, month, day));
    cells.push(renderCalendarCell(date, day, false));
  }

  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (startOffset + daysInMonth) + 1;
    const date = toDateString(new Date(year, month + 1, nextDay));
    cells.push(renderCalendarCell(date, nextDay, true));
  }

  grid.innerHTML = `
    <div class="calendar-weekday">Sun</div>
    <div class="calendar-weekday">Mon</div>
    <div class="calendar-weekday">Tue</div>
    <div class="calendar-weekday">Wed</div>
    <div class="calendar-weekday">Thu</div>
    <div class="calendar-weekday">Fri</div>
    <div class="calendar-weekday">Sat</div>
    ${cells.join("")}
  `;

  document.querySelectorAll("[data-calendar-date]").forEach(button => {
    button.onclick = () => renderCalendarDay(button.getAttribute("data-calendar-date"));
  });

  const selectedDate = document.getElementById("calendarSelectedDate")?.dataset.date || todayString();
  renderCalendarDay(selectedDate);
}

function renderCalendarCell(date, dayNumber, muted) {
  const appointments = getAppointmentsForDate(date);
  const today = date === todayString();
  const hasAppointments = appointments.length > 0;
  const people = [...new Set(appointments.map(a => a.person).filter(Boolean))];

  return `
    <button class="calendar-day ${muted ? "calendar-muted" : ""} ${today ? "calendar-today" : ""} ${hasAppointments ? "calendar-has-items" : ""}" data-calendar-date="${escapeHtml(date)}">
      <span class="calendar-day-number">${dayNumber}</span>
      ${hasAppointments ? `<span class="calendar-count">${appointments.length}</span>` : ""}
      <div class="calendar-dots">
        ${people.slice(0, 3).map(person => `<span class="calendar-dot ${personClass(person)}" title="${escapeHtml(person)}"></span>`).join("")}
      </div>
    </button>
  `;
}

function renderCalendarDay(date) {
  const selectedTitle = document.getElementById("calendarSelectedDate");
  const dayDetails = document.getElementById("calendarDayDetails");

  if (selectedTitle) {
    selectedTitle.textContent = formatDateLong(date);
    selectedTitle.dataset.date = date;
  }

  if (!dayDetails) return;

  const appointments = getAppointmentsForDate(date)
    .sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));

  if (!appointments.length) {
    dayDetails.innerHTML = `<p class="muted">No appointments scheduled for this day.</p>`;
    return;
  }

  dayDetails.innerHTML = appointments.map(a => renderCalendarAppointment(a)).join("");
}

function renderCalendarAppointment(a) {
  const time = formatWindow(a.time, a.appointmentEndTime);
  const maple = formatWindow(a.maplePickupStart, a.maplePickupEnd);
  const ret = formatWindow(a.returnPickupStart, a.returnPickupEnd);

  return `
    <div class="item calendar-appointment-card">
      <div class="item-topline">
        <strong>${escapeHtml(a.person || "Appointment")}</strong>
        <span class="pill">${escapeHtml(a.status || "Scheduled")}</span>
      </div>
      <p class="item-title">${escapeHtml(a.appointmentType ? `${a.appointmentType}: ${a.doctor || ""}` : (a.doctor || "Appointment"))}</p>
      ${time ? `<p>⏰ Appointment: ${escapeHtml(time)}</p>` : ""}
      ${maple ? `<p>🏠 Maple Ridge pickup: ${escapeHtml(maple)}</p>` : ""}
      ${ret ? `<p>🚙 Appointment pickup: ${escapeHtml(ret)}</p>` : ""}
      ${a.location ? `<p>📍 ${escapeHtml(a.location)}</p>` : ""}
      ${a.driver ? `<p>🚗 Driver: ${escapeHtml(a.driver)}</p>` : ""}
      ${a.notes ? `<p>📝 ${escapeHtml(a.notes)}</p>` : ""}
      <div class="action-row">
        <button type="button" data-calendar-open-appointments>Open Appointments</button>
      </div>
    </div>
  `;
}

document.addEventListener("click", event => {
  if (event.target && event.target.matches("[data-calendar-open-appointments]")) {
    showView("appointments");
  }
});

function getAppointmentsForDate(date) {
  const personFilter = document.getElementById("calendarPersonFilter")?.value || "All";

  return appState.appointments.filter(a => {
    if (a.date !== date || a.status === "Cancelled") return false;
    if (personFilter === "All") return true;
    if (personFilter === "Both") return a.person === "Both";
    return a.person === personFilter || a.person === "Both";
  });
}

function formatWindow(start, end) {
  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);

  if (startFormatted && endFormatted) return `${startFormatted} - ${endFormatted}`;
  if (startFormatted) return startFormatted;
  if (endFormatted) return `By ${endFormatted}`;
  return "";
}

function personClass(person) {
  return "person-" + String(person || "other")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getMonthStart(dateString) {
  const [year, month] = String(dateString).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function toDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
