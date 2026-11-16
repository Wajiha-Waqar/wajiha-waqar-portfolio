'use strict';

const { escapeHtml: e } = require('../util');

module.exports = function contact(model) {
  const c = model.contact;
  const items = [];
  if (c.github_url) items.push(['GitHub', c.github_display || c.github_url, c.github_url]);
  if (c.linkedin_url) items.push(['LinkedIn', c.linkedin_display || 'Professional profile', c.linkedin_url]);
  if (c.email) items.push(['Email', c.email_display || 'Send an email', `mailto:${c.email}`]);
  for (const link of c.other_links || []) items.push([link.label, link.display || link.url, link.url]);
  return `<main id="main"><section class="contact-section" aria-labelledby="contact-h"><header class="section-head"><p class="eyebrow">Contact</p><h1 id="contact-h">Let’s Connect</h1><p class="lede">${e(c.lede)}</p></header><ul class="contact-list">${items.map(([label, display, href]) => `<li><a href="${e(href)}" class="contact-link"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}><span>${e(label)}</span><span>${e(display)}</span>${/^https?:/.test(href) ? '<span class="sr-only">(opens in new tab)</span>' : ''}</a></li>`).join('')}</ul></section></main>`;
};
