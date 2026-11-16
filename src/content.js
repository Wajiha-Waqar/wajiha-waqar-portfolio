'use strict';

const fs = require('fs');
const path = require('path');

function readJson(root, file) {
  const filename = path.join(root, file);
  let value;
  try {
    value = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    throw new Error(`${file}: could not read valid JSON (${error.message})`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${file}: expected a JSON object`);
  return value;
}

function readCollection(root, name, production, errors) {
  const dir = path.join(root, 'content', name);
  if (!fs.existsSync(dir)) throw new Error(`content/${name}: directory is missing`);
  const entries = [];
  for (const filename of fs.readdirSync(dir).filter((file) => file.endsWith('.json')).sort()) {
    const relative = `content/${name}/${filename}`;
    try {
      const record = readJson(root, relative);
      record.id = path.basename(filename, '.json');
      if (!['published', 'draft', 'hidden'].includes(record.status)) throw new Error('status must be published, draft, or hidden');
      if (record.status === 'hidden' || (production && record.status === 'draft')) continue;
      entries.push(record);
    } catch (error) {
      errors.push(`${relative}: ${error.message}`);
    }
  }
  return entries.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || String(a.title || a.organization || '').localeCompare(String(b.title || b.organization || '')));
}

function loadContent(root, { production = false } = {}) {
  const errors = [];
  const warnings = [];
  const singleton = (file) => readJson(root, `content/${file}.json`);
  const model = {
    projects: readCollection(root, 'projects', production, errors),
    experience: readCollection(root, 'experience', production, errors),
    certificates: readCollection(root, 'certificates', production, errors).filter((certificate) => {
      if (!certificate.file) {
        warnings.push(`content/certificates/${certificate.id}.json: no certificate file is uploaded yet`);
        return false;
      }
      const relative = certificate.file.replace(/^\//, '');
      const resolved = path.resolve(root, relative);
      if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) {
        errors.push(`content/certificates/${certificate.id}.json: certificate file must stay inside the repository`);
        return false;
      }
      if (!/\.(pdf|jpe?g|png|webp)$/i.test(relative)) {
        errors.push(`content/certificates/${certificate.id}.json: certificate file must be a PDF, JPG, PNG, or WebP`);
        return false;
      }
      if (!fs.existsSync(resolved)) {
        errors.push(`content/certificates/${certificate.id}.json: file not found: ${certificate.file}`);
        return false;
      }
      return true;
    }),
    research: readCollection(root, 'research', production, errors),
    profile: singleton('profile'),
    skills: singleton('skills'),
    education: singleton('education'),
    researchInterests: singleton('research-interests'),
    contact: singleton('contact'),
    settings: singleton('settings'),
    errors,
    warnings,
  };
  model.skills.categories = (model.skills.categories || []).filter((category) => category.visible !== false)
    .map((category) => ({ ...category, skills: (category.skills || []).filter((skill) => skill.visible !== false) }));
  model.nav = model.settings.navigation || [
    { label: 'Home', href: 'index.html' }, { label: 'About', href: 'about.html' },
    { label: 'Projects', href: 'projects.html' }, { label: 'Research', href: 'index.html#research' },
    { label: 'Experience', href: 'index.html#experience' }, { label: 'Contact', href: 'contact.html' },
  ];
  model.projects = model.projects.filter((record) => !record.placeholder || !production);
  if (errors.length) throw new Error(`Invalid CMS content:\n - ${errors.join('\n - ')}`);
  return model;
}

module.exports = { loadContent };
