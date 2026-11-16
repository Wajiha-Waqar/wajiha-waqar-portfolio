# Wajiha Waqar — Portfolio

Personal portfolio documenting work in AI, machine learning, data engineering and research, hosted on Netlify:
**https://wajiha-waqar-portfolio.netlify.app/**

The site keeps its editorial, research-journal design and is generated as static HTML. Portfolio facts and content
are managed as JSON through Decap CMS; shared page templates and the existing case-study bodies are maintained in
`src/`.

## Design system

The site uses Source Serif 4 for display headings, Inter for body and interface text, and IBM Plex Mono for metadata.
Its neutral paper background (`#F9FAFB`), ink (`#111827`) and restrained navy accent (`#1E3A8A`) keep the presentation
readable and research-focused.

## Portfolio

- **FlyRank Search Intelligence Internship** — signal validation, explainable baseline scoring and ranked review queues.
- **Leakage-Aware Content Refresh Opportunity Scoring** — a held-out, time-split ranking-model case study.
- **Research Paper Assistant Workflow** — a source-grounded prompt-chaining workflow.
- **Cross-session prompt-injection research** — ongoing undergraduate research; no results are reported.
- Additional project work, experience, education, research interests, resume and contact information.

The original root-level HTML pages and media remain in the repository as preserved source copies. The four detailed
case studies are copied to `src/pages/` for the CMS build; their body markup is retained.

## Structure

```
content/                 CMS-managed JSON records
src/                     templates, shared layout, content loader and preserved case-study bodies
admin/                   Decap CMS entry, config, dashboard and deploy indicator
netlify/functions/       single-account GitHub OAuth endpoints and shared handler
assets/, images/, resume/ documents, images, certificate and resume
style.css, script.js     site design and client-side interactions
build.js                 generates dist/ from content/ and src/
test/                    automated content, build, CMS, admin and OAuth tests
docs/CMS.md              setup, approval workflow, certificate and troubleshooting guide
```

`admin.js` is the earlier token-based editor and is not loaded by the current Decap CMS. It remains separate; do not
combine it with the CMS. The old snapshot under `mnt/user-data/outputs/portfolio/` is not part of the deployed admin.

## Local development

Use Node.js 20 or newer (`.nvmrc` selects 20):

```bash
npm install
npm run build
npm run build:production
npm test
npx serve dist
```

`npm run build` makes a preview build: draft entries can appear, the pages are marked noindex, and hidden entries are
never rendered. `npm run build:production` excludes draft and hidden records. Netlify runs `npm run build` with
`CONTEXT=production` for its production deployment, so production visibility rules are applied automatically.

Edit content from `/admin/` after the GitHub OAuth setup in [`docs/CMS.md`](docs/CMS.md). Never put OAuth secrets or
personal access tokens in repository files. A CMS change is a draft pull request; inspect its Netlify Deploy Preview,
approve it, and explicitly publish/merge it to `main` before it reaches production.

If a build fails, fix the content error identified in the output and rebuild. Netlify keeps serving the last successful
production deploy; see the CMS guide for recovery and rollback instructions.

## Hosting and security

The Netlify build and function configuration is in `netlify.toml`. GitHub OAuth permits only the account named by the
Netlify `ALLOWED_GITHUB_USER` variable and checks write access to the configured repository. The OAuth client secret
belongs only in Netlify environment variables.

## Contact and reuse

- GitHub: [github.com/Wajiha-Waqar](https://github.com/Wajiha-Waqar)
- LinkedIn: [linkedin.com/in/wajiha-waqar](https://www.linkedin.com/in/wajiha-waqar)
- Email: wajiha.waqar@example.com

Code may be used for reference; personal portfolio content, writing, documents and images are not licensed for reuse.
