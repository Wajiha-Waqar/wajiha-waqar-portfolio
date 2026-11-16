'use strict';

const crypto = require('crypto');

const GITHUB = 'https://github.com';
const API = 'https://api.github.com';
const SCOPES = new Set(['repo', 'public_repo']);
const STATE_COOKIE = 'cms_oauth_state';

function config(env) {
  const missing = ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'ALLOWED_GITHUB_USER', 'GITHUB_REPO'].filter((key) => !env[key]);
  if (env.GITHUB_REPO && !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO)) missing.push('GITHUB_REPO (must be owner/repository)');
  const scope = env.OAUTH_SCOPE || 'repo';
  if (!SCOPES.has(scope)) missing.push('OAUTH_SCOPE (must be "repo" or "public_repo")');
  return {
    missing,
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    allowed: String(env.ALLOWED_GITHUB_USER || '').trim().toLowerCase(),
    repo: env.GITHUB_REPO || '',
    scope,
    siteUrl: String(env.SITE_URL || env.URL || '').replace(/\/+$/, ''),
  };
}

const parseCookies = (header) => Object.fromEntries(String(header || '').split(';').map((cookie) => cookie.trim()).filter(Boolean).map((cookie) => {
  const i = cookie.indexOf('=');
  return [cookie.slice(0, i), cookie.slice(i + 1)];
}));
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const jsonForScript = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const clearCookie = `${STATE_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/.netlify/functions; Max-Age=0`;
const baseHeaders = (nonce) => ({
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; frame-ancestors 'none'`,
});

function messagePage({ ok, payload, origin, randomBytes }) {
  const nonce = randomBytes(16).toString('base64');
  const message = ok
    ? `authorization:github:success:${JSON.stringify(payload)}`
    : `authorization:github:error:${JSON.stringify(payload)}`;
  const text = ok ? 'Signed in. You can close this window.' : `Sign-in failed: ${payload.message}`;
  const safeText = text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${ok ? 'Signed in' : 'Sign-in failed'}</title></head>
<body style="font:16px/1.5 system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1rem"><p>${safeText}</p>
<script nonce="${nonce}">
(function () {
  var ORIGIN = ${jsonForScript(origin)}, MSG = ${jsonForScript(message)};
  function receive(e) {
    if (e.origin !== ORIGIN || !window.opener) return;
    window.opener.postMessage(MSG, e.origin);
    window.removeEventListener('message', receive, false);
  }
  window.addEventListener('message', receive, false);
  if (window.opener) window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`;
  return { statusCode: ok ? 200 : 401, headers: { ...baseHeaders(nonce), 'Set-Cookie': clearCookie }, body };
}

function createHandlers({ env = process.env, fetchImpl = fetch, randomBytes = crypto.randomBytes } = {}) {
  async function auth(event) {
    const c = config(env);
    const query = event.queryStringParameters || {};
    if (c.missing.length) return { statusCode: 500, headers: baseHeaders('x'.repeat(8)), body: `Server is not configured: missing ${c.missing.join(', ')}.` };
    if (query.provider && query.provider !== 'github') return { statusCode: 400, headers: baseHeaders('x'.repeat(8)), body: 'Unsupported provider.' };
    const host = (event.headers || {}).host;
    if (!c.siteUrl && !host) return { statusCode: 500, headers: baseHeaders('x'.repeat(8)), body: 'The site URL is not configured.' };
    const state = randomBytes(24).toString('hex');
    const redirect = `${c.siteUrl || `https://${host}`}/.netlify/functions/callback`;
    const url = `${GITHUB}/login/oauth/authorize?${new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: redirect,
      scope: c.scope,
      state,
      allow_signup: 'false',
      login: String(env.ALLOWED_GITHUB_USER).trim(),
    })}`;
    return {
      statusCode: 302,
      headers: {
        Location: url,
        'Cache-Control': 'no-store',
        'Set-Cookie': `${STATE_COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/.netlify/functions; Max-Age=600`,
      },
      body: '',
    };
  }

  async function callback(event) {
    const c = config(env);
    const origin = c.siteUrl || `https://${(event.headers || {}).host || ''}`;
    const fail = (message) => messagePage({ ok: false, payload: { message }, origin, randomBytes });
    if (c.missing.length) return fail('The sign-in service is not configured.');
    const query = event.queryStringParameters || {};
    if (query.error) return fail(`GitHub reported an error: ${String(query.error_description || query.error).slice(0, 120)}`);
    const cookie = parseCookies((event.headers || {}).cookie)[STATE_COOKIE];
    if (!query.state || !cookie || !safeEqual(query.state, cookie)) return fail('The sign-in attempt could not be verified. Close this window and try again.');
    if (!query.code) return fail('GitHub did not return an authorization code.');

    let tokenData;
    try {
      const response = await fetchImpl(`${GITHUB}/login/oauth/access_token`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: c.clientId, client_secret: c.clientSecret, code: query.code, redirect_uri: `${origin}/.netlify/functions/callback` }),
      });
      tokenData = await response.json();
    } catch (error) {
      return fail('Could not contact GitHub to complete sign-in.');
    }
    if (!tokenData || !tokenData.access_token) return fail('GitHub did not issue a token. Try signing in again.');

    const github = (endpoint) => fetchImpl(API + endpoint, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'portfolio-cms-auth',
      },
    });
    const revoke = () => fetchImpl(`${API}/applications/${c.clientId}/token`, {
      method: 'DELETE',
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'portfolio-cms-auth',
      },
      body: JSON.stringify({ access_token: tokenData.access_token }),
    }).catch(() => undefined);
    const user = await github('/user').then((response) => response.ok ? response.json() : null).catch(() => null);
    if (!user || !user.login) {
      await revoke();
      return fail('Could not verify your GitHub account.');
    }
    if (String(user.login).toLowerCase() !== c.allowed) {
      await revoke();
      return fail('This GitHub account is not authorized to manage this site.');
    }
    const repo = await github(`/repos/${c.repo}`).then((response) => response.ok ? response.json() : null).catch(() => null);
    if (!repo || !repo.permissions || !repo.permissions.push) {
      await revoke();
      return fail('This account does not have write access to the site repository.');
    }
    return messagePage({ ok: true, payload: { token: tokenData.access_token, provider: 'github' }, origin, randomBytes });
  }
  return { auth, callback };
}

module.exports = { createHandlers, cfg: config, STATE_COOKIE };
