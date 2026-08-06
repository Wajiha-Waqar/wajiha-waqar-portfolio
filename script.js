// Highlights the current page's nav link (backup in case the .active
// class wasn't set manually on a page) and adds a subtle scrolled
// state to the header for a slightly stronger shadow after scrolling.

document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  document.querySelectorAll(".nav-links a").forEach((link) => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
    }
  });

  const header = document.querySelector("header");
  if (header) {
    window.addEventListener("scroll", () => {
      if (window.scrollY > 10) {
        header.style.boxShadow = "0 2px 10px rgba(17, 24, 39, 0.06)";
      } else {
        header.style.boxShadow = "none";
      }
    });
  }
});
