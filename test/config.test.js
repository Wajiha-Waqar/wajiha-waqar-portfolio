'use strict';
// 1) the CMS config is structurally sound and 2) every content record conforms to it
// (Decap drops unknown fields on save and blocks saving when required fields are empty).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const cfg = yaml.load(fs.readFileSync(path.join(ROOT, 'admin/config.yml'), 'utf8'));
const WIDGETS = new Set(['string', 'text', 'markdown', 'number', 'boolean', 'datetime', 'image', 'file', 'select', 'relation', 'list', 'object', 'hidden', 'code', 'color', 'map', 'uuid']);

// ------------------------------------------------------------------ helpers
const colls = cfg.collections;
const slugs = (name) => {
  const c = colls.find((x) => x.name === name);
  return c && c.folder ? fs.readdirSync(path.join(ROOT, c.folder)).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')) : [];
};
const tmplRefs = (t) => [...String(t).matchAll(/\{\{\s*(?:fields\.)?([\w.]+)\s*\}\}/g)].map((m) => m[1]).filter((n) => !['slug', 'collection', 'path', 'message', 'year', 'month', 'day', 'hour', 'minute', 'second', 'dirname', 'filename', 'extension', 'media_folder', 'public_folder'].includes(n));

function checkFields(fields, where, errs, topLevel = true) {
  if (!Array.isArray(fields) || !fields.length) return errs.push(`${where}: no fields`);
  const names = new Set();
  for (const f of fields) {
    const w = `${where}.${f.name}`;
    if (!f.name || !f.label) errs.push(`${w}: name and label are required`);
    if (names.has(f.name)) errs.push(`${w}: duplicate field name`); names.add(f.name);
    const widget = f.widget || 'string';
    if (!WIDGETS.has(widget)) errs.push(`${w}: unknown widget "${widget}"`);
    if (widget === 'select' && !(Array.isArray(f.options) && f.options.length)) errs.push(`${w}: select needs options`);
    if (widget === 'relation') {
      if (!colls.some((c) => c.name === f.collection)) errs.push(`${w}: relation to unknown collection "${f.collection}"`);
      if (!f.value_field || !f.search_fields) errs.push(`${w}: relation needs value_field and search_fields`);
    }
    if (widget === 'object' && !f.fields) errs.push(`${w}: object needs fields`);
    if (widget === 'list') {
      if (!(f.fields || f.field || f.types)) errs.push(`${w}: list needs fields, field or types`);
      if (f.types) for (const t of f.types) { if (!t.name || t.widget !== 'object') errs.push(`${w}.types.${t.name}: must be an object type`); checkFields(t.fields, `${w}.types.${t.name}`, errs, false); }
      if (f.fields) checkFields(f.fields, w, errs, false);
    }
    if (widget === 'object' && f.fields) checkFields(f.fields, w, errs, false);
  }
  return errs;
}

// A value conforms to a field definition?
function checkValue(v, f, where, errs, ctx) {
  const widget = f.widget || 'string';
  const required = f.required !== false;
  const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0 && widget !== 'boolean');
  if (empty) { if (required && widget !== 'boolean' && !(widget === 'number' && v === 0)) errs.push(`${where}: required but empty`); return; }
  const opts = (f.options || []).map((o) => (typeof o === 'object' ? o.value : o));
  switch (widget) {
    case 'boolean': if (typeof v !== 'boolean') errs.push(`${where}: expected boolean, got ${JSON.stringify(v)}`); break;
    case 'number': if (typeof v !== 'number') errs.push(`${where}: expected number`); else if (f.value_type === 'int' && !Number.isInteger(v)) errs.push(`${where}: expected integer`); break;
    case 'select':
      if (f.multiple) { if (!Array.isArray(v) || v.some((x) => !opts.includes(x))) errs.push(`${where}: value(s) ${JSON.stringify(v)} not all in options`); }
      else if (!opts.includes(v)) errs.push(`${where}: "${v}" is not one of ${opts.join(', ')}`);
      break;
    case 'relation': if (!slugs(f.collection).includes(v)) errs.push(`${where}: relation target "${v}" does not exist in ${f.collection}`); break;
    case 'datetime': if (typeof v !== 'string' || !(/^\d{4}-\d{2}(-\d{2})?$/.test(v))) errs.push(`${where}: date "${v}" doesn't match ${f.format}`); break;
    case 'image': case 'file': if (typeof v !== 'string') errs.push(`${where}: expected a path string`); else if (ctx.checkFiles && !fs.existsSync(path.join(ROOT, v.replace(/^\//, '')))) errs.push(`${where}: file not found: ${v}`); break;
    case 'object': checkRecord(v, f.fields, where, errs, ctx); break;
    case 'list':
      if (!Array.isArray(v)) { errs.push(`${where}: expected a list`); break; }
      v.forEach((item, i) => {
        const w = `${where}[${i}]`;
        if (f.types) {
          const t = f.types.find((x) => x.name === (item || {})[f.typeKey || 'type']);
          if (!t) errs.push(`${w}: unknown type "${(item || {}).type}"`); else checkRecord(item, t.fields, w, errs, ctx, [f.typeKey || 'type']);
        } else if (f.fields) checkRecord(item, f.fields, w, errs, ctx);
        else checkValue(item, f.field, w, errs, ctx);
      });
      break;
    default: if (typeof v !== 'string') errs.push(`${where}: expected text, got ${typeof v}`);
  }
}
function checkRecord(rec, fields, where, errs, ctx, extraKeys = []) {
  if (!rec || typeof rec !== 'object' || Array.isArray(rec)) return errs.push(`${where}: expected an object`);
  const known = new Set([...fields.map((f) => f.name), ...extraKeys]);
  for (const k of Object.keys(rec)) if (!known.has(k)) errs.push(`${where}.${k}: not defined in the CMS config (Decap would DROP this field on save)`);
  for (const f of fields) checkValue(rec[f.name], f, `${where}.${f.name}`, errs, ctx);
}

// ------------------------------------------------------------------ tests
test('config: backend is the supported GitHub + self-hosted OAuth proxy setup, with no legacy auth and no secrets', () => {
  const b = cfg.backend;
  assert.equal(b.name, 'github'); assert.ok(/^[\w.-]+\/[\w.-]+$/.test(b.repo)); assert.equal(b.branch, 'main');
  assert.ok(/^https:\/\//.test(b.base_url)); assert.equal(b.auth_endpoint, '.netlify/functions/auth');
  const text = fs.readFileSync(path.join(ROOT, 'admin/config.yml'), 'utf8');
  assert.ok(!/git-gateway|netlify-identity|identity/i.test(text.replace(/#.*$/gm, '')), 'no legacy Identity / Git Gateway');
  const live = text.replace(/#.*$/gm, '');                                   // ignore comments (they may name env variables)
  assert.ok(!/(client_secret|access_token|api_key|password)\s*:\s*\S/i.test(live), 'no secret-valued keys in config');
  assert.ok(!/\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(text), 'no GitHub token values anywhere in config (comments included)');
  assert.equal(cfg.publish_mode, 'editorial_workflow', 'drafts must live on branches until approved');
  assert.equal(b.squash_merges, true);
});
test('config: the 10 content sections exist in the requested order', () => {
  assert.deepEqual(colls.map((c) => c.name), ['projects', 'skills', 'experience', 'certificates', 'education', 'about', 'research_interests', 'research', 'contact', 'settings']);
});
test('config: structurally valid (widgets, options, relations, unique names, templates reference real fields)', () => {
  const errs = []; const names = new Set();
  for (const c of colls) {
    if (names.has(c.name)) errs.push(`duplicate collection ${c.name}`); names.add(c.name);
    if (!c.label) errs.push(`${c.name}: label`);
    if (!!c.folder === !!c.files) errs.push(`${c.name}: needs exactly one of folder / files`);
    if (c.folder) {
      assert.equal(c.extension, 'json', `${c.name}: extension`); assert.equal(c.format, 'json', `${c.name}: format`);
      checkFields(c.fields, c.name, errs);
      const fn = new Set(c.fields.map((f) => f.name));
      for (const k of c.sortable_fields || []) if (!fn.has(k)) errs.push(`${c.name}: sortable field ${k} unknown`);
      for (const v of [...(c.view_filters || []), ...(c.view_groups || [])]) if (!fn.has(v.field)) errs.push(`${c.name}: view field ${v.field} unknown`);
      for (const r of tmplRefs(c.summary || '')) if (!fn.has(r.split('.')[0])) errs.push(`${c.name}: summary references unknown field ${r}`);
      if (!fn.has(c.identifier_field || 'title')) errs.push(`${c.name}: identifier_field unknown`);
    } else for (const f of c.files) { if (!fs.existsSync(path.join(ROOT, f.file))) errs.push(`${c.name}: file ${f.file} missing`); checkFields(f.fields, `${c.name}/${f.name}`, errs); }
  }
  assert.deepEqual(errs, []);
});
test('content: every record conforms to its collection (no dropped fields, no blocked saves, valid values)', () => {
  const errs = [];
  for (const c of colls) {
    const files = c.folder ? slugs(c.name).map((s) => [`${c.folder}/${s}.json`, c.fields]) : c.files.map((f) => [f.file, f.fields]);
    for (const [file, fields] of files) checkRecord(JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), fields, file, errs, { checkFiles: false });
  }
  assert.deepEqual(errs, []);
});
// The logo, profile photo, CV and screenshots are your own files and live in your repo; only check them where they are present.
const haveUserAssets = ['images', 'resume'].every((d) => fs.existsSync(path.join(ROOT, d)) && fs.readdirSync(path.join(ROOT, d)).some((f) => f !== 'README.txt'));
test('content: every file/image path referenced by content exists in the repo (or is an intentionally empty draft)', { skip: haveUserAssets ? false : 'user-supplied images/CV are not in this workspace; run this test in your repo' }, () => {
  const errs = [];
  for (const c of colls) {
    const files = c.folder ? slugs(c.name).map((s) => [`${c.folder}/${s}.json`, c.fields]) : c.files.map((f) => [f.file, f.fields]);
    for (const [file, fields] of files) {
      const rec = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      const draftOk = rec.status === 'draft' || rec.status === 'hidden';
      const walk = (r, fs_) => { for (const f of fs_) { const v = r && r[f.name]; if (!v) continue;
        if ((f.widget === 'image' || f.widget === 'file') && typeof v === 'string' && !fs.existsSync(path.join(ROOT, v.replace(/^\//, ''))) && !draftOk) errs.push(`${file}: ${f.name} -> ${v} not found`);
        if (f.widget === 'object') walk(v, f.fields); if (f.widget === 'list' && f.fields && Array.isArray(v)) v.forEach((i) => walk(i, f.fields)); } };
      walk(rec, fields);
    }
  }
  assert.deepEqual(errs, []);
});
