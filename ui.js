export function setupNavigation() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sidebar = document.getElementById("sidebar");
  const menuBtn = document.getElementById("menuBtn");

  navLinks.forEach(link => {
    link.onclick = () => {
      showView(link.getAttribute("data-view"));
      sidebar.classList.remove("open");
    };
  });

  document.querySelectorAll("[data-jump]").forEach(button => {
    button.onclick = () => showView(button.getAttribute("data-jump"));
  });

  menuBtn.onclick = () => {
    sidebar.classList.toggle("open");
  };
}

export function showView(viewName) {
  const navLinks = document.querySelectorAll(".nav-link");
  const views = document.querySelectorAll(".view");

  navLinks.forEach(link => {
    link.classList.toggle("active", link.getAttribute("data-view") === viewName);
  });

  views.forEach(view => view.classList.remove("active"));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add("active");
}

export function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
