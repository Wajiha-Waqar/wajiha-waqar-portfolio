# Content management guide

Manage the portfolio from **https://wajiha-waqar-portfolio.netlify.app/admin/** without editing HTML, CSS or JavaScript.

## 1. How it works

```
 Content Manager (/admin)  ──edit──▶  Draft  ──▶  Preview  ──▶  you approve  ──▶  Publish
        │                               │            │                               │
   Decap CMS 3.17.3             branch cms/…    Netlify Deploy Preview        merge to main (1 commit)
   signs in via GitHub          + pull request  (draft content visible)              │
                                                                              Netlify builds → live site
```

- **Content** lives in `content/*.json` (one file per project, experience, certificate and research entry, plus single files for settings, profile, skills and so on).
- **Presentation** lives in `src/` (templates) and `style.css`. `build.js` turns content into the same pages the site always had. Netlify runs it on every deploy.
- **Hand-written case studies** (`src/pages/flyrank.html`, `research-agent.html`, `capstone.html`, `fyp-research.html`) keep their exact markup. The CMS controls their cards, links, header, footer and navigation, but their *body text* is still edited in those files.
- **Drafts never reach the live site.** Each edit is saved on its own `cms/…` branch. Only *Publish* merges it to `main`. In addition, every record has a *Visibility* field; `draft` and `hidden` records are removed from production builds even after they are merged.
- **History is Git history.** Every publish is one commit, so any change can be reverted.

### Why this architecture

| Option | Verdict |
| --- | --- |
| **Decap CMS + GitHub backend + self-hosted OAuth proxy (chosen)** | Git-based, no third party holds your repo access, secrets stay in Netlify, and the proxy can allow exactly one GitHub account. |
| Decap Turbo | An optional *hosted* backend (separate account and plans, a third-party service that talks to GitHub for you). Not needed for a single-owner site. Can be adopted later by changing `backend` in `admin/config.yml`. |
| Netlify Identity / Git Gateway | Legacy; deliberately not used. |
| A database-backed CMS | Would replace the static, Git-versioned architecture. Unnecessary. |

## 2. One-time setup (manual steps)

### A. Create a GitHub OAuth App
GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**

| Field | Value |
| --- | --- |
| Application name | Portfolio CMS |
| Homepage URL | `https://wajiha-waqar-portfolio.netlify.app` |
| Authorization callback URL | `https://wajiha-waqar-portfolio.netlify.app/.netlify/functions/callback` |

Register it, copy the **Client ID**, then **Generate a new client secret** and copy it. Never paste either into a file in the repository.

### B. Add environment variables in Netlify
**Site configuration → Environment variables** (scope: *Functions*, or all)

| Variable | Value | Secret? |
| --- | --- | --- |
| `GITHUB_CLIENT_ID` | from step A | no |
| `GITHUB_CLIENT_SECRET` | from step A | **yes** |
| `ALLOWED_GITHUB_USER` | `Wajiha-Waqar` (the only account that may sign in) | no |
| `GITHUB_REPO` | `Wajiha-Waqar/wajiha-waqar-portfolio` | no |
| `OAUTH_SCOPE` | `repo`, or `public_repo` if the repository is public (narrower, enough) | no |
| `SITE_URL` | `https://wajiha-waqar-portfolio.netlify.app` (recommended: pins the sign-in redirect address; without it the function falls back to Netlify's `URL` variable, then the request host) | no |

Then set `auth_scope` in `admin/config.yml` to the same value.

### C. Check Netlify build settings
`netlify.toml` already sets these; confirm in **Site configuration → Build & deploy**:
- Repository linked to `Wajiha-Waqar/wajiha-waqar-portfolio`, production branch `main`.
- Build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`.
- **Deploy Previews** must be enabled for pull requests (Netlify's default). This provides the *Preview* step for drafts; the exact menu wording changes, so look for the Deploy Previews setting under Build & deploy.

### D. Push this repository and deploy
After the first deploy, open `/admin/` and sign in.

### E. Keep it single-user
Do not add collaborators to the repository. Even so, the sign-in function refuses every GitHub account except `ALLOWED_GITHUB_USER`.

## 3. Everyday workflow

1. Open `/admin/`, choose **Login with GitHub**, then pick a section and edit.
2. **Save** → the change is now a **Draft** (nothing is public).
3. Open the **Workflow** tab. The entry shows a **Check for Preview** button; once Netlify has built the preview it becomes **View Preview** and opens the real portfolio with your draft visible (marked *Preview build*, with a banner, and not indexed).
4. Review the actual Deploy Preview and the pull-request diff. Move the entry from **Draft** to **In review** while it is being checked. Move it to **Ready** only after you have explicitly approved the content.
5. **Manual approval is required: approve the reviewed change, then use Publish to merge the ready CMS pull request to `main`.** Do not click it until your review is complete. Netlify then builds the production site. No CMS save or preview automatically publishes to production. If branch protection requires GitHub checks or reviews, complete those on the pull request and merge it in GitHub after approval instead.
6. The indicator at the bottom-left of the admin shows **Deploying your changes**, then **Live site is up to date**, or **Deploy failed** with a link to the Netlify log. Allow about a minute. (The indicator is added by this project; Decap itself only reports preview status.)
7. The **Dashboard** link sits at the bottom-left beside the deploy indicator (visible once you are signed in; Decap has no API for adding header links). It shows live status, drafts waiting with their stage and preview link, content counts and recent publishes. You can also open `/admin/dashboard.html` directly.

These are separate states: Decap's **Draft / In review / Ready** stages are editorial workflow labels; a content record's **Published / Draft / Hidden** visibility controls whether the generator renders it; GitHub records whether the pull request is open or merged; Netlify reports whether its Deploy Preview or production build is queued, successful or failed. A record marked Published is still only a draft branch until the pull request is explicitly merged. Hidden records are never rendered, including in previews.

## 4. How to manage each content type

| Section | Add | Edit | Delete / hide |
| --- | --- | --- | --- |
| **Projects** | *New Project*; set *Featured* for case-study cards; *Display order* sets position | Open it, change fields, Save | *Delete entry*, or set Visibility to Hidden to keep it |
| **Skills** | Add category / add skill in the list | Edit text; drag to reorder; tick *Visible* | Remove from the list, or untick *Visible* |
| **Experience** | *New Experience*; *Prominent card* for the large layout | Edit; *Related certificate* links a certificate | Delete, or Visibility → Hidden |
| **Certificates** | *New Certificate*, upload the file (see §5) | Edit | Delete, or Visibility → Hidden/Draft |
| **Education / About Me / Research Interests / Social Links / Website Settings** | Single documents | Edit fields and Save | n/a |
| **Research and Publications** | *New Research entry*; choose its **Type** | Edit | Delete / Hidden |

Notes
- A new project without a *Case study URL* gets an automatic detail page at `/projects/<slug>`. Existing case studies keep their URLs.
- **Type** decides where research appears: *Ongoing research*, *Technical report / self-published*, or *Peer-reviewed publication*. Choose *Peer-reviewed* only for work that has actually been peer reviewed.
- Leave *LinkedIn* empty to remove it everywhere. Contact and footer changes apply to every page.

## 5. Certificates

1. **Certificates → New Certificate**.
2. Fill in title, issuer, date, description. **Choose file** and upload a PDF (or JPG/PNG/WebP).
3. Pick the **Associated experience** (or set *Related certificate* on the experience), leave *Allow preview* / *Allow download* as you wish.
4. Set **Visibility** to *Published*, then Save → Preview → Publish.

Visitors then get a **View certificate** button on that experience. It opens a dedicated page with an embedded PDF viewer for PDFs, **Download** (if allowed), **Open in new tab**, and **Back to portfolio**. Image certificates use the open/download links. On phones that cannot embed PDFs, the page falls back to those links.

**FlyRank:** the record `flyrank-internship-certificate` already exists as a draft with no file. Upload the PDF and set it to *Published* to turn the button on.

Privacy
- The site only deploys files of **published** certificates. Draft, hidden and unreferenced files are not copied to the live site.
- **However, a Git repository is not private storage.** If the repository is public, an uploaded file is visible on GitHub even if the site does not serve it. Upload only documents you are content to make public, or make the repository private.

## 6. Undoing a change

- **Before publishing:** delete the draft in the Workflow tab.
- **After publishing:** Dashboard → *Recent publishes* → *Open on GitHub* → **Revert** → merge the revert pull request. Netlify redeploys the previous version.
- Or in a terminal: `git revert <commit>` and push.

## 7. Security model

- Only one GitHub account can obtain a token. `netlify/functions/callback.js` checks the signed-in login against `ALLOWED_GITHUB_USER` and `GITHUB_REPO` write access. Any other account receives an error, **never a token**, and its token is revoked.
- The OAuth client secret exists only in Netlify. No token or secret is in the repository or browser code. The browser holds only *your own* sign-in token (Decap's session).
- Sign-in is protected against forged requests with a one-time `state` value, and the OAuth scope comes from server configuration, not the request.
- GitHub itself enforces write permission on every save and publish.
- `/admin/*` is sent with `X-Frame-Options: DENY`, `Cache-Control: no-store` and `noindex`; public pages send `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`. (`X-Frame-Options` is set only on `/admin/*`, because repeating it on every path would send two conflicting values.) Hiding the URL is not relied on.
- Limitation: classic OAuth scopes cannot be limited to one repository (`repo`/`public_repo` apply to the account). If you want repository-scoped tokens, switch to a GitHub App.

## 8. Verify it on the live site (checklist)

These can only be confirmed against your real Netlify and GitHub accounts:

- [ ] `/admin/` loads and **Login with GitHub** completes (open the browser console and confirm there are no red errors; the Decap interface itself has not been run outside this project's automated tests).
- [ ] After signing in, the **Dashboard** link and the deploy indicator appear at the bottom-left, and the Dashboard shows your drafts.
- [ ] A second GitHub account (or a private window with a different login) is **refused**.
- [ ] Add a test project → *Draft* → **Check for Preview** shows it → Publish → it appears live → delete it.
- [ ] Edit a GitHub URL on a project and confirm it changes everywhere.
- [ ] Upload a PDF to the FlyRank certificate, publish, then test **View certificate**, **Download** and **Back to portfolio** on desktop and phone.
- [ ] Confirm a *Draft* entry is **not** visible on the live URL before publishing.
- [ ] Revert a test publish from the Dashboard.

## 9. Local use

```bash
npm install
npm run build          # preview build into dist/ (includes draft records; never hidden records)
npm run build:production
npm test
npx serve dist         # any static server works
```

## 10. Troubleshooting

| Symptom | Cause |
| --- | --- |
| Popup says *not configured* | An environment variable in §2B is missing. |
| *This GitHub account is not authorized* | Signed in with a different account than `ALLOWED_GITHUB_USER`. |
| *Error loading the CMS configuration* | A mistake in `admin/config.yml`; the message names the field. |
| Netlify build fails with *content error* | A content file is invalid (for example a certificate that is not a PDF or image). The message names the file and field; the previous live site stays up. |
| Publish fails with a *protected branch* or *merge* message | Branch protection on `main` requires reviews or status checks that a CMS publish cannot satisfy. Allow your account to merge, or relax the rule for `main`. |
| The sign-in popup never opens | The browser blocked the popup; allow popups for the site and retry. |
| No Dashboard link or deploy indicator | You are not signed in yet (they appear after login), or the browser blocked `admin-extras.js`. Check the console. |
| Publish done but site unchanged | Wait for the pill to show *Live*; open the Netlify deploy log if it shows *Deploy failed*. |

## 11. File inventory

The original root portfolio pages and original assets are deliberately preserved. The four detailed case-study bodies are copied without edits into `src/pages/` and wrapped in the shared generated shell. The home, about, projects and contact pages are generated from `content/*.json` and `src/templates/`.

The EDEX image remains at `images/Edex_internship_cert.jpg`; the old link `/assets/Edex_internship_cert.jpg` redirects to that existing file. The old token-based root `admin.js` and the separate `mnt/user-data/outputs/portfolio/admin/index.html` snapshot are not used by Decap CMS and are not copied as the current admin.
