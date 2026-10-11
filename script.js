// Small, dependency-free enhancements. The site is fully usable without any of this.

document.addEventListener("DOMContentLoaded", () => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Header: subtle border/shadow once scrolled ---- */
  const header = document.querySelector(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- Mobile navigation ---- */
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    const setOpen = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      menu.classList.toggle("is-open", open);
    };
    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    window.matchMedia("(min-width: 821px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  /* ---- Section reveal (opt-in via .reveal; CSS only hides when JS is running) ---- */
  const revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach((el) => el.classList.add("is-visible"));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
      revealEls.forEach((el) => io.observe(el));
    }
  }

  /* ---- Scroll-spy for in-page nav links (home page: Experience) ---- */
  const page = window.location.pathname.split("/").pop() || "index.html";
  const spyLinks = [...document.querySelectorAll('.nav-links a[href*="#"]')]
    .filter((a) => (a.getAttribute("href").split("#")[0] || page) === page);
  if (spyLinks.length && "IntersectionObserver" in window) {
    const pageLink = document.querySelector('.nav-links a[aria-current="page"]');
    const targets = spyLinks
      .map((a) => ({ link: a, el: document.getElementById(a.hash.slice(1)) }))
      .filter((t) => t.el);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const t = targets.find((x) => x.el === entry.target);
        if (!t) return;
        if (entry.isIntersecting) {
          if (pageLink) pageLink.removeAttribute("aria-current");
          t.link.setAttribute("aria-current", "location");
        } else {
          t.link.removeAttribute("aria-current");
          if (pageLink && !document.querySelector('.nav-links a[aria-current="location"]')) {
            pageLink.setAttribute("aria-current", "page");
          }
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach((t) => spy.observe(t.el));
  }

  /* ---- Document preview modal: click-outside and Escape ---- */
  const modal = document.getElementById("doc-preview-modal");
  if (modal) {
    modal.addEventListener("click", (e) => { if (e.target === modal) closeDocPreview(); });
    document.addEventListener("keydown", (e) => {
      if (modal.hidden) return;
      if (e.key === "Escape") closeDocPreview();
      if (e.key === "Tab") {
        // keep keyboard focus inside the dialog while it is open
        const focusables = modal.querySelectorAll("button, a[href], [tabindex]:not([tabindex='-1'])");
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
});

/* ---------------------------------------------------------------------
   Renders a .docx inline in a preview modal using mammoth.js.
   Needs the page served over http/https (GitHub Pages or a local server
   such as `python3 -m http.server`); fetch() can't read file:// URLs.
   If anything fails, the modal says so and the Download button remains
   the guaranteed fallback.
--------------------------------------------------------------------- */
let lastFocusedBeforeModal = null;

async function previewDoc(path, title) {
  const modal = document.getElementById("doc-preview-modal");
  const body = document.getElementById("doc-modal-body");
  const titleEl = document.getElementById("doc-modal-title");
  if (!modal || !body || !titleEl) return;

  lastFocusedBeforeModal = document.activeElement;
  titleEl.textContent = title || "Document preview";
  body.innerHTML = '<p class="doc-modal-status">Loading preview&hellip;</p>';
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  const closeBtn = modal.querySelector(".doc-modal-close");
  if (closeBtn) closeBtn.focus();

  try {
    if (typeof mammoth === "undefined") throw new Error("Preview library did not load.");
    const response = await fetch(path);
    if (!response.ok) throw new Error("File not found at " + path);
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
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === "function") {
    lastFocusedBeforeModal.focus();
  }
}
