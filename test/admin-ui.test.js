'use strict';
// Runs the real admin scripts (deploy indicator, dashboard) in a simulated browser against a mocked GitHub API,
// and statically verifies that every Decap `CMS.*` method used actually exists in the pinned Decap build.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');

const ADMIN = path.join(__dirname, '..', 'admin');
const ORIGIN = 'https://wajiha-waqar-portfolio.netlify.app';
const REPO = 'Wajiha-Waqar/wajiha-waqar-portfolio';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, ms = 4000) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = fn(); if (v) return v; } catch (e) { /* retry */ } await wait(20); } throw new Error('timed out: ' + label); }

const OPEN = [];
test.after(() => OPEN.forEach((dom) => { try { dom.window.close(); } catch (e) { /* already closed */ } }));

class Local extends ResourceLoader {
  fetch(url) { const base = ORIGIN + '/admin/'; if (url.startsWith(base)) { const p = path.join(ADMIN, url.slice(base.length).split('?')[0]); return Promise.resolve(fs.existsSync(p) ? fs.readFileSync(p) : Buffer.from('')); } return Promise.resolve(Buffer.from('')); }
}

/** Mock GitHub + site. `o` tweaks the scenario. */
function backend(o = {}) {
  const s = { login: 'Wajiha-Waqar', headSha: 'head111', liveCommit: 'head111', ageMin: 30, statuses: [], prs: [], commits: [], counts: { projects: 8, experience: 2, certificates: 2, research: 2 }, ...o };
  const calls = [];
  const R = (obj, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => obj, text: async () => (typeof obj === 'string' ? obj : JSON.stringify(obj)) });
  const fetchImpl = (url) => {
    const u = String(url); calls.push(u);
    if (u.includes('config.yml')) return R(fs.readFileSync(path.join(ADMIN, 'config.yml'), 'utf8'));
    if (u.includes('build-info.json')) return R({ commit: s.liveCommit });
    if (!u.startsWith('https://api.github.com')) return R({}, 404);
    const p = u.slice('https://api.github.com'.length);
    if (p === '/user') return R({ login: s.login });
    if (p === `/repos/${REPO}/commits/main`) return R({ sha: s.headSha, html_url: 'https://github.com/x/commit/' + s.headSha, commit: { message: 'm', committer: { date: new Date(Date.now() - s.ageMin * 60000).toISOString() } } });
    let m = /^\/repos\/[^/]+\/[^/]+\/commits\/(\w+)\/status$/.exec(p); if (m) return R({ statuses: s.statuses[m[1]] || (m[1] === s.headSha && Array.isArray(s.statuses) ? s.statuses : []) });
    if (p.startsWith(`/repos/${REPO}/pulls`)) return R(s.prs);
    if (p.startsWith(`/repos/${REPO}/commits?`)) return R(s.commits);
    m = /^\/repos\/[^/]+\/[^/]+\/contents\/content\/(\w+)\?/.exec(p); if (m) return R(Array.from({ length: s.counts[m[1]] }, (_, i) => ({ name: `f${i}.json` })));
    return R({ message: 'unexpected ' + p }, 404);
  };
  return { fetchImpl, calls, state: s };
}
async function load(file, { token = 'tok', mock, CMS } = {}) {
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => { if (!/Could not load|fonts/.test(e.message)) errors.push(e.message); });
  const dom = await JSDOM.fromFile(path.join(ADMIN, file), { url: ORIGIN + '/admin/' + file, runScripts: 'dangerously', resources: new Local(), pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.fetch = mock.fetchImpl; if (token) w.localStorage.setItem('decap-cms-user', JSON.stringify({ token, backendName: 'github' })); if (CMS) w.CMS = CMS; w.addEventListener('error', (e) => errors.push('window error: ' + e.message)); } });
  OPEN.push(dom);
  await new Promise((r) => (dom.window.document.readyState === 'complete' ? r() : dom.window.addEventListener('load', r)));
  return { dom, d: dom.window.document, errors };
}

/* ---------------------------------------------------------------- static API guard */
test('admin-extras only calls Decap CMS methods that exist in the pinned build (the registerAdditionalLink bug)', () => {
  const reg = path.join(__dirname, '..', 'node_modules/decap-cms-core/dist/esm/lib/registry.js');
  if (!fs.existsSync(reg)) return;
  const src = fs.readFileSync(reg, 'utf8');
  const exposed = new Set([...src.slice(src.indexOf('export default {')).matchAll(/^\s{2}(register\w+|get\w+|removeEventListener|invokeEvent)\b/gm)].map((m) => m[1]));
  exposed.add('init');
  const used = (code) => [...code.matchAll(/\bCMS\.(\w+)\s*\(/g)].map((m) => m[1]);
  const unknown = (code) => used(code).filter((n) => !exposed.has(n));
  assert.deepEqual(unknown(fs.readFileSync(path.join(ADMIN, 'admin-extras.js'), 'utf8')), [], 'admin-extras.js calls an API Decap does not have');
  assert.deepEqual(unknown('window.CMS.registerAdditionalLink({})'), ['registerAdditionalLink'], 'control: the checker must flag a non-existent API');
  assert.ok(exposed.has('registerEventListener'));
});

/* ---------------------------------------------------------------- deploy indicator */
test('indicator: loads without errors, adds the Dashboard link, and hides itself when signed out', async () => {
  const handlers = {}; const CMS = { registerEventListener: (o) => { handlers[o.name] = o.handler; } };
  const a = await load('index.html', { mock: backend(), CMS });
  assert.deepEqual(a.errors, []); assert.equal(typeof handlers.postPublish, 'function', 'subscribes to postPublish');
  const link = a.d.querySelector('#admin-dock a.dock-link'); assert.equal(link.getAttribute('href'), '/admin/dashboard.html'); assert.equal(link.textContent, 'Dashboard');
  await until(() => !a.d.getElementById('admin-dock').hidden, 'dock visible');
  const b = await load('index.html', { token: '', mock: backend(), CMS });
  await wait(100); assert.ok(b.d.getElementById('admin-dock').hidden, 'nothing shown without a sign-in'); assert.deepEqual(b.errors, []);
});
test('indicator: Publish immediately shows "deploying", then "live" once the live build matches the latest commit', async () => {
  const handlers = {}; const mock = backend({ headSha: 'new222', liveCommit: 'old111', ageMin: 1 });
  const { d } = await load('index.html', { mock, CMS: { registerEventListener: (o) => { handlers[o.name] = o.handler; } } });
  handlers.postPublish();
  assert.equal(d.getElementById('deploy-pill').dataset.state, 'deploying'); assert.match(d.querySelector('#deploy-pill .txt').textContent, /Publishing/);
  await until(() => /Deploying/.test(d.querySelector('#deploy-pill .txt').textContent), 'deploying after check');
  mock.state.liveCommit = 'new222'; handlers.postPublish();
  await until(() => d.getElementById('deploy-pill').dataset.state === 'live', 'live'); assert.match(d.querySelector('#deploy-pill .txt').textContent, /up to date/);
});
test('indicator: a failed Netlify deploy is reported as failed, with a link to the log', async () => {
  const handlers = {}; const mock = backend({ headSha: 'bad333', liveCommit: 'old111', ageMin: 2, statuses: [{ context: 'netlify/site/deploy', state: 'failure', target_url: 'https://app.netlify.com/log/1' }] });
  const { d } = await load('index.html', { mock, CMS: { registerEventListener: (o) => { handlers[o.name] = o.handler; } } });
  handlers.postPublish();
  await until(() => d.getElementById('deploy-pill').dataset.state === 'failed', 'failed');
  const more = d.querySelector('#deploy-pill .more'); assert.ok(!more.hidden); assert.equal(more.getAttribute('href'), 'https://app.netlify.com/log/1');
});

/* ---------------------------------------------------------------- dashboard */
const PRS = [
  { title: 'Update projects "x" via CMS', head: { ref: 'cms/projects/x', sha: 'pr111' }, labels: [{ name: 'decap-cms/pending_review' }] },
  { title: '<img src=x onerror=alert(1)> evil', head: { ref: 'cms/projects/evil', sha: 'pr222' }, labels: [{ name: 'decap-cms/draft' }] },
  { title: 'Unrelated dependency bump', head: { ref: 'dependabot/npm/x', sha: 'pr333' }, labels: [] },
];
test('dashboard: the owner sees live status, drafts with stage + preview link, counts and recent publishes', async () => {
  const mock = backend({ prs: PRS, statuses: { head111: [], pr111: [{ context: 'netlify/site/deploy-preview', state: 'success', target_url: 'https://deploy-preview-7--site.netlify.app' }], pr222: [] },
    commits: [{ sha: 'head111', html_url: 'https://github.com/x/commit/head111', commit: { message: 'Update projects "x" via CMS\n\nbody', committer: { date: new Date().toISOString() } } }] });
  const { d, errors } = await load('dashboard.html', { mock });
  await until(() => d.getElementById('content').getAttribute('aria-busy') === 'false', 'dashboard loaded');
  assert.deepEqual(errors, []);
  assert.match(d.getElementById('acct').textContent, /Authorized/); assert.match(d.getElementById('acct').textContent, /@Wajiha-Waqar/);
  assert.match(d.getElementById('live').textContent, /Live site is up to date/);
  const rows = [...d.querySelectorAll('#pending li')]; assert.equal(rows.length, 2, 'only cms/ branches are listed');
  assert.match(rows[0].textContent, /In review/); assert.equal(rows[0].querySelector('a[href^="https://deploy-preview"]').textContent, 'Open preview');
  assert.match(rows[1].textContent, /Draft/); assert.match(rows[1].textContent, /Preview building/);
  assert.equal(d.querySelector('#pending img'), null, 'a PR title containing HTML must be shown as text, never rendered');
  assert.match(d.getElementById('pending').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.deepEqual([...d.querySelectorAll('#counts b')].map((b) => b.textContent), ['8', '2', '2', '2']);
  assert.match(d.getElementById('recent').textContent, /Update projects "x" via CMS/); assert.ok(d.querySelector('#recent a[href*="commit/head111"]'));
});
test('dashboard: a different GitHub account sees nothing and no repository data is requested', async () => {
  const mock = backend({ login: 'mallory', prs: PRS });
  const { d } = await load('dashboard.html', { mock });
  await until(() => !d.getElementById('gate').hidden, 'gate');
  assert.match(d.getElementById('gate').textContent, /not the site owner/); assert.ok(d.getElementById('content').hidden);
  assert.ok(!mock.calls.some((u) => /pulls|contents|commits/.test(u)), 'no repo data fetched for a non-owner');
});
test('dashboard: signed out, it only points to the sign-in page and calls nothing', async () => {
  const mock = backend(); const { d } = await load('dashboard.html', { token: '', mock });
  await until(() => !d.getElementById('gate').hidden, 'gate'); assert.match(d.getElementById('gate').textContent, /Sign in/); assert.equal(mock.calls.filter((u) => u.includes('api.github.com')).length, 0);
});
