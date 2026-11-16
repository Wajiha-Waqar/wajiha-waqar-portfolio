'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('deploy status distinguishes live, deploying, and failed states', () => {
  const file = path.join(__dirname, '..', 'admin', 'deploy-core.js');
  const dom = new JSDOM('<!doctype html>', { runScripts: 'outside-only' });
  try {
    dom.window.eval(fs.readFileSync(file, 'utf8'));
    const core = dom.window.DeployCore;
    assert.deepEqual(JSON.parse(JSON.stringify(core.computeDeployState({ headSha: 'a', liveCommit: 'a' }))).state, 'live');
    assert.equal(core.computeDeployState({ headSha: 'b', liveCommit: 'a', headAgeMs: 1000 }).state, 'deploying');
    assert.equal(core.computeDeployState({ headSha: 'b', liveCommit: 'a', statuses: [{ context: 'netlify/site/deploy', state: 'failure', target_url: 'https://netlify.example/log' }] }).url, 'https://netlify.example/log');
    const backend = core.parseBackend('repo: Wajiha-Waqar/wajiha-waqar-portfolio\nbranch: main');
    assert.equal(backend.repo, 'Wajiha-Waqar/wajiha-waqar-portfolio');
    assert.equal(backend.branch, 'main');
  } finally {
    dom.window.close();
  }
});
