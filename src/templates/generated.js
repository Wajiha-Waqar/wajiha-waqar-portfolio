'use strict';

const { escapeHtml: e } = require('../util');

const list = (items = []) => items.length ? `<ul>${items.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` : '';

function projectPage(model, project) {
  return `<main id="main"><section class="case-header"><p class="case-back"><a href="../projects.html">&larr; Projects</a></p><h1>${e(project.title)}</h1><p>${e(project.short_description)}</p></section>
<section class="case-section"><h2>Overview</h2><p>${e(project.detailed_description || project.short_description)}</p></section>
${project.facts?.map((fact) => `<section class="case-section"><h2>${e(fact.label)}</h2><p>${e(fact.text)}</p></section>`).join('') || ''}
${project.technologies?.length ? `<section class="case-section"><h2>Tools</h2><div class="tag-grid">${project.technologies.map((technology) => `<div class="tag">${e(technology)}</div>`).join('')}</div></section>` : ''}
<section class="contact-preview"><a href="../projects.html" class="btn-primary">Back to Projects</a></section></main>`;
}

function researchPage(model, research) {
  return `<main id="main"><section class="case-header"><p class="case-back"><a href="../index.html#research">&larr; Research</a></p><h1>${e(research.title)}</h1><p>${e(research.short_description)}</p></section>
${research.problem ? `<section class="case-section"><h2>Research problem</h2><p>${e(research.problem)}</p></section>` : ''}
${research.objectives?.length ? `<section class="case-section"><h2>Research objectives</h2>${list(research.objectives)}</section>` : ''}
${research.methodology ? `<section class="case-section"><h2>Methodology</h2><p>${e(research.methodology)}</p></section>` : ''}
<section class="contact-preview"><a href="../index.html#research" class="btn-primary">Back to Research</a></section></main>`;
}

function certificate(model, item) {
  const file = `../${item.file.replace(/^\//, '')}`;
  const isPdf = /\.pdf$/i.test(file);
  const canPreview = item.allow_preview && isPdf;
  return `<main id="main"><section class="case-header"><p class="case-back"><a href="../index.html#experience">&larr; Back to portfolio</a></p><h1>${e(item.title)}</h1><p>${e(item.issuer)}${item.issue_date ? ` · ${e(item.issue_date)}` : ''}</p>${item.description ? `<p>${e(item.description)}</p>` : ''}</section>
<section class="case-section">${canPreview ? `<div class="certificate-viewer"><iframe title="${e(item.title)}" src="${e(file)}" width="100%" height="720"></iframe></div>` : ''}
<div class="hero-buttons">${item.allow_download ? `<a class="btn-primary" href="${e(file)}" download>Download certificate</a>` : ''}<a class="btn-secondary" href="${e(file)}" target="_blank" rel="noopener">Open in new tab</a><a class="btn-secondary" href="../index.html#experience">Back to portfolio</a></div></section></main>`;
}

module.exports = { projectPage, researchPage, certificate };
