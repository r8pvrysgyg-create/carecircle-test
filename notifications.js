const TOAST_DURATION_MS = 3200;

export function setupNotifications() {
  if (!document.getElementById("toastContainer")) {
    const container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
}

export function notify(message, type = "success") {
  setupNotifications();

  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("toast-hide");
    window.setTimeout(() => toast.remove(), 250);
  }, TOAST_DURATION_MS);
}

export function confirmAction(message) {
  return window.confirm(message);
}
