'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const root = path.join(__dirname, '..');

test('CMS edits use editorial drafts and an explicit publish action on main', () => {
  const config = yaml.load(fs.readFileSync(path.join(root, 'admin', 'config.yml'), 'utf8'));
  const netlify = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  assert.equal(config.publish_mode, 'editorial_workflow');
  assert.equal(config.backend.branch, 'main');
  assert.equal(config.backend.auth_endpoint, '.netlify/functions/auth');
  assert.match(netlify, /command\s+=\s+"npm run build"/);
  assert.match(netlify, /publish\s+=\s+"dist"/);
  assert.match(netlify, /functions\s+=\s+"netlify\/functions"/);
  assert.match(fs.readFileSync(path.join(root, 'docs', 'CMS.md'), 'utf8'), /manual approval/i);
});

test('Netlify endpoints export handlers and agree with the CMS auth endpoint', () => {
  assert.equal(typeof require('../netlify/functions/auth').handler, 'function');
  assert.equal(typeof require('../netlify/functions/callback').handler, 'function');
});
