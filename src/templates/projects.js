'use strict';

const { escapeHtml: e } = require('../util');
const { chips, projectLinks } = require('../blocks');

function projectCard(project, index) {
  const facts = project.facts || [];
  const visual = (project.case_visuals || []).find((item) => item.type === 'diagram');
  const screenshot = project.screenshots || [];
  return `<article class="case reveal" id="project-${String(index + 1).padStart(2, '0')}"><header class="case-head"><p class="case-index">Project ${String(index + 1).padStart(2, '0')}</p>${chips(project.case_chips?.length ? project.case_chips : project.status_chips || [])}<h3 class="case-title">${e(project.title)}</h3><ul class="labels" aria-label="Project categories">${(project.categories || []).map((category) => `<li class="label">${e(category)}</li>`).join('')}</ul></header>
<div class="case-grid"><dl class="case-facts">${facts.map((fact) => `<div><dt>${e(fact.label)}</dt><dd>${e(fact.text)}</dd></div>`).join('')}</dl>
<aside class="case-side" aria-label="${e(project.title)} details">${visual ? `<figure class="diagram"><figcaption><span class="fig-title">${e(visual.title)}</span></figcaption><ol>${(visual.items || []).map((item) => `<li${item.kind && item.kind !== 'normal' ? ` class="is-${e(item.kind)}"` : ''}>${e(item.title)}${item.detail ? `<small>${e(item.detail)}</small>` : ''}</li>`).join('')}</ol>${visual.note ? `<p class="note">${e(visual.note)}</p>` : ''}</figure>` : ''}
${project.technologies?.length ? `<div class="side-block"><h4>${e(project.side_heading || 'Technology')}</h4><ul class="tech">${project.technologies.map((tool) => `<li>${e(tool)}</li>`).join('')}</ul></div>` : ''}
${screenshot.map((shot) => `<figure class="shot"><img src="${e(shot.image)}" alt="${e(shot.alt)}" loading="lazy"><figcaption>${e(shot.caption || '')}</figcaption></figure>`).join('')}
<p class="case-links">${projectLinks(project, 'text-link', project.generatedHref)}</p></aside></div></article>`;
}

function otherProject(project) {
  return `<li class="work-row${project.placeholder ? ' is-planned' : ''} reveal"><div class="work-row-head"><h3>${e(project.title)}</h3><ul class="labels">${(project.categories || []).map((category) => `<li class="label">${e(category)}</li>`).join('')}</ul>${chips(project.status_chips || [])}</div><div class="work-row-body"><p>${e(project.short_description)}</p>${(project.screenshots || []).map((shot) => `<figure class="shot"><img src="${e(shot.image)}" alt="${e(shot.alt)}" loading="lazy"></figure>`).join('')}${projectLinks(project, 'text-link', project.generatedHref)}</div></li>`;
}

module.exports = function projects(model) {
  const featured = model.projects.filter((project) => project.featured);
  const other = model.projects.filter((project) => !project.featured && !project.placeholder);
  const planned = model.projects.filter((project) => project.placeholder);
  return `<main id="main"><section class="page-head" aria-labelledby="projects-h"><p class="eyebrow">Work</p><h1 id="projects-h">Projects</h1><p class="lede">${e(model.profile.projects_page_lede || '')}</p><div class="legend" role="group" aria-label="Status labels used on this site"><span><span class="state state--done">Implemented</span></span><span><span class="state state--proposed">Proposed</span></span><span><span class="state state--wip">In progress</span></span><span><span class="state state--planned">Planned</span></span></div></section>
<section id="featured" aria-labelledby="feat-h"><header class="section-head"><p class="eyebrow">Featured</p><h2 id="feat-h">Featured case studies</h2></header>${featured.map(projectCard).join('\n')}</section>
<section aria-labelledby="other-h"><header class="section-head"><p class="eyebrow">Other work</p><h2 id="other-h">Other projects</h2></header><ul class="work-list">${other.map(otherProject).join('\n')}</ul></section>
${planned.length ? `<section aria-labelledby="future-h"><header class="section-head"><p class="eyebrow">Future work</p><h2 id="future-h">Planned work</h2></header><ul class="work-list">${planned.map(otherProject).join('\n')}</ul></section>` : ''}
<section class="contact-preview" aria-labelledby="code-h"><p class="eyebrow">Source</p><h2 id="code-h">See the code</h2><p class="lede">Source for these projects is available on GitHub.</p><a href="${e(model.contact.github_url)}" class="btn-primary" target="_blank" rel="noopener">View GitHub profile<span class="sr-only"> (opens in new tab)</span></a></section></main>`;
};
