'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadContent } = require('../src/content');

const root = path.join(__dirname, '..');

test('content loader keeps drafts only in previews and never renders hidden content', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-content-'));
  try {
    fs.cpSync(path.join(root, 'content'), path.join(fixture, 'content'), { recursive: true });
    fs.cpSync(path.join(root, 'images'), path.join(fixture, 'images'), { recursive: true });
    const resumePath = path.join(fixture, 'content', 'projects', 'resume-parser.json');
    const resume = JSON.parse(fs.readFileSync(resumePath, 'utf8'));
    resume.status = 'draft';
    fs.writeFileSync(resumePath, JSON.stringify(resume));
    const hiddenPath = path.join(fixture, 'content', 'projects', 'disaster-alert-system.json');
    const hidden = JSON.parse(fs.readFileSync(hiddenPath, 'utf8'));
    hidden.status = 'hidden';
    fs.writeFileSync(hiddenPath, JSON.stringify(hidden));

    const preview = loadContent(fixture);
    const production = loadContent(fixture, { production: true });
    assert.ok(preview.projects.some((project) => project.id === 'resume-parser'));
    assert.ok(!preview.projects.some((project) => project.id === 'disaster-alert-system'));
    assert.ok(!production.projects.some((project) => project.id === 'resume-parser'));
    assert.ok(!production.projects.some((project) => project.id === 'disaster-alert-system'));
    assert.equal(preview.certificates.some((certificate) => certificate.id === 'flyrank-internship-certificate'), false);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});

test('content loader reports malformed record files with their path', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-invalid-content-'));
  try {
    fs.cpSync(path.join(root, 'content'), path.join(fixture, 'content'), { recursive: true });
    fs.cpSync(path.join(root, 'images'), path.join(fixture, 'images'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'content', 'research', 'invalid.json'), '{');
    assert.throws(() => loadContent(fixture), /content\/research\/invalid\.json: could not read valid JSON/);
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
