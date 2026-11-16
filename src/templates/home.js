'use strict';

const { marked } = require('marked');
const { escapeHtml: e } = require('../util');
const { chips, projectLinks } = require('../blocks');

const md = (value) => marked.parse(String(value || ''), { mangle: false, headerIds: false });
const list = (items = [], cls = '') => `<ul${cls ? ` class="${e(cls)}"` : ''}>${items.map((item) => `<li>${e(item)}</li>`).join('')}</ul>`;

function projectVisual(project) {
  const visuals = project.home_visuals || [];
  const matrix = visuals.find((v) => v.type === 'matrix');
  const chart = visuals.find((v) => v.type === 'chart');
  if (chart) {
    const ref = chart.base_rate == null ? '' : `Base rate ${Number(chart.base_rate).toFixed(4)}`;
    return `<div class="feature-visual"><figure class="chart"><figcaption><span class="fig-title">${e(chart.title)}</span></figcaption><div class="chart-key" aria-hidden="true"><span class="key key--base">${e(chart.key_a)}</span><span class="key key--rf">${e(chart.key_b)}</span>${ref ? `<span class="key key--ref">${e(ref)}</span>` : ''}</div>
<div class="chart-rows" role="img" aria-label="${e((chart.rows || []).map((row) => `${row.label}: ${chart.key_a} ${row.a}, ${chart.key_b} ${row.b}`).join('; '))}">
${(chart.rows || []).map((row) => `<div class="crow" aria-hidden="true"><span class="clabel">${e(row.label)}</span><div class="cbars"><div class="bar bar--base" style="--v:${Number(row.a)}">${Number(row.a).toFixed(row.decimals || 2)}</div><div class="bar bar--rf" style="--v:${Number(row.b)}">${Number(row.b).toFixed(row.decimals || 2)}</div></div></div>`).join('')}
</div><p class="chart-note">${e(chart.note || '')}</p></figure></div>`;
  }
  const diagram = visuals.find((v) => v.type === 'diagram');
  if (matrix || diagram) return `<div class="feature-visual">${matrix ? `<ul class="matrix">${(matrix.rows || []).map((r) => `<li><span class="state state--${e(r.style || 'note')}">${e(r.label)}</span>${e(r.text)}</li>`).join('')}</ul>` : ''}${diagram ? `<figure class="diagram"><figcaption><span class="fig-title">${e(diagram.title)}</span></figcaption><ol>${(diagram.items || []).map((i) => `<li${i.kind && i.kind !== 'normal' ? ` class="is-${e(i.kind)}"` : ''}>${e(i.title)}${i.detail ? `<small>${e(i.detail)}</small>` : ''}</li>`).join('')}</ol>${diagram.note ? `<p class="note">${e(diagram.note)}</p>` : ''}</figure>` : ''}</div>`;
  return '';
}

function featuredProject(project, index) {
  const chipsHtml = chips(project.status_chips || []);
  return `<article class="feature reveal"${project.anchor ? ` id="${e(project.anchor)}"` : ''}>
<div class="feature-main"><p class="case-index">Project ${String(index + 1).padStart(2, '0')}</p>${chipsHtml}
<h3>${e(project.title)}</h3><p>${e(project.short_description)}</p>
${list(project.technologies || [], 'tech')}
<p class="case-links">${projectLinks(project, 'text-link', project.generatedHref)}</p></div>
${projectVisual(project)}</article>`;
}

module.exports = function home(model) {
  const p = model.profile;
  const skills = model.skills.categories;
  const interests = model.researchInterests;
  const projects = model.projects.filter((project) => project.featured);
  const xp = model.experience;
  const edu = model.education;
  const publications = model.research;
  const contact = model.contact;
  return `<main id="main">
<div class="hero-wrap"><section class="hero" aria-labelledby="name">
<div class="hero-main"><p class="eyebrow">${e(p.eyebrow)}</p><h1 id="name">${e(p.name)}</h1><p class="hero-headline">${e(p.headline)}</p>
<div class="intro">${md(p.intro)}</div>
<div class="hero-buttons"><a href="projects.html" class="btn-primary">View Projects</a><a href="${e(model.settings.cv_file)}" class="btn-secondary" download>Download CV</a><a href="contact.html" class="btn-secondary">Contact</a></div>
</div><aside class="profile" aria-labelledby="profile-h"><h2 id="profile-h">Profile</h2><dl class="facts">
<div><dt>University</dt><dd>${e(edu.institution)}</dd></div><div><dt>Degree</dt><dd>${e(edu.degree)}</dd></div><div><dt>Expected</dt><dd>Graduation, ${e(edu.expected_graduation)}</dd></div><div><dt>Focus</dt><dd>${e(p.focus)}</dd></div>
${p.current_research ? `<div><dt>Research</dt><dd>${e(p.current_research)} ${p.current_research_status ? `<span class="state state--wip">${e(p.current_research_status)}</span>` : ''}</dd></div>` : ''}
${contact.github_url ? `<div><dt>Code</dt><dd><a href="${e(contact.github_url)}" target="_blank" rel="noopener">${e(contact.github_display || contact.github_url)}<span class="sr-only"> (opens in new tab)</span></a></dd></div>` : ''}
</dl></aside></section></div>
<section id="about" aria-labelledby="about-h"><header class="section-head"><p class="eyebrow">About</p><h2 id="about-h">About me</h2></header><div class="prose">${md(p.about_summary)}<p><a class="text-link" href="about.html">${e(p.about_link_label || 'Read the full profile')}</a></p></div></section>
<section id="expertise" aria-labelledby="exp-h"><header class="section-head"><p class="eyebrow">${e(model.skills.eyebrow)}</p><h2 id="exp-h">${e(model.skills.title)}</h2>${model.skills.lede ? `<p class="lede">${e(model.skills.lede)}</p>` : ''}</header><div class="capmap">
${skills.map((category, i) => `<div class="cap reveal"><h3><span class="cap-n">${String(i + 1).padStart(2, '0')}</span>${e(category.name)}</h3>${list(category.skills.map((skill) => skill.name), 'cap-list')}</div>`).join('')}
</div></section>
<section id="projects" aria-labelledby="proj-h"><header class="section-head"><p class="eyebrow">Featured projects</p><h2 id="proj-h">Featured projects</h2><p class="lede">${e(p.featured_lede || '')}</p><div class="legend" role="group" aria-label="Status labels used on this site"><span><span class="state state--done">Implemented</span></span><span><span class="state state--proposed">Proposed</span></span><span><span class="state state--wip">In progress</span></span><span><span class="state state--planned">Planned</span></span></div></header>
${projects.map(featuredProject).join('\n')}<p class="more-link"><a class="text-link" href="projects.html">All projects and case studies</a></p></section>
<div class="band"><section id="research" aria-labelledby="res-h"><header class="section-head"><p class="eyebrow">${e(interests.eyebrow)}</p><h2 id="res-h">${e(interests.title)}</h2><p class="lede">${e(interests.lede)}</p></header>
<div class="areas">${interests.areas.map((area) => `<div class="area reveal"><span class="area-k">${e(area.key)}${area.stage ? ` · ${e(area.stage)}` : ''}</span><h3>${e(area.title)}</h3>${list(area.items || [])}</div>`).join('')}</div>${interests.note ? `<p class="band-note">${e(interests.note)}</p>` : ''}</section></div>
<section id="experience" aria-labelledby="xp-h"><header class="section-head"><p class="eyebrow">Professional experience</p><h2 id="xp-h">Professional experience</h2></header><ol class="xp-list">
${xp.map((item) => `<li class="xp${item.major ? ' xp--major' : ''} reveal"><div class="xp-meta"><p class="xp-org">${e(item.organization)}</p><p class="xp-dates">${e(item.meta_label || item.employment_type || '')}</p></div><div class="xp-body"><h3>${e(item.title)}</h3>${item.description ? `<p>${e(item.description)}</p>` : ''}
${item.responsibilities?.length ? `<div class="xp-cols"><div><h4>${e(item.responsibilities_heading || 'Contributions')}</h4>${list(item.responsibilities)}</div>${item.skills?.length ? `<div><h4>Technical</h4>${list(item.skills, 'tech')}</div>` : ''}</div>` : ''}
${item.achievements ? `<p>${e(item.achievements)}</p>` : ''}${item.skills_note ? `<p class="muted">Skills: ${e(item.skills_note)}</p>` : ''}
${item.links?.map((link) => `<a class="text-link" href="${e(link.url)}">${e(link.label)}</a>`).join(' ')}
${item.certificate ? model.certificates.filter((c) => c.id === item.certificate).map((c) => `<a class="btn-secondary-sm" href="${e(c.pageHref || c.file)}">View certificate</a>`).join('') : ''}</div></li>`).join('\n')}
</ol></section>
<section id="education" aria-labelledby="edu-h"><header class="section-head"><p class="eyebrow">Education</p><h2 id="edu-h">Education</h2></header><div class="edu reveal"><p class="edu-when">Expected graduation<br>${e(edu.expected_graduation)}</p><div class="edu-body"><h3>${e(edu.degree)}</h3><p class="edu-school">${e(edu.institution)}</p>${edu.description ? `<p>${e(edu.description)}</p>` : ''}${edu.future_direction ? `<p class="muted">${e(edu.future_direction)}</p>` : ''}</div></div></section>
<section id="publications" aria-labelledby="pub-h"><header class="section-head"><p class="eyebrow">Research &amp; technical writing</p><h2 id="pub-h">Research &amp; technical writing</h2></header>
${['ongoing', 'technical-report', 'peer-reviewed'].map((type) => { const records = publications.filter((r) => r.type === type); const label = { ongoing: 'Ongoing research', 'technical-report': 'Technical reports and self-published work', 'peer-reviewed': 'Peer-reviewed publications' }[type]; return `<h3 class="group-label">${label}</h3>${records.length ? `<ul class="work-list">${records.map((r) => `<li class="work-row work-row--stack reveal"><div class="work-row-head"><h4 class="row-title">${e(r.title)}</h4>${chips(r.status_chips || [])}</div><div class="work-row-body"><p>${e(r.short_description)}</p>${r.detail_page ? `<a class="text-link" href="${e(r.detail_page)}">${e(r.detail_label || 'Read research overview')}</a>` : projectLinks(r, 'text-link', r.generatedHref)}</div></li>`).join('')}</ul>` : '<p class="muted">None listed yet.</p>'}`; }).join('\n')}
</section>
<section class="contact-preview" id="contact" aria-labelledby="contact-h"><p class="eyebrow">Contact</p><h2 id="contact-h">Let’s connect</h2><p class="lede">${e(contact.home_lede)}</p><div class="hero-buttons"><a href="contact.html" class="btn-primary">Get in touch</a>${contact.github_url ? `<a href="${e(contact.github_url)}" class="btn-secondary" target="_blank" rel="noopener">GitHub<span class="sr-only"> (opens in new tab)</span></a>` : ''}</div></section>
</main>`;
};
