(function () {
  'use strict';
  const core = window.DeployCore;
  const $ = (selector) => document.querySelector(selector);
  const gate = $('#gate');
  const content = $('#content');
  const say = (node, text) => { node.textContent = text; };
  const showGate = (message) => { say(gate, message); gate.hidden = false; content.hidden = true; content.setAttribute('aria-busy', 'false'); };
  const owner = (repo) => repo.split('/')[0];

  async function loadDashboard() {
    const token = core.readToken(localStorage);
    if (!token) { showGate('Sign in to the content manager to view dashboard data.'); return; }
    const configResponse = await fetch('config.yml', { cache: 'no-store' });
    if (!configResponse.ok) throw new Error('Could not load the CMS repository configuration.');
    const backend = core.parseBackend(await configResponse.text());
    if (!backend) throw new Error('The CMS repository configuration is invalid.');
    const api = (path) => fetch(`https://api.github.com${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error(`GitHub API request failed (${response.status}).`);
      return response.json();
    });
    const account = await api('/user');
    if (!account.login || account.login.toLowerCase() !== owner(backend.repo).toLowerCase()) {
      showGate('This GitHub account is not the site owner. Sign in with the authorized account.');
      return;
    }
    content.hidden = false;
    $('#acct').textContent = `Authorized · @${account.login}`;
    const repo = `/repos/${backend.repo}`;
    const [head, build, prs, commits, ...counts] = await Promise.all([
      api(`${repo}/commits/${encodeURIComponent(backend.branch)}`),
      fetch('/build-info.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : {}),
      api(`${repo}/pulls?state=open&per_page=100`),
      api(`${repo}/commits?per_page=5`),
      ...['projects', 'experience', 'certificates', 'research'].map((name) => api(`${repo}/contents/content/${name}?ref=${encodeURIComponent(backend.branch)}`).then((rows) => rows.length)),
    ]);
    const statuses = await api(`${repo}/commits/${head.sha}/status`).then((result) => result.statuses || []).catch(() => []);
    const deploy = core.computeDeployState({ headSha: head.sha, liveCommit: build.commit, statuses, headAgeMs: Date.now() - new Date(head.commit.committer.date).getTime() });
    const live = $('#live');
    live.textContent = deploy.label;
    live.dataset.state = deploy.state;
    if (deploy.url) { const a = document.createElement('a'); a.href = deploy.url; a.textContent = 'Open deploy log'; a.rel = 'noopener'; a.target = '_blank'; live.append(' ', a); }
    const names = ['Projects', 'Experience', 'Certificates', 'Research'];
    const countsList = $('#counts');
    counts.forEach((value, index) => {
      const li = document.createElement('li');
      const label = document.createElement('span'); label.textContent = `${names[index]} `;
      const count = document.createElement('b'); count.textContent = String(value);
      li.append(label, count); countsList.append(li);
    });
    const pending = $('#pending');
    for (const pr of prs.filter((item) => item.head && /^cms\//.test(item.head.ref))) {
      const li = document.createElement('li');
      const stageLabel = (pr.labels || []).map((label) => label.name).find((name) => name.startsWith('decap-cms/')) || 'decap-cms/draft';
      const stage = { 'decap-cms/pending_review': 'In review', 'decap-cms/approved': 'Ready', 'decap-cms/draft': 'Draft' }[stageLabel] || stageLabel.replace('decap-cms/', '').replace(/_/g, ' ');
      li.append(document.createTextNode(`${pr.title} · ${stage} · `));
      const previewStatus = await api(`${repo}/commits/${pr.head.sha}/status`).then((result) => result.statuses || []).catch(() => []);
      const preview = previewStatus.find((status) => /deploy-preview/i.test(status.context || ''));
      if (preview && preview.state === 'success' && /^https:\/\//.test(preview.target_url || '')) {
        const a = document.createElement('a'); a.href = preview.target_url; a.textContent = 'Open preview'; a.target = '_blank'; a.rel = 'noopener'; li.append(a);
      } else li.append(document.createTextNode('Preview building'));
      pending.append(li);
    }
    const recent = $('#recent');
    for (const commit of commits) {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = commit.html_url; a.textContent = (commit.commit.message || '').split('\n')[0]; a.target = '_blank'; a.rel = 'noopener';
      li.append(a); recent.append(li);
    }
    content.setAttribute('aria-busy', 'false');
  }
  loadDashboard().catch((error) => showGate(`Dashboard unavailable: ${error.message}`));
})();
