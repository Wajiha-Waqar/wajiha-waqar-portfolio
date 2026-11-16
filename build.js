#!/usr/bin/env node
'use strict';
/**
 * Static site generator for the portfolio.
 *   content/*.json  +  src/ templates  ->  dist/
 *
 * Context (set automatically by Netlify via CONTEXT):
 *   production      -> only content with status "published" is rendered. Drafts can never reach the live site.
 *   anything else   -> deploy previews / branch deploys / local: drafts are rendered, flagged, and noindex.
 * Hidden content is never rendered.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadContent } = require('./src/content');
const { page } = require('./src/layout');
const { projectLinks } = require('./src/blocks');
const { fmtDate, slugify } = require('./src/util');
const home = require('./src/templates/home');
const about = require('./src/templates/about');
const projects = require('./src/templates/projects');
const contact = require('./src/templates/contact');
const gen = require('./src/templates/generated');


/** Scan every generated page for local links/images/files that do not exist in the output. */
function findBrokenReferences(out) {
  const missing = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  for (const file of walk(out).filter((f) => f.endsWith('.html') && !f.includes(`${path.sep}admin${path.sep}`))) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.matchAll(/(?:href|src|data)="([^"]+)"/g)) {
      const u = m[1];
      if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(u)) continue;
      const clean = u.split('#')[0].split('?')[0];
      if (!clean) continue;
      const target = clean.startsWith('/') ? path.join(out, clean) : path.resolve(path.dirname(file), clean);
      if (!fs.existsSync(target)) missing.push({ page: path.relative(out, file), ref: u });
    }
  }
  return missing;
}

function build({ root = __dirname, out = path.join(__dirname, 'dist'), production = process.env.CONTEXT === 'production', quiet = false, skipDecap = false } = {}) {
  const log = (...a) => { if (!quiet) console.log(...a); };
  const preview = !production;
  const model = loadContent(root, { production });

  // ------------------------------------------------------------------ derived data
  const hasDetail = (p) => !p.case_study_url && !p.placeholder && (p.detailed_description || (p.facts || []).length || (p.screenshots || []).some((s) => s.image));
  for (const p of model.projects) {
    p.chips_home = p.status_chips || [];
    p.chips_case = (p.case_chips && p.case_chips.length) ? p.case_chips : p.chips_home;
    p.generatedHref = hasDetail(p) ? `projects/${p.id}.html` : '';
  }
  const hasResearchDetail = (r) => !r.detail_page && (r.problem || (r.objectives || []).length || r.methodology || (r.related_documents || []).length);
  for (const r of model.research) r.generatedHref = hasResearchDetail(r) ? `research/${r.id}.html` : '';
  for (const c of model.certificates) c.pageHref = c.allow_preview ? `certificates/${c.id}.html` : '';
  for (const x of model.experience) {
    if (!x.meta_label && (x.start_date || x.end_date || x.current)) {
      const span = `${fmtDate(x.start_date)}${x.start_date ? ' – ' : ''}${x.current ? 'Present' : fmtDate(x.end_date)}`;
      x.meta_label = [x.employment_type, span].filter(Boolean).join(' · ');
    } else if (!x.meta_label) x.meta_label = x.employment_type || '';
  }
  const ctx = { linksFor: (p) => projectLinks(p, '', p.case_study_url ? '' : p.generatedHref) };

  // ------------------------------------------------------------------ render
  fs.rmSync(out, { recursive: true, force: true });
  const write = (file, html) => { const f = path.join(out, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
  const s = model.settings;
  const common = { model, preview };

  write('index.html', page({ ...common, file: 'index.html', title: s.home_title, description: s.meta_description, main: home(model, ctx) }));
  write('about.html', page({ ...common, file: 'about.html', title: `About | ${s.site_name}`, description: s.seo.about_description, main: about(model) }));
  write('projects.html', page({ ...common, file: 'projects.html', title: `Projects | ${s.site_name}`, description: s.seo.projects_description, main: projects(model, ctx) }));
  write('contact.html', page({ ...common, file: 'contact.html', title: `Contact | ${s.site_name}`, description: s.seo.contact_description, main: contact(model) }));

  // hand-authored case-study pages keep their exact markup; only the shared shell comes from settings
  const pagesDir = path.join(root, 'src', 'pages');
  for (const f of fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((n) => n.endsWith('.html')) : []) {
    const raw = fs.readFileSync(path.join(pagesDir, f), 'utf8');
    const m = /^<!--page (\{[\s\S]*?\}) -->\n([\s\S]*?)(?:\n<!--after-footer-->\n([\s\S]*))?$/.exec(raw);
    if (!m) throw new Error(`src/pages/${f}: missing "<!--page {...} -->" header`);
    const front = JSON.parse(m[1]);
    write(f, page({ ...common, file: f, title: front.title, description: front.description, main: m[2].trim(), after: m[3] ? m[3].trim() + '\n\n' : '', parentHref: front.parent }));
  }

  for (const p of model.projects) if (p.generatedHref) write(p.generatedHref, page({ ...common, file: p.generatedHref, rel: '../', title: `${p.title} | ${s.site_name}`, description: p.short_description || p.title, main: gen.projectPage(model, p) }));
  for (const r of model.research) if (r.generatedHref) write(r.generatedHref, page({ ...common, file: r.generatedHref, rel: '../', parentHref: 'index.html#research', title: `${r.title} | ${s.site_name}`, description: r.short_description || r.title, main: gen.researchPage(model, r) }));
  for (const c of model.certificates) if (c.pageHref) write(c.pageHref, page({ ...common, file: c.pageHref, rel: '../', parentHref: 'index.html#experience', noindex: true, title: `${c.title} | ${s.site_name}`, description: `${c.title}, issued by ${c.issuer}.`, main: gen.certificate(model, c) }));

  // ------------------------------------------------------------------ static files
  const copy = (src, dst, filter) => {
    const abs = path.join(root, src);
    if (!fs.existsSync(abs)) return;
    const walk = (a, d) => {
      const st = fs.statSync(a);
      if (st.isDirectory()) { for (const n of fs.readdirSync(a)) walk(path.join(a, n), path.join(d, n)); return; }
      if (filter && !filter(path.relative(root, a))) return;
      fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(a, d);
    };
    walk(abs, path.join(out, dst || src));
  };
  ['style.css', 'script.js', 'favicon.svg', 'favicon.ico', 'favicon-96x96.png', 'apple-touch-icon.png', 'site.webmanifest',
    'web-app-manifest-192x192.png', 'web-app-manifest-512x512.png'].forEach((f) => copy(f));
  const notPlaceholder = (rel) => path.basename(rel) !== 'README.txt';
  const certificateFiles = new Set(model.certificates.map((c) => c.file.replace(/^\//, '').replace(/\\/g, '/')));
  copy('images', 'images', (rel) => notPlaceholder(rel) && !certificateFiles.has(`images/${rel.replace(/\\/g, '/')}`));
  copy('resume', 'resume', notPlaceholder);
  // assets/certificates is deliberately NOT copied wholesale: only files of exposed certificates are published
  copy('assets', 'assets', (rel) => notPlaceholder(rel) && !rel.split(path.sep).slice(0, 2).join('/').startsWith('assets/certificates'));
  const exposed = certificateFiles;
  for (const f of exposed) copy(f, f);
  copy('admin', 'admin');
  const decap = path.join(root, 'node_modules', 'decap-cms', 'dist');
  if (!skipDecap && fs.existsSync(decap)) {
    for (const n of fs.readdirSync(decap)) {
      if (n.endsWith('.map') || n.startsWith('cms.') || /^\d+\.cms\.js$/.test(n)) continue;
      fs.mkdirSync(path.join(out, 'admin', 'decap'), { recursive: true });
      fs.copyFileSync(path.join(decap, n), path.join(out, 'admin', 'decap', n));
    }
  } else if (production && !skipDecap) throw new Error('decap-cms is not installed; run npm install');

  // ------------------------------------------------------------------ build info (used by the admin deploy-status panel)
  let commit = process.env.COMMIT_REF || '';
  if (!commit) { try { commit = execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { commit = ''; } }
  write('build-info.json', JSON.stringify({ commit, branch: process.env.BRANCH || '', context: process.env.CONTEXT || (production ? 'production' : 'local'), builtAt: new Date().toISOString() }, null, 2) + '\n');

  const broken = findBrokenReferences(out);
  model.broken = broken;
  for (const b of broken) {
    if (/\.html$/i.test(b.ref.split('#')[0])) model.errors.push(`broken page link on ${b.page}: ${b.ref}`);
    else model.warnings.push(`missing file referenced on ${b.page}: ${b.ref}`);
  }
  model.warnings.forEach((w) => log('warning:', w));
  if (model.errors.length) { model.errors.forEach((e) => console.error('ERROR:', e)); throw new Error(`${model.errors.length} content error(s); build stopped so nothing broken is published:\n - ${model.errors.join('\n - ')}`); }
  const count = (d) => { let n = 0; (function w(x) { for (const e of fs.readdirSync(x, { withFileTypes: true })) e.isDirectory() ? w(path.join(x, e.name)) : n++; })(d); return n; };
  log(`built ${production ? 'PRODUCTION' : 'PREVIEW'} site -> ${path.relative(process.cwd(), out) || '.'} (${count(out)} files; ${model.projects.length} projects, ${model.experience.length} experience, ${model.certificates.length} certificates, ${model.research.length} research)`);
  return model;
}

if (require.main === module) {
  try { build({ production: process.env.CONTEXT === 'production' || process.argv.includes('--production') }); }
  catch (e) { console.error(e.message); process.exit(1); }
}
module.exports = { build, findBrokenReferences };
