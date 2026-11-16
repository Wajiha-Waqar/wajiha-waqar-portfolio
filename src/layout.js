'use strict';

const { escapeHtml: e } = require('./util');

function page({ model, file, title, description, main, after = '', rel = '', noindex = false, preview = false }) {
  const s = model.settings;
  const prefix = rel || '';
  const nav = model.nav.map((item) => {
    const current = item.href.split('#')[0] === file && !item.href.includes('#');
    return `<li><a href="${e(prefix + item.href)}"${current ? ' aria-current="page"' : ''}>${e(item.label)}</a></li>`;
  }).join('\n');
  const banner = preview ? '<div class="preview-banner" role="status">Preview build — draft content may be visible. This page is not indexed.</div>' : '';
  const robots = noindex || preview ? '<meta name="robots" content="noindex, nofollow">' : '';
  const cv = e(s.cv_file || 'resume/wajiha_waqar_resume.pdf');
  const logo = e(s.logo || 'images/Portfolio_logo.svg');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="${e(description)}">
<meta name="theme-color" content="#F9FAFB">
${robots}
<title>${e(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=Inter:wght@400;500;600&amp;family=Source+Serif+4:wght@400;500;600&amp;display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="${e(prefix)}favicon.svg">
<link rel="icon" type="image/png" sizes="96x96" href="${e(prefix)}favicon-96x96.png">
<link rel="shortcut icon" href="${e(prefix)}favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="${e(prefix)}apple-touch-icon.png">
<link rel="manifest" href="${e(prefix)}site.webmanifest">
<script>document.documentElement.classList.add('js');</script>
<link rel="stylesheet" href="${e(prefix)}style.css">
</head>
<body>
${banner}
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header"><nav class="navbar" aria-label="Primary">
<a class="nav-logo" href="${e(prefix)}index.html"><img src="${e(prefix + logo)}" alt="" width="30" height="30"><span>${e(s.site_name)}</span></a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu"><span class="sr-only">Menu</span><span class="nav-toggle-bars" aria-hidden="true"></span></button>
<ul class="nav-links" id="nav-menu">${nav}</ul>
</nav></header>
${main}
<footer class="site-footer"><div class="footer-inner">
<p>${e(s.footer_copyright)}</p><p>${e(s.footer_note)}</p>
</div></footer>
${after}<script src="${e(prefix)}script.js"></script>
</body></html>`;
}

module.exports = { page };
