import { appState } from "./state.js";
import { renderAppointmentCard } from "./appointments.js";
import { renderTaskCard } from "./tasks.js";
import { renderNoteCard } from "./notes.js";
import { getMedicationsForPerson, renderMedicationCard } from "./medications.js";

export function renderFamily() {
  renderPerson("Grandma", "grandma");
  renderPerson("Grandpa", "grandpa");
}

function renderPerson(person, prefix) {
  const appts = appState.appointments.filter(a => a.person === person || a.person === "Both").slice(0, 5);
  const tasks = appState.tasks.filter(t => t.person === person || t.person === "Both").slice(0, 5);
  const notes = appState.notes.filter(n => n.person === person || n.person === "Both").slice(0, 5);
  const meds = getMedicationsForPerson(person, 5);

  const apptDiv = document.getElementById(`${prefix}Appointments`);
  const taskDiv = document.getElementById(`${prefix}Tasks`);
  const noteDiv = document.getElementById(`${prefix}Notes`);
  const medDiv = document.getElementById(`${prefix}Medications`);

  if (!apptDiv || !taskDiv || !noteDiv || !medDiv) return;

  apptDiv.innerHTML = appts.length ? appts.map(a => renderAppointmentCard(a, true)).join("") : "<p>No appointments.</p>";
  taskDiv.innerHTML = tasks.length ? tasks.map(t => renderTaskCard(t, true)).join("") : "<p>No tasks.</p>";
  medDiv.innerHTML = meds.length ? meds.map(m => renderMedicationCard(m, true)).join("") : "<p>No medications.</p>";
  noteDiv.innerHTML = notes.length ? notes.map(n => renderNoteCard(n, true)).join("") : "<p>No notes.</p>";
}
