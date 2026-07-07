import { appState, todayString, formatTime, formatDateTimeSeattle } from "./state.js";
import { escapeHtml } from "./ui.js";

const PEOPLE = ["Grandma", "Grandpa"];

export function setupPrintCenter() {
  const dateInput = document.getElementById("printDate");
  const startInput = document.getElementById("printStartDate");
  const endInput = document.getElementById("printEndDate");

  if (dateInput && !dateInput.value) dateInput.value = todayString();
  if (startInput && !startInput.value) startInput.value = todayString();
  if (endInput && !endInput.value) endInput.value = todayString();

  const refreshBtn = document.getElementById("refreshPrintPreview");
  const printBtn = document.getElementById("printDailySummary");

  if (refreshBtn) refreshBtn.onclick = renderPrintPreview;
  if (printBtn) {
    printBtn.onclick = () => {
      renderPrintPreview();
      printDailySummary();
    };
  }

  document.addEventListener("click", event => {
    if (event.target?.id === "refreshPrintPreview") {
      event.preventDefault();
      renderPrintPreview();
    }

    if (event.target?.id === "printDailySummary") {
      event.preventDefault();
      renderPrintPreview();
      printDailySummary();
    }
  });

  [
    "printDate",
    "printStartDate",
    "printEndDate",
    "printModeSingle",
    "printModeRange",
    "printGrandma",
    "printGrandpa",
    "includeAppointments",
    "includeTransportation",
    "includeMedications",
    "includeTasks",
    "includeContacts",
    "includeNotes"
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onchange = renderPrintPreview;
  });
}

export function renderPrintPreview() {
  const preview = document.getElementById("printPreview");
  if (!preview) return;
  preview.innerHTML = buildDailySummaryHtml(false);
}

function printDailySummary() {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Your browser blocked the print window. Please allow pop-ups for this site and try again.");
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>CareCircle Daily Summary</title>
        <meta charset="UTF-8" />
        <style>${getPrintStyles()}</style>
      </head>
      <body>
        ${buildDailySummaryHtml(true)}
        <script>
          window.onload = function() {
            window.focus();
            window.print();
          };
        <\/script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function buildDailySummaryHtml(forPrint) {
  const options = getPrintOptions();
  const people = getSelectedPeople(options);
  const preparedTime = formatDateTimeSeattle(new Date());
  const title = options.mode === "range" ? "Care Summary" : "Daily Care Summary";

  const peopleHtml = people.length
    ? people.map(person => renderPersonSection(person, options)).join("")
    : `<p>No people selected.</p>`;

  return `
    <article class="daily-print ${forPrint ? "print-mode" : ""}">
      <header class="print-header">
        <div>
          <p class="print-kicker">CareCircle</p>
          <h1>${escapeHtml(title)}</h1>
          <p class="print-date">${escapeHtml(getDateLabel(options))}</p>
        </div>
        <div class="prepared-box">
          <strong>Prepared</strong>
          <span>${escapeHtml(preparedTime)}</span>
        </div>
      </header>

      ${peopleHtml}

      ${options.includeContacts ? renderSharedContacts(options) : ""}

      <footer class="print-footer">
        CareCircle ${escapeHtml(title)} • ${escapeHtml(getDateLabel(options))}
      </footer>
    </article>
  `;
}

function renderPersonSection(person, options) {
  const appointments = getAppointmentsForPersonAndRange(person, options.startDate, options.endDate);
  const tasks = getTasksForPersonAndRange(person, options.startDate, options.endDate);
  const medications = getMedicationsForPerson(person);
  const notes = getNotesForPerson(person);
  const contacts = getContactsForPerson(person).slice(0, 8);

  const hasAny = appointments.length || tasks.length || medications.length || notes.length || contacts.length;

  return `
    <section class="print-person-section">
      <h2>${person === "Grandma" ? "👵" : "👴"} ${escapeHtml(person)}</h2>
      ${!hasAny ? `<p class="empty-line">No care items found for this date range.</p>` : ""}
      ${options.includeTransportation ? renderTransportationSection(appointments) : ""}
      ${options.includeAppointments ? renderAppointmentsSection(appointments) : ""}
      ${options.includeMedications ? renderMedicationChecklist(medications) : ""}
      ${options.includeTasks ? renderTasksSection(tasks) : ""}
      ${options.includeContacts ? renderContactsSection(contacts, "Important Contacts") : ""}
      ${options.includeNotes ? renderNotesSection(notes) : ""}
    </section>
  `;
}

function renderTransportationSection(appointments) {
  const items = [];

  appointments.forEach(a => {
    const maple = formatWindow(a.maplePickupStart, a.maplePickupEnd);
    const ret = formatWindow(a.returnPickupStart, a.returnPickupEnd);

    if (maple) {
      items.push({
        sort: `${a.date || ""} ${a.maplePickupStart || a.time || "99:99"}`,
        label: `${formatDate(a.date)} — Maple Ridge pickup`,
        time: maple,
        detail: `${a.appointmentType || a.doctor || "Appointment"}${a.driver ? ` • Driver: ${a.driver}` : ""}`
      });
    }

    if (ret) {
      items.push({
        sort: `${a.date || ""} ${a.returnPickupStart || a.appointmentEndTime || a.time || "99:99"}`,
        label: `${formatDate(a.date)} — Appointment-location pickup`,
        time: ret,
        detail: `${a.appointmentType || a.doctor || "Appointment"}${a.driver ? ` • Driver: ${a.driver}` : ""}`
      });
    }
  });

  items.sort((a, b) => String(a.sort).localeCompare(String(b.sort)));

  if (!items.length) return sectionBlock("Transportation", `<p class="empty-line">No transportation windows found.</p>`);

  return sectionBlock("Transportation", items.map(item => `
    <div class="print-row">
      <strong>${escapeHtml(item.time)}</strong>
      <span>${escapeHtml(item.label)}</span>
      <small>${escapeHtml(item.detail)}</small>
    </div>
  `).join(""));
}

function renderAppointmentsSection(appointments) {
  if (!appointments.length) return sectionBlock("Appointments", `<p class="empty-line">No appointments found.</p>`);

  return sectionBlock("Appointments", appointments.map(a => {
    const appointmentTime = formatWindow(a.time, a.appointmentEndTime) || "Time not set";
    return `
      <div class="print-item">
        <strong>${escapeHtml(formatDate(a.date))} • ${escapeHtml(appointmentTime)} — ${escapeHtml(a.appointmentType || "Appointment")}</strong>
        <p>${escapeHtml(a.doctor || "")}</p>
        ${a.location ? `<p>Location: ${escapeHtml(a.location)}</p>` : ""}
        ${a.driver ? `<p>Driver: ${escapeHtml(a.driver)}</p>` : ""}
        ${a.notes ? `<p>Notes: ${escapeHtml(a.notes)}</p>` : ""}
      </div>
    `;
  }).join(""));
}

function renderMedicationChecklist(medications) {
  if (!medications.length) return sectionBlock("Medication Checklist", `<p class="empty-line">No active medications listed.</p>`);

  return sectionBlock("Medication Checklist", medications.map(m => `
    <div class="check-line">
      <span class="box"></span>
      <span><strong>${escapeHtml(m.name || "Medication")}</strong>${m.dosage ? ` — ${escapeHtml(m.dosage)}` : ""}${m.schedule ? ` • ${escapeHtml(m.schedule)}` : ""}</span>
    </div>
  `).join(""));
}

function renderTasksSection(tasks) {
  if (!tasks.length) return sectionBlock("Tasks", `<p class="empty-line">No open tasks due in this range.</p>`);

  return sectionBlock("Tasks", tasks.map(t => `
    <div class="check-line">
      <span class="box"></span>
      <span><strong>${escapeHtml(t.title || "Task")}</strong>${t.assignedTo ? ` — Assigned: ${escapeHtml(t.assignedTo)}` : ""}${t.dueDate ? ` • Due: ${escapeHtml(formatDate(t.dueDate))}` : ""}</span>
    </div>
  `).join(""));
}

function renderContactsSection(contacts, title) {
  if (!contacts.length) return sectionBlock(title, `<p class="empty-line">No linked contacts found.</p>`);

  return sectionBlock(title, contacts.map(c => `
    <div class="print-contact">
      <strong>${escapeHtml(c.name || "Contact")}</strong>
      ${c.category ? `<span>${escapeHtml(c.category)}</span>` : ""}
      ${c.phone ? `<p>Phone: ${escapeHtml(c.phone)}</p>` : ""}
      ${c.alternatePhone ? `<p>Alt: ${escapeHtml(c.alternatePhone)}</p>` : ""}
      ${c.address ? `<p>Address: ${escapeHtml(c.address)}</p>` : ""}
    </div>
  `).join(""));
}

function renderNotesSection(notes) {
  if (!notes.length) return sectionBlock("Recent Notes", `<p class="empty-line">No recent notes.</p>`);

  return sectionBlock("Recent Notes", notes.slice(0, 5).map(n => `
    <div class="print-item">
      <strong>${escapeHtml(n.author || "Note")}</strong>
      <p>${escapeHtml(n.text || "")}</p>
    </div>
  `).join(""));
}

function renderSharedContacts(options) {
  const selected = getSelectedPeople(options);
  const contacts = appState.directoryContacts
    .filter(c => c.favorite || (c.linkedPeople || []).some(p => selected.includes(p)))
    .slice(0, 12);

  if (!contacts.length) return "";

  return `
    <section class="print-person-section shared-contacts-section">
      <h2>📞 Shared Important Contacts</h2>
      ${renderContactsSection(contacts, "Favorites and Linked Contacts")}
    </section>
  `;
}

function sectionBlock(title, body) {
  return `
    <section class="print-block">
      <h3>${escapeHtml(title)}</h3>
      ${body}
    </section>
  `;
}

function getPrintOptions() {
  const mode = document.getElementById("printModeRange")?.checked ? "range" : "single";
  const singleDate = normalizeDateKey(document.getElementById("printDate")?.value || todayString());
  const rawStart = normalizeDateKey(document.getElementById("printStartDate")?.value || singleDate);
  const rawEnd = normalizeDateKey(document.getElementById("printEndDate")?.value || rawStart);
  const startDate = mode === "range" ? minDate(rawStart, rawEnd) : singleDate;
  const endDate = mode === "range" ? maxDate(rawStart, rawEnd) : singleDate;

  return {
    mode,
    date: singleDate,
    startDate,
    endDate,
    printGrandma: document.getElementById("printGrandma")?.checked ?? true,
    printGrandpa: document.getElementById("printGrandpa")?.checked ?? true,
    includeAppointments: document.getElementById("includeAppointments")?.checked ?? true,
    includeTransportation: document.getElementById("includeTransportation")?.checked ?? true,
    includeMedications: document.getElementById("includeMedications")?.checked ?? true,
    includeTasks: document.getElementById("includeTasks")?.checked ?? true,
    includeContacts: document.getElementById("includeContacts")?.checked ?? true,
    includeNotes: document.getElementById("includeNotes")?.checked ?? false
  };
}

function getDateLabel(options) {
  if (options.mode === "range") {
    if (options.startDate === options.endDate) return formatDateLong(options.startDate);
    return `${formatDateLong(options.startDate)} through ${formatDateLong(options.endDate)}`;
  }

  return formatDateLong(options.date);
}

function minDate(a, b) {
  return String(normalizeDateKey(a) || "9999-99-99") <= String(normalizeDateKey(b) || "9999-99-99") ? normalizeDateKey(a) : normalizeDateKey(b);
}

function maxDate(a, b) {
  return String(normalizeDateKey(a) || "0000-00-00") >= String(normalizeDateKey(b) || "0000-00-00") ? normalizeDateKey(a) : normalizeDateKey(b);
}

function getSelectedPeople(options) {
  return PEOPLE.filter(person => person === "Grandma" ? options.printGrandma : options.printGrandpa);
}

function getAppointmentsForPersonAndRange(person, startDate, endDate) {
  return appState.appointments
    .filter(a => {
      const apptDate = normalizeDateKey(a.date);
      return apptDate >= startDate && apptDate <= endDate && a.status !== "Cancelled" && matchesPerson(a.person, person);
    })
    .sort((a, b) => `${a.date || ""} ${a.time || "99:99"}`.localeCompare(`${b.date || ""} ${b.time || "99:99"}`));
}

function getTasksForPersonAndRange(person, startDate, endDate) {
  return appState.tasks
    .filter(t => !t.completed && matchesPerson(t.person, person))
    .filter(t => {
      const dueDate = normalizeDateKey(t.dueDate);
      return !dueDate || (dueDate >= startDate && dueDate <= endDate);
    })
    .sort((a, b) => String(a.dueDate || "9999-99-99").localeCompare(String(b.dueDate || "9999-99-99")));
}

function getMedicationsForPerson(person) {
  return appState.medications
    .filter(m => m.active !== false && matchesPerson(m.person, person))
    .sort((a, b) => `${a.schedule || ""} ${a.name || ""}`.localeCompare(`${b.schedule || ""} ${b.name || ""}`));
}

function getNotesForPerson(person) {
  return appState.notes.filter(n => matchesPerson(n.person, person));
}

function getContactsForPerson(person) {
  return appState.directoryContacts
    .filter(c => c.favorite || (c.linkedPeople || []).includes(person))
    .sort((a, b) => {
      if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
}

function matchesPerson(value, person) {
  return value === person || value === "Both" || !value;
}

function formatWindow(start, end) {
  const startFormatted = formatTime(start);
  const endFormatted = formatTime(end);

  if (startFormatted && endFormatted) return `${startFormatted}–${endFormatted}`;
  if (startFormatted) return startFormatted;
  if (endFormatted) return `By ${endFormatted}`;
  return "";
}

// Print Center date helpers
// These deliberately avoid new Date("YYYY-MM-DD") because browsers treat that
// as UTC and Seattle can display the previous day. Dates from inputs and
// Firestore are handled as plain calendar dates.
function normalizeDateKey(value) {
  if (!value) return "";
  const text = String(value).trim();

  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = String(match[1]).padStart(2, "0");
    const day = String(match[2]).padStart(2, "0");
    return `${match[3]}-${month}-${day}`;
  }

  return text;
}

function getDateParts(value) {
  const key = normalizeDateKey(value);
  const match = key.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: match[1],
    month: match[2],
    day: match[3],
    yearNumber: Number(match[1]),
    monthNumber: Number(match[2]),
    dayNumber: Number(match[3])
  };
}

function formatDate(value) {
  const parts = getDateParts(value);
  if (!parts) return value ? String(value) : "No date";
  return `${parts.month}/${parts.day}/${parts.year}`;
}

function formatDateLong(value) {
  const parts = getDateParts(value);
  if (!parts) return value ? String(value) : "No date";

  const localNoon = new Date(parts.yearNumber, parts.monthNumber - 1, parts.dayNumber, 12, 0, 0);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return `${weekdays[localNoon.getDay()]}, ${months[parts.monthNumber - 1]} ${parts.dayNumber}, ${parts.year}`;
}

function getPrintStyles() {
  return `
    body { font-family: Arial, sans-serif; color: #111827; margin: 0; background: white; }
    .daily-print { max-width: 900px; margin: 0 auto; padding: 28px; }
    .print-header { display: flex; justify-content: space-between; gap: 20px; border-bottom: 3px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    .print-kicker { text-transform: uppercase; letter-spacing: .12em; font-size: 12px; font-weight: 700; margin: 0 0 4px; color: #475569; }
    h1 { margin: 0; font-size: 30px; }
    .print-date { margin: 6px 0 0; font-size: 18px; font-weight: 700; }
    .prepared-box { text-align: right; font-size: 12px; color: #475569; }
    .prepared-box span { display: block; }
    .print-person-section { page-break-inside: avoid; border-bottom: 1px solid #cbd5e1; padding-bottom: 12px; margin-bottom: 18px; }
    .print-person-section h2 { font-size: 24px; margin: 0 0 12px; }
    .print-block { margin: 12px 0; }
    .print-block h3 { font-size: 15px; text-transform: uppercase; letter-spacing: .08em; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin: 0 0 8px; }
    .print-item, .print-contact, .print-row, .check-line { padding: 7px 0; border-bottom: 1px dotted #d1d5db; }
    .print-item p, .print-contact p { margin: 3px 0; }
    .print-row { display: grid; grid-template-columns: 140px 1fr; gap: 10px; }
    .print-row small { grid-column: 2; color: #475569; }
    .check-line { display: flex; gap: 10px; align-items: center; }
    .box { width: 15px; height: 15px; border: 2px solid #111827; display: inline-block; flex: 0 0 15px; }
    .empty-line { color: #6b7280; font-style: italic; }
    .print-footer { margin-top: 24px; color: #6b7280; font-size: 12px; text-align: center; }
    @media print { .daily-print { padding: 0; } }
  `;
}
