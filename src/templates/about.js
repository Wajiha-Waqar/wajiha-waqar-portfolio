'use strict';

const { marked } = require('marked');
const { escapeHtml: e } = require('../util');

module.exports = function about(model) {
  const p = model.profile;
  const edu = model.education;
  const xp = model.experience.map((item) => item.organization).join(' · ');
  const principles = p.principles || [];
  return `<main id="main"><section class="page-head" aria-labelledby="about-h"><p class="eyebrow">Profile</p><h1 id="about-h">About</h1></section>
<section class="about"><aside class="about-aside" aria-label="Profile summary"><img class="about-photo" src="${e(model.settings.profile_image)}" alt="${e(model.settings.profile_image_alt)}" width="320" height="320"><dl class="facts"><div><dt>University</dt><dd>${e(edu.institution)}</dd></div><div><dt>Degree</dt><dd>${e(edu.degree)}</dd></div><div><dt>Expected</dt><dd>Graduation, ${e(edu.expected_graduation)}</dd></div><div><dt>Focus</dt><dd>${e(p.focus)}</dd></div><div><dt>Experience</dt><dd>${e(xp)}</dd></div></dl><a href="${e(model.settings.cv_file)}" class="btn-primary" download>Download CV</a></aside>
<div class="about-main"><div class="about-block"><h2>Biography</h2><div class="prose">${marked.parse(p.biography || '')}</div></div>
${principles.length ? `<div class="about-block reveal"><h2>Working principles</h2>${p.principles_lede ? `<p class="lede">${e(p.principles_lede)}</p>` : ''}<ul class="principles">${principles.map((item) => `<li>${e(item)}</li>`).join('')}</ul></div>` : ''}
${p.career_interests?.length ? `<div class="about-block reveal"><h2>Developing interests</h2><ul class="principles">${p.career_interests.map((item) => `<li>${e(item)}</li>`).join('')}</ul></div>` : ''}
<div class="about-block reveal"><h2>Elsewhere on this site</h2><ul class="principles"><li><a href="index.html#expertise">Technical expertise</a>: skills grouped by how they are used.</li><li><a href="index.html#research">Research interests</a>: connected areas of study.</li><li><a href="index.html#experience">Professional experience</a> and <a href="index.html#education">education</a>.</li></ul></div></div></section></main>`;
};
