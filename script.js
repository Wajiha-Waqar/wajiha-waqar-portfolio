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

  const modal = document.getElementById("doc-preview-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeDocPreview();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !modal.hidden) closeDocPreview();
    });
  }
});

// Renders a .docx file inline in a preview modal using mammoth.js, so the
// document shows up on the page itself instead of downloading. This needs
// the page served over http/https (GitHub Pages, or a local dev server
// like `python3 -m http.server`) because fetch() can't read local files
// opened directly via file://. If the fetch fails for any reason, the
// modal shows a short message and the Download button remains a
// guaranteed fallback.
async function previewDoc(path, title) {
  const modal = document.getElementById("doc-preview-modal");
  const body = document.getElementById("doc-modal-body");
  const titleEl = document.getElementById("doc-modal-title");
  if (!modal || !body || !titleEl) return;

  titleEl.textContent = title || "Document preview";
  body.innerHTML = '<p class="doc-modal-status">Loading preview&hellip;</p>';
  modal.hidden = false;
  document.body.style.overflow = "hidden";

  try {
    if (typeof mammoth === "undefined") {
      throw new Error("Preview library did not load.");
    }
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error("File not found at " + path);
    }
    const arrayBuffer = await response.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    body.innerHTML = result.value || "<p>This document has no readable content.</p>";
  } catch (err) {
    body.innerHTML =
      '<p class="doc-modal-status">This preview couldn\'t load in the browser ' +
      "(this happens when the page is opened directly from disk instead of " +
      "through a web server). Use the Download button on the card instead, " +
      "or check the live GitHub Pages site.</p>";
  }
}

function closeDocPreview() {
  const modal = document.getElementById("doc-preview-modal");
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = "";
}
