/* Admin panel UI. All GitHub access goes through AdminCore.createClient (see core.js). */
(function () {
  "use strict";

  const C = window.AdminCore;
  const CFG = window.ADMIN_CONFIG;
  const KEY = "wq_admin_token";
  const IDLE_MS = 30 * 60 * 1000;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = C.escapeHtml;

  const state = {
    client: null, user: null,
    tree: [],
    page: null,            // { path, sha }
    dirty: false,
    sel: null,
    chain: [],
    history: [],
    pending: new Map(),    // staged uploads: path -> { base64 }
    file: null,            // { path, sha, original, kind }
    fileDirty: false,
    nav: null,
  };

  /* ------------------------------------------------------------ small utilities */
  const store = {
    get() { return sessionStorage.getItem(KEY) || localStorage.getItem(KEY); },
    remembered() { return !!localStorage.getItem(KEY); },
    set(token, remember) { this.clear(); (remember ? localStorage : sessionStorage).setItem(KEY, token); },
    clear() { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); },
  };

  let toastTimer;
  function toast(msg, kind) {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast " + (kind || "");
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, kind === "error" ? 9000 : 5000);
  }
  const setBusy = (on) => document.body.classList.toggle("busy", !!on);
  const fmtSize = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB");
  const rootPages = () => state.tree.map((t) => t.path).filter((p) => /^[^/]+\.html$/.test(p)).sort();
  const hasUnsaved = () => state.dirty || state.fileDirty;

  /* ------------------------------------------------------------ login / session */
  async function connect(token, remember) {
    const client = C.createClient({ token, owner: CFG.owner, repo: CFG.repo, branch: CFG.branch });
    const user = await client.whoami();
    if (user.login.toLowerCase() !== CFG.owner.toLowerCase()) {
      throw new Error(`This token belongs to "${user.login}", but this site is owned by "${CFG.owner}".`);
    }
    const info = await client.repoInfo();
    if (!info.permissions || !info.permissions.push) {
      throw new Error(`This token can read ${CFG.owner}/${CFG.repo} but cannot write to it. Give it "Contents: Read and write".`);
    }
    state.client = client;
    state.user = user;
    store.set(token, remember);
    await showApp();
  }

  async function showApp() {
    $("#view-login").hidden = true;
    $("#view-app").hidden = false;
    $("#repo-chip").textContent = `${CFG.owner}/${CFG.repo} @ ${CFG.branch}`;
    $("#user-name").textContent = "@" + state.user.login;
    const av = $("#user-avatar");
    if (state.user.avatar_url) av.src = state.user.avatar_url;
    setBusy(true);
    try {
      await refreshTree();
      populatePageSelect();
      setTab("pages");
      await openPage(rootPages().includes("index.html") ? "index.html" : rootPages()[0]);
    } finally { setBusy(false); }
    resetIdle();
  }

  function signOut(message) {
    store.clear();
    Object.assign(state, { client: null, user: null, tree: [], page: null, dirty: false, fileDirty: false, sel: null, history: [], file: null, nav: null });
    state.pending.clear();
    $("#stage").srcdoc = "";
    $("#view-app").hidden = true;
    $("#view-login").hidden = false;
    const err = $("#login-error");
    if (message) { err.textContent = message; err.hidden = false; } else err.hidden = true;
  }

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#login-error"); err.hidden = true;
    const token = $("#token").value.trim();
    if (!token) return;
    const btn = $("#login-btn");
    btn.disabled = true; btn.textContent = "Checking…";
    try { await connect(token, $("#remember").checked); $("#token").value = ""; }
    catch (ex) { err.textContent = ex.message; err.hidden = false; store.clear(); }
    finally { btn.disabled = false; btn.textContent = "Sign in"; }
  });

  $("#btn-signout").addEventListener("click", () => {
    if (hasUnsaved() && !confirm("You have unsaved changes. Sign out anyway?")) return;
    signOut();
  });

  // Sessions that were not "remembered" end after 30 idle minutes.
  let idleTimer;
  function resetIdle() {
    clearTimeout(idleTimer);
    if (!state.client || store.remembered()) return;
    idleTimer = setTimeout(() => { if (!hasUnsaved()) signOut("Signed out after 30 minutes of inactivity."); else resetIdle(); }, IDLE_MS);
  }
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, resetIdle, { passive: true }));

  window.addEventListener("beforeunload", (e) => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ""; } });

  /* ------------------------------------------------------------ tabs */
  function setTab(name) {
    $$(".tab").forEach((b) => { const on = b.dataset.tab === name; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
    $$(".tabpanel").forEach((p) => { p.hidden = p.id !== "tab-" + name; });
    if (name === "files") renderFileList();
    if (name === "nav") loadNav();
  }
  $$(".tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $(".tabs").addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const tabs = $$(".tab"); const i = tabs.findIndex((t) => t.getAttribute("aria-selected") === "true");
    const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setTab(n.dataset.tab); n.focus();
  });

  async function refreshTree() {
    state.tree = await state.client.listTree();
    const folders = new Set(["assets/", "images/"]);
    state.tree.forEach((t) => { const i = t.path.lastIndexOf("/"); if (i > 0) folders.add(t.path.slice(0, i + 1)); });
    $("#folder-list").innerHTML = Array.from(folders).sort().map((f) => `<option value="${esc(f)}">`).join("");
    $("#page-list").innerHTML = rootPages().map((p) => `<option value="${esc(p)}">`).join("");
  }

  /* ============================================================ PAGES (visual editor) */
  const stage = $("#stage");
  const docOf = () => stage.contentDocument;

  const EDITOR_CSS = `
    [contenteditable]{cursor:text;outline:1px dashed transparent;outline-offset:2px;transition:outline-color .15s}
    [contenteditable]:hover{outline-color:rgba(37,99,235,.6)}
    [contenteditable]:focus{outline:2px solid #2563EB}
    [data-admin-selected]{outline:2px solid #10B981!important;outline-offset:3px}
    .reveal{opacity:1!important;transform:none!important}
    .nav-links{display:flex!important}
    a,button{cursor:pointer}
  `;

  function populatePageSelect() {
    $("#page-select").innerHTML = rootPages().map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  }

  async function openPage(path) {
    if (!path) return;
    if (state.dirty && !confirm("You have unsaved changes on this page. Discard them?")) {
      if (state.page) $("#page-select").value = state.page.path;
      return;
    }
    setBusy(true);
    try {
      const f = await state.client.readFile(path);
      const root = new URL("../", location.href).href;
      const html = f.text.replace(/<head([^>]*)>/i, '<head$1><base href="' + root + '" data-admin-injected>');
      await new Promise((resolve) => { stage.onload = resolve; stage.srcdoc = html; });
      state.page = { path: f.path, sha: f.sha };
      state.history = []; state.sel = null; state.pending.clear();
      initEditor(docOf());
      const d = docOf();
      $("#set-title").value = d.title || "";
      const meta = d.querySelector('meta[name="description"]');
      $("#set-desc").value = meta ? meta.getAttribute("content") : "";
      $("#page-select").value = f.path;
      setDirty(false);
      renderInspector();
      updateUndo();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  function setDirty(on) { state.dirty = on; $("#dirty-flag").hidden = !on; }
  const markDirty = () => { if (!state.dirty) setDirty(true); };

  function initEditor(doc) {
    const st = doc.createElement("style");
    st.setAttribute("data-admin-injected", "");
    st.textContent = EDITOR_CSS;
    doc.head.appendChild(st);
    C.markEditable(doc.body);

    doc.addEventListener("click", (e) => {
      e.preventDefault();
      const t = e.target;
      if (!t || t === doc.body || t === doc.documentElement) { select(null); return; }
      select(t);
    }, true);
    doc.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); savePage(); return; }
      if (e.key === "Enter" && !e.shiftKey && e.target.closest && e.target.closest("[contenteditable]")) e.preventDefault();
    });
    doc.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text/plain");
      doc.execCommand("insertText", false, text);
    }, true);
    doc.addEventListener("input", markDirty);
    ["dragover", "drop"].forEach((ev) => doc.addEventListener(ev, (e) => e.preventDefault()));
  }

  function select(el) {
    const d = docOf();
    d.querySelectorAll("[data-admin-selected]").forEach((n) => n.removeAttribute("data-admin-selected"));
    state.sel = el;
    if (el) el.setAttribute("data-admin-selected", "");
    renderInspector();
  }

  const labelOf = (n) => n.tagName.toLowerCase() + (n.classList && n.classList[0] ? "." + n.classList[0] : "");

  function renderInspector() {
    const box = $("#sel-panel");
    const el = state.sel;
    if (!el) {
      box.innerHTML = '<p class="muted">Click anything on the page to select it. Type directly over text to change it.</p>';
      return;
    }
    const chain = [];
    for (let n = el; n && n.tagName !== "BODY" && n.tagName !== "HTML"; n = n.parentElement) chain.push(n);
    state.chain = chain.slice().reverse();

    const a = el.closest("a");
    const isImg = el.tagName === "IMG";
    let fields = "";
    if (a) {
      const newTab = a.getAttribute("target") === "_blank";
      fields += `<div class="sel-block"><h3>Link</h3>
        <div class="field"><label for="f-href">Address</label><input id="f-href" type="text" value="${esc(a.getAttribute("href") || "")}" list="page-list"></div>
        <label class="check"><input id="f-newtab" type="checkbox" ${newTab ? "checked" : ""}> Open in a new tab</label>
        <div><button type="button" class="btn-secondary-sm" data-act="upload-link">Upload a file to link to…</button></div></div>`;
    }
    if (isImg) {
      fields += `<div class="sel-block"><h3>Image</h3>
        <div class="field"><label for="f-alt">Alt text (describes the image)</label><input id="f-alt" type="text" value="${esc(el.getAttribute("alt") || "")}"></div>
        <div class="mono muted">${esc(el.getAttribute("data-admin-src") || el.getAttribute("src") || "")}</div>
        <div><button type="button" class="btn-secondary-sm" data-act="replace-img">Replace image…</button></div></div>`;
    }

    box.innerHTML = `
      <div class="crumbs" role="group" aria-label="Selected element and its parents">
        ${state.chain.map((n, i) => `<button type="button" class="crumb${n === el ? " is-on" : ""}" data-i="${i}">${esc(labelOf(n))}</button>`).join("")}
      </div>
      <div class="sel-actions">
        <button type="button" data-act="dup">Duplicate</button>
        <button type="button" data-act="up">Move up</button>
        <button type="button" data-act="down">Move down</button>
        <button type="button" data-act="parent">Select parent</button>
        <button type="button" data-act="del" class="danger">Delete</button>
      </div>
      ${fields}
      <details class="html-edit"><summary>Edit HTML</summary>
        <label class="sr-only" for="html-edit">HTML of the selected element</label>
        <textarea id="html-edit" rows="9" spellcheck="false">${esc(C.cleanFragment(el))}</textarea>
        <button type="button" class="btn-secondary-sm" data-act="apply-html">Apply HTML</button>
      </details>`;
  }

  /* ---- structure operations (all undoable) ---- */
  function snapshot() {
    state.history.push(docOf().body.innerHTML);
    if (state.history.length > 40) state.history.shift();
    updateUndo();
  }
  function updateUndo() { $("#btn-undo").disabled = state.history.length === 0; }
  function undo() {
    const prev = state.history.pop();
    if (prev == null) return;
    const d = docOf();
    d.body.innerHTML = prev;
    d.querySelectorAll("[data-admin-selected]").forEach((n) => n.removeAttribute("data-admin-selected"));
    state.sel = null; renderInspector(); updateUndo(); markDirty();
  }
  $("#btn-undo").addEventListener("click", undo);

  async function stageUpload(file, folder) {
    if (file.size > C.MAX_UPLOAD_BYTES) throw new Error(`${file.name} is ${fmtSize(file.size)}. The limit here is 50 MB; add larger files with Git.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const taken = new Set(state.tree.map((t) => t.path));
    state.pending.forEach((_v, k) => taken.add(k));
    const path = C.uniquePath(folder + C.slugifyFilename(file.name), taken);
    state.pending.set(path, { base64: C.bytesToB64(bytes) });
    return { path, url: URL.createObjectURL(file) };
  }
  function pickFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file"; if (accept) input.accept = accept;
      input.onchange = () => resolve(input.files[0] || null);
      input.click();
    });
  }

  $("#sel-panel").addEventListener("click", async (e) => {
    const crumb = e.target.closest(".crumb");
    if (crumb) { select(state.chain[+crumb.dataset.i]); return; }
    const btn = e.target.closest("[data-act]");
    if (!btn || !state.sel) return;
    const el = state.sel; const d = docOf();
    try {
      switch (btn.dataset.act) {
        case "dup": {
          snapshot();
          const clone = el.cloneNode(true);
          clone.removeAttribute("data-admin-selected");
          if (clone.removeAttribute) clone.removeAttribute("id");
          clone.querySelectorAll("[id]").forEach((n) => n.removeAttribute("id"));
          el.after(clone); markDirty(); select(clone); break;
        }
        case "up": { const p = el.previousElementSibling; if (!p) return toast("Already first."); snapshot(); p.before(el); markDirty(); renderInspector(); el.scrollIntoView({ block: "center" }); break; }
        case "down": { const n = el.nextElementSibling; if (!n) return toast("Already last."); snapshot(); n.after(el); markDirty(); renderInspector(); el.scrollIntoView({ block: "center" }); break; }
        case "parent": { const p = el.parentElement; if (p && p.tagName !== "BODY") select(p); break; }
        case "del": {
          if (!confirm(`Delete this ${labelOf(el)} and everything inside it?`)) return;
          snapshot(); const p = el.parentElement; el.remove(); markDirty();
          select(p && p.tagName !== "BODY" ? p : null); break;
        }
        case "apply-html": {
          const value = $("#html-edit").value.trim();
          if (!value) return toast("HTML can't be empty. Use Delete to remove an element.", "error");
          const tpl = d.createElement("template"); tpl.innerHTML = value;
          const first = tpl.content.firstElementChild;
          snapshot(); el.replaceWith(tpl.content); C.markEditable(d.body); markDirty(); select(first || null); break;
        }
        case "replace-img": {
          const f = await pickFile("image/*"); if (!f) return;
          const { path, url } = await stageUpload(f, "images/");
          snapshot(); el.setAttribute("src", url); el.setAttribute("data-admin-src", path); el.removeAttribute("srcset");
          markDirty(); renderInspector(); toast(`Image staged as ${path}. It publishes when you save.`); break;
        }
        case "upload-link": {
          const f = await pickFile(); if (!f) return;
          const { path } = await stageUpload(f, "assets/");
          el.closest("a").setAttribute("href", path); markDirty(); renderInspector(); toast(`File staged as ${path}. It publishes when you save.`); break;
        }
      }
    } catch (ex) { toast(ex.message, "error"); }
  });

  $("#sel-panel").addEventListener("input", (e) => {
    const el = state.sel; if (!el) return;
    if (e.target.id === "f-href") { el.closest("a").setAttribute("href", e.target.value); markDirty(); }
    if (e.target.id === "f-alt") { el.setAttribute("alt", e.target.value); markDirty(); }
  });
  $("#sel-panel").addEventListener("change", (e) => {
    if (e.target.id !== "f-newtab" || !state.sel) return;
    const a = state.sel.closest("a");
    if (e.target.checked) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
    else { a.removeAttribute("target"); a.removeAttribute("rel"); }
    markDirty();
  });

  /* page settings */
  $("#set-title").addEventListener("input", (e) => { docOf().title = e.target.value; markDirty(); });
  $("#set-desc").addEventListener("input", (e) => {
    const d = docOf(); let m = d.querySelector('meta[name="description"]');
    if (!m) { m = d.createElement("meta"); m.setAttribute("name", "description"); d.head.appendChild(m); }
    m.setAttribute("content", e.target.value); markDirty();
  });

  /* toolbar */
  $("#page-select").addEventListener("change", (e) => openPage(e.target.value));
  $$(".seg button").forEach((b) => b.addEventListener("click", () => {
    $$(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    stage.style.width = b.dataset.w;
  }));
  $("#btn-save").addEventListener("click", savePage);

  async function savePage() {
    if (!state.page) return;
    if (!state.dirty && !state.pending.size) { toast("No changes to save."); return; }
    const path = state.page.path;
    const changes = [{ path, text: C.cleanSerialize(docOf()) }];
    state.pending.forEach((v, p) => changes.push({ path: p, base64: v.base64 }));
    const message = $("#commit-msg").value.trim() || `Update ${path} via admin panel`;
    setBusy(true);
    try {
      try {
        await state.client.commit({ message, changes, expect: { [path]: state.page.sha } });
      } catch (e) {
        if (!(e instanceof C.ConflictError)) throw e;
        if (!confirm(`${path} changed on GitHub after you opened it. Overwrite it with your version?`)) throw new Error("Save cancelled. Reload the page to see the latest version.");
        await state.client.commit({ message, changes });
      }
      state.page.sha = (await state.client.readFile(path)).sha;
      state.pending.clear(); setDirty(false); $("#commit-msg").value = "";
      await refreshTree();
      toast("Saved. The site redeploys automatically, usually within a minute.", "ok");
      watchDeploy();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }

  let deployRun = 0;
  async function watchDeploy() {
    const run = ++deployRun, out = $("#deploy-status");
    out.className = "deploy is-pending"; out.textContent = "Publishing…";
    await new Promise((r) => setTimeout(r, 4000));
    for (let i = 0; i < 30 && run === deployRun; i++) {
      const s = await state.client.pagesStatus();
      if (s === null) { out.textContent = ""; return; }   // endpoint unavailable: stay quiet
      if (s === "built") { out.className = "deploy"; out.textContent = "Live ✓"; setTimeout(() => { if (run === deployRun) out.textContent = ""; }, 15000); return; }
      if (s === "errored") { out.className = "deploy"; out.textContent = "Publish failed: check the repo's Actions tab"; return; }
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (run === deployRun) out.textContent = "";
  }

  /* ============================================================ FILES */
  function renderFileList() {
    const q = $("#file-search").value.trim().toLowerCase();
    const items = state.tree.filter((t) => !q || t.path.toLowerCase().includes(q)).sort((a, b) => a.path.localeCompare(b.path));
    $("#file-list").innerHTML = items.map((t) => `<li><button type="button" class="file-item${state.file && state.file.path === t.path ? " is-on" : ""}" data-path="${esc(t.path)}"><span>${esc(t.path)}</span><small>${fmtSize(t.size)}</small></button></li>`).join("") || '<li class="muted" style="padding:.75rem">No files match.</li>';
  }
  $("#file-search").addEventListener("input", renderFileList);
  $("#file-list").addEventListener("click", (e) => { const b = e.target.closest(".file-item"); if (b) openFile(b.dataset.path); });

  async function openFile(path) {
    if (state.fileDirty && !confirm("Discard unsaved changes to the open file?")) return;
    setBusy(true);
    try {
      const isText = C.TEXT_EXT.test(path), isImg = C.IMAGE_EXT.test(path);
      const entry = state.tree.find((t) => t.path === path);
      $("#file-empty").hidden = true; $("#file-view").hidden = false;
      $("#file-title").textContent = path;
      $("#file-open").href = "../" + path.split("/").map(encodeURIComponent).join("/");
      const ta = $("#file-text"), media = $("#file-media");
      ta.hidden = !isText; media.hidden = isText;
      if (isText) {
        const f = await state.client.readFile(path);
        ta.value = f.text;
        state.file = { path, sha: f.sha, original: f.text, kind: "text" };
        $("#file-save").hidden = false; $("#file-revert").hidden = false;
      } else {
        state.file = { path, sha: entry ? entry.sha : null, original: null, kind: "binary" };
        const href = "../" + path.split("/").map(encodeURIComponent).join("/");
        media.innerHTML = isImg
          ? `<img src="${esc(href)}" alt="Preview of ${esc(path)}"><p class="muted">Preview shows the live site, so a very recent upload may take a minute to appear.</p>`
          : `<p class="muted">${esc(path)} is a binary file (${fmtSize(entry ? entry.size : 0)}). It can't be edited here, but you can delete it or upload a replacement with the same name from the upload box.</p>`;
        $("#file-save").hidden = true; $("#file-revert").hidden = true;
      }
      state.fileDirty = false; $("#file-dirty").hidden = true;
      renderFileList();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  $("#file-text").addEventListener("input", () => { state.fileDirty = true; $("#file-dirty").hidden = false; });
  $("#file-revert").addEventListener("click", () => { if (state.file) { $("#file-text").value = state.file.original; state.fileDirty = false; $("#file-dirty").hidden = true; } });

  async function saveFile() {
    const f = state.file; if (!f || f.kind !== "text") return;
    const text = $("#file-text").value;
    if (/\.json$|\.webmanifest$/i.test(f.path)) { try { JSON.parse(text); } catch (e) { toast("That isn't valid JSON: " + e.message, "error"); return; } }
    setBusy(true);
    try {
      const msg = `Edit ${f.path} via admin panel`;
      try { await state.client.commit({ message: msg, changes: [{ path: f.path, text }], expect: { [f.path]: f.sha } }); }
      catch (e) {
        if (!(e instanceof C.ConflictError)) throw e;
        if (!confirm(`${f.path} changed on GitHub after you opened it. Overwrite it?`)) throw new Error("Save cancelled.");
        await state.client.commit({ message: msg, changes: [{ path: f.path, text }] });
      }
      const fresh = await state.client.readFile(f.path);
      Object.assign(f, { sha: fresh.sha, original: text });
      state.fileDirty = false; $("#file-dirty").hidden = true;
      await refreshTree(); renderFileList();
      toast("Saved. The site redeploys automatically, usually within a minute.", "ok"); watchDeploy();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  $("#file-save").addEventListener("click", saveFile);

  $("#file-delete").addEventListener("click", async () => {
    const f = state.file; if (!f) return;
    if (!confirm(`Delete ${f.path}? This is committed to Git, so it can be restored from history, but the live site will lose the file.`)) return;
    setBusy(true);
    try {
      await state.client.commit({ message: `Delete ${f.path} via admin panel`, changes: [{ path: f.path, delete: true }] });
      state.file = null; state.fileDirty = false;
      $("#file-view").hidden = true; $("#file-empty").hidden = false;
      await refreshTree(); populatePageSelect(); renderFileList();
      toast("Deleted.", "ok"); watchDeploy();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  });

  $("#btn-upload").addEventListener("click", async () => {
    const files = Array.from($("#upload-input").files);
    if (!files.length) return toast("Choose one or more files first.", "error");
    let folder = $("#upload-folder").value.trim().replace(/^\/+/, "");
    if (folder && !folder.endsWith("/")) folder += "/";
    setBusy(true);
    try {
      const taken = new Set(state.tree.map((t) => t.path));
      const changes = [];
      for (const f of files) {
        if (f.size > C.MAX_UPLOAD_BYTES) throw new Error(`${f.name} is ${fmtSize(f.size)}; the limit here is 50 MB.`);
        const path = C.uniquePath(folder + C.slugifyFilename(f.name), taken); taken.add(path);
        changes.push({ path, base64: C.bytesToB64(new Uint8Array(await f.arrayBuffer())) });
      }
      await state.client.commit({ message: `Upload ${changes.length} file(s) via admin panel`, changes });
      $("#upload-input").value = "";
      await refreshTree(); renderFileList();
      toast(`Uploaded: ${changes.map((c) => c.path).join(", ")}`, "ok"); watchDeploy();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  });

  /* new page */
  const dlg = $("#dlg-newpage");
  $("#btn-newpage").addEventListener("click", () => {
    $("#np-template").innerHTML = rootPages().map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
    $("#np-error").hidden = true; $("#newpage-form").reset(); dlg.showModal();
  });
  $("#np-cancel").addEventListener("click", () => dlg.close());
  $("#newpage-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = $("#np-file").value.trim(), title = $("#np-title").value.trim(), tpl = $("#np-template").value;
    const err = $("#np-error");
    if (!/^[a-z0-9-]+\.html$/.test(file)) { err.textContent = "Use lowercase letters, numbers and hyphens, ending in .html."; err.hidden = false; return; }
    if (state.tree.some((t) => t.path === file)) { err.textContent = file + " already exists."; err.hidden = false; return; }
    setBusy(true);
    try {
      const src = await state.client.readFile(tpl);
      const navItems = C.parseNav((await state.client.readFile("index.html")).text) || [];
      let html = src.text.replace(/<title>[\s\S]*?<\/title>/, "<title>" + esc(title) + "</title>");
      html = C.applyNavToHtml(html, navItems, file);
      await state.client.commit({ message: `Add ${file} via admin panel`, changes: [{ path: file, text: html }] });
      dlg.close(); await refreshTree(); populatePageSelect(); setTab("pages"); await openPage(file);
      toast(`Created ${file}. Add it to the menu under Navigation if you want it linked.`, "ok"); watchDeploy();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    finally { setBusy(false); }
  });

  /* ============================================================ NAVIGATION */
  async function loadNav() {
    if (state.nav) { renderNav(); return; }
    setBusy(true);
    try {
      const items = C.parseNav((await state.client.readFile("index.html")).text);
      if (!items) throw new Error("Couldn't find the menu in index.html (expected <ul class=\"nav-links\" id=\"nav-menu\">).");
      state.nav = items; renderNav();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  }
  function renderNav() {
    $("#nav-rows").innerHTML = state.nav.map((it, i) => `
      <li class="nav-row" data-i="${i}">
        <input type="text" data-k="label" value="${esc(it.label)}" aria-label="Link text ${i + 1}">
        <input type="text" data-k="href" value="${esc(it.href)}" list="page-list" aria-label="Link address ${i + 1}">
        <span class="btns">
          <button type="button" data-a="up" aria-label="Move up">&uarr;</button>
          <button type="button" data-a="down" aria-label="Move down">&darr;</button>
          <button type="button" data-a="del" aria-label="Remove">&times;</button>
        </span>
      </li>`).join("");
  }
  $("#nav-rows").addEventListener("input", (e) => { const row = e.target.closest(".nav-row"); if (row && e.target.dataset.k) state.nav[+row.dataset.i][e.target.dataset.k] = e.target.value; });
  $("#nav-rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-a]"); if (!b) return;
    const i = +b.closest(".nav-row").dataset.i, n = state.nav;
    if (b.dataset.a === "del") n.splice(i, 1);
    if (b.dataset.a === "up" && i > 0) [n[i - 1], n[i]] = [n[i], n[i - 1]];
    if (b.dataset.a === "down" && i < n.length - 1) [n[i + 1], n[i]] = [n[i], n[i + 1]];
    renderNav();
  });
  $("#nav-add").addEventListener("click", () => { state.nav.push({ label: "New link", href: "" }); renderNav(); });
  $("#nav-apply").addEventListener("click", async () => {
    if (hasUnsaved()) return toast("Save or discard your open page/file edits first, so they aren't overwritten.", "error");
    const items = state.nav.map((i) => ({ label: i.label.trim(), href: i.href.trim() }));
    if (!items.length || items.some((i) => !i.label || !i.href)) return toast("Every link needs text and an address.", "error");
    setBusy(true);
    try {
      const changes = [];
      await Promise.all(rootPages().map(async (p) => {
        const f = await state.client.readFile(p);
        const next = C.applyNavToHtml(f.text, items, p);
        if (next !== f.text) changes.push({ path: p, text: next });
      }));
      if (!changes.length) { toast("Menu is already up to date on every page."); return; }
      await state.client.commit({ message: "Update navigation menu via admin panel", changes });
      state.nav = null; await loadNav();
      if (state.page) await openPage(state.page.path);
      toast(`Menu updated on ${changes.length} page(s).`, "ok"); watchDeploy();
    } catch (e) { toast(e.message, "error"); }
    finally { setBusy(false); }
  });

  /* ============================================================ shortcuts + boot */
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "s" || !state.client) return;
    e.preventDefault();
    const tab = $(".tab[aria-selected='true']").dataset.tab;
    if (tab === "pages") savePage(); else if (tab === "files") saveFile();
  });

  (async function boot() {
    const token = store.get();
    if (!token) { $("#view-login").hidden = false; return; }
    try { await connect(token, store.remembered()); }
    catch (e) { store.clear(); $("#view-login").hidden = false; const err = $("#login-error"); err.textContent = "Saved session no longer valid: " + e.message; err.hidden = false; }
  })();
})();
