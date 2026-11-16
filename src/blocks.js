'use strict';

const { escapeHtml: e } = require('./util');

function projectLinks(project, className = 'text-link', generatedHref = '') {
  const links = [];
  const add = (label, href) => {
    if (href) {
      const external = /^https?:/.test(href);
      links.push(`<a class="${e(className)}" href="${e(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${e(label)}${external ? '<span class="sr-only"> (opens in new tab)</span>' : ''}</a>`);
    }
  };
  add(project.case_study_label || 'Read case study', project.case_study_url || generatedHref);
  add(project.github_label || 'GitHub', project.github_url);
  add(project.live_demo_label || 'Live demo', project.live_demo_url);
  for (const link of project.extra_links || []) add(link.label, link.url);
  return links.join('');
}

function chips(items = []) {
  if (!items.length) return '';
  return `<div class="state-row">${items.map((item) => {
    const cls = ({ done: 'done', proposed: 'proposed', wip: 'wip', planned: 'planned', note: 'note' })[item.style] || 'note';
    return `<span class="state state--${cls}">${e(item.label)}</span>`;
  }).join('')}</div>`;
}

module.exports = { projectLinks, chips };
