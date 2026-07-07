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
import { appState, formatDate, isAdmin } from "./state.js";
import { escapeHtml } from "./ui.js";
import { renderDashboard } from "./dashboard.js";
import { renderFamily } from "./family.js";
import { notify, confirmAction } from "./notifications.js";

let editingTaskId = null;

export async function addTask() {
  const user = auth.currentUser;
  if (!user) return alert("You must be logged in to add tasks.");

  const data = {
    title: document.getElementById("taskTitle").value.trim(),
    assignedTo: document.getElementById("taskAssignedTo").value.trim(),
    dueDate: document.getElementById("taskDueDate").value,
    person: document.getElementById("taskPerson").value,
    notes: document.getElementById("taskNotes").value.trim()
  };

  if (!data.title) return alert("Please enter a task.");

  const wasEditing = Boolean(editingTaskId);

  if (editingTaskId) {
    await updateDoc(doc(db, "tasks", editingTaskId), {
      ...data,
      updatedBy: user.email,
      updatedAt: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, "tasks"), {
      ...data,
      completed: false,
      createdBy: user.email,
      createdAt: serverTimestamp()
    });
  }

  clearTaskForm();
  await loadTasks();
  notify(wasEditing ? "Task updated." : "Task added.");
}

export async function loadTasks() {
  const snapshot = await getDocs(collection(db, "tasks"));
  appState.tasks = [];

  snapshot.forEach(taskDoc => appState.tasks.push({ id: taskDoc.id, ...taskDoc.data() }));

  appState.tasks.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
  });

  renderTasks();
  renderDashboard();
  renderFamily();
}

export function renderTasks() {
  const div = document.getElementById("tasks");
  if (!div) return;
  div.innerHTML = appState.tasks.length ? appState.tasks.map(t => renderTaskCard(t)).join("") : "<p>No tasks yet.</p>";
  setupTaskButtons();
}

export function renderTaskCard(task, compact = false) {
  return `
    <div class="item task-item ${task.completed ? "completed" : ""}">
      <div class="task-row">
        <button class="check-btn" data-task-toggle="${task.id}" data-completed="${task.completed}">
          ${task.completed ? "☑" : "☐"}
        </button>
        <div>
          <strong>${escapeHtml(task.title)}</strong>
          ${task.person ? `<p>👤 For: ${escapeHtml(task.person)}</p>` : ""}
          ${task.assignedTo ? `<p>🙋 Assigned: ${escapeHtml(task.assignedTo)}</p>` : ""}
          ${task.dueDate ? `<p>📅 Due: ${formatDate(task.dueDate)}</p>` : ""}
          ${task.notes && !compact ? `<p>📝 ${escapeHtml(task.notes)}</p>` : ""}
          <small>Added by ${escapeHtml(task.createdBy || "unknown")}</small>
          ${!compact ? `
            <div class="action-row">
              <button data-task-edit="${task.id}">Edit</button>
              ${isAdmin() ? `<button class="danger" data-task-delete="${task.id}">Delete</button>` : ""}
            </div>` : ""}
        </div>
      </div>
    </div>
  `;
}

function setupTaskButtons() {
  document.querySelectorAll("[data-task-edit]").forEach(button => {
    button.onclick = () => {
      const task = appState.tasks.find(t => t.id === button.getAttribute("data-task-edit"));
      if (task) startEditTask(task);
    };
  });

  document.querySelectorAll("[data-task-toggle]").forEach(button => {
    button.onclick = async () => {
      const id = button.getAttribute("data-task-toggle");
      const completed = button.getAttribute("data-completed") === "true";
      await updateDoc(doc(db, "tasks", id), {
        completed: !completed,
        completedAt: !completed ? serverTimestamp() : null,
        completedBy: !completed ? auth.currentUser.email : null
      });
      await loadTasks();
      notify(!completed ? "Task completed." : "Task reopened.");
    };
  });

  document.querySelectorAll("[data-task-delete]").forEach(button => {
    button.onclick = async () => {
      if (!isAdmin()) return alert("Only admins can delete tasks.");
      if (!confirmAction("Delete this task?")) return;
      await deleteDoc(doc(db, "tasks", button.getAttribute("data-task-delete")));
      await loadTasks();
      notify("Task deleted.");
    };
  });
}

function startEditTask(task) {
  editingTaskId = task.id;
  setValue("taskTitle", task.title);
  setValue("taskAssignedTo", task.assignedTo);
  setValue("taskDueDate", task.dueDate);
  setValue("taskPerson", task.person);
  setValue("taskNotes", task.notes);

  const title = document.getElementById("taskFormTitle");
  if (title) title.textContent = "Edit task";

  const button = document.getElementById("addTask");
  if (button) button.textContent = "Save Changes";

  const cancelButton = document.getElementById("cancelTaskEdit");
  if (cancelButton) cancelButton.classList.remove("hidden");
  document.getElementById("view-tasks")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearTaskForm() {
  ["taskTitle", "taskAssignedTo", "taskDueDate", "taskPerson", "taskNotes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  editingTaskId = null;
  const title = document.getElementById("taskFormTitle");
  if (title) title.textContent = "Add task";

  const button = document.getElementById("addTask");
  if (button) button.textContent = "Add Task";

  const cancelButton = document.getElementById("cancelTaskEdit");
  if (cancelButton) cancelButton.classList.add("hidden");
}

export function cancelEditTask() {
  clearTaskForm();
  notify("Task edit cancelled.", "info");
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

export function getOpenTasks(limit = 5) {
  return appState.tasks.filter(t => !t.completed).slice(0, limit);
}
