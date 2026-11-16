'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build, findBrokenReferences } = require('../build');

const root = path.join(__dirname, '..');
const pages = ['index.html', 'about.html', 'projects.html', 'contact.html', 'flyrank.html', 'research-agent.html', 'capstone.html', 'fyp-research.html'];

test('preview build retains all original URLs, case-study content, and local references', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-build-'));
  try {
    build({ root, out, quiet: true });
    for (const page of pages) assert.ok(fs.existsSync(path.join(out, page)), `${page} exists`);
    assert.deepEqual(findBrokenReferences(out), []);
    assert.ok(fs.existsSync(path.join(out, 'images', 'Edex_internship_cert.jpg')));
    assert.ok(fs.existsSync(path.join(out, 'resume', 'wajiha_waqar_resume.pdf')));
    assert.ok(fs.existsSync(path.join(out, 'admin', 'decap', 'decap-cms.js')));
    assert.match(fs.readFileSync(path.join(out, 'admin', 'index.html'), 'utf8'), /decap\/decap-cms\.js/);
    for (const page of ['flyrank.html', 'research-agent.html', 'capstone.html', 'fyp-research.html']) {
      const original = fs.readFileSync(path.join(root, page), 'utf8').match(/<main id="main">[\s\S]*?<\/main>/)[0];
      const migrated = fs.readFileSync(path.join(root, 'src', 'pages', page), 'utf8');
      assert.ok(migrated.includes(original), `${page} main content copied without editing`);
      assert.ok(fs.readFileSync(path.join(out, page), 'utf8').includes(original), `${page} main content appears in generated output`);
    }
    assert.ok(fs.existsSync(path.join(out, 'certificates', 'edex-internship-certificate.html')));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});
