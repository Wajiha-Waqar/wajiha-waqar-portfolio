# Wajiha Waqar — Portfolio

A personal portfolio website showcasing my work in Artificial Intelligence, Machine Learning, Data Engineering, and Research.

**Live site:** [https://wajiha-waqar.github.io/wajiha-waqar-portfolio/](https://wajiha-waqar.github.io/wajiha-waqar-portfolio/)

---

## About

I'm an IT undergraduate focused on Artificial Intelligence, Machine Learning, and Operations Research. This portfolio documents my project work, research interests, and career goals, with an emphasis on transparent, evidence-based writing rather than overstated claims.

The site showcases:

- **FlyRank Search Intelligence Internship** — a case study on framing an SEO prioritization problem as a machine learning ranking task
- Additional AI/ML projects (Resume Parser, and an upcoming Disaster Alert System)
- Research interests and academic goals
- Resume and contact information

---

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- Hosted with GitHub Pages

No frameworks or build tools — the site is intentionally simple and dependency-free.

---

## Project Structure

```
wajiha-waqar-portfolio/
│
├── index.html          Home page
├── about.html           About / bio / research interests
├── projects.html         Project listing
├── flyrank.html          FlyRank case study
├── contact.html          Contact links
│
├── style.css            Site-wide styles
├── script.js             Small UI behaviors
│
├── images/
│   ├── Portfolio_logo.svg
│   ├── profile.jpg
│   ├── flyrank-notebook.png
│   ├── github.png
│   └── resume-parser.png
│
├── resume/
│   └── Wajiha_Waqar_Resume.pdf
│
└── README.md
```

---

## Design System

| Element | Value |
| --- | --- |
| Heading font | Inter SemiBold |
| Body font | Inter Regular |
| Primary | `#2563EB` |
| Text | `#111827` |
| Background | `#F9FAFB` |
| Accent | `#10B981` |

The visual identity is kept clean, minimal, and research-focused, prioritizing readability over decoration.

---

## Running Locally

No build step is required. Clone the repository and open `index.html` directly in a browser, or serve it locally:

```bash
git clone https://github.com/Wajiha-Waqar/wajiha-waqar-portfolio.git
cd wajiha-waqar-portfolio
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

---

## Deployment

The site is deployed with GitHub Pages:

1. Push changes to the `main` branch.
2. In **Settings → Pages**, set the source to **Deploy from branch → `main` → `/root`**.
3. GitHub Pages will publish the site automatically after each push.

---

## Roadmap

- [ ] Improve mobile responsiveness
- [ ] Add additional case studies as new projects are completed
- [ ] Add more screenshots and project visuals
- [ ] Publish the Disaster Alert System project
- [ ] Add research publications as they become available
- [ ] Minor visual refinements and animations

---

## Contact

- GitHub: [github.com/Wajiha-Waqar](https://github.com/Wajiha-Waqar)
- LinkedIn: [linkedin.com/in/wajiha-waqar](https://www.linkedin.com/in/wajiha-waqar)
- Email: wajiha.waqar@example.com

---

## License

This repository contains personal portfolio content. Code may be reused for reference; personal content, writing, and images are not licensed for reuse.

---

## Admin panel

Edit the site without touching source code at `https://wajiha-waqar.github.io/wajiha-waqar-portfolio/admin/`.

**How it works.** GitHub Pages is static hosting, so there is no server and no username/password. The admin panel is a static page that signs in with a GitHub fine-grained access token and saves changes as normal Git commits through the GitHub API. GitHub verifies the token on every write, so the public admin URL is harmless without it. Every change is permanent *and* reversible from the repo's commit history.

**One-time setup**
1. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
2. Repository access: *Only select repositories* → this repo. Permissions → Repository → **Contents: Read and write** (optionally *Pages: Read*). Set an expiry.
3. Open `/admin/`, paste the token, sign in.

**What you can do**
- **Pages:** click and type over any text, duplicate / move / delete blocks, change links and images, edit title and description, preview at desktop/tablet/mobile widths.
- **Files:** edit any text file (including `style.css`), upload and delete files, create a new page from an existing one.
- **Navigation:** edit the menu once and apply it to every page in a single commit.

**Limits.** Uploads over 50 MB (e.g. large videos) must be added with Git. Branch protection that requires pull requests on `main` will block saves. The first save of a page may re-indent its HTML (it renders identically).

Files: `admin/index.html`, `admin/admin.css`, `admin/admin.js` (UI), `admin/core.js` (GitHub client and helpers), `admin/config.js` (owner / repo / branch).
