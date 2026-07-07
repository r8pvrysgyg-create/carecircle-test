export const APP_VERSION = "4.4";

export const appState = {
  appointments: [],
  tasks: [],
  notes: [],
  medications: [],
  directoryContacts: [],
  appointmentTemplates: [],
  currentUser: null,
  currentProfile: null,
  users: []
};

export const APP_TIME_ZONE = "America/Los_Angeles";

export function formatDate(dateString) {
  if (!dateString) return "No date";
  const parts = parseDateParts(dateString);
  if (!parts) return String(dateString);
  return `${parts.month}/${parts.day}/${parts.year}`;
}

export function formatDateLong(dateString) {
  if (!dateString) return "No date";
  const parts = parseDateParts(dateString);
  if (!parts) return String(dateString);

  // Important: date-only values are NOT converted through UTC.
  // This prevents selected dates like 2026-07-03 from displaying as 2026-07-02.
  const localDate = new Date(parts.yearNumber, parts.monthNumber - 1, parts.dayNumber);
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return `${weekdays[localDate.getDay()]}, ${months[parts.monthNumber - 1]} ${parts.dayNumber}, ${parts.year}`;
}

function parseDateParts(dateString) {
  const value = String(dateString).trim();

  // Native date inputs provide YYYY-MM-DD.
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return {
      year,
      month,
      day,
      yearNumber: Number(year),
      monthNumber: Number(month),
      dayNumber: Number(day)
    };
  }

  // Some browsers display/copy dates as MM/DD/YYYY. Support that too.
  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, monthRaw, dayRaw, year] = match;
    const month = String(monthRaw).padStart(2, "0");
    const day = String(dayRaw).padStart(2, "0");
    return {
      year,
      month,
      day,
      yearNumber: Number(year),
      monthNumber: Number(month),
      dayNumber: Number(day)
    };
  }

  return null;
}

export function todayString() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find(p => p.type === "year").value;
  const month = parts.find(p => p.type === "month").value;
  const day = parts.find(p => p.type === "day").value;

  return `${year}-${month}-${day}`;
}

export function formatTime(timeString) {
  if (!timeString) return "";
  const [hourText, minuteText = "00"] = String(timeString).split(":");
  let hour = Number(hourText);
  const minute = String(minuteText).padStart(2, "0");

  if (Number.isNaN(hour)) return timeString;

  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute} ${suffix}`;
}

export function formatDateTimeSeattle(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

export function isAdmin() {
  return appState.currentProfile?.role === "admin";
}


export function addMinutesToTime(timeString, minutesToAdd = 30) {
  if (!timeString) return "";
  const [hourText, minuteText = "00"] = String(timeString).split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";

  const date = new Date();
  date.setHours(hour, minute + Number(minutesToAdd || 0), 0, 0);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
