/* Additions on top of Decap: a Dashboard link and a live deploy-status indicator (bottom-left). */
(function () {
  'use strict';
  const D = window.DeployCore;

  const dock = document.createElement('div');
  dock.id = 'admin-dock'; dock.hidden = true;
  const dash = document.createElement('a');
  dash.className = 'dock-link'; dash.href = '/admin/dashboard.html'; dash.textContent = 'Dashboard';
  const pill = document.createElement('div');
  pill.id = 'deploy-pill'; pill.setAttribute('role', 'status'); pill.setAttribute('aria-live', 'polite'); pill.hidden = true;
  const dot = document.createElement('span'); dot.className = 'dot'; dot.setAttribute('aria-hidden', 'true');
  const txt = document.createElement('span'); txt.className = 'txt';
  const more = document.createElement('a'); more.className = 'more'; more.textContent = 'Details'; more.target = '_blank'; more.rel = 'noopener'; more.hidden = true;
  pill.append(dot, txt, more);
  dock.append(dash, pill);
  document.body.appendChild(dock);

  let backend = null, timer = null, fast = false;
  const show = (state, label, url) => {
    pill.hidden = false; pill.dataset.state = state; txt.textContent = label;
    if (url) { more.href = url; more.hidden = false; } else more.hidden = true;
  };

  async function check() {
    const token = D.readToken(localStorage);
    dock.hidden = !token;
    if (!token) return;
    try {
      if (!backend) backend = D.parseBackend(await (await fetch('config.yml', { cache: 'no-store' })).text());
      if (!backend) return;
      const gh = (p) => fetch('https://api.github.com' + p, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
      const head = await gh(`/repos/${backend.repo}/commits/${encodeURIComponent(backend.branch)}`);
      const live = await fetch('/build-info.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
      const statuses = (await gh(`/repos/${backend.repo}/commits/${head.sha}/status`).catch(() => ({ statuses: [] }))).statuses;
      const s = D.computeDeployState({ headSha: head.sha, liveCommit: live.commit, statuses, headAgeMs: Date.now() - new Date(head.commit.committer.date).getTime() });
      show(s.state, s.label, s.url);
      fast = s.state === 'deploying';
    } catch (e) { show('unknown', 'Deploy status unavailable'); }
  }
  function loop() { clearTimeout(timer); timer = setTimeout(async () => { await check(); loop(); }, fast ? 6000 : 45000); }
  function watch(now) { fast = true; if (now) { dock.hidden = false; show('deploying', 'Publishing. Waiting for the deploy to start'); } return check().then(loop); }

  // After "Publish", watch until the new commit is live. (Decap exposes this event; it has no API for extra header links.)
  if (window.CMS && typeof window.CMS.registerEventListener === 'function') {
    window.CMS.registerEventListener({ name: 'postPublish', handler: () => watch(true) });
  }
  window.addEventListener('storage', (e) => { if (/decap-cms-user/.test(e.key || '')) watch(); });
  setTimeout(() => watch(), 2500);
})();
