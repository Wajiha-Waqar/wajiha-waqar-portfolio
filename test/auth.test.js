'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { JSDOM } = require('jsdom');
const { createHandlers } = require('../netlify/functions/lib/oauth');
// Decap's client expects browser globals at import time
global.window = new JSDOM('<!doctype html>', { url: 'https://wajiha-waqar-portfolio.netlify.app/admin/' }).window; global.document = global.window.document;
const { NetlifyAuthenticator } = require('decap-cms-lib-auth');
delete global.window; delete global.document;

const SITE = 'https://wajiha-waqar-portfolio.netlify.app';
const ENV = { GITHUB_CLIENT_ID: 'cid123', GITHUB_CLIENT_SECRET: 'SECRET-xyz-789', ALLOWED_GITHUB_USER: 'Wajiha-Waqar', GITHUB_REPO: 'Wajiha-Waqar/wajiha-waqar-portfolio', URL: SITE, OAUTH_SCOPE: 'repo' };
const fixed = (n) => Buffer.alloc(n, 7);
const STATE = Buffer.alloc(24, 7).toString('hex');

/** Fake GitHub. `user` = the account that signs in; `push` = whether it can write to the repo. */
function github({ user = 'Wajiha-Waqar', push = true, token = 'gho_REALTOKEN', tokenOk = true } = {}) {
  const calls = [];
  const impl = async (url, o = {}) => {
    calls.push({ url, method: o.method || 'GET', body: o.body, auth: (o.headers || {}).Authorization });
    const R = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj });
    if (url.endsWith('/login/oauth/access_token')) return R(tokenOk ? { access_token: token } : { error: 'bad_verification_code' });
    if (url.endsWith('/user')) return R({ login: user });
    if (/\/repos\//.test(url)) return R({ permissions: { push } });
    if (/\/applications\/.+\/token/.test(url)) return R({}, 204);
    return R({ message: 'unexpected ' + url }, 404);
  };
  return { impl, calls };
}
const mk = (gh, env = ENV) => createHandlers({ env, fetchImpl: gh.impl, randomBytes: fixed });
const cbEvent = (q = {}, cookie = `cms_oauth_state=${STATE}`) => ({ queryStringParameters: { code: 'abc', state: STATE, ...q }, headers: { cookie, host: 'wajiha-waqar-portfolio.netlify.app' } });
const sent = (res) => /authorization:github:success:/.test(res.body);

test('auth: redirects to GitHub with server-controlled scope, state cookie, allow_signup=false and the account hint', async () => {
  const res = await mk(github()).auth({ queryStringParameters: { provider: 'github', site_id: 'x', scope: 'admin:org delete_repo' }, headers: {} });
  assert.equal(res.statusCode, 302);
  const u = new URL(res.headers.Location);
  assert.equal(u.origin + u.pathname, 'https://github.com/login/oauth/authorize');
  assert.equal(u.searchParams.get('client_id'), 'cid123');
  assert.equal(u.searchParams.get('scope'), 'repo', 'a crafted ?scope= must be ignored');
  assert.equal(u.searchParams.get('redirect_uri'), SITE + '/.netlify/functions/callback');
  assert.equal(u.searchParams.get('allow_signup'), 'false');
  assert.equal(u.searchParams.get('login'), 'Wajiha-Waqar');
  assert.equal(u.searchParams.get('state'), STATE);
  assert.match(res.headers['Set-Cookie'], /HttpOnly/); assert.match(res.headers['Set-Cookie'], /Secure/); assert.match(res.headers['Set-Cookie'], /SameSite=Lax/);
  assert.ok(!JSON.stringify(res).includes('SECRET-xyz-789'), 'client secret never leaves the server');
});
test('auth: only OAUTH_SCOPE values repo / public_repo are accepted', async () => {
  const res = await mk(github(), { ...ENV, OAUTH_SCOPE: 'admin:org' }).auth({ queryStringParameters: {}, headers: {} });
  assert.equal(res.statusCode, 500); assert.match(res.body, /OAUTH_SCOPE/);
});
test('auth: rejects other providers; reports missing configuration without leaking values', async () => {
  assert.equal((await mk(github()).auth({ queryStringParameters: { provider: 'gitlab' }, headers: {} })).statusCode, 400);
  const res = await mk(github(), { URL: SITE }).auth({ queryStringParameters: {}, headers: {} });
  assert.equal(res.statusCode, 500); assert.match(res.body, /GITHUB_CLIENT_ID.*GITHUB_CLIENT_SECRET.*ALLOWED_GITHUB_USER/);
});
test('auth: requires a repository for the write-access check and validates its owner/repository form', async () => {
  const missing = { ...ENV }; delete missing.GITHUB_REPO;
  assert.match((await mk(github(), missing).auth({ queryStringParameters: {}, headers: {} })).body, /GITHUB_REPO/);
  const malformed = await mk(github(), { ...ENV, GITHUB_REPO: 'owner/repo/extra' }).auth({ queryStringParameters: {}, headers: {} });
  assert.match(malformed.body, /GITHUB_REPO/);
});

test('callback: the authorized account receives a token (and the secret stays server-side)', async () => {
  const gh = github(); const res = await mk(gh).callback(cbEvent());
  assert.equal(res.statusCode, 200); assert.ok(sent(res));
  assert.ok(res.body.includes('gho_REALTOKEN'));
  assert.ok(!res.body.includes('SECRET-xyz-789'), 'client secret must never appear in the page');
  const exchange = gh.calls.find((c) => c.url.endsWith('/access_token')); assert.ok(JSON.parse(exchange.body).client_secret === 'SECRET-xyz-789');
  assert.match(res.headers['Set-Cookie'], /Max-Age=0/, 'state cookie is cleared');
  assert.match(res.headers['Cache-Control'], /no-store/);
  const nonce = /nonce-([^']+)'/.exec(res.headers['Content-Security-Policy'])[1]; assert.ok(res.body.includes(`nonce="${nonce}"`), 'CSP nonce matches the inline script');
});
test('callback: username match is case-insensitive', async () => {
  assert.ok(sent(await mk(github({ user: 'wajiha-waqar' })).callback(cbEvent())));
});
test('callback: ANY OTHER GitHub account is refused, gets no token, and its token is revoked', async () => {
  const gh = github({ user: 'mallory', token: 'gho_MALLORY' }); const res = await mk(gh).callback(cbEvent());
  assert.equal(res.statusCode, 401); assert.ok(!sent(res)); assert.ok(!res.body.includes('gho_MALLORY'));
  assert.match(res.body, /not authorized/);
  const rev = gh.calls.find((c) => c.method === 'DELETE'); assert.ok(rev, 'unauthorized token is revoked'); assert.match(rev.url, /\/applications\/cid123\/token/);
  assert.equal(JSON.parse(rev.body).access_token, 'gho_MALLORY');
});
test('callback: lookalike usernames are refused (exact match only)', async () => {
  for (const u of ['Wajiha-Waqar2', 'wajiha-waqar-bot', 'Wajiha']) assert.ok(!sent(await mk(github({ user: u })).callback(cbEvent())), u);
});
test('callback: the right account WITHOUT write access to the repo is refused', async () => {
  const gh = github({ push: false }); const res = await mk(gh).callback(cbEvent());
  assert.ok(!sent(res)); assert.match(res.body, /write access/); assert.ok(gh.calls.some((c) => c.method === 'DELETE'));
});
test('callback: forged / missing / mismatched state is refused before any GitHub call (CSRF)', async () => {
  for (const ev of [cbEvent({ state: 'forged' }), cbEvent({}, ''), cbEvent({}, 'cms_oauth_state=other'), cbEvent({ state: '' })]) {
    const gh = github(); const res = await mk(gh).callback(ev);
    assert.ok(!sent(res)); assert.equal(gh.calls.length, 0, 'no token exchange without a verified state');
  }
});
test('callback: GitHub error, missing code, failed exchange and missing config all fail closed', async () => {
  assert.ok(!sent(await mk(github()).callback(cbEvent({ error: 'access_denied', error_description: 'The user denied' }))));
  assert.ok(!sent(await mk(github()).callback(cbEvent({ code: '' }))));
  assert.ok(!sent(await mk(github({ tokenOk: false })).callback(cbEvent())));
  assert.ok(!sent(await mk(github(), { URL: SITE }).callback(cbEvent())));
});
test('callback: token is escaped so it cannot break out of the inline script', async () => {
  const res = await mk(github({ token: 'x</script><img src=x onerror=alert(1)>' })).callback(cbEvent());
  assert.ok(!/<\/script><img/.test(res.body)); assert.match(res.body, /\\u003c/);
});
test('callback: the page only answers messages from the CMS origin', async () => {
  const res = await mk(github()).callback(cbEvent()); assert.match(res.body, /e\.origin !== ORIGIN/); assert.ok(res.body.includes(JSON.stringify(SITE)));
});

test('auth: an explicit SITE_URL pins the redirect address (it wins over Netlify\'s URL and the request host)', async () => {
  const pinned = await mk(github(), { ...ENV, URL: 'https://something-else.netlify.app', SITE_URL: 'https://portfolio.example.org/' }).auth({ queryStringParameters: {}, headers: { host: 'evil.example' } });
  assert.equal(new URL(pinned.headers.Location).searchParams.get('redirect_uri'), 'https://portfolio.example.org/.netlify/functions/callback');
  const noEnv = { ...ENV }; delete noEnv.URL;
  const viaHost = await mk(github(), noEnv).auth({ queryStringParameters: {}, headers: { host: 'wajiha-waqar-portfolio.netlify.app' } });
  assert.equal(new URL(viaHost.headers.Location).searchParams.get('redirect_uri'), SITE + '/.netlify/functions/callback', 'falls back to the request host when neither is set');
});

/* ---- compatibility: drive Decap's real authenticator against the real popup page ---- */
/** Real timing: Decap registers its listeners, opens the popup, and only THEN does the popup page load. */
function runDecapHandshake(html) {
  const cms = new JSDOM('<!doctype html>', { url: SITE + '/admin/' }).window;
  let popupWin; let opened;
  cms.open = (url) => {
    opened = url;
    setTimeout(() => { new JSDOM(html, { runScripts: 'dangerously', url: SITE + '/.netlify/functions/callback?code=abc', beforeParse(w) {
      popupWin = w; w.opener = { postMessage: (data) => cms.dispatchEvent(new cms.MessageEvent('message', { data, origin: SITE })) };
    } }); }, 0);
    return { postMessage: (data) => popupWin.dispatchEvent(new popupWin.MessageEvent('message', { data, origin: SITE })), close() {}, focus() {} };
  };
  global.window = cms; global.document = cms.document; global.screen = cms.screen;
  const auth = new NetlifyAuthenticator({ base_url: SITE, auth_endpoint: '.netlify/functions/auth', site_id: 'wajiha-waqar-portfolio.netlify.app' });
  return new Promise((resolve) => auth.authenticate({ provider: 'github', scope: 'repo' }, (err, data) => resolve({ err, data, opened })))
    .finally(() => { delete global.window; delete global.document; delete global.screen; });
}
test('Decap CMS handshake: its own NetlifyAuthenticator signs in through my callback page', async () => {
  const { err, data, opened } = await runDecapHandshake((await mk(github({ token: 'gho_E2E' })).callback(cbEvent())).body);
  assert.ok(!err, String(err && err.message)); assert.equal(data.token, 'gho_E2E'); assert.equal(data.provider, 'github');
  const u = new URL(opened);
  assert.equal(u.origin + u.pathname, SITE + '/.netlify/functions/auth', 'Decap calls the exact endpoint the function serves');
  assert.equal(u.searchParams.get('provider'), 'github');
});
test('Decap CMS handshake: an unauthorized account surfaces as a sign-in error, never a token', async () => {
  const { err, data } = await runDecapHandshake((await mk(github({ user: 'mallory', token: 'gho_BAD' })).callback(cbEvent())).body);
  assert.ok(err, 'sign-in must fail'); assert.ok(!data || !data.token, 'no token delivered');
  assert.match(String(err.message || err), /not authorized/);
});
